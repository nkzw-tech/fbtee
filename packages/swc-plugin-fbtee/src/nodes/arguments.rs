use std::collections::HashMap;

use crate::nodes::node::FbtNode;

pub struct StringVariationArg {
    pub candidate_values: Vec<SVArgValue>,
    pub valueIdx: Option<usize>,
    pub is_collapsible: bool,
}

pub struct StringVariationArgsMap(pub HashMap<Box<dyn FbtNode>, StringVariationArg>);

impl StringVariationArgsMap {
    pub fn new() -> Self {
        Self(HashMap::new())
    }
}

// pub type EnumStringVariationArg = StringVariationArg<EnumKey>;
// pub type GenderStringVariationArg = StringVariationArg<GenderConst>;
// pub type NumberStringVariationArg = StringVariationArg<Number>;

pub enum SVArgValue {
    EnumKey(EnumKey),
    GenderConst(GenderConst),
    Number(Number),
}

pub type EnumKey = String;

pub enum GenderConst {
    NotAPerson = 0,
    FemaleSingular = 1,
    MaleSingular = 2,
    UnknownSingular = 7,
    UnknownPlural = 11,
    Any,
}

pub enum Number {
    Any,
    ExactlyOne,
}
