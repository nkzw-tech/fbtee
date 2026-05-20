use serde::Deserialize;
use std::collections::{BTreeMap, BTreeSet};
use swc_core::{
    common::DUMMY_SP,
    ecma::{
        ast::*,
        atoms::Wtf8Atom,
        visit::{noop_visit_mut_type, VisitMut, VisitMutWith},
    },
    plugin::{plugin_transform, proxies::TransformPluginProgramMetadata},
};

const GENDER: i32 = 1;
const NUMBER: i32 = 0;

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PluginOptions {
    #[serde(default)]
    collect_fbt: bool,
    #[serde(default)]
    fbt_common: BTreeMap<String, String>,
    #[serde(default)]
    fbt_enum_manifest: BTreeMap<String, BTreeMap<String, String>>,
}

#[plugin_transform]
pub fn process_transform(program: Program, metadata: TransformPluginProgramMetadata) -> Program {
    let options = match metadata.get_transform_plugin_config() {
        Some(config) => serde_json::from_str::<PluginOptions>(&config).unwrap_or_else(|error| {
            compile_error(&format!("Invalid fbtee SWC plugin config: {error}"))
        }),
        None => PluginOptions::default(),
    };
    if options.collect_fbt {
        compile_error(
            "collectFbt is not supported by the fbtee SWC runtime compiler; use the Babel collector to extract phrases",
        );
    }

    let mut program = program;
    program.visit_mut_with(&mut FbteeTransform::new(options));
    program
}

struct FbteeTransform {
    options: PluginOptions,
    imported_enums: BTreeMap<String, BTreeMap<String, String>>,
    local_bindings: Vec<BTreeMap<String, LocalBinding>>,
    seen_fbs_import: bool,
    seen_fbt_import: bool,
    fbs_ident: Option<Ident>,
    fbt_ident: Option<Ident>,
    used_fbs: bool,
    used_fbt: bool,
}

#[derive(Clone)]
enum LocalBinding {
    Local,
    Fbtee(Ident),
}

impl FbteeTransform {
    fn new(options: PluginOptions) -> Self {
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

    fn mark_imported_binding(&mut self, ident: &Ident) {
        match ident.sym.as_ref() {
            "fbt" => {
                self.seen_fbt_import = true;
                self.fbt_ident = Some(ident.clone());
            }
            "fbs" => {
                self.seen_fbs_import = true;
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
                                self.mark_imported_binding(&default.local);
                            }
                            ImportSpecifier::Named(named) => {
                                self.mark_imported_binding(&named.local);
                            }
                            ImportSpecifier::Namespace(namespace) => {
                                self.mark_imported_binding(&namespace.local);
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

    fn enum_manifest_from_require(&self, expr: Option<&Expr>) -> Option<BTreeMap<String, String>> {
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
                ImportSpecifier::Default(default) => self.mark_imported_binding(&default.local),
                ImportSpecifier::Named(named) => self.mark_imported_binding(&named.local),
                ImportSpecifier::Namespace(namespace) => {
                    self.mark_imported_binding(&namespace.local)
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
                        ImportSpecifier::Named(named) => {
                            self.imported_enums
                                .insert(named.local.sym.to_string(), enum_map.clone());
                        }
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
                *expr = Box::new(next);
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
                    "fbt constructs must be used within the scope of other fbt constructs",
                );
            }
            return None;
        }

        self.transform_fbt_call(call, module)
    }

    fn transform_common_call(&mut self, call: &CallExpr, module: ModuleName) -> Option<Expr> {
        let label = call
            .args
            .first()
            .and_then(arg_as_string)
            .unwrap_or_else(|| {
                compile_error("Expected common string call to have a string literal argument")
            });
        let desc = self
            .options
            .fbt_common
            .get(&label)
            .cloned()
            .unwrap_or_else(|| compile_error(&format!("Unknown common string `{label}`")));

        let phrase = Phrase {
            desc,
            module,
            options: CallOptions::default(),
            parts: vec![Part::Text(label)],
        };
        Some(self.runtime_call(phrase))
    }

    fn transform_fbt_call(&mut self, call: &CallExpr, module: ModuleName) -> Option<Expr> {
        let raw_contents = call
            .args
            .first()
            .map(|arg| arg.expr.as_ref())
            .unwrap_or_else(|| compile_error("Expected fbt calls to have at least two arguments"));
        let options = call
            .args
            .get(2)
            .map(|arg| parse_call_options(&arg.expr))
            .unwrap_or_default();
        let desc = normalize_spaces(
            &call.args.get(1).and_then(arg_as_string).unwrap_or_else(|| {
                compile_error("Expected fbt description to be a string literal")
            }),
            options.preserve_whitespace,
        );
        let parts = self
            .parse_expr_contents(raw_contents, module, &options)
            .unwrap_or_else(|error| compile_error(&error));

        Some(self.runtime_call(Phrase {
            desc,
            module,
            options,
            parts,
        }))
    }

    fn transform_jsx_fragment(&mut self, fragment: &JSXFragment) -> Option<Expr> {
        let children = self.jsx_children_to_expr(&fragment.children);
        children.map(Expr::JSXFragment).or_else(|| {
            Some(Expr::JSXFragment(JSXFragment {
                span: fragment.span,
                opening: fragment.opening.clone(),
                children: vec![],
                closing: fragment.closing.clone(),
            }))
        })
    }

    fn transform_jsx_element(&mut self, element: &JSXElement) -> Option<Expr> {
        let (module, node) = jsx_element_kind(&element.opening.name)?;
        if let Some(kind) = node {
            let options = CallOptions::default();
            let parts = self
                .parse_jsx_construct(element, module, kind, &options)
                .unwrap_or_else(|error| compile_error(&error));
            return Some(self.runtime_call(Phrase {
                desc: String::new(),
                module,
                options,
                parts,
            }));
        }

        let attrs = JsxAttrs::new(&element.opening.attrs);
        let options = CallOptions {
            preserve_whitespace: attrs.boolish("preserveWhitespace").unwrap_or(false),
            project: attrs.string("project"),
            subject: attrs.expr("subject"),
        };

        let desc = if attrs.boolish("common").unwrap_or(false) {
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
                .unwrap_or_else(|| compile_error(&format!("Unknown common string `{text}`")))
        } else if let Some(desc) = attrs.string("desc").or_else(|| attrs.string("common")) {
            normalize_spaces(&desc, options.preserve_whitespace)
        } else {
            compile_error("Expected JSX fbt call to have a desc or common attribute")
        };

        let parts = self
            .parse_jsx_children(&element.children, module, &options, &element.children)
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
        match expr {
            Expr::Lit(Lit::Str(value)) => Ok(vec![Part::Text(normalize_spaces(
                &wtf8_to_string(&value.value),
                options.preserve_whitespace,
            ))]),
            Expr::Array(array) => {
                let mut parts = vec![];
                for elem in array.elems.iter().flatten() {
                    parts.extend(self.parse_expr_contents(&elem.expr, module, options)?);
                }
                Ok(parts)
            }
            Expr::Bin(binary) if binary.op == BinaryOp::Add => {
                let mut parts = self.parse_expr_contents(&binary.left, module, options)?;
                parts.extend(self.parse_expr_contents(&binary.right, module, options)?);
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
                        parts.extend(self.parse_expr_contents(expr, module, options)?);
                    }
                }
                Ok(parts)
            }
            Expr::Call(call) => self.parse_construct_call(call, module, options),
            Expr::JSXElement(element) => {
                if let Some((child_module, None)) = jsx_element_kind(&element.opening.name) {
                    return Err(format!(
                        "Don't put <{}> directly within <{}>. This is redundant. The text is already translated so you don't need to translate it again",
                        child_module.as_str(),
                        module.as_str()
                    ));
                }
                let token = format!(
                    "={}",
                    normalize_spaces(&jsx_text_content(&element.children), false)
                );
                let mut value = Expr::JSXElement(element.clone());
                value.visit_mut_children_with(self);
                Ok(vec![Part::Param {
                    name: token,
                    hash_name: None,
                    value: Box::new(value),
                    variation: ParamVariation::None,
                    runtime_kind: ParamRuntimeKind::Implicit,
                }])
            }
            Expr::JSXFragment(fragment) => {
                let token = format!(
                    "={}",
                    normalize_spaces(&jsx_fragment_text_content(fragment), false)
                );
                let mut value = Expr::JSXFragment(fragment.clone());
                value.visit_mut_children_with(self);
                Ok(vec![Part::Param {
                    name: token,
                    hash_name: None,
                    value: Box::new(value),
                    variation: ParamVariation::None,
                    runtime_kind: ParamRuntimeKind::Implicit,
                }])
            }
            Expr::Paren(paren) => self.parse_expr_contents(&paren.expr, module, options),
            _ => Err("Unsupported fbtee contents".to_string()),
        }
    }

    fn parse_construct_call(
        &mut self,
        call: &CallExpr,
        module: ModuleName,
        _options: &CallOptions,
    ) -> Result<Vec<Part>, String> {
        let Some(method) = call_member_method(call) else {
            return Err("Unsupported call in fbtee contents".to_string());
        };

        if call_module_name(call) != Some(module) {
            return Err("Mismatched fbtee construct".to_string());
        }

        match method {
            "param" => {
                let name = arg_as_string(call.args.first().ok_or("Missing param name")?)
                    .ok_or("Expected param name")?;
                let mut value = call.args.get(1).ok_or("Missing param value")?.expr.clone();
                value.visit_mut_with(self);
                let options = call
                    .args
                    .get(2)
                    .map(|arg| parse_object(&arg.expr))
                    .unwrap_or_default();
                let variation = if let Some(number) = options.number_expr() {
                    ParamVariation::Number(number)
                } else if let Some(gender) = options.expr("gender") {
                    ParamVariation::Gender(gender)
                } else {
                    ParamVariation::None
                };
                Ok(vec![Part::Param {
                    name,
                    hash_name: None,
                    value,
                    variation,
                    runtime_kind: ParamRuntimeKind::Param,
                }])
            }
            "sameParam" => {
                let name = arg_as_string(call.args.first().ok_or("Missing sameParam name")?)
                    .ok_or("Expected sameParam name")?;
                Ok(vec![Part::SameParam { name }])
            }
            "name" => {
                let name = arg_as_string(call.args.first().ok_or("Missing name label")?)
                    .ok_or("Expected name label")?;
                let mut value = call.args.get(1).ok_or("Missing name value")?.expr.clone();
                value.visit_mut_with(self);
                let gender = call.args.get(2).ok_or("Missing name gender")?.expr.clone();
                Ok(vec![Part::Name {
                    name,
                    value,
                    gender,
                }])
            }
            "enum" => {
                let value = call.args.first().ok_or("Missing enum value")?.expr.clone();
                let range_expr = call.args.get(1).ok_or("Missing enum range")?.expr.clone();
                let range = self.enum_range_from_expr(&range_expr)?;
                Ok(vec![Part::Enum {
                    value,
                    range_expr,
                    range,
                }])
            }
            "plural" => {
                let singular = arg_as_string(call.args.first().ok_or("Missing plural singular")?)
                    .ok_or("Expected plural singular text")?;
                let count = call.args.get(1).ok_or("Missing plural count")?.expr.clone();
                let options = call
                    .args
                    .get(2)
                    .map(|arg| parse_object(&arg.expr))
                    .unwrap_or_default();
                let many = options
                    .string("many")
                    .unwrap_or_else(|| format!("{singular}s"));
                let show_count = options
                    .string("showCount")
                    .unwrap_or_else(|| "no".to_string());
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
                let usage = arg_as_string(call.args.first().ok_or("Missing pronoun usage")?)
                    .ok_or("Expected pronoun usage")?;
                let gender = call
                    .args
                    .get(1)
                    .ok_or("Missing pronoun gender")?
                    .expr
                    .clone();
                let options = call
                    .args
                    .get(2)
                    .map(|arg| parse_object(&arg.expr))
                    .unwrap_or_default();
                Ok(vec![Part::Pronoun {
                    usage,
                    gender,
                    human: options.get_bool("human").unwrap_or(false),
                    capitalize: options.get_bool("capitalize").unwrap_or(false),
                }])
            }
            "list" => {
                let name = arg_as_string(call.args.first().ok_or("Missing list label")?)
                    .ok_or("Expected list label")?;
                let mut items = call.args.get(1).ok_or("Missing list items")?.expr.clone();
                items.visit_mut_with(self);
                let conjunction = call.args.get(2).and_then(arg_as_string);
                let delimiter = call.args.get(3).and_then(arg_as_string);
                Ok(vec![Part::List {
                    name,
                    items,
                    conjunction,
                    delimiter,
                }])
            }
            _ => Err(format!("Unsupported fbtee construct {method}")),
        }
    }

    fn parse_jsx_children(
        &mut self,
        children: &[JSXElementChild],
        module: ModuleName,
        options: &CallOptions,
        description_children: &[JSXElementChild],
    ) -> Result<Vec<Part>, String> {
        let mut parts = vec![];
        for child in children {
            match child {
                JSXElementChild::JSXText(text) => {
                    let normalized =
                        normalize_spaces(&text.value.to_string(), options.preserve_whitespace);
                    if !normalized.trim().is_empty() {
                        parts.push(Part::Text(normalized));
                    }
                }
                JSXElementChild::JSXExprContainer(container) => match &container.expr {
                    JSXExpr::Expr(expr) => {
                        parts.extend(self.parse_expr_contents(expr, module, options)?);
                    }
                    JSXExpr::JSXEmptyExpr(_) => {}
                },
                JSXElementChild::JSXElement(element) => {
                    match jsx_element_kind(&element.opening.name) {
                        Some((child_module, Some(kind))) => {
                            if child_module != module {
                                return Err("Mismatched fbtee JSX construct".to_string());
                            }
                            parts.extend(self.parse_jsx_construct(element, module, kind, options)?);
                        }
                        Some((child_module, None)) => {
                            return Err(format!(
                                "Don't put <{}> directly within <{}>. This is redundant. The text is already translated so you don't need to translate it again",
                                child_module.as_str(),
                                module.as_str()
                            ));
                        }
                        None => {
                            let token = implicit_param_alias(parts.len());
                            let description_text = jsx_description_text_for_target(
                                description_children,
                                element,
                                options,
                            );
                            let value = self.implicit_jsx_element_value(
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
                                value: Box::new(Expr::JSXElement(Box::new(value))),
                                variation: ParamVariation::None,
                                runtime_kind: ParamRuntimeKind::Implicit,
                            });
                        }
                    }
                }
                JSXElementChild::JSXFragment(fragment) => {
                    let token = implicit_param_alias(parts.len());
                    let value = self.implicit_jsx_fragment_value(
                        fragment,
                        module,
                        options,
                        description_children,
                        &jsx_description_text(description_children, options),
                    )?;
                    parts.push(Part::Param {
                        name: token,
                        hash_name: Some(implicit_child_hash_name(child, options)),
                        value: Box::new(Expr::JSXFragment(value)),
                        variation: ParamVariation::None,
                        runtime_kind: ParamRuntimeKind::Implicit,
                    });
                }
                JSXElementChild::JSXSpreadChild(_) => {}
            }
        }
        Ok(compact_text_parts(parts))
    }

    fn implicit_jsx_element_value(
        &mut self,
        element: &JSXElement,
        module: ModuleName,
        options: &CallOptions,
        description_children: &[JSXElementChild],
        description_text: &str,
    ) -> Result<JSXElement, String> {
        let inner = self.implicit_children_runtime_expr(
            &element.children,
            module,
            options,
            description_children,
            description_text,
        )?;
        let mut element = element.clone();
        if let Some(inner) = inner {
            element.children = vec![JSXElementChild::JSXExprContainer(JSXExprContainer {
                span: DUMMY_SP,
                expr: JSXExpr::Expr(Box::new(inner)),
            })];
        } else {
            element.visit_mut_children_with(self);
        }
        Ok(element)
    }

    fn implicit_jsx_fragment_value(
        &mut self,
        fragment: &JSXFragment,
        module: ModuleName,
        options: &CallOptions,
        description_children: &[JSXElementChild],
        description_text: &str,
    ) -> Result<JSXFragment, String> {
        let inner = self.implicit_children_runtime_expr(
            &fragment.children,
            module,
            options,
            description_children,
            description_text,
        )?;
        let mut fragment = fragment.clone();
        if let Some(inner) = inner {
            fragment.children = vec![JSXElementChild::JSXExprContainer(JSXExprContainer {
                span: DUMMY_SP,
                expr: JSXExpr::Expr(Box::new(inner)),
            })];
        } else {
            fragment.visit_mut_children_with(self);
        }
        Ok(fragment)
    }

    fn implicit_children_runtime_expr(
        &mut self,
        children: &[JSXElementChild],
        module: ModuleName,
        options: &CallOptions,
        description_children: &[JSXElementChild],
        description_text: &str,
    ) -> Result<Option<Expr>, String> {
        let parts = self.parse_jsx_children(children, module, options, description_children)?;
        if parts.is_empty() {
            return Ok(None);
        }
        Ok(Some(self.runtime_call(Phrase {
            desc: format!("In the phrase: \"{description_text}\""),
            module,
            options: options.clone(),
            parts,
        })))
    }

    fn parse_jsx_construct(
        &mut self,
        element: &JSXElement,
        _module: ModuleName,
        kind: String,
        options: &CallOptions,
    ) -> Result<Vec<Part>, String> {
        let attrs = JsxAttrs::new(&element.opening.attrs);
        match kind.as_str() {
            "param" => {
                let name = attrs.string("name").ok_or("Missing JSX param name")?;
                let value = self.jsx_param_value(&element.children).unwrap_or_else(|| {
                    Expr::Lit(Lit::Str(Str {
                        span: DUMMY_SP,
                        value: Wtf8Atom::new(""),
                        raw: None,
                    }))
                });
                let variation = if let Some(number) = attrs.number_expr("number") {
                    ParamVariation::Number(number)
                } else if let Some(gender) = attrs.expr("gender") {
                    ParamVariation::Gender(gender)
                } else {
                    ParamVariation::None
                };
                Ok(vec![Part::Param {
                    name,
                    hash_name: None,
                    value: Box::new(value),
                    variation,
                    runtime_kind: ParamRuntimeKind::Param,
                }])
            }
            "same-param" | "sameParam" => {
                let name = attrs.string("name").ok_or("Missing JSX sameParam name")?;
                Ok(vec![Part::SameParam { name }])
            }
            "name" => {
                let name = attrs.string("name").ok_or("Missing JSX name label")?;
                let value = self.jsx_param_value(&element.children).unwrap_or_else(|| {
                    Expr::Lit(Lit::Str(Str {
                        span: DUMMY_SP,
                        value: Wtf8Atom::new(""),
                        raw: None,
                    }))
                });
                let gender = attrs.expr("gender").ok_or("Missing JSX name gender")?;
                Ok(vec![Part::Name {
                    name,
                    value: Box::new(value),
                    gender,
                }])
            }
            "enum" => {
                let value = attrs.expr("value").ok_or("Missing JSX enum value")?;
                let range_expr = attrs.expr("enum-range").ok_or("Missing JSX enum range")?;
                let range = self.enum_range_from_expr(&range_expr)?;
                Ok(vec![Part::Enum {
                    value,
                    range_expr,
                    range,
                }])
            }
            "plural" => {
                let singular = normalize_spaces(
                    &jsx_text_content(&element.children),
                    options.preserve_whitespace,
                )
                .trim()
                .to_string();
                let count = attrs.expr("count").ok_or("Missing JSX plural count")?;
                let many = attrs
                    .string("many")
                    .unwrap_or_else(|| format!("{singular}s"));
                let show_count = attrs
                    .string("showCount")
                    .unwrap_or_else(|| "no".to_string());
                let name = attrs.string("name").or_else(|| {
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
                let usage = attrs.string("type").ok_or("Missing JSX pronoun type")?;
                let gender = attrs.expr("gender").ok_or("Missing JSX pronoun gender")?;
                Ok(vec![Part::Pronoun {
                    usage,
                    gender,
                    human: attrs.boolish("human").unwrap_or(false),
                    capitalize: attrs.boolish("capitalize").unwrap_or(false),
                }])
            }
            "list" => {
                let name = attrs.string("name").ok_or("Missing JSX list name")?;
                let mut items = attrs.expr("items").ok_or("Missing JSX list items")?;
                items.visit_mut_with(self);
                Ok(vec![Part::List {
                    name,
                    items,
                    conjunction: attrs.string("conjunction"),
                    delimiter: attrs.string("delimiter"),
                }])
            }
            _ => Err(format!("Unsupported JSX fbtee construct {kind}")),
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
                            expr = Box::new(next);
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

    fn jsx_param_value(&mut self, children: &[JSXElementChild]) -> Option<Expr> {
        let meaningful: Vec<&JSXElementChild> = children
            .iter()
            .filter(|child| match child {
                JSXElementChild::JSXText(text) => {
                    !normalize_spaces(&text.value, false).trim().is_empty()
                }
                JSXElementChild::JSXExprContainer(container) => {
                    !matches!(container.expr, JSXExpr::JSXEmptyExpr(_))
                }
                _ => true,
            })
            .collect();

        if meaningful.len() == 1 {
            match meaningful[0] {
                JSXElementChild::JSXExprContainer(container) => {
                    if let JSXExpr::Expr(expr) = &container.expr {
                        let mut expr = expr.clone();
                        if let Some(next) = self.transform_expr(&expr) {
                            expr = Box::new(next);
                        } else {
                            expr.visit_mut_children_with(self);
                        }
                        return Some(*expr);
                    }
                }
                JSXElementChild::JSXElement(element) => {
                    if let Some(expr) = self.transform_jsx_element(element) {
                        return Some(expr);
                    }
                }
                _ => {}
            }
        }

        self.jsx_children_to_expr(children).map(Expr::JSXFragment)
    }

    fn enum_range_from_expr(&self, expr: &Box<Expr>) -> Result<Vec<(String, String)>, String> {
        match expr.as_ref() {
            Expr::Array(array) => Ok(array
                .elems
                .iter()
                .flatten()
                .filter_map(|elem| expr_as_string(&elem.expr).map(|value| (value.clone(), value)))
                .collect()),
            Expr::Object(object) => object
                .props
                .iter()
                .map(|prop| match prop {
                    PropOrSpread::Prop(prop) => match prop.as_ref() {
                        Prop::KeyValue(key_value) => {
                            let key = prop_name_to_string(&key_value.key)
                                .ok_or("Unsupported enum object key")?;
                            let value = expr_as_string(&key_value.value)
                                .ok_or("Unsupported enum object value")?;
                            Ok((key, value))
                        }
                        _ => Err("Unsupported enum object property".to_string()),
                    },
                    PropOrSpread::Spread(_) => Err("Unsupported enum spread".to_string()),
                })
                .collect(),
            Expr::Ident(ident) => self
                .imported_enums
                .get(&ident.sym.to_string())
                .map(|range| {
                    range
                        .iter()
                        .map(|(key, value)| (key.clone(), value.clone()))
                        .collect()
                })
                .ok_or_else(|| format!("Unknown enum range {}", ident.sym)),
            _ => Err("Unsupported enum range".to_string()),
        }
    }

    fn runtime_call(&mut self, phrase: Phrase) -> Expr {
        match phrase.module {
            ModuleName::Fbt => self.used_fbt = true,
            ModuleName::Fbs => self.used_fbs = true,
        }
        let module_ident = self.module_ident(phrase.module);
        let mut builder = RuntimeBuilder::new(&phrase, module_ident.clone());
        let table = builder.table();
        let hash_tree = builder.hash_tree();
        let hk = fbt_hash_key(&hash_tree);

        let mut args = vec![
            ExprOrSpread {
                spread: None,
                expr: Box::new(table.expr()),
            },
            ExprOrSpread {
                spread: None,
                expr: Box::new(if builder.runtime_args.is_empty() {
                    null_expr()
                } else {
                    Expr::Array(ArrayLit {
                        span: DUMMY_SP,
                        elems: builder
                            .runtime_args
                            .into_iter()
                            .map(|expr| {
                                Some(ExprOrSpread {
                                    spread: None,
                                    expr: Box::new(expr),
                                })
                            })
                            .collect(),
                    })
                }),
            },
        ];

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

        args.push(ExprOrSpread {
            spread: None,
            expr: Box::new(Expr::Object(ObjectLit {
                span: DUMMY_SP,
                props: option_props,
            })),
        });

        Expr::Call(CallExpr {
            span: DUMMY_SP,
            ctxt: Default::default(),
            callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                span: DUMMY_SP,
                obj: Box::new(Expr::Ident(module_ident.clone())),
                prop: MemberProp::Ident(IdentName::new("_".into(), DUMMY_SP)),
            }))),
            args,
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
enum Part {
    Text(String),
    Param {
        name: String,
        hash_name: Option<String>,
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
        conjunction: Option<String>,
        delimiter: Option<String>,
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

struct RuntimeBuilder<'a> {
    phrase: &'a Phrase,
    module_ident: Ident,
    runtime_args: Vec<Expr>,
    runtime_tokens: BTreeSet<String>,
}

#[derive(Clone)]
struct Variation {
    index: usize,
    keys: Vec<String>,
    group: Option<String>,
}

fn keys_for_depth(
    variations: &[Variation],
    depth: usize,
    selected: &[(usize, String)],
) -> Vec<String> {
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
        Part::Plural { count, .. } => Some(format!("number-param:{}", expr_group_key(count))),
        Part::Pronoun {
            usage,
            gender,
            human,
            ..
        } => Some(format!(
            "pronoun:{}:{}:{}",
            usage,
            human,
            expr_group_key(gender)
        )),
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

impl<'a> RuntimeBuilder<'a> {
    fn new(phrase: &'a Phrase, module_ident: Ident) -> Self {
        Self {
            phrase,
            module_ident,
            runtime_args: vec![],
            runtime_tokens: BTreeSet::new(),
        }
    }

    fn table(&mut self) -> RuntimeNode {
        let variations = self.variation_parts();
        if let Some(subject) = &self.phrase.options.subject {
            self.runtime_args.push(runtime_helper(
                &self.module_ident,
                "_subject",
                vec![*subject.clone()],
            ));
        }
        for part in &self.phrase.parts {
            self.collect_runtime_arg(part);
        }

        if variations.is_empty() {
            return RuntimeNode::String(self.pattern_for(&[], false));
        }

        self.branch(&variations, 0, &mut vec![])
    }

    fn hash_tree(&self) -> HashNode {
        let variations = self.variation_parts();
        if variations.is_empty() {
            return HashNode::Leaf(HashLeaf {
                desc: self.phrase.desc.clone(),
                text: self.pattern_for(&[], true),
                token_aliases: self.hash_token_aliases(),
            });
        }
        self.hash_branch(&variations, 0, &mut vec![])
    }

    fn variation_parts(&self) -> Vec<Variation> {
        let mut variations = vec![];
        if self.phrase.options.subject.is_some() {
            variations.push(Variation {
                index: usize::MAX,
                keys: vec!["*".to_string()],
                group: Some("subject".to_string()),
            });
        }
        for (index, part) in self.phrase.parts.iter().enumerate() {
            let keys = match part {
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
            return RuntimeNode::String(self.pattern_for(selected, false));
        }

        let variation = &variations[depth];
        let mut items = vec![];
        let keys = keys_for_depth(variations, depth, selected);
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
            return HashNode::Leaf(HashLeaf {
                desc: self.phrase.desc.clone(),
                text: self.pattern_for(selected, true),
                token_aliases: self.hash_token_aliases(),
            });
        }

        let variation = &variations[depth];
        let mut items = vec![];
        let keys = keys_for_depth(variations, depth, selected);
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

    fn pattern_for(&self, selected: &[(usize, String)], use_hash_tokens: bool) -> String {
        let selected: BTreeMap<usize, String> = selected.iter().cloned().collect();
        let mut output = String::new();
        for (index, part) in self.phrase.parts.iter().enumerate() {
            match part {
                Part::Text(text) => output.push_str(text),
                Part::Param {
                    name, hash_name, ..
                } => {
                    let name = if use_hash_tokens {
                        hash_name.as_ref().unwrap_or(name)
                    } else {
                        name
                    };
                    output.push_str(&format!("{{{name}}}"));
                }
                Part::SameParam { name } | Part::Name { name, .. } | Part::List { name, .. } => {
                    output.push_str(&format!("{{{name}}}"));
                }
                Part::Enum { range, .. } => {
                    let key = selected.get(&index);
                    let text = key
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
                    let is_singular = selected.get(&index).map(|key| key == "_1").unwrap_or(false);
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
                    let key = selected.get(&index).map(String::as_str).unwrap_or("*");
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
        normalize_spaces(&output, self.phrase.options.preserve_whitespace)
            .trim()
            .to_string()
    }

    fn collect_runtime_arg(&mut self, part: &Part) {
        if let Part::Param { name, .. } = part {
            if !self.runtime_tokens.insert(name.clone()) {
                return;
            }
        }
        if !matches!(part, Part::Text(_) | Part::SameParam { .. }) {
            if let Some(expr) = runtime_arg_expr(&self.module_ident, part) {
                self.runtime_args.push(expr);
            }
        }
    }

    fn hash_token_aliases(&self) -> Option<BTreeMap<String, String>> {
        let aliases = self
            .phrase
            .parts
            .iter()
            .filter_map(|part| match part {
                Part::Param {
                    name,
                    hash_name: Some(hash_name),
                    runtime_kind: ParamRuntimeKind::Implicit,
                    ..
                } if hash_name != name => Some((hash_name.clone(), name.clone())),
                _ => None,
            })
            .collect::<BTreeMap<_, _>>();
        if aliases.is_empty() {
            None
        } else {
            Some(aliases)
        }
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
            if show_count == "yes" || show_count == "ifMany" || name.is_some() {
                args.push(match name {
                    Some(name) => string_expr(name.clone()),
                    None => null_expr(),
                });
            }
            if let Some(value) = value {
                if args.len() == 1 {
                    args.push(null_expr());
                }
                args.push(*value.clone());
            }
            Some(runtime_helper(module_ident, "_plural", args))
        }
        Part::Pronoun {
            usage,
            gender,
            human,
            ..
        } => {
            let mut args = vec![number_expr(pronoun_usage(usage)), *gender.clone()];
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
                        .map(string_expr)
                        .unwrap_or_else(null_expr),
                );
            }
            if let Some(delimiter) = delimiter {
                args.push(string_expr(delimiter.clone()));
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
    token_aliases: Option<BTreeMap<String, String>>,
}

fn call_module_name(call: &CallExpr) -> Option<ModuleName> {
    match &call.callee {
        Callee::Expr(expr) => match expr.as_ref() {
            Expr::Ident(ident) => match ident.sym.as_ref() {
                "fbt" => Some(ModuleName::Fbt),
                "fbs" => Some(ModuleName::Fbs),
                _ => None,
            },
            Expr::Member(member) => match member.obj.as_ref() {
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
        Callee::Expr(expr) => match expr.as_ref() {
            Expr::Member(member) => match &member.prop {
                MemberProp::Ident(ident) => Some(ident.sym.as_ref()),
                _ => None,
            },
            _ => None,
        },
        _ => None,
    }
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

#[derive(Default)]
struct ObjectOptions {
    strings: BTreeMap<String, String>,
    bools: BTreeMap<String, bool>,
    exprs: BTreeMap<String, Box<Expr>>,
}

impl ObjectOptions {
    fn string(&self, key: &str) -> Option<String> {
        self.strings.get(key).cloned()
    }

    fn get_bool(&self, key: &str) -> Option<bool> {
        self.bools.get(key).copied()
    }

    fn expr(&self, key: &str) -> Option<Box<Expr>> {
        self.exprs.get(key).cloned()
    }

    fn number_expr(&self) -> Option<Option<Box<Expr>>> {
        if let Some(value) = self.bools.get("number") {
            return (*value).then_some(None);
        }
        if let Some(value) = self.strings.get("number") {
            if value == "true" {
                return Some(None);
            }
            if value == "false" {
                return None;
            }
        }
        self.exprs.get("number").cloned().map(Some)
    }
}

fn parse_call_options(expr: &Expr) -> CallOptions {
    let object = parse_object(expr);
    CallOptions {
        preserve_whitespace: object.get_bool("preserveWhitespace").unwrap_or(false),
        project: object.string("project"),
        subject: object.expr("subject"),
    }
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
        match key_value.value.as_ref() {
            Expr::Lit(Lit::Str(value)) => {
                let value = wtf8_to_string(&value.value);
                if value == "true" || value == "false" {
                    options.bools.insert(key.clone(), value == "true");
                }
                options.strings.insert(key, value);
            }
            Expr::Lit(Lit::Bool(value)) => {
                options.bools.insert(key, value.value);
            }
            _ => {
                options.exprs.insert(key, key_value.value.clone());
            }
        }
    }
    options
}

fn compile_error(message: &str) -> ! {
    panic!("fbtee SWC plugin error: {message}");
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
        PropName::Num(value) => Some(value.value.to_string()),
        _ => None,
    }
}

fn implicit_param_alias(index: usize) -> String {
    format!("=m{index}")
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
        self.attr(key).map(|attr| match &attr.value {
            None => true,
            Some(JSXAttrValue::Str(value)) => value.value == "true",
            Some(JSXAttrValue::JSXExprContainer(container)) => match &container.expr {
                JSXExpr::Expr(expr) => match expr.as_ref() {
                    Expr::Lit(Lit::Bool(value)) => value.value,
                    Expr::Lit(Lit::Str(value)) => value.value == "true",
                    _ => false,
                },
                _ => false,
            },
            _ => false,
        })
    }

    fn number_expr(&self, key: &str) -> Option<Option<Box<Expr>>> {
        let attr = self.attr(key)?;
        match &attr.value {
            None => Some(None),
            Some(JSXAttrValue::Str(value)) => {
                let value = wtf8_to_string(&value.value);
                if value == "true" {
                    Some(None)
                } else {
                    None
                }
            }
            Some(JSXAttrValue::JSXExprContainer(container)) => match &container.expr {
                JSXExpr::Expr(expr) => match expr.as_ref() {
                    Expr::Lit(Lit::Bool(value)) => value.value.then_some(None),
                    _ => Some(Some(expr.clone())),
                },
                _ => None,
            },
            _ => None,
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
            JSXElementChild::JSXText(text) => output.push_str(&normalize_spaces(
                &text.value.to_string(),
                options.preserve_whitespace,
            )),
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

fn implicit_child_hash_name(child: &JSXElementChild, options: &CallOptions) -> String {
    let text = match child {
        JSXElementChild::JSXElement(element) => jsx_text_content(&element.children),
        JSXElementChild::JSXFragment(fragment) => jsx_fragment_text_content(fragment),
        _ => String::new(),
    };
    format!(
        "={}",
        normalize_spaces(&text, options.preserve_whitespace)
            .trim()
            .to_string()
    )
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

fn pronoun_usage(usage: &str) -> i32 {
    match usage {
        "object" => 0,
        "possessive" => 1,
        "reflexive" => 2,
        "subject" => 3,
        _ => 0,
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
        _ => vec![("*".to_string(), String::new())],
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
        module.visit_mut_with(&mut FbteeTransform::new(options));

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
        let mut builder = RuntimeBuilder::new(&phrase, Ident::new_no_ctxt("fbt".into(), DUMMY_SP));
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
        let mut builder = RuntimeBuilder::new(&phrase, Ident::new_no_ctxt("fbt".into(), DUMMY_SP));
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
    #[should_panic(expected = "Unsupported call in fbtee contents")]
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
            BTreeMap::from([
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
            BTreeMap::from([
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
            output.contains("fbt._list(\"locations\", items, \"or\", \"bullet\")"),
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
    fn string_boolean_options_match_babel_forms() {
        let output = transform(
            "import { fbt } from 'fbtee'; const x = fbt('Count: ' + fbt.param('count', count, { number: 'true' }) + ' ' + fbt.pronoun('object', gender, { human: 'true' }), 'desc');",
            default_options(),
        );
        assert!(
            output.contains("fbt._param(\"count\", count, [\n        0\n    ])"),
            "{output}"
        );
        assert!(output.contains("human: 1"), "{output}");
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
    fn keeps_pronoun_usages_in_separate_variation_groups() {
        let output = transform(
            "import { fbt } from 'fbtee'; const x = fbt(fbt.pronoun('subject', gender) + ' saw ' + fbt.pronoun('reflexive', gender), 'desc');",
            default_options(),
        );
        assert!(output.contains("\"0\": \"they saw themself\""), "{output}");
        assert!(
            output.contains("\"*\": \"they saw themselves\""),
            "{output}"
        );
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
    #[should_panic(expected = "Unknown common string `Missing`")]
    fn rejects_unknown_jsx_common_strings() {
        transform("const x = <fbt common>Missing</fbt>;", default_options());
    }

    #[test]
    #[should_panic(expected = "Expected JSX fbt call to have a desc or common attribute")]
    fn rejects_jsx_fbt_without_desc_or_common() {
        transform("const x = <fbt>Missing desc</fbt>;", default_options());
    }

    #[test]
    #[should_panic(expected = "Don't put <fbt> directly within <fbt>")]
    fn rejects_directly_nested_fbt_jsx_elements() {
        transform(
            "import { fbt } from 'fbtee'; const x = <fbt desc='outer'>A <fbt desc='inner'>B</fbt></fbt>;",
            default_options(),
        );
    }

    #[test]
    #[should_panic(expected = "Don't put <fbs> directly within <fbs>")]
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
}
