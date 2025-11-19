use swc_core::ecma::{ast::Program, visit::VisitMutWith};
use swc_core::plugin::{plugin_transform, proxies::TransformPluginProgramMetadata};

use crate::transform::TransformVisitor;
use crate::visitors::jsx_visitor::JSXVisitor;

mod hash;
mod jsfbt;
mod jsfbt_builder;
mod nodes;
mod test;
mod transform;
mod util;
mod visitors {
    pub mod jsx_visitor;
}

#[plugin_transform]
pub fn process_transform(
    mut program: Program,
    _metadata: TransformPluginProgramMetadata,
) -> Program {
    program.visit_mut_with(&mut JSXVisitor);
    program.visit_mut_with(&mut TransformVisitor::new());
    program
}
