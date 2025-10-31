use std::collections::HashMap;

use anyhow::{bail, Result};
use swc_core::{
    atoms::Atom,
    common::util::take::Take,
    ecma::ast::{CallExpr, Expr, ExprOrSpread},
};

use crate::{
    nodes::{
        arguments::{GenderConst, SVArgValue, StringVariationArg, StringVariationArgsMap},
        node::FbtNode,
        CallExprArg, FbtChildNodeEnum,
    },
    util::{expand_string_concat, normalize_spaces},
};

#[derive(Clone)]
pub struct FbtElementNode {
    pub module_name: Atom,
    pub children: Vec<FbtChildNodeEnum>,
    // author: Option<String>,
    // common: bool,
    // do_not_extract: bool,
    // preserve_whitespace: bool,
    // project: String,
    subject: Option<CallExprArg>,
    pub desc: String,
}

impl FbtNode for FbtElementNode {
    fn get_args_for_string_variation_calc(&self) -> Vec<StringVariationArg> {
        let mut result = vec![];
        if let Some(_subject) = &self.subject {
            result.push(StringVariationArg {
                candidate_values: vec![SVArgValue::GenderConst(GenderConst::Any)],
                valueIdx: None,
                is_collapsible: false,
            });
        }
        result
    }

    fn get_text(&self, args: &StringVariationArgsMap) -> String {
        todo!()
    }

    fn get_token_aliases(&self, args: &StringVariationArgsMap) -> Option<HashMap<String, String>> {
        todo!()
    }
}

impl FbtElementNode {
    pub fn from_call_expr(module_name: Atom, mut call: CallExpr) -> Result<Self> {
        let Some(ExprOrSpread { spread: None, expr }) = call.args.first_mut() else {
            bail!("Expected first argument to be a non-spread expression");
        };

        let Expr::Array(array) = *expr.take() else {
            bail!("Expected first argument to be an array expression");
        };

        let children = array
            .elems
            .into_iter()
            .map(|element| match element {
                Some(ExprOrSpread { spread: None, expr }) => {
                    FbtChildNodeEnum::from_expr(module_name.clone(), *expr)
                }

                Some(ExprOrSpread {
                    spread: Some(_),
                    expr: _,
                }) => bail!("Expected array elements to not be spread expressions"),
                None => bail!("Expected array elements to be present"),
            })
            .collect::<Result<Vec<_>>>()?;

        let Some(ExprOrSpread { spread: None, expr }) = call.args.get_mut(1) else {
            bail!("fbt description argument cannot be found")
        };

        let desc = normalize_spaces(&expand_string_concat(*expr.clone())?)
            .trim()
            .to_owned();

        Ok(FbtElementNode {
            module_name,
            children,
            desc,
            subject: None,
        })
    }
}

// fn collect_options_from_fbt_construct(call: &CallExpr) -> Result<Option<ObjectLit>> {
//     match call.args.get(2) {
//         Some(ExprOrSpread { spread: None, expr }) => match &**expr {
//             Expr::Object(obj) => Ok(Some(obj.clone())),
//             _ => bail!("Expected options argument to be an object literal"),
//         },
//         Some(ExprOrSpread {
//             spread: Some(_), ..
//         }) => bail!("Expected options argument to not be a spread expression"),
//         None => Ok(None),
//     }
// }

// fn collect_options(options: ObjectLit) -> Result<()> {
//     let mut result = HashMap::new();

//     options.props.into_iter().for_each(|prop| {
//         let PropOrSpread::Prop(prop) = prop else {
//             return;
//         };
//     });

//     for prop in options.props {
//         let PropOrSpread::Prop(prop) = prop else {
//             bail!("options object must contain plain object properties.");
//         };

//         let Prop::KeyValue(kv_prop) = *prop else {
//             bail!("options object must contain key-value properties.");
//         };

//         let key = match kv_prop.key {
//             PropName::Ident(ident) => ident.sym,
//             PropName::Str(str) => str.value,
//             _ => bail!("options object keys must be identifiers or string literals."),
//         };
//     }

//     Ok(())
// }
