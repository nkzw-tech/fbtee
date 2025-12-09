use serde::Serialize;
use std::collections::HashMap;

use crate::jsfbt::TableJSFBTTree;

fn jenkins_hash(data: &[u8]) -> u32 {
    let mut hash = 0u32;
    for byte in data {
        hash = hash.wrapping_add(*byte as u32);
        hash = hash.wrapping_add(hash << 10);
        hash ^= hash >> 6;
    }
    hash = hash.wrapping_add(hash << 3);
    hash ^= hash >> 11;
    hash = hash.wrapping_add(hash << 15);
    hash
}

const ALPHABET: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

fn u32_to_base_n(mut num: u32, base: u32) -> String {
    if base < 2 || base as usize > ALPHABET.len() {
        panic!("Base must be in the range 2-62");
    }

    let mut result = String::new();
    while num > 0 {
        let mut c = (ALPHABET[(num % base) as usize] as char).to_string();
        c.push_str(&result);
        result = c;
        num /= base;
    }
    result
}

fn fbt_jenkins_hash(jsfbt: &TableJSFBTTree) -> u32 {
    let mut desc = None;
    let mut leaves_have_same_desc = true;

    jsfbt.on_each_leaf(&mut |leaf| match &desc {
        Some(desc) if desc != &leaf.desc => {
            leaves_have_same_desc = false;
        }
        None => {
            desc = Some(leaf.desc.clone());
        }
        _ => {}
    });

    if leaves_have_same_desc {
        #[derive(Serialize)]
        #[serde(untagged, rename_all = "camelCase")]
        enum LeafNode {
            Left {
                text: String,
                token_aliases: HashMap<String, String>,
            },
            Right(String),
        }

        let Some(desc) = desc else {
            panic!(
                "Expect `desc` to be nonnull as `TableJSFBTTree` should contain at least one leaf."
            )
        };

        let hash_input_tree = jsfbt.clone().map_leaves(&|leaf| {
            if let Some(token_aliases) = leaf.token_aliases {
                LeafNode::Left {
                    text: leaf.text,
                    token_aliases,
                }
            } else {
                LeafNode::Right(leaf.text)
            }
        });

        let mut key = serde_json::to_string(&hash_input_tree).expect("Failed to hash JSFBT tree");
        key.push('|');
        key.push_str(&desc);

        jenkins_hash(key.as_bytes())
    } else {
        #[derive(Serialize)]
        #[serde(rename_all = "camelCase")]
        struct LeafNode {
            text: String,
            desc: String,
            #[serde(skip_serializing_if = "Option::is_none")]
            token_aliases: Option<HashMap<String, String>>,
        }

        let hash_input_tree = jsfbt.clone().map_leaves(&|leaf| LeafNode {
            text: leaf.text,
            desc: leaf.desc,
            token_aliases: leaf.token_aliases,
        });

        let key = serde_json::to_string(&hash_input_tree).expect("Failed to hash JSFBT tree");
        jenkins_hash(key.as_bytes())
    }
}

pub fn fbt_hash_key(jsfbt: &mut TableJSFBTTree) -> String {
    u32_to_base_n(fbt_jenkins_hash(jsfbt), 62)
}
