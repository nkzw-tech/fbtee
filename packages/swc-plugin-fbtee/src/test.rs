use swc_core::ecma::visit::{visit_mut_pass, Visit, VisitWith};
use swc_core::ecma::{
    ast::Program,
    transforms::testing::test,
    transforms::testing::test_inline,
    visit::{VisitMut, VisitMutWith},
};

use swc_ecma_lexer::{EsSyntax, Syntax};

use crate::transform::TransformVisitor;
use crate::visitors::jsx_visitor::JSXVisitor;

struct TestVisitor;

impl VisitMut for TestVisitor {
    fn visit_mut_program(&mut self, program: &mut Program) {
        program.visit_mut_with(&mut JSXVisitor);
        program.visit_mut_with(&mut TransformVisitor::new());
    }
}

test_inline!(
    Syntax::Es(EsSyntax {
        jsx: true,
        ..Default::default()
    }),
    |_| visit_mut_pass(TestVisitor),
    squelch_whitespace_when_in_an_expression,
    // Input codes
    r#"var x =
            <fbt desc="squelched">
              {"Squelched white space... "}
              with some
              {' other stuff.'}
            </fbt>;
        baz();"#,
    // Output codes after transformed with plugin
    r#"var x = fbt._("Squelched white space... with some other stuff.", null, {
                   hk: "UtpyE",
                 });
                 baz();"#
);

test_inline!(
    Syntax::Es(EsSyntax {
        jsx: true,
        ..Default::default()
    }),
    |_| visit_mut_pass(TestVisitor),
    fbt_list,
    // Input codes
    r#"fbt(
        'Available Locations: ' + fbt.list('locations', ["Tokyo", "London", "Vienna"], null, "or"),
        'Lists',
      )"#,
    // Output codes after transformed with plugin
    r#"fbt._(
  "Available Locations: {locations}",
  [fbt._list("locations", ["Tokyo", "London", "Vienna"], null, "or")],
  {
    hk: "19372u",
  }
);"#
);

test_inline!(
    Syntax::Es(EsSyntax {
        jsx: true,
        ..Default::default()
    }),
    |_| visit_mut_pass(TestVisitor),
    fbt_list_jsx,
    // Input codes
    r#"const x = 
          (<fbt desc="Lists">
            Available Locations: <fbt:list name="locations" items={["Tokyo", "London", "Vienna"]} />.
          </fbt>)
        ;"#,
    // Output codes after transformed with plugin
    r#"const x = fbt._(
  "Available Locations: {locations}.",
  [fbt._list("locations", ["Tokyo", "London", "Vienna"])],
  {
    hk: "1b9IBP",
  }
);"#
);
