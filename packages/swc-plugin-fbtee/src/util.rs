use std::sync::LazyLock;
use std::vec;

use anyhow::{anyhow, bail, Result};
use regex::Regex;
use swc_core::atoms::Atom;
use swc_core::ecma::ast::{
    BinExpr, Expr, ExprOrSpread, JSXAttr, JSXAttrName, JSXAttrOrSpread, JSXElement, JSXElementChild, JSXExpr, JSXExprContainer, Lit, Str, Tpl, op
};
use swc_core::plugin::errors::HANDLER;

pub fn normalize_spaces(s: &str) -> String {
    // maybe thread_local?
    static PATTERN: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"[^\S\u{00A0}]+").unwrap());

    PATTERN.replace_all(s, " ").into_owned()
}

pub fn token_name_to_text_pattern(token_name: &str) -> String {
    format!("{{{token_name}}}")
}

pub fn expand_string_concat(expr: Expr) -> Result<String> {
    match expr {
        Expr::Bin(bin) if bin.op == op!(bin, "+") => {
            let left = expand_string_concat(*bin.left)?;
            let right = expand_string_concat(*bin.right)?;
            Ok(format!("{}{}", left, right))
        }
        Expr::Lit(Lit::Str(Str { value, .. })) => Ok(value
            .as_str()
            .expect("converting wtf8 to utf8 failed")
            .to_string()),
        Expr::Tpl(tpl) => {
            convert_template_literal_to_string_iter(tpl).try_fold(String::new(), |mut acc, expr| {
                if let Expr::Lit(Lit::Str(Str { value, .. })) = *expr? {
                    acc.push_str(&value.as_str().expect("converting wtf8 to utf8"));
                    Ok(acc)
                } else {
                    Err(anyhow!("Expected to see either a string literal"))
                }
            })
        }

        _ => bail!("Expected to see either a string literal or a binary expression"),
    }
}

pub fn convert_to_string_array_node_if_needed(node: Expr) -> Result<Vec<Box<Expr>>> {
    match node {
        Expr::Array(array) => {
            array.elems.into_iter().filter_map(|elem| match elem {
                Some(ExprOrSpread { spread: None, expr }) => Some(Ok(expr)),
                Some(ExprOrSpread { spread: Some(_), .. }) => {
                    Some(Err(anyhow!("Unexpected spread element in array")))
                }
                None => None,
            })
            .map(|result| {
                if let Ok(expr) = result {
                    match *expr {
                        Expr::Bin(_) => {
                            bail!("fbt(array) only supports items that are string literals, template literals without any expressions, or fbt constructs")
                        }
                        Expr::Tpl(tpl) if !tpl.exprs.is_empty() => {
                            bail!(
                                "fbt(array) only supports items that are string literals, template literals without any expressions, or fbt constructs",
                            )
                        }
                        _ => Ok(expr),
                    }
                } else {
                    result
                }
            })
            .collect::<Result<_>>()
        }
        Expr::Call(_) => Ok(vec![node.into()]),
        Expr::Lit(Lit::Str(_)) => Ok(vec![node.into()]),
        Expr::Bin(bin) => get_binary_expression_operands(bin),
        Expr::Tpl(tpl) => convert_template_literal_to_string_array_elements(tpl),
        _ => bail!("Expected array, call expression, or string literal"),
    }
}

pub fn get_binary_expression_operands(bin_expr: BinExpr) -> Result<Vec<Box<Expr>>> {
    if bin_expr.op != op!(bin, "+") {
        bail!("Expected to see a string concatenation");
    }

    let mut result: Vec<Box<Expr>> = vec![];
    let mut operands: Vec<Box<Expr>> = vec![bin_expr.right, bin_expr.left];

    while let Some(expr) = operands.pop() {
        match *expr {
            Expr::Bin(bin) if bin.op == op!(bin, "+") => {
                if bin.op != op!(bin, "+") {
                    bail!("Expected to see a string concatenation");
                }

                operands.push(bin.right);
                operands.push(bin.left);
            }
            Expr::Call(_) | Expr::Lit(Lit::Str(_)) | Expr::Tpl(_) => {
                result.push(expr);
            }
            _ => bail!("Expected to see either a string literal or a binary expression"),
        }
    }

    Ok(result)
}

pub fn convert_template_literal_to_string_array_elements(tpl: Tpl) -> Result<Vec<Box<Expr>>> {
    convert_template_literal_to_string_iter(tpl).collect()
}

pub fn convert_template_literal_to_string_iter(
    tpl: Tpl,
) -> impl Iterator<Item = Result<Box<Expr>>> {
    let mut exprs = tpl.exprs.into_iter();

    tpl.quasis.into_iter().flat_map(move |item| {
        let mut result = Vec::with_capacity(2);

        if let Some(text) = item.cooked {
            if !text.is_empty() {
                result.push(Ok(Expr::Lit(Lit::Str(text.into())).into()));
            }
        }

        if let Some(expr) = exprs.next() {
            if let Expr::Lit(Lit::Str(_)) | Expr::Call(_) | Expr::JSXElement(_) = *expr {
                result.push(Ok(expr));
            } else {
                result.push(Err(anyhow!(
                    "Expected to see either a string literal or a call expression"
                )));
            }
        }

        result
    })
}

pub fn get_attribute_ref_by_name<'a>(element: &'a JSXElement, name: &Atom) -> Option<&'a JSXAttr> {
    element
        .opening
        .attrs
        .iter()
        .find_map(|attribute| match attribute {
            JSXAttrOrSpread::JSXAttr(
                attr @ JSXAttr {
                    name: JSXAttrName::Ident(attr_name),
                    ..
                },
            ) if attr_name.sym == *name => Some(attr),

            _ => None,
        })
}

pub fn get_attribute_ref_by_name_report<'a>(
    element: &'a JSXElement,
    name: &Atom,
) -> Result<&'a JSXAttr> {
    get_attribute_ref_by_name(element, name).ok_or_else(|| {
        HANDLER.with(|handler| {
            handler
                .struct_span_err(
                    element.span,
                    &format!("Expected attribute '{}' not found", name),
                )
                .emit();
        });

        anyhow!("Expected attribute '{}' not found", name)
    })
}

pub fn get_attribute_by_name(element: &mut JSXElement, name: &Atom) -> Option<JSXAttr> {
    let idx = element.opening.attrs.iter().position(|attribute| {
        matches!(
            attribute,
            JSXAttrOrSpread::JSXAttr(
                JSXAttr {
                    name: JSXAttrName::Ident(attr_name),
                    ..
                },
            ) if attr_name.sym == *name)
    })?;

    let attribute = element.opening.attrs.swap_remove(idx);
    match attribute {
        JSXAttrOrSpread::JSXAttr(attr) => Some(attr),
        _ => unreachable!(),
    }
}

pub fn get_attribute_by_name_report(element: &mut JSXElement, name: &Atom) -> Result<JSXAttr> {
    get_attribute_by_name(element, name).ok_or_else(|| {
        HANDLER.with(|handler| {
            handler
                .struct_span_err(
                    element.span,
                    &format!("Expected attribute '{}' not found", name),
                )
                .emit();
        });

        anyhow!("Expected attribute '{}' not found", name)
    })
}

pub fn filter_empty_nodes(
    nodes: impl Iterator<Item = JSXElementChild>,
) -> impl Iterator<Item = JSXElementChild> {
    nodes.filter(|child| match child {
        JSXElementChild::JSXText(text) => !text.value.trim().is_empty(),
        JSXElementChild::JSXExprContainer(JSXExprContainer {
            expr: JSXExpr::JSXEmptyExpr(_),
            ..
        }) => false,
        _ => true,
    })
}
