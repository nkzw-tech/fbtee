use std::collections::HashMap;

use serde::Serialize;

pub enum JSFbtMetaEntry {
    Number { token: Option<String> },
    Gender { token: Option<String> },
    Prounoun,
    Unknown { range: Vec<String> },
}

pub struct TableJSFbt {
    pub m: Vec<Option<JSFbtMetaEntry>>,
    pub t: TableJSFBTTree,
}

#[derive(Clone, Serialize, Debug)]
#[serde(untagged)]
pub enum TableJSFBTTree<L = TableJSFBTTreeLeaf> {
    Leaf(L),
    Branch(HashMap<String, Self>),
}

#[derive(Clone, Debug)]
pub struct TableJSFBTTreeLeaf {
    pub desc: String,
    // patternHash
    pub hash: Option<String>,
    pub outer_token_name: Option<String>,
    // patternString
    pub text: String,
    pub token_aliases: Option<HashMap<String, String>>,
}

impl<L> TableJSFBTTree<L> {
    pub fn new_branch() -> Self {
        Self::Branch(Default::default())
    }

    pub fn map_leaves<O>(self, convert_leaf: &impl Fn(L) -> O) -> TableJSFBTTree<O> {
        match self {
            Self::Leaf(leaf) => TableJSFBTTree::Leaf(convert_leaf(leaf)),
            Self::Branch(children) => TableJSFBTTree::Branch(
                children
                    .into_iter()
                    .map(|(k, v)| (k, v.map_leaves(convert_leaf)))
                    .collect(),
            ),
        }
    }

    pub fn on_each_leaf(&self, func: &mut impl FnMut(&L)) {
        match self {
            Self::Leaf(leaf) => func(leaf),
            Self::Branch(children) => {
                for child in children.values() {
                    child.on_each_leaf(func);
                }
            }
        }
    }
}

impl From<TableJSFBTTreeLeaf> for TableJSFBTTree {
    fn from(leaf: TableJSFBTTreeLeaf) -> Self {
        TableJSFBTTree::Leaf(leaf)
    }
}
