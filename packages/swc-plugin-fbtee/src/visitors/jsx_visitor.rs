use std::vec;

use crate::transform::{is_known_child_tag, is_known_tag};
use crate::util::{
    convert_to_string_array_node_if_needed, expand_string_concat, filter_empty_nodes,
    get_attribute_by_name, get_attribute_by_name_report, normalize_spaces,
};
use anyhow::{anyhow, bail, Result};
use iter_tools::Itertools;
use swc_core::atoms::{atom, Atom};
use swc_core::common::util::take::Take;
use swc_core::common::Span;
use swc_core::ecma::ast::{
    ArrayLit, CallExpr, Callee, Expr, ExprOrSpread, Ident, JSXAttr, JSXAttrOrSpread, JSXAttrValue,
    JSXElement, JSXElementChild, JSXElementName, JSXExpr, JSXExprContainer, JSXOpeningElement,
    JSXText, Lit, MemberExpr, MemberProp, Null, Str,
};
use swc_core::ecma::visit::{VisitMut, VisitMutWith};
pub struct JSXVisitor;

impl JSXVisitor {
    fn is_fbt_tag(element: &JSXElement) -> Option<Atom> {
        let ident = match element {
            JSXElement {
                opening:
                    JSXOpeningElement {
                        name: JSXElementName::Ident(ident),
                        ..
                    },
                ..
            } => ident,
            _ => return None,
        };

        match ident.sym.as_str() {
            "fbt" | "fbs" => Some(ident.sym.clone()),
            _ => None,
        }
    }

    fn is_fbt_child_call(expr: &Expr, module_name: &Atom) -> bool {
        let Expr::Call(CallExpr {
            callee: Callee::Expr(boxed_expr),
            ..
        }) = expr
        else {
            return false;
        };

        let Expr::Member(MemberExpr {
            obj,
            prop: MemberProp::Ident(prop),
            ..
        }) = &**boxed_expr
        else {
            return false;
        };

        let Expr::Ident(obj) = obj.as_ref() else {
            return false;
        };

        obj.sym == *module_name && is_known_child_tag(&prop.sym)
    }

    fn transform_children_for_fbt_call_syntax(
        &mut self,
        jsx_element: &mut JSXElement,
    ) -> impl Iterator<Item = Result<Expr>> {
        let fbt_tag = Self::is_fbt_tag(jsx_element).unwrap();

        for child in &mut jsx_element.children {
            if let JSXElementChild::JSXElement(child_jsx_element) = child {
                if let Ok(Some(new_child)) = parse_fbt_child_node(child_jsx_element, &fbt_tag) {
                    *child = new_child;
                };
            };
        }

        filter_empty_nodes(jsx_element.children.take().into_iter()).map(move |child| match child {
            JSXElementChild::JSXElement(element) => Ok(element.into()),

            JSXElementChild::JSXText(text) => Ok(Expr::Lit(Lit::Str(
                normalize_spaces(text.value.as_str()).into(),
            ))),

            JSXElementChild::JSXExprContainer(expr_container) => match expr_container.expr {
                JSXExpr::JSXEmptyExpr(_) => panic!("Unexpected JSX empty container expression"),
                // JSXExpr::Expr(expr) if expr.is_synthesized() && expr.is_call() => Ok(*expr),
                JSXExpr::Expr(expr) if Self::is_fbt_child_call(&expr, &fbt_tag) => Ok(*expr),

                JSXExpr::Expr(expr) => {
                    let s = expand_string_concat(*expr)?;
                    Ok(Expr::Lit(Lit::Str(normalize_spaces(&s).into())))
                }
            },

            _ => bail!("Unsupported JSX child"),
        })
    }

    fn visit_fbt_root(&mut self, mut jsx_element: JSXElement) -> Result<Option<CallExpr>> {
        let Some(module_name) = Self::is_fbt_tag(&jsx_element) else {
            return Ok(None);
        };

        for attr in &jsx_element.opening.attrs {
            if let JSXAttrOrSpread::SpreadElement(_) = attr {
                bail!("Spread attributes are not supported in <fbt> or <fbs> elements.");
            }
        }

        let children = self.transform_children_for_fbt_call_syntax(&mut jsx_element);

        // _getText
        let text = Expr::Array(ArrayLit {
            elems: children
                .map(|result| result.map(|expr| Some(expr.into())))
                .collect::<Result<Vec<_>>>()?,
            ..Default::default()
        });

        let text = ArrayLit {
            elems: convert_to_string_array_node_if_needed(text)?
                .into_iter()
                .map(|expr| Some(expr.into()))
                .collect(),
            ..Default::default()
        };

        // getCommonAttributeValue
        let common =
            if let Some(common_attr) = get_attribute_by_name(&mut jsx_element, &atom!("common")) {
                match common_attr.value {
                    Some(JSXAttrValue::Str(str)) => match str.value.as_bytes() {
                        b"true" => true,
                        b"false" => false,
                        _ => bail!("Expected 'common' attribute to be 'true' or 'false'"),
                    },
                    Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                        expr: JSXExpr::Expr(expr),
                        ..
                    })) => match *expr {
                        Expr::Lit(Lit::Bool(b)) => b.value,
                        _ => bail!("Expected synthesized expression for common attribute"),
                    },
                    None => true,
                    _ => bail!("Expected boolean literal for common attribute"),
                }
            } else {
                false
            };

        let description = if common {
            let raw_text = text
                .elems
                .iter()
                .filter_map(|child| match child {
                    Some(ExprOrSpread { spread: None, expr }) => Some(expr),
                    Some(ExprOrSpread {
                        spread: Some(_), ..
                    }) => panic!("Unexpected spread element in array"),
                    None => None,
                })
                .map(|expr| match expr.as_ref() {
                    Expr::Lit(Lit::Str(Str { value, .. })) => value
                        .as_str()
                        .ok_or_else(|| anyhow!("converting wtf8 to utf8 failed")),
                    _ => bail!("Expected string literal in common text array"),
                })
                .collect::<Result<String>>()?;

            let _text = normalize_spaces(&raw_text).trim();
            // todo
            Box::new(Expr::dummy())
        } else {
            let desc_attribute = get_attribute_by_name_report(&mut jsx_element, &atom!("desc"))?;

            match desc_attribute.value {
                Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                    expr: JSXExpr::Expr(expr),
                    ..
                })) => expr,
                Some(JSXAttrValue::Str(str)) => str.into(),
                _ => bail!("desc attribute must be a string literal or a non-empty JSX expression"),
            }
        };

        // createFbtFunctionCallNode
        let fbt_call = CallExpr {
            callee: Callee::Expr(Box::new(Expr::Ident(module_name.into()))),
            args: vec![text.into(), description]
                .into_iter()
                .map(Into::into)
                .collect(),
            ..Default::default()
        };

        Ok(Some(fbt_call))
    }
}

impl VisitMut for JSXVisitor {
    fn visit_mut_expr(&mut self, expr: &mut Expr) {
        let jsx_element = match expr {
            Expr::JSXElement(jsx_element) => jsx_element.take(),
            _ => {
                expr.visit_mut_children_with(self);
                return;
            }
        };

        if let Ok(Some(call)) = self
            .visit_fbt_root(*jsx_element)
            .inspect_err(|err| println!("{:?}", err))
        {
            *expr = Expr::Call(call);
        }

        expr.visit_mut_children_with(self);
    }

    fn visit_mut_jsx_element_child(&mut self, node: &mut JSXElementChild) {
        node.visit_mut_children_with(self);

        let jsx_element = match node {
            JSXElementChild::JSXElement(jsx_element) => jsx_element.take(),
            _ => {
                node.visit_mut_children_with(self);
                return;
            }
        };

        node.visit_mut_children_with(self);

        if let Ok(Some(call)) = self
            .visit_fbt_root(*jsx_element)
            .inspect_err(|err| println!("{:?}", err))
        {
            *node = JSXElementChild::JSXExprContainer(JSXExprContainer {
                span: Default::default(),
                expr: JSXExpr::Expr(call.into()),
            });
        }
    }
}

fn parse_fbt_child_node(
    element: &mut JSXElement,
    expected_namespace: &Atom,
) -> Result<Option<JSXElementChild>> {
    let name = match &element.opening.name {
        JSXElementName::JSXNamespacedName(n) if n.ns.sym == *expected_namespace => n.name.clone(),
        JSXElementName::JSXNamespacedName(n) if is_known_tag(&n.name.sym) => {
            bail!("Don't mix <fbt> and <fbs> JSX namespaces.")
        }
        JSXElementName::Ident(ident) if is_known_tag(&ident.sym) => {
            bail!("fbt and fbs tags cannot be nested.")
        }
        _ => return Ok(None),
    };

    let args: Vec<Box<Expr>> = match name.sym.as_str() {
        "enum" => {
            if !element.opening.self_closing {
                bail!("Expected fbt:enum to be self closing.");
            }

            let range = get_attribute_by_name_report(element, &atom!("enum-range"))?;

            let range_expr = match range.value {
                Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                    expr: JSXExpr::Expr(range_expr),
                    ..
                })) => range_expr,
                _ => bail!("Expected enum-range attribute of <fbt:enum> to be a JSX expression"),
            };

            let value = get_attribute_by_name_report(element, &atom!("value"))?;

            match value.value {
                Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                    expr: JSXExpr::Expr(value_expr),
                    ..
                })) => vec![value_expr, range_expr],

                Some(JSXAttrValue::Str(value)) => {
                    vec![value.into(), range_expr]
                }
                _ => bail!("Expected value attribute of <fbt:enum> to be an expression but got"),
            }
        }
        "list" => {
            if !element.opening.self_closing {
                bail!("Expected fbt:list to be self closing.");
            }

            let name = match get_attribute_by_name_report(element, &atom!("name"))? {
                JSXAttr {
                    value: Some(JSXAttrValue::Str(name)),
                    ..
                } => name,
                _ => bail!("Expected name attribute of <fbt:list> to be a string literal"),
            };

            let items = {
                let items = get_attribute_by_name_report(element, &atom!("items"))?;

                let Some(JSXAttrValue::JSXExprContainer(expr_container)) = items.value else {
                    bail!("Expected items attribute of <fbt:list> to be a expression")
                };

                match expr_container.expr {
                    JSXExpr::Expr(expr) => expr,
                    _ => bail!("Expected items attribute of <fbt:list> to be a expression"),
                }
            };

            let conjuction = get_attribute_by_name(element, &atom!("conjunction"))
                .map(|attr| match attr.value {
                    Some(JSXAttrValue::Str(str)) => str.into(),
                    Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                        expr: JSXExpr::Expr(expr),
                        ..
                    })) => expr,
                    _ => Null::dummy().into(),
                })
                .unwrap_or_else(|| Null::dummy().into());

            let delimiter = get_attribute_by_name(element, &atom!("delimiter"))
                .map(|attr| match attr.value {
                    Some(JSXAttrValue::Str(str)) => str.into(),
                    Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                        expr: JSXExpr::Expr(expr),
                        ..
                    })) => expr,
                    _ => Null::dummy().into(),
                })
                .unwrap_or_else(|| Null::dummy().into());

            vec![name.into(), items, conjuction, delimiter]
        }
        "name" => {
            let name = {
                let JSXAttr {
                    value: Some(name), ..
                } = get_attribute_by_name_report(element, &atom!("name"))?
                else {
                    bail!("Expected name attribute of <fbt:name> to be present");
                };

                match name {
                    JSXAttrValue::Str(name) => name.into(),
                    JSXAttrValue::JSXExprContainer(JSXExprContainer {
                        expr: JSXExpr::Expr(expr),
                        ..
                    }) => expr,
                    _ => bail!("Expected name attribute of <fbt:name> to be a string literal or expression"),
                }
            };

            let gender = {
                let JSXAttr {
                    value: Some(gender),
                    ..
                } = get_attribute_by_name_report(element, &atom!("gender"))?
                else {
                    bail!("Expected gender attribute of <fbt:name> to be present");
                };

                match gender {
                    JSXAttrValue::JSXExprContainer(JSXExprContainer {
                        expr: JSXExpr::Expr(expr),
                        ..
                    }) => expr,
                    _ => Null::dummy().into(),
                }
            };

            let singular_arg = filter_empty_nodes(element.children.take().into_iter())
                .filter_map(|jsx_child| match jsx_child {
                    JSXElementChild::JSXExprContainer(JSXExprContainer {
                        expr: JSXExpr::Expr(expr),
                        ..
                    }) => Some(expr),
                    JSXElementChild::JSXText(JSXText { value, .. }) => {
                        Some(normalize_spaces(value.as_str()).into())
                    }
                    _ => None,
                })
                .at_most_one()
                .ok()
                .flatten()
                .expect("fbt:name expects text or an expression, and only one");

            vec![name, singular_arg, gender]
        }
        "param" => vec![],
        "plural" => vec![],
        "pronoun" => vec![],
        "same-param" => {
            if !element.opening.self_closing {
                bail!("Expected fbt:same-param to be self closing.");
            }

            let name = match get_attribute_by_name_report(element, &atom!("name"))? {
                JSXAttr {
                    value: Some(JSXAttrValue::Str(name)),
                    ..
                } => name,
                _ => bail!("Expected name attribute of <fbt:same-param> to be a string literal"),
            };

            vec![name.into()]
        }
        _ => {
            bail!("Unknown fbt child tag: {}", name.sym);
        }
    };

    let fbt_construct_call = Expr::Call(CallExpr {
        callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
            obj: Ident::from(expected_namespace.clone()).into(),
            prop: MemberProp::Ident(name.clone()),
            ..Default::default()
        }))),
        args: args.into_iter().map(Into::into).collect(),
        ..Default::default()
    });

    Ok(Some(
        JSXExprContainer {
            expr: JSXExpr::Expr(fbt_construct_call.into()),
            span: Span::default(),
        }
        .into(),
    ))
}
