use std::collections::HashMap;
use std::vec;

use iter_tools::Itertools;
use swc_core::atoms::{atom, Atom};
use swc_core::common::util::take::Take;
use swc_core::ecma::ast::{
    ArrayLit, CallExpr, Callee, Expr, ExprOrSpread, ImportDecl, ImportDefaultSpecifier,
    ImportSpecifier, ImportStarAsSpecifier, KeyValueProp, Lit, MemberExpr, MemberProp, Null,
    ObjectLit, Prop, PropName,
};
use swc_core::ecma::visit::Visit;
use swc_core::ecma::visit::VisitMut;

use crate::hash::fbt_hash_key;
use crate::jsfbt::{TableJSFBTTree, TableJSFBTTreeLeaf, TableJSFbt};
use crate::nodes::arguments::StringVariationArgsMap;
use crate::nodes::element::FbtElementNode;
use crate::nodes::node::{FbtChildNode, FbtNode};
use crate::util::{
    convert_to_string_array_node_if_needed, expand_string_concat, normalize_spaces,
    token_name_to_text_pattern,
};

struct FbtFunctionCallPhrase {
    // author: Option<Atom>,
    // common: Option<bool>,
    // do_not_extract: Option<bool>,
    // preserve_whitespace: Option<bool>,
    // project: Atom,
    // subject: Option<Atom>,
    jsfbt: TableJSFbt,
}

fn table_jsfbt_tree_into_argument(tree: TableJSFBTTree<String>) -> Expr {
    match tree {
        TableJSFBTTree::Leaf(leaf) => Expr::Lit(Lit::Str(leaf.into())),
        TableJSFBTTree::Branch(children) => Expr::Object(ObjectLit {
            props: children
                .into_iter()
                .map(|(key, value)| {
                    Prop::KeyValue(KeyValueProp {
                        key: PropName::Str(key.into()),
                        value: Box::new(table_jsfbt_tree_into_argument(value)),
                    })
                    .into()
                })
                .collect(),
            ..Default::default()
        }),
    }
}

fn replace_clear_tokens_with_token_aliases(
    text: &str,
    token_aliases: &Option<HashMap<String, String>>,
) -> String {
    let Some(token_aliases) = token_aliases else {
        return text.to_string();
    };

    token_aliases
        .keys()
        .fold(text.to_string(), |mangled_text, clear_token| {
            let clear_token_name = token_name_to_text_pattern(&clear_token);
            let mangled_token_name = token_name_to_text_pattern(&token_aliases[clear_token]);

            mangled_text.replace(&clear_token_name, &mangled_token_name)
        })
}

struct MetaPhrase {
    fbt_node: FbtElementNode,
    parent_index: Option<i32>,
    phrase: FbtFunctionCallPhrase,
}

pub struct TransformVisitor {
    fbt_enum_mapping: HashMap<String, String>,
}

impl TransformVisitor {
    pub fn new() -> Self {
        Self {
            fbt_enum_mapping: HashMap::new(),
        }
    }

    fn meta_phrases(fbt_element: FbtElementNode) -> Vec<MetaPhrase> {
        let jsfbt_metadata = Vec::new();

        let mut phrase = FbtFunctionCallPhrase {
            jsfbt: TableJSFbt {
                m: jsfbt_metadata,
                t: TableJSFBTTree::new_branch(),
            },
        };

        // loop here

        phrase.jsfbt.t = TableJSFBTTreeLeaf {
            desc: fbt_element.desc.clone(),
            text: normalize_spaces(
                &fbt_element
                    .children
                    .iter()
                    .map(|child| child.get_text(&StringVariationArgsMap::new()))
                    .join(""),
            )
            .trim()
            .to_owned(),
            hash: None,
            outer_token_name: None,
            token_aliases: None,
        }
        .into();

        let meta_phrase = MetaPhrase {
            fbt_node: fbt_element,
            parent_index: None,
            phrase,
        };

        vec![meta_phrase]
    }
}

impl VisitMut for TransformVisitor {
    fn visit_mut_call_expr(&mut self, original_call: &mut CallExpr) {
        let mut call = original_call.take();

        let Callee::Expr(ref callee) = call.callee else {
            return;
        };

        match callee.as_ref() {
            Expr::Ident(ident) if is_known_tag(&ident.sym) => {
                // todo: check if function is imported

                // _convertToFbtNode
                if call.args.len() < 2 {
                    panic!("Expected fbt to have at least two arguments");
                }

                match call.args.first_mut().unwrap() {
                    ExprOrSpread {
                        spread: None,
                        expr: original_expr,
                    } => {
                        let expr = original_expr.take();

                        let array_elements = convert_to_string_array_node_if_needed(*expr).unwrap();

                        *original_expr = Expr::Array(ArrayLit {
                            elems: array_elements
                                .into_iter()
                                .map(|expr| Some(expr.into()))
                                .collect(),
                            ..Default::default()
                        })
                        .into();
                    }
                    _ => panic!("Unexpected spread argument in fbt call"),
                };

                let fbt_element = FbtElementNode::from_call_expr(ident.sym.clone(), call).unwrap();

                let module_name = fbt_element.module_name.clone();
                let mut meta_phrases = Self::meta_phrases(fbt_element.clone());

                //_createFbtRuntimeCallForMetaPhrase

                let Some(MetaPhrase { phrase, .. }) = meta_phrases.first_mut() else {
                    panic!("Expected at least one meta phrase");
                };

                let args = phrase.jsfbt.t.clone().map_leaves(&|leaf| {
                    replace_clear_tokens_with_token_aliases(&leaf.text, &leaf.token_aliases)
                });
                let mut args = vec![Box::new(table_jsfbt_tree_into_argument(args))];

                // _createFbtRuntimeArgumentsForMetaPhrase
                let fbt_runtime_args = fbt_element
                    .children
                    .into_iter()
                    .filter_map(|child| {
                        child.get_fbt_runtime_arg().map(|arg| ExprOrSpread {
                            spread: None,
                            expr: arg.into(),
                        })
                    })
                    .collect::<Vec<_>>();

                if fbt_runtime_args.len() > 0 {
                    args.push(
                        Expr::Array(ArrayLit {
                            elems: fbt_runtime_args.into_iter().map(|arg| Some(arg)).collect(),
                            ..Default::default()
                        })
                        .into(),
                    );
                } else {
                    args.push(Null::dummy().into());
                }

                // end

                args.push(
                    Expr::Object(ObjectLit {
                        props: vec![Prop::KeyValue(KeyValueProp {
                            key: PropName::Ident(atom!("hk").into()),
                            value: Expr::Lit(Lit::Str(fbt_hash_key(&mut phrase.jsfbt.t).into()))
                                .into(),
                        })
                        .into()],
                        ..Default::default()
                    })
                    .into(),
                );

                *original_call = CallExpr {
                    callee: Callee::Expr(
                        Expr::Member(MemberExpr {
                            obj: Expr::Ident(module_name.into()).into(),
                            prop: MemberProp::Ident(atom!("_").into()),
                            ..Default::default()
                        })
                        .into(),
                    ),
                    args: args.into_iter().map(Into::into).collect(),
                    ..Default::default()
                };
            }
            Expr::Member(member_expr) => {
                let obj = match member_expr.obj.as_ref() {
                    Expr::Ident(obj) if is_known_tag(&obj.sym) => obj,
                    _ => return,
                };

                match &member_expr.prop {
                    MemberProp::Ident(prop) if prop.sym != atom!("c") => {}
                    _ => return,
                };

                if call.args.len() != 1 {
                    panic!("Expected fbt.c to have exactly one argument");
                }

                let ExprOrSpread {
                    spread: None,
                    expr: text,
                } = call.args.pop().unwrap()
                else {
                    panic!("Unexpected spread argument in fbt.c call");
                };

                let text = normalize_spaces(&expand_string_concat(*text).unwrap())
                    .trim()
                    .to_owned();

                // todo getDescription

                *original_call = CallExpr {
                    callee: Callee::Expr(Expr::Ident(obj.clone()).into()),
                    args: vec![
                        Expr::Lit(Lit::Str(text.into())).into(),
                        // description,
                        Expr::Object(ObjectLit {
                            props: vec![Prop::KeyValue(KeyValueProp {
                                key: PropName::Ident(atom!("common").into()),
                                value: Box::new(Expr::Lit(Lit::Bool(true.into()))),
                            })
                            .into()],
                            ..Default::default()
                        })
                        .into(),
                    ],
                    ..Default::default()
                };
            }
            _ => *original_call = call,
        }
    }
}

impl Visit for TransformVisitor {
    fn visit_import_decl(&mut self, node: &ImportDecl) {
        if let Some(
            ImportSpecifier::Default(ImportDefaultSpecifier { local, .. })
            | ImportSpecifier::Namespace(ImportStarAsSpecifier { local, .. }),
        ) = node.specifiers.first()
        {
            let alias = local.sym.to_string();
            let module_path = node
                .src
                .value
                .as_str()
                .expect("converting wtf8 to utf8 failed")
                .to_string();
            self.fbt_enum_mapping.insert(alias, module_path);
        }
    }
}

pub fn is_known_tag(tag: &Atom) -> bool {
    *tag == atom!("fbt") || *tag == atom!("fbs")
}

pub fn is_known_child_tag(tag: &Atom) -> bool {
    *tag == atom!("list")
}
