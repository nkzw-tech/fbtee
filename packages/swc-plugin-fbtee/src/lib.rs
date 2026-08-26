use indexmap::IndexMap;
use serde::Deserialize;
use std::collections::{BTreeMap, BTreeSet};
use swc_core::{
    common::{comments::Comments, Span, Spanned, DUMMY_SP},
    ecma::{
        ast::*,
        atoms::Wtf8Atom,
        utils::number::ToJsString,
        visit::{noop_visit_mut_type, Visit, VisitMut, VisitMutWith, VisitWith},
    },
    plugin::{plugin_transform, proxies::TransformPluginProgramMetadata},
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

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PluginOptions {
    #[serde(default)]
    collect_fbt: bool,
    #[serde(default)]
    fbt_common: BTreeMap<String, String>,
    #[serde(default)]
    fbt_enum_manifest: IndexMap<String, IndexMap<String, String>>,
    #[serde(default)]
    fbt_enum_manifest_entries: Vec<(String, Vec<(String, String)>)>,
}

#[plugin_transform]
pub fn process_transform(program: Program, metadata: TransformPluginProgramMetadata) -> Program {
    let mut options = match metadata.get_transform_plugin_config() {
        Some(config) => serde_json::from_str::<PluginOptions>(&config).unwrap_or_else(|error| {
            compile_error(&format!(
                "Invalid fbtee SWC plugin config. Received '{error}'."
            ))
        }),
        None => PluginOptions::default(),
    };
    if !options.fbt_enum_manifest_entries.is_empty() {
        if !options.fbt_enum_manifest.is_empty() {
            compile_error(
                "Options 'fbtEnumManifest' and 'fbtEnumManifestEntries' cannot be combined.",
            );
        }
        options.fbt_enum_manifest = std::mem::take(&mut options.fbt_enum_manifest_entries)
            .into_iter()
            .map(|(module, entries)| (module, entries.into_iter().collect()))
            .collect();
    } else if !options.fbt_enum_manifest.is_empty() {
        compile_error(
            "Option 'fbtEnumManifest' must be passed through createFbteePluginOptions from '@nkzw/swc-plugin-fbtee/index.js' so enum key order is preserved.",
        );
    }
    if options.collect_fbt {
        compile_error(
            "Option 'collectFbt' is not supported by the fbtee SWC runtime compiler. Use the Babel collector to extract phrases.",
        );
    }

    let first_item_position = match &program {
        Program::Module(module) => module
            .body
            .first()
            .map_or_else(|| program.span().lo, |item| item.span().lo),
        Program::Script(script) => script
            .body
            .first()
            .map_or_else(|| program.span().lo, |statement| statement.span().lo),
    };
    let default_project = metadata
        .comments
        .as_ref()
        .and_then(|comments| {
            comments
                .get_leading(program.span().lo)
                .or_else(|| comments.get_leading(first_item_position))
        })
        .and_then(|comments| comments.first().cloned())
        .map(|comment| parse_docblock_project(comment.text.as_ref()))
        .transpose()
        .unwrap_or_else(|error| compile_error(&error))
        .flatten();

    let mut program = program;
    program.visit_mut_with(&mut FbteeTransform::new(options, default_project));
    program
}

struct FbteeTransform {
    options: PluginOptions,
    imported_enums: BTreeMap<String, IndexMap<String, String>>,
    local_bindings: Vec<BTreeMap<String, LocalBinding>>,
    seen_fbs_import: bool,
    seen_fbt_import: bool,
    fbs_ident: Option<Ident>,
    fbt_ident: Option<Ident>,
    used_fbs: bool,
    used_fbt: bool,
    default_project: Option<String>,
}

#[derive(Clone)]
enum LocalBinding {
    Local,
    Fbtee(Ident),
}

impl FbteeTransform {
    fn new(options: PluginOptions, default_project: Option<String>) -> Self {
        Self {
            options,
            imported_enums: BTreeMap::new(),
            local_bindings: Vec::new(),
            seen_fbs_import: false,
            seen_fbt_import: false,
            fbs_ident: None,
            fbt_ident: None,
            used_fbs: false,
            used_fbt: false,
            default_project,
        }
    }

    fn add_local_binding(&mut self, name: &str) {
        if (name == "fbt" || name == "fbs") && !self.local_bindings.is_empty() {
            self.local_bindings
                .last_mut()
                .expect("expected a local binding scope")
                .insert(name.to_string(), LocalBinding::Local);
        }
    }

    fn add_pat_bindings(&mut self, pat: &Pat) {
        match pat {
            Pat::Ident(ident) => self.add_local_binding(ident.id.sym.as_ref()),
            Pat::Array(array) => {
                for elem in array.elems.iter().flatten() {
                    self.add_pat_bindings(elem);
                }
            }
            Pat::Object(object) => {
                for prop in &object.props {
                    match prop {
                        ObjectPatProp::KeyValue(prop) => self.add_pat_bindings(&prop.value),
                        ObjectPatProp::Assign(prop) => {
                            self.add_local_binding(prop.key.sym.as_ref())
                        }
                        ObjectPatProp::Rest(prop) => self.add_pat_bindings(&prop.arg),
                    }
                }
            }
            Pat::Rest(rest) => self.add_pat_bindings(&rest.arg),
            Pat::Assign(assign) => self.add_pat_bindings(&assign.left),
            Pat::Expr(_) | Pat::Invalid(_) => {}
        }
    }

    fn mark_fbtee_binding(&mut self, pat: &Pat) {
        if let Pat::Ident(ident) = pat {
            match ident.id.sym.as_ref() {
                "fbt" => {
                    if self.local_bindings.len() == 1 {
                        self.seen_fbt_import = true;
                        self.fbt_ident = Some(ident.id.clone());
                    } else if let Some(scope) = self.local_bindings.last_mut() {
                        scope.insert("fbt".to_string(), LocalBinding::Fbtee(ident.id.clone()));
                    }
                }
                "fbs" => {
                    if self.local_bindings.len() == 1 {
                        self.seen_fbs_import = true;
                        self.fbs_ident = Some(ident.id.clone());
                    } else if let Some(scope) = self.local_bindings.last_mut() {
                        scope.insert("fbs".to_string(), LocalBinding::Fbtee(ident.id.clone()));
                    }
                }
                _ => {}
            }
        }
    }

    fn mark_imported_binding(&mut self, ident: &Ident, runtime: bool) {
        match ident.sym.as_ref() {
            "fbt" => {
                self.seen_fbt_import |= runtime;
                self.fbt_ident = Some(ident.clone());
            }
            "fbs" => {
                self.seen_fbs_import |= runtime;
                self.fbs_ident = Some(ident.clone());
            }
            _ => {}
        }
    }

    fn is_shadowed(&self, module: ModuleName) -> bool {
        let name = module.as_str();
        for bindings in self.local_bindings.iter().rev() {
            match bindings.get(name) {
                Some(LocalBinding::Local) => return true,
                Some(LocalBinding::Fbtee(_)) => return false,
                None => {}
            }
        }
        false
    }

    fn module_ident(&self, module: ModuleName) -> Ident {
        let name = module.as_str();
        for bindings in self.local_bindings.iter().rev() {
            if let Some(LocalBinding::Fbtee(ident)) = bindings.get(name) {
                return ident.clone();
            }
        }
        match module {
            ModuleName::Fbt => self
                .fbt_ident
                .clone()
                .unwrap_or_else(|| Ident::new_no_ctxt("fbt".into(), DUMMY_SP)),
            ModuleName::Fbs => self
                .fbs_ident
                .clone()
                .unwrap_or_else(|| Ident::new_no_ctxt("fbs".into(), DUMMY_SP)),
        }
    }

    fn collect_module_bindings(&mut self, module: &Module) {
        for item in &module.body {
            match item {
                ModuleItem::ModuleDecl(ModuleDecl::Import(import)) => {
                    for specifier in &import.specifiers {
                        match specifier {
                            ImportSpecifier::Default(default) => {
                                self.mark_imported_binding(&default.local, !import.type_only);
                            }
                            ImportSpecifier::Named(named) => {
                                self.mark_imported_binding(
                                    &named.local,
                                    !import.type_only && !named.is_type_only,
                                );
                            }
                            ImportSpecifier::Namespace(namespace) => {
                                self.mark_imported_binding(&namespace.local, !import.type_only);
                            }
                        }
                    }
                }
                ModuleItem::Stmt(stmt) => self.collect_stmt_bindings(stmt),
                _ => {}
            }
        }
    }

    fn collect_block_bindings(&mut self, block: &BlockStmt) {
        for stmt in &block.stmts {
            self.collect_stmt_bindings(stmt);
        }
    }

    fn collect_stmt_bindings(&mut self, stmt: &Stmt) {
        match stmt {
            Stmt::Decl(decl) => self.collect_decl_bindings(decl),
            Stmt::For(for_stmt) => {
                if let Some(VarDeclOrExpr::VarDecl(var)) = &for_stmt.init {
                    self.collect_var_decl_bindings(var);
                }
            }
            Stmt::ForIn(for_in) => {
                if let ForHead::VarDecl(var) = &for_in.left {
                    self.collect_var_decl_bindings(var);
                }
            }
            Stmt::ForOf(for_of) => {
                if let ForHead::VarDecl(var) = &for_of.left {
                    self.collect_var_decl_bindings(var);
                }
            }
            _ => {}
        }
    }

    fn collect_decl_bindings(&mut self, decl: &Decl) {
        match decl {
            Decl::Class(class) => self.add_local_binding(class.ident.sym.as_ref()),
            Decl::Fn(function) => self.add_local_binding(function.ident.sym.as_ref()),
            Decl::Var(var) => self.collect_var_decl_bindings(var),
            _ => {}
        }
    }

    fn collect_var_decl_bindings(&mut self, var: &VarDecl) {
        for declarator in &var.decls {
            self.collect_var_declarator_binding(declarator);
        }
    }

    fn collect_var_declarator_binding(&mut self, declarator: &VarDeclarator) {
        if is_fbtee_require(declarator.init.as_deref()) {
            self.mark_fbtee_binding(&declarator.name);
        } else if let Some(enum_map) = self.enum_manifest_from_require(declarator.init.as_deref()) {
            if let Pat::Ident(ident) = &declarator.name {
                self.imported_enums
                    .insert(ident.id.sym.to_string(), enum_map);
            }
        } else {
            self.add_pat_bindings(&declarator.name);
        }
    }

    fn enum_manifest_from_require(&self, expr: Option<&Expr>) -> Option<IndexMap<String, String>> {
        let source = require_source(expr)?;
        let module = enum_manifest_key(&source)?;
        self.options.fbt_enum_manifest.get(&module).cloned()
    }
}

impl VisitMut for FbteeTransform {
    noop_visit_mut_type!();

    fn visit_mut_module(&mut self, module: &mut Module) {
        self.local_bindings.push(BTreeMap::new());
        self.collect_module_bindings(module);
        module.visit_mut_children_with(self);
        let mut specifiers = vec![];
        if self.used_fbt && !self.seen_fbt_import {
            specifiers.push(ImportSpecifier::Named(ImportNamedSpecifier {
                span: DUMMY_SP,
                local: Ident::new_no_ctxt("fbt".into(), DUMMY_SP),
                imported: None,
                is_type_only: false,
            }));
        }
        if self.used_fbs && !self.seen_fbs_import {
            specifiers.push(ImportSpecifier::Named(ImportNamedSpecifier {
                span: DUMMY_SP,
                local: Ident::new_no_ctxt("fbs".into(), DUMMY_SP),
                imported: None,
                is_type_only: false,
            }));
        }
        if !specifiers.is_empty() {
            let index = module_import_insert_index(&module.body);
            module.body.insert(
                index,
                ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
                    span: DUMMY_SP,
                    specifiers,
                    src: Box::new(Str {
                        span: DUMMY_SP,
                        value: Wtf8Atom::new("fbtee"),
                        raw: None,
                    }),
                    type_only: false,
                    with: None,
                    phase: Default::default(),
                })),
            );
        }
        self.local_bindings.pop();
    }

    fn visit_mut_import_decl(&mut self, import: &mut ImportDecl) {
        let source = wtf8_to_string(&import.src.value);
        for specifier in &import.specifiers {
            match specifier {
                ImportSpecifier::Default(default) => {
                    self.mark_imported_binding(&default.local, !import.type_only)
                }
                ImportSpecifier::Named(named) => self
                    .mark_imported_binding(&named.local, !import.type_only && !named.is_type_only),
                ImportSpecifier::Namespace(namespace) => {
                    self.mark_imported_binding(&namespace.local, !import.type_only)
                }
            };
        }
        if let Some(module) = enum_manifest_key(&source) {
            if let Some(enum_map) = self.options.fbt_enum_manifest.get(&module) {
                for specifier in &import.specifiers {
                    match specifier {
                        ImportSpecifier::Default(default) => {
                            self.imported_enums
                                .insert(default.local.sym.to_string(), enum_map.clone());
                        }
                        ImportSpecifier::Named(_) => {}
                        ImportSpecifier::Namespace(namespace) => {
                            self.imported_enums
                                .insert(namespace.local.sym.to_string(), enum_map.clone());
                        }
                    }
                }
            }
        }
    }

    fn visit_mut_expr(&mut self, expr: &mut Expr) {
        if let Some(next) = self.transform_expr(expr) {
            *expr = next;
            return;
        }

        expr.visit_mut_children_with(self);
    }

    fn visit_mut_block_stmt(&mut self, block: &mut BlockStmt) {
        self.local_bindings.push(BTreeMap::new());
        self.collect_block_bindings(block);
        block.visit_mut_children_with(self);
        self.local_bindings.pop();
    }

    fn visit_mut_function(&mut self, function: &mut Function) {
        self.local_bindings.push(BTreeMap::new());
        for param in &function.params {
            self.add_pat_bindings(&param.pat);
        }
        function.visit_mut_children_with(self);
        self.local_bindings.pop();
    }

    fn visit_mut_arrow_expr(&mut self, arrow: &mut ArrowExpr) {
        self.local_bindings.push(BTreeMap::new());
        for param in &arrow.params {
            self.add_pat_bindings(param);
        }
        arrow.visit_mut_children_with(self);
        self.local_bindings.pop();
    }

    fn visit_mut_var_declarator(&mut self, declarator: &mut VarDeclarator) {
        if is_fbtee_require(declarator.init.as_deref()) {
            self.mark_fbtee_binding(&declarator.name);
        } else if let Some(enum_map) = self.enum_manifest_from_require(declarator.init.as_deref()) {
            if let Pat::Ident(ident) = &declarator.name {
                self.imported_enums
                    .insert(ident.id.sym.to_string(), enum_map.clone());
            }
        } else {
            self.add_pat_bindings(&declarator.name);
        }
        declarator.visit_mut_children_with(self);
    }

    fn visit_mut_fn_decl(&mut self, function: &mut FnDecl) {
        self.add_local_binding(function.ident.sym.as_ref());
        function.visit_mut_children_with(self);
    }

    fn visit_mut_class_decl(&mut self, class: &mut ClassDecl) {
        self.add_local_binding(class.ident.sym.as_ref());
        class.visit_mut_children_with(self);
    }

    fn visit_mut_jsx_element(&mut self, element: &mut JSXElement) {
        element.visit_mut_children_with(self);
    }

    fn visit_mut_jsx_element_child(&mut self, child: &mut JSXElementChild) {
        match child {
            JSXElementChild::JSXElement(element) => {
                if let Some(next) = self.transform_jsx_element(element) {
                    *child = JSXElementChild::JSXExprContainer(JSXExprContainer {
                        span: DUMMY_SP,
                        expr: JSXExpr::Expr(Box::new(next)),
                    });
                    return;
                }
                element.visit_mut_children_with(self);
            }
            JSXElementChild::JSXFragment(fragment) => {
                fragment.visit_mut_children_with(self);
            }
            JSXElementChild::JSXExprContainer(container) => {
                container.visit_mut_with(self);
            }
            _ => {}
        }
    }

    fn visit_mut_jsx_expr_container(&mut self, container: &mut JSXExprContainer) {
        if let JSXExpr::Expr(expr) = &mut container.expr {
            if let Some(next) = self.transform_expr(expr) {
                **expr = next;
                return;
            }
        }

        container.visit_mut_children_with(self);
    }
}

impl FbteeTransform {
    fn transform_expr(&mut self, expr: &Expr) -> Option<Expr> {
        match expr {
            Expr::Call(call) => self.transform_call(call),
            Expr::JSXElement(element) => self.transform_jsx_element(element),
            Expr::JSXFragment(fragment) => self.transform_jsx_fragment(fragment),
            _ => None,
        }
    }

    fn transform_call(&mut self, call: &CallExpr) -> Option<Expr> {
        let module = call_module_name(call)?;
        if self.is_shadowed(module) {
            return None;
        }
        let method = call_member_method(call);

        if method == Some("c") {
            return self.transform_common_call(call, module);
        }

        if method.is_some() {
            if method.is_some_and(is_construct_method) {
                compile_error(
                    "fbtee constructs such as fbt.param(...) must be inside an fbt(...) or <fbt> string.",
                );
            }
            return None;
        }

        self.transform_fbt_call(call, module)
    }

    fn transform_common_call(&mut self, call: &CallExpr, module: ModuleName) -> Option<Expr> {
        let label = normalize_spaces(
            &call
                .args
                .first()
                .and_then(arg_as_string)
                .unwrap_or_else(|| {
                    compile_error(&format!(
                        "{}.c(...) needs exactly one text argument.",
                        module.as_str()
                    ))
                }),
            false,
        )
        .trim()
        .to_string();
        let desc = self
            .options
            .fbt_common
            .get(&label)
            .cloned()
            .map(|desc| normalize_spaces(&desc, false).trim().to_string())
            .unwrap_or_else(|| compile_error(&unknown_common_string_message(&label)));

        let phrase = Phrase {
            desc,
            module,
            options: CallOptions {
                project: self.default_project.clone(),
                ..CallOptions::default()
            },
            parts: vec![Part::Text(label)],
        };
        let mut result = self.runtime_call(phrase);
        set_expression_span(&mut result, call.span);
        Some(result)
    }

    fn transform_fbt_call(&mut self, call: &CallExpr, module: ModuleName) -> Option<Expr> {
        let raw_contents = call
            .args
            .first()
            .map(|arg| arg.expr.as_ref())
            .unwrap_or_else(|| {
                compile_error(&format!(
                    "{}(...) needs at least two arguments: text and description.",
                    module.as_str()
                ))
            });
        let mut options = call
            .args
            .get(2)
            .map(|arg| {
                if arg.spread.is_some() {
                    Err("fbtee options cannot be a spread argument".into())
                } else {
                    parse_call_options(&arg.expr)
                }
            })
            .transpose()
            .unwrap_or_else(|error| compile_error(&error))
            .unwrap_or_default();
        if options.project.as_deref().is_none_or(str::is_empty) {
            options.project = self.default_project.clone();
        }
        let desc = normalize_spaces(
            &call.args.get(1).and_then(arg_as_string).unwrap_or_else(|| {
                compile_error(&format!(
                    "{}(...) description must be a string literal.",
                    module.as_str()
                ))
            }),
            options.preserve_whitespace,
        )
        .trim()
        .to_string();
        let parts = self
            .parse_expr_contents(raw_contents, module, &options)
            .unwrap_or_else(|error| compile_error(&error));

        let mut result = self.runtime_call(Phrase {
            desc,
            module,
            options,
            parts,
        });
        set_expression_span(&mut result, call.span);
        Some(result)
    }

    fn transform_jsx_fragment(&mut self, fragment: &JSXFragment) -> Option<Expr> {
        let children = self.jsx_children_to_expr(&fragment.children);
        children.map(Expr::JSXFragment).or_else(|| {
            Some(Expr::JSXFragment(JSXFragment {
                span: fragment.span,
                opening: fragment.opening,
                children: vec![],
                closing: fragment.closing,
            }))
        })
    }

    fn transform_jsx_element(&mut self, element: &JSXElement) -> Option<Expr> {
        let (module, node) = jsx_element_kind(&element.opening.name)?;
        if jsx_children_contain_spread(&element.children) {
            compile_error(&format!(
                "<{}> text cannot contain JSX spread children.",
                module.as_str()
            ));
        }
        if let Some(kind) = node {
            compile_error(&format!(
                "<{}:{kind}> must be inside an <{}> string.",
                module.as_str(),
                module.as_str()
            ));
        }

        let attrs = JsxAttrs::new(&element.opening.attrs);
        attrs
            .validate(&[
                "desc",
                "author",
                "common",
                "doNotExtract",
                "preserveWhitespace",
                "project",
                "subject",
            ])
            .unwrap_or_else(|error| compile_error(&error));
        let is_common = attrs
            .bool_option("common")
            .unwrap_or_else(|error| compile_error(&error))
            .unwrap_or(false);
        attrs
            .bool_option("doNotExtract")
            .unwrap_or_else(|error| compile_error(&error));
        if is_common && attrs.attr("desc").is_some() {
            compile_error(&format!(
                "<{} common> cannot also have a 'desc' attribute. Remove one of them.",
                module.as_str()
            ));
        }
        attrs
            .required_string("author")
            .unwrap_or_else(|error| compile_error(&error));
        let options = CallOptions {
            preserve_whitespace: attrs
                .bool_option("preserveWhitespace")
                .unwrap_or_else(|error| compile_error(&error))
                .unwrap_or(false),
            project: attrs
                .required_string("project")
                .unwrap_or_else(|error| compile_error(&error))
                .filter(|project| !project.is_empty())
                .or_else(|| self.default_project.clone()),
            subject: attrs.expr("subject"),
        };

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
                .unwrap_or_else(|| compile_error(&unknown_common_string_message(&text)))
        } else if let Some(desc) = attrs.string("desc") {
            normalize_spaces(&desc, options.preserve_whitespace)
                .trim()
                .to_string()
        } else {
            compile_error(&format!(
                "<{}> needs one of these attributes: desc, common.",
                module.as_str()
            ))
        };

        let parts = self
            .parse_jsx_children(
                &element.children,
                module,
                &options,
                &element.children,
                false,
            )
            .unwrap_or_else(|error| compile_error(&error));

        Some(self.runtime_call(Phrase {
            desc,
            module,
            options,
            parts,
        }))
    }

    fn parse_expr_contents(
        &mut self,
        expr: &Expr,
        module: ModuleName,
        options: &CallOptions,
    ) -> Result<Vec<Part>, String> {
        self.parse_expr_contents_at(expr, module, options, 0)
    }

    fn parse_expr_contents_at(
        &mut self,
        expr: &Expr,
        module: ModuleName,
        options: &CallOptions,
        implicit_index: usize,
    ) -> Result<Vec<Part>, String> {
        match expr {
            Expr::Lit(Lit::Str(value)) => Ok(vec![Part::Text(normalize_spaces(
                &wtf8_to_string(&value.value),
                options.preserve_whitespace,
            ))]),
            Expr::Array(array) => {
                let mut parts = vec![];
                for elem in &array.elems {
                    let elem = elem.as_ref().ok_or_else(|| {
                        format!(
                            "{} text contains an unsupported array hole.",
                            module.as_str()
                        )
                    })?;
                    if elem.spread.is_some() {
                        return Err(format!(
                            "{} text contains unsupported array spread syntax.",
                            module.as_str()
                        ));
                    }
                    if !is_valid_fbt_array_item(&elem.expr) {
                        return Err(format!(
                            "{} array entries must be individual string literals, JSX elements, or {} constructs.",
                            module.as_str(),
                            module.as_str()
                        ));
                    }
                    parts.extend(self.parse_expr_contents_at(
                        &elem.expr,
                        module,
                        options,
                        implicit_index + parts.len(),
                    )?);
                }
                Ok(parts)
            }
            Expr::Bin(binary) if binary.op == BinaryOp::Add => {
                let mut parts =
                    self.parse_expr_contents_at(&binary.left, module, options, implicit_index)?;
                parts.extend(self.parse_expr_contents_at(
                    &binary.right,
                    module,
                    options,
                    implicit_index + parts.len(),
                )?);
                Ok(parts)
            }
            Expr::Tpl(template) => {
                let mut parts = vec![];
                for (index, quasi) in template.quasis.iter().enumerate() {
                    let cooked = quasi
                        .cooked
                        .as_ref()
                        .map(wtf8_to_string)
                        .unwrap_or_else(|| quasi.raw.to_string());
                    if !cooked.is_empty() {
                        parts.push(Part::Text(normalize_spaces(
                            &cooked,
                            options.preserve_whitespace,
                        )));
                    }
                    if let Some(expr) = template.exprs.get(index) {
                        parts.extend(self.parse_expr_contents_at(
                            expr,
                            module,
                            options,
                            implicit_index + parts.len(),
                        )?);
                    }
                }
                Ok(parts)
            }
            Expr::Call(call) => self.parse_construct_call(call, module, options),
            Expr::JSXElement(element) => {
                if let Some((child_module, None)) = jsx_element_kind(&element.opening.name) {
                    return Err(format!(
                        "Do not put <{}> directly inside <{}>. Remove the inner tag or wrap it in a normal JSX element.",
                        child_module.as_str(),
                        module.as_str()
                    ));
                }
                let (value, nested_parts) = self.implicit_jsx_element_value(
                    element,
                    module,
                    options,
                    &element.children,
                    "",
                )?;
                Ok(vec![Part::Param {
                    name: implicit_param_alias(implicit_index),
                    hash_name: Some(implicit_child_hash_name(
                        &JSXElementChild::JSXElement(element.clone()),
                        options,
                    )),
                    nested: (!nested_parts.is_empty()).then_some(NestedPhrase {
                        target_id: element.span.lo.0,
                    }),
                    nested_parts,
                    value: Box::new(Expr::JSXElement(Box::new(value))),
                    variation: ParamVariation::None,
                    runtime_kind: ParamRuntimeKind::Implicit,
                }])
            }
            Expr::JSXFragment(fragment) => {
                let (value, nested_parts) = self.implicit_jsx_fragment_value(
                    fragment,
                    module,
                    options,
                    &fragment.children,
                    "",
                )?;
                Ok(vec![Part::Param {
                    name: implicit_param_alias(implicit_index),
                    hash_name: Some(implicit_child_hash_name(
                        &JSXElementChild::JSXFragment(fragment.clone()),
                        options,
                    )),
                    nested: (!nested_parts.is_empty()).then_some(NestedPhrase {
                        target_id: fragment.span.lo.0,
                    }),
                    nested_parts,
                    value: Box::new(Expr::JSXFragment(value)),
                    variation: ParamVariation::None,
                    runtime_kind: ParamRuntimeKind::Implicit,
                }])
            }
            Expr::Paren(paren) => {
                self.parse_expr_contents_at(&paren.expr, module, options, implicit_index)
            }
            _ => Err(format!(
                "{} text contains unsupported syntax '{}'. Use text, JSX, or {} constructs.",
                module.as_str(),
                expr_type(expr),
                module.as_str()
            )),
        }
    }

    fn parse_construct_call(
        &mut self,
        call: &CallExpr,
        module: ModuleName,
        _options: &CallOptions,
    ) -> Result<Vec<Part>, String> {
        let Some(method) = call_member_method(call) else {
            return Err(format!(
                "{} text contains an unsupported function call. Wrap dynamic values in {}.param(...).",
                module.as_str(),
                module.as_str()
            ));
        };

        if call_module_name(call) != Some(module) {
            return Err(format!(
                "Do not mix fbt and fbs constructs. Found a different construct inside '{}'.",
                module.as_str()
            ));
        }

        let construct_options = |allowed: &[&str]| -> Result<ObjectOptions, String> {
            match call.args.get(2) {
                Some(argument) if argument.spread.is_some() => {
                    Err("fbtee construct options cannot be a spread argument".into())
                }
                Some(argument) => parse_object_options(&argument.expr, allowed),
                None => Ok(ObjectOptions::default()),
            }
        };

        match method {
            "param" => {
                let options = construct_options(PARAM_OPTIONS)?;
                let name = options.string("name").map_or_else(
                    || {
                        arg_as_string(call.args.first().ok_or_else(|| {
                            format!(
                                "{}.param(...) needs a token name as the first argument.",
                                module.as_str()
                            )
                        })?)
                        .ok_or_else(|| {
                            format!(
                                "{}.param(...) token name must be a string literal.",
                                module.as_str()
                            )
                        })
                    },
                    Ok,
                )?;
                validate_param_name(&name, module)?;
                let mut value = call
                    .args
                    .get(1)
                    .ok_or_else(|| {
                        format!(
                            "{}.param(...) needs a value as the second argument.",
                            module.as_str()
                        )
                    })?
                    .expr
                    .clone();
                value.visit_mut_with(self);
                let number = options.number_expr()?;
                let gender = options.expr("gender");
                if number.is_some() && gender.is_some() {
                    return Err(format!(
                        "{}.param(...) cannot use both 'gender' and 'number' options.",
                        module.as_str()
                    ));
                }
                let variation = if let Some(number) = number {
                    ParamVariation::Number(number)
                } else if let Some(gender) = gender {
                    ParamVariation::Gender(gender)
                } else {
                    ParamVariation::None
                };
                Ok(vec![Part::Param {
                    name,
                    hash_name: None,
                    nested: None,
                    nested_parts: vec![],
                    value,
                    variation,
                    runtime_kind: ParamRuntimeKind::Param,
                }])
            }
            "sameParam" => {
                let name = arg_as_string(call.args.first().ok_or_else(|| {
                    format!("{}.sameParam(...) needs a token name.", module.as_str())
                })?)
                .ok_or_else(|| {
                    format!(
                        "{}.sameParam(...) token name must be a string literal.",
                        module.as_str()
                    )
                })?;
                Ok(vec![Part::SameParam { name }])
            }
            "name" => {
                let name =
                    arg_as_string(call.args.first().ok_or_else(|| {
                        format!("{}.name(...) needs a token name.", module.as_str())
                    })?)
                    .ok_or_else(|| {
                        format!(
                            "{}.name(...) token name must be a string literal.",
                            module.as_str()
                        )
                    })?;
                let mut value = call
                    .args
                    .get(1)
                    .ok_or_else(|| {
                        format!(
                            "{}.name(...) needs a value as the second argument.",
                            module.as_str()
                        )
                    })?
                    .expr
                    .clone();
                value.visit_mut_with(self);
                let gender = call
                    .args
                    .get(2)
                    .ok_or_else(|| {
                        format!(
                            "{}.name(...) needs a gender as the third argument.",
                            module.as_str()
                        )
                    })?
                    .expr
                    .clone();
                Ok(vec![Part::Name {
                    name,
                    value,
                    gender,
                }])
            }
            "enum" => {
                let value = call
                    .args
                    .first()
                    .ok_or_else(|| {
                        format!(
                            "{}.enum(...) needs a value as the first argument.",
                            module.as_str()
                        )
                    })?
                    .expr
                    .clone();
                let range_expr = call
                    .args
                    .get(1)
                    .ok_or_else(|| {
                        format!(
                            "{}.enum(...) needs a range as the second argument.",
                            module.as_str()
                        )
                    })?
                    .expr
                    .clone();
                let range = self.enum_range_from_expr(&range_expr)?;
                Ok(vec![Part::Enum {
                    value,
                    range_expr,
                    range,
                }])
            }
            "plural" => {
                let singular = arg_as_string(call.args.first().ok_or_else(|| {
                    format!("{}.plural(...) needs singular text.", module.as_str())
                })?)
                .ok_or_else(|| {
                    format!(
                        "{}.plural(...) singular text must be a string literal.",
                        module.as_str()
                    )
                })?;
                let count = call
                    .args
                    .get(1)
                    .ok_or_else(|| {
                        format!(
                            "{}.plural(...) needs a count as the second argument.",
                            module.as_str()
                        )
                    })?
                    .expr
                    .clone();
                let options = construct_options(PLURAL_OPTIONS)?;
                let many = if !options.contains("many") {
                    format!("{singular}s")
                } else if let Some(many) = options.string("many") {
                    many
                } else if let Some(many) = options.expr("many") {
                    expr_as_string(&many)
                        .ok_or("`many` option must be a statically evaluable string.")?
                } else {
                    return Err("`many` option must be a string.".into());
                };
                let show_count = options
                    .required_string("showCount")?
                    .unwrap_or_else(|| "no".to_string());
                validate_option_value("showCount", &show_count, &["ifMany", "no", "yes"])?;
                let name = options.string("name").or_else(|| {
                    if show_count == "yes" || show_count == "ifMany" {
                        Some("number".to_string())
                    } else {
                        None
                    }
                });
                Ok(vec![Part::Plural {
                    singular,
                    count,
                    many,
                    show_count,
                    name,
                    value: options.expr("value").map(|mut value| {
                        value.visit_mut_with(self);
                        value
                    }),
                }])
            }
            "pronoun" => {
                let usage = arg_as_string(call.args.first().ok_or_else(|| {
                    format!(
                        "{}.pronoun(...) needs a usage as the first argument.",
                        module.as_str()
                    )
                })?)
                .ok_or_else(|| {
                    format!(
                        "{}.pronoun(...) usage must be a string literal.",
                        module.as_str()
                    )
                })?;
                validate_pronoun_usage(&usage, module)?;
                let gender = call
                    .args
                    .get(1)
                    .ok_or_else(|| {
                        format!(
                            "{}.pronoun(...) needs a gender as the second argument.",
                            module.as_str()
                        )
                    })?
                    .expr
                    .clone();
                let options = construct_options(PRONOUN_OPTIONS)?;
                Ok(vec![Part::Pronoun {
                    usage,
                    gender,
                    human: options.bool_option("human")?.unwrap_or(false),
                    capitalize: options.bool_option("capitalize")?.unwrap_or(false),
                }])
            }
            "list" => {
                let name =
                    arg_as_string(call.args.first().ok_or_else(|| {
                        format!("{}.list(...) needs a token name.", module.as_str())
                    })?)
                    .ok_or_else(|| {
                        format!(
                            "{}.list(...) token name must be a string literal.",
                            module.as_str()
                        )
                    })?;
                let mut items = call
                    .args
                    .get(1)
                    .ok_or_else(|| {
                        format!(
                            "{}.list(...) needs items as the second argument.",
                            module.as_str()
                        )
                    })?
                    .expr
                    .clone();
                items.visit_mut_with(self);
                let conjunction = call
                    .args
                    .get(2)
                    .filter(|argument| !matches!(argument.expr.as_ref(), Expr::Lit(Lit::Null(_))))
                    .map(|argument| argument.expr.clone());
                let delimiter = call
                    .args
                    .get(3)
                    .filter(|argument| !matches!(argument.expr.as_ref(), Expr::Lit(Lit::Null(_))))
                    .map(|argument| argument.expr.clone());
                Ok(vec![Part::List {
                    name,
                    items,
                    conjunction,
                    delimiter,
                }])
            }
            _ => Err(format!(
                "Unsupported {} construct '{}'.",
                module.as_str(),
                method
            )),
        }
    }

    fn parse_jsx_children(
        &mut self,
        children: &[JSXElementChild],
        module: ModuleName,
        options: &CallOptions,
        description_children: &[JSXElementChild],
        implicit_context: bool,
    ) -> Result<Vec<Part>, String> {
        let mut parts = vec![];
        let mut implicit_child_index = 0;
        let mut last_implicit_child_was_text = false;
        let mut pending_implicit_whitespace = false;
        for (child_index, child) in children.iter().enumerate() {
            match child {
                JSXElementChild::JSXText(text) => {
                    if implicit_context {
                        let whitespace_only = text.value.trim().is_empty();
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
                    let normalized = if options.preserve_whitespace {
                        if implicit_context {
                            text.value.to_string()
                        } else {
                            clean_jsx_text(text.value.as_ref())
                        }
                    } else {
                        normalize_spaces(text.value.as_ref(), false)
                    };
                    if !normalized.trim().is_empty() {
                        parts.push(Part::Text(normalized));
                    }
                }
                JSXElementChild::JSXExprContainer(container) => match &container.expr {
                    JSXExpr::Expr(expr) => {
                        let parsed = self.parse_expr_contents(expr, module, options)?;
                        if implicit_context {
                            implicit_child_index += parsed.len();
                            last_implicit_child_was_text = false;
                            pending_implicit_whitespace = false;
                        }
                        parts.extend(parsed);
                    }
                    JSXExpr::JSXEmptyExpr(_) => {}
                },
                JSXElementChild::JSXElement(element) => {
                    match jsx_element_kind(&element.opening.name) {
                        Some((child_module, Some(kind))) => {
                            if child_module != module {
                                return Err(format!(
                                    "Do not mix fbt and fbs JSX namespaces. Found a different construct inside '<{}>'.",
                                    module.as_str()
                                ));
                            }
                            let parsed =
                                self.parse_jsx_construct(element, module, kind, options)?;
                            if implicit_context {
                                implicit_child_index += parsed.len();
                                last_implicit_child_was_text = false;
                                pending_implicit_whitespace = false;
                            }
                            parts.extend(parsed);
                        }
                        Some((child_module, None)) => {
                            return Err(format!(
                                "Do not put <{}> directly inside <{}>. Remove the inner tag or wrap it in a normal JSX element.",
                                child_module.as_str(),
                                module.as_str()
                            ));
                        }
                        None => {
                            let token = implicit_param_alias(if implicit_context {
                                implicit_child_index
                            } else {
                                parts.len()
                            });
                            let description_text = jsx_description_text_for_target(
                                description_children,
                                element,
                                options,
                            );
                            let (value, nested_parts) = self.implicit_jsx_element_value(
                                element,
                                module,
                                options,
                                description_children,
                                &description_text,
                            )?;
                            parts.push(Part::Param {
                                name: token,
                                hash_name: Some(implicit_child_hash_name(
                                    &JSXElementChild::JSXElement(element.clone()),
                                    options,
                                )),
                                nested: (!nested_parts.is_empty()).then_some(NestedPhrase {
                                    target_id: element.span.lo.0,
                                }),
                                nested_parts,
                                value: Box::new(Expr::JSXElement(Box::new(value))),
                                variation: ParamVariation::None,
                                runtime_kind: ParamRuntimeKind::Implicit,
                            });
                            if implicit_context {
                                implicit_child_index += 1;
                                last_implicit_child_was_text = false;
                                pending_implicit_whitespace = false;
                            }
                        }
                    }
                }
                JSXElementChild::JSXFragment(fragment) => {
                    let token = implicit_param_alias(if implicit_context {
                        implicit_child_index
                    } else {
                        parts.len()
                    });
                    let (value, nested_parts) = self.implicit_jsx_fragment_value(
                        fragment,
                        module,
                        options,
                        description_children,
                        &jsx_description_text(description_children, options),
                    )?;
                    parts.push(Part::Param {
                        name: token,
                        hash_name: Some(implicit_child_hash_name(child, options)),
                        nested: (!nested_parts.is_empty()).then_some(NestedPhrase {
                            target_id: fragment.span.lo.0,
                        }),
                        nested_parts,
                        value: Box::new(Expr::JSXFragment(value)),
                        variation: ParamVariation::None,
                        runtime_kind: ParamRuntimeKind::Implicit,
                    });
                    if implicit_context {
                        implicit_child_index += 1;
                        last_implicit_child_was_text = false;
                        pending_implicit_whitespace = false;
                    }
                }
                JSXElementChild::JSXSpreadChild(_) => {
                    return Err(format!(
                        "<{}> text cannot contain JSX spread children.",
                        module.as_str()
                    ));
                }
            }
        }
        Ok(compact_text_parts(parts))
    }

    fn implicit_jsx_element_value(
        &mut self,
        element: &JSXElement,
        module: ModuleName,
        options: &CallOptions,
        _description_children: &[JSXElementChild],
        _description_text: &str,
    ) -> Result<(JSXElement, Vec<Part>), String> {
        let nested_parts =
            self.parse_jsx_children(&element.children, module, options, &element.children, true)?;
        let mut element = element.clone();
        element.opening.visit_mut_children_with(self);
        if nested_parts.is_empty() {
            element.children.visit_mut_with(self);
        } else {
            element.children.clear();
        }
        Ok((element, nested_parts))
    }

    fn implicit_jsx_fragment_value(
        &mut self,
        fragment: &JSXFragment,
        module: ModuleName,
        options: &CallOptions,
        _description_children: &[JSXElementChild],
        _description_text: &str,
    ) -> Result<(JSXFragment, Vec<Part>), String> {
        let nested_parts = self.parse_jsx_children(
            &fragment.children,
            module,
            options,
            &fragment.children,
            true,
        )?;
        let mut fragment = fragment.clone();
        if nested_parts.is_empty() {
            fragment.children.visit_mut_with(self);
        } else {
            fragment.children.clear();
        }
        Ok((fragment, nested_parts))
    }

    fn parse_jsx_construct(
        &mut self,
        element: &JSXElement,
        module: ModuleName,
        kind: String,
        options: &CallOptions,
    ) -> Result<Vec<Part>, String> {
        let attrs = JsxAttrs::new(&element.opening.attrs);
        match kind.as_str() {
            "param" => {
                attrs.validate(PARAM_OPTIONS)?;
                let name = normalize_jsx_param_name(&attrs.string("name").ok_or_else(|| {
                    format!("<{}:param> needs attribute 'name'.", module.as_str())
                })?);
                validate_param_name(&name, module)?;
                let value = self.jsx_param_value(&element.children, module)?;
                let number = attrs.number_expr("number")?;
                let gender = attrs.expr("gender");
                if number.is_some() && gender.is_some() {
                    return Err(format!(
                        "<{}:param> cannot use both 'gender' and 'number' attributes.",
                        module.as_str()
                    ));
                }
                let variation = if let Some(number) = number {
                    ParamVariation::Number(number)
                } else if let Some(gender) = gender {
                    ParamVariation::Gender(gender)
                } else {
                    ParamVariation::None
                };
                Ok(vec![Part::Param {
                    name,
                    hash_name: None,
                    nested: None,
                    nested_parts: vec![],
                    value: Box::new(value),
                    variation,
                    runtime_kind: ParamRuntimeKind::Param,
                }])
            }
            "same-param" | "sameParam" => {
                require_self_closing(element, module, "same-param")?;
                let name = attrs.string("name").ok_or_else(|| {
                    format!("<{}:same-param> needs attribute 'name'.", module.as_str())
                })?;
                Ok(vec![Part::SameParam { name }])
            }
            "name" => {
                let name = attrs
                    .string("name")
                    .ok_or_else(|| format!("<{}:name> needs attribute 'name'.", module.as_str()))?;
                let value = self.jsx_name_value(&element.children, module)?;
                let gender = attrs.expr("gender").ok_or_else(|| {
                    format!("<{}:name> needs attribute 'gender'.", module.as_str())
                })?;
                Ok(vec![Part::Name {
                    name,
                    value: Box::new(value),
                    gender,
                }])
            }
            "enum" => {
                require_self_closing(element, module, "enum")?;
                let value = attrs.expr("value").ok_or_else(|| {
                    format!("<{}:enum> needs attribute 'value'.", module.as_str())
                })?;
                let range_expr = attrs.expr("enum-range").ok_or_else(|| {
                    format!("<{}:enum> needs attribute 'enum-range'.", module.as_str())
                })?;
                let range = self.enum_range_from_expr(&range_expr)?;
                Ok(vec![Part::Enum {
                    value,
                    range_expr,
                    range,
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
                let count = attrs.expr("count").ok_or_else(|| {
                    format!("<{}:plural> needs attribute 'count'.", module.as_str())
                })?;
                let many = attrs
                    .string("many")
                    .unwrap_or_else(|| format!("{singular}s"));
                let show_count = attrs
                    .required_string("showCount")?
                    .unwrap_or_else(|| "no".to_string());
                validate_option_value("showCount", &show_count, &["ifMany", "no", "yes"])?;
                let name = attrs
                    .string("name")
                    .filter(|name| !name.is_empty())
                    .map(|name| normalize_jsx_param_name(&name))
                    .or_else(|| {
                        if show_count == "yes" || show_count == "ifMany" {
                            Some("number".to_string())
                        } else {
                            None
                        }
                    });
                Ok(vec![Part::Plural {
                    singular,
                    count,
                    many,
                    show_count,
                    name,
                    value: attrs.expr("value").map(|mut value| {
                        value.visit_mut_with(self);
                        value
                    }),
                }])
            }
            "pronoun" => {
                require_self_closing(element, module, "pronoun")?;
                attrs.validate(&["type", "gender", "capitalize", "human"])?;
                let usage = attrs.string("type").ok_or_else(|| {
                    format!("<{}:pronoun> needs attribute 'type'.", module.as_str())
                })?;
                validate_pronoun_usage(&usage, module)?;
                let gender = attrs.expr("gender").ok_or_else(|| {
                    format!("<{}:pronoun> needs attribute 'gender'.", module.as_str())
                })?;
                Ok(vec![Part::Pronoun {
                    usage,
                    gender,
                    human: attrs.bool_option("human")?.unwrap_or(false),
                    capitalize: attrs.bool_option("capitalize")?.unwrap_or(false),
                }])
            }
            "list" => {
                require_self_closing(element, module, "list")?;
                let name = attrs
                    .string("name")
                    .ok_or_else(|| format!("<{}:list> needs attribute 'name'.", module.as_str()))?;
                let mut items = attrs.expr("items").ok_or_else(|| {
                    format!("<{}:list> needs attribute 'items'.", module.as_str())
                })?;
                items.visit_mut_with(self);
                Ok(vec![Part::List {
                    name,
                    items,
                    conjunction: attrs.expr("conjunction"),
                    delimiter: attrs.expr("delimiter"),
                }])
            }
            _ => Err(format!(
                "Unsupported JSX {} construct '{}'.",
                module.as_str(),
                kind
            )),
        }
    }

    fn jsx_children_to_expr(&mut self, children: &[JSXElementChild]) -> Option<JSXFragment> {
        let mut transformed = vec![];
        for child in children {
            let next = match child {
                JSXElementChild::JSXExprContainer(container) => {
                    if let JSXExpr::Expr(expr) = &container.expr {
                        let mut expr = expr.clone();
                        if let Some(next) = self.transform_expr(&expr) {
                            *expr = next;
                        } else {
                            expr.visit_mut_children_with(self);
                        }
                        JSXElementChild::JSXExprContainer(JSXExprContainer {
                            span: container.span,
                            expr: JSXExpr::Expr(expr),
                        })
                    } else {
                        child.clone()
                    }
                }
                JSXElementChild::JSXElement(element) => {
                    if let Some(next) = self.transform_jsx_element(element) {
                        JSXElementChild::JSXExprContainer(JSXExprContainer {
                            span: DUMMY_SP,
                            expr: JSXExpr::Expr(Box::new(next)),
                        })
                    } else {
                        let mut element = element.clone();
                        element.visit_mut_children_with(self);
                        JSXElementChild::JSXElement(element)
                    }
                }
                JSXElementChild::JSXFragment(fragment) => {
                    let mut fragment = fragment.clone();
                    fragment.visit_mut_children_with(self);
                    JSXElementChild::JSXFragment(fragment)
                }
                _ => child.clone(),
            };
            transformed.push(next);
        }

        Some(JSXFragment {
            span: DUMMY_SP,
            opening: JSXOpeningFragment { span: DUMMY_SP },
            children: transformed,
            closing: JSXClosingFragment { span: DUMMY_SP },
        })
    }

    fn jsx_param_value(
        &mut self,
        children: &[JSXElementChild],
        module: ModuleName,
    ) -> Result<Expr, String> {
        if let [JSXElementChild::JSXText(text)] = children {
            if text.value == " " {
                return Ok(string_expr(" ".to_string()));
            }
        }
        let meaningful: Vec<&JSXElementChild> = children
            .iter()
            .filter(|child| match child {
                JSXElementChild::JSXExprContainer(container) => {
                    !matches!(container.expr, JSXExpr::JSXEmptyExpr(_))
                }
                JSXElementChild::JSXElement(_) | JSXElementChild::JSXFragment(_) => true,
                _ => false,
            })
            .collect();
        if meaningful.len() != 1 {
            return Err(format!(
                "<{}:param> needs exactly one child: an expression or JSX element.",
                module.as_str()
            ));
        }
        let mut expr = match meaningful[0] {
            JSXElementChild::JSXExprContainer(container) => match &container.expr {
                JSXExpr::Expr(expr) => *expr.clone(),
                JSXExpr::JSXEmptyExpr(_) => unreachable!("validated JSX param expression"),
            },
            JSXElementChild::JSXElement(element) => Expr::JSXElement(element.clone()),
            JSXElementChild::JSXFragment(fragment) => Expr::JSXFragment(fragment.clone()),
            _ => unreachable!("validated JSX param child"),
        };
        if let Some(next) = self.transform_expr(&expr) {
            expr = next;
        } else {
            expr.visit_mut_children_with(self);
        }
        Ok(expr)
    }

    fn jsx_name_value(
        &mut self,
        children: &[JSXElementChild],
        module: ModuleName,
    ) -> Result<Expr, String> {
        let meaningful: Vec<&JSXElementChild> = children
            .iter()
            .filter(|child| match child {
                JSXElementChild::JSXText(text) => {
                    !normalize_spaces(&text.value, false).trim().is_empty()
                }
                JSXElementChild::JSXExprContainer(container) => {
                    !matches!(container.expr, JSXExpr::JSXEmptyExpr(_))
                }
                _ => false,
            })
            .collect();
        if meaningful.len() != 1 {
            return Err(format!(
                "<{}:name> needs exactly one child: text or an expression.",
                module.as_str()
            ));
        }
        match meaningful[0] {
            JSXElementChild::JSXText(text) => Ok(string_expr(normalize_spaces(&text.value, false))),
            JSXElementChild::JSXExprContainer(container) => match &container.expr {
                JSXExpr::Expr(expr) => {
                    let mut expr = expr.clone();
                    if let Some(next) = self.transform_expr(&expr) {
                        *expr = next;
                    } else {
                        expr.visit_mut_children_with(self);
                    }
                    Ok(*expr)
                }
                JSXExpr::JSXEmptyExpr(_) => unreachable!("validated JSX name expression"),
            },
            _ => unreachable!("validated JSX name child"),
        }
    }

    fn enum_range_from_expr(&self, expr: &Expr) -> Result<Vec<(String, String)>, String> {
        let range = match unwrap_parens(expr) {
            Expr::Array(array) => {
                let mut range = IndexMap::new();
                for element in &array.elems {
                    let element = element
                        .as_ref()
                        .ok_or("Enum values must be string literals.")?;
                    if element.spread.is_some() {
                        return Err("Enum values must be string literals.".into());
                    }
                    let value = string_literal_value(&element.expr)
                        .ok_or("Enum values must be string literals.")?;
                    range.insert(value.clone(), value);
                }
                range
            }
            Expr::Object(object) => {
                let mut range = IndexMap::new();
                for prop in &object.props {
                    let (key, value) = match prop {
                    PropOrSpread::Prop(prop) => match prop.as_ref() {
                        Prop::KeyValue(key_value) => {
                            let key = prop_name_to_string(&key_value.key)
                                .ok_or("Enum object keys must be strings, numbers, or identifiers.")?;
                            let value = string_literal_value(&key_value.value)
                                .ok_or("Enum object values must be string literals.")?;
                            (key, value)
                        }
                        _ => return Err("Enum entries must be plain object properties. Remove methods and spread properties.".to_string()),
                    },
                    PropOrSpread::Spread(_) => return Err("Enum entries cannot use spread properties.".to_string()),
                    };
                    range.insert(key, value);
                }
                range
            }
            Expr::Ident(ident) => self
                .imported_enums
                .get(&ident.sym.to_string())
                .cloned()
                .ok_or_else(|| format!("Enum '{}' is not registered. Import an '$FbtEnum' module or add it to the enum manifest.", ident.sym))?,
            _ => Err(format!(
                "Enum range must be an array, object, or imported enum variable. Received '{}'.",
                expr_type(expr)
            ))?,
        };
        if range.is_empty() {
            return Err("Enum range cannot be empty.".into());
        }
        Ok(js_property_order(range))
    }

    fn runtime_call(&mut self, phrase: Phrase) -> Expr {
        self.runtime_call_impl(phrase, true)
    }

    fn runtime_call_impl(&mut self, phrase: Phrase, validate: bool) -> Expr {
        if validate {
            validate_phrase(&phrase).unwrap_or_else(|error| compile_error(&error));
        }
        match phrase.module {
            ModuleName::Fbt => self.used_fbt = true,
            ModuleName::Fbs => self.used_fbs = true,
        }
        let module_ident = self.module_ident(phrase.module);
        let mut global_variations = Vec::new();
        collect_variation_parts(&phrase.parts, &mut global_variations);
        let mut shared_values = Vec::new();
        if let Some(subject) = &phrase.options.subject {
            shared_values.push(runtime_helper(
                &module_ident,
                "_subject",
                vec![*subject.clone()],
            ));
        }
        shared_values.extend(
            global_variations
                .iter()
                .filter_map(|part| runtime_arg_expr(&module_ident, part)),
        );

        let needs_temporaries = !shared_values.is_empty() && contains_nested_phrase(&phrase.parts);
        let shared_args = if needs_temporaries {
            let used_identifiers = phrase_identifiers(&phrase);
            let mut prefix = "__fbtee_shared".to_string();
            while used_identifiers
                .iter()
                .any(|identifier| identifier.starts_with(&format!("{prefix}_")))
            {
                prefix.push('_');
            }
            (0..shared_values.len())
                .map(|index| {
                    Expr::Ident(Ident::new_no_ctxt(
                        format!("{prefix}_{index}").into(),
                        DUMMY_SP,
                    ))
                })
                .collect::<Vec<_>>()
        } else {
            shared_values.clone()
        };
        let runtime = render_runtime_call(
            &phrase,
            &module_ident,
            &global_variations,
            &shared_args,
            &phrase.parts,
            None,
        );
        if !needs_temporaries {
            return runtime;
        }

        Expr::Call(CallExpr {
            span: DUMMY_SP,
            ctxt: Default::default(),
            callee: Callee::Expr(Box::new(Expr::Arrow(ArrowExpr {
                span: DUMMY_SP,
                ctxt: Default::default(),
                params: shared_args
                    .iter()
                    .map(|expression| match expression {
                        Expr::Ident(ident) => Pat::Ident(BindingIdent {
                            id: ident.clone(),
                            type_ann: None,
                        }),
                        _ => unreachable!("shared argument must be an identifier"),
                    })
                    .collect(),
                body: Box::new(BlockStmtOrExpr::Expr(Box::new(runtime))),
                is_async: false,
                is_generator: false,
                type_params: None,
                return_type: None,
            }))),
            args: shared_values
                .into_iter()
                .map(|expr| ExprOrSpread {
                    spread: None,
                    expr: Box::new(expr),
                })
                .collect(),
            type_args: None,
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ModuleName {
    Fbt,
    Fbs,
}

impl ModuleName {
    fn as_str(self) -> &'static str {
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
}

#[derive(Clone, Default)]
struct CallOptions {
    preserve_whitespace: bool,
    project: Option<String>,
    subject: Option<Box<Expr>>,
}

#[derive(Clone)]
struct NestedPhrase {
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
        value: Box<Expr>,
        variation: ParamVariation,
        runtime_kind: ParamRuntimeKind,
    },
    SameParam {
        name: String,
    },
    Name {
        name: String,
        value: Box<Expr>,
        gender: Box<Expr>,
    },
    Enum {
        value: Box<Expr>,
        range_expr: Box<Expr>,
        range: Vec<(String, String)>,
    },
    Plural {
        singular: String,
        count: Box<Expr>,
        many: String,
        show_count: String,
        name: Option<String>,
        value: Option<Box<Expr>>,
    },
    Pronoun {
        usage: String,
        gender: Box<Expr>,
        human: bool,
        capitalize: bool,
    },
    List {
        name: String,
        items: Box<Expr>,
        conjunction: Option<Box<Expr>>,
        delimiter: Option<Box<Expr>>,
    },
}

#[derive(Clone)]
enum ParamVariation {
    None,
    Number(Option<Box<Expr>>),
    Gender(Box<Expr>),
}

#[derive(Clone, Copy)]
enum ParamRuntimeKind {
    Param,
    Implicit,
}

fn validate_phrase(phrase: &Phrase) -> Result<(), String> {
    if let Some(subject) = &phrase.options.subject {
        validate_variation_expression(subject, "subject")?;
    }
    validate_variation_parts(&phrase.parts)?;
    validate_compatible_variation_groups(&phrase.parts, &mut BTreeMap::new())?;
    let mut variations = Vec::new();
    collect_variation_parts(&phrase.parts, &mut variations);
    RuntimeBuilder::new(phrase, &variations, &phrase.parts, None).validate_dynamic_tokens()?;
    validate_local_tokens(&phrase.parts, phrase.module)?;
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
                phrase.module.as_str(),
                phrase.module.as_str(),
                phrase.module.as_str()
            ));
        }
    }
    Ok(())
}

#[derive(Default)]
struct ForbiddenVariationVisitor {
    found: bool,
}

impl Visit for ForbiddenVariationVisitor {
    fn visit_call_expr(&mut self, _: &CallExpr) {
        self.found = true;
    }

    fn visit_new_expr(&mut self, _: &NewExpr) {
        self.found = true;
    }
}

fn validate_variation_expression(expression: &Expr, label: &str) -> Result<(), String> {
    let mut visitor = ForbiddenVariationVisitor::default();
    expression.visit_with(&mut visitor);
    if visitor.found {
        Err(format!(
            "The {label} variation value cannot contain a function call or class instantiation."
        ))
    } else {
        Ok(())
    }
}

fn validate_variation_parts(parts: &[Part]) -> Result<(), String> {
    for part in parts {
        match part {
            Part::Param {
                value,
                variation: ParamVariation::Number(number),
                ..
            } => validate_variation_expression(number.as_deref().unwrap_or(value), "number")?,
            Part::Param {
                variation: ParamVariation::Gender(gender),
                ..
            }
            | Part::Name { gender, .. }
            | Part::Pronoun { gender, .. } => validate_variation_expression(gender, "gender")?,
            Part::Enum { value, .. } => validate_variation_expression(value, "enum")?,
            Part::Plural { count, .. } => validate_variation_expression(count, "plural")?,
            _ => {}
        }
        if let Part::Param { nested_parts, .. } = part {
            validate_variation_parts(nested_parts)?;
        }
    }
    Ok(())
}

fn validate_compatible_variation_groups(
    parts: &[Part],
    groups: &mut BTreeMap<String, Vec<String>>,
) -> Result<(), String> {
    for part in parts {
        if let Part::Enum { range, .. } = part {
            if let Some(group) = variation_group(part) {
                let keys = range.iter().map(|(key, _)| key.clone()).collect::<Vec<_>>();
                if let Some(previous) = groups.get(&group) {
                    if previous != &keys {
                        return Err(
                            "Enum constructs sharing a value must use compatible ranges.".into(),
                        );
                    }
                } else {
                    groups.insert(group, keys);
                }
            }
        }
        if let Part::Param { nested_parts, .. } = part {
            validate_compatible_variation_groups(nested_parts, groups)?;
        }
    }
    Ok(())
}

fn validate_param_name(name: &str, module: ModuleName) -> Result<(), String> {
    if name.is_empty() {
        Err(format!(
            "{}.param(...) token name must not be empty.",
            module.as_str()
        ))
    } else {
        Ok(())
    }
}

fn require_self_closing(
    element: &JSXElement,
    module: ModuleName,
    construct: &str,
) -> Result<(), String> {
    if element.closing.is_some() {
        Err(format!(
            "<{}:{construct}> must be self-closing.",
            module.as_str()
        ))
    } else {
        Ok(())
    }
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
                        module.as_str()
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
            module.as_str(),
            module.as_str()
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
                    module.as_str(),
                    module.as_str()
                ));
            }
            if reusable {
                same_param_targets.insert(token.clone());
            }
        }
    }
    Ok(())
}

struct RuntimeBuilder<'a, 'v> {
    phrase: &'a Phrase,
    global_variations: &'v [&'v Part],
    root_parts: &'v [Part],
    description_target: Option<u32>,
}

#[derive(Clone)]
struct Variation {
    index: usize,
    keys: Vec<String>,
    group: Option<String>,
}

fn variation_group(part: &Part) -> Option<String> {
    match part {
        Part::Param {
            value,
            variation: ParamVariation::Number(_),
            ..
        } => Some(format!("number-param:{}", expr_group_key(value))),
        Part::Param {
            variation: ParamVariation::Gender(gender),
            ..
        } => Some(format!("gender-param:{}", expr_group_key(gender))),
        Part::Name { gender, .. } => Some(format!("gender-param:{}", expr_group_key(gender))),
        Part::Enum { value, .. } => Some(format!("enum:{}", expr_group_key(value))),
        Part::Plural { count, .. } => Some(format!("plural:{}", expr_group_key(count))),
        Part::Pronoun { gender, .. } => Some(format!("pronoun:{}", expr_group_key(gender))),
        _ => None,
    }
}

fn expr_group_key(expr: &Expr) -> String {
    match expr {
        Expr::Ident(ident) => format!("id:{}", ident.sym),
        Expr::This(_) => "this".to_string(),
        Expr::Lit(Lit::Str(value)) => format!("str:{}", wtf8_to_string(&value.value)),
        Expr::Lit(Lit::Num(value)) => format!("num:{}", value.value),
        Expr::Lit(Lit::Bool(value)) => format!("bool:{}", value.value),
        Expr::Member(member) => format!(
            "member:{}:{}",
            expr_group_key(&member.obj),
            match &member.prop {
                MemberProp::Ident(ident) => ident.sym.to_string(),
                MemberProp::PrivateName(name) => name.name.to_string(),
                MemberProp::Computed(computed) => expr_group_key(&computed.expr),
            }
        ),
        Expr::Paren(paren) => expr_group_key(&paren.expr),
        _ => format!("{expr:?}"),
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
        let repeated_enum = matches!(part, Part::Enum { .. })
            && variation_group(part).is_some_and(|group| !used_enums.insert(group));
        if is_variation_part(part) && !repeated_enum {
            output.push(part);
        }
        if let Part::Param { nested_parts, .. } = part {
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
                runtime_kind: ParamRuntimeKind::Implicit,
                ..
            }
        )
    })
}

#[derive(Default)]
struct IdentifierCollector {
    names: BTreeSet<String>,
}

impl Visit for IdentifierCollector {
    fn visit_ident(&mut self, identifier: &Ident) {
        self.names.insert(identifier.sym.to_string());
    }
}

fn phrase_identifiers(phrase: &Phrase) -> BTreeSet<String> {
    let mut collector = IdentifierCollector::default();
    if let Some(subject) = &phrase.options.subject {
        subject.visit_with(&mut collector);
    }
    collect_part_identifiers(&phrase.parts, &mut collector);
    collector.names
}

fn collect_part_identifiers(parts: &[Part], collector: &mut IdentifierCollector) {
    for part in parts {
        match part {
            Part::Param {
                value,
                variation,
                nested_parts,
                ..
            } => {
                value.visit_with(collector);
                match variation {
                    ParamVariation::Number(Some(number)) => number.visit_with(collector),
                    ParamVariation::Gender(gender) => gender.visit_with(collector),
                    ParamVariation::Number(None) | ParamVariation::None => {}
                }
                collect_part_identifiers(nested_parts, collector);
            }
            Part::Name { value, gender, .. } => {
                value.visit_with(collector);
                gender.visit_with(collector);
            }
            Part::Enum {
                value, range_expr, ..
            } => {
                value.visit_with(collector);
                range_expr.visit_with(collector);
            }
            Part::Plural { count, value, .. } => {
                count.visit_with(collector);
                if let Some(value) = value {
                    value.visit_with(collector);
                }
            }
            Part::Pronoun { gender, .. } => gender.visit_with(collector),
            Part::List {
                items,
                conjunction,
                delimiter,
                ..
            } => {
                items.visit_with(collector);
                if let Some(conjunction) = conjunction {
                    conjunction.visit_with(collector);
                }
                if let Some(delimiter) = delimiter {
                    delimiter.visit_with(collector);
                }
            }
            Part::Text(_) | Part::SameParam { .. } => {}
        }
    }
}

fn nested_parts_contain_target(parts: &[Part], target: u32) -> bool {
    parts.iter().any(|part| match part {
        Part::Param {
            nested: Some(nested),
            nested_parts,
            ..
        } => nested.target_id == target || nested_parts_contain_target(nested_parts, target),
        _ => false,
    })
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
            return RuntimeNode::String(self.pattern(&[], false));
        }
        self.branch(&variations, 0, &mut vec![])
    }

    fn hash_tree(&self) -> HashNode {
        let variations = self.variations();
        if variations.is_empty() {
            return self.hash_leaf(&[]);
        }
        self.hash_branch(&variations, 0, &mut vec![])
    }

    fn variations(&self) -> Vec<Variation> {
        let mut variations = vec![];
        if self.phrase.options.subject.is_some() {
            variations.push(Variation {
                index: usize::MAX,
                keys: vec!["*".to_string()],
                group: Some("subject".to_string()),
            });
        }
        for (index, part) in self.global_variations.iter().enumerate() {
            let keys = match *part {
                Part::Param {
                    variation: ParamVariation::Number(_),
                    ..
                } => vec!["*".to_string()],
                Part::Param {
                    variation: ParamVariation::Gender(_),
                    ..
                }
                | Part::Name { .. } => vec!["*".to_string()],
                Part::Enum { range, .. } => range.iter().map(|(key, _)| key.clone()).collect(),
                Part::Plural { .. } => vec!["*".to_string(), "_1".to_string()],
                Part::Pronoun { usage, human, .. } => pronoun_candidates(usage, *human)
                    .into_iter()
                    .map(|(key, _)| key)
                    .collect(),
                _ => vec![],
            };
            if !keys.is_empty() {
                variations.push(Variation {
                    index,
                    keys,
                    group: variation_group(part),
                });
            }
        }
        variations
    }

    fn branch(
        &self,
        variations: &[Variation],
        depth: usize,
        selected: &mut Vec<(usize, String)>,
    ) -> RuntimeNode {
        if depth == variations.len() {
            return RuntimeNode::String(self.pattern(selected, false));
        }

        let variation = &variations[depth];
        let mut items = vec![];
        let keys = Self::keys(variations, depth, selected);
        for key in keys {
            selected.push((variation.index, key.clone()));
            items.push((key.clone(), self.branch(variations, depth + 1, selected)));
            selected.pop();
        }
        RuntimeNode::Object(items)
    }

    fn hash_branch(
        &self,
        variations: &[Variation],
        depth: usize,
        selected: &mut Vec<(usize, String)>,
    ) -> HashNode {
        if depth == variations.len() {
            return self.hash_leaf(selected);
        }

        let variation = &variations[depth];
        let mut items = vec![];
        let keys = Self::keys(variations, depth, selected);
        for key in keys {
            selected.push((variation.index, key.clone()));
            items.push((
                key.clone(),
                self.hash_branch(variations, depth + 1, selected),
            ));
            selected.pop();
        }
        HashNode::Object(items)
    }

    fn keys(variations: &[Variation], depth: usize, selected: &[(usize, String)]) -> Vec<String> {
        let variation = &variations[depth];
        variation
            .group
            .as_ref()
            .and_then(|group| {
                variations[..depth]
                    .iter()
                    .enumerate()
                    .find(|(_, previous)| previous.group.as_ref() == Some(group))
                    .and_then(|(index, _)| selected.get(index).map(|(_, key)| key.clone()))
            })
            .map(|key| vec![key])
            .unwrap_or_else(|| variation.keys.clone())
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

    fn pattern(&self, selected: &[(usize, String)], use_hash_tokens: bool) -> String {
        let selected: BTreeMap<usize, String> = selected.iter().cloned().collect();
        self.pattern_parts(&self.phrase.parts, &selected, use_hash_tokens)
    }

    fn pattern_parts(
        &self,
        parts: &[Part],
        selected: &BTreeMap<usize, String>,
        use_hash_tokens: bool,
    ) -> String {
        let mut output = String::new();
        for part in parts {
            self.append_part_text(&mut output, part, selected, use_hash_tokens);
        }
        normalize_spaces(&output, self.phrase.options.preserve_whitespace)
            .trim()
            .to_string()
    }

    fn append_part_text(
        &self,
        output: &mut String,
        part: &Part,
        selected: &BTreeMap<usize, String>,
        use_hash_tokens: bool,
    ) {
        match part {
            Part::Text(text) => output.push_str(text),
            Part::Param { name, .. } => {
                let token = if use_hash_tokens {
                    self.param_hash_name(part, selected)
                } else {
                    name.clone()
                };
                output.push_str(&format!("{{{token}}}"));
            }
            Part::SameParam { name } | Part::Name { name, .. } | Part::List { name, .. } => {
                output.push_str(&format!("{{{name}}}"));
            }
            Part::Enum { range, .. } => {
                let text = self
                    .selected_key(part, selected)
                    .and_then(|key| range.iter().find(|(range_key, _)| range_key == key))
                    .map(|(_, text)| text.as_str())
                    .unwrap_or_default();
                output.push_str(text);
            }
            Part::Plural {
                singular,
                many,
                show_count,
                name,
                ..
            } => {
                let is_singular = self
                    .selected_key(part, selected)
                    .is_some_and(|key| key == "_1");
                if is_singular {
                    if show_count == "yes" {
                        output.push_str(&format!("1 {singular}"));
                    } else {
                        output.push_str(singular);
                    }
                } else if show_count == "yes" || show_count == "ifMany" {
                    let token = name.as_deref().unwrap_or("number");
                    output.push_str(&format!("{{{token}}} {many}"));
                } else {
                    output.push_str(many);
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
                    .map(String::as_str)
                    .unwrap_or("*");
                let text = pronoun_candidates(usage, *human)
                    .into_iter()
                    .find(|(candidate, _)| candidate == key)
                    .map(|(_, text)| text)
                    .unwrap_or_else(|| "they".to_string());
                if *capitalize {
                    output.push_str(&capitalize_first(&text));
                } else {
                    output.push_str(&text);
                }
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

    fn param_hash_name(&self, part: &Part, selected: &BTreeMap<usize, String>) -> String {
        let Part::Param {
            name,
            hash_name,
            nested,
            nested_parts,
            ..
        } = part
        else {
            unreachable!("param hash name requested for non-param")
        };
        if nested.is_some() {
            let text = self.token_name_text(nested_parts, selected);
            format!("={}", text.trim().replace('{', "[").replace('}', "]"))
        } else {
            hash_name.clone().unwrap_or_else(|| name.clone())
        }
    }

    fn token_name_text(&self, parts: &[Part], selected: &BTreeMap<usize, String>) -> String {
        let mut output = String::new();
        for part in parts {
            if matches!(
                part,
                Part::Param {
                    nested: Some(_),
                    runtime_kind: ParamRuntimeKind::Implicit,
                    ..
                }
            ) {
                if let Part::Param { nested_parts, .. } = part {
                    output.push_str(&self.pattern_parts(nested_parts, selected, true));
                }
            } else {
                self.append_part_text(&mut output, part, selected, false);
            }
        }
        normalize_spaces(&output, self.phrase.options.preserve_whitespace)
            .trim()
            .to_string()
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
        let mut output = String::new();
        for part in parts {
            if let Part::Param {
                nested: Some(nested),
                nested_parts,
                runtime_kind: ParamRuntimeKind::Implicit,
                ..
            } = part
            {
                if nested.target_id != target && nested_parts_contain_target(nested_parts, target) {
                    output.push_str(&self.description_parts_text(nested_parts, target, selected));
                } else {
                    output.push_str(&format!("{{{}}}", self.param_hash_name(part, selected)));
                }
            } else {
                self.append_part_text(&mut output, part, selected, false);
            }
        }
        normalize_spaces(&output, self.phrase.options.preserve_whitespace)
            .trim()
            .to_string()
    }

    fn aliases(&self, selected: &[(usize, String)]) -> Option<IndexMap<String, String>> {
        let selected = selected.iter().cloned().collect::<BTreeMap<_, _>>();
        let aliases = self
            .phrase
            .parts
            .iter()
            .filter_map(|part| match part {
                Part::Param {
                    name,
                    runtime_kind: ParamRuntimeKind::Implicit,
                    ..
                } => {
                    let hash_name = self.param_hash_name(part, &selected);
                    (&hash_name != name).then(|| (hash_name, name.clone()))
                }
                _ => None,
            })
            .collect::<IndexMap<_, _>>();
        if aliases.is_empty() {
            None
        } else {
            Some(aliases)
        }
    }

    fn validate_dynamic_tokens(&self) -> Result<(), String> {
        let variations = self.variations();
        self.validate_dynamic_tokens_branch(&variations, 0, &mut Vec::new())
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
                        self.phrase.module.as_str()
                    ));
                }
                if explicit.contains(token.as_str()) {
                    return Err(format!(
                        "Token '{token}' is already used in this {} call.",
                        self.phrase.module.as_str()
                    ));
                }
                self.validate_dynamic_token_parts(nested_parts, selected)?;
            }
        }
        Ok(())
    }
}

fn render_runtime_call(
    phrase: &Phrase,
    module_ident: &Ident,
    global_variations: &[&Part],
    shared_runtime_args: &[Expr],
    root_parts: &[Part],
    description_target: Option<u32>,
) -> Expr {
    let builder = RuntimeBuilder::new(phrase, global_variations, root_parts, description_target);
    let table = builder.table();
    let hk = fbt_hash_key(&builder.hash_tree());
    let mut runtime_args = shared_runtime_args.to_vec();

    // Babel evaluates variations first, explicit non-variation tokens second,
    // and implicit JSX parameters last.
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
                    module_ident,
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

    let runtime_args = if runtime_args.is_empty() {
        null_expr()
    } else {
        Expr::Array(ArrayLit {
            span: DUMMY_SP,
            elems: runtime_args
                .into_iter()
                .map(|expr| {
                    Some(ExprOrSpread {
                        spread: None,
                        expr: Box::new(expr),
                    })
                })
                .collect(),
        })
    };
    let mut option_props = vec![PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
        key: PropName::Ident(IdentName::new("hk".into(), DUMMY_SP)),
        value: Box::new(string_expr(hk)),
    })))];
    if let Some(project) = phrase
        .options
        .project
        .as_ref()
        .filter(|project| !project.is_empty())
    {
        option_props.push(PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
            key: PropName::Ident(IdentName::new("project".into(), DUMMY_SP)),
            value: Box::new(string_expr(project.clone())),
        }))));
    }
    runtime_helper(
        module_ident,
        "_",
        vec![
            table.expr(),
            runtime_args,
            Expr::Object(ObjectLit {
                span: DUMMY_SP,
                props: option_props,
            }),
        ],
    )
}

fn runtime_arg_with_context(
    phrase: &Phrase,
    module_ident: &Ident,
    part: &Part,
    global_variations: &[&Part],
    shared_runtime_args: &[Expr],
    root_parts: &[Part],
) -> Option<Expr> {
    if let Part::Param {
        name,
        nested: Some(nested),
        nested_parts,
        value,
        runtime_kind: ParamRuntimeKind::Implicit,
        ..
    } = part
    {
        let nested_phrase = Phrase {
            desc: String::new(),
            module: phrase.module,
            options: phrase.options.clone(),
            parts: nested_parts.clone(),
        };
        let nested_runtime = render_runtime_call(
            &nested_phrase,
            module_ident,
            global_variations,
            shared_runtime_args,
            root_parts,
            Some(nested.target_id),
        );
        return Some(runtime_helper(
            module_ident,
            "_implicitParam",
            vec![
                string_expr(name.clone()),
                inject_nested_runtime(value, nested_runtime),
            ],
        ));
    }
    runtime_arg_expr(module_ident, part)
}

fn inject_nested_runtime(value: &Expr, runtime: Expr) -> Expr {
    let child = JSXElementChild::JSXExprContainer(JSXExprContainer {
        span: DUMMY_SP,
        expr: JSXExpr::Expr(Box::new(runtime)),
    });
    match value {
        Expr::JSXElement(element) => {
            let mut element = element.clone();
            element.children = vec![child];
            Expr::JSXElement(element)
        }
        Expr::JSXFragment(fragment) => {
            let mut fragment = fragment.clone();
            fragment.children = vec![child];
            Expr::JSXFragment(fragment)
        }
        _ => value.clone(),
    }
}

fn runtime_arg_expr(module_ident: &Ident, part: &Part) -> Option<Expr> {
    match part {
        Part::Param {
            name,
            value,
            variation,
            runtime_kind,
            ..
        } => {
            let method = match runtime_kind {
                ParamRuntimeKind::Param => "_param",
                ParamRuntimeKind::Implicit => "_implicitParam",
            };
            let mut args = vec![string_expr(name.clone()), *value.clone()];
            match variation {
                ParamVariation::None => {}
                ParamVariation::Number(expr) => {
                    args.push(variation_array(NUMBER, expr.clone()));
                }
                ParamVariation::Gender(expr) => {
                    args.push(variation_array(GENDER, Some(expr.clone())));
                }
            }
            Some(runtime_helper(module_ident, method, args))
        }
        Part::SameParam { .. } | Part::Text(_) => None,
        Part::Name {
            name,
            value,
            gender,
        } => Some(runtime_helper(
            module_ident,
            "_name",
            vec![string_expr(name.clone()), *value.clone(), *gender.clone()],
        )),
        Part::Enum {
            value,
            range_expr,
            range,
        } => Some(runtime_helper(
            module_ident,
            "_enum",
            vec![
                *value.clone(),
                if matches!(range_expr.as_ref(), Expr::Array(_)) {
                    enum_range_object_expr(range)
                } else {
                    *range_expr.clone()
                },
            ],
        )),
        Part::Plural {
            count,
            name,
            value,
            show_count,
            ..
        } => {
            let mut args = vec![*count.clone()];
            if show_count != "no" {
                args.push(match name {
                    Some(name) => string_expr(name.clone()),
                    None => null_expr(),
                });
                if let Some(value) = value {
                    args.push(*value.clone());
                }
            }
            Some(runtime_helper(module_ident, "_plural", args))
        }
        Part::Pronoun {
            usage,
            gender,
            human,
            ..
        } => {
            let mut args = vec![number_expr(pronoun_usage(usage)?), *gender.clone()];
            if *human {
                args.push(Expr::Object(ObjectLit {
                    span: DUMMY_SP,
                    props: vec![PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                        key: PropName::Ident(IdentName::new("human".into(), DUMMY_SP)),
                        value: Box::new(number_expr(1)),
                    })))],
                }));
            }
            Some(runtime_helper(module_ident, "_pronoun", args))
        }
        Part::List {
            name,
            items,
            conjunction,
            delimiter,
        } => {
            let mut args = vec![string_expr(name.clone()), *items.clone()];
            if conjunction.is_some() || delimiter.is_some() {
                args.push(
                    conjunction
                        .clone()
                        .map(|expression| *expression)
                        .unwrap_or_else(null_expr),
                );
            }
            if let Some(delimiter) = delimiter {
                args.push(*delimiter.clone());
            }
            Some(runtime_helper(module_ident, "_list", args))
        }
    }
}

#[derive(Clone)]
enum RuntimeNode {
    String(String),
    Object(Vec<(String, RuntimeNode)>),
}

impl RuntimeNode {
    fn expr(&self) -> Expr {
        match self {
            RuntimeNode::String(value) => string_expr(value.clone()),
            RuntimeNode::Object(items) => Expr::Object(ObjectLit {
                span: DUMMY_SP,
                props: items
                    .iter()
                    .map(|(key, value)| {
                        PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                            key: prop_name_for_key(key),
                            value: Box::new(value.expr()),
                        })))
                    })
                    .collect(),
            }),
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

fn call_module_name(call: &CallExpr) -> Option<ModuleName> {
    match &call.callee {
        Callee::Expr(expr) => match unwrap_parens(expr) {
            Expr::Ident(ident) => match ident.sym.as_ref() {
                "fbt" => Some(ModuleName::Fbt),
                "fbs" => Some(ModuleName::Fbs),
                _ => None,
            },
            Expr::Member(member) => match unwrap_parens(&member.obj) {
                Expr::Ident(ident) => match ident.sym.as_ref() {
                    "fbt" => Some(ModuleName::Fbt),
                    "fbs" => Some(ModuleName::Fbs),
                    _ => None,
                },
                _ => None,
            },
            _ => None,
        },
        _ => None,
    }
}

fn call_member_method(call: &CallExpr) -> Option<&str> {
    match &call.callee {
        Callee::Expr(expr) => match unwrap_parens(expr) {
            Expr::Member(member) => match &member.prop {
                MemberProp::Ident(ident) => Some(ident.sym.as_ref()),
                _ => None,
            },
            _ => None,
        },
        _ => None,
    }
}

fn unwrap_parens(mut expr: &Expr) -> &Expr {
    while let Expr::Paren(paren) = expr {
        expr = &paren.expr;
    }
    expr
}

fn is_construct_method(method: &str) -> bool {
    matches!(
        method,
        "enum" | "list" | "name" | "param" | "plural" | "pronoun" | "sameParam"
    )
}

fn is_fbtee_require(expr: Option<&Expr>) -> bool {
    require_source(expr).as_deref() == Some("fbtee")
}

fn require_source(expr: Option<&Expr>) -> Option<String> {
    let Some(Expr::Call(call)) = expr else {
        return None;
    };
    let is_require = matches!(
        call.callee,
        Callee::Expr(ref callee)
            if matches!(callee.as_ref(), Expr::Ident(ident) if ident.sym == *"require")
    );
    if is_require && call.args.len() == 1 {
        call.args.first().and_then(arg_as_string)
    } else {
        None
    }
}

fn jsx_element_kind(name: &JSXElementName) -> Option<(ModuleName, Option<String>)> {
    match name {
        JSXElementName::Ident(ident) => match ident.sym.as_ref() {
            "fbt" => Some((ModuleName::Fbt, None)),
            "fbs" => Some((ModuleName::Fbs, None)),
            _ => None,
        },
        JSXElementName::JSXNamespacedName(namespaced) => {
            let module = match namespaced.ns.sym.as_ref() {
                "fbt" => ModuleName::Fbt,
                "fbs" => ModuleName::Fbs,
                _ => return None,
            };
            Some((module, Some(namespaced.name.sym.to_string())))
        }
        _ => None,
    }
}

fn arg_as_string(arg: &ExprOrSpread) -> Option<String> {
    expr_as_string(&arg.expr)
}

fn wtf8_to_string(value: &Wtf8Atom) -> String {
    value.to_atom_lossy().as_str().to_string()
}

fn expr_as_string(expr: &Expr) -> Option<String> {
    match expr {
        Expr::Lit(Lit::Str(value)) => Some(wtf8_to_string(&value.value)),
        Expr::Tpl(template) if template.exprs.is_empty() => template.quasis.first().map(|quasi| {
            quasi
                .cooked
                .as_ref()
                .map(wtf8_to_string)
                .unwrap_or_else(|| quasi.raw.to_string())
        }),
        Expr::Bin(binary) if binary.op == BinaryOp::Add => Some(format!(
            "{}{}",
            expr_as_string(&binary.left)?,
            expr_as_string(&binary.right)?
        )),
        _ => None,
    }
}

fn option_string(expr: &Expr) -> Option<String> {
    match expr {
        Expr::Lit(Lit::Str(value)) => Some(wtf8_to_string(&value.value)),
        Expr::Bin(binary) if binary.op == BinaryOp::Add => Some(format!(
            "{}{}",
            option_string(&binary.left)?,
            option_string(&binary.right)?
        )),
        Expr::Paren(paren) => option_string(&paren.expr),
        _ => None,
    }
}

fn is_valid_fbt_array_item(expr: &Expr) -> bool {
    match expr {
        Expr::Lit(Lit::Str(_)) | Expr::Call(_) | Expr::JSXElement(_) | Expr::JSXFragment(_) => true,
        Expr::Tpl(template) => template.exprs.is_empty(),
        Expr::Paren(paren) => is_valid_fbt_array_item(&paren.expr),
        _ => false,
    }
}

fn string_literal_value(expr: &Expr) -> Option<String> {
    match unwrap_parens(expr) {
        Expr::Lit(Lit::Str(value)) => Some(wtf8_to_string(&value.value)),
        _ => None,
    }
}

fn js_array_index(key: &str) -> Option<u32> {
    let value = key.parse::<u32>().ok()?;
    (value != u32::MAX && value.to_string() == key).then_some(value)
}

fn js_property_order(range: IndexMap<String, String>) -> Vec<(String, String)> {
    let mut indices = Vec::new();
    let mut strings = Vec::new();
    for (key, value) in range {
        if let Some(index) = js_array_index(&key) {
            indices.push((index, key, value));
        } else {
            strings.push((key, value));
        }
    }
    indices.sort_by_key(|(index, _, _)| *index);
    indices
        .into_iter()
        .map(|(_, key, value)| (key, value))
        .chain(strings)
        .collect()
}

fn expr_type(expr: &Expr) -> &'static str {
    match expr {
        Expr::Array(_) => "ArrayExpression",
        Expr::Arrow(_) => "ArrowFunctionExpression",
        Expr::Assign(_) => "AssignmentExpression",
        Expr::Await(_) => "AwaitExpression",
        Expr::Bin(_) => "BinaryExpression",
        Expr::Call(_) => "CallExpression",
        Expr::Class(_) => "ClassExpression",
        Expr::Cond(_) => "ConditionalExpression",
        Expr::Fn(_) => "FunctionExpression",
        Expr::Ident(_) => "Identifier",
        Expr::JSXElement(_) => "JSXElement",
        Expr::JSXFragment(_) => "JSXFragment",
        Expr::Lit(_) => "Literal",
        Expr::Member(_) => "MemberExpression",
        Expr::New(_) => "NewExpression",
        Expr::Object(_) => "ObjectExpression",
        Expr::Paren(_) => "ParenthesizedExpression",
        Expr::Seq(_) => "SequenceExpression",
        Expr::TaggedTpl(_) => "TaggedTemplateExpression",
        Expr::This(_) => "ThisExpression",
        Expr::Tpl(_) => "TemplateLiteral",
        Expr::Unary(_) => "UnaryExpression",
        Expr::Update(_) => "UpdateExpression",
        Expr::Yield(_) => "YieldExpression",
        _ => "Expression",
    }
}

#[derive(Default)]
struct ObjectOptions {
    present: BTreeSet<String>,
    strings: BTreeMap<String, String>,
    bools: BTreeMap<String, bool>,
    exprs: BTreeMap<String, Box<Expr>>,
}

impl ObjectOptions {
    fn contains(&self, key: &str) -> bool {
        self.present.contains(key)
    }

    fn string(&self, key: &str) -> Option<String> {
        self.strings.get(key).cloned()
    }

    fn get_bool(&self, key: &str) -> Option<bool> {
        self.bools.get(key).copied()
    }

    fn bool_option(&self, key: &str) -> Result<Option<bool>, String> {
        if !self.contains(key) {
            return Ok(None);
        }
        self.get_bool(key).map(Some).ok_or_else(|| {
            format!("Option '{key}' must be a boolean or 'true'/'false' string literal.")
        })
    }

    fn required_string(&self, key: &str) -> Result<Option<String>, String> {
        if !self.contains(key) {
            return Ok(None);
        }
        self.string(key)
            .map(Some)
            .ok_or_else(|| format!("Option '{key}' must be a string literal."))
    }

    fn expr(&self, key: &str) -> Option<Box<Expr>> {
        self.exprs.get(key).cloned()
    }

    fn number_expr(&self) -> Result<Option<Option<Box<Expr>>>, String> {
        if !self.contains("number") {
            Ok(None)
        } else if self.bools.get("number") == Some(&true) {
            Ok(Some(None))
        } else if let Some(value) = self.exprs.get("number") {
            Ok(Some(Some(value.clone())))
        } else {
            Err("Option 'number' must be an expression or true.".into())
        }
    }
}

fn parse_call_options(expr: &Expr) -> Result<CallOptions, String> {
    let object = parse_object_options(expr, FBT_OPTIONS)?;
    object.required_string("author")?;
    object.bool_option("common")?;
    object.bool_option("doNotExtract")?;
    Ok(CallOptions {
        preserve_whitespace: object.bool_option("preserveWhitespace")?.unwrap_or(false),
        project: object.required_string("project")?,
        subject: object.expr("subject"),
    })
}

fn parse_object(expr: &Expr) -> ObjectOptions {
    let mut options = ObjectOptions::default();
    let Expr::Object(object) = expr else {
        return options;
    };
    for prop in &object.props {
        let PropOrSpread::Prop(prop) = prop else {
            continue;
        };
        let Prop::KeyValue(key_value) = prop.as_ref() else {
            continue;
        };
        let Some(key) = prop_name_to_string(&key_value.key) else {
            continue;
        };
        options.present.insert(key.clone());
        if let Some(value) = option_string(&key_value.value) {
            options.strings.insert(key, value);
        } else {
            match key_value.value.as_ref() {
                Expr::Lit(Lit::Bool(value)) => {
                    options.bools.insert(key, value.value);
                }
                _ => {
                    options.exprs.insert(key, key_value.value.clone());
                }
            }
        }
    }
    options
}

fn parse_object_options(expr: &Expr, allowed: &[&str]) -> Result<ObjectOptions, String> {
    let Expr::Object(object) = expr else {
        return Err("Options must be an object literal.".into());
    };
    for property in &object.props {
        let PropOrSpread::Prop(property) = property else {
            return Err(
                "Options must be plain object properties. Remove methods and spread properties."
                    .into(),
            );
        };
        let Prop::KeyValue(property) = property.as_ref() else {
            return Err(
                "Options must be plain object properties. Remove methods and spread properties."
                    .into(),
            );
        };
        let key = prop_name_to_string(&property.key)
            .ok_or("Option names must be identifiers or string literals.")?;
        if key != "key" && !allowed.contains(&key.as_str()) {
            return Err(format!(
                "Unknown option '{key}'. Use one of: {}.",
                allowed.join(", ")
            ));
        }
    }
    Ok(parse_object(expr))
}

fn compile_error(message: &str) -> ! {
    panic!("fbtee SWC plugin error: {message}");
}

fn parse_docblock_project(comment: &str) -> Result<Option<String>, String> {
    let lines = comment.lines().collect::<Vec<_>>();
    let Some((line_index, marker_index)) = lines.iter().enumerate().find_map(|(index, line)| {
        let line = line.trim().trim_start_matches('*').trim_start();
        line.strip_prefix("@fbt").and_then(|rest| {
            (rest.is_empty() || rest.chars().next().is_some_and(char::is_whitespace))
                .then_some((index, lines[index].find("@fbt").expect("pragma marker")))
        })
    }) else {
        return Ok(None);
    };

    let mut json = lines[line_index][marker_index + "@fbt".len()..]
        .trim()
        .to_string();
    for line in &lines[line_index + 1..] {
        let line = line.trim().trim_start_matches('*').trim();
        if line.starts_with('@') {
            break;
        }
        if !line.is_empty() {
            if !json.is_empty() {
                json.push(' ');
            }
            json.push_str(line);
        }
    }
    if json.is_empty() {
        return Ok(None);
    }

    let value: serde_json::Value = serde_json::from_str(&json)
        .map_err(|error| format!("Invalid @fbt docblock JSON: {error}"))?;
    let object = value
        .as_object()
        .ok_or("@fbt docblock options must be a JSON object.")?;
    for (key, value) in object {
        if !FBT_OPTIONS.contains(&key.as_str()) {
            return Err(format!("Unknown @fbt docblock option '{key}'."));
        }
        match key.as_str() {
            "author" | "project" if !value.is_string() => {
                return Err(format!("@fbt option '{key}' must be a string."));
            }
            "common" | "doNotExtract" | "preserveWhitespace" if !value.is_boolean() => {
                return Err(format!("@fbt option '{key}' must be a boolean."));
            }
            _ => {}
        }
    }
    Ok(object
        .get("project")
        .and_then(serde_json::Value::as_str)
        .filter(|project| !project.is_empty())
        .map(str::to_string))
}

fn unknown_common_string_message(text: &str) -> String {
    format!("Unknown common string '{text}'. Add it to 'fbtCommon' or use a 'desc' attribute.")
}

fn enum_manifest_key(source: &str) -> Option<String> {
    let source = source.rsplit('/').next().unwrap_or(source);
    let source = source
        .strip_suffix(".tsx")
        .or_else(|| source.strip_suffix(".ts"))
        .or_else(|| source.strip_suffix(".jsx"))
        .or_else(|| source.strip_suffix(".js"))
        .unwrap_or(source);
    source.contains("$FbtEnum").then(|| source.to_string())
}

fn module_import_insert_index(items: &[ModuleItem]) -> usize {
    items
        .iter()
        .position(|item| !is_directive_module_item(item))
        .unwrap_or(items.len())
}

fn is_directive_module_item(item: &ModuleItem) -> bool {
    matches!(
        item,
        ModuleItem::Stmt(Stmt::Expr(expr))
            if matches!(expr.expr.as_ref(), Expr::Lit(Lit::Str(_)))
    )
}

fn prop_name_to_string(name: &PropName) -> Option<String> {
    match name {
        PropName::Ident(ident) => Some(ident.sym.to_string()),
        PropName::Str(value) => Some(wtf8_to_string(&value.value)),
        PropName::Num(value) => Some(value.value.to_js_string()),
        _ => None,
    }
}

fn implicit_param_alias(index: usize) -> String {
    format!("=m{index}")
}

fn normalize_jsx_param_name(value: &str) -> String {
    if value.contains(['\n', '\r']) {
        normalize_spaces(value, false)
    } else {
        value.to_string()
    }
}

struct JsxAttrs<'a> {
    attrs: &'a [JSXAttrOrSpread],
}

impl<'a> JsxAttrs<'a> {
    fn new(attrs: &'a [JSXAttrOrSpread]) -> Self {
        Self { attrs }
    }

    fn string(&self, key: &str) -> Option<String> {
        self.value(key).and_then(|value| match value {
            JSXAttrValue::Str(value) => Some(wtf8_to_string(&value.value)),
            JSXAttrValue::JSXExprContainer(container) => match &container.expr {
                JSXExpr::Expr(expr) => expr_as_string(expr),
                _ => None,
            },
            _ => None,
        })
    }

    fn boolish(&self, key: &str) -> Option<bool> {
        self.attr(key).and_then(|attr| match &attr.value {
            None => Some(true),
            Some(JSXAttrValue::Str(value)) if value.value == "true" => Some(true),
            Some(JSXAttrValue::Str(value)) if value.value == "false" => Some(false),
            Some(JSXAttrValue::JSXExprContainer(container)) => match &container.expr {
                JSXExpr::Expr(expr) => match expr.as_ref() {
                    Expr::Lit(Lit::Bool(value)) => Some(value.value),
                    Expr::Lit(Lit::Str(value)) if value.value == "true" => Some(true),
                    Expr::Lit(Lit::Str(value)) if value.value == "false" => Some(false),
                    _ => None,
                },
                _ => None,
            },
            _ => None,
        })
    }

    fn bool_option(&self, key: &str) -> Result<Option<bool>, String> {
        if self.attr(key).is_none() {
            return Ok(None);
        }
        self.boolish(key).map(Some).ok_or_else(|| {
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
            let JSXAttrOrSpread::JSXAttr(attribute) = attribute else {
                return Err("fbtee JSX attributes cannot use spread syntax.".into());
            };
            let Some(name) = jsx_attr_name(&attribute.name) else {
                continue;
            };
            if name.starts_with("__") {
                continue;
            }
            if name != "key" && !allowed.contains(&name.as_str()) {
                return Err(format!(
                    "Unknown option '{name}'. Use one of: {}.",
                    allowed.join(", ")
                ));
            }
        }
        Ok(())
    }

    fn number_expr(&self, key: &str) -> Result<Option<Option<Box<Expr>>>, String> {
        let Some(attr) = self.attr(key) else {
            return Ok(None);
        };
        match &attr.value {
            None => Ok(Some(None)),
            Some(JSXAttrValue::Str(value)) => {
                let value = wtf8_to_string(&value.value);
                if value == "true" {
                    Ok(Some(None))
                } else {
                    Err(format!("Option '{key}' must be an expression or true."))
                }
            }
            Some(JSXAttrValue::JSXExprContainer(container)) => match &container.expr {
                JSXExpr::Expr(expr) => match expr.as_ref() {
                    Expr::Lit(Lit::Bool(value)) if value.value => Ok(Some(None)),
                    Expr::Lit(Lit::Bool(_)) => {
                        Err(format!("Option '{key}' must be an expression or true."))
                    }
                    _ => Ok(Some(Some(expr.clone()))),
                },
                _ => Err(format!("Option '{key}' must be an expression or true.")),
            },
            _ => Err(format!("Option '{key}' must be an expression or true.")),
        }
    }

    fn expr(&self, key: &str) -> Option<Box<Expr>> {
        self.value(key).and_then(|value| match value {
            JSXAttrValue::JSXExprContainer(container) => match &container.expr {
                JSXExpr::Expr(expr) => Some(expr.clone()),
                _ => None,
            },
            JSXAttrValue::Str(value) => Some(Box::new(Expr::Lit(Lit::Str(Str {
                span: value.span,
                value: value.value.clone(),
                raw: value.raw.clone(),
            })))),
            _ => None,
        })
    }

    fn value(&self, key: &str) -> Option<&'a JSXAttrValue> {
        self.attr(key).and_then(|attr| attr.value.as_ref())
    }

    fn attr(&self, key: &str) -> Option<&'a JSXAttr> {
        self.attrs.iter().find_map(|attr| match attr {
            JSXAttrOrSpread::JSXAttr(attr) if jsx_attr_name(&attr.name).as_deref() == Some(key) => {
                Some(attr)
            }
            _ => None,
        })
    }
}

fn jsx_attr_name(name: &JSXAttrName) -> Option<String> {
    match name {
        JSXAttrName::Ident(ident) => Some(ident.sym.to_string()),
        JSXAttrName::JSXNamespacedName(namespaced) => {
            Some(format!("{}:{}", namespaced.ns.sym, namespaced.name.sym))
        }
    }
}

fn jsx_text_content(children: &[JSXElementChild]) -> String {
    let mut output = String::new();
    for child in children {
        match child {
            JSXElementChild::JSXText(text) => output.push_str(&text.value),
            JSXElementChild::JSXExprContainer(container) => {
                if let JSXExpr::Expr(expr) = &container.expr {
                    if let Some(value) = expr_as_string(expr) {
                        output.push_str(&value);
                    }
                }
            }
            JSXElementChild::JSXElement(element) => {
                output.push_str(&jsx_text_content(&element.children))
            }
            JSXElementChild::JSXFragment(fragment) => {
                output.push_str(&jsx_fragment_text_content(fragment))
            }
            JSXElementChild::JSXSpreadChild(_) => {}
        }
    }
    output
}

fn jsx_plural_text(children: &[JSXElementChild], module: ModuleName) -> Result<String, String> {
    let mut values = Vec::new();
    for child in children {
        match child {
            JSXElementChild::JSXText(text) if !text.value.chars().all(char::is_whitespace) => {
                values.push(text.value.to_string());
            }
            JSXElementChild::JSXExprContainer(container) => {
                if let JSXExpr::Expr(expression) = &container.expr {
                    values.push(expr_as_string(expression).ok_or_else(|| {
                        format!(
                            "<{}:plural> child must be static text or a string expression.",
                            module.as_str()
                        )
                    })?);
                }
            }
            JSXElementChild::JSXText(_) => {}
            JSXElementChild::JSXElement(_)
            | JSXElementChild::JSXFragment(_)
            | JSXElementChild::JSXSpreadChild(_) => {
                return Err(format!(
                    "<{}:plural> needs exactly one child: text or an expression.",
                    module.as_str()
                ));
            }
        }
    }
    if values.len() != 1 {
        return Err(format!(
            "<{}:plural> needs exactly one child: text or an expression.",
            module.as_str()
        ));
    }
    Ok(values.pop().expect("one plural child"))
}

fn jsx_description_text(children: &[JSXElementChild], options: &CallOptions) -> String {
    jsx_description_text_with_target(children, None, options)
}

fn jsx_description_text_for_target(
    children: &[JSXElementChild],
    target: &JSXElement,
    options: &CallOptions,
) -> String {
    jsx_description_text_with_target(children, Some(target), options)
}

fn jsx_description_text_with_target(
    children: &[JSXElementChild],
    target: Option<&JSXElement>,
    options: &CallOptions,
) -> String {
    let mut output = String::new();
    for child in children {
        match child {
            JSXElementChild::JSXText(text) => {
                let text = normalize_spaces(text.value.as_ref(), options.preserve_whitespace);
                if !text.trim().is_empty() {
                    output.push_str(&text);
                }
            }
            JSXElementChild::JSXExprContainer(container) => {
                if let JSXExpr::Expr(expr) = &container.expr {
                    if let Some(text) = expr_description_text(expr, options) {
                        output.push_str(&text);
                    }
                }
            }
            JSXElementChild::JSXElement(element) => {
                if target.is_some_and(|target| std::ptr::eq(element.as_ref(), target)) {
                    let token = implicit_child_hash_name(child, options);
                    if token != "=" {
                        output.push_str(&format!("{{{token}}}"));
                    }
                } else if target
                    .is_some_and(|target| jsx_children_contain_element(&element.children, target))
                {
                    output.push_str(&jsx_description_text_with_target(
                        &element.children,
                        target,
                        options,
                    ));
                } else if let Some((_, Some(kind))) = jsx_element_kind(&element.opening.name) {
                    output.push_str(&format!(
                        "{{{}}}",
                        jsx_construct_token_text(element, &kind, options)
                    ));
                } else {
                    let token = normalize_spaces(
                        &jsx_text_content(&element.children),
                        options.preserve_whitespace,
                    )
                    .trim()
                    .to_string();
                    if !token.is_empty() {
                        output.push_str(&format!("{{={token}}}"));
                    }
                }
            }
            JSXElementChild::JSXFragment(fragment) => {
                let token = normalize_spaces(
                    &jsx_fragment_text_content(fragment),
                    options.preserve_whitespace,
                )
                .trim()
                .to_string();
                if !token.is_empty() {
                    output.push_str(&format!("{{={token}}}"));
                }
            }
            JSXElementChild::JSXSpreadChild(_) => {}
        }
    }
    normalize_spaces(&output, options.preserve_whitespace)
        .trim()
        .to_string()
}

fn jsx_children_contain_element(children: &[JSXElementChild], target: &JSXElement) -> bool {
    children.iter().any(|child| match child {
        JSXElementChild::JSXElement(element) => {
            std::ptr::eq(element.as_ref(), target)
                || jsx_children_contain_element(&element.children, target)
        }
        JSXElementChild::JSXFragment(fragment) => {
            jsx_children_contain_element(&fragment.children, target)
        }
        _ => false,
    })
}

fn jsx_children_contain_spread(children: &[JSXElementChild]) -> bool {
    children.iter().any(|child| match child {
        JSXElementChild::JSXSpreadChild(_) => true,
        JSXElementChild::JSXElement(element) => jsx_children_contain_spread(&element.children),
        JSXElementChild::JSXFragment(fragment) => jsx_children_contain_spread(&fragment.children),
        JSXElementChild::JSXText(_) | JSXElementChild::JSXExprContainer(_) => false,
    })
}

fn implicit_child_hash_name(child: &JSXElementChild, options: &CallOptions) -> String {
    let text = match child {
        JSXElementChild::JSXElement(element) => jsx_implicit_token_text(&element.children, options),
        JSXElementChild::JSXFragment(fragment) => {
            jsx_implicit_token_text(&fragment.children, options)
        }
        _ => String::new(),
    };
    let text = normalize_spaces(&text, options.preserve_whitespace)
        .trim()
        .replace('{', "[")
        .replace('}', "]");
    format!("={text}")
}

fn jsx_implicit_token_text(children: &[JSXElementChild], options: &CallOptions) -> String {
    let mut output = String::new();
    for child in children {
        match child {
            JSXElementChild::JSXText(text) => output.push_str(&text.value),
            JSXElementChild::JSXExprContainer(container) => {
                if let JSXExpr::Expr(expr) = &container.expr {
                    if let Some(text) = expr_description_text(expr, options) {
                        output.push_str(&text);
                    }
                }
            }
            JSXElementChild::JSXElement(element) => {
                if let Some((_, Some(kind))) = jsx_element_kind(&element.opening.name) {
                    output.push_str(&format!(
                        "{{{}}}",
                        jsx_construct_token_text(element, &kind, options)
                    ));
                } else {
                    output.push_str(&jsx_implicit_token_text(&element.children, options));
                }
            }
            JSXElementChild::JSXFragment(fragment) => {
                output.push_str(&jsx_implicit_token_text(&fragment.children, options));
            }
            JSXElementChild::JSXSpreadChild(_) => {}
        }
    }
    normalize_spaces(&output, options.preserve_whitespace)
        .trim()
        .to_string()
}

fn expr_description_text(expr: &Expr, options: &CallOptions) -> Option<String> {
    match expr {
        Expr::Lit(Lit::Str(value)) => Some(normalize_spaces(
            &wtf8_to_string(&value.value),
            options.preserve_whitespace,
        )),
        Expr::Tpl(template) => {
            if template.exprs.is_empty() {
                Some(normalize_spaces(
                    &template
                        .quasis
                        .iter()
                        .map(|quasi| quasi.raw.to_string())
                        .collect::<String>(),
                    options.preserve_whitespace,
                ))
            } else {
                None
            }
        }
        Expr::Bin(binary) if binary.op == BinaryOp::Add => {
            let left = expr_description_text(&binary.left, options)?;
            let right = expr_description_text(&binary.right, options)?;
            Some(format!("{left}{right}"))
        }
        _ => None,
    }
}

fn jsx_construct_token_text(element: &JSXElement, kind: &str, options: &CallOptions) -> String {
    let attrs = JsxAttrs::new(&element.opening.attrs);
    match kind {
        "param" | "same-param" | "sameParam" | "name" | "list" => {
            attrs.string("name").unwrap_or_else(|| {
                normalize_spaces(
                    &jsx_text_content(&element.children),
                    options.preserve_whitespace,
                )
                .trim()
                .to_string()
            })
        }
        "plural" => attrs.string("name").unwrap_or_else(|| {
            normalize_spaces(
                &jsx_text_content(&element.children),
                options.preserve_whitespace,
            )
            .trim()
            .to_string()
        }),
        "enum" => normalize_spaces(
            &jsx_text_content(&element.children),
            options.preserve_whitespace,
        )
        .trim()
        .to_string(),
        _ => normalize_spaces(
            &jsx_text_content(&element.children),
            options.preserve_whitespace,
        )
        .trim()
        .to_string(),
    }
}

fn jsx_fragment_text_content(fragment: &JSXFragment) -> String {
    jsx_text_content(&fragment.children)
}

fn compact_text_parts(parts: Vec<Part>) -> Vec<Part> {
    let mut output = vec![];
    for part in parts {
        match (output.last_mut(), part) {
            (Some(Part::Text(left)), Part::Text(right)) => left.push_str(&right),
            (_, part) => output.push(part),
        }
    }
    output
}

fn normalize_spaces(value: &str, preserve_whitespace: bool) -> String {
    if preserve_whitespace {
        return value.to_string();
    }
    let mut output = String::new();
    let mut last_space = false;
    for ch in value.chars() {
        let is_space = ch.is_whitespace() && ch != '\u{00a0}';
        if is_space {
            if !last_space {
                output.push(' ');
            }
            last_space = true;
        } else {
            output.push(ch);
            last_space = false;
        }
    }
    output
}

fn clean_jsx_text(value: &str) -> String {
    let value = value.replace("\r\n", "\n").replace('\r', "\n");
    let lines: Vec<&str> = value.split('\n').collect();
    let last_non_empty_line = lines
        .iter()
        .rposition(|line| line.chars().any(|ch| ch != ' ' && ch != '\t'))
        .unwrap_or(0);
    let mut output = String::new();

    for (index, line) in lines.iter().enumerate() {
        let is_first_line = index == 0;
        let is_last_line = index == lines.len() - 1;
        let is_last_non_empty_line = index == last_non_empty_line;
        let mut line = line.replace('\t', " ");

        if !is_first_line {
            line = line.trim_start_matches(' ').to_string();
        }
        if !is_last_line {
            line = line.trim_end_matches(' ').to_string();
        }
        if !line.is_empty() {
            output.push_str(&line);
            if !is_last_non_empty_line {
                output.push(' ');
            }
        }
    }

    output
}

fn runtime_helper(module_ident: &Ident, method: &str, args: Vec<Expr>) -> Expr {
    Expr::Call(CallExpr {
        span: DUMMY_SP,
        ctxt: Default::default(),
        callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
            span: DUMMY_SP,
            obj: Box::new(Expr::Ident(module_ident.clone())),
            prop: MemberProp::Ident(IdentName::new(method.into(), DUMMY_SP)),
        }))),
        args: args
            .into_iter()
            .map(|expr| ExprOrSpread {
                spread: None,
                expr: Box::new(expr),
            })
            .collect(),
        type_args: None,
    })
}

fn set_expression_span(expression: &mut Expr, span: Span) {
    match expression {
        Expr::Call(call) => call.span = span,
        Expr::JSXElement(element) => element.span = span,
        Expr::JSXFragment(fragment) => fragment.span = span,
        _ => {}
    }
}

fn enum_range_object_expr(range: &[(String, String)]) -> Expr {
    Expr::Object(ObjectLit {
        span: DUMMY_SP,
        props: range
            .iter()
            .map(|(key, value)| {
                PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                    key: prop_name_for_key(key),
                    value: Box::new(string_expr(value.clone())),
                })))
            })
            .collect(),
    })
}

fn variation_array(kind: i32, value: Option<Box<Expr>>) -> Expr {
    Expr::Array(ArrayLit {
        span: DUMMY_SP,
        elems: std::iter::once(Some(ExprOrSpread {
            spread: None,
            expr: Box::new(number_expr(kind)),
        }))
        .chain(value.map(|expr| Some(ExprOrSpread { spread: None, expr })))
        .collect(),
    })
}

fn string_expr(value: String) -> Expr {
    Expr::Lit(Lit::Str(Str {
        span: DUMMY_SP,
        value: Wtf8Atom::new(value),
        raw: None,
    }))
}

fn number_expr(value: i32) -> Expr {
    Expr::Lit(Lit::Num(Number {
        span: DUMMY_SP,
        value: value as f64,
        raw: None,
    }))
}

fn null_expr() -> Expr {
    Expr::Lit(Lit::Null(Null { span: DUMMY_SP }))
}

fn prop_name_for_key(key: &str) -> PropName {
    if is_valid_ident(key) {
        PropName::Ident(IdentName::new(key.into(), DUMMY_SP))
    } else {
        PropName::Str(Str {
            span: DUMMY_SP,
            value: Wtf8Atom::new(key),
            raw: None,
        })
    }
}

fn is_valid_ident(value: &str) -> bool {
    let mut chars = value.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    (first == '_' || first == '$' || first.is_ascii_alphabetic())
        && chars.all(|ch| ch == '_' || ch == '$' || ch.is_ascii_alphanumeric())
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
            module.as_str(),
            PRONOUN_USAGES.join(", ")
        ))
    }
}

fn pronoun_usage(usage: &str) -> Option<i32> {
    match usage {
        "object" => Some(0),
        "possessive" => Some(1),
        "reflexive" => Some(2),
        "subject" => Some(3),
        _ => None,
    }
}

fn pronoun_candidates(usage: &str, human: bool) -> Vec<(String, String)> {
    match usage {
        "object" if !human => vec![
            ("0".to_string(), "this".to_string()),
            ("1".to_string(), "her".to_string()),
            ("2".to_string(), "him".to_string()),
            ("*".to_string(), "them".to_string()),
        ],
        "object" => vec![
            ("1".to_string(), "her".to_string()),
            ("2".to_string(), "him".to_string()),
            ("*".to_string(), "them".to_string()),
        ],
        "possessive" => vec![
            ("1".to_string(), "her".to_string()),
            ("2".to_string(), "his".to_string()),
            ("*".to_string(), "their".to_string()),
        ],
        "reflexive" if !human => vec![
            ("0".to_string(), "themself".to_string()),
            ("1".to_string(), "herself".to_string()),
            ("2".to_string(), "himself".to_string()),
            ("*".to_string(), "themselves".to_string()),
        ],
        "reflexive" => vec![
            ("1".to_string(), "herself".to_string()),
            ("2".to_string(), "himself".to_string()),
            ("*".to_string(), "themselves".to_string()),
        ],
        "subject" => vec![
            ("1".to_string(), "she".to_string()),
            ("2".to_string(), "he".to_string()),
            ("*".to_string(), "they".to_string()),
        ],
        _ => vec![],
    }
}

fn capitalize_first(value: &str) -> String {
    let mut chars = value.chars();
    let Some(first) = chars.next() else {
        return String::new();
    };
    format!("{}{}", first.to_uppercase(), chars.collect::<String>())
}

fn fbt_hash_key(jsfbt: &HashNode) -> String {
    uint_to_base_n(fbt_jenkins_hash(jsfbt), 62)
}

fn fbt_jenkins_hash(jsfbt: &HashNode) -> u32 {
    let leaves = hash_leaves(jsfbt);
    let Some(first) = leaves.first() else {
        return 0;
    };
    if leaves.iter().all(|leaf| leaf.desc == first.desc) {
        let key = format!("{}|{}", json_text_tree(jsfbt), first.desc);
        jenkins_hash(&key)
    } else {
        jenkins_hash(&json_full_tree(jsfbt))
    }
}

fn hash_leaves(node: &HashNode) -> Vec<HashLeaf> {
    match node {
        HashNode::Leaf(leaf) => vec![leaf.clone()],
        HashNode::Object(items) => items
            .iter()
            .flat_map(|(_, node)| hash_leaves(node))
            .collect(),
    }
}

fn json_text_tree(node: &HashNode) -> String {
    match node {
        HashNode::Leaf(leaf) => match &leaf.token_aliases {
            Some(token_aliases) => format!(
                "{{\"text\":{},\"tokenAliases\":{}}}",
                serde_json::to_string(&leaf.text).unwrap(),
                serde_json::to_string(token_aliases).unwrap()
            ),
            None => serde_json::to_string(&leaf.text).unwrap(),
        },
        HashNode::Object(items) => {
            let mut output = String::from("{");
            for (index, (key, value)) in items.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }
                output.push_str(&serde_json::to_string(key).unwrap());
                output.push(':');
                output.push_str(&json_text_tree(value));
            }
            output.push('}');
            output
        }
    }
}

fn json_full_tree(node: &HashNode) -> String {
    match node {
        HashNode::Leaf(leaf) => match &leaf.token_aliases {
            Some(token_aliases) => format!(
                "{{\"desc\":{},\"text\":{},\"tokenAliases\":{}}}",
                serde_json::to_string(&leaf.desc).unwrap(),
                serde_json::to_string(&leaf.text).unwrap(),
                serde_json::to_string(token_aliases).unwrap()
            ),
            None => format!(
                "{{\"desc\":{},\"text\":{}}}",
                serde_json::to_string(&leaf.desc).unwrap(),
                serde_json::to_string(&leaf.text).unwrap()
            ),
        },
        HashNode::Object(items) => {
            let mut output = String::from("{");
            for (index, (key, value)) in items.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }
                output.push_str(&serde_json::to_string(key).unwrap());
                output.push(':');
                output.push_str(&json_full_tree(value));
            }
            output.push('}');
            output
        }
    }
}

fn jenkins_hash(value: &str) -> u32 {
    if value.is_empty() {
        return 0;
    }
    let mut hash = 0u32;
    for byte in value.as_bytes() {
        hash = hash.wrapping_add(*byte as u32);
        hash = hash.wrapping_add(hash << 10);
        hash ^= hash >> 6;
    }
    hash = hash.wrapping_add(hash << 3);
    hash ^= hash >> 11;
    hash = hash.wrapping_add(hash << 15);
    hash
}

fn uint_to_base_n(mut value: u32, base: u32) -> String {
    const SYMBOLS: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if !(2..=62).contains(&base) {
        return String::new();
    }
    let mut output = vec![];
    loop {
        output.push(SYMBOLS[(value % base) as usize] as char);
        value /= base;
        if value == 0 {
            break;
        }
    }
    output.into_iter().rev().collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use swc_core::{
        common::{sync::Lrc, FileName, SourceMap},
        ecma::{
            codegen::{text_writer::JsWriter, Emitter},
            parser::{lexer::Lexer, Parser, StringInput, Syntax, TsSyntax},
            visit::VisitMutWith,
        },
    };

    fn transform(source: &str, options: PluginOptions) -> String {
        let cm: Lrc<SourceMap> = Default::default();
        let fm = cm.new_source_file(
            FileName::Custom("test.tsx".into()).into(),
            source.to_string(),
        );
        let lexer = Lexer::new(
            Syntax::Typescript(TsSyntax {
                tsx: true,
                ..Default::default()
            }),
            Default::default(),
            StringInput::from(&*fm),
            None,
        );
        let mut parser = Parser::new_from(lexer);
        let mut module = parser.parse_module().expect("failed to parse module");
        module.visit_mut_with(&mut FbteeTransform::new(options, None));

        let mut output = Vec::new();
        {
            let mut emitter = Emitter {
                cfg: Default::default(),
                cm: cm.clone(),
                comments: None,
                wr: JsWriter::new(cm, "\n", &mut output, None),
            };
            emitter.emit_module(&module).expect("failed to emit module");
        }
        String::from_utf8(output).expect("expected utf8")
    }

    fn transform_error(source: &str, options: PluginOptions) -> String {
        let error =
            std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| transform(source, options)))
                .expect_err("expected transform to fail");
        error
            .downcast_ref::<String>()
            .cloned()
            .or_else(|| {
                error
                    .downcast_ref::<&str>()
                    .map(|message| (*message).to_string())
            })
            .unwrap_or_else(|| "unknown transform error".to_string())
    }

    fn default_options() -> PluginOptions {
        PluginOptions::default()
    }

    #[test]
    fn hashes_simple_strings_like_babel() {
        let tree = HashNode::Leaf(HashLeaf {
            desc: "It's simple".to_string(),
            text: "A simple string".to_string(),
            token_aliases: None,
        });
        assert_eq!(fbt_hash_key(&tree), "pITkM");
    }

    #[test]
    fn hashes_list_like_babel() {
        let tree = HashNode::Leaf(HashLeaf {
            desc: "Lists".to_string(),
            text: "Available Locations: {locations}".to_string(),
            token_aliases: None,
        });
        assert_eq!(fbt_hash_key(&tree), "19372u");
    }

    #[test]
    fn plural_patterns_match_babel_shape() {
        let phrase = Phrase {
            desc: "likes".to_string(),
            module: ModuleName::Fbt,
            options: CallOptions::default(),
            parts: vec![
                Part::Text("There ".to_string()),
                Part::Plural {
                    singular: "is ".to_string(),
                    count: Box::new(Expr::Ident(Ident::new_no_ctxt("count".into(), DUMMY_SP))),
                    many: "are ".to_string(),
                    show_count: "no".to_string(),
                    name: None,
                    value: None,
                },
                Part::Plural {
                    singular: "a like".to_string(),
                    count: Box::new(Expr::Ident(Ident::new_no_ctxt("count".into(), DUMMY_SP))),
                    many: "likes".to_string(),
                    show_count: "ifMany".to_string(),
                    name: Some("number".to_string()),
                    value: None,
                },
            ],
        };
        let mut variations = Vec::new();
        collect_variation_parts(&phrase.parts, &mut variations);
        let builder = RuntimeBuilder::new(&phrase, &variations, &phrase.parts, None);
        let table = builder.table();
        match table {
            RuntimeNode::Object(items) => {
                assert_eq!(items[0].0, "*");
                assert_eq!(items[1].0, "_1");
            }
            RuntimeNode::String(_) => panic!("expected branch"),
        }
    }

    #[test]
    fn allows_duplicate_plural_names_without_runtime_tokens() {
        let output = transform(
            "const x = <fbt desc='d'><fbt:plural count={won} name='number' showCount='no'>won game</fbt:plural>, <fbt:plural count={lost} name='number' showCount='no'>lost game</fbt:plural></fbt>;",
            default_options(),
        );
        assert_eq!(output.matches("fbt._plural(").count(), 2, "{output}");
    }

    #[test]
    fn hashes_enum_tables_like_babel() {
        let tree = HashNode::Object(vec![
            (
                "id1".to_string(),
                HashNode::Leaf(HashLeaf {
                    desc: "enums!".to_string(),
                    text: "Click to see groups".to_string(),
                    token_aliases: None,
                }),
            ),
            (
                "id2".to_string(),
                HashNode::Leaf(HashLeaf {
                    desc: "enums!".to_string(),
                    text: "Click to see photos".to_string(),
                    token_aliases: None,
                }),
            ),
            (
                "id3".to_string(),
                HashNode::Leaf(HashLeaf {
                    desc: "enums!".to_string(),
                    text: "Click to see videos".to_string(),
                    token_aliases: None,
                }),
            ),
        ]);
        assert_eq!(fbt_hash_key(&tree), "3SHnwE");
    }

    #[test]
    fn hashes_subject_tables_like_babel() {
        let tree = HashNode::Object(vec![(
            "*".to_string(),
            HashNode::Leaf(HashLeaf {
                desc: "Bar".to_string(),
                text: "Foo".to_string(),
                token_aliases: None,
            }),
        )]);
        assert_eq!(fbt_hash_key(&tree), "7I4k2");
    }

    #[test]
    fn collapses_repeated_number_variations() {
        let phrase = Phrase {
            desc: "plurals".to_string(),
            module: ModuleName::Fbt,
            options: CallOptions::default(),
            parts: vec![
                Part::Text("There ".to_string()),
                Part::Plural {
                    singular: "is ".to_string(),
                    count: Box::new(Expr::Ident(Ident::new_no_ctxt("count".into(), DUMMY_SP))),
                    many: "are ".to_string(),
                    show_count: "no".to_string(),
                    name: None,
                    value: None,
                },
                Part::Plural {
                    singular: "a like".to_string(),
                    count: Box::new(Expr::Ident(Ident::new_no_ctxt("count".into(), DUMMY_SP))),
                    many: "likes".to_string(),
                    show_count: "ifMany".to_string(),
                    name: Some("number".to_string()),
                    value: None,
                },
            ],
        };
        let mut variations = Vec::new();
        collect_variation_parts(&phrase.parts, &mut variations);
        let builder = RuntimeBuilder::new(&phrase, &variations, &phrase.parts, None);
        let table = builder.table();
        let hash = fbt_hash_key(&builder.hash_tree());
        assert_eq!(hash, "41Uj4v");
        match table {
            RuntimeNode::Object(items) => {
                assert!(
                    matches!(&items[0].1, RuntimeNode::Object(inner) if inner.len() == 1 && inner[0].0 == "*")
                );
                assert!(
                    matches!(&items[1].1, RuntimeNode::Object(inner) if inner.len() == 1 && inner[0].0 == "_1")
                );
            }
            RuntimeNode::String(_) => panic!("expected branch"),
        }
    }

    #[test]
    #[should_panic(
        expected = "fbt text contains an unsupported function call. Wrap dynamic values in fbt.param(...)."
    )]
    fn unsupported_callsite_panics_instead_of_falling_through() {
        transform(
            "import { fbt } from 'fbtee'; const x = fbt(foo(), 'desc');",
            default_options(),
        );
    }

    #[test]
    fn resolves_enum_manifest_by_module_basename() {
        let mut options = default_options();
        options.fbt_enum_manifest.insert(
            "Example$FbtEnum".to_string(),
            IndexMap::from([
                ("id1".to_string(), "groups".to_string()),
                ("id2".to_string(), "photos".to_string()),
            ]),
        );
        let output = transform(
            "import Example from './Example$FbtEnum.ts'; import { fbt } from 'fbtee'; const x = fbt('Click to see ' + fbt.enum(id, Example), 'enums!');",
            options,
        );
        assert!(output.contains("id1: \"Click to see groups\""), "{output}");
        assert!(output.contains("fbt._enum(id, Example)"), "{output}");
    }

    #[test]
    fn does_not_transform_shadowed_function_params() {
        let output = transform(
            "function test(fbt) { return fbt('A', 'B'); }",
            default_options(),
        );
        assert!(!output.contains("fbt._"), "{output}");
        assert!(!output.contains("from \"fbtee\""), "{output}");
    }

    #[test]
    fn pre_registers_later_local_bindings_before_transforming_calls() {
        let output = transform(
            "const x = fbt('A', 'B'); function fbt() {}",
            default_options(),
        );
        assert!(!output.contains("fbt._"), "{output}");
        assert!(!output.contains("from \"fbtee\""), "{output}");
    }

    #[test]
    fn transforms_bound_runtime_imports_like_babel() {
        let output = transform(
            "import { fbt } from '../index'; const x = fbt('A', 'B');",
            default_options(),
        );
        assert!(output.contains("fbt._(\"A\", null"), "{output}");
        assert!(!output.contains("from \"fbtee\""), "{output}");
    }

    #[test]
    fn recognizes_commonjs_require_binding() {
        let output = transform(
            "const fbt = require('fbtee'); const x = fbt('A', 'B');",
            default_options(),
        );
        assert!(output.contains("fbt._(\"A\", null"), "{output}");
        assert!(!output.contains("import { fbt }"), "{output}");
    }

    #[test]
    fn scoped_commonjs_requires_do_not_satisfy_top_level_auto_imports() {
        let output = transform(
            "if (cond) { const fbt = require('fbtee'); const x = fbt('A', 'B'); } const y = <fbt desc='d'>C</fbt>;",
            default_options(),
        );
        assert!(output.contains("import { fbt }"), "{output}");
        assert!(output.contains("const fbt = require('fbtee')"), "{output}");
        assert_eq!(output.matches("fbt._(\"A\", null").count(), 1, "{output}");
        assert_eq!(output.matches("fbt._(\"C\", null").count(), 1, "{output}");
    }

    #[test]
    fn registers_enum_manifest_from_commonjs_require() {
        let mut options = default_options();
        options.fbt_enum_manifest.insert(
            "Example$FbtEnum".to_string(),
            IndexMap::from([
                ("id1".to_string(), "groups".to_string()),
                ("id2".to_string(), "photos".to_string()),
            ]),
        );
        let output = transform(
            "const fbt = require('fbtee'); const Example = require('./Example$FbtEnum'); const x = fbt('Click to see ' + fbt.enum(id, Example), 'enums!');",
            options,
        );
        assert!(output.contains("id1: \"Click to see groups\""), "{output}");
        assert!(output.contains("fbt._enum(id, Example)"), "{output}");
    }

    #[test]
    fn preserves_directive_prologues_when_auto_importing() {
        let output = transform(
            "\"use client\"; const x = <fbt desc='d'>A</fbt>;",
            default_options(),
        );
        let directive = output.find("\"use client\"").expect(&output);
        let import = output.find("from \"fbtee\"").expect(&output);
        assert!(directive < import, "{output}");
    }

    #[test]
    fn preserves_fbt_list_argument_order() {
        let output = transform(
            "import { fbt } from 'fbtee'; const x = fbt('Available Locations: ' + fbt.list('locations', items, 'or', 'bullet'), 'Lists');",
            default_options(),
        );
        assert!(
            output.contains("fbt._list(\"locations\", items, 'or', 'bullet')"),
            "{output}"
        );
    }

    #[test]
    fn transforms_nested_fbt_calls_inside_list_items() {
        let output = transform(
            "import { fbt } from 'fbtee'; const x = <fbt desc='List example.'>Share <fbt:list name='list' conjunction='or' items={[<fbt desc='Item in a list.' key='photo'>a photo</fbt>, <fbt desc='Item in a list.' key='link'>a link</fbt>]} /></fbt>;",
            default_options(),
        );
        assert!(output.contains("fbt._list(\"list\", ["), "{output}");
        assert!(output.contains("fbt._(\"a photo\", null"), "{output}");
        assert!(output.contains("fbt._(\"a link\", null"), "{output}");
        assert!(!output.contains("<fbt"), "{output}");
    }

    #[test]
    fn uses_runtime_number_variation_id_and_expression_value() {
        let output = transform(
            "import { fbt } from 'fbtee'; const x = fbt('Count: ' + fbt.param('count', label, { number: count }), 'desc');",
            default_options(),
        );
        assert!(
            output.contains("fbt._param(\"count\", label, [\n        0,\n        count\n    ])"),
            "{output}"
        );
        assert!(!output.contains("[\n        2"), "{output}");
    }

    #[test]
    #[should_panic(expected = "Option 'number' must be an expression or true")]
    fn rejects_string_boolean_options_in_functional_syntax() {
        transform(
            "import { fbt } from 'fbtee'; const x = fbt('Count: ' + fbt.param('count', count, { number: 'true' }) + ' ' + fbt.pronoun('object', gender, { human: 'true' }), 'desc');",
            default_options(),
        );
    }

    #[test]
    fn extracts_single_jsx_param_expression_directly() {
        let output = transform(
            "import { fbt } from 'fbtee'; const x = <fbt desc='d'>Hello <fbt:param name='foo'>{foo}</fbt:param></fbt>;",
            default_options(),
        );
        assert!(output.contains("fbt._param(\"foo\", foo)"), "{output}");
        assert!(!output.contains("React.Fragment"), "{output}");
    }

    #[test]
    fn matches_babel_aliases_for_implicit_jsx_params() {
        let output = transform(
            "import { fbt } from 'fbtee'; const x = <fbt desc='d'>Hello <b>world</b></fbt>;",
            default_options(),
        );
        assert!(output.contains("\"Hello {=m1}\""), "{output}");
        assert!(output.contains("fbt._implicitParam(\"=m1\""), "{output}");
        assert!(output.contains("<b>{fbt._(\"world\", null"), "{output}");
        assert!(output.contains("hk: \"h8w0J\""), "{output}");
        assert!(!output.contains("\"Hello {=world}\""), "{output}");
    }

    #[test]
    fn hashes_nested_implicit_jsx_params_with_outer_phrase_context() {
        let output = transform(
            "import { fbt } from 'fbtee'; const x = <fbt desc='d'>Hello <b>world <i>inner</i></b></fbt>;",
            default_options(),
        );
        assert!(output.contains("\"Hello {=m1}\""), "{output}");
        assert!(output.contains("\"world {=m1}\""), "{output}");
        assert!(output.contains("hk: \"36nzit\""), "{output}");
        assert!(output.contains("hk: \"2YVHfO\""), "{output}");
        assert!(output.contains("hk: \"2JgOvk\""), "{output}");
    }

    #[test]
    fn matches_babel_for_multiline_nested_implicit_aliases() {
        let output = transform(
            "import { fbt } from 'fbtee'; const x = <fbt desc='d'>\n  <div href='#'>\n    <div href='#'>this is</div>\n    a doubly\n  </div>\n  nested test\n</fbt>;",
            default_options(),
        );
        assert!(output.contains("\"{=m1} a doubly\""), "{output}");
        assert!(output.contains("fbt._implicitParam(\"=m1\""), "{output}");
        assert!(output.contains("hk: \"1OBj79\""), "{output}");
    }

    #[test]
    fn handles_jsx_same_param_constructs() {
        let output = transform(
            "import { fbt } from 'fbtee'; const x = <fbt desc='d'><fbt:param name='foo'>{foo}</fbt:param> and <fbt:same-param name='foo' /></fbt>;",
            default_options(),
        );
        assert!(output.contains("\"{foo} and {foo}\""), "{output}");
        assert_eq!(
            output.matches("fbt._param(\"foo\", foo)").count(),
            1,
            "{output}"
        );
    }

    #[test]
    fn includes_non_human_reflexive_pronoun_branch() {
        let output = transform(
            "import { fbt } from 'fbtee'; const x = fbt('I saw ' + fbt.pronoun('reflexive', gender), 'desc');",
            default_options(),
        );
        assert!(output.contains("\"0\": \"I saw themself\""), "{output}");
    }

    #[test]
    fn correlates_pronouns_that_share_a_gender() {
        let output = transform(
            "import { fbt } from 'fbtee'; const x = fbt(fbt.pronoun('subject', gender, { capitalize: true, human: true }) + ' wished ' + fbt.pronoun('reflexive', gender, { human: true }) + ' a happy birthday.', 'subject+reflexive pronouns');",
            default_options(),
        );
        assert!(
            output.contains("\"1\": \"She wished herself a happy birthday.\""),
            "{output}"
        );
        assert!(!output.contains("She wished himself"), "{output}");
        assert!(!output.contains("They wished herself"), "{output}");
        assert!(output.contains("hk: \"2MyuU3\""), "{output}");
    }

    #[test]
    fn preserves_singular_whitespace_between_jsx_constructs() {
        let output = transform(
            "import { fbt } from 'fbtee'; const x = <fbt desc=''>\n  You can add\n  <fbt:plural count={count} many='these'>\n    this\n  </fbt:plural>\n  <fbt:plural count={count} many='tags'>\n    tag\n  </fbt:plural>\n  to anything.\n</fbt>;",
            default_options(),
        );
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
        let error = transform_error(
            "import { fbt } from 'fbtee'; const x = <fbt desc='d'><fbt:param name='foo'>{foo}</fbt:param> <b><fbt:name name='foo' gender={gender}>{person}</fbt:name></b></fbt>;",
            default_options(),
        );
        assert!(error.contains("Token 'foo' is already used"), "{error}");

        let output = transform(
            "import { fbt } from 'fbtee'; const x = <fbt desc='d'><fbt:param name='foo'>{foo}</fbt:param> <b><fbt:same-param name='foo' /></b></fbt>;",
            default_options(),
        );
        assert!(output.contains("fbt._(\"{foo}\", null"), "{output}");
        assert!(output.contains("hk: \"2eNYI0\""), "{output}");
    }

    #[test]
    fn normalizes_descriptions_before_hashing() {
        let output = transform(
            "import { fbt } from 'fbtee'; const x = fbt('A', 'desc with    spaces');",
            default_options(),
        );
        let expected = fbt_hash_key(&HashNode::Leaf(HashLeaf {
            desc: "desc with spaces".to_string(),
            text: "A".to_string(),
            token_aliases: None,
        }));
        assert!(output.contains(&format!("hk: \"{expected}\"")), "{output}");
    }

    #[test]
    fn resolves_jsx_common_strings_before_hashing() {
        let mut options = default_options();
        options
            .fbt_common
            .insert("Required".to_string(), "A required field label".to_string());
        let output = transform("const x = <fbt common>\n  Required\n</fbt>;", options);
        let expected = fbt_hash_key(&HashNode::Leaf(HashLeaf {
            desc: "A required field label".to_string(),
            text: "Required".to_string(),
            token_aliases: None,
        }));
        assert!(output.contains(&format!("hk: \"{expected}\"")), "{output}");
    }

    #[test]
    #[should_panic(
        expected = "Unknown common string 'Missing'. Add it to 'fbtCommon' or use a 'desc' attribute."
    )]
    fn rejects_unknown_jsx_common_strings() {
        transform("const x = <fbt common>Missing</fbt>;", default_options());
    }

    #[test]
    #[should_panic(expected = "<fbt> needs one of these attributes: desc, common.")]
    fn rejects_jsx_fbt_without_desc_or_common() {
        transform("const x = <fbt>Missing desc</fbt>;", default_options());
    }

    #[test]
    #[should_panic(
        expected = "Do not put <fbt> directly inside <fbt>. Remove the inner tag or wrap it in a normal JSX element."
    )]
    fn rejects_directly_nested_fbt_jsx_elements() {
        transform(
            "import { fbt } from 'fbtee'; const x = <fbt desc='outer'>A <fbt desc='inner'>B</fbt></fbt>;",
            default_options(),
        );
    }

    #[test]
    #[should_panic(
        expected = "Do not put <fbs> directly inside <fbs>. Remove the inner tag or wrap it in a normal JSX element."
    )]
    fn rejects_directly_nested_fbs_jsx_elements() {
        transform(
            "import { fbs } from 'fbtee'; const x = <fbs desc='outer'>A <fbs desc='inner'>B</fbs></fbs>;",
            default_options(),
        );
    }

    #[test]
    fn passes_object_ranges_to_runtime_for_array_enums() {
        let output = transform(
            "import { fbt } from 'fbtee'; const x = fbt('Click to see ' + fbt.enum(id, ['groups', 'photos']), 'enums!');",
            default_options(),
        );
        assert!(
            output.contains("fbt._enum(id, {\n        groups: \"groups\""),
            "{output}"
        );
        assert!(!output.contains("fbt._enum(id, ["), "{output}");
    }

    #[test]
    fn transforms_nested_fbt_calls_inside_param_values() {
        let output = transform(
            "import { fbt } from 'fbtee'; const x = fbt('Outer ' + fbt.param('x', fbt('Inner', 'inner desc')), 'outer desc');",
            default_options(),
        );
        assert!(output.contains("fbt._(\"Inner\", null"), "{output}");
        assert!(!output.contains("fbt(\"Inner\""), "{output}");
    }

    #[test]
    fn transforms_constructs_inside_functional_jsx() {
        let output = transform(
            "import { fbt } from 'fbtee'; const x = fbt(['A ', <b>{fbt.param('x', x)}</b>], 'd');",
            default_options(),
        );
        assert!(output.contains("fbt._param(\"x\", x)"), "{output}");
        assert!(!output.contains("fbt.param"), "{output}");
    }

    #[test]
    fn propagates_variations_into_nested_implicit_phrases() {
        let output = transform(
            "import { fbt } from 'fbtee'; const x = <fbt desc='example 1'><fbt:param gender={gender} name='name'><b>{name}</b></fbt:param> has shared <a><fbt:plural count={count} many='photos' showCount='ifMany'>a photo</fbt:plural></a> with you</fbt>;",
            default_options(),
        );
        assert!(output.contains("hk: \"46j2Ai\""), "{output}");
        assert!(output.contains("hk: \"BNUvh\""), "{output}");
    }

    #[test]
    fn avoids_capturing_user_identifiers_with_shared_variation_temporaries() {
        let output = transform(
            "import { fbt } from 'fbtee'; const x = <fbt desc='d'><b><fbt:plural count={count}>cat</fbt:plural></b><fbt:param name='x'>{__fbtee_shared_0}</fbt:param></fbt>;",
            default_options(),
        );
        assert!(output.contains("__fbtee_shared__0"), "{output}");
        assert!(
            output.contains("fbt._param(\"x\", __fbtee_shared_0)"),
            "{output}"
        );
    }

    #[test]
    fn statically_evaluates_functional_text_options() {
        let output = transform(
            "import { fbt } from 'fbtee'; const x = fbt('A', 'd', {author: 'c' + 'd', project: 'a' + 'b'});",
            default_options(),
        );
        assert!(output.contains("project: \"ab\""), "{output}");
    }

    #[test]
    fn rejects_false_jsx_number_options() {
        for source in [
            "import { fbt } from 'fbtee'; const x = <fbt desc='d'><fbt:param name='x' number={false}>{value}</fbt:param></fbt>;",
            "import { fbt } from 'fbtee'; const x = <fbt desc='d'><fbt:param name='x' number='false'>{value}</fbt:param></fbt>;",
        ] {
            let error = transform_error(source, default_options());
            assert!(
                error.contains("Option 'number' must be an expression or true"),
                "{error}"
            );
        }
    }
}
