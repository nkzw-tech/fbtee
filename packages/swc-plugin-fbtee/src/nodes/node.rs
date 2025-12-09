use std::collections::HashMap;

use swc_core::ecma::ast::CallExpr;

use crate::nodes::arguments::{StringVariationArg, StringVariationArgsMap};

pub trait FbtNode {
    fn get_args_for_string_variation_calc(&self) -> Vec<StringVariationArg> {
        Vec::new()
    }

    fn get_text(&self, args: &StringVariationArgsMap) -> String;

    fn get_token_aliases(&self, _args: &StringVariationArgsMap) -> Option<HashMap<String, String>> {
        None
    }

    fn get_token_name(&self, _args: &StringVariationArgsMap) -> Option<String> {
        None
    }
}

pub trait FbtChildNode: FbtNode {
    fn get_fbt_runtime_arg(self) -> Option<CallExpr>;
}
