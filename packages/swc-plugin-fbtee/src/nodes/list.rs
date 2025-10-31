use swc_core::{
    atoms::{atom, Atom},
    common::util::take::Take,
    ecma::ast::{CallExpr, Expr, Null},
};

use crate::{
    nodes::{
        CallExprArg, arguments::StringVariationArgsMap, member_callee, node::{FbtChildNode, FbtNode}
    },
    util::token_name_to_text_pattern,
};

#[derive(Clone)]
pub struct FbtListNode {
    pub module_name: Atom,
    pub name: String,
    pub items: CallExprArg,
    pub conjuction: Option<CallExprArg>,
    pub delimiter: Option<CallExprArg>,
}

impl FbtNode for FbtListNode {
    fn get_token_name(&self, _args: &StringVariationArgsMap) -> Option<String> {
        Some(self.name.clone())
    }

    fn get_text(&self, _args: &StringVariationArgsMap) -> String {
        token_name_to_text_pattern(&self.name)
    }
}

impl FbtChildNode for FbtListNode {
    fn get_fbt_runtime_arg(mut self) -> Option<CallExpr> {
        let mut args = Vec::with_capacity(4);

        args.push(Expr::Lit(self.name.into()).into());
        args.push(self.items);

        self.conjuction.take_if(|c| c.expr.is_null());
        self.delimiter.take_if(|d| d.expr.is_null());

        match (self.conjuction, self.delimiter) {
            (conjuction, Some(delimiter)) => {
                args.push(conjuction.unwrap_or_else(|| Expr::Lit(Null::dummy().into()).into()));
                args.push(delimiter);
            }
            (Some(conjuction), None) => args.push(conjuction),
            (None, None) => {}
        }

        Some(CallExpr {
            callee: member_callee(self.module_name.clone(), atom!("_list")),
            args: args,
            ..Default::default()
        })
    }
}
