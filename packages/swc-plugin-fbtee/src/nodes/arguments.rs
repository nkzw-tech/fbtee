use std::collections::HashMap;

use swc_core::common::Span;

use crate::nodes::node::FbtNode;

#[derive(Clone)]
pub struct StringVariationArg {
    pub node: Span,

    pub candidate_values: CandidateValues,
}

pub struct StringVariationArgsMap(pub HashMap<Box<dyn FbtNode>, StringVariationArg>);

impl StringVariationArgsMap {
    pub fn new() -> Self {
        Self(HashMap::new())
    }
}

#[derive(Clone)]
pub enum CandidateValues {
    EnumKeys(Vec<EnumKey>),
    GenderConsts(Vec<GenderConst>),
    Numbers(Vec<NumberConst>),
}

#[derive(Clone)]
pub enum SVArgValue {
    EnumKey(EnumKey),
    GenderConst(GenderConst),
    Number(NumberConst),
}

impl ToString for SVArgValue {
    fn to_string(&self) -> String {
        match self {
            SVArgValue::EnumKey(key) => key.clone(),
            SVArgValue::GenderConst(gender) => gender.to_string(),
            SVArgValue::Number(number) => number.to_string(),
        }
    }
}

pub type EnumKey = String;

#[derive(Clone, Copy)]
pub enum GenderConst {
    NotAPerson = 0,
    FemaleSingular = 1,
    MaleSingular = 2,
    UnknownSingular = 7,
    UnknownPlural = 11,
    Any,
}

impl ToString for GenderConst {
    fn to_string(&self) -> String {
        match self {
            Self::Any => "*".to_string(),
            _ => (*self as u8).to_string(),
        }
    }
}

#[derive(Clone)]
pub enum NumberConst {
    Any,
    ExactlyOne,
}

impl ToString for NumberConst {
    fn to_string(&self) -> String {
        match self {
            Self::Any => "*".to_string(),
            Self::ExactlyOne => "_1".to_string(),
        }
    }
}
