use serde_json::{Map, Value};
use std::{
    cell::{Ref, RefCell},
    collections::HashMap,
};

const VIEWING_USER: &str = "__viewing_user__";
const EXACTLY_ONE: &str = "_1";
const NUMBER_MASK: u8 = 28;
const GENDER_MASK: u8 = 3;

#[derive(Clone)]
struct Metadata {
    token: Option<String>,
    variation_mask: Option<u8>,
}

#[derive(Clone)]
struct TranslationData {
    tokens: Vec<String>,
    types: Vec<i64>,
    translations: Vec<Value>,
}

struct Site {
    hash_to_leaf: Map<String, Value>,
    hash_to_aliases: HashMap<String, Map<String, Value>>,
    table: Value,
    metadata: Vec<Option<Metadata>>,
}

struct Builder<'a> {
    site: &'a Site,
    translations: &'a HashMap<String, TranslationData>,
    token_to_mask: Vec<(String, u8)>,
    constraint_maps: RefCell<HashMap<String, HashMap<String, String>>>,
    number_fallback: i64,
    gender_fallback: i64,
}

pub fn translate(input_json: &str, use_jenkins: bool) -> Result<String, String> {
    let input: Value = serde_json::from_str(input_json)
        .map_err(|error| format!("Invalid translation input JSON: {error}"))?;
    let phrases = input
        .get("phrases")
        .and_then(Value::as_array)
        .ok_or("Translation input must contain a 'phrases' array.")?;
    let sites = phrases
        .iter()
        .map(Site::from_phrase)
        .collect::<Result<Vec<_>, _>>()?;
    let groups = input
        .get("translationGroups")
        .and_then(Value::as_array)
        .ok_or("Translation input must contain a 'translationGroups' array.")?;

    let mut translated_groups = Vec::with_capacity(groups.len());
    for group in groups {
        let locale = group
            .get("fb-locale")
            .and_then(Value::as_str)
            .ok_or("A translation group must contain 'fb-locale'.")?;
        let output_locale = group
            .get("__output-locale")
            .and_then(Value::as_str)
            .unwrap_or(locale);
        let translations = group
            .get("translations")
            .and_then(Value::as_object)
            .ok_or("A translation group must contain a 'translations' object.")?;
        if translations
            .values()
            .any(|translation| !translation.is_object())
        {
            return Err("Translation entries must be objects.".into());
        }
        let mut parsed_translations = HashMap::new();
        for site in &sites {
            for hash in site.hash_to_leaf.keys() {
                if parsed_translations.contains_key(hash) {
                    continue;
                }
                if let Some(value) = translations.get(hash) {
                    parsed_translations.insert(hash.clone(), parse_translation_data(value)?);
                }
            }
        }
        let number_fallback = group
            .get("__number-fallback")
            .and_then(Value::as_i64)
            .unwrap_or_else(|| number_fallback(locale));
        let gender_fallback = group
            .get("__gender-fallback")
            .and_then(Value::as_i64)
            .unwrap_or_else(|| gender_fallback(locale));
        let mut translated_phrases = Vec::with_capacity(sites.len());
        for site in &sites {
            translated_phrases.push(
                Builder::new(site, &parsed_translations, number_fallback, gender_fallback)
                    .build()?,
            );
        }
        translated_groups.push((output_locale.to_string(), translated_phrases));
    }

    let output = if use_jenkins {
        let mut locales = Map::new();
        for (locale, translated_phrases) in translated_groups {
            let mut hash_to_translation = Map::new();
            for (index, phrase) in phrases.iter().enumerate() {
                let tree = phrase
                    .pointer("/jsfbt/t")
                    .ok_or_else(|| format!("Phrase at index {index} is missing 'jsfbt.t'."))?;
                hash_to_translation.insert(fbt_hash_key(tree)?, translated_phrases[index].clone());
            }
            locales.insert(locale, Value::Object(hash_to_translation));
        }
        Value::Object(locales)
    } else {
        Value::Array(
            translated_groups
                .into_iter()
                .map(|(locale, translated_phrases)| {
                    serde_json::json!({
                        "fb-locale": locale,
                        "translatedPhrases": translated_phrases,
                    })
                })
                .collect(),
        )
    };
    serde_json::to_string(&output).map_err(|error| format!("Failed to serialize output: {error}"))
}

impl Site {
    fn from_phrase(phrase: &Value) -> Result<Self, String> {
        let hash_to_leaf = phrase
            .get("hashToLeaf")
            .and_then(Value::as_object)
            .cloned()
            .ok_or("Expected hashToLeaf to be defined.")?;
        let jsfbt = phrase
            .get("jsfbt")
            .and_then(Value::as_object)
            .ok_or("Expected jsfbt to be defined.")?;
        let raw_table = jsfbt.get("t").ok_or("Expected jsfbt.t to be defined.")?;
        let mut leaf_to_hash = HashMap::new();
        for (hash, leaf) in &hash_to_leaf {
            if let (Some(text), Some(desc)) = (
                leaf.get("text").and_then(Value::as_str),
                leaf.get("desc").and_then(Value::as_str),
            ) {
                leaf_to_hash
                    .entry((text.to_string(), desc.to_string()))
                    .or_insert_with(|| hash.clone());
            }
        }
        let mut hash_to_aliases = HashMap::new();
        let table = hashify_tree(raw_table, &leaf_to_hash, &mut hash_to_aliases)?;
        let metadata = jsfbt
            .get("m")
            .and_then(Value::as_array)
            .ok_or("Expected jsfbt.m to be an array.")?
            .iter()
            .map(|entry| {
                let Some(entry) = entry.as_object() else {
                    return Ok(None);
                };
                let variation_type = entry.get("type").and_then(Value::as_i64);
                let variation_mask = match variation_type {
                    Some(1) => Some(GENDER_MASK),
                    Some(2) => Some(NUMBER_MASK),
                    _ => None,
                };
                Ok(Some(Metadata {
                    token: entry
                        .get("token")
                        .and_then(Value::as_str)
                        .map(str::to_string),
                    variation_mask,
                }))
            })
            .collect::<Result<Vec<_>, String>>()?;
        Ok(Self {
            hash_to_leaf,
            hash_to_aliases,
            table,
            metadata,
        })
    }
}

impl<'a> Builder<'a> {
    fn new(
        site: &'a Site,
        translations: &'a HashMap<String, TranslationData>,
        number_fallback: i64,
        gender_fallback: i64,
    ) -> Self {
        let mut token_to_mask = vec![];
        for metadata in site.metadata.iter().flatten() {
            if let (Some(token), Some(mask)) = (&metadata.token, metadata.variation_mask) {
                if !token_to_mask.iter().any(|(existing, _)| existing == token) {
                    token_to_mask.push((token.clone(), mask));
                }
            }
        }
        Self {
            site,
            translations,
            token_to_mask,
            constraint_maps: RefCell::new(HashMap::new()),
            number_fallback,
            gender_fallback,
        }
    }

    fn build(mut self) -> Result<Value, String> {
        let mut has_viewer_gender = false;
        for hash in self.site.hash_to_leaf.keys() {
            if self
                .translation_data(hash)
                .is_some_and(|data| data.tokens.iter().any(|token| token == VIEWING_USER))
            {
                has_viewer_gender = true;
                break;
            }
        }
        let mut table = self.site.table.clone();
        let mut metadata = self.site.metadata.clone();
        if has_viewer_gender {
            let mut wrapped = Map::new();
            wrapped.insert("*".into(), table);
            table = Value::Object(wrapped);
            metadata.insert(
                0,
                Some(Metadata {
                    token: Some(VIEWING_USER.into()),
                    variation_mask: Some(GENDER_MASK),
                }),
            );
            self.token_to_mask
                .insert(0, (VIEWING_USER.into(), GENDER_MASK));
        }
        let mut constraints = Map::new();
        let mut output = self.build_recursive(&table, &metadata, &mut constraints, 0)?;
        if has_viewer_gender {
            let object = output
                .as_object_mut()
                .ok_or("Viewer-gender translation must produce a table.")?;
            object.insert("__vcg".into(), 1.into());
        }
        Ok(output)
    }

    fn build_recursive(
        &self,
        hash_or_table: &Value,
        metadata: &[Option<Metadata>],
        constraints: &mut Map<String, Value>,
        level: usize,
    ) -> Result<Value, String> {
        if let Some(hash) = hash_or_table.as_str() {
            return self.leaf_translation(hash, constraints);
        }
        let object = hash_or_table
            .as_object()
            .ok_or("A hashified jsfbt table branch must be an object.")?;
        let mut table = Map::new();
        for (key, branch) in object {
            let mut translation = self.build_recursive(branch, metadata, constraints, level + 1)?;
            if should_store(&translation) {
                table.insert(key.clone(), translation);
            }
            let current = metadata.get(level).and_then(Option::as_ref);
            if let Some(Metadata {
                token: Some(token),
                variation_mask: Some(mask),
            }) = current
            {
                if key != EXACTLY_ONE {
                    let candidates: &[i64] = if *mask == NUMBER_MASK {
                        &[20, 12, 4, 24, 8, 16]
                    } else {
                        &[1, 2, 3]
                    };
                    for candidate in candidates {
                        constraints.insert(token.clone(), (*candidate).into());
                        translation =
                            self.build_recursive(branch, metadata, constraints, level + 1)?;
                        if should_store(&translation) {
                            table.insert(candidate.to_string(), translation);
                        }
                    }
                    constraints.shift_remove(token);
                }
            }
        }
        Ok(Value::Object(table))
    }

    fn leaf_translation(
        &self,
        hash: &str,
        constraints: &Map<String, Value>,
    ) -> Result<Value, String> {
        let mut translation = if constraints.is_empty() {
            self.default_translation(hash)?.or_else(|| {
                self.site
                    .hash_to_leaf
                    .get(hash)
                    .and_then(|leaf| leaf.get("text"))
                    .and_then(Value::as_str)
                    .map(str::to_string)
            })
        } else {
            self.constrained_translation(hash, constraints)?
        };
        if let Some(text) = translation.as_mut() {
            if let Some(aliases) = self.site.hash_to_aliases.get(hash) {
                for (clear, alias) in aliases {
                    let Some(alias) = alias.as_str() else {
                        continue;
                    };
                    *text = text.replacen(&format!("{{{clear}}}"), &format!("{{{alias}}}"), 1);
                }
            }
        }
        Ok(translation.map_or(Value::Null, Value::String))
    }

    fn default_translation(&self, hash: &str) -> Result<Option<String>, String> {
        let Some(data) = self.translation_data(hash) else {
            return Ok(None);
        };
        Ok(data.translations.iter().find_map(|translation| {
            let object = translation.as_object()?;
            let variations = object.get("variations").and_then(Value::as_object);
            let is_default = variations.is_none_or(|variations| {
                variations
                    .values()
                    .all(|value| self.is_default_variation(value))
            });
            is_default
                .then(|| object.get("translation")?.as_str().map(str::to_string))
                .flatten()
        }))
    }

    fn constrained_translation(
        &self,
        hash: &str,
        constraints: &Map<String, Value>,
    ) -> Result<Option<String>, String> {
        let mut keys = self
            .token_to_mask
            .iter()
            .map(|(token, _)| {
                (
                    token.clone(),
                    constraints
                        .get(token)
                        .cloned()
                        .unwrap_or_else(|| Value::String("*".into())),
                )
            })
            .collect::<Vec<_>>();
        let map = self.constraint_map(hash)?;
        let key = constraint_key(&keys);
        let Some(translation) = map.get(&key).filter(|value| !value.is_empty()) else {
            return Ok(None);
        };
        for index in 0..keys.len() {
            if keys[index].1.as_str() == Some("*") {
                continue;
            }
            let original = keys[index].1.clone();
            keys[index].1 = Value::String("*".into());
            if map.get(&constraint_key(&keys)) == Some(translation) {
                return Ok(None);
            }
            keys[index].1 = original;
        }
        Ok(Some(translation.clone()))
    }

    fn constraint_map(&self, hash: &str) -> Result<Ref<'_, HashMap<String, String>>, String> {
        if !self.constraint_maps.borrow().contains_key(hash) {
            let output = self.build_constraint_map(hash)?;
            self.constraint_maps
                .borrow_mut()
                .insert(hash.to_string(), output);
        }
        Ok(Ref::map(self.constraint_maps.borrow(), |maps| {
            maps.get(hash)
                .expect("constraint map was populated before borrowing")
        }))
    }

    fn build_constraint_map(&self, hash: &str) -> Result<HashMap<String, String>, String> {
        let Some(data) = self.translation_data(hash) else {
            return Ok(HashMap::new());
        };
        let mut output = HashMap::new();
        for translation in &data.translations {
            let object = translation
                .as_object()
                .ok_or("A translation entry must be an object.")?;
            let mut constraints = HashMap::new();
            let mut prune = false;
            if let Some(variations) = object.get("variations").and_then(Value::as_object) {
                for (index, variation) in variations {
                    let index = index
                        .parse::<usize>()
                        .map_err(|_| "Translation variation indexes must be numeric.")?;
                    let token = data
                        .tokens
                        .get(index)
                        .ok_or("Translation variation token index is out of bounds.")?;
                    let expected_type = data.types.get(index).copied();
                    let actual_mask = self
                        .token_to_mask
                        .iter()
                        .find(|(candidate, _)| candidate == token)
                        .map(|(_, mask)| *mask);
                    let expected_mask = expected_type.and_then(type_to_mask);
                    if (actual_mask.is_none() || actual_mask != expected_mask)
                        && !self.is_default_variation(variation)
                    {
                        prune = true;
                        break;
                    }
                    constraints.insert(token.clone(), variation.clone());
                }
            }
            if prune {
                continue;
            }
            let keys = self
                .token_to_mask
                .iter()
                .map(|(token, _)| {
                    (
                        token.clone(),
                        constraints
                            .get(token)
                            .cloned()
                            .unwrap_or_else(|| Value::String("*".into())),
                    )
                })
                .collect::<Vec<_>>();
            let text = object
                .get("translation")
                .and_then(Value::as_str)
                .ok_or("A translation entry must contain a string translation.")?;
            self.insert_constraint(&mut output, keys, text, 0)?;
        }
        Ok(output)
    }

    fn insert_constraint(
        &self,
        output: &mut HashMap<String, String>,
        mut keys: Vec<(String, Value)>,
        translation: &str,
        defaulting_level: usize,
    ) -> Result<(), String> {
        let key = constraint_key(&keys);
        if let Some(original) = output.get(&key) {
            return Err(format!(
                "Unexpected duplicate key: {key}\nOriginal: {original}\nNew {translation}"
            ));
        }
        output.insert(key, translation.into());
        for index in defaulting_level..keys.len() {
            if keys[index].1.as_str() != Some("*") && self.is_default_variation(&keys[index].1) {
                let original = keys[index].1.clone();
                keys[index].1 = Value::String("*".into());
                self.insert_constraint(output, keys.clone(), translation, index + 1)?;
                keys[index].1 = original;
            }
        }
        Ok(())
    }

    fn translation_data(&self, hash: &str) -> Option<&TranslationData> {
        self.translations.get(hash)
    }

    fn is_default_variation(&self, value: &Value) -> bool {
        let value = value
            .as_i64()
            .or_else(|| value.as_str().and_then(js_parse_int));
        value.is_some_and(|value| value == self.number_fallback || value == self.gender_fallback)
    }
}

fn hashify_tree(
    value: &Value,
    leaf_to_hash: &HashMap<(String, String), String>,
    hash_to_aliases: &mut HashMap<String, Map<String, Value>>,
) -> Result<Value, String> {
    if is_leaf(value) {
        let object = value.as_object().expect("leaf is an object");
        let text = object.get("text").and_then(Value::as_str).unwrap();
        let desc = object.get("desc").and_then(Value::as_str).unwrap();
        let hash = leaf_to_hash
            .get(&(text.to_string(), desc.to_string()))
            .ok_or("A jsfbt leaf did not have a corresponding hashToLeaf entry.")?;
        if let Some(aliases) = object.get("tokenAliases").and_then(Value::as_object) {
            hash_to_aliases.insert(hash.clone(), aliases.clone());
        }
        return Ok(Value::String(hash.clone()));
    }
    let object = value
        .as_object()
        .ok_or("A jsfbt table branch must be an object.")?;
    Ok(Value::Object(
        object
            .iter()
            .map(|(key, value)| {
                Ok((
                    key.clone(),
                    hashify_tree(value, leaf_to_hash, hash_to_aliases)?,
                ))
            })
            .collect::<Result<Map<_, _>, String>>()?,
    ))
}

fn parse_translation_data(value: &Value) -> Result<TranslationData, String> {
    let object = value
        .as_object()
        .ok_or("A translation payload must be an object.")?;
    let tokens = match object.get("tokens") {
        None => vec![],
        Some(value) => value
            .as_array()
            .ok_or("A translation payload's 'tokens' field must be an array.")?
            .iter()
            .map(|token| {
                token
                    .as_str()
                    .map(str::to_string)
                    .ok_or_else(|| "Translation tokens must be strings.".to_string())
            })
            .collect::<Result<Vec<_>, _>>()?,
    };
    let types = match object.get("types") {
        None => vec![],
        Some(value) => value
            .as_array()
            .ok_or("A translation payload's 'types' field must be an array.")?
            .iter()
            .map(|value| {
                value
                    .as_i64()
                    .ok_or_else(|| "Translation types must be integers.".to_string())
            })
            .collect::<Result<Vec<_>, _>>()?,
    };
    let mut translations = object
        .get("translations")
        .and_then(Value::as_array)
        .ok_or("A translation payload must contain a 'translations' array.")?
        .clone();
    for translation in &mut translations {
        let translation = translation
            .as_object_mut()
            .ok_or("A translation entry must be an object.")?;
        translation
            .get("translation")
            .and_then(Value::as_str)
            .ok_or("A translation entry must contain a string translation.")?;
        if let Some(variations) = translation.get("variations") {
            // The original translation interchange format documents variations as
            // arrays, while newer prepare-translations output uses objects. JavaScript
            // consumes both through Object.keys(), so normalize arrays to numeric keys.
            let variations = match variations {
                Value::Object(variations) => variations.clone(),
                Value::Array(variations) => variations
                    .iter()
                    .enumerate()
                    .map(|(index, value)| (index.to_string(), value.clone()))
                    .collect(),
                _ => {
                    return Err(
                        "A translation entry's 'variations' field must be an object or array."
                            .into(),
                    );
                }
            };
            if variations
                .values()
                .any(|value| !value.is_number() && !value.is_string())
            {
                return Err("Translation variation values must be strings or numbers.".into());
            }
            translation.insert("variations".into(), Value::Object(variations));
        }
    }
    Ok(TranslationData {
        tokens,
        types,
        translations,
    })
}

fn type_to_mask(value: i64) -> Option<u8> {
    match value {
        3 => Some(GENDER_MASK),
        28 => Some(NUMBER_MASK),
        _ => None,
    }
}

fn constraint_key(keys: &[(String, Value)]) -> String {
    keys.iter()
        .map(|(token, value)| {
            let value = value
                .as_str()
                .map(str::to_string)
                .unwrap_or_else(|| value.to_string());
            format!("{token}%{value}")
        })
        .collect::<Vec<_>>()
        .join(":")
}

fn should_store(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::Object(object) => !object.is_empty(),
        _ => true,
    }
}

fn number_fallback(locale: &str) -> i64 {
    if ["be", "pl", "ru", "szl", "uk"].contains(&locale_language(locale).as_str()) {
        12
    } else {
        24
    }
}

fn gender_fallback(locale: &str) -> i64 {
    let normalized = locale.trim().replace('-', "_");
    if [
        "ar_AR", "ks_IN", "lv_LV", "ps_AF", "qk_DZ", "qs_DE", "qv_IT", "sq_AL", "ti_ET",
    ]
    .contains(&normalized.as_str())
        || ["ar", "dsb", "kab", "ks", "lv", "ps", "sq", "ti", "vec"]
            .contains(&locale_language(locale).as_str())
    {
        1
    } else {
        3
    }
}

fn locale_language(locale: &str) -> String {
    match locale.trim().replace('-', "_").as_str() {
        "bp_IN" => "bho".into(),
        "bv_DE" => "bar".into(),
        "cb_IQ" => "ckb".into(),
        "ck_US" => "chr".into(),
        "cx_PH" => "ceb".into(),
        "qk_DZ" => "kab".into(),
        "qs_DE" => "dsb".into(),
        "qv_IT" => "vec".into(),
        "sz_PL" => "szl".into(),
        value => value.split('_').next().unwrap_or(value).to_lowercase(),
    }
}

fn js_parse_int(value: &str) -> Option<i64> {
    let value = value.trim_start();
    let length = value
        .char_indices()
        .take_while(|(index, character)| {
            character.is_ascii_digit() || (*index == 0 && matches!(character, '+' | '-'))
        })
        .last()
        .map_or(0, |(index, character)| index + character.len_utf8());
    (length > 0).then(|| value[..length].parse().ok()).flatten()
}

fn is_leaf(value: &Value) -> bool {
    value.as_object().is_some_and(|object| {
        object.get("text").is_some_and(Value::is_string)
            && object.get("desc").is_some_and(Value::is_string)
    })
}

fn fbt_hash_key(tree: &Value) -> Result<String, String> {
    let mut descriptions = vec![];
    collect_descriptions(tree, &mut descriptions)?;
    let input = if descriptions
        .first()
        .is_some_and(|first| descriptions.iter().all(|item| item == first))
    {
        format!(
            "{}|{}",
            serde_json::to_string(&hash_text_tree(tree)).unwrap(),
            descriptions[0]
        )
    } else {
        serde_json::to_string(&hash_full_tree(tree)).unwrap()
    };
    Ok(base62(jenkins(&input)))
}

fn collect_descriptions<'a>(value: &'a Value, output: &mut Vec<&'a str>) -> Result<(), String> {
    if is_leaf(value) {
        output.push(value.get("desc").and_then(Value::as_str).unwrap());
        return Ok(());
    }
    for value in value
        .as_object()
        .ok_or("A jsfbt hash tree branch must be an object.")?
        .values()
    {
        collect_descriptions(value, output)?;
    }
    Ok(())
}

fn hash_text_tree(value: &Value) -> Value {
    if is_leaf(value) {
        let object = value.as_object().unwrap();
        if let Some(aliases) = object.get("tokenAliases") {
            let mut leaf = Map::new();
            leaf.insert("text".into(), object["text"].clone());
            leaf.insert("tokenAliases".into(), aliases.clone());
            Value::Object(leaf)
        } else {
            object["text"].clone()
        }
    } else {
        Value::Object(
            value
                .as_object()
                .unwrap()
                .iter()
                .map(|(key, value)| (key.clone(), hash_text_tree(value)))
                .collect(),
        )
    }
}

fn hash_full_tree(value: &Value) -> Value {
    if is_leaf(value) {
        let object = value.as_object().unwrap();
        let mut leaf = Map::new();
        leaf.insert("desc".into(), object["desc"].clone());
        leaf.insert("text".into(), object["text"].clone());
        if let Some(aliases) = object.get("tokenAliases") {
            leaf.insert("tokenAliases".into(), aliases.clone());
        }
        Value::Object(leaf)
    } else {
        Value::Object(
            value
                .as_object()
                .unwrap()
                .iter()
                .map(|(key, value)| (key.clone(), hash_full_tree(value)))
                .collect(),
        )
    }
}

fn jenkins(value: &str) -> u32 {
    let mut hash = 0u32;
    for byte in value.bytes() {
        hash = hash.wrapping_add(byte.into());
        hash = hash.wrapping_add(hash << 10);
        hash ^= hash >> 6;
    }
    hash = hash.wrapping_add(hash << 3);
    hash ^= hash >> 11;
    hash.wrapping_add(hash << 15)
}

fn base62(mut value: u32) -> String {
    const SYMBOLS: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if value == 0 {
        return "0".into();
    }
    let mut output = vec![];
    while value > 0 {
        output.push(SYMBOLS[(value % 62) as usize]);
        value /= 62;
    }
    output.reverse();
    String::from_utf8(output).unwrap()
}

#[cfg(test)]
mod tests {
    use super::translate;

    #[test]
    fn translates_a_plain_phrase() {
        let input = r#"{"phrases":[{"hashToLeaf":{"hash":{"desc":"d","text":"A"}},"jsfbt":{"m":[],"t":{"desc":"d","text":"A"}}}],"translationGroups":[{"fb-locale":"de_DE","__output-locale":"de-DE","translations":{"hash":{"tokens":[],"types":[],"translations":[{"translation":"Ein A","variations":{}}]}}}]}"#;
        assert_eq!(
            translate(input, false).unwrap(),
            r#"[{"fb-locale":"de-DE","translatedPhrases":["Ein A"]}]"#
        );
    }

    #[test]
    fn accepts_legacy_array_variations() {
        let input = r#"{"phrases":[{"hashToLeaf":{"hash":{"desc":"d","text":"A"}},"jsfbt":{"m":[],"t":{"desc":"d","text":"A"}}}],"translationGroups":[{"fb-locale":"de_DE","__output-locale":"de-DE","translations":{"hash":{"tokens":["gender"],"types":[3],"translations":[{"translation":"Ein A","variations":[3]}]}}}]}"#;
        assert_eq!(
            translate(input, false).unwrap(),
            r#"[{"fb-locale":"de-DE","translatedPhrases":["Ein A"]}]"#
        );
    }

    #[test]
    fn rejects_malformed_translation_payloads_instead_of_using_source_text() {
        for payload in [
            r#"{}"#,
            r#"{"translations":{}}"#,
            r#"{"translations":[{}]}"#,
            r#"{"translations":[{"translation":"A","variations":true}]}"#,
        ] {
            let input = format!(
                r#"{{"phrases":[{{"hashToLeaf":{{"hash":{{"desc":"d","text":"A"}}}},"jsfbt":{{"m":[],"t":{{"desc":"d","text":"A"}}}}}}],"translationGroups":[{{"fb-locale":"de_DE","translations":{{"hash":{payload}}}}}]}}"#
            );
            assert!(translate(&input, false).is_err(), "{payload}");
        }
    }
}
