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

    pub fn add_leave(&mut self, mut keys: Vec<String>, leaf: L) {
        let last_key = keys
            .pop()
            .expect("At least one key is required to add a leaf");

        let mut branch = self.expect_branch_mut();
        for key in keys.into_iter() {
            branch = branch
                .entry(key)
                .or_insert_with(|| TableJSFBTTree::new_branch())
                .expect_branch_mut();
        }

        let None = branch.insert(last_key, TableJSFBTTree::Leaf(leaf)) else {
            panic!("Leaf with the same key already exists");
        };
    }

    pub fn expect_branch_mut(&mut self) -> &mut HashMap<String, Self> {
        match self {
            Self::Branch(branch) => branch,
            Self::Leaf(_) => panic!("Expected branch node"),
        }
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

impl Default for TableJSFBTTreeLeaf {
    fn default() -> Self {
        Self {
            desc: String::new(),
            hash: None,
            outer_token_name: None,
            text: String::new(),
            token_aliases: None,
        }
    }
}
