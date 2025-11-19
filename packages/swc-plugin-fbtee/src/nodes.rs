use std::vec;

use anyhow::{bail, Result};
use iter_tools::Itertools;
use swc_core::{
    alloc::api::hashbrown::HashMap,
    atoms::{atom, Atom},
    common::Spanned,
    ecma::ast::{
        ArrayLit, CallExpr, Callee, Expr, ExprOrSpread, Lit, MemberExpr, MemberProp, Number,
    },
};

use crate::{
    nodes::{
        arguments::{
            CandidateValues, GenderConst, NumberConst, StringVariationArg, StringVariationArgsMap,
        },
        list::FbtListNode,
        node::{FbtChildNode, FbtNode},
    },
    util::token_name_to_text_pattern,
};

pub mod arguments;
pub mod element;
pub mod list;
pub mod node;

pub type CallExprArg = ExprOrSpread;

pub enum ShowCount {
    Yes,
    IfMany,
    No,
}

pub enum ValidProunounUsage {
    Object,
    Possessive,
    Reflexive,
    Subject,
}

#[derive(Clone)]
pub enum FbtChildNodeEnum {
    Enum {
        range: HashMap<Atom, Atom>,
        value: CallExprArg,
    },
    Name {
        module_name: Atom,
        gender: CallExprArg,
        name: Atom,
        value: CallExprArg,
    },
    Param {
        module_name: Atom,
        gender: Option<Box<Expr>>,
        name: String,
        number: Option<Box<Expr>>, // todo: number?: true | null | Expression
        value: CallExprArg,
    },
    // Plural {
    //     count: CallExprArg,
    //     many: Option<String>,
    //     name: Option<String>,
    //     show_count: ShowCount,
    //     value: CallExprArg,
    // },
    List(FbtListNode),
    // Pronoun {
    //     capitalize: Option<bool>,
    //     gender: CallExprArg,
    //     human: Option<String>,
    //     r#type: ValidProunounUsage,
    // },
    SameParam {
        name: String,
    },
    // ImplicitParam,
    Text(String),
}

impl FbtNode for FbtChildNodeEnum {
    fn get_text(&self, args: &StringVariationArgsMap) -> String {
        match self {
            Self::Enum { .. } => todo!(),
            Self::Name { name, .. } => {
                // invariant here
                token_name_to_text_pattern(name)
            }
            Self::Param { name, .. } => token_name_to_text_pattern(name),
            Self::List(fbt_list_node) => fbt_list_node.get_text(args),
            Self::Text(text) => text.clone(),
            Self::SameParam { name } => token_name_to_text_pattern(name),
        }
    }

    fn get_token_name(&self, args: &StringVariationArgsMap) -> Option<String> {
        match self {
            Self::Name { name, .. } => Some(name.to_string()),
            Self::Param { name, .. } => Some(name.clone()),
            Self::List(fbt_list_node) => fbt_list_node.get_token_name(args),
            Self::Text(_) => None,
            Self::SameParam { name } => Some(name.clone()),
            _ => None,
        }
    }

    fn get_args_for_string_variation_calc(&self) -> Vec<StringVariationArg> {
        match self {
            Self::Enum { range, value } => {
                vec![StringVariationArg {
                    node: value.span(),
                    candidate_values: CandidateValues::EnumKeys(
                        range.keys().map(|k| k.to_string()).collect(),
                    ),
                }]
            }
            Self::Name { gender, .. } => vec![StringVariationArg {
                node: gender.span(),
                candidate_values: CandidateValues::GenderConsts(vec![GenderConst::Any]),
            }],
            Self::Param { gender, number, .. } => match (gender, number) {
                (Some(gender), None) => vec![StringVariationArg {
                    node: gender.span(),
                    candidate_values: CandidateValues::GenderConsts(vec![GenderConst::Any]),
                }],
                (None, Some(number)) => vec![StringVariationArg {
                    // todo: number?: true | null | Expression
                    node: number.span(),
                    candidate_values: CandidateValues::Numbers(vec![NumberConst::Any]),
                }],
                (Some(_), Some(_)) => {
                    panic!("Gender and number options must not be set at the same time")
                }
                _ => vec![],
            },
            _ => vec![],
        }
    }
}

impl FbtChildNode for FbtChildNodeEnum {
    fn get_fbt_runtime_arg(self) -> Option<CallExpr> {
        match self {
            Self::Name {
                module_name,
                gender,
                name,
                value,
            } => Some(CallExpr {
                callee: member_callee(module_name, atom!("name")),
                args: vec![Expr::Lit(Lit::Str(name.into())).into(), value, gender],
                ..Default::default()
            }),
            Self::Param {
                module_name,
                gender,
                name,
                number,
                value,
            } => {
                let mut args = vec![Expr::Lit(Lit::Str(name.into())).into(), value.into()];

                let variation_values = match (gender, number) {
                    (Some(gender), None) => vec![Expr::Lit(1.into()).into(), gender.into()],
                    // todo: number?: true | null | Expression
                    (None, Some(number)) => vec![Expr::Lit(0.into()).into(), number.into()],
                    _ => vec![],
                };

                if !variation_values.is_empty() {
                    args.push(
                        Expr::Array(ArrayLit {
                            elems: variation_values.into_iter().map(Some).collect(),
                            ..Default::default()
                        })
                        .into(),
                    )
                }

                Some(CallExpr {
                    callee: member_callee(module_name, atom!("param")),
                    args,
                    ..Default::default()
                })
            }
            Self::List(fbt_list_node) => fbt_list_node.get_fbt_runtime_arg(),
            Self::SameParam { .. } => None,
            _ => None,
        }
    }
}

impl FbtChildNodeEnum {
    pub fn from_expr(module_name: Atom, expr: Expr) -> Result<Self> {
        match expr {
            Expr::Call(call_expr) => Self::from_call_expr(module_name, call_expr),
            // Expr::JSXElement(jsx_element) => Ok(Self::ImplicitParam),
            Expr::Lit(Lit::Str(str)) => Ok(Self::Text(
                str.value
                    .as_str()
                    .expect("converting wtf8 to utf8 failed")
                    .to_string(),
            )),
            _ => bail!("Unsupported fbt child node expression"),
        }
    }

    fn from_call_expr(module_name: Atom, mut call: CallExpr) -> Result<Self> {
        let Callee::Expr(callee_expr) = call.callee else {
            bail!("Expected callee to be an expression");
        };

        let Expr::Member(member) = *callee_expr else {
            bail!("Expected callee to be a member expression");
        };

        match *member.obj {
            Expr::Ident(obj) if obj.sym == module_name => {}
            _ => bail!("Expected callee object to be 'fbt' identifier"),
        };

        let MemberProp::Ident(prop) = member.prop else {
            bail!("Expected callee property to be an identifier");
        };

        match prop.sym.as_str() {
            // "enum" => {
            //     let Some((value, range)) = call.args.into_iter().tuples().next() else {
            //         bail!("Expected 'fbt.enum' to have exactly 2 arguments");
            //     };

            //     let ExprOrSpread {
            //         spread: None,
            //         expr: range,
            //     } = range
            //     else {
            //         bail!("Expected 'range' argument to be a non-spread expression");
            //     };

            //     let mut range_map = HashMap::new();

            //     match range.as_ref() {
            //         Expr::Array(array) => {
            //             ensure!(
            //                 !array.elems.is_empty(),
            //                 "List of enum entries must not be empty"
            //             );

            //             array.elems.iter().try_for_each(|element| {
            //                 if let Some(ExprOrSpread { spread: None, expr }) = element {
            //                     if let Expr::Lit(Lit::Str(str)) = expr.as_ref() {
            //                         range_map.insert(str.value.clone(), str.value.clone());
            //                         return Ok(());
            //                     };
            //                 }
            //                 bail!("Enum values must be string literals")
            //             })?;
            //         }
            //         Expr::Object(object) => {
            //             ensure!(
            //                 !object.props.is_empty(),
            //                 "Enum range object must not be empty"
            //             );

            //             object.props.iter().try_for_each(|prop| {
            //                 let PropOrSpread::Prop(prop) = prop else {
            //                     bail!("Enum range properties must not be spread properties");
            //                 };

            //                 let Prop::KeyValue(key_value) = prop.as_ref() else {
            //                     bail!("Enum range properties must be key-value properties");
            //                 };

            //                 let key = match &key_value.key {
            //                     PropName::Ident(ident) => ident.sym.clone(),
            //                     PropName::Num(num) => num.raw.clone().unwrap(),
            //                     PropName::Str(str) => str.value.clone(),
            //                     _ => bail!("Enum range property keys must be identifiers or string literals"),
            //                 };

            //                 let Expr::Lit(Lit::Str(value)) = key_value.value.as_ref() else {
            //                     bail!("Enum values must be string literals");
            //                 };

            //                 range_map.insert(key, value.value.clone());

            //                 Ok(())
            //             })?;
            //         }
            //         Expr::Ident(ident) => {
            //             // todo
            //         }
            //         _ => bail!(
            //             "Expected enum range (second argument) to be an array, object or a variable referring to an fbt enum"
            //         ),
            //     };

            //     Ok(FbtChildNode::Enum {
            //         range: range_map,
            //         value: Some(value),
            //     })
            // }
            "name" => {
                let Some((name, value, gender)) = call.args.into_iter().tuples().next() else {
                    bail!("Expected 'fbt.name' to have exactly 3 arguments");
                };

                let ExprOrSpread {
                    spread: None,
                    expr: name,
                } = name
                else {
                    bail!("Expected 'name' argument to be a non-spread expression");
                };

                let Expr::Lit(Lit::Str(name)) = *name else {
                    bail!("Expected 'name' argument to be a string literal");
                };

                Ok(Self::Name {
                    module_name,
                    gender: gender.into(),
                    name: name
                        .value
                        .as_atom()
                        .expect("converting wtf8 to utf8 failed")
                        .clone(),
                    value: value.into(),
                })
            }
            "param" => {
                todo!()
            }
            "plural" => {
                todo!()
            }
            "list" => {
                let mut args = call.args.drain(..);

                let name = {
                    let Some(ExprOrSpread { spread: None, expr }) = args.next() else {
                        bail!("")
                    };

                    let Expr::Lit(Lit::Str(str)) = *expr else {
                        bail!("")
                    };

                    str.value
                        .as_str()
                        .expect("converting wtf8 to utf8 failed")
                        .to_string()
                };

                Ok(Self::List(FbtListNode {
                    module_name,
                    name,
                    items: args.next().ok_or_else(|| anyhow::anyhow!(""))?,
                    conjuction: args.next(),
                    delimiter: args.next(),
                }))
            }
            "pronoun" => {
                todo!()
            }
            "sameParam" => {
                if call.args.len() != 1 {
                    bail!("Expected 'fbt.sameParam' to have exactly 1 argument");
                }

                let ExprOrSpread { spread: None, expr } = call.args.remove(0) else {
                    bail!("Expected 'name' argument to be a non-spread expression");
                };

                let Expr::Lit(Lit::Str(str)) = *expr else {
                    bail!("Expected 'name' argument to be a string literal");
                };

                Ok(FbtChildNodeEnum::SameParam {
                    name: str
                        .value
                        .as_str()
                        .expect("converting wtf8 to utf8 failed")
                        .to_string(),
                })
            }
            _ => bail!("Unsupported fbt child node type"),
        }
    }
}

pub fn member_callee(object: Atom, prop: Atom) -> Callee {
    Callee::Expr(
        Expr::Member(MemberExpr {
            obj: Expr::Ident(object.into()).into(),
            prop: MemberProp::Ident(prop.into()),
            ..Default::default()
        })
        .into(),
    )
}
