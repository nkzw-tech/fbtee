use std::{
    collections::{BTreeMap, BTreeSet},
    sync::OnceLock,
};

use indexmap::IndexMap;
use oxc::{
    allocator::{Allocator, Box as ArenaBox, CloneIn},
    ast::ast::*,
    ast_visit::{walk, walk_mut, Visit, VisitMut},
    codegen::Codegen,
    diagnostics::{Diagnostics, OxcDiagnostic},
    parser::Parser,
    semantic::Scoping,
    span::{GetSpan, SourceType, Span},
    syntax::{
        number::ToJsString,
        operator::BinaryOperator,
        scope::{ScopeFlags, ScopeId},
        symbol::{SymbolFlags, SymbolId},
    },
};

const GENDER: i32 = 1;
const NUMBER: i32 = 0;
const FBT_OPTIONS: &[&str] = &[
    "author",
    "common",
    "doNotExtract",
    "preserveWhitespace",
    "project",
    "subject",
];
const PARAM_OPTIONS: &[&str] = &["gender", "number", "name"];
const PLURAL_OPTIONS: &[&str] = &["many", "name", "showCount", "value", "count"];
const PRONOUN_OPTIONS: &[&str] = &["capitalize", "human"];
const PRONOUN_USAGES: &[&str] = &["object", "possessive", "reflexive", "subject"];
// Babel's JSX parser intentionally recognizes the HTML4-era JSX entity table, not the full
// HTML5 named entity set. Hashing must use the collector's exact decoded text.
const JSX_NAMED_ENTITIES: &str = "quot amp apos lt gt nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml OElig oelig Scaron scaron Yuml fnof circ tilde Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa Lambda Mu Nu Xi Omicron Pi Rho Sigma Tau Upsilon Phi Chi Psi Omega alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigmaf sigma tau upsilon phi chi psi omega thetasym upsih piv ensp emsp thinsp zwnj zwj lrm rlm ndash mdash lsquo rsquo sbquo ldquo rdquo bdquo dagger Dagger bull hellip permil prime Prime lsaquo rsaquo oline frasl euro image weierp real trade alefsym larr uarr rarr darr harr crarr lArr uArr rArr dArr hArr forall part exist empty nabla isin notin ni prod sum minus lowast radic prop infin ang and or cap cup int there4 sim cong asymp ne equiv le ge sub sup nsub sube supe oplus otimes perp sdot lceil rceil lfloor rfloor lang rang loz spades clubs hearts diams";

#[derive(Clone, Debug, Default)]
pub struct FbteeOptions {
    pub collect_fbt: bool,
    pub collect_packager: String,
    pub extra_options: Vec<String>,
    pub fbt_common: BTreeMap<String, String>,
    pub fbt_enum_manifest: IndexMap<String, IndexMap<String, String>>,
}

pub struct CollectedFileOutput {
    pub child_parent_mappings: Vec<(usize, usize)>,
    pub phrases: Vec<serde_json::Value>,
}

pub fn collect_program<'a>(
    allocator: &'a Allocator,
    program: &mut Program<'a>,
    scoping: Scoping,
    mut options: FbteeOptions,
    filename: &str,
) -> Result<CollectedFileOutput, String> {
    options.collect_fbt = true;
    let default_call_options = parse_fbt_docblock(program.source_text)?;
    let mut collector = BindingCollector::new(&options);
    collector.visit_program(program);
    let mut tx = FbteeTransform::new(
        allocator,
        program.source_text,
        program.source_type,
        scoping,
        options.clone(),
        default_call_options,
        collector,
    );
    tx.visit_program(program);
    if let Some(error) = &tx.error {
        return Err(format!("fbtee Oxc collector error: {error}"));
    }
    Ok(build_collected_file_output(
        filename,
        tx.source_locator(),
        &tx.collected_phrases,
        &tx.options.collect_packager,
    ))
}

pub fn transform_program<'a>(
    allocator: &'a Allocator,
    program: &mut Program<'a>,
    scoping: Scoping,
    options: FbteeOptions,
) -> Diagnostics {
    let default_call_options = match parse_fbt_docblock(program.source_text) {
        Ok(options) => options,
        Err(error) => {
            return OxcDiagnostic::error(format!("fbtee Oxc transform error: {error}")).into();
        }
    };
    let mut collector = BindingCollector::new(&options);
    collector.visit_program(program);
    let mut tx = FbteeTransform::new(
        allocator,
        program.source_text,
        program.source_type,
        scoping,
        options.clone(),
        default_call_options,
        collector,
    );
    tx.visit_program(program);
    if let Some(error) = tx.error {
        return OxcDiagnostic::error(format!("fbtee Oxc transform error: {error}")).into();
    }
    let required_imports = [(tx.needs_fbt_binding, "fbt"), (tx.needs_fbs_binding, "fbs")]
        .into_iter()
        .filter_map(|(used, name)| (used && !tx.top_level_fbtee.contains(name)).then_some(name))
        .collect::<Vec<_>>();
    let promoted_imports = promote_type_only_fbtee_imports(allocator, program, &required_imports);
    let imports = required_imports
        .into_iter()
        .filter(|name| !promoted_imports.contains(*name))
        .collect::<Vec<_>>();
    if !imports.is_empty() {
        let generated = if program.source_type.is_module() {
            format!("import {{ {} }} from 'fbtee';", imports.join(", "))
        } else {
            format!("const {{ {} }} = require('fbtee');", imports.join(", "))
        };
        let text = allocator.alloc_str(&generated);
        let parsed = Parser::new(allocator, text, program.source_type).parse();
        if parsed.diagnostics.has_errors() {
            return parsed.diagnostics;
        }
        let mut statement = parsed.program.body.into_iter().next().unwrap();
        GeneratedSpanAnchor { anchor: 0 }.visit_statement(&mut statement);
        program.body.insert(0, statement);
    }
    Diagnostics::default()
}

fn promote_type_only_fbtee_imports<'a>(
    allocator: &'a Allocator,
    program: &mut Program<'a>,
    required: &[&str],
) -> BTreeSet<String> {
    let mut promoted = BTreeSet::new();
    let mut statement_index = 0;
    while statement_index < program.body.len() {
        let Statement::ImportDeclaration(import) = &mut program.body[statement_index] else {
            statement_index += 1;
            continue;
        };
        let declaration_is_type = import.import_kind == ImportOrExportKind::Type;
        let source_is_fbtee = import.source.value == "fbtee";
        let Some(specifiers) = &mut import.specifiers else {
            statement_index += 1;
            continue;
        };

        if source_is_fbtee {
            let mut declaration_promoted = false;
            for specifier in specifiers.iter_mut() {
                let name = import_specifier_local_name(specifier);
                let specifier_is_type = declaration_is_type
                    || matches!(
                        specifier,
                        ImportDeclarationSpecifier::ImportSpecifier(specifier)
                            if specifier.import_kind == ImportOrExportKind::Type
                    );
                if specifier_is_type && required.contains(&name.as_str()) {
                    // A default or namespace type import cannot be promoted in place: the
                    // generated runtime calls require the named fbtee export. Normalize every
                    // matching type-only shape to `import { fbt/fbs } from 'fbtee'`.
                    *specifier = runtime_import_specifier(allocator, &name);
                    promoted.insert(name);
                    declaration_promoted = true;
                } else if declaration_is_type {
                    if let ImportDeclarationSpecifier::ImportSpecifier(specifier) = specifier {
                        specifier.import_kind = ImportOrExportKind::Type;
                    }
                }
            }
            if declaration_promoted {
                import.import_kind = ImportOrExportKind::Value;
            }
        } else {
            // Type-only facade imports cannot provide the runtime binding. Remove the
            // conflicting local name before the canonical named fbtee import is inserted.
            specifiers.retain(|specifier| {
                let name = import_specifier_local_name(specifier);
                let specifier_is_type = declaration_is_type
                    || matches!(
                        specifier,
                        ImportDeclarationSpecifier::ImportSpecifier(specifier)
                            if specifier.import_kind == ImportOrExportKind::Type
                    );
                !(specifier_is_type && required.contains(&name.as_str()))
            });
            if specifiers.is_empty() {
                program.body.remove(statement_index);
                continue;
            }
        }
        statement_index += 1;
    }
    promoted
}

fn runtime_import_specifier<'a>(
    allocator: &'a Allocator,
    name: &str,
) -> ImportDeclarationSpecifier<'a> {
    let generated = allocator.alloc_str(&format!("import {{ {name} }} from 'fbtee';"));
    let mut parsed = Parser::new(allocator, generated, SourceType::mjs()).parse();
    let Statement::ImportDeclaration(import) = parsed.program.body.remove(0) else {
        unreachable!("generated runtime import must be an import declaration")
    };
    import
        .unbox()
        .specifiers
        .expect("generated runtime import must have specifiers")
        .remove(0)
}

fn import_specifier_local_name(specifier: &ImportDeclarationSpecifier<'_>) -> String {
    match specifier {
        ImportDeclarationSpecifier::ImportSpecifier(specifier) => specifier.local.name.to_string(),
        ImportDeclarationSpecifier::ImportDefaultSpecifier(specifier) => {
            specifier.local.name.to_string()
        }
        ImportDeclarationSpecifier::ImportNamespaceSpecifier(specifier) => {
            specifier.local.name.to_string()
        }
    }
}

struct GeneratedSpanAnchor {
    anchor: u32,
}

#[derive(Clone, Copy)]
struct OriginalSpanRegion {
    generated_start: u32,
    generated_end: u32,
    original: Span,
}

struct GeneratedSpanMapper<'s> {
    generated: &'s str,
    generated_offset: u32,
    original: &'s str,
    original_span: Span,
    source_text: &'s str,
    regions: Vec<OriginalSpanRegion>,
}

fn generated_span_regions(generated: &str) -> Vec<OriginalSpanRegion> {
    const PREFIX: &str = "/*__FBTEE_ORIGINAL:";
    const HEADER_END: &str = "__*/";
    let mut regions = vec![];
    let mut cursor = 0;
    while let Some(relative_start) = generated[cursor..].find(PREFIX) {
        let marker_start = cursor + relative_start;
        let payload_start = marker_start + PREFIX.len();
        let Some(relative_header_end) = generated[payload_start..].find(HEADER_END) else {
            break;
        };
        let header_end = payload_start + relative_header_end;
        let values = generated[payload_start..header_end]
            .split(':')
            .collect::<Vec<_>>();
        let [marker, original_start, original_end] = values.as_slice() else {
            cursor = header_end + HEADER_END.len();
            continue;
        };
        let Ok(original_start) = original_start.parse::<u32>() else {
            cursor = header_end + HEADER_END.len();
            continue;
        };
        let Ok(original_end) = original_end.parse::<u32>() else {
            cursor = header_end + HEADER_END.len();
            continue;
        };
        let content_start = header_end + HEADER_END.len();
        let end_marker = format!("/*__FBTEE_END:{marker}__*/");
        let Some(relative_content_end) = generated[content_start..].find(&end_marker) else {
            cursor = content_start;
            continue;
        };
        regions.push(OriginalSpanRegion {
            generated_start: content_start as u32,
            generated_end: (content_start + relative_content_end) as u32,
            original: Span::new(original_start, original_end),
        });
        // Continue at the content start so nested markers are discovered too.
        cursor = content_start;
    }
    regions
}

fn strip_generated_span_markers(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let mut remaining = value;
    while let Some(start) = remaining.find("/*__FBTEE_") {
        output.push_str(&remaining[..start]);
        let Some(end) = remaining[start..].find("*/") else {
            remaining = "";
            break;
        };
        remaining = &remaining[start + end + 2..];
    }
    output.push_str(remaining);
    output
}

impl VisitMut<'_> for GeneratedSpanMapper<'_> {
    fn visit_span(&mut self, span: &mut Span) {
        let fallback = Span::new(self.original_span.start, self.original_span.start + 1);
        let Some(start) = span.start.checked_sub(self.generated_offset) else {
            *span = fallback;
            return;
        };
        let Some(end) = span.end.checked_sub(self.generated_offset) else {
            *span = fallback;
            return;
        };
        let Some(snippet) = self.generated.get(start as usize..end as usize) else {
            *span = fallback;
            return;
        };
        if let Some(region) = self
            .regions
            .iter()
            .filter(|region| start >= region.generated_start && end <= region.generated_end)
            .min_by_key(|region| region.generated_end - region.generated_start)
        {
            if start == region.generated_start && end == region.generated_end {
                *span = region.original;
                return;
            }
            let original =
                &self.source_text[region.original.start as usize..region.original.end as usize];
            let generated_prefix = &self.generated[region.generated_start as usize..start as usize];
            let ordinal = strip_generated_span_markers(generated_prefix)
                .match_indices(snippet)
                .count();
            if let Some((offset, _)) = original.match_indices(snippet).nth(ordinal) {
                *span = Span::new(
                    region.original.start + offset as u32,
                    region.original.start + offset as u32 + snippet.len() as u32,
                );
                return;
            }
        }
        if snippet.is_empty() || matches!(snippet, "fbt" | "fbs") {
            *span = fallback;
            return;
        }
        let ordinal = self
            .generated
            .get(..start as usize)
            .map_or(0, |prefix| prefix.match_indices(snippet).count());
        let Some((offset, _)) = self.original.match_indices(snippet).nth(ordinal) else {
            *span = fallback;
            return;
        };
        *span = Span::new(
            self.original_span.start + offset as u32,
            self.original_span.start + offset as u32 + snippet.len() as u32,
        );
    }
}

impl<'a> VisitMut<'a> for GeneratedSpanAnchor {
    fn visit_span(&mut self, span: &mut Span) {
        *span = Span::new(self.anchor, self.anchor + 1);
    }
}

struct BindingCollector<'o> {
    options: &'o FbteeOptions,
    fbtee_symbols: BTreeSet<SymbolId>,
    fbtee_runtime_symbols: BTreeSet<SymbolId>,
    top_level_fbtee: BTreeSet<String>,
    imported_enums: BTreeMap<SymbolId, IndexMap<String, String>>,
    depth: usize,
}
impl<'o> BindingCollector<'o> {
    fn new(options: &'o FbteeOptions) -> Self {
        Self {
            options,
            fbtee_symbols: BTreeSet::new(),
            fbtee_runtime_symbols: BTreeSet::new(),
            top_level_fbtee: BTreeSet::new(),
            imported_enums: BTreeMap::new(),
            depth: 0,
        }
    }
    fn register(
        &mut self,
        ident: &BindingIdentifier<'_>,
        source: &str,
        runtime: bool,
        enum_import: bool,
        named_fbtee_import: bool,
    ) {
        if (is_fbtee_module_source(source) || named_fbtee_import)
            && matches!(ident.name.as_str(), "fbt" | "fbs")
        {
            if let Some(id) = ident.symbol_id.get() {
                self.fbtee_symbols.insert(id);
                if runtime {
                    self.fbtee_runtime_symbols.insert(id);
                }
                if runtime && self.depth <= 1 {
                    self.top_level_fbtee.insert(ident.name.to_string());
                }
            }
        }
        if runtime && enum_import {
            if let Some(key) = enum_manifest_key(source) {
                if let (Some(id), Some(values)) = (
                    ident.symbol_id.get(),
                    self.options.fbt_enum_manifest.get(&key),
                ) {
                    self.imported_enums.insert(id, values.clone());
                }
            }
        }
    }
}
impl<'a> Visit<'a> for BindingCollector<'_> {
    fn enter_scope(&mut self, _: ScopeFlags, _: &std::cell::Cell<Option<ScopeId>>) {
        self.depth += 1;
    }
    fn leave_scope(&mut self) {
        self.depth -= 1;
    }
    fn visit_import_declaration(&mut self, import: &ImportDeclaration<'a>) {
        if let Some(specifiers) = &import.specifiers {
            for specifier in specifiers {
                let (local, specifier_is_type, enum_import, named_fbtee_import) = match specifier {
                    ImportDeclarationSpecifier::ImportSpecifier(x) => (
                        &x.local,
                        x.import_kind == ImportOrExportKind::Type,
                        false,
                        true,
                    ),
                    ImportDeclarationSpecifier::ImportDefaultSpecifier(x) => {
                        (&x.local, false, true, true)
                    }
                    ImportDeclarationSpecifier::ImportNamespaceSpecifier(x) => {
                        (&x.local, false, true, true)
                    }
                };
                let runtime = import.import_kind == ImportOrExportKind::Value && !specifier_is_type;
                self.register(
                    local,
                    import.source.value.as_str(),
                    runtime,
                    enum_import,
                    named_fbtee_import,
                );
            }
        }
        walk::walk_import_declaration(self, import);
    }
    fn visit_variable_declarator(&mut self, declarator: &VariableDeclarator<'a>) {
        if let Some(source) = require_source(declarator.init.as_ref()) {
            match &declarator.id {
                BindingPattern::BindingIdentifier(ident) => {
                    self.register(ident, &source, true, true, false)
                }
                BindingPattern::ObjectPattern(pattern) if is_fbtee_module_source(&source) => {
                    for property in &pattern.properties {
                        if matches!(
                            property_key_string(&property.key).as_deref(),
                            Some("fbt" | "fbs")
                        ) {
                            for ident in property.value.get_binding_identifiers() {
                                self.register(ident, &source, true, false, false);
                            }
                        }
                    }
                }
                _ => {}
            }
        }
        walk::walk_variable_declarator(self, declarator);
    }
}

struct FbteeTransform<'a> {
    allocator: &'a Allocator,
    source_text: &'a str,
    source_locator: OnceLock<SourceLocator>,
    source_type: SourceType,
    scoping: Scoping,
    options: FbteeOptions,
    default_call_options: CallOptions,
    fbtee_symbols: BTreeSet<SymbolId>,
    fbtee_runtime_symbols: BTreeSet<SymbolId>,
    top_level_fbtee: BTreeSet<String>,
    imported_enums: BTreeMap<SymbolId, IndexMap<String, String>>,
    scopes: Vec<Option<ScopeId>>,
    needs_fbt_binding: bool,
    needs_fbs_binding: bool,
    collected_phrases: Vec<Phrase>,
    replacement_captures: Vec<Vec<(Span, String)>>,
    next_span_marker: u32,
    error: Option<String>,
}
impl<'a> FbteeTransform<'a> {
    fn new(
        allocator: &'a Allocator,
        source_text: &'a str,
        source_type: SourceType,
        scoping: Scoping,
        options: FbteeOptions,
        default_call_options: CallOptions,
        collector: BindingCollector<'_>,
    ) -> Self {
        Self {
            allocator,
            source_text,
            source_locator: OnceLock::new(),
            source_type,
            scoping,
            options,
            default_call_options,
            fbtee_symbols: collector.fbtee_symbols,
            fbtee_runtime_symbols: collector.fbtee_runtime_symbols,
            top_level_fbtee: collector.top_level_fbtee,
            imported_enums: collector.imported_enums,
            scopes: vec![],
            needs_fbt_binding: false,
            needs_fbs_binding: false,
            collected_phrases: vec![],
            replacement_captures: vec![],
            next_span_marker: 0,
            error: None,
        }
    }
    fn fail<T>(&mut self, message: impl Into<String>) -> Option<T> {
        if self.error.is_none() {
            self.error = Some(message.into());
        }
        None
    }
    fn source_locator(&self) -> &SourceLocator {
        self.source_locator
            .get_or_init(|| SourceLocator::new(self.source_text))
    }
    fn code(expr: &Expression<'_>) -> String {
        let mut output = Codegen::new();
        output.print_expression(expr);
        output.into_source_text()
    }
    fn variation_key(expr: &Expression<'_>) -> String {
        Self::code(unwrap_transparent_expression(expr))
    }
    fn transformed_code(&mut self, expr: &Expression<'a>) -> String {
        let marker = self.next_span_marker;
        self.next_span_marker += 1;
        let original_span = expr.span();
        let mut expr = expr.clone_in_with_semantic_ids(self.allocator);
        self.replacement_captures.push(vec![]);
        self.visit_expression(&mut expr);
        let replacements = self
            .replacement_captures
            .pop()
            .expect("replacement capture must be active");
        let code = self.source_with_replacements(expr.span(), replacements);
        format!(
            "/*__FBTEE_ORIGINAL:{marker}:{}:{}__*/{code}/*__FBTEE_END:{marker}__*/",
            original_span.start, original_span.end
        )
    }
    fn source_with_replacements(
        &self,
        span: Span,
        mut replacements: Vec<(Span, String)>,
    ) -> String {
        let mut code = self.source_text[span.start as usize..span.end as usize].to_string();
        replacements.sort_unstable_by_key(|(replacement, _)| std::cmp::Reverse(replacement.start));
        for (replacement, value) in replacements {
            code.replace_range(
                (replacement.start - span.start) as usize..(replacement.end - span.start) as usize,
                &value,
            );
        }
        code
    }
    fn parse_generated(&mut self, code: String, original_span: Span) -> Option<Expression<'a>> {
        let text = self.allocator.alloc_str(&code);
        let direct = Parser::new(self.allocator, text, self.source_type).parse_expression();
        let (mut expression, generated_offset) = if let Ok(expression) = direct {
            (expression, 0)
        } else {
            const PREFIX: &str = "async function*(){return (";
            let wrapped = self.allocator.alloc_str(&format!("{PREFIX}{code});}}"));
            let mut wrapper = Parser::new(self.allocator, wrapped, self.source_type)
                .parse_expression()
                .ok()
                .or_else(|| self.fail("internal generated expression was invalid"))?;
            let Expression::FunctionExpression(function) = &mut wrapper else {
                return self.fail("internal generated expression wrapper was invalid");
            };
            let body = function
                .body
                .as_mut()
                .or_else(|| self.fail("internal generated expression wrapper had no body"))?;
            let Some(Statement::ReturnStatement(statement)) = body.statements.last_mut() else {
                return self.fail("internal generated expression wrapper had no return value");
            };
            let expression = statement
                .argument
                .take()
                .or_else(|| self.fail("internal generated expression wrapper had no value"))?;
            (expression, PREFIX.len() as u32)
        };
        let original = &self.source_text[original_span.start as usize..original_span.end as usize];
        GeneratedSpanMapper {
            generated: &code,
            generated_offset,
            original,
            original_span,
            source_text: self.source_text,
            regions: generated_span_regions(&code),
        }
        .visit_expression(&mut expression);
        Some(expression)
    }
    fn ident_symbol(&self, ident: &IdentifierReference<'_>) -> Option<SymbolId> {
        ident
            .reference_id
            .get()
            .and_then(|id| self.scoping.get_reference(id).symbol_id())
    }
    fn ident_is_fbtee(&self, ident: &IdentifierReference<'_>) -> bool {
        self.ident_symbol(ident)
            .is_none_or(|id| self.fbtee_symbols.contains(&id) || !self.symbol_is_value(id))
    }
    fn symbol_is_value(&self, symbol: SymbolId) -> bool {
        let flags = self.scoping.symbol_flags(symbol);
        flags.intersects(SymbolFlags::Value)
            || (flags.contains(SymbolFlags::Import) && !flags.contains(SymbolFlags::TypeImport))
    }
    fn require_runtime_binding(&mut self, module: ModuleName, ident: &IdentifierReference<'_>) {
        if self
            .ident_symbol(ident)
            .is_none_or(|id| !self.fbtee_runtime_symbols.contains(&id))
        {
            match module {
                ModuleName::Fbt => self.needs_fbt_binding = true,
                ModuleName::Fbs => self.needs_fbs_binding = true,
            }
        }
    }
    fn transform_expression(&mut self, expr: &Expression<'a>) -> Option<String> {
        match expr {
            Expression::CallExpression(call) => self.transform_call(call),
            Expression::JSXElement(element) => self.transform_jsx_element(element),
            _ => None,
        }
    }
    fn transform_call(&mut self, call: &CallExpression<'a>) -> Option<String> {
        let (module, ident) = call_module_name(call)?;
        if !self.ident_is_fbtee(ident) {
            return None;
        }
        match call_member_method(call) {
            Some("c") => {
                self.require_runtime_binding(module, ident);
                self.transform_common_call(call, module)
            }
            Some(method) if is_construct_method(method) => self.fail("fbtee constructs such as fbt.param(...) must be inside an fbt(...) or <fbt> string."),
            Some(_) => None,
            None => {
                self.require_runtime_binding(module, ident);
                self.transform_fbt_call(call, module)
            }
        }
    }
    fn transform_common_call(
        &mut self,
        call: &CallExpression<'a>,
        module: ModuleName,
    ) -> Option<String> {
        if call.arguments.len() != 1 {
            return self.fail(format!(
                "{}.c(...) needs exactly one text argument.",
                module.name()
            ));
        }
        let label = argument_string(&call.arguments[0]).or_else(|| {
            self.fail(format!(
                "{}.c(...) needs exactly one text argument.",
                module.name()
            ))
        })?;
        let label = normalize_spaces(&label, false).trim().to_string();
        let desc = self
            .options
            .fbt_common
            .get(&label)
            .cloned()
            .or_else(|| self.fail(unknown_common_string_message(&label)))?;
        let desc = normalize_spaces(&desc, false).trim().to_string();
        self.runtime_call(Phrase {
            desc,
            module,
            options: CallOptions {
                common: true,
                ..self.default_call_options.clone()
            },
            parts: vec![Part::Text(label)],
            span: call.span,
        })
    }
    fn transform_fbt_call(
        &mut self,
        call: &CallExpression<'a>,
        module: ModuleName,
    ) -> Option<String> {
        if call.arguments.len() < 2 {
            return self.fail(format!(
                "{}(...) needs at least two arguments: text and description.",
                module.name()
            ));
        }
        let contents = argument_expr(&call.arguments[0])
            .or_else(|| self.fail("fbtee text cannot be a spread argument"))?;
        let desc = argument_string(&call.arguments[1]).or_else(|| {
            self.fail(format!(
                "{}(...) description must be a string literal.",
                module.name()
            ))
        })?;
        let options = match call.arguments.get(2) {
            Some(argument) => {
                let Some(expression) = argument_expr(argument) else {
                    return self.fail("fbtee options cannot be a spread argument");
                };
                match parse_call_options(
                    expression,
                    &self.default_call_options,
                    &self.options.extra_options,
                    self.source_text,
                    self.source_locator(),
                ) {
                    Ok(options) => options,
                    Err(error) => return self.fail(error),
                }
            }
            None => self.default_call_options.clone(),
        };
        let parts = match self.parse_contents(contents, module, &options) {
            Ok(parts) => parts,
            Err(error) => return self.fail(error),
        };
        self.runtime_call(Phrase {
            desc: normalize_spaces(&desc, options.preserve_whitespace)
                .trim()
                .to_string(),
            module,
            options,
            parts,
            span: call.span,
        })
    }
    fn parse_contents(
        &mut self,
        expr: &Expression<'a>,
        module: ModuleName,
        options: &CallOptions,
    ) -> Result<Vec<Part>, String> {
        self.parse_contents_at(expr, module, options, 0)
    }
    fn parse_contents_at(
        &mut self,
        expr: &Expression<'a>,
        module: ModuleName,
        options: &CallOptions,
        implicit_index: usize,
    ) -> Result<Vec<Part>, String> {
        match expr {
            Expression::StringLiteral(x) => Ok(vec![Part::Text(normalize_spaces(
                x.value.as_str(),
                options.preserve_whitespace,
            ))]),
            Expression::ArrayExpression(x) => {
                let mut out = vec![];
                for item in &x.elements {
                    match item {
                        ArrayExpressionElement::SpreadElement(_) => {
                            return Err(format!(
                                "{} text contains unsupported array spread syntax.",
                                module.name()
                            ));
                        }
                        ArrayExpressionElement::Elision(_) => {
                            return Err(format!(
                                "{} text contains an unsupported array hole.",
                                module.name()
                            ));
                        }
                        item => {
                            let expression =
                                item.as_expression().expect("expression array element");
                            if !is_valid_fbt_array_item(expression) {
                                return Err(format!(
                                    "{}(array) items must be string literals, template literals without placeholders, or {} constructs.",
                                    module.name(),
                                    module.name()
                                ));
                            }
                            out.extend(self.parse_contents_at(
                                expression,
                                module,
                                options,
                                implicit_index + out.len(),
                            )?);
                        }
                    }
                }
                Ok(out)
            }
            Expression::BinaryExpression(x) if x.operator == BinaryOperator::Addition => {
                let mut out = self.parse_contents_at(&x.left, module, options, implicit_index)?;
                out.extend(self.parse_contents_at(
                    &x.right,
                    module,
                    options,
                    implicit_index + out.len(),
                )?);
                Ok(out)
            }
            Expression::TemplateLiteral(x) => {
                let mut out = vec![];
                for (i, q) in x.quasis.iter().enumerate() {
                    let text = q
                        .value
                        .cooked
                        .as_ref()
                        .map_or(q.value.raw.as_str(), |x| x.as_str());
                    if !text.is_empty() {
                        out.push(Part::Text(normalize_spaces(
                            text,
                            options.preserve_whitespace,
                        )));
                    }
                    if let Some(e) = x.expressions.get(i) {
                        out.extend(self.parse_contents_at(
                            e,
                            module,
                            options,
                            implicit_index + out.len(),
                        )?);
                    }
                }
                Ok(out)
            }
            Expression::CallExpression(call) => self.parse_construct(call, module),
            Expression::ParenthesizedExpression(x) => {
                self.parse_contents_at(&x.expression, module, options, implicit_index)
            }
            Expression::TSAsExpression(x) => {
                self.parse_contents_at(&x.expression, module, options, implicit_index)
            }
            Expression::TSSatisfiesExpression(x) => {
                self.parse_contents_at(&x.expression, module, options, implicit_index)
            }
            Expression::TSTypeAssertion(x) => {
                self.parse_contents_at(&x.expression, module, options, implicit_index)
            }
            Expression::TSNonNullExpression(x) => {
                self.parse_contents_at(&x.expression, module, options, implicit_index)
            }
            Expression::TSInstantiationExpression(x) => {
                self.parse_contents_at(&x.expression, module, options, implicit_index)
            }
            Expression::JSXElement(element) => {
                self.implicit_element_part(element, module, options, implicit_index)
            }
            Expression::JSXFragment(fragment) => {
                self.implicit_fragment_part(fragment, module, options, implicit_index)
            }
            _ => Err(format!(
                "{} text contains unsupported syntax '{}'. Use text, JSX, or {} constructs.",
                module.name(),
                expression_type(expr),
                module.name()
            )),
        }
    }
    fn parse_construct(
        &mut self,
        call: &CallExpression<'a>,
        module: ModuleName,
    ) -> Result<Vec<Part>, String> {
        let Some(method) = call_member_method(call) else {
            return Err(format!("{} text contains an unsupported function call. Wrap dynamic values in {}.param(...).", module.name(), module.name()));
        };
        if call_module_name(call).map(|x| x.0) != Some(module) {
            return Err(format!(
                "Do not mix fbt and fbs constructs. Found a different construct inside '{}'.",
                module.name()
            ));
        }
        let arg = |i| call.arguments.get(i).and_then(argument_expr);
        let construct_options = |allowed: &[&str]| -> Result<ObjectOptions<'_, 'a>, String> {
            match call.arguments.get(2) {
                Some(argument) => parse_object_options(
                    argument_expr(argument)
                        .ok_or("fbtee construct options cannot be a spread argument")?,
                    allowed,
                ),
                None => Ok(ObjectOptions::default()),
            }
        };
        match method {
            "param" => {
                let value = arg(1).ok_or_else(|| {
                    format!(
                        "{}.param(...) needs a value as the second argument.",
                        module.name()
                    )
                })?;
                let opts = construct_options(PARAM_OPTIONS)?;
                let name = opts
                    .string("name")
                    .filter(|name| !name.is_empty())
                    .map_or_else(
                        || {
                            call.arguments
                                .first()
                                .and_then(argument_string)
                                .ok_or_else(|| {
                                    format!(
                                        "{}.param(...) token name must be a string literal.",
                                        module.name()
                                    )
                                })
                        },
                        Ok,
                    )?;
                validate_param_name(&name, module)?;
                let number = opts.number_expression()?;
                let gender = opts.expression("gender");
                if number.is_some() && gender.is_some() {
                    return Err(format!(
                        "{}.param(...) cannot use both 'gender' and 'number' options.",
                        module.name()
                    ));
                }
                let (variation, variation_key, variation_constraint) = if let Some(number) = number
                {
                    (
                        ParamVariation::Number(number.map(|x| self.transformed_code(x))),
                        Some(Self::variation_key(number.unwrap_or(value))),
                        number.and_then(|number| variation_constraint("number", number)),
                    )
                } else if let Some(gender) = gender {
                    (
                        ParamVariation::Gender(self.transformed_code(gender)),
                        Some(Self::variation_key(gender)),
                        variation_constraint("gender", gender),
                    )
                } else {
                    (ParamVariation::None, None, None)
                };
                Ok(vec![Part::Param {
                    name,
                    hash_name: None,
                    nested: None,
                    nested_parts: vec![],
                    value: self.transformed_code(value),
                    variation,
                    variation_key,
                    variation_constraint,
                    runtime_kind: ParamRuntimeKind::Param,
                }])
            }
            "sameParam" => Ok(vec![Part::SameParam {
                name: call
                    .arguments
                    .first()
                    .and_then(argument_string)
                    .ok_or_else(|| {
                        format!("{}.sameParam(...) needs a token name.", module.name())
                    })?,
            }]),
            "name" => {
                let gender = arg(2).ok_or_else(|| {
                    format!(
                        "{}.name(...) needs a gender as the third argument.",
                        module.name()
                    )
                })?;
                Ok(vec![Part::Name {
                    name: call
                        .arguments
                        .first()
                        .and_then(argument_string)
                        .ok_or_else(|| {
                            format!(
                                "{}.name(...) token name must be a string literal.",
                                module.name()
                            )
                        })?,
                    value: self.transformed_code(arg(1).ok_or_else(|| {
                        format!(
                            "{}.name(...) needs a value as the second argument.",
                            module.name()
                        )
                    })?),
                    gender: self.transformed_code(gender),
                    gender_key: Self::variation_key(gender),
                    variation_constraint: variation_constraint("gender", gender),
                }])
            }
            "enum" => {
                let value = arg(0).ok_or_else(|| {
                    format!(
                        "{}.enum(...) needs a value as the first argument.",
                        module.name()
                    )
                })?;
                let range_expr = arg(1).ok_or_else(|| {
                    format!(
                        "{}.enum(...) needs a range as the second argument.",
                        module.name()
                    )
                })?;
                Ok(vec![Part::Enum {
                    value: self.transformed_code(value),
                    value_key: Self::variation_key(value),
                    range_code: Self::code(range_expr),
                    range: self.enum_range(range_expr)?,
                    array: matches!(range_expr, Expression::ArrayExpression(_)),
                    variation_constraint: variation_constraint("value", value),
                }])
            }
            "plural" => {
                let singular = call
                    .arguments
                    .first()
                    .and_then(argument_string)
                    .ok_or_else(|| {
                        format!(
                            "{}.plural(...) singular text must be a string literal.",
                            module.name()
                        )
                    })?;
                let count = arg(1).ok_or_else(|| {
                    format!(
                        "{}.plural(...) needs a count as the second argument.",
                        module.name()
                    )
                })?;
                let opts = construct_options(PLURAL_OPTIONS)?;
                let many = if !opts.contains("many") {
                    format!("{singular}s")
                } else if let Some(many) = opts.string("many") {
                    many
                } else if let Some(many) = opts.expression("many") {
                    expression_string(many)
                        .ok_or("`many` option must be a statically evaluable string.")?
                } else {
                    return Err("`many` option must be a string.".into());
                };
                let show_count = if opts.contains("showCount") {
                    opts.string("showCount")
                        .ok_or("Option 'showCount' must be a string literal.")?
                } else {
                    "no".into()
                };
                validate_option_value("showCount", &show_count, &["ifMany", "no", "yes"])?;
                let name = opts
                    .string("name")
                    .filter(|name| !name.is_empty())
                    .or_else(|| {
                        matches!(show_count.as_str(), "yes" | "ifMany").then(|| "number".into())
                    });
                Ok(vec![Part::Plural {
                    singular,
                    count: self.transformed_code(count),
                    count_key: Self::variation_key(count),
                    many,
                    show_count,
                    name,
                    value: opts.expression("value").map(|x| self.transformed_code(x)),
                    variation_constraint: variation_constraint("count", count),
                }])
            }
            "pronoun" => {
                let usage = call
                    .arguments
                    .first()
                    .and_then(argument_string)
                    .ok_or_else(|| {
                        format!(
                            "{}.pronoun(...) usage must be a string literal.",
                            module.name()
                        )
                    })?;
                let gender = arg(1).ok_or_else(|| {
                    format!(
                        "{}.pronoun(...) needs a gender as the second argument.",
                        module.name()
                    )
                })?;
                validate_pronoun_usage(&usage, module)?;
                let opts = construct_options(PRONOUN_OPTIONS)?;
                Ok(vec![Part::Pronoun {
                    usage,
                    gender: self.transformed_code(gender),
                    gender_key: Self::variation_key(gender),
                    human: opts.boolean_option("human")?.unwrap_or(false),
                    capitalize: opts.boolean_option("capitalize")?.unwrap_or(false),
                    variation_constraint: variation_constraint("gender", gender),
                }])
            }
            "list" => {
                let name = call
                    .arguments
                    .first()
                    .and_then(argument_string)
                    .ok_or_else(|| {
                        format!(
                            "{}.list(...) token name must be a string literal.",
                            module.name()
                        )
                    })?;
                let items = arg(1).ok_or_else(|| {
                    format!(
                        "{}.list(...) needs items as the second argument.",
                        module.name()
                    )
                })?;
                let conjunction = arg(2)
                    .filter(|expression| !matches!(expression, Expression::NullLiteral(_)))
                    .map(|expression| self.transformed_code(expression));
                let delimiter = arg(3)
                    .filter(|expression| !matches!(expression, Expression::NullLiteral(_)))
                    .map(|expression| self.transformed_code(expression));
                Ok(vec![Part::List {
                    name,
                    items: self.transformed_code(items),
                    conjunction,
                    delimiter,
                }])
            }
            _ => Err(format!(
                "Unsupported fbtee construct '{}.{method}'.",
                module.name()
            )),
        }
    }
    fn enum_range(&self, expr: &Expression<'a>) -> Result<Vec<(String, String)>, String> {
        let range = match expr {
            Expression::ArrayExpression(x) => {
                let mut entries = IndexMap::new();
                for element in &x.elements {
                    let value = match element {
                    ArrayExpressionElement::SpreadElement(_) => {
                        return Err("Enum arrays cannot use spread elements.".into());
                    }
                    ArrayExpressionElement::Elision(_) => {
                        return Err("Enum arrays cannot contain holes.".into());
                    }
                    element => {
                        element
                            .as_expression()
                            .and_then(string_literal_value)
                            .ok_or("Enum array values must be string literals.")?
                    }
                    };
                    entries.insert(value.clone(), value);
                }
                entries.into_iter().collect()
            }
            Expression::ObjectExpression(x) => {
                let mut entries = IndexMap::new();
                for property in &x.properties {
                    let ObjectPropertyKind::ObjectProperty(property) = property else {
                            return Err("Enum entries cannot use spread properties.".into());
                    };
                    let key = property_key_string(&property.key)
                        .ok_or("Enum object keys must be strings, numbers, or identifiers.")?;
                    let value = string_literal_value(&property.value)
                        .ok_or("Enum object values must be string literals.")?;
                    // JavaScript object literals retain the first insertion position while
                    // assigning the last value for a duplicate property.
                    entries.insert(key, value);
                }
                let mut entries = entries.into_iter().collect::<Vec<_>>();
                entries.sort_by_key(|(key, _)| {
                    js_array_index(key).map_or((1, 0), |index| (0, index))
                });
                entries
            }
            Expression::Identifier(x) => x.reference_id.get().and_then(|id| self.scoping.get_reference(id).symbol_id()).and_then(|id| self.imported_enums.get(&id)).map(|x| x.iter().map(|(a,b)| (a.clone(),b.clone())).collect()).ok_or_else(|| format!("Enum '{}' is not registered. Import an '$FbtEnum' module or add it to the enum manifest.", x.name))?,
            _ => return Err(format!("Enum range must be an array, object, or imported enum variable. Received '{}'.", expression_type(expr))),
        };
        if range.is_empty() {
            Err("Enum range cannot be empty.".into())
        } else {
            Ok(range)
        }
    }
    fn transform_jsx_element(&mut self, element: &JSXElement<'a>) -> Option<String> {
        let (module, construct) = jsx_element_kind(&element.opening_element.name)?;
        let is_fbtee = match &element.opening_element.name {
            JSXElementName::IdentifierReference(ident) => self.ident_is_fbtee(ident),
            _ => self.jsx_binding_is_fbtee(module),
        };
        if !is_fbtee {
            return None;
        }
        if construct.is_some() {
            return self.fail(
                "fbtee constructs such as fbt.param(...) must be inside an fbt(...) or <fbt> string.",
            );
        }
        if let JSXElementName::IdentifierReference(ident) = &element.opening_element.name {
            self.require_runtime_binding(module, ident);
        } else if !self.top_level_fbtee.contains(module.name()) {
            match module {
                ModuleName::Fbt => self.needs_fbt_binding = true,
                ModuleName::Fbs => self.needs_fbs_binding = true,
            }
        }
        if jsx_children_contain_spread(&element.children) {
            return self.fail(format!(
                "<{}> text cannot contain JSX spread children.",
                module.name()
            ));
        }
        let attrs = JsxAttrs::new(&element.opening_element.attributes);
        let mut allowed_attributes = vec![
            "desc",
            "author",
            "common",
            "doNotExtract",
            "preserveWhitespace",
            "project",
            "subject",
        ];
        allowed_attributes.extend(self.options.extra_options.iter().map(String::as_str));
        if let Err(error) = attrs.validate(&allowed_attributes) {
            return self.fail(error);
        }
        for option in &self.options.extra_options {
            if attrs.attr(option).is_some() {
                match attrs.required_string(option) {
                    Ok(Some(_)) => {}
                    Ok(None) => unreachable!("attribute presence was checked"),
                    Err(_) => {
                        return self.fail(format!("Extra option '{option}' must be a string."));
                    }
                }
            }
        }
        let is_common = match attrs.boolean_option("common") {
            Ok(value) => value.unwrap_or(false),
            Err(error) => return self.fail(error),
        };
        let do_not_extract = match attrs.boolean_option("doNotExtract") {
            Ok(value) => value.unwrap_or(self.default_call_options.do_not_extract),
            Err(error) => return self.fail(error),
        };
        if is_common && attrs.attr("desc").is_some() {
            return self.fail(format!(
                "<{} common> cannot also have a 'desc' attribute. Remove one of them.",
                module.name()
            ));
        }
        let preserve_whitespace = match attrs.boolean_option("preserveWhitespace") {
            Ok(value) => value.unwrap_or(self.default_call_options.preserve_whitespace),
            Err(error) => return self.fail(error),
        };
        let author = match attrs.required_string("author") {
            Ok(author) => author.or_else(|| self.default_call_options.author.clone()),
            Err(error) => return self.fail(error),
        };
        let project = match attrs.required_string("project") {
            Ok(project) => project
                .filter(|project| !project.is_empty())
                .or_else(|| self.default_call_options.project.clone()),
            Err(error) => return self.fail(error),
        };
        let mut options = CallOptions {
            author,
            common: is_common,
            do_not_extract,
            preserve_whitespace,
            project,
            subject: self.default_call_options.subject.clone(),
            subject_constraint: self.default_call_options.subject_constraint.clone(),
            subject_json: self.default_call_options.subject_json.clone(),
        };
        if let Some(subject) = attrs.expression("subject") {
            options.subject = Some(self.transformed_code(subject));
            options.subject_constraint = variation_constraint("subject", subject);
            options.subject_json =
                babel_subject_json(subject, self.source_text, self.source_locator());
        }
        let desc = if is_common {
            let text = normalize_spaces(
                &jsx_text_content(&element.children),
                options.preserve_whitespace,
            )
            .trim()
            .to_string();
            self.options
                .fbt_common
                .get(&text)
                .cloned()
                .or_else(|| self.fail(unknown_common_string_message(&text)))?
        } else {
            attrs
                .string("desc")
                .map(|x| {
                    normalize_spaces(&x, options.preserve_whitespace)
                        .trim()
                        .to_string()
                })
                .or_else(|| {
                    self.fail(format!(
                        "<{}> needs one of these attributes: desc, common.",
                        module.name()
                    ))
                })?
        };
        let parts = match self.parse_jsx_children(&element.children, module, &options, false) {
            Ok(x) => x,
            Err(e) => return self.fail(e),
        };
        self.runtime_call(Phrase {
            desc,
            module,
            options,
            parts,
            span: element.span,
        })
    }
    fn jsx_binding_is_fbtee(&self, module: ModuleName) -> bool {
        self.scopes
            .last()
            .copied()
            .flatten()
            .and_then(|scope| self.scoping.find_binding(scope, module.name().into()))
            .is_none_or(|id| self.fbtee_symbols.contains(&id) || !self.symbol_is_value(id))
    }

    // JSX parsing is implemented below; it produces the same phrase IR used by call expressions.
    fn parse_jsx_children(
        &mut self,
        children: &[JSXChild<'a>],
        module: ModuleName,
        options: &CallOptions,
        implicit_context: bool,
    ) -> Result<Vec<Part>, String> {
        let mut parts = vec![];
        let mut implicit_child_index = 0;
        let mut last_implicit_child_was_text = false;
        let mut pending_implicit_whitespace = false;
        for (child_index, child) in children.iter().enumerate() {
            match child {
                JSXChild::Text(text) => {
                    let decoded = decode_jsx_entities(text.value.as_str());
                    if implicit_context {
                        let whitespace_only = is_collapsible_whitespace_only(&decoded);
                        if whitespace_only
                            && child_index > 0
                            && child_index + 1 < children.len()
                            && !last_implicit_child_was_text
                        {
                            pending_implicit_whitespace = true;
                        } else {
                            if !whitespace_only && pending_implicit_whitespace {
                                implicit_child_index += 1;
                            }
                            implicit_child_index += 1;
                            last_implicit_child_was_text = true;
                            pending_implicit_whitespace = false;
                        }
                    }
                    let text = if options.preserve_whitespace {
                        if implicit_context {
                            decoded
                        } else {
                            clean_jsx_text(&decoded)
                        }
                    } else {
                        normalize_spaces(&decoded, false)
                    };
                    if !is_collapsible_whitespace_only(&text) {
                        parts.push(Part::Text(text));
                    }
                }
                JSXChild::ExpressionContainer(container) => if let Some(expr) = container.expression.as_expression() {
                    let parsed = self.parse_contents(expr, module, options)?;
                    if implicit_context {
                        implicit_child_index += parsed.len();
                        last_implicit_child_was_text = false;
                        pending_implicit_whitespace = false;
                    }
                    parts.extend(parsed);
                },
                JSXChild::Element(element) => match jsx_element_kind(&element.opening_element.name) {
                    Some((child_module, Some(kind))) => {
                        if child_module != module { return Err(format!("Do not mix fbt and fbs JSX namespaces. Found a different construct inside '<{}>'.", module.name())); }
                        let parsed = self.parse_jsx_construct(element, module, &kind, options)?;
                        if implicit_context {
                            implicit_child_index += parsed.len();
                            last_implicit_child_was_text = false;
                            pending_implicit_whitespace = false;
                        }
                        parts.extend(parsed);
                    }
                    Some((child_module, None)) => return Err(format!("Do not put <{}> directly inside <{}>. Remove the inner tag or wrap it in a normal JSX element.", child_module.name(), module.name())),
                    None => {
                        let name = implicit_param_alias(if implicit_context {
                            implicit_child_index
                        } else {
                            parts.len()
                        });
                        let (value, nested, nested_parts) = self.implicit_element_code(element, module, options)?;
                        parts.push(Part::Param { name, hash_name: Some(implicit_child_hash_name(child, options)), nested, nested_parts, value, variation: ParamVariation::None, variation_key: None, variation_constraint: None, runtime_kind: ParamRuntimeKind::Implicit });
                        if implicit_context {
                            implicit_child_index += 1;
                            last_implicit_child_was_text = false;
                            pending_implicit_whitespace = false;
                        }
                    }
                },
                JSXChild::Fragment(fragment) => {
                    let name = implicit_param_alias(if implicit_context {
                        implicit_child_index
                    } else {
                        parts.len()
                    });
                    let (value, nested, nested_parts) = self.implicit_fragment_code(fragment, module, options)?;
                    parts.push(Part::Param { name, hash_name: Some(implicit_child_hash_name(child, options)), nested, nested_parts, value, variation: ParamVariation::None, variation_key: None, variation_constraint: None, runtime_kind: ParamRuntimeKind::Implicit });
                    if implicit_context {
                        implicit_child_index += 1;
                        last_implicit_child_was_text = false;
                        pending_implicit_whitespace = false;
                    }
                }
                JSXChild::Spread(_) => {
                    return Err(format!(
                        "<{}> text cannot contain JSX spread children.",
                        module.name()
                    ));
                }
            }
        }
        Ok(compact_text_parts(parts))
    }
    fn implicit_element_part(
        &mut self,
        element: &JSXElement<'a>,
        module: ModuleName,
        options: &CallOptions,
        implicit_index: usize,
    ) -> Result<Vec<Part>, String> {
        if let Some((child, None)) = jsx_element_kind(&element.opening_element.name) {
            return Err(format!("Do not put <{}> directly inside <{}>. Remove the inner tag or wrap it in a normal JSX element.", child.name(), module.name()));
        }
        let (value, nested, nested_parts) = self.implicit_element_code(element, module, options)?;
        Ok(vec![Part::Param {
            name: implicit_param_alias(implicit_index),
            hash_name: Some(format!(
                "={}",
                jsx_implicit_token_text(&element.children, options)
                    .replace('{', "[")
                    .replace('}', "]")
            )),
            nested,
            nested_parts,
            value,
            variation: ParamVariation::None,
            variation_key: None,
            variation_constraint: None,
            runtime_kind: ParamRuntimeKind::Implicit,
        }])
    }
    fn implicit_fragment_part(
        &mut self,
        fragment: &JSXFragment<'a>,
        module: ModuleName,
        options: &CallOptions,
        implicit_index: usize,
    ) -> Result<Vec<Part>, String> {
        let (value, nested, nested_parts) =
            self.implicit_fragment_code(fragment, module, options)?;
        Ok(vec![Part::Param {
            name: implicit_param_alias(implicit_index),
            hash_name: Some(format!(
                "={}",
                jsx_implicit_token_text(&fragment.children, options)
                    .replace('{', "[")
                    .replace('}', "]")
            )),
            nested,
            nested_parts,
            value,
            variation: ParamVariation::None,
            variation_key: None,
            variation_constraint: None,
            runtime_kind: ParamRuntimeKind::Implicit,
        }])
    }
    fn transformed_element_code(&mut self, element: &JSXElement<'a>) -> String {
        let mut expression = Expression::JSXElement(ArenaBox::new_in(
            element.clone_in_with_semantic_ids(self.allocator),
            &self.allocator,
        ));
        self.replacement_captures.push(vec![]);
        self.visit_expression(&mut expression);
        let replacements = self
            .replacement_captures
            .pop()
            .expect("replacement capture must be active");
        self.source_with_replacements(element.span, replacements)
    }
    fn transformed_fragment_code(&mut self, fragment: &JSXFragment<'a>) -> String {
        let mut expression = Expression::JSXFragment(ArenaBox::new_in(
            fragment.clone_in_with_semantic_ids(self.allocator),
            &self.allocator,
        ));
        self.replacement_captures.push(vec![]);
        self.visit_expression(&mut expression);
        let replacements = self
            .replacement_captures
            .pop()
            .expect("replacement capture must be active");
        self.source_with_replacements(fragment.span, replacements)
    }
    fn transformed_opening_code(&mut self, element: &JSXElement<'a>) -> String {
        let opening = &element.opening_element;
        let mut code =
            self.source_text[opening.span.start as usize..opening.span.end as usize].to_string();
        let mut replacements = vec![];
        for attribute in &opening.attributes {
            match attribute {
                JSXAttributeItem::SpreadAttribute(spread) => replacements.push((
                    spread.argument.span(),
                    self.transformed_code(&spread.argument),
                )),
                JSXAttributeItem::Attribute(attribute) => {
                    match attribute.value.as_ref() {
                        Some(JSXAttributeValue::ExpressionContainer(container)) => {
                            if let Some(expression) = container.expression.as_expression() {
                                replacements
                                    .push((expression.span(), self.transformed_code(expression)));
                            }
                        }
                        Some(JSXAttributeValue::Element(element)) => replacements
                            .push((element.span, self.transformed_element_code(element))),
                        Some(JSXAttributeValue::Fragment(fragment)) => replacements
                            .push((fragment.span, self.transformed_fragment_code(fragment))),
                        Some(JSXAttributeValue::StringLiteral(_)) | None => {}
                    }
                }
            }
        }
        replacements.sort_unstable_by_key(|(span, _)| std::cmp::Reverse(span.start));
        for (span, replacement) in replacements {
            code.replace_range(
                (span.start - opening.span.start) as usize
                    ..(span.end - opening.span.start) as usize,
                &replacement,
            );
        }
        code
    }
    fn implicit_element_code(
        &mut self,
        element: &JSXElement<'a>,
        module: ModuleName,
        options: &CallOptions,
    ) -> Result<(String, Option<NestedPhrase>, Vec<Part>), String> {
        let parts = self.parse_jsx_children(&element.children, module, options, true)?;
        if parts.is_empty() {
            return Ok((self.transformed_element_code(element), None, vec![]));
        }
        let nested_parts = parts.clone();
        let open_end = element.opening_element.span.end as usize;
        let close_start = element
            .closing_element
            .as_ref()
            .map_or(open_end, |x| x.span.start as usize);
        Ok((
            String::new(),
            Some(NestedPhrase {
                prefix: format!("{}{{", self.transformed_opening_code(element)),
                span: element.span,
                suffix: format!(
                    "}}{}",
                    &self.source_text[close_start..element.span.end as usize]
                ),
                target_id: element.span.start,
            }),
            nested_parts,
        ))
    }
    fn implicit_fragment_code(
        &mut self,
        fragment: &JSXFragment<'a>,
        module: ModuleName,
        options: &CallOptions,
    ) -> Result<(String, Option<NestedPhrase>, Vec<Part>), String> {
        let parts = self.parse_jsx_children(&fragment.children, module, options, true)?;
        if parts.is_empty() {
            return Ok((self.transformed_fragment_code(fragment), None, vec![]));
        }
        let nested_parts = parts.clone();
        Ok((
            String::new(),
            Some(NestedPhrase {
                prefix: "<>{".into(),
                span: fragment.span,
                suffix: "}</>".into(),
                target_id: fragment.span.start,
            }),
            nested_parts,
        ))
    }
    fn jsx_param_value(
        &mut self,
        children: &[JSXChild<'a>],
        module: ModuleName,
    ) -> Result<String, String> {
        if let [JSXChild::Text(text)] = children {
            if text.value == " " {
                return Ok(quote(" "));
            }
        }
        let meaningful = children
            .iter()
            .filter(|child| match child {
                JSXChild::ExpressionContainer(x) => x.expression.as_expression().is_some(),
                JSXChild::Element(_) | JSXChild::Fragment(_) => true,
                _ => false,
            })
            .collect::<Vec<_>>();
        if meaningful.len() != 1 {
            return Err(format!(
                "<{}:param> needs exactly one child: an expression or JSX element.",
                module.name()
            ));
        }
        match meaningful[0] {
            JSXChild::ExpressionContainer(x) => Ok(self.transformed_code(
                x.expression
                    .as_expression()
                    .expect("meaningful JSX expression container"),
            )),
            JSXChild::Element(x) => Ok(self.transformed_element_code(x)),
            JSXChild::Fragment(x) => Ok(self.transformed_fragment_code(x)),
            _ => unreachable!("validated JSX param child"),
        }
    }
    fn jsx_name_value(
        &mut self,
        children: &[JSXChild<'a>],
        module: ModuleName,
    ) -> Result<String, String> {
        let meaningful = children
            .iter()
            .filter(|child| match child {
                JSXChild::Text(text) => !text.value.chars().all(char::is_whitespace),
                JSXChild::ExpressionContainer(x) => x.expression.as_expression().is_some(),
                _ => false,
            })
            .collect::<Vec<_>>();
        if meaningful.len() != 1 {
            return Err(format!(
                "<{}:name> needs exactly one child: text or an expression.",
                module.name()
            ));
        }
        match meaningful[0] {
            JSXChild::Text(text) => Ok(quote(&normalize_spaces(text.value.as_str(), false))),
            JSXChild::ExpressionContainer(x) => Ok(self.transformed_code(
                x.expression
                    .as_expression()
                    .expect("meaningful JSX expression container"),
            )),
            _ => unreachable!("validated JSX name child"),
        }
    }
    fn parse_jsx_construct(
        &mut self,
        element: &JSXElement<'a>,
        module: ModuleName,
        kind: &str,
        options: &CallOptions,
    ) -> Result<Vec<Part>, String> {
        let attrs = JsxAttrs::new(&element.opening_element.attributes);
        match kind {
            "param" => {
                attrs.validate(PARAM_OPTIONS)?;
                let name =
                    normalize_jsx_param_name(&attrs.string("name").ok_or_else(|| {
                        format!("<{}:param> needs attribute 'name'.", module.name())
                    })?);
                validate_param_name(&name, module)?;
                let number = attrs.number_expression("number")?;
                let gender = attrs.expression("gender");
                if number.is_some() && gender.is_some() {
                    return Err(format!(
                        "<{}:param> cannot use both 'gender' and 'number' attributes.",
                        module.name()
                    ));
                }
                let value = self.jsx_param_value(&element.children, module)?;
                let (variation, variation_key, variation_constraint) = if let Some(number) = number
                {
                    (
                        ParamVariation::Number(number.map(|x| self.transformed_code(x))),
                        Some(number.map_or_else(|| value.clone(), Self::variation_key)),
                        number.and_then(|number| variation_constraint("number", number)),
                    )
                } else if let Some(gender) = gender {
                    (
                        ParamVariation::Gender(self.transformed_code(gender)),
                        Some(Self::variation_key(gender)),
                        variation_constraint("gender", gender),
                    )
                } else {
                    (ParamVariation::None, None, None)
                };
                Ok(vec![Part::Param {
                    name,
                    hash_name: None,
                    nested: None,
                    nested_parts: vec![],
                    value,
                    variation,
                    variation_key,
                    variation_constraint,
                    runtime_kind: ParamRuntimeKind::Param,
                }])
            }
            "same-param" | "sameParam" => {
                require_self_closing(element, module, "same-param")?;
                attrs.validate(&["name"])?;
                Ok(vec![Part::SameParam {
                    name: {
                        attrs.string("name").ok_or_else(|| {
                            format!("<{}:same-param> needs attribute 'name'.", module.name())
                        })?
                    },
                }])
            }
            "name" => {
                attrs.validate(&["name", "gender"])?;
                let gender = attrs
                    .expression("gender")
                    .ok_or_else(|| format!("<{}:name> needs attribute 'gender'.", module.name()))?;
                Ok(vec![Part::Name {
                    name: attrs.string("name").ok_or_else(|| {
                        format!("<{}:name> needs attribute 'name'.", module.name())
                    })?,
                    value: self.jsx_name_value(&element.children, module)?,
                    gender: self.transformed_code(gender),
                    gender_key: Self::variation_key(gender),
                    variation_constraint: variation_constraint("gender", gender),
                }])
            }
            "enum" => {
                require_self_closing(element, module, "enum")?;
                attrs.validate(&["value", "enum-range"])?;
                let (value, value_key, variation_constraint) =
                    if let Some(value) = attrs.expression("value") {
                        (
                            self.transformed_code(value),
                            Self::variation_key(value),
                            variation_constraint("value", value),
                        )
                    } else if let Some(value) = attrs.string("value") {
                        let value = quote(&value);
                        (value.clone(), value, None)
                    } else {
                        return Err(format!("<{}:enum> needs attribute 'value'.", module.name()));
                    };
                let range_expr = attrs.expression("enum-range").ok_or_else(|| {
                    format!("<{}:enum> needs attribute 'enum-range'.", module.name())
                })?;
                Ok(vec![Part::Enum {
                    value,
                    value_key,
                    range_code: Self::code(range_expr),
                    range: self.enum_range(range_expr)?,
                    array: matches!(range_expr, Expression::ArrayExpression(_)),
                    variation_constraint,
                }])
            }
            "plural" => {
                attrs.validate(PLURAL_OPTIONS)?;
                let singular = normalize_spaces(
                    &jsx_plural_text(&element.children, module)?,
                    options.preserve_whitespace,
                )
                .trim_end()
                .to_string();
                let count = attrs.expression("count").ok_or_else(|| {
                    format!("<{}:plural> needs attribute 'count'.", module.name())
                })?;
                let many = if attrs.attr("many").is_none() {
                    format!("{singular}s")
                } else {
                    attrs
                        .string("many")
                        .ok_or("`many` option must be a statically evaluable string.")?
                };
                let show_count = if attrs.attr("showCount").is_some() {
                    attrs
                        .string("showCount")
                        .ok_or("Option 'showCount' must be a string literal.")?
                } else {
                    "no".into()
                };
                validate_option_value("showCount", &show_count, &["ifMany", "no", "yes"])?;
                let name = attrs
                    .string("name")
                    .filter(|name| !name.is_empty())
                    .map(|name| normalize_jsx_param_name(&name))
                    .or_else(|| {
                        matches!(show_count.as_str(), "yes" | "ifMany").then(|| "number".into())
                    });
                Ok(vec![Part::Plural {
                    singular,
                    count: self.transformed_code(count),
                    count_key: Self::variation_key(count),
                    many,
                    show_count,
                    name,
                    value: attrs.expression("value").map(|x| self.transformed_code(x)),
                    variation_constraint: variation_constraint("count", count),
                }])
            }
            "pronoun" => {
                require_self_closing(element, module, "pronoun")?;
                attrs.validate(&["type", "gender", "capitalize", "human"])?;
                let usage = attrs.string("type").ok_or_else(|| {
                    format!("<{}:pronoun> needs attribute 'type'.", module.name())
                })?;
                validate_pronoun_usage(&usage, module)?;
                let gender = attrs.expression("gender").ok_or_else(|| {
                    format!("<{}:pronoun> needs attribute 'gender'.", module.name())
                })?;
                Ok(vec![Part::Pronoun {
                    usage,
                    gender: self.transformed_code(gender),
                    gender_key: Self::variation_key(gender),
                    human: attrs.boolean_option("human")?.unwrap_or(false),
                    capitalize: attrs.boolean_option("capitalize")?.unwrap_or(false),
                    variation_constraint: variation_constraint("gender", gender),
                }])
            }
            "list" => {
                require_self_closing(element, module, "list")?;
                attrs.validate(&["name", "items", "conjunction", "delimiter"])?;
                let name = attrs
                    .string("name")
                    .ok_or_else(|| format!("<{}:list> needs attribute 'name'.", module.name()))?;
                let items = attrs
                    .expression("items")
                    .ok_or_else(|| format!("<{}:list> needs attribute 'items'.", module.name()))?;
                let mut runtime_option = |key| -> Result<Option<String>, String> {
                    let Some(attribute) = attrs.attr(key) else {
                        return Ok(None);
                    };
                    match attribute.value.as_ref() {
                        Some(JSXAttributeValue::StringLiteral(value)) => {
                            Ok(Some(quote(&decode_jsx_entities(value.value.as_str()))))
                        }
                        Some(JSXAttributeValue::ExpressionContainer(container)) => {
                            let expression =
                                container.expression.as_expression().ok_or_else(|| {
                                    format!(
                                        "<{}:list> attribute '{key}' needs a value.",
                                        module.name()
                                    )
                                })?;
                            if matches!(expression, Expression::NullLiteral(_)) {
                                Ok(None)
                            } else {
                                Ok(Some(self.transformed_code(expression)))
                            }
                        }
                        _ => Err(format!(
                            "<{}:list> attribute '{key}' must be text or an expression.",
                            module.name()
                        )),
                    }
                };
                let conjunction = runtime_option("conjunction")?;
                let delimiter = runtime_option("delimiter")?;
                Ok(vec![Part::List {
                    name,
                    items: self.transformed_code(items),
                    conjunction,
                    delimiter,
                }])
            }
            _ => Err(format!(
                "Unsupported JSX {} construct '{}'.",
                module.name(),
                kind
            )),
        }
    }

    fn runtime_call(&mut self, phrase: Phrase) -> Option<String> {
        if let Err(error) = validate_phrase(&phrase) {
            return self.fail(error);
        }
        if self.options.collect_fbt && !phrase.options.do_not_extract {
            self.collected_phrases.push(phrase.clone());
        }
        let mut variations = vec![];
        collect_variation_parts(&phrase.parts, &mut variations);
        let mut shared_values = vec![];
        if let Some(subject) = &phrase.options.subject {
            shared_values.push(helper(
                phrase.module,
                "_subject",
                std::slice::from_ref(subject),
            ));
        }
        shared_values.extend(
            variations
                .iter()
                .filter_map(|part| runtime_arg(phrase.module, part)),
        );
        let needs_temporaries = !shared_values.is_empty() && contains_nested_phrase(&phrase.parts);
        let shared_args = if needs_temporaries {
            let mut prefix = "__fbtee_sv_arg".to_string();
            while self.source_text.contains(&prefix) {
                prefix.push('_');
            }
            (0..shared_values.len())
                .map(|index| format!("{prefix}_{index}"))
                .collect::<Vec<_>>()
        } else {
            shared_values.clone()
        };
        let runtime = render_runtime_call(&phrase, &variations, &shared_args, &phrase.parts, None);
        if needs_temporaries {
            Some(format!(
                "(({})=>{runtime})({})",
                shared_args.join(","),
                shared_values.join(",")
            ))
        } else {
            Some(runtime)
        }
    }
}

impl<'a> VisitMut<'a> for FbteeTransform<'a> {
    fn enter_scope(&mut self, _: ScopeFlags, id: &std::cell::Cell<Option<ScopeId>>) {
        self.scopes.push(id.get());
    }
    fn leave_scope(&mut self) {
        self.scopes.pop();
    }
    fn visit_expression(&mut self, expr: &mut Expression<'a>) {
        if self.error.is_some() {
            return;
        }
        let pure = matches!(expr, Expression::CallExpression(call) if call.pure);
        if let Some(code) = self.transform_expression(expr) {
            if let Some(capture) = self.replacement_captures.last_mut() {
                capture.push((expr.span(), code));
            } else if let Some(mut next) = self.parse_generated(code, expr.span()) {
                if pure {
                    mark_expression_pure(&mut next);
                }
                *expr = next;
            }
            return;
        }
        walk_mut::walk_expression(self, expr);
    }
    fn visit_jsx_child(&mut self, child: &mut JSXChild<'a>) {
        if let JSXChild::Element(element) = child {
            let original_start = element.span.start;
            if let Some(code) = self.transform_jsx_element(element) {
                if let Some(capture) = self.replacement_captures.last_mut() {
                    capture.push((element.span, format!("{{{code}}}")));
                    return;
                }
                let wrapped = self.allocator.alloc_str(&format!("<>{{{code}}}</>"));
                if let Ok(Expression::JSXFragment(mut fragment)) =
                    Parser::new(self.allocator, wrapped, self.source_type).parse_expression()
                {
                    let mut transformed = fragment.children.remove(0);
                    GeneratedSpanAnchor {
                        anchor: original_start,
                    }
                    .visit_jsx_child(&mut transformed);
                    *child = transformed;
                }
                return;
            }
        }
        walk_mut::walk_jsx_child(self, child);
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ModuleName {
    Fbt,
    Fbs,
}
impl ModuleName {
    fn name(self) -> &'static str {
        match self {
            Self::Fbt => "fbt",
            Self::Fbs => "fbs",
        }
    }
}
#[derive(Clone)]
struct Phrase {
    desc: String,
    module: ModuleName,
    options: CallOptions,
    parts: Vec<Part>,
    span: Span,
}
#[derive(Clone, Default)]
struct CallOptions {
    author: Option<String>,
    common: bool,
    do_not_extract: bool,
    preserve_whitespace: bool,
    project: Option<String>,
    subject: Option<String>,
    subject_constraint: Option<VariationConstraint>,
    subject_json: Option<serde_json::Value>,
}

#[derive(Clone)]
struct VariationConstraint {
    direct: bool,
    name: &'static str,
}

fn parse_fbt_docblock(source_text: &str) -> Result<CallOptions, String> {
    let mut source_text = source_text.trim_start_matches('\u{feff}').trim_start();
    if source_text.starts_with("#!") {
        source_text = source_text
            .split_once(['\n', '\r'])
            .map_or("", |(_, source)| source)
            .trim_start();
    }
    let comment = if let Some(comment) = source_text.strip_prefix("//") {
        comment.lines().next().unwrap_or_default()
    } else if let Some(comment) = source_text.strip_prefix("/*") {
        comment
            .split_once("*/")
            .map_or(comment, |(comment, _)| comment)
    } else {
        return Ok(CallOptions::default());
    };
    let Some(json) = comment.lines().find_map(|line| {
        let line = line.trim_start();
        let line = line.strip_prefix('*').unwrap_or(line).trim_start();
        let rest = line.strip_prefix("@fbt")?;
        if rest
            .chars()
            .next()
            .is_some_and(|character| !character.is_whitespace() && character != '{')
        {
            return None;
        }
        Some(rest.trim())
    }) else {
        return Ok(CallOptions::default());
    };
    if json.is_empty() {
        return Err("@fbt docblock is missing its JSON options.".into());
    }
    let value = serde_json::from_str::<serde_json::Value>(json)
        .map_err(|error| format!("Invalid @fbt docblock JSON: {error}"))?;
    let object = value
        .as_object()
        .ok_or("@fbt docblock options must be a JSON object.")?;
    for key in object.keys() {
        if !FBT_OPTIONS.contains(&key.as_str()) {
            return Err(format!(
                "Unknown @fbt docblock option '{key}'. Use one of: {}.",
                FBT_OPTIONS.join(", ")
            ));
        }
    }
    for key in ["author", "project"] {
        if object.get(key).is_some_and(|value| !value.is_string()) {
            return Err(format!("@fbt docblock option '{key}' must be a string."));
        }
    }
    for key in ["common", "doNotExtract", "preserveWhitespace"] {
        if object.get(key).is_some_and(|value| !value.is_boolean()) {
            return Err(format!("@fbt docblock option '{key}' must be a boolean."));
        }
    }
    let author = object
        .get("author")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);
    let project = object
        .get("project")
        .map(|value| {
            value
                .as_str()
                .map(str::to_string)
                .ok_or("@fbt docblock option 'project' must be a string.")
        })
        .transpose()?;
    Ok(CallOptions {
        // Babel's callsite options initialize these fields before docblock
        // defaults are merged, so today only `project` is inherited.
        author,
        common: object
            .get("common")
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(false),
        do_not_extract: object
            .get("doNotExtract")
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(false),
        preserve_whitespace: false,
        project,
        subject: None,
        subject_constraint: None,
        subject_json: None,
    })
}
#[derive(Clone)]
struct NestedPhrase {
    prefix: String,
    span: Span,
    suffix: String,
    target_id: u32,
}
#[derive(Clone)]
enum Part {
    Text(String),
    Param {
        name: String,
        hash_name: Option<String>,
        nested: Option<NestedPhrase>,
        nested_parts: Vec<Part>,
        value: String,
        variation: ParamVariation,
        variation_key: Option<String>,
        variation_constraint: Option<VariationConstraint>,
        runtime_kind: ParamRuntimeKind,
    },
    SameParam {
        name: String,
    },
    Name {
        name: String,
        value: String,
        gender: String,
        gender_key: String,
        variation_constraint: Option<VariationConstraint>,
    },
    Enum {
        value: String,
        value_key: String,
        range_code: String,
        range: Vec<(String, String)>,
        array: bool,
        variation_constraint: Option<VariationConstraint>,
    },
    Plural {
        singular: String,
        count: String,
        count_key: String,
        many: String,
        show_count: String,
        name: Option<String>,
        value: Option<String>,
        variation_constraint: Option<VariationConstraint>,
    },
    Pronoun {
        usage: String,
        gender: String,
        gender_key: String,
        human: bool,
        capitalize: bool,
        variation_constraint: Option<VariationConstraint>,
    },
    List {
        name: String,
        items: String,
        conjunction: Option<String>,
        delimiter: Option<String>,
    },
}
#[derive(Clone)]
enum ParamVariation {
    None,
    Number(Option<String>),
    Gender(String),
}
#[derive(Clone, Copy)]
enum ParamRuntimeKind {
    Param,
    Implicit,
}
#[derive(Clone)]
struct Variation {
    index: usize,
    keys: Vec<String>,
    group: Option<String>,
}

fn validate_phrase(phrase: &Phrase) -> Result<(), String> {
    if contains_nested_phrase(&phrase.parts) {
        if let Some(constraint) = &phrase.options.subject_constraint {
            return Err(variation_constraint_error(constraint));
        }
        validate_nested_variation_constraints(&phrase.parts)?;
    }
    validate_local_tokens(&phrase.parts, phrase.module)?;
    let mut variations = vec![];
    collect_variation_parts(&phrase.parts, &mut variations);
    RuntimeBuilder::new(phrase, &variations, &phrase.parts, None).validate_dynamic_tokens()?;
    validate_enum_variations(&phrase.parts, &mut BTreeMap::new())?;
    let mut explicit_tokens = BTreeSet::new();
    let mut same_param_targets = BTreeSet::new();
    let mut same_params = vec![];
    collect_overall_tokens(
        &phrase.parts,
        phrase.module,
        &mut explicit_tokens,
        &mut same_param_targets,
        &mut same_params,
    )?;
    for name in same_params {
        if !same_param_targets.contains(name) {
            return Err(format!(
                "{}.sameParam('{name}') does not match a token in this string. Add a {}.param or {}.name with name '{name}', or remove the sameParam.",
                phrase.module.name(),
                phrase.module.name(),
                phrase.module.name()
            ));
        }
    }
    Ok(())
}

fn variation_constraint_error(constraint: &VariationConstraint) -> String {
    let relation = if constraint.direct {
        "cannot be"
    } else {
        "cannot contain"
    };
    format!(
        "Argument '{}' {relation} a function call or class instantiation. Store the value in a variable before using it in fbtee.",
        constraint.name
    )
}

fn validate_nested_variation_constraints(parts: &[Part]) -> Result<(), String> {
    for part in parts {
        let constraint = match part {
            Part::Param {
                variation_constraint,
                ..
            }
            | Part::Name {
                variation_constraint,
                ..
            }
            | Part::Enum {
                variation_constraint,
                ..
            }
            | Part::Plural {
                variation_constraint,
                ..
            }
            | Part::Pronoun {
                variation_constraint,
                ..
            } => variation_constraint.as_ref(),
            _ => None,
        };
        if let Some(constraint) = constraint {
            return Err(variation_constraint_error(constraint));
        }
        if let Part::Param {
            nested_parts,
            runtime_kind: ParamRuntimeKind::Implicit,
            ..
        } = part
        {
            validate_nested_variation_constraints(nested_parts)?;
        }
    }
    Ok(())
}

fn validate_enum_variations(
    parts: &[Part],
    used_enums: &mut BTreeMap<String, BTreeSet<String>>,
) -> Result<(), String> {
    for part in parts {
        if let Part::Enum { range, .. } = part {
            let group = variation_group(part).expect("enum must have a variation group");
            let keys = range
                .iter()
                .map(|(key, _)| key.clone())
                .collect::<BTreeSet<_>>();
            if let Some(first_keys) = used_enums.get(&group) {
                if let Some(key) = first_keys.iter().find(|key| !keys.contains(*key)) {
                    return Err(format!(
                        "Enum key '{key}' is missing from a reused enum range. Attempting to re-use incompatible enums."
                    ));
                }
            } else {
                used_enums.insert(group, keys);
            }
        }
        if let Part::Param {
            nested_parts,
            runtime_kind: ParamRuntimeKind::Implicit,
            ..
        } = part
        {
            validate_enum_variations(nested_parts, used_enums)?;
        }
    }
    Ok(())
}

fn validate_local_tokens(parts: &[Part], module: ModuleName) -> Result<(), String> {
    let mut local_explicit_tokens = BTreeSet::new();
    let mut implicit_tokens = BTreeSet::new();
    for part in parts {
        let token = match part {
            Part::Param {
                name,
                hash_name,
                nested_parts,
                runtime_kind: ParamRuntimeKind::Implicit,
                ..
            } => {
                let token = hash_name.as_ref().unwrap_or(name);
                if !implicit_tokens.insert(token.clone()) {
                    return Err(format!(
                        "Implicit token '{token}' is already used in this {} call. Change the text inside one of the JSX elements so each implicit token is unique.",
                        module.name()
                    ));
                }
                validate_local_tokens(nested_parts, module)?;
                None
            }
            Part::Param {
                name,
                runtime_kind: ParamRuntimeKind::Param,
                ..
            }
            | Part::Name { name, .. }
            | Part::List { name, .. } => Some(name),
            Part::Plural {
                name: Some(name),
                show_count,
                ..
            } if show_count != "no" => Some(name),
            _ => None,
        };
        if let Some(token) = token {
            local_explicit_tokens.insert(token.clone());
        }
    }
    if let Some(token) = local_explicit_tokens
        .iter()
        .find(|token| implicit_tokens.contains(*token))
    {
        return Err(format!(
            "Token '{token}' is already used in this {} call. Use {}.sameParam('{token}') to reuse it, or choose a different name.",
            module.name(),
            module.name()
        ));
    }
    Ok(())
}

fn collect_overall_tokens<'a>(
    parts: &'a [Part],
    module: ModuleName,
    explicit_tokens: &mut BTreeSet<String>,
    same_param_targets: &mut BTreeSet<String>,
    same_params: &mut Vec<&'a String>,
) -> Result<(), String> {
    for part in parts {
        let (token, reusable) = match part {
            Part::Param {
                nested_parts,
                runtime_kind: ParamRuntimeKind::Implicit,
                ..
            } => {
                collect_overall_tokens(
                    nested_parts,
                    module,
                    explicit_tokens,
                    same_param_targets,
                    same_params,
                )?;
                (None, false)
            }
            Part::Param {
                name,
                runtime_kind: ParamRuntimeKind::Param,
                ..
            }
            | Part::Name { name, .. }
            | Part::List { name, .. } => (Some(name), true),
            Part::Plural {
                name: Some(name),
                show_count,
                ..
            } if show_count != "no" => (Some(name), false),
            Part::SameParam { name } => {
                same_params.push(name);
                (None, false)
            }
            _ => (None, false),
        };
        if let Some(token) = token {
            if !explicit_tokens.insert(token.clone()) {
                return Err(format!(
                    "Token '{token}' is already used in this {} call. Use {}.sameParam('{token}') to reuse it, or choose a different name.",
                    module.name(),
                    module.name()
                ));
            }
            if reusable {
                same_param_targets.insert(token.clone());
            }
        }
    }
    Ok(())
}
#[derive(Clone)]
enum RuntimeNode {
    String(String),
    Object(Vec<(String, RuntimeNode)>),
}
impl std::fmt::Display for RuntimeNode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::String(x) => f.write_str(&quote(x)),
            Self::Object(x) => {
                f.write_str("{")?;
                for (i, (k, v)) in x.iter().enumerate() {
                    if i > 0 {
                        f.write_str(",")?;
                    }
                    write!(f, "{}:{v}", property_code(k))?;
                }
                f.write_str("}")
            }
        }
    }
}
#[derive(Clone)]
enum HashNode {
    Leaf(HashLeaf),
    Object(Vec<(String, HashNode)>),
}
#[derive(Clone)]
struct HashLeaf {
    desc: String,
    text: String,
    token_aliases: Option<IndexMap<String, String>>,
}

struct RuntimeBuilder<'a, 'v> {
    phrase: &'a Phrase,
    global_variations: &'v [&'v Part],
    root_parts: &'v [Part],
    description_target: Option<u32>,
}
impl<'a, 'v> RuntimeBuilder<'a, 'v> {
    fn new(
        phrase: &'a Phrase,
        global_variations: &'v [&'v Part],
        root_parts: &'v [Part],
        description_target: Option<u32>,
    ) -> Self {
        Self {
            phrase,
            global_variations,
            root_parts,
            description_target,
        }
    }
    fn table(&self) -> RuntimeNode {
        let variations = self.variations();
        if variations.is_empty() {
            RuntimeNode::String(self.pattern(&[], false))
        } else {
            self.branch(&variations, 0, &mut vec![])
        }
    }
    fn hash_tree(&self) -> HashNode {
        let variations = self.variations();
        if variations.is_empty() {
            self.hash_leaf(&[])
        } else {
            self.hash_branch(&variations, 0, &mut vec![])
        }
    }
    fn validate_dynamic_tokens(&self) -> Result<(), String> {
        let variations = self.variations();
        self.validate_dynamic_tokens_branch(&variations, 0, &mut vec![])
    }
    fn validate_dynamic_tokens_branch(
        &self,
        variations: &[Variation],
        depth: usize,
        selected: &mut Vec<(usize, String)>,
    ) -> Result<(), String> {
        if depth == variations.len() {
            let selected = selected.iter().cloned().collect::<BTreeMap<_, _>>();
            return self.validate_dynamic_token_parts(&self.phrase.parts, &selected);
        }
        let variation = &variations[depth];
        for key in Self::keys(variations, depth, selected) {
            selected.push((variation.index, key));
            self.validate_dynamic_tokens_branch(variations, depth + 1, selected)?;
            selected.pop();
        }
        Ok(())
    }
    fn validate_dynamic_token_parts(
        &self,
        parts: &[Part],
        selected: &BTreeMap<usize, String>,
    ) -> Result<(), String> {
        let explicit = parts
            .iter()
            .filter_map(|part| match part {
                Part::Param {
                    name,
                    runtime_kind: ParamRuntimeKind::Param,
                    ..
                }
                | Part::Name { name, .. }
                | Part::List { name, .. } => Some(name.as_str()),
                Part::Plural {
                    name: Some(name),
                    show_count,
                    ..
                } if show_count != "no" => Some(name.as_str()),
                _ => None,
            })
            .collect::<BTreeSet<_>>();
        let mut implicit = BTreeSet::new();
        for part in parts {
            if let Part::Param {
                nested_parts,
                runtime_kind: ParamRuntimeKind::Implicit,
                ..
            } = part
            {
                let token = self.param_hash_name(part, selected);
                if !implicit.insert(token.clone()) {
                    return Err(format!(
                        "Implicit token '{token}' is already used in this {} call. Change the text inside one of the JSX elements so each implicit token is unique.",
                        self.phrase.module.name()
                    ));
                }
                if explicit.contains(token.as_str()) {
                    return Err(format!(
                        "Token '{token}' is already used in this {} call. Choose a different explicit token name or change the implicit JSX text.",
                        self.phrase.module.name()
                    ));
                }
                self.validate_dynamic_token_parts(nested_parts, selected)?;
            }
        }
        Ok(())
    }
    fn hash_leaf(&self, selected: &[(usize, String)]) -> HashNode {
        HashNode::Leaf(HashLeaf {
            desc: self.description_target.map_or_else(
                || self.phrase.desc.clone(),
                |target| {
                    format!(
                        "In the phrase: \"{}\"",
                        self.description_pattern(self.root_parts, target, selected)
                    )
                },
            ),
            text: self.pattern(selected, true),
            token_aliases: self.aliases(selected),
        })
    }
    fn variations(&self) -> Vec<Variation> {
        let mut out = vec![];
        if self.phrase.options.subject.is_some() {
            out.push(Variation {
                index: usize::MAX,
                keys: vec!["*".into()],
                group: Some("subject".into()),
            });
        }
        for (index, part) in self.global_variations.iter().enumerate() {
            let keys = match *part {
                Part::Param {
                    variation: ParamVariation::Number(_) | ParamVariation::Gender(_),
                    ..
                }
                | Part::Name { .. } => vec!["*".into()],
                Part::Enum { range, .. } => range.iter().map(|x| x.0.clone()).collect(),
                Part::Plural { .. } => vec!["*".into(), "_1".into()],
                Part::Pronoun { usage, human, .. } => pronoun_candidates(usage, *human)
                    .into_iter()
                    .map(|x| x.0)
                    .collect(),
                _ => vec![],
            };
            if !keys.is_empty() {
                out.push(Variation {
                    index,
                    keys,
                    group: variation_group(part),
                });
            }
        }
        out
    }
    fn keys(variations: &[Variation], depth: usize, selected: &[(usize, String)]) -> Vec<String> {
        let v = &variations[depth];
        v.group
            .as_ref()
            .and_then(|group| {
                variations[..depth]
                    .iter()
                    .enumerate()
                    .find(|(_, x)| x.group.as_ref() == Some(group))
                    .and_then(|(i, _)| selected.get(i).map(|x| x.1.clone()))
            })
            .map_or_else(|| v.keys.clone(), |x| vec![x])
    }
    fn branch(
        &self,
        vars: &[Variation],
        depth: usize,
        selected: &mut Vec<(usize, String)>,
    ) -> RuntimeNode {
        if depth == vars.len() {
            return RuntimeNode::String(self.pattern(selected, false));
        }
        let v = &vars[depth];
        RuntimeNode::Object(
            Self::keys(vars, depth, selected)
                .into_iter()
                .map(|key| {
                    selected.push((v.index, key.clone()));
                    let out = self.branch(vars, depth + 1, selected);
                    selected.pop();
                    (key, out)
                })
                .collect(),
        )
    }
    fn hash_branch(
        &self,
        vars: &[Variation],
        depth: usize,
        selected: &mut Vec<(usize, String)>,
    ) -> HashNode {
        if depth == vars.len() {
            return self.hash_leaf(selected);
        }
        let v = &vars[depth];
        HashNode::Object(
            Self::keys(vars, depth, selected)
                .into_iter()
                .map(|key| {
                    selected.push((v.index, key.clone()));
                    let out = self.hash_branch(vars, depth + 1, selected);
                    selected.pop();
                    (key, out)
                })
                .collect(),
        )
    }
    fn pattern(&self, selected: &[(usize, String)], hash: bool) -> String {
        let selected = selected.iter().cloned().collect::<BTreeMap<_, _>>();
        self.pattern_parts(&self.phrase.parts, &selected, hash)
    }
    fn pattern_parts(
        &self,
        parts: &[Part],
        selected: &BTreeMap<usize, String>,
        hash: bool,
    ) -> String {
        let mut out = String::new();
        for part in parts {
            self.append_part_text(&mut out, part, selected, hash);
        }
        normalize_spaces(&out, self.phrase.options.preserve_whitespace)
            .trim()
            .into()
    }
    fn append_part_text(
        &self,
        out: &mut String,
        part: &Part,
        selected: &BTreeMap<usize, String>,
        hash: bool,
    ) {
        match part {
            Part::Text(x) => out.push_str(x),
            Part::Param { name, .. } => out.push_str(&format!(
                "{{{}}}",
                if hash {
                    self.param_hash_name(part, selected)
                } else {
                    name.clone()
                }
            )),
            Part::SameParam { name } | Part::Name { name, .. } | Part::List { name, .. } => {
                out.push_str(&format!("{{{name}}}"))
            }
            Part::Enum { range, .. } => out.push_str(
                self.selected_key(part, selected)
                    .and_then(|key| range.iter().find(|x| &x.0 == key))
                    .map_or("", |x| &x.1),
            ),
            Part::Plural {
                singular,
                many,
                show_count,
                name,
                ..
            } => {
                if self.selected_key(part, selected).is_some_and(|x| x == "_1") {
                    if show_count == "yes" {
                        out.push_str(&format!("1 {singular}"))
                    } else {
                        out.push_str(singular)
                    }
                } else if matches!(show_count.as_str(), "yes" | "ifMany") {
                    out.push_str(&format!(
                        "{{{}}} {many}",
                        name.as_deref().unwrap_or("number")
                    ))
                } else {
                    out.push_str(many)
                }
            }
            Part::Pronoun {
                usage,
                human,
                capitalize,
                ..
            } => {
                let key = self
                    .selected_key(part, selected)
                    .map_or("*", String::as_str);
                let text = pronoun_candidates(usage, *human)
                    .into_iter()
                    .find(|x| x.0 == key)
                    .map_or_else(|| "they".into(), |x| x.1);
                if *capitalize {
                    out.push_str(&capitalize_first(&text))
                } else {
                    out.push_str(&text)
                }
            }
        }
    }
    fn description_pattern(
        &self,
        parts: &[Part],
        target: u32,
        selected: &[(usize, String)],
    ) -> String {
        let selected = selected.iter().cloned().collect::<BTreeMap<_, _>>();
        self.description_parts_text(parts, target, &selected)
    }
    fn description_parts_text(
        &self,
        parts: &[Part],
        target: u32,
        selected: &BTreeMap<usize, String>,
    ) -> String {
        let mut out = String::new();
        self.append_description_parts(&mut out, parts, target, selected);
        normalize_spaces(&out, self.phrase.options.preserve_whitespace)
            .trim()
            .into()
    }
    fn append_description_parts(
        &self,
        out: &mut String,
        parts: &[Part],
        target: u32,
        selected: &BTreeMap<usize, String>,
    ) {
        for part in parts {
            if let Part::Param {
                nested: Some(nested),
                nested_parts,
                runtime_kind: ParamRuntimeKind::Implicit,
                ..
            } = part
            {
                if nested.target_id != target && nested_parts_contain_target(nested_parts, target) {
                    out.push_str(&self.description_parts_text(nested_parts, target, selected));
                } else {
                    out.push_str(&format!("{{{}}}", self.param_hash_name(part, selected)));
                }
            } else {
                self.append_part_text(out, part, selected, false);
            }
        }
    }
    fn selected_key<'s>(
        &self,
        part: &Part,
        selected: &'s BTreeMap<usize, String>,
    ) -> Option<&'s String> {
        let group = variation_group(part)?;
        self.global_variations
            .iter()
            .position(|candidate| variation_group(candidate).as_ref() == Some(&group))
            .and_then(|index| selected.get(&index))
    }
    fn aliases(&self, selected: &[(usize, String)]) -> Option<IndexMap<String, String>> {
        let selected = selected.iter().cloned().collect::<BTreeMap<_, _>>();
        let x = self
            .phrase
            .parts
            .iter()
            .filter_map(|p| match p {
                Part::Param {
                    name,
                    runtime_kind: ParamRuntimeKind::Implicit,
                    ..
                } => {
                    let hash_name = self.param_hash_name(p, &selected);
                    (name != &hash_name).then(|| (hash_name, name.clone()))
                }
                _ => None,
            })
            .collect::<IndexMap<_, _>>();
        (!x.is_empty()).then_some(x)
    }

    fn param_hash_name(&self, part: &Part, selected: &BTreeMap<usize, String>) -> String {
        let Part::Param {
            name,
            hash_name,
            nested,
            nested_parts,
            ..
        } = part
        else {
            unreachable!("param hash name requested for a non-param part")
        };
        if nested.is_some() {
            let text = self.token_name_text(nested_parts, selected);
            format!("={}", text.trim().replace('{', "[").replace('}', "]"))
        } else {
            hash_name.clone().unwrap_or_else(|| name.clone())
        }
    }

    fn token_name_text(&self, parts: &[Part], selected: &BTreeMap<usize, String>) -> String {
        let mut out = String::new();
        for part in parts {
            if let Part::Param {
                nested: Some(_),
                nested_parts,
                runtime_kind: ParamRuntimeKind::Implicit,
                ..
            } = part
            {
                // Babel asks the direct child implicit node for its normal phrase text.
                // That preserves placeholders for any implicit grandchildren while still
                // flattening a direct leaf child into this token name.
                out.push_str(&self.pattern_parts(nested_parts, selected, true));
            } else {
                self.append_part_text(&mut out, part, selected, false);
            }
        }
        normalize_spaces(&out, self.phrase.options.preserve_whitespace)
            .trim()
            .into()
    }
}

fn build_collected_file_output(
    filename: &str,
    source_locator: &SourceLocator,
    phrases: &[Phrase],
    packager: &str,
) -> CollectedFileOutput {
    let mut output = CollectedFileOutput {
        child_parent_mappings: vec![],
        phrases: vec![],
    };
    let mut phrases = phrases.iter().collect::<Vec<_>>();
    phrases.sort_by_key(|phrase| (phrase.span.start, std::cmp::Reverse(phrase.span.end)));
    for phrase in phrases {
        let mut variations = vec![];
        collect_variation_parts(&phrase.parts, &mut variations);
        append_collected_phrase(
            &mut output,
            filename,
            source_locator,
            phrase,
            &variations,
            &phrase.parts,
            None,
            None,
            packager,
        );
    }
    output
}

#[expect(clippy::too_many_arguments)]
fn append_collected_phrase(
    output: &mut CollectedFileOutput,
    filename: &str,
    source_locator: &SourceLocator,
    phrase: &Phrase,
    global_variations: &[&Part],
    root_parts: &[Part],
    description_target: Option<u32>,
    parent: Option<usize>,
    packager: &str,
) {
    let index = output.phrases.len();
    if let Some(parent) = parent {
        output.child_parent_mappings.push((index, parent));
    }
    let builder = RuntimeBuilder::new(phrase, global_variations, root_parts, description_target);
    output.phrases.push(collected_phrase_json(
        filename,
        source_locator,
        phrase,
        global_variations,
        &builder,
        packager,
    ));

    append_collected_children(
        output,
        filename,
        source_locator,
        phrase,
        global_variations,
        root_parts,
        &phrase.parts,
        index,
        packager,
    );
}

#[expect(clippy::too_many_arguments)]
fn append_collected_children(
    output: &mut CollectedFileOutput,
    filename: &str,
    source_locator: &SourceLocator,
    phrase: &Phrase,
    global_variations: &[&Part],
    root_parts: &[Part],
    parts: &[Part],
    parent: usize,
    packager: &str,
) {
    for part in parts {
        let Part::Param {
            nested: Some(nested),
            nested_parts,
            runtime_kind: ParamRuntimeKind::Implicit,
            ..
        } = part
        else {
            continue;
        };
        let nested_phrase = Phrase {
            desc: String::new(),
            module: phrase.module,
            options: phrase.options.clone(),
            parts: nested_parts.clone(),
            span: nested.span,
        };
        append_collected_phrase(
            output,
            filename,
            source_locator,
            &nested_phrase,
            global_variations,
            root_parts,
            Some(nested.target_id),
            Some(parent),
            packager,
        );
    }
}

fn collected_phrase_json(
    filename: &str,
    source_locator: &SourceLocator,
    phrase: &Phrase,
    global_variations: &[&Part],
    builder: &RuntimeBuilder<'_, '_>,
    packager: &str,
) -> serde_json::Value {
    let mut object = serde_json::Map::new();
    let hash_tree = builder.hash_tree();
    if matches!(packager, "phrase" | "both") {
        object.insert("hash_code".into(), fbt_hash(&hash_tree).into());
        object.insert("hash_key".into(), fbt_hash_key(&hash_tree).into());
    }
    if matches!(packager, "text" | "both") {
        object.insert("hashToLeaf".into(), hash_to_leaf_json(&hash_tree));
    }
    object.insert("filename".into(), filename.into());
    object.insert(
        "loc".into(),
        span_location_json(source_locator, phrase.span),
    );
    object.insert(
        "project".into(),
        phrase.options.project.clone().unwrap_or_default().into(),
    );
    if phrase.options.preserve_whitespace {
        object.insert("preserveWhitespace".into(), true.into());
    }
    if let Some(subject) = &phrase.options.subject_json {
        object.insert("subject".into(), subject.clone());
    }
    if let Some(author) = &phrase.options.author {
        object.insert("author".into(), author.clone().into());
    }
    if phrase.options.common {
        object.insert("common".into(), true.into());
    }

    let mut jsfbt = serde_json::Map::new();
    jsfbt.insert(
        "m".into(),
        serde_json::Value::Array(collection_metadata(phrase, global_variations)),
    );
    jsfbt.insert("t".into(), hash_node_json(hash_tree));
    object.insert("jsfbt".into(), serde_json::Value::Object(jsfbt));
    serde_json::Value::Object(object)
}

fn hash_to_leaf_json(node: &HashNode) -> serde_json::Value {
    use base64::Engine;
    use md5::{Digest, Md5};

    let mut object = serde_json::Map::new();
    for (_, leaf) in hash_leaves(node) {
        let mut hasher = Md5::new();
        hasher.update(leaf.text.as_bytes());
        hasher.update(leaf.desc.as_bytes());
        let hash = base64::engine::general_purpose::STANDARD.encode(hasher.finalize());
        object.insert(
            hash,
            serde_json::json!({"desc": leaf.desc, "text": leaf.text}),
        );
    }
    serde_json::Value::Object(object)
}

fn collection_metadata(phrase: &Phrase, global_variations: &[&Part]) -> Vec<serde_json::Value> {
    let mut metadata = vec![];
    if phrase.options.subject.is_some() {
        metadata.push(serde_json::json!({"token": "__subject__", "type": 1}));
    }
    metadata.extend(global_variations.iter().map(|part| match part {
        Part::Param {
            name,
            variation: ParamVariation::Number(_),
            ..
        } => serde_json::json!({"token": name, "type": 2}),
        Part::Param {
            name,
            variation: ParamVariation::Gender(_),
            ..
        }
        | Part::Name { name, .. } => serde_json::json!({"token": name, "type": 1}),
        Part::Plural {
            name, show_count, ..
        } if show_count != "no" => serde_json::json!({
            "singular": true,
            "token": name.as_deref().unwrap_or("number"),
            "type": 2,
        }),
        Part::Enum { .. } | Part::Plural { .. } | Part::Pronoun { .. } => serde_json::Value::Null,
        _ => serde_json::Value::Null,
    }));
    metadata
}

fn hash_node_json(node: HashNode) -> serde_json::Value {
    match node {
        HashNode::Leaf(leaf) => {
            let mut object = serde_json::Map::new();
            object.insert("desc".into(), leaf.desc.into());
            object.insert("text".into(), leaf.text.into());
            if let Some(aliases) = leaf.token_aliases {
                object.insert(
                    "tokenAliases".into(),
                    serde_json::Value::Object(
                        aliases
                            .into_iter()
                            .map(|(key, value)| (key, value.into()))
                            .collect(),
                    ),
                );
            }
            serde_json::Value::Object(object)
        }
        HashNode::Object(entries) => serde_json::Value::Object(
            entries
                .into_iter()
                .map(|(key, value)| (key, hash_node_json(value)))
                .collect(),
        ),
    }
}

fn span_location_json(source_locator: &SourceLocator, span: Span) -> serde_json::Value {
    serde_json::json!({
        "start": source_locator.position_json(span.start as usize),
        "end": source_locator.position_json(span.end as usize),
    })
}

fn babel_subject_json(
    expression: &Expression<'_>,
    source_text: &str,
    source_locator: &SourceLocator,
) -> Option<serde_json::Value> {
    let original_span = expression.span();
    let expression = unwrap_transparent_expression(expression);
    let expression_span = expression.span();
    use oxc_estree::{CompactSerializer, ESTree};
    let mut serializer = CompactSerializer::new(false, false);
    expression.serialize(&mut serializer);
    let mut value = serde_json::from_str(&serializer.into_string()).ok()?;
    normalize_babel_expression(&mut value, source_locator, false);
    if original_span.start < expression_span.start
        && source_text.as_bytes().get(original_span.start as usize) == Some(&b'(')
    {
        if let serde_json::Value::Object(object) = &mut value {
            let paren_start = source_locator
                .position_json(original_span.start as usize)
                .get("index")
                .cloned()
                .unwrap_or_default();
            object.insert(
                "extra".into(),
                serde_json::json!({"parenthesized": true, "parenStart": paren_start}),
            );
        }
    }
    Some(value)
}

fn normalize_babel_expression(
    value: &mut serde_json::Value,
    source_locator: &SourceLocator,
    in_chain: bool,
) {
    let serde_json::Value::Object(object) = value else {
        if let serde_json::Value::Array(values) = value {
            for value in values {
                normalize_babel_expression(value, source_locator, false);
            }
        }
        return;
    };
    if object.get("type").and_then(serde_json::Value::as_str) == Some("ChainExpression") {
        let Some(mut expression) = object.shift_remove("expression") else {
            return;
        };
        normalize_babel_expression(&mut expression, source_locator, true);
        *value = expression;
        return;
    }

    let node_type = object
        .get("type")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default()
        .to_owned();
    for (key, value) in object.iter_mut() {
        let child_in_chain = in_chain
            && matches!(
                (node_type.as_str(), key.as_str()),
                ("MemberExpression", "object") | ("CallExpression", "callee")
            );
        normalize_babel_expression(value, source_locator, child_in_chain);
    }

    let mut object = std::mem::take(object);
    let (Some(start), Some(end)) = (
        object.get("start").and_then(serde_json::Value::as_u64),
        object.get("end").and_then(serde_json::Value::as_u64),
    ) else {
        *value = serde_json::Value::Object(object);
        return;
    };
    let start_position = source_locator.position_json(start as usize);
    let end_position = source_locator.position_json(end as usize);
    let start_index = start_position.get("index").cloned().unwrap_or_default();
    let end_index = end_position.get("index").cloned().unwrap_or_default();
    let mut location = serde_json::Map::new();
    location.insert("start".into(), start_position);
    location.insert("end".into(), end_position);
    if object.get("type").and_then(serde_json::Value::as_str) == Some("Identifier") {
        if let Some(name) = object.get("name").cloned() {
            location.insert("identifierName".into(), name);
        }
    }

    let mut node_type = object
        .shift_remove("type")
        .and_then(|value| value.as_str().map(str::to_owned))
        .unwrap_or_default();
    object.shift_remove("start");
    object.shift_remove("end");
    object.shift_remove("loc");
    let mut fields = serde_json::Map::new();

    if node_type == "Literal" {
        let literal_value = object.shift_remove("value").unwrap_or_default();
        let raw = object.shift_remove("raw");
        if let Some(serde_json::Value::Object(mut regex)) = object.shift_remove("regex") {
            node_type = "RegExpLiteral".into();
            if let Some(raw) = raw {
                fields.insert("extra".into(), serde_json::json!({"raw": raw}));
            }
            for key in ["pattern", "flags"] {
                if let Some(value) = regex.shift_remove(key) {
                    fields.insert(key.into(), value);
                }
            }
        } else {
            match &literal_value {
                serde_json::Value::Null => node_type = "NullLiteral".into(),
                serde_json::Value::Bool(_) => {
                    node_type = "BooleanLiteral".into();
                    fields.insert("value".into(), literal_value);
                }
                serde_json::Value::Number(_) => {
                    node_type = "NumericLiteral".into();
                    if let Some(raw) = raw {
                        fields.insert(
                            "extra".into(),
                            serde_json::json!({"rawValue": literal_value.clone(), "raw": raw}),
                        );
                    }
                    fields.insert("value".into(), literal_value);
                }
                serde_json::Value::String(_) => {
                    node_type = "StringLiteral".into();
                    if let Some(raw) = raw {
                        fields.insert(
                            "extra".into(),
                            serde_json::json!({"rawValue": literal_value.clone(), "raw": raw}),
                        );
                    }
                    fields.insert("value".into(), literal_value);
                }
                _ => {
                    fields.insert("value".into(), literal_value);
                }
            }
        }
    } else if node_type == "Property" {
        let kind = object
            .shift_remove("kind")
            .and_then(|value| value.as_str().map(str::to_owned))
            .unwrap_or_else(|| "init".into());
        let method = object
            .shift_remove("method")
            .and_then(|value| value.as_bool())
            .unwrap_or(false);
        if kind == "init" && !method {
            node_type = "ObjectProperty".into();
            fields.insert("method".into(), false.into());
            for key in ["key", "computed", "shorthand", "value"] {
                if let Some(value) = object.shift_remove(key) {
                    fields.insert(key.into(), value);
                }
            }
        } else {
            // Object methods are not meaningful gender values, but preserve their ESTree
            // fields if one reaches collection rather than corrupting adjacent metadata.
            fields.insert("kind".into(), kind.into());
            fields.insert("method".into(), method.into());
        }
    } else if node_type == "TemplateLiteral" {
        for key in ["expressions", "quasis"] {
            if let Some(value) = object.shift_remove(key) {
                fields.insert(key.into(), value);
            }
        }
    } else if node_type == "MemberExpression" {
        let optional = object
            .shift_remove("optional")
            .and_then(|value| value.as_bool())
            .unwrap_or(false);
        if in_chain || optional {
            node_type = "OptionalMemberExpression".into();
        }
        for key in ["object", "computed", "property"] {
            if let Some(value) = object.shift_remove(key) {
                fields.insert(key.into(), value);
            }
        }
        if node_type == "OptionalMemberExpression" {
            fields.insert("optional".into(), optional.into());
        }
    } else if node_type == "CallExpression" {
        let optional = object
            .shift_remove("optional")
            .and_then(|value| value.as_bool())
            .unwrap_or(false);
        if in_chain || optional {
            node_type = "OptionalCallExpression".into();
        }
        if let Some(callee) = object.shift_remove("callee") {
            fields.insert("callee".into(), callee);
        }
        if node_type == "OptionalCallExpression" {
            fields.insert("optional".into(), optional.into());
        }
        if let Some(arguments) = object.shift_remove("arguments") {
            fields.insert("arguments".into(), arguments);
        }
    } else if node_type == "UnaryExpression" {
        for key in ["operator", "prefix", "argument"] {
            if let Some(value) = object.shift_remove(key) {
                fields.insert(key.into(), value);
            }
        }
    }
    fields.extend(object);

    let mut normalized = serde_json::Map::new();
    normalized.insert("type".into(), node_type.into());
    normalized.insert("start".into(), start_index);
    normalized.insert("end".into(), end_index);
    normalized.insert("loc".into(), serde_json::Value::Object(location));
    normalized.extend(fields);
    *value = serde_json::Value::Object(normalized);
}

struct SourceLocator {
    line_starts: Vec<u32>,
    utf16_offsets: Vec<u32>,
}

impl SourceLocator {
    fn new(source_text: &str) -> Self {
        let mut line_starts = vec![0];
        let mut utf16_offsets = vec![0; source_text.len() + 1];
        let mut utf16_offset = 0u32;
        for (start, character) in source_text.char_indices() {
            let end = start + character.len_utf8();
            utf16_offsets[start..end].fill(utf16_offset);
            utf16_offset += character.len_utf16() as u32;
            utf16_offsets[end] = utf16_offset;
            if character == '\n' {
                line_starts.push(end as u32);
            }
        }
        Self {
            line_starts,
            utf16_offsets,
        }
    }

    fn position_json(&self, byte_offset: usize) -> serde_json::Value {
        let byte_offset = byte_offset.min(self.utf16_offsets.len() - 1);
        let line_index = self
            .line_starts
            .partition_point(|start| *start as usize <= byte_offset)
            - 1;
        let line_start = self.line_starts[line_index] as usize;
        serde_json::json!({
            "line": line_index + 1,
            "column": self.utf16_offsets[byte_offset] - self.utf16_offsets[line_start],
            "index": self.utf16_offsets[byte_offset],
        })
    }
}

fn is_variation_part(part: &Part) -> bool {
    matches!(
        part,
        Part::Param {
            variation: ParamVariation::Number(_) | ParamVariation::Gender(_),
            ..
        } | Part::Name { .. }
            | Part::Enum { .. }
            | Part::Plural { .. }
            | Part::Pronoun { .. }
    )
}

fn collect_variation_parts<'a>(parts: &'a [Part], output: &mut Vec<&'a Part>) {
    let mut used_enums = BTreeSet::new();
    collect_variation_parts_impl(parts, output, &mut used_enums);
}

fn collect_variation_parts_impl<'a>(
    parts: &'a [Part],
    output: &mut Vec<&'a Part>,
    used_enums: &mut BTreeSet<String>,
) {
    for part in parts {
        let collapsible_enum = matches!(part, Part::Enum { .. })
            && variation_group(part).is_some_and(|group| !used_enums.insert(group));
        if is_variation_part(part) && !collapsible_enum {
            output.push(part);
        }
        if let Part::Param {
            nested_parts,
            runtime_kind: ParamRuntimeKind::Implicit,
            ..
        } = part
        {
            collect_variation_parts_impl(nested_parts, output, used_enums);
        }
    }
}

fn contains_nested_phrase(parts: &[Part]) -> bool {
    parts.iter().any(|part| {
        matches!(
            part,
            Part::Param {
                nested: Some(_),
                ..
            }
        ) || matches!(
            part,
            Part::Param {
                nested_parts,
                runtime_kind: ParamRuntimeKind::Implicit,
                ..
            } if contains_nested_phrase(nested_parts)
        )
    })
}

fn nested_parts_contain_target(parts: &[Part], target: u32) -> bool {
    parts.iter().any(|part| {
        matches!(part, Part::Param { nested: Some(nested), .. } if nested.target_id == target)
            || matches!(
                part,
                Part::Param {
                    nested_parts,
                    runtime_kind: ParamRuntimeKind::Implicit,
                    ..
                } if nested_parts_contain_target(nested_parts, target)
            )
    })
}

fn render_runtime_call(
    phrase: &Phrase,
    global_variations: &[&Part],
    shared_runtime_args: &[String],
    root_parts: &[Part],
    description_target: Option<u32>,
) -> String {
    let builder = RuntimeBuilder::new(phrase, global_variations, root_parts, description_target);
    let table = builder.table();
    let hash = fbt_hash_key(&builder.hash_tree());
    let mut runtime_args = shared_runtime_args.to_vec();
    // Babel evaluates runtime arguments by category: variations first, then explicit
    // non-variation params/lists, then implicit JSX params. Preserve that ordering even
    // when an implicit element appears earlier in source.
    for implicit in [false, true] {
        for part in &phrase.parts {
            let is_implicit = matches!(
                part,
                Part::Param {
                    runtime_kind: ParamRuntimeKind::Implicit,
                    ..
                }
            );
            if !is_variation_part(part) && is_implicit == implicit {
                if let Some(argument) = runtime_arg_with_context(
                    phrase,
                    part,
                    global_variations,
                    shared_runtime_args,
                    root_parts,
                ) {
                    runtime_args.push(argument);
                }
            }
        }
    }
    let args = if runtime_args.is_empty() {
        "null".into()
    } else {
        format!("[{}]", runtime_args.join(","))
    };
    let mut options = vec![format!("hk:{}", quote(&hash))];
    if let Some(project) = phrase.options.project.as_ref().filter(|x| !x.is_empty()) {
        options.push(format!("project:{}", quote(project)));
    }
    format!(
        "{}._({table},{args},{{{}}})",
        phrase.module.name(),
        options.join(",")
    )
}

fn runtime_arg_with_context(
    phrase: &Phrase,
    part: &Part,
    global_variations: &[&Part],
    shared_runtime_args: &[String],
    root_parts: &[Part],
) -> Option<String> {
    if let Part::Param {
        name,
        nested: Some(nested),
        nested_parts,
        runtime_kind: ParamRuntimeKind::Implicit,
        ..
    } = part
    {
        let nested_phrase = Phrase {
            desc: String::new(),
            module: phrase.module,
            options: phrase.options.clone(),
            parts: nested_parts.clone(),
            span: nested.span,
        };
        let nested_runtime = render_runtime_call(
            &nested_phrase,
            global_variations,
            shared_runtime_args,
            root_parts,
            Some(nested.target_id),
        );
        return Some(helper(
            phrase.module,
            "_implicitParam",
            &[
                quote(name),
                format!("{}{nested_runtime}{}", nested.prefix, nested.suffix),
            ],
        ));
    }
    runtime_arg(phrase.module, part)
}

fn variation_group(part: &Part) -> Option<String> {
    match part {
        Part::Param {
            variation_key: Some(key),
            variation: ParamVariation::Number(_),
            ..
        } => Some(format!("number-param:{key}")),
        Part::Param {
            variation_key: Some(key),
            variation: ParamVariation::Gender(_),
            ..
        }
        | Part::Name {
            gender_key: key, ..
        } => Some(format!("gender-param:{key}")),
        Part::Enum { value_key, .. } => Some(format!("enum:{value_key}")),
        Part::Plural { count_key, .. } => Some(format!("plural:{count_key}")),
        Part::Pronoun { gender_key, .. } => Some(format!("pronoun:{gender_key}")),
        _ => None,
    }
}
fn helper(module: ModuleName, method: &str, args: &[String]) -> String {
    format!("{}.{method}({})", module.name(), args.join(","))
}
fn runtime_arg(module: ModuleName, part: &Part) -> Option<String> {
    match part {
        Part::Text(_) | Part::SameParam { .. } => None,
        Part::Param {
            name,
            value,
            variation,
            runtime_kind,
            ..
        } => {
            let mut args = vec![quote(name), value.clone()];
            match variation {
                ParamVariation::None => {}
                ParamVariation::Number(x) => args.push(
                    x.as_ref()
                        .map_or_else(|| format!("[{NUMBER}]"), |x| format!("[{NUMBER},{x}]")),
                ),
                ParamVariation::Gender(x) => args.push(format!("[{GENDER},{x}]")),
            }
            Some(helper(
                module,
                match runtime_kind {
                    ParamRuntimeKind::Param => "_param",
                    ParamRuntimeKind::Implicit => "_implicitParam",
                },
                &args,
            ))
        }
        Part::Name {
            name,
            value,
            gender,
            ..
        } => Some(helper(
            module,
            "_name",
            &[quote(name), value.clone(), gender.clone()],
        )),
        Part::Enum {
            value,
            range_code,
            range,
            array,
            ..
        } => Some(helper(
            module,
            "_enum",
            &[
                value.clone(),
                if *array {
                    object_expression(range)
                } else {
                    range_code.clone()
                },
            ],
        )),
        Part::Plural {
            count,
            show_count,
            name,
            value,
            ..
        } => {
            let mut args = vec![count.clone()];
            if show_count != "no" {
                args.push(name.as_ref().map_or_else(|| "null".into(), |x| quote(x)));
                if let Some(value) = value {
                    args.push(value.clone())
                }
            }
            Some(helper(module, "_plural", &args))
        }
        Part::Pronoun {
            usage,
            gender,
            human,
            ..
        } => {
            let mut args = vec![pronoun_usage(usage)?.to_string(), gender.clone()];
            if *human {
                args.push("{human:1}".into())
            }
            Some(helper(module, "_pronoun", &args))
        }
        Part::List {
            name,
            items,
            conjunction,
            delimiter,
        } => {
            let mut args = vec![quote(name), items.clone()];
            if conjunction.is_some() || delimiter.is_some() {
                args.push(
                    conjunction
                        .as_ref()
                        .map_or_else(|| "null".into(), Clone::clone),
                )
            }
            if let Some(x) = delimiter {
                args.push(x.clone())
            }
            Some(helper(module, "_list", &args))
        }
    }
}

fn call_module_name<'a>(
    call: &'a CallExpression<'a>,
) -> Option<(ModuleName, &'a IdentifierReference<'a>)> {
    let ident = match unwrap_transparent_expression(&call.callee) {
        Expression::Identifier(x) => x,
        Expression::StaticMemberExpression(x) => match unwrap_transparent_expression(&x.object) {
            Expression::Identifier(x) => x,
            _ => return None,
        },
        _ => return None,
    };
    Some((
        match ident.name.as_str() {
            "fbt" => ModuleName::Fbt,
            "fbs" => ModuleName::Fbs,
            _ => return None,
        },
        ident,
    ))
}
fn call_member_method<'a>(call: &'a CallExpression<'a>) -> Option<&'a str> {
    match unwrap_transparent_expression(&call.callee) {
        Expression::StaticMemberExpression(x) => Some(x.property.name.as_str()),
        _ => None,
    }
}

fn unwrap_transparent_expression<'a>(mut expression: &'a Expression<'a>) -> &'a Expression<'a> {
    loop {
        expression = match expression {
            Expression::ParenthesizedExpression(x) => &x.expression,
            Expression::TSAsExpression(x) => &x.expression,
            Expression::TSSatisfiesExpression(x) => &x.expression,
            Expression::TSTypeAssertion(x) => &x.expression,
            Expression::TSNonNullExpression(x) => &x.expression,
            Expression::TSInstantiationExpression(x) => &x.expression,
            _ => return expression,
        };
    }
}
fn is_construct_method(x: &str) -> bool {
    matches!(
        x,
        "enum" | "list" | "name" | "param" | "plural" | "pronoun" | "sameParam"
    )
}
fn argument_expr<'b, 'a>(x: &'b Argument<'a>) -> Option<&'b Expression<'a>> {
    x.as_expression()
}
fn argument_string(x: &Argument<'_>) -> Option<String> {
    x.as_expression().and_then(expression_string)
}
fn expression_string(x: &Expression<'_>) -> Option<String> {
    match x {
        Expression::StringLiteral(x) => Some(x.value.to_string()),
        Expression::TemplateLiteral(x) if x.expressions.is_empty() => x.quasis.first().map(|x| {
            x.value
                .cooked
                .as_ref()
                .map_or(x.value.raw.as_str(), |x| x.as_str())
                .to_string()
        }),
        Expression::BinaryExpression(x) if x.operator == BinaryOperator::Addition => Some(format!(
            "{}{}",
            expression_string(&x.left)?,
            expression_string(&x.right)?
        )),
        Expression::ParenthesizedExpression(x) => expression_string(&x.expression),
        Expression::TSAsExpression(x) => expression_string(&x.expression),
        Expression::TSSatisfiesExpression(x) => expression_string(&x.expression),
        Expression::TSTypeAssertion(x) => expression_string(&x.expression),
        Expression::TSNonNullExpression(x) => expression_string(&x.expression),
        Expression::TSInstantiationExpression(x) => expression_string(&x.expression),
        _ => None,
    }
}

fn option_string(x: &Expression<'_>) -> Option<String> {
    match x {
        Expression::StringLiteral(x) => Some(x.value.to_string()),
        Expression::BinaryExpression(x) if x.operator == BinaryOperator::Addition => Some(format!(
            "{}{}",
            option_string(&x.left)?,
            option_string(&x.right)?
        )),
        Expression::ParenthesizedExpression(x) => option_string(&x.expression),
        Expression::TSAsExpression(x) => option_string(&x.expression),
        Expression::TSSatisfiesExpression(x) => option_string(&x.expression),
        Expression::TSTypeAssertion(x) => option_string(&x.expression),
        Expression::TSNonNullExpression(x) => option_string(&x.expression),
        Expression::TSInstantiationExpression(x) => option_string(&x.expression),
        _ => None,
    }
}

fn string_literal_value(x: &Expression<'_>) -> Option<String> {
    match x {
        Expression::StringLiteral(x) => Some(x.value.to_string()),
        Expression::ParenthesizedExpression(x) => string_literal_value(&x.expression),
        Expression::TSAsExpression(x) => string_literal_value(&x.expression),
        Expression::TSSatisfiesExpression(x) => string_literal_value(&x.expression),
        Expression::TSTypeAssertion(x) => string_literal_value(&x.expression),
        Expression::TSNonNullExpression(x) => string_literal_value(&x.expression),
        Expression::TSInstantiationExpression(x) => string_literal_value(&x.expression),
        _ => None,
    }
}

fn is_valid_fbt_array_item(x: &Expression<'_>) -> bool {
    match x {
        Expression::StringLiteral(_)
        | Expression::CallExpression(_)
        | Expression::JSXElement(_)
        | Expression::JSXFragment(_) => true,
        Expression::TemplateLiteral(x) => x.expressions.is_empty(),
        Expression::ParenthesizedExpression(x) => is_valid_fbt_array_item(&x.expression),
        Expression::TSAsExpression(x) => is_valid_fbt_array_item(&x.expression),
        Expression::TSSatisfiesExpression(x) => is_valid_fbt_array_item(&x.expression),
        Expression::TSTypeAssertion(x) => is_valid_fbt_array_item(&x.expression),
        Expression::TSNonNullExpression(x) => is_valid_fbt_array_item(&x.expression),
        Expression::TSInstantiationExpression(x) => is_valid_fbt_array_item(&x.expression),
        _ => false,
    }
}

fn mark_expression_pure(x: &mut Expression<'_>) {
    if let Expression::CallExpression(call) = x {
        call.pure = true;
    }
}

fn validate_param_name(name: &str, module: ModuleName) -> Result<(), String> {
    if name.is_empty() {
        Err(format!(
            "{}.param(...) token name must not be empty.",
            module.name()
        ))
    } else {
        Ok(())
    }
}

fn require_self_closing(
    element: &JSXElement<'_>,
    module: ModuleName,
    construct: &str,
) -> Result<(), String> {
    if element.closing_element.is_some() {
        Err(format!(
            "<{}:{construct}> must be self-closing.",
            module.name()
        ))
    } else {
        Ok(())
    }
}
fn require_source(x: Option<&Expression<'_>>) -> Option<String> {
    let Expression::CallExpression(x) = x? else {
        return None;
    };
    let Expression::Identifier(callee) = &x.callee else {
        return None;
    };
    (callee.name == "require" && x.arguments.len() == 1)
        .then(|| argument_string(&x.arguments[0]))
        .flatten()
}
fn is_fbtee_module_source(source: &str) -> bool {
    // These relative specifiers are the fbtee package's own runtime entrypoints.
    // Consumer code uses the published `fbtee` specifier.
    matches!(
        source,
        "fbtee" | "fbtee/server" | "../index.tsx" | "./fbt.tsx" | "./fbs.tsx"
    )
}
fn enum_manifest_key(source: &str) -> Option<String> {
    let source = source.rsplit('/').next().unwrap_or(source);
    let source = [".tsx", ".ts", ".jsx", ".js"]
        .into_iter()
        .find_map(|x| source.strip_suffix(x))
        .unwrap_or(source);
    source.contains("$FbtEnum").then(|| source.into())
}
fn jsx_element_kind(name: &JSXElementName<'_>) -> Option<(ModuleName, Option<String>)> {
    match name {
        JSXElementName::Identifier(x) => Some((
            match x.name.as_str() {
                "fbt" => ModuleName::Fbt,
                "fbs" => ModuleName::Fbs,
                _ => return None,
            },
            None,
        )),
        JSXElementName::IdentifierReference(x) => Some((
            match x.name.as_str() {
                "fbt" => ModuleName::Fbt,
                "fbs" => ModuleName::Fbs,
                _ => return None,
            },
            None,
        )),
        JSXElementName::NamespacedName(x) => Some((
            match x.namespace.name.as_str() {
                "fbt" => ModuleName::Fbt,
                "fbs" => ModuleName::Fbs,
                _ => return None,
            },
            Some(x.name.name.to_string()),
        )),
        _ => None,
    }
}
#[derive(Default)]
struct FunctionCallOrNewFinder {
    found: bool,
}

impl<'a> Visit<'a> for FunctionCallOrNewFinder {
    fn visit_call_expression(&mut self, _expression: &CallExpression<'a>) {
        self.found = true;
    }

    fn visit_new_expression(&mut self, _expression: &NewExpression<'a>) {
        self.found = true;
    }
}

fn variation_constraint(
    name: &'static str,
    expression: &Expression<'_>,
) -> Option<VariationConstraint> {
    let mut finder = FunctionCallOrNewFinder::default();
    finder.visit_expression(expression);
    finder.found.then_some(VariationConstraint {
        direct: matches!(
            expression,
            Expression::CallExpression(_) | Expression::NewExpression(_)
        ),
        name,
    })
}

fn expression_type(x: &Expression<'_>) -> &'static str {
    match x {
        Expression::ArrayExpression(_) => "ArrayExpression",
        Expression::CallExpression(_) => "CallExpression",
        Expression::Identifier(_) => "Identifier",
        Expression::JSXElement(_) => "JSXElement",
        Expression::JSXFragment(_) => "JSXFragment",
        Expression::ObjectExpression(_) => "ObjectExpression",
        Expression::StringLiteral(_) => "Literal",
        Expression::TemplateLiteral(_) => "TemplateLiteral",
        _ => "Expression",
    }
}

#[derive(Default)]
struct ObjectOptions<'b, 'a> {
    present: BTreeSet<String>,
    strings: BTreeMap<String, String>,
    booleans: BTreeMap<String, bool>,
    expressions: BTreeMap<String, &'b Expression<'a>>,
}
impl<'b, 'a> ObjectOptions<'b, 'a> {
    fn contains(&self, key: &str) -> bool {
        self.present.contains(key)
    }
    fn string(&self, k: &str) -> Option<String> {
        self.strings.get(k).cloned()
    }
    fn boolean(&self, k: &str) -> Option<bool> {
        self.booleans.get(k).copied()
    }
    fn boolean_option(&self, key: &str) -> Result<Option<bool>, String> {
        if !self.contains(key) {
            return Ok(None);
        }
        self.boolean(key)
            .map(Some)
            .ok_or_else(|| format!("Option '{key}' must be a boolean."))
    }
    fn required_string(&self, key: &str) -> Result<Option<String>, String> {
        if !self.contains(key) {
            return Ok(None);
        }
        self.string(key)
            .map(Some)
            .ok_or_else(|| format!("Option '{key}' must be a string literal."))
    }
    fn expression(&self, k: &str) -> Option<&'b Expression<'a>> {
        self.expressions.get(k).copied()
    }
    fn number_expression(&self) -> Result<Option<Option<&'b Expression<'a>>>, String> {
        if !self.contains("number") {
            Ok(None)
        } else if self.booleans.get("number") == Some(&true) {
            Ok(Some(None))
        } else if let Some(expression) = self.expressions.get("number") {
            Ok(Some(Some(*expression)))
        } else {
            Err("Option 'number' must be an expression or true.".into())
        }
    }
}
fn parse_object<'b, 'a>(x: &'b Expression<'a>) -> ObjectOptions<'b, 'a> {
    let mut out = ObjectOptions::default();
    let Expression::ObjectExpression(x) = x else {
        return out;
    };
    for prop in &x.properties {
        let ObjectPropertyKind::ObjectProperty(prop) = prop else {
            continue;
        };
        let Some(key) = property_key_string(&prop.key) else {
            continue;
        };
        out.present.insert(key.clone());
        if let Some(value) = option_string(&prop.value) {
            out.strings.insert(key, value);
        } else {
            match &prop.value {
                Expression::BooleanLiteral(x) => {
                    out.booleans.insert(key, x.value);
                }
                value => {
                    out.expressions.insert(key, value);
                }
            }
        }
    }
    out
}
fn parse_object_options<'b, 'a>(
    expression: &'b Expression<'a>,
    allowed: &[&str],
) -> Result<ObjectOptions<'b, 'a>, String> {
    let Expression::ObjectExpression(object) = expression else {
        return Err("Options must be an object literal.".into());
    };
    for property in &object.properties {
        let ObjectPropertyKind::ObjectProperty(property) = property else {
            return Err(
                "Options must be plain object properties. Remove methods and spread properties."
                    .into(),
            );
        };
        let key = property_key_string(&property.key)
            .ok_or("Option names must be identifiers or string literals.")?;
        if key != "key" && !allowed.contains(&key.as_str()) {
            return Err(format!(
                "Unknown option '{key}'. Use one of: {}.",
                allowed.join(", ")
            ));
        }
        if matches!(property.value, Expression::ArrowFunctionExpression(_)) {
            return Err("fbt(...) options cannot be arrow functions. Pass a value instead.".into());
        }
    }
    Ok(parse_object(expression))
}
fn parse_call_options(
    x: &Expression<'_>,
    defaults: &CallOptions,
    extra_options: &[String],
    source_text: &str,
    source_locator: &SourceLocator,
) -> Result<CallOptions, String> {
    let mut allowed = FBT_OPTIONS.to_vec();
    allowed.extend(extra_options.iter().map(String::as_str));
    let x = parse_object_options(x, &allowed)?;
    for option in extra_options {
        if x.contains(option) {
            x.required_string(option)?
                .ok_or_else(|| format!("Extra option '{option}' must be a string."))?;
        }
    }
    let author = x
        .required_string("author")?
        .or_else(|| defaults.author.clone());
    let common = x.boolean_option("common")?.unwrap_or(defaults.common);
    let do_not_extract = x
        .boolean_option("doNotExtract")?
        .unwrap_or(defaults.do_not_extract);
    let subject = x.expression("subject");
    Ok(CallOptions {
        author,
        common,
        do_not_extract,
        preserve_whitespace: x
            .boolean_option("preserveWhitespace")?
            .unwrap_or(defaults.preserve_whitespace),
        project: x
            .required_string("project")?
            .filter(|project| !project.is_empty())
            .or_else(|| defaults.project.clone()),
        subject: subject
            .map(FbteeTransform::code)
            .or_else(|| defaults.subject.clone()),
        subject_constraint: subject
            .and_then(|subject| variation_constraint("subject", subject))
            .or_else(|| defaults.subject_constraint.clone()),
        subject_json: subject
            .and_then(|subject| babel_subject_json(subject, source_text, source_locator))
            .or_else(|| defaults.subject_json.clone()),
    })
}
fn property_key_string(x: &PropertyKey<'_>) -> Option<String> {
    match x {
        PropertyKey::StaticIdentifier(x) => Some(x.name.to_string()),
        PropertyKey::StringLiteral(x) => Some(x.value.to_string()),
        PropertyKey::NumericLiteral(x) => Some(x.value.to_js_string()),
        _ => None,
    }
}

fn js_array_index(key: &str) -> Option<u32> {
    let index = key.parse::<u32>().ok()?;
    (index != u32::MAX && index.to_string() == key).then_some(index)
}

struct JsxAttrs<'b, 'a> {
    attrs: &'b [JSXAttributeItem<'a>],
}
impl<'b, 'a> JsxAttrs<'b, 'a> {
    fn new(attrs: &'b [JSXAttributeItem<'a>]) -> Self {
        Self { attrs }
    }
    fn attr(&self, key: &str) -> Option<&'b JSXAttribute<'a>> {
        self.attrs.iter().find_map(|x|match x{JSXAttributeItem::Attribute(x)if matches!(&x.name,JSXAttributeName::Identifier(n)if n.name==key)=>Some(x.as_ref()),_=>None})
    }
    fn string(&self, key: &str) -> Option<String> {
        let attr = self.attr(key)?;
        match attr.value.as_ref() {
            Some(JSXAttributeValue::StringLiteral(x)) => {
                Some(decode_jsx_entities(x.value.as_str()))
            }
            Some(JSXAttributeValue::ExpressionContainer(x)) => {
                x.expression.as_expression().and_then(expression_string)
            }
            None => Some("true".into()),
            _ => None,
        }
    }
    fn boolean(&self, key: &str) -> Option<bool> {
        let attribute = self.attr(key)?;
        match attribute.value.as_ref() {
            None => Some(true),
            Some(JSXAttributeValue::StringLiteral(value)) => match value.value.as_str() {
                "true" => Some(true),
                "false" => Some(false),
                _ => None,
            },
            Some(JSXAttributeValue::ExpressionContainer(container)) => {
                match container.expression.as_expression()? {
                    Expression::BooleanLiteral(value) => Some(value.value),
                    Expression::StringLiteral(value) => match value.value.as_str() {
                        "true" => Some(true),
                        "false" => Some(false),
                        _ => None,
                    },
                    _ => None,
                }
            }
            _ => None,
        }
    }
    fn boolean_option(&self, key: &str) -> Result<Option<bool>, String> {
        if self.attr(key).is_none() {
            return Ok(None);
        }
        self.boolean(key).map(Some).ok_or_else(|| {
            format!("Option '{key}' must be a boolean or 'true'/'false' string literal.")
        })
    }
    fn required_string(&self, key: &str) -> Result<Option<String>, String> {
        if self.attr(key).is_none() {
            return Ok(None);
        }
        self.string(key)
            .map(Some)
            .ok_or_else(|| format!("Option '{key}' must be a string literal."))
    }
    fn validate(&self, allowed: &[&str]) -> Result<(), String> {
        for attribute in self.attrs {
            let JSXAttributeItem::Attribute(attribute) = attribute else {
                return Err("fbtee JSX attributes cannot use spread syntax.".into());
            };
            let JSXAttributeName::Identifier(name) = &attribute.name else {
                continue;
            };
            if name.name.starts_with("__") {
                continue;
            }
            if name.name != "key" && !allowed.contains(&name.name.as_str()) {
                return Err(format!(
                    "Unknown option '{}'. Use one of: {}.",
                    name.name,
                    allowed.join(", ")
                ));
            }
        }
        Ok(())
    }
    fn expression(&self, key: &str) -> Option<&'b Expression<'a>> {
        let JSXAttributeValue::ExpressionContainer(x) = self.attr(key)?.value.as_ref()? else {
            return None;
        };
        x.expression.as_expression()
    }
    fn number_expression(&self, key: &str) -> Result<Option<Option<&'b Expression<'a>>>, String> {
        let Some(attribute) = self.attr(key) else {
            return Ok(None);
        };
        match attribute.value.as_ref() {
            None => Ok(Some(None)),
            Some(JSXAttributeValue::StringLiteral(value)) if value.value == "true" => {
                Ok(Some(None))
            }
            Some(JSXAttributeValue::ExpressionContainer(container)) => {
                match container.expression.as_expression() {
                    Some(Expression::BooleanLiteral(value)) if value.value => Ok(Some(None)),
                    Some(Expression::BooleanLiteral(_)) | None => {
                        Err(format!("Option '{key}' must be an expression or true."))
                    }
                    Some(expression) => Ok(Some(Some(expression))),
                }
            }
            _ => Err(format!("Option '{key}' must be an expression or true.")),
        }
    }
}

fn normalize_spaces(value: &str, preserve: bool) -> String {
    if preserve {
        return value.into();
    }
    let mut out = String::new();
    let mut last_space = false;
    for c in value.chars() {
        let space = c != '\u{00a0}' && c.is_whitespace();
        if space {
            if !last_space {
                out.push(' ')
            }
        } else {
            out.push(c)
        }
        last_space = space
    }
    out
}

fn is_collapsible_whitespace_only(value: &str) -> bool {
    value
        .chars()
        .all(|character| character != '\u{00a0}' && character.is_whitespace())
}

fn decode_jsx_entities(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let mut remaining = value;
    while let Some(start) = remaining.find('&') {
        output.push_str(&remaining[..start]);
        remaining = &remaining[start..];
        let Some(end) = remaining.find(';') else {
            output.push_str(remaining);
            return output;
        };
        let entity = &remaining[..=end];
        let name = &entity[1..entity.len() - 1];
        let recognized = name.starts_with('#')
            || JSX_NAMED_ENTITIES
                .split_ascii_whitespace()
                .any(|candidate| candidate == name);
        if recognized {
            let decoded = html_escape::decode_html_entities(entity);
            if decoded != entity {
                output.push_str(&decoded);
                remaining = &remaining[end + 1..];
                continue;
            }
        }
        output.push('&');
        remaining = &remaining[1..];
    }
    output.push_str(remaining);
    output
}

fn normalize_jsx_param_name(value: &str) -> String {
    if value.contains(['\n', '\r']) {
        normalize_spaces(value, false)
    } else {
        value.to_string()
    }
}
fn clean_jsx_text(value: &str) -> String {
    let normalized = value.replace("\r\n", "\n").replace('\r', "\n");
    let lines = normalized.split('\n').collect::<Vec<_>>();
    let last_non_empty = lines
        .iter()
        .rposition(|line| line.chars().any(|c| c != ' ' && c != '\t'))
        .unwrap_or(0);
    let mut out = String::new();
    for (i, original) in lines.iter().enumerate() {
        let mut line = original.replace('\t', " ");
        if i > 0 {
            line = line.trim_start_matches(' ').into()
        }
        if i + 1 < lines.len() {
            line = line.trim_end_matches(' ').into()
        }
        if !line.is_empty() {
            out.push_str(&line);
            if i != last_non_empty {
                out.push(' ')
            }
        }
    }
    out
}
fn jsx_text_content(children: &[JSXChild<'_>]) -> String {
    children
        .iter()
        .map(|x| match x {
            JSXChild::Text(x) => decode_jsx_entities(x.value.as_str()),
            JSXChild::ExpressionContainer(x) => x
                .expression
                .as_expression()
                .and_then(expression_string)
                .unwrap_or_default(),
            JSXChild::Element(x) => jsx_text_content(&x.children),
            JSXChild::Fragment(x) => jsx_text_content(&x.children),
            JSXChild::Spread(_) => String::new(),
        })
        .collect()
}

fn jsx_plural_text(children: &[JSXChild<'_>], module: ModuleName) -> Result<String, String> {
    let mut values = vec![];
    for child in children {
        match child {
            JSXChild::Text(text) if !text.value.chars().all(char::is_whitespace) => {
                values.push(decode_jsx_entities(text.value.as_str()));
            }
            JSXChild::ExpressionContainer(container) => {
                if let Some(expression) = container.expression.as_expression() {
                    values.push(expression_string(expression).ok_or_else(|| {
                        format!(
                            "<{}:plural> child must be static text or a string expression.",
                            module.name()
                        )
                    })?);
                }
            }
            JSXChild::Text(_) => {}
            JSXChild::Element(_) | JSXChild::Fragment(_) | JSXChild::Spread(_) => {
                return Err(format!(
                    "<{}:plural> needs exactly one child: text or an expression.",
                    module.name()
                ));
            }
        }
    }
    if values.len() != 1 {
        return Err(format!(
            "<{}:plural> needs exactly one child: text or an expression.",
            module.name()
        ));
    }
    Ok(values.pop().expect("one plural child"))
}
fn implicit_param_alias(index: usize) -> String {
    format!("=m{index}")
}
fn compact_text_parts(parts: Vec<Part>) -> Vec<Part> {
    let mut out = vec![];
    for part in parts {
        if let Part::Text(text) = part {
            if let Some(Part::Text(last)) = out.last_mut() {
                last.push_str(&text)
            } else {
                out.push(Part::Text(text))
            }
        } else {
            out.push(part)
        }
    }
    out
}
fn implicit_child_hash_name(child: &JSXChild<'_>, options: &CallOptions) -> String {
    let text = match child {
        JSXChild::Element(x) => jsx_implicit_token_text(&x.children, options),
        JSXChild::Fragment(x) => jsx_implicit_token_text(&x.children, options),
        _ => String::new(),
    };
    let text = normalize_spaces(&text, options.preserve_whitespace)
        .trim()
        .replace('{', "[")
        .replace('}', "]");
    format!("={text}")
}
fn jsx_implicit_token_text(children: &[JSXChild<'_>], options: &CallOptions) -> String {
    let mut out = String::new();
    for child in children {
        match child {
            JSXChild::Text(x) => out.push_str(&decode_jsx_entities(x.value.as_str())),
            JSXChild::ExpressionContainer(x) => {
                if let Some(expr) = x.expression.as_expression() {
                    if let Some(text) = expression_description_text(expr, options) {
                        out.push_str(&text)
                    }
                }
            }
            JSXChild::Element(x) => {
                if let Some((_, Some(kind))) = jsx_element_kind(&x.opening_element.name) {
                    out.push_str(&format!(
                        "{{{}}}",
                        jsx_construct_token_text(x, &kind, options)
                    ))
                } else {
                    out.push_str(&jsx_implicit_token_text(&x.children, options))
                }
            }
            JSXChild::Fragment(x) => out.push_str(&jsx_implicit_token_text(&x.children, options)),
            JSXChild::Spread(_) => {}
        }
    }
    normalize_spaces(&out, options.preserve_whitespace)
        .trim()
        .into()
}
fn jsx_children_contain_spread(children: &[JSXChild<'_>]) -> bool {
    children.iter().any(|child| match child {
        JSXChild::Spread(_) => true,
        JSXChild::Element(element) => jsx_children_contain_spread(&element.children),
        JSXChild::Fragment(fragment) => jsx_children_contain_spread(&fragment.children),
        JSXChild::Text(_) | JSXChild::ExpressionContainer(_) => false,
    })
}
fn expression_description_text(
    expression: &Expression<'_>,
    options: &CallOptions,
) -> Option<String> {
    match expression {
        Expression::StringLiteral(value) => Some(normalize_spaces(
            value.value.as_str(),
            options.preserve_whitespace,
        )),
        Expression::TemplateLiteral(template) if template.expressions.is_empty() => {
            Some(normalize_spaces(
                &template
                    .quasis
                    .iter()
                    .map(|quasi| quasi.value.raw.as_str())
                    .collect::<String>(),
                options.preserve_whitespace,
            ))
        }
        Expression::BinaryExpression(binary) if binary.operator == BinaryOperator::Addition => {
            Some(format!(
                "{}{}",
                expression_description_text(&binary.left, options)?,
                expression_description_text(&binary.right, options)?
            ))
        }
        _ => None,
    }
}
fn jsx_construct_token_text(element: &JSXElement<'_>, kind: &str, options: &CallOptions) -> String {
    let attrs = JsxAttrs::new(&element.opening_element.attributes);
    match kind {
        "param" | "same-param" | "sameParam" | "name" | "list" | "plural" => attrs
            .string("name")
            .unwrap_or_else(|| normalized_jsx_token(&element.children, options)),
        "enum" => normalized_jsx_token(&element.children, options),
        _ => normalized_jsx_token(&element.children, options),
    }
}
fn normalized_jsx_token(children: &[JSXChild<'_>], options: &CallOptions) -> String {
    normalize_spaces(&jsx_text_content(children), options.preserve_whitespace)
        .trim()
        .to_string()
}
fn validate_option_value(name: &str, value: &str, allowed: &[&str]) -> Result<(), String> {
    if allowed.contains(&value) {
        Ok(())
    } else {
        Err(format!(
            "Invalid value '{value}' for option '{name}'. Use one of: {}.",
            allowed.join(", ")
        ))
    }
}
fn validate_pronoun_usage(usage: &str, module: ModuleName) -> Result<(), String> {
    if PRONOUN_USAGES.contains(&usage) {
        Ok(())
    } else {
        Err(format!(
            "First argument of {}.pronoun(...) must be one of: {}. Received '{usage}' (string).",
            module.name(),
            PRONOUN_USAGES.join(", ")
        ))
    }
}
fn pronoun_usage(x: &str) -> Option<i32> {
    match x {
        "object" => Some(0),
        "possessive" => Some(1),
        "reflexive" => Some(2),
        "subject" => Some(3),
        _ => None,
    }
}
fn pronoun_candidates(usage: &str, human: bool) -> Vec<(String, String)> {
    let items: &[(&str, &str)] = match usage {
        "object" if !human => &[("0", "this"), ("1", "her"), ("2", "him"), ("*", "them")],
        "object" => &[("1", "her"), ("2", "him"), ("*", "them")],
        "possessive" => &[("1", "her"), ("2", "his"), ("*", "their")],
        "reflexive" if !human => &[
            ("0", "themself"),
            ("1", "herself"),
            ("2", "himself"),
            ("*", "themselves"),
        ],
        "reflexive" => &[("1", "herself"), ("2", "himself"), ("*", "themselves")],
        "subject" => &[("1", "she"), ("2", "he"), ("*", "they")],
        _ => &[],
    };
    items
        .iter()
        .map(|(a, b)| (a.to_string(), b.to_string()))
        .collect()
}
fn capitalize_first(x: &str) -> String {
    let mut chars = x.chars();
    chars.next().map_or_else(String::new, |first| {
        first.to_uppercase().collect::<String>() + chars.as_str()
    })
}
fn object_expression(items: &[(String, String)]) -> String {
    format!(
        "{{{}}}",
        items
            .iter()
            .map(|(k, v)| format!("{}:{}", property_code(k), quote(v)))
            .collect::<Vec<_>>()
            .join(",")
    )
}
fn property_code(x: &str) -> String {
    if is_identifier(x) {
        x.into()
    } else {
        quote(x)
    }
}
fn is_identifier(x: &str) -> bool {
    let mut c = x.chars();
    c.next()
        .is_some_and(|x| x == '_' || x == '$' || x.is_ascii_alphabetic())
        && c.all(|x| x == '_' || x == '$' || x.is_ascii_alphanumeric())
}
fn quote(x: &str) -> String {
    serde_json::to_string(x).unwrap()
}
fn unknown_common_string_message(x: &str) -> String {
    format!("Unknown common string '{x}'. Add it to 'fbtCommon' or use a 'desc' attribute.")
}

fn fbt_hash_key(x: &HashNode) -> String {
    base62(fbt_hash(x))
}
fn fbt_hash(x: &HashNode) -> u32 {
    let leaves = hash_leaves(x);
    let Some((_, first)) = leaves.first() else {
        return 0;
    };
    if leaves.iter().all(|(_, leaf)| leaf.desc == first.desc) {
        jenkins(&format!("{}|{}", json_text_tree(x), first.desc))
    } else {
        jenkins(&json_full_tree(x))
    }
}
fn hash_leaves(node: &HashNode) -> Vec<(Vec<String>, &HashLeaf)> {
    fn walk<'a>(
        n: &'a HashNode,
        path: &mut Vec<String>,
        out: &mut Vec<(Vec<String>, &'a HashLeaf)>,
    ) {
        match n {
            HashNode::Leaf(x) => out.push((path.clone(), x)),
            HashNode::Object(x) => {
                for (k, v) in x {
                    path.push(k.clone());
                    walk(v, path, out);
                    path.pop();
                }
            }
        }
    }
    let mut out = vec![];
    walk(node, &mut vec![], &mut out);
    out
}
fn json_text_tree(node: &HashNode) -> String {
    match node {
        HashNode::Leaf(x) => match &x.token_aliases {
            Some(aliases) => format!(
                "{{\"text\":{},\"tokenAliases\":{}}}",
                quote(&x.text),
                json_object(
                    aliases
                        .iter()
                        .map(|(key, value)| (key.as_str(), quote(value)))
                )
            ),
            None => quote(&x.text),
        },
        HashNode::Object(x) => json_object(x.iter().map(|(k, v)| (k.as_str(), json_text_tree(v)))),
    }
}
fn json_full_tree(node: &HashNode) -> String {
    match node {
        HashNode::Leaf(x) => {
            let mut fields = vec![("desc", quote(&x.desc)), ("text", quote(&x.text))];
            let aliases;
            if let Some(x) = &x.token_aliases {
                aliases = json_object(x.iter().map(|(k, v)| (k.as_str(), quote(v))));
                fields.push(("tokenAliases", aliases));
            }
            json_object(fields.into_iter())
        }
        HashNode::Object(x) => json_object(x.iter().map(|(k, v)| (k.as_str(), json_full_tree(v)))),
    }
}
fn json_object<'a>(x: impl Iterator<Item = (&'a str, String)>) -> String {
    format!(
        "{{{}}}",
        x.map(|(k, v)| format!("{}:{v}", quote(k)))
            .collect::<Vec<_>>()
            .join(",")
    )
}
fn jenkins(x: &str) -> u32 {
    let mut h = 0u32;
    for b in x.bytes() {
        h = h.wrapping_add(b.into());
        h = h.wrapping_add(h << 10);
        h ^= h >> 6;
    }
    h = h.wrapping_add(h << 3);
    h ^= h >> 11;
    h.wrapping_add(h << 15)
}
fn base62(mut x: u32) -> String {
    const D: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if x == 0 {
        return "0".into();
    }
    let mut out = vec![];
    while x > 0 {
        out.push(D[(x % 62) as usize]);
        x /= 62
    }
    out.reverse();
    String::from_utf8(out).unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn transform(source: &str, options: FbteeOptions) -> Result<String, String> {
        let allocator = Allocator::default();
        let parsed = Parser::new(&allocator, source, SourceType::tsx()).parse();
        if parsed.diagnostics.has_errors() {
            return Err(parsed.diagnostics[0].to_string());
        }
        let mut program = parsed.program;
        let semantic = oxc::semantic::SemanticBuilder::new().build(&program);
        if semantic.diagnostics.has_errors() {
            return Err(semantic.diagnostics[0].to_string());
        }
        let scoping = semantic.semantic.into_scoping();
        let diagnostics = transform_program(&allocator, &mut program, scoping, options);
        if diagnostics.has_errors() {
            return Err(diagnostics[0].to_string());
        }
        Ok(Codegen::new().build(&program).code)
    }

    #[test]
    fn hashes_match_expected_values() {
        assert_eq!(
            fbt_hash_key(&HashNode::Leaf(HashLeaf {
                desc: "It's simple".into(),
                text: "A simple string".into(),
                token_aliases: None
            })),
            "pITkM"
        );
        assert_eq!(
            fbt_hash_key(&HashNode::Leaf(HashLeaf {
                desc: "Lists".into(),
                text: "Available Locations: {locations}".into(),
                token_aliases: None
            })),
            "19372u"
        );
    }

    #[test]
    fn transforms_calls_jsx_and_nested_implicit_params() {
        let output = transform(
            "import { fbt } from 'fbtee'; const x = <fbt desc='d'>Hello <b>world <i>inner</i></b></fbt>;",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("fbt._(\"Hello {=m1}\""), "{output}");
        assert!(output.contains("hk: \"36nzit\""), "{output}");
        assert!(output.contains("hk: \"2YVHfO\""), "{output}");
        assert!(output.contains("hk: \"2JgOvk\""), "{output}");
        assert!(!output.contains("<fbt"), "{output}");
    }

    #[test]
    fn respects_shadowing_and_auto_imports() {
        let output = transform(
            "function local(fbt) { return fbt('A', 'B'); } const translated = <fbt desc='d'>C</fbt>;",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("return fbt(\"A\", \"B\")"), "{output}");
        assert!(
            output.contains("const { fbt } = require(\"fbtee\")"),
            "{output}"
        );
        assert!(output.contains("fbt._(\"C\""), "{output}");
    }

    #[test]
    fn trims_implicit_jsx_hash_names() {
        let output = transform(
            "const x = <fbt desc='outer'>Click <b> world </b></fbt>;",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("hk: \"2oIm1Y\""), "{output}");
        assert!(output.contains("hk: \"2FqS8b\""), "{output}");
    }

    #[test]
    fn transforms_calls_in_implicit_jsx_attributes() {
        let output = transform(
            "const x = <fbt desc='outer'>Click <a title={fbt('Title', 'link title')}>here</a></fbt>;",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(!output.contains("title={fbt(\"Title\""), "{output}");
        assert!(output.contains("title={fbt._(\"Title\""), "{output}");
    }

    #[test]
    fn uses_named_constructs_in_implicit_descriptions() {
        let output = transform(
            "const x = <fbt desc='outer'>Click <b><fbt:param name='user'>{user}</fbt:param></b></fbt>;",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("hk: \"3yVf8D\""), "{output}");
        assert!(output.contains("hk: \"1xP5l8\""), "{output}");
    }

    #[test]
    fn rejects_array_spreads_in_text() {
        let error = transform(
            "const x = fbt(['A', ...parts, 'B'], 'd');",
            FbteeOptions::default(),
        )
        .unwrap_err();
        assert!(error.contains("unsupported array spread"), "{error}");
    }

    #[test]
    fn preserves_plural_keys_for_shared_number_variations() {
        let output = transform(
            "const x = fbt(fbt.param('a', n, { number: true }) + fbt.plural('cat', n), 'd');",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("_1: \"{a}cat\""), "{output}");
        assert!(output.contains("hk: \"2hoPmH\""), "{output}");
    }

    #[test]
    fn preserves_nested_implicit_aliases() {
        let output = transform(
            "const x = <fbt desc='d'>\n  <div href='#'>\n    <div href='#'>this is</div>\n    a doubly\n  </div>\n  nested test\n</fbt>;",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("\"{=m1} a doubly\""), "{output}");
        assert!(output.contains("fbt._implicitParam(\"=m1\""), "{output}");
        assert!(output.contains("hk: \"1OBj79\""), "{output}");
    }

    #[test]
    fn propagates_variations_through_nested_implicit_phrases() {
        let output = transform(
            "import { fbt } from 'fbtee'; const x = <fbt desc='example 1'><fbt:param gender={gender} name='name'><b>{name}</b></fbt:param> has shared <a><fbt:plural count={count} many='photos' showCount='ifMany'>a photo</fbt:plural></a> with you</fbt>;",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("hk: \"46j2Ai\""), "{output}");
        assert!(output.contains("hk: \"BNUvh\""), "{output}");
        assert_eq!(output.matches("fbt._plural(count, \"number\")").count(), 1);
        assert!(
            output.contains("[__fbtee_sv_arg_0, __fbtee_sv_arg_1]"),
            "{output}"
        );
    }

    #[test]
    fn propagates_enum_and_pronoun_variations_through_nested_phrases() {
        let options = FbteeOptions {
            fbt_enum_manifest: IndexMap::from([(
                "Example$FbtEnum".into(),
                IndexMap::from([
                    ("LINK".into(), "link".into()),
                    ("PAGE".into(), "page".into()),
                    ("PHOTO".into(), "photo".into()),
                    ("POST".into(), "post".into()),
                    ("VIDEO".into(), "video".into()),
                ]),
            )]),
            ..FbteeOptions::default()
        };
        let output = transform(
            "import { fbt } from 'fbtee'; import ExampleEnum from './Example$FbtEnum.ts'; const x = <fbt desc='Example enum & pronoun'><fbt:param name='name'><b><a href='#'>{person}</a></b></fbt:param> has a <fbt:enum enum-range={ExampleEnum} value={object} /> to share!{' '}<b><a href='#'>View</a></b>{' '}<fbt:pronoun gender={gender} human={false} type='possessive' />{' '}<fbt:enum enum-range={ExampleEnum} value={object} />.</fbt>;",
            options,
        )
        .unwrap();
        assert!(output.contains("hk: \"qcSj6\""), "{output}");
        assert!(output.contains("hk: \"1aXHYa\""), "{output}");
        assert!(output.contains("hk: \"283TK8\""), "{output}");
        assert_eq!(output.matches("fbt._enum(object, ExampleEnum)").count(), 1);
    }

    #[test]
    fn rejects_incompatible_reused_enum_ranges() {
        let error = transform(
            "const x = fbt(fbt.enum(value, { A: 'a', B: 'b' }) + fbt.enum(value, { A: 'a' }), 'd');",
            FbteeOptions::default(),
        )
        .unwrap_err();
        assert!(error.contains("re-use incompatible enums"), "{error}");
    }

    #[test]
    fn orders_numeric_enum_keys_like_javascript() {
        let output = transform(
            "const x = fbt('Value: ' + fbt.enum(value, { 10: 'Ten', 2: 'Two', z: 'Zulu' }), 'd');",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(
            output.find("\"2\": \"Value: Two\"").unwrap()
                < output.find("\"10\": \"Value: Ten\"").unwrap(),
            "{output}"
        );
        assert!(output.contains("hk: \"22ZDVd\""), "{output}");
    }

    #[test]
    fn preserves_raw_whitespace_inside_implicit_phrases() {
        let output = transform(
            "const x = <fbt desc='d' preserveWhitespace={true}>A <b> C\n D </b> B</fbt>;",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("hk: \"l4sBK\""), "{output}");
        assert!(output.contains("hk: \"1EyZ1Y\""), "{output}");
    }

    #[test]
    fn supports_constructs_inside_functional_jsx() {
        let output = transform(
            "const x = fbt(['A ', <b>{fbt.param('x', x)}</b>], 'd');",
            FbteeOptions::default(),
        )
        .unwrap();
        assert_eq!(
            output.matches("fbt._param(\"x\", x)").count(),
            1,
            "{output}"
        );
        assert!(output.contains("hk: \"y4FQs\""), "{output}");
        assert!(output.contains("hk: \"1nYm5Z\""), "{output}");
    }

    #[test]
    fn supports_nested_fbt_inside_explicit_jsx_params() {
        let output = transform(
            "import { fbt } from 'fbtee'; const x = <fbt desc='d'>
              <fbt:param name='explicit fbt param'>
                <div>
                  <fbt desc='d2'>
                    explicit fbt param
                    <div>with a nested implicit param</div>
                  </fbt>
                </div>
              </fbt:param>
            </fbt>;",
            FbteeOptions::default(),
        )
        .unwrap();
        for hash in ["47XKzg", "4aGXvg", "1t6SVf"] {
            assert!(output.contains(&format!("hk: \"{hash}\"")), "{output}");
        }
        assert!(
            output.contains("{fbt._(\"explicit fbt param {=m1}\""),
            "{output}"
        );
    }

    #[test]
    fn preserves_three_level_implicit_descriptions() {
        let output = transform(
            "import { fbt } from 'fbtee'; const x = <fbt desc='d'>
              <div href='#'>
                one
                <div href='#'>
                  two
                  <div href='#'>test</div>
                </div>
              </div>
              <div href='#'>
                three
                <div href='#'>four</div>
              </div>
            </fbt>;",
            FbteeOptions::default(),
        )
        .unwrap();
        for hash in ["2OdL6Y", "OL15x", "43pnQG", "cB79p", "2TH8xE", "3UXE0m"] {
            assert!(output.contains(&format!("hk: \"{hash}\"")), "{output}");
        }
    }

    #[test]
    fn rejects_concatenated_functional_array_items() {
        let error = transform(
            "const x = fbt(['It is ' + fbt.pronoun('possessive', gender) + ' birthday.'], 'd');",
            FbteeOptions::default(),
        )
        .unwrap_err();
        assert!(
            error.contains("fbt(array) items must be string literals"),
            "{error}"
        );
    }

    #[test]
    fn enum_ranges_require_literal_values_and_supported_imports() {
        for source in [
            "const x = fbt(fbt.enum(value, ['a' + 'b']), 'd');",
            "const x = fbt(fbt.enum(value, [`a`]), 'd');",
            "const x = fbt(fbt.enum(value, { A: 'a' + 'b' }), 'd');",
        ] {
            let error = transform(source, FbteeOptions::default()).unwrap_err();
            assert!(error.contains("must be string literals"), "{error}");
        }

        let options = FbteeOptions {
            fbt_enum_manifest: IndexMap::from([(
                "Test$FbtEnum".into(),
                IndexMap::from([("A".into(), "a".into())]),
            )]),
            ..FbteeOptions::default()
        };
        let error = transform(
            "import { TestEnum } from './Test$FbtEnum'; const x = fbt(fbt.enum(value, TestEnum), 'd');",
            options,
        )
        .unwrap_err();
        assert!(error.contains("is not registered"), "{error}");
    }

    #[test]
    fn preserves_pure_annotations_on_transformed_calls() {
        let output = transform(
            "import { fbt } from 'fbtee'; const x = /*#__PURE__*/ fbt('A', 'd');",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("/*#__PURE__*/ fbt._"), "{output}");
    }

    #[test]
    fn unwraps_parenthesized_fbtee_callees() {
        let output = transform(
            "import { fbt } from 'fbtee'; const x = (fbt)('A', 'd');",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("fbt._(\"A\""), "{output}");

        let error = transform(
            "import { fbt } from 'fbtee'; const x = (fbt).param('x', value);",
            FbteeOptions::default(),
        )
        .unwrap_err();
        assert!(error.contains("must be inside an fbt"), "{error}");
    }

    #[test]
    fn deduplicates_enum_ranges_like_javascript() {
        let output = transform(
            "const x = fbt(fbt.enum(value, {a: 'A', a: 'B'}), 'd');",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("fbt._({ a: \"B\" }"), "{output}");
        assert!(output.contains("hk: \"N0GIJ\""), "{output}");

        let output = transform(
            "const x = fbt(fbt.enum(value, ['A', 'A', 'B']), 'd');",
            FbteeOptions::default(),
        )
        .unwrap();
        assert_eq!(output.matches("A: \"A\"").count(), 2, "{output}");
    }

    #[test]
    fn normalizes_multiline_jsx_plural_names_for_runtime() {
        let output = transform(
            "const x = <fbt desc='d'><fbt:plural count={count} name={'two\\n lines'} showCount='yes'>item</fbt:plural></fbt>;",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("{two lines}"), "{output}");
        assert!(
            output.contains("fbt._plural(count, \"two lines\")"),
            "{output}"
        );
        assert!(!output.contains("two\\n lines"), "{output}");
    }

    #[test]
    fn rejects_false_common_without_a_description() {
        let error = transform(
            "const x = <fbt common='false'>A</fbt>;",
            FbteeOptions::default(),
        )
        .unwrap_err();
        assert!(error.contains("needs one of these attributes"), "{error}");
    }

    #[test]
    fn empty_projects_inherit_docblock_defaults() {
        for source in [
            "/** @fbt {\"project\":\"dev\"} */ const x = fbt('A', 'd', {project: ''});",
            "/** @fbt {\"project\":\"dev\"} */ const x = <fbt desc='d' project=''>A</fbt>;",
        ] {
            let output = transform(source, FbteeOptions::default()).unwrap();
            assert!(output.contains("project: \"dev\""), "{output}");
        }
    }

    #[test]
    fn canonicalizes_variation_group_expressions() {
        let output = transform(
            "const x = fbt(fbt.plural('cat', count) + ' and ' + fbt.plural('dog', (count)), 'd');",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("hk: \"2W3tmL\""), "{output}");
        assert!(!output.contains("\"*\": { _1:"), "{output}");
        assert!(!output.contains("_1: { \"*\":"), "{output}");
    }

    #[test]
    fn formats_numeric_enum_keys_like_javascript() {
        for (source, key) in [
            (
                "const x = fbt(fbt.enum(value, {1e21: 'value'}), 'd');",
                "1e+21",
            ),
            (
                "const x = fbt(fbt.enum(value, {1e-7: 'value'}), 'd');",
                "1e-7",
            ),
        ] {
            let output = transform(source, FbteeOptions::default()).unwrap();
            assert!(output.contains(&format!("\"{key}\"")), "{output}");
        }
    }

    #[test]
    fn rejects_empty_enum_ranges() {
        for source in [
            "const x = fbt(fbt.enum(value, []), 'd');",
            "const x = fbt(fbt.enum(value, {}), 'd');",
        ] {
            let error = transform(source, FbteeOptions::default()).unwrap_err();
            assert!(error.contains("Enum range cannot be empty"), "{error}");
        }
    }

    #[test]
    fn evaluates_explicit_params_before_implicit_params() {
        let output = transform(
            "const x = <fbt desc='d'><b><fbt:param name='implicit'>{a()}</fbt:param></b><fbt:param name='explicit'>{c()}</fbt:param></fbt>;",
            FbteeOptions::default(),
        )
        .unwrap();
        let explicit = output.find("fbt._param(\"explicit\", c())").unwrap();
        let implicit = output.find("fbt._implicitParam").unwrap();
        assert!(explicit < implicit, "{output}");
    }

    #[test]
    fn recognizes_server_and_facade_imports() {
        for source in [
            "import { fbs } from 'fbtee/server'; export const x = fbs('Title', 'server title');",
            "import { fbt } from './i18n'; export const x = fbt('Title', 'facade title');",
            "import fbt from './i18n'; export const x = fbt('Title', 'facade title');",
            "import * as fbt from './i18n'; export const x = fbt('Title', 'facade title');",
        ] {
            let output = transform(source, FbteeOptions::default()).unwrap();
            assert!(
                output.contains("fbt._(\"Title\"") || output.contains("fbs._(\"Title\""),
                "{output}"
            );
        }
    }

    #[test]
    fn ignores_non_pragma_fbt_comments() {
        let output = transform(
            "/* This module documents the @fbt implementation. */ export const x = 1;",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("export const x = 1"), "{output}");
    }

    #[test]
    fn decodes_the_supported_jsx_entity_set() {
        let output = transform(
            "const x = <fbt desc='d'>&NotEqualTilde;</fbt>;",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("\"&NotEqualTilde;\""), "{output}");
        assert!(output.contains("hk: \"3Q7jiK\""), "{output}");

        let output = transform(
            "const x = <fbt desc='d'>A&nbsp;B</fbt>;",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("A\\xA0B"), "{output}");
    }

    #[test]
    fn preserves_dynamic_list_formatting_arguments() {
        let output = transform(
            "const x = fbt(fbt.list('x', items, getConjunction(), getDelimiter()), 'd');",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(
            output.contains("fbt._list(\"x\", items, getConjunction(), getDelimiter())"),
            "{output}"
        );

        let output = transform(
            "const x = <fbt desc='d'><fbt:list name='x' items={items} conjunction={getConjunction()} delimiter={getDelimiter()} /></fbt>;",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(
            output.contains("fbt._list(\"x\", items, getConjunction(), getDelimiter())"),
            "{output}"
        );
    }

    #[test]
    fn validates_and_statically_evaluates_plural_many() {
        let output = transform(
            "const x = fbt(fbt.plural('cat', count, {many: 'kit' + 'ties'}), 'd');",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("\"*\": \"kitties\""), "{output}");
        assert!(output.contains("hk: \"3hbfYN\""), "{output}");

        let error = transform(
            "const x = fbt(fbt.plural('cat', count, {many: dynamic}), 'd');",
            FbteeOptions::default(),
        )
        .unwrap_err();
        assert!(error.contains("many` option must be"), "{error}");
    }

    #[test]
    fn statically_evaluates_functional_text_options() {
        let output = transform(
            "const x = fbt('A', 'd', {author: 'c' + 'd', project: 'a' + 'b'});",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("project: \"ab\""), "{output}");
    }

    #[test]
    fn rejects_false_jsx_number_options() {
        for source in [
            "const x = <fbt desc='d'><fbt:param name='x' number={false}>{value}</fbt:param></fbt>;",
            "const x = <fbt desc='d'><fbt:param name='x' number='false'>{value}</fbt:param></fbt>;",
        ] {
            let error = transform(source, FbteeOptions::default()).unwrap_err();
            assert!(
                error.contains("Option 'number' must be an expression or true"),
                "{error}"
            );
        }
    }

    #[test]
    fn strictly_validates_fbt_docblocks() {
        for source in [
            "/** @fbt {\"project\":\"p\"} trailing */ const x = fbt('A', 'd');",
            "/** @fbt {\"author\":3} */ const x = fbt('A', 'd');",
        ] {
            assert!(
                transform(source, FbteeOptions::default()).is_err(),
                "{source}"
            );
        }
    }

    #[test]
    fn normalizes_type_only_imports_to_named_runtime_imports() {
        for source in [
            "import type fbt from 'fbtee'; const x = fbt('A', 'd');",
            "import type * as fbt from 'fbtee'; const x = fbt('A', 'd');",
            "import type { fbt } from './types'; const x = <fbt desc='d'>A</fbt>;",
        ] {
            let output = transform(source, FbteeOptions::default()).unwrap();
            assert!(output.contains("import { fbt } from \"fbtee\""), "{output}");
            assert!(!output.contains("import type"), "{output}");
            assert!(output.contains("fbt._(\"A\""), "{output}");
        }
    }

    #[test]
    fn trims_functional_common_strings() {
        let output = transform(
            "const x = fbt.c('  Required  ');",
            FbteeOptions {
                fbt_common: BTreeMap::from([("Required".into(), "required field".into())]),
                ..FbteeOptions::default()
            },
        )
        .unwrap();
        assert!(output.contains("fbt._(\"Required\""), "{output}");
    }

    #[test]
    fn omits_plural_tokens_when_show_count_is_no() {
        let output = transform(
            "const x = fbt(fbt.plural('cat', n, { name: 'n', value: v, showCount: 'no' }), 'd');",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("fbt._plural(n)"), "{output}");
        assert!(!output.contains("fbt._plural(n, \"n\""), "{output}");

        let output = transform(
            "const x = <fbt desc='d'><fbt:plural count={won} name='number' showCount='no'>won game</fbt:plural>, <fbt:plural count={lost} name='number' showCount='no'>lost game</fbt:plural></fbt>;",
            FbteeOptions::default(),
        )
        .unwrap();
        assert_eq!(output.matches("fbt._plural(").count(), 2, "{output}");
    }

    #[test]
    fn applies_fbt_docblock_defaults() {
        let output = transform(
            "/** @fbt {\"project\":\"dev\"} */\nconst x = fbt('Also simple string', 'It is simple');",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("project: \"dev\""), "{output}");
    }

    #[test]
    fn rejects_side_effecting_variations_only_when_shared_with_nested_phrases() {
        let error = transform(
            "const x = fbt(['A ', <b>B</b>], 'd', { subject: subjectValue() });",
            FbteeOptions::default(),
        )
        .unwrap_err();
        assert!(
            error.contains("Argument 'subject' cannot be a function call"),
            "{error}"
        );

        let output = transform(
            "const x = fbt(fbt.enum(getValue(), ['world']), 'd');",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("fbt._enum(getValue()"), "{output}");
    }

    #[test]
    fn trims_each_nested_phrase_when_building_contextual_descriptions() {
        let output = transform(
            "const x = <fbt desc='d'>\n<div href='#'>\none\n<div href='#'>two</div>\n</div>\n<div href='#'>\nthree\n<div href='#'>four</div>\n</div>\n</fbt>;",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("hk: \"n5ibk\""), "{output}");
        assert!(!output.contains("hk: \"2wfjob\""), "{output}");
    }

    #[test]
    fn correlates_pronouns_that_share_a_gender() {
        let output = transform(
            "const x = fbt(fbt.pronoun('subject', gender, { capitalize: true, human: true }) + ' wished ' + fbt.pronoun('reflexive', gender, { human: true }) + ' a happy birthday.', 'subject+reflexive pronouns');",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(
            output.contains("\"1\": { \"1\": \"She wished herself a happy birthday.\""),
            "{output}"
        );
        assert!(!output.contains("She wished himself"), "{output}");
        assert!(!output.contains("They wished herself"), "{output}");
        assert!(output.contains("hk: \"2MyuU3\""), "{output}");
    }

    #[test]
    fn preserves_singular_whitespace_between_jsx_constructs() {
        let output = transform(
            "const x = <fbt desc=''>\n  You can add\n  <fbt:plural count={count} many='these'>\n    this\n  </fbt:plural>\n  <fbt:plural count={count} many='tags'>\n    tag\n  </fbt:plural>\n  to anything.\n</fbt>;",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(
            output.contains("You can add this tag to anything."),
            "{output}"
        );
        assert!(
            output.contains("You can add thesetags to anything."),
            "{output}"
        );
        assert!(output.contains("hk: \"1kDgt0\""), "{output}");
    }

    #[test]
    fn validates_tokens_across_nested_implicit_phrases() {
        let error = transform(
            "const x = <fbt desc='d'><fbt:param name='foo'>{foo}</fbt:param> <b><fbt:name name='foo' gender={gender}>{person}</fbt:name></b></fbt>;",
            FbteeOptions::default(),
        )
        .unwrap_err();
        assert!(error.contains("Token 'foo' is already used"), "{error}");

        let output = transform(
            "const x = <fbt desc='d'><fbt:param name='foo'>{foo}</fbt:param> <b><fbt:same-param name='foo' /></b></fbt>;",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("fbt._(\"{foo}\", null"), "{output}");
        assert!(output.contains("hk: \"2eNYI0\""), "{output}");
    }

    #[test]
    fn type_only_imports_do_not_satisfy_runtime_bindings() {
        let output = transform(
            "import type { fbt } from 'fbtee'; const x = fbt('A', 'B');",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("import { fbt } from \"fbtee\""), "{output}");
        assert!(!output.contains("import type { fbt }"), "{output}");
        assert!(output.contains("fbt._(\"A\""), "{output}");
    }

    #[test]
    fn preserves_shadowing_in_implicit_jsx_attributes() {
        let output = transform(
            "const x = <fbt desc='outer'><a title={() => { const fbt = local; return fbt('Not translated', 'local'); }}>here</a></fbt>;",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(
            output.contains("return fbt(\"Not translated\", \"local\")"),
            "{output}"
        );
        assert!(!output.contains("fbt._(\"Not translated\""), "{output}");
    }

    #[test]
    fn preserves_shadowing_in_jsx_param_children() {
        let output = transform(
            "const x = <fbt desc='outer'><fbt:param name='content'><span>{() => { const fbt = local; return fbt('Not translated', 'local'); }}</span></fbt:param></fbt>;",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("return fbt(\"Not translated\""), "{output}");
        assert!(!output.contains("fbt._(\"Not translated\""), "{output}");
    }

    #[test]
    fn text_only_fbs_params_are_strings() {
        let output = transform(
            "const x = <fbs desc='outer'>A<fbs:param name='space'> </fbs:param>B</fbs>;",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("fbs._param(\"space\", \" \")"), "{output}");
        assert!(!output.contains("fbs._param(\"space\", <>"), "{output}");
    }

    #[test]
    fn rejects_invalid_constructs_and_tokens() {
        for (source, expected) in [
            (
                "const x = fbt(fbt.plural('cat', count, { showCount: 'sometimes' }), 'd');",
                "Invalid value 'sometimes' for option 'showCount'",
            ),
            (
                "const x = fbt(fbt.plural('cat', count, { unknown: true }), 'd');",
                "Unknown option 'unknown'",
            ),
            (
                "const x = fbt(fbt.pronoun('possession', gender), 'd');",
                "must be one of: object, possessive, reflexive, subject",
            ),
            (
                "const x = fbt('A' + fbt.sameParam('missing'), 'd');",
                "does not match a token in this string",
            ),
            (
                "const x = fbt(fbt.param('name', a) + fbt.param('name', b), 'd');",
                "Token 'name' is already used",
            ),
            (
                "const x = <fbt common desc='d'>A</fbt>;",
                "cannot also have a 'desc' attribute",
            ),
            (
                "const x = <fbt desc='d'><fbt:param name='x' unknown='y'>{x}</fbt:param></fbt>;",
                "Unknown option 'unknown'",
            ),
            (
                "const x = fbt('A', 'd', { preserveWhitespace: 'sometimes' });",
                "must be a boolean",
            ),
            (
                "const x = fbt('A', 'd', { preserveWhitespace: 'true' });",
                "must be a boolean",
            ),
            (
                "const x = fbt(fbt.param('x', value, { number: 'true' }), 'd');",
                "must be an expression or true",
            ),
            (
                "const x = fbt(fbt.pronoun('subject', gender, { human: 'true' }), 'd');",
                "must be a boolean",
            ),
            (
                "const x = <fbt desc='d' common='sometimes'>A</fbt>;",
                "must be a boolean",
            ),
            (
                "const x = <fbt desc='d' {...options}>A</fbt>;",
                "cannot use spread syntax",
            ),
            (
                "const x = <fbt desc='d'>A{...children}B</fbt>;",
                "cannot contain JSX spread children",
            ),
            (
                "const x = <fbt desc='d'><b>x</b><i>x</i></fbt>;",
                "Implicit token '=x' is already used",
            ),
            (
                "const x = <fbt desc='d'><a>world</a><b><fbt:plural count={value}>world</fbt:plural></b></fbt>;",
                "Implicit token '=world' is already used",
            ),
            (
                "const x = <fbt desc='d'><fbt:param name='x'>{a}{b}</fbt:param></fbt>;",
                "<fbt:param> needs exactly one child: an expression or JSX element",
            ),
            (
                "const x = <fbt desc='d'><fbt:param name='x'>text</fbt:param></fbt>;",
                "<fbt:param> needs exactly one child: an expression or JSX element",
            ),
            (
                "const x = <fbt desc='d'><fbt:name name='x' gender={gender}><b>{person}</b></fbt:name></fbt>;",
                "<fbt:name> needs exactly one child: text or an expression",
            ),
        ] {
            let error = transform(source, FbteeOptions::default()).unwrap_err();
            assert!(error.contains(expected), "{source}\n{error}");
        }
    }

    #[test]
    fn resolves_commonjs_enum_manifests() {
        let options = FbteeOptions {
            fbt_enum_manifest: IndexMap::from([(
                "Example$FbtEnum".into(),
                IndexMap::from([
                    ("id1".into(), "groups".into()),
                    ("id2".into(), "photos".into()),
                ]),
            )]),
            ..FbteeOptions::default()
        };
        let output = transform(
            "const fbt = require('fbtee'); const Example = require('./Example$FbtEnum'); const x = fbt('Click to see ' + fbt.enum(id, Example), 'enums!');",
            options,
        )
        .unwrap();
        assert!(output.contains("id1: \"Click to see groups\""), "{output}");
        assert!(output.contains("fbt._enum(id, Example)"), "{output}");
    }

    #[test]
    fn preserves_enum_manifest_order() {
        let options = FbteeOptions {
            fbt_enum_manifest: IndexMap::from([(
                "Example$FbtEnum".into(),
                IndexMap::from([("z".into(), "Zulu".into()), ("a".into(), "Alpha".into())]),
            )]),
            ..FbteeOptions::default()
        };
        let output = transform(
            "import Example from './Example$FbtEnum'; const x = fbt('Value: ' + fbt.enum(value, Example), 'd');",
            options,
        )
        .unwrap();
        let z = output.find("z: \"Value: Zulu\"").expect(&output);
        let a = output.find("a: \"Value: Alpha\"").expect(&output);
        assert!(z < a, "{output}");
    }

    #[test]
    fn preserves_implicit_alias_insertion_order() {
        let output = transform(
            "import { fbt } from 'fbtee'; const x = <fbt desc='d'><b>z</b><i>a</i></fbt>;",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("hk: \"3SXH1U\""), "{output}");
    }

    #[test]
    fn accepts_jsx_enum_string_values() {
        let options = FbteeOptions {
            fbt_enum_manifest: IndexMap::from([(
                "Test$FbtEnum".into(),
                IndexMap::from([
                    ("id1".into(), "groups".into()),
                    ("id2".into(), "photos".into()),
                    ("id3".into(), "videos".into()),
                ]),
            )]),
            ..FbteeOptions::default()
        };
        let output = transform(
            "import aEnum from 'Test$FbtEnum'; const x = <fbt desc='enums!'>Click to see <fbt:enum enum-range={aEnum} value='id1' /></fbt>;",
            options,
        )
        .unwrap();
        assert!(output.contains("fbt._enum(\"id1\", aEnum)"), "{output}");
        assert!(output.contains("hk: \"3SHnwE\""), "{output}");
    }

    #[test]
    fn preserves_async_and_generator_context_in_generated_calls() {
        for (source, expected) in [
            (
                "async function x() { return <fbt desc='d'><b><fbt:param name='x' gender={gender}>{await value}</fbt:param></b></fbt>; }",
                "fbt._param(\"x\", await value",
            ),
            (
                "function* x() { return <fbt desc='d'><b><fbt:param name='x' gender={gender}>{yield value}</fbt:param></b></fbt>; }",
                "fbt._param(\"x\", yield value",
            ),
        ] {
            let output = transform(source, FbteeOptions::default()).unwrap();
            assert!(output.contains(expected), "{output}");
        }
    }

    #[test]
    fn preserves_comments_inside_dynamic_values() {
        let output = transform(
            "const x = fbt(fbt.param('x', import(/* webpackChunkName: \"settings\" */ './settings')), 'd');",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(
            output.contains("webpackChunkName: \"settings\""),
            "{output}"
        );
    }

    #[test]
    fn parses_fbt_docblocks_with_following_pragmas() {
        let output = transform(
            "/** @fbt {\"project\":\"dev\"}\n * @format\n */\nconst x = fbt('A', 'd');",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("project: \"dev\""), "{output}");
    }

    #[test]
    fn matches_fbtee_bindings_by_source_and_scope() {
        let facade = transform(
            "import fbt from './local.js'; const x = fbt('A', 'B');",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(facade.contains("fbt._(\"A\""), "{facade}");

        let internal = transform(
            "import fbt from './fbt.tsx'; const x = fbt('A', 'B');",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(internal.contains("fbt._(\"A\""), "{internal}");

        let destructured = transform(
            "const { fbt } = require('fbtee'); const x = fbt('A', 'B');",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(destructured.contains("fbt._(\"A\""), "{destructured}");

        let scoped = transform(
            "const fbt = local; function x() { const fbt = require('fbtee'); return fbt('A', 'B'); }",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(scoped.contains("return fbt._(\"A\""), "{scoped}");
        assert_eq!(scoped.matches("require(\"fbtee\")").count(), 1, "{scoped}");
    }

    #[test]
    fn normalizes_runtime_token_names_and_docblock_defaults() {
        let output = transform(
            "/** @fbt {\"preserveWhitespace\":true,\"subject\":\"gender\"} */\nconst x = <fbt desc='d'><fbt:param name='two\n lines'>{value}</fbt:param></fbt>;",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(
            output.contains("fbt._param(\"two lines\", value)"),
            "{output}"
        );
        assert!(!output.contains("fbt._subject"), "{output}");
    }

    #[test]
    fn reports_invalid_construct_placement() {
        let error = transform(
            "const value = fbt.param('name', name);",
            FbteeOptions::default(),
        )
        .unwrap_err();
        assert!(
            error.contains("must be inside an fbt(...) or <fbt> string"),
            "{error}"
        );
    }

    #[test]
    fn rejects_standalone_jsx_constructs() {
        for construct in ["param", "plural", "enum", "pronoun", "list", "same-param"] {
            let source = format!("const value = <fbt:{construct} />;");
            let error = transform(&source, FbteeOptions::default()).unwrap_err();
            assert!(
                error.contains("must be inside an fbt(...) or <fbt> string"),
                "{source}\n{error}"
            );
        }
    }

    #[test]
    fn trims_descriptions() {
        let functional =
            transform("const value = fbt('A', '  d  ');", FbteeOptions::default()).unwrap();
        let canonical = transform("const value = fbt('A', 'd');", FbteeOptions::default()).unwrap();
        assert_eq!(functional, canonical);

        let jsx = transform(
            "const value = <fbt desc='  d  '>A</fbt>;",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(jsx.contains("hk: \"27usJ1\""), "{jsx}");

        let common = transform(
            "const value = fbt.c('A');",
            FbteeOptions {
                fbt_common: BTreeMap::from([("A".into(), "  d  ".into())]),
                ..FbteeOptions::default()
            },
        )
        .unwrap();
        assert_eq!(common, canonical);
    }

    #[test]
    fn preserves_functional_token_names_and_param_name_options() {
        let raw = transform(
            "const value = fbt(fbt.param(' x ', value), 'd');",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(raw.contains("fbt._param(\" x \", value)"), "{raw}");
        assert!(raw.contains("hk: \"2TJ7OH\""), "{raw}");

        let overridden = transform(
            "const value = fbt(fbt.param(dynamicName, value, { name: 'y' }), 'd');",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(overridden.contains("\"{y}\""), "{overridden}");
        assert!(
            overridden.contains("fbt._param(\"y\", value)"),
            "{overridden}"
        );
    }

    #[test]
    fn validates_param_variation_options_and_names() {
        for (source, expected) in [
            (
                "const value = fbt(fbt.param('x', value, { gender, number: true }), 'd');",
                "cannot use both 'gender' and 'number'",
            ),
            (
                "const value = <fbt desc='d'><fbt:param name='x' gender={gender} number={true}>{value}</fbt:param></fbt>;",
                "cannot use both 'gender' and 'number'",
            ),
            (
                "const value = fbt(fbt.param('', value), 'd');",
                "token name must not be empty",
            ),
            (
                "const value = <fbt desc='d'><fbt:param name=''>{value}</fbt:param></fbt>;",
                "token name must not be empty",
            ),
        ] {
            let error = transform(source, FbteeOptions::default()).unwrap_err();
            assert!(error.contains(expected), "{source}\n{error}");
        }
    }

    #[test]
    fn reads_fbt_docblocks_after_shebangs() {
        let output = transform(
            "#!/usr/bin/env node\n/** @fbt {\"project\":\"dev\"} */\nconst value = fbt('A', 'd');",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("project: \"dev\""), "{output}");
    }

    #[test]
    fn type_only_declarations_do_not_shadow_jsx_fbt() {
        for declaration in ["type fbt = string;", "interface fbt { value: string }"] {
            let source = format!("{declaration} const value = <fbt desc='d'>A</fbt>;");
            let output = transform(&source, FbteeOptions::default()).unwrap();
            assert!(output.contains("fbt } = require(\"fbtee\")"), "{output}");
            assert!(output.contains("fbt._(\"A\""), "{output}");
        }
    }

    #[test]
    fn unwraps_transparent_typescript_expressions() {
        let output = transform(
            "type FbtInput = unknown; const value = fbt((('A' as const) satisfies string)!, 'd' as const); const param = fbt((fbt.param('x', x) as FbtInput)!, 'p');",
            FbteeOptions::default(),
        )
        .unwrap();
        assert!(output.contains("fbt._(\"A\""), "{output}");
        assert!(output.contains("fbt._param(\"x\", x)"), "{output}");
    }

    #[test]
    fn validates_namespaced_jsx_children() {
        for (source, expected) in [
            (
                "const value = <fbt desc='d'><fbt:enum enum-range={{ a: 'A' }} value='a'>LOST</fbt:enum></fbt>;",
                "<fbt:enum> must be self-closing",
            ),
            (
                "const value = <fbt desc='d'><fbt:list name='x' items={items}>LOST</fbt:list></fbt>;",
                "<fbt:list> must be self-closing",
            ),
            (
                "const value = <fbt desc='d'><fbt:pronoun type='subject' gender={gender}>LOST</fbt:pronoun></fbt>;",
                "<fbt:pronoun> must be self-closing",
            ),
            (
                "const value = <fbt desc='d'><fbt:param name='x'>{x}</fbt:param><fbt:same-param name='x'>LOST</fbt:same-param></fbt>;",
                "<fbt:same-param> must be self-closing",
            ),
            (
                "const value = <fbt desc='d'><fbt:plural count={count}>{label}</fbt:plural></fbt>;",
                "child must be static text",
            ),
            (
                "const value = <fbt desc='d'><fbt:plural count={count}>one{'two'}</fbt:plural></fbt>;",
                "needs exactly one child",
            ),
        ] {
            let error = transform(source, FbteeOptions::default()).unwrap_err();
            assert!(error.contains(expected), "{source}\n{error}");
        }
    }
}
