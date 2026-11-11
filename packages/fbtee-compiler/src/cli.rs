use serde_json::{Map, Value};
use std::collections::HashMap;

pub fn prepare_translations(
    source_json: &str,
    existing_json: Option<&str>,
    locale: &str,
    sort_by_hash: bool,
) -> Result<String, String> {
    let phrases = source_phrases(source_json)?;
    prepare_translations_with_phrases(&phrases, existing_json, locale, sort_by_hash)
}

pub fn source_phrases(source_json: &str) -> Result<Map<String, Value>, String> {
    let source: Value = serde_json::from_str(source_json)
        .map_err(|error| format!("Invalid source strings JSON: {error}"))?;
    let mut phrases = Map::new();
    for phrase in source
        .get("phrases")
        .and_then(Value::as_array)
        .ok_or("Source strings JSON must contain a 'phrases' array.")?
    {
        if let Some(hash_to_leaf) = phrase.get("hashToLeaf").and_then(Value::as_object) {
            let mut leaf_hashes = HashMap::new();
            for (hash, leaf) in hash_to_leaf {
                phrases.entry(hash.clone()).or_insert_with(|| leaf.clone());
                if let (Some(text), Some(desc)) = (
                    leaf.get("text").and_then(Value::as_str),
                    leaf.get("desc").and_then(Value::as_str),
                ) {
                    leaf_hashes.insert((text, desc), hash.as_str());
                }
            }
            if let (Some(table), Some(metadata)) = (
                phrase.pointer("/jsfbt/t"),
                phrase.pointer("/jsfbt/m").and_then(Value::as_array),
            ) {
                collect_leaf_variations(table, metadata, &mut vec![], &leaf_hashes, &mut phrases);
            }
        }
    }

    Ok(phrases)
}

fn collect_leaf_variations(
    table: &Value,
    metadata: &[Value],
    active: &mut Vec<(String, u8)>,
    leaf_hashes: &HashMap<(&str, &str), &str>,
    phrases: &mut Map<String, Value>,
) {
    if let (Some(text), Some(desc)) = (
        table.get("text").and_then(Value::as_str),
        table.get("desc").and_then(Value::as_str),
    ) {
        if let Some(phrase) = leaf_hashes
            .get(&(text, desc))
            .and_then(|hash| phrases.get_mut(*hash))
            .and_then(Value::as_object_mut)
        {
            for (token, mask) in active {
                append_variation(phrase, token, (*mask).into());
            }
        }
        return;
    }
    let Some(branches) = table.as_object() else {
        return;
    };
    let Some((current, remaining)) = metadata.split_first() else {
        return;
    };
    let variation = current.get("token").and_then(Value::as_str).zip(
        match current.get("type").and_then(Value::as_u64) {
            Some(1) => Some(3),
            Some(2) => Some(28),
            _ => None,
        },
    );
    for (key, branch) in branches {
        let previous_len = active.len();
        // An exact-one source branch is fixed, unlike the wildcard branch from
        // which the translator generates the target locale's plural categories.
        if !(key == "_1" && current.get("singular").and_then(Value::as_bool) == Some(true)) {
            if let Some((token, mask)) = variation {
                active.push((token.to_string(), mask));
            }
        }
        collect_leaf_variations(branch, remaining, active, leaf_hashes, phrases);
        active.truncate(previous_len);
    }
}

fn append_variation(entry: &mut Map<String, Value>, token: &str, variation_type: Value) {
    let tokens = entry
        .entry("tokens")
        .or_insert_with(|| Value::Array(vec![]));
    let Some(tokens) = tokens.as_array_mut() else {
        return;
    };
    if tokens
        .iter()
        .any(|existing| existing.as_str() == Some(token))
    {
        return;
    }
    let index = tokens.len();
    tokens.push(token.into());
    let types = entry.entry("types").or_insert_with(|| Value::Array(vec![]));
    if let Some(types) = types.as_array_mut() {
        types.resize(index, Value::Null);
        types.push(variation_type);
    }
}

pub fn prepare_translations_with_phrases(
    phrases: &Map<String, Value>,
    existing_json: Option<&str>,
    locale: &str,
    sort_by_hash: bool,
) -> Result<String, String> {
    let mut group = match existing_json {
        Some(json) => serde_json::from_str::<Value>(json)
            .map_err(|error| format!("Invalid translation JSON: {error}"))?
            .as_object()
            .cloned()
            .ok_or("Translation JSON must be an object.")?,
        None => Map::new(),
    };
    let mut translations = match group.shift_remove("translations") {
        Some(value) => value
            .as_object()
            .cloned()
            .ok_or("Translation JSON 'translations' field must be an object.")?,
        None if existing_json.is_some() => {
            return Err("Translation JSON must contain a 'translations' object.".into());
        }
        None => Map::new(),
    };

    translations.retain(|hash, value| phrases.contains_key(hash) || !json_truthy(value));
    for (hash, phrase) in phrases {
        if !translations.contains_key(hash) {
            let Some(phrase) = phrase.as_object() else {
                continue;
            };
            let (Some(desc), Some(text)) = (
                phrase.get("desc").and_then(Value::as_str),
                phrase.get("text").and_then(Value::as_str),
            ) else {
                continue;
            };
            translations.insert(
                hash.clone(),
                serde_json::json!({
                    "description": desc,
                    "status": "new",
                    "tokens": [],
                    "translations": [{"translation": text, "variations": {}}],
                    "types": [],
                }),
            );
        }
        // Append newly collected dimensions without changing the indexes used by
        // existing translations, including hand-authored catalog metadata.
        if let Some(entry) = translations.get_mut(hash).and_then(Value::as_object_mut) {
            if let (Some(tokens), Some(types)) = (
                phrase.get("tokens").and_then(Value::as_array),
                phrase.get("types").and_then(Value::as_array),
            ) {
                for (token, variation_type) in tokens.iter().zip(types) {
                    if let Some(token) = token.as_str() {
                        append_variation(entry, token, variation_type.clone());
                    }
                }
            }
        }
    }
    if sort_by_hash {
        let mut entries = translations.into_iter().collect::<Vec<_>>();
        entries.sort_by(|(left, _), (right, _)| left.cmp(right));
        translations = entries.into_iter().collect();
    }

    group.insert("fb-locale".into(), locale.into());
    group.insert("translations".into(), Value::Object(translations));
    serde_json::to_string(&Value::Object(group))
        .map_err(|error| format!("Failed to serialize translations: {error}"))
}

pub fn migrate_locale_json(
    json: &str,
    target_locale: &str,
    equivalent_locales: &[String],
) -> Result<String, String> {
    let mut object = serde_json::from_str::<Value>(json)
        .map_err(|error| format!("Invalid locale JSON: {error}"))?
        .as_object()
        .cloned()
        .ok_or("Locale JSON must be an object.")?;
    if object
        .get("fb-locale")
        .and_then(Value::as_str)
        .is_some_and(|locale| equivalent_locales.iter().any(|item| item == locale))
    {
        object.insert("fb-locale".into(), target_locale.into());
    }
    let keys = object.keys().cloned().collect::<Vec<_>>();
    for key in keys {
        if equivalent_locales.iter().any(|locale| locale == &key) {
            let value = object
                .shift_remove(&key)
                .expect("locale key was collected from the object");
            object.insert(target_locale.into(), value);
        }
    }
    serde_json::to_string(&Value::Object(object))
        .map_err(|error| format!("Failed to serialize locale JSON: {error}"))
}

fn json_truthy(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::Bool(value) => *value,
        Value::Number(value) => value
            .as_f64()
            .is_some_and(|value| value != 0.0 && !value.is_nan()),
        Value::String(value) => !value.is_empty(),
        Value::Array(_) | Value::Object(_) => true,
    }
}

#[cfg(test)]
mod tests {
    use super::{migrate_locale_json, prepare_translations};

    #[test]
    fn adds_and_removes_translation_entries() {
        let source = r#"{"phrases":[{"hashToLeaf":{"new":{"desc":"Description","text":"Text"}}}]}"#;
        let existing = r#"{"fb-locale":"en_US","translations":{"old":{"status":"done"}}}"#;
        assert_eq!(
            prepare_translations(source, Some(existing), "en-US", false).unwrap(),
            r#"{"fb-locale":"en-US","translations":{"new":{"description":"Description","status":"new","tokens":[],"translations":[{"translation":"Text","variations":{}}],"types":[]}}}"#,
        );
    }

    #[test]
    fn preserves_falsy_entries_for_existing_and_removed_hashes() {
        let source =
            r#"{"phrases":[{"hashToLeaf":{"existing":{"desc":"Description","text":"Text"}}}]}"#;
        let existing = r#"{"fb-locale":"en_US","translations":{"existing":null,"removed":null,"removedTruthy":{"status":"done"}}}"#;
        assert_eq!(
            prepare_translations(source, Some(existing), "en-US", false).unwrap(),
            r#"{"fb-locale":"en-US","translations":{"existing":null,"removed":null}}"#,
        );
    }

    #[test]
    fn rejects_malformed_existing_translation_files() {
        let source = r#"{"phrases":[]}"#;
        for existing in [r#"{"fb-locale":"en_US"}"#, r#"{"translations":[]}"#] {
            assert!(prepare_translations(source, Some(existing), "en-US", false).is_err());
        }
    }

    #[test]
    fn updates_locale_fields_and_dictionary_keys() {
        assert_eq!(
            migrate_locale_json(
                r#"{"fb-locale":"de_DE","de_DE":{"hash":"Text"},"other":true}"#,
                "de-DE",
                &["de_DE".into(), "de-DE".into()],
            )
            .unwrap(),
            r#"{"fb-locale":"de-DE","other":true,"de-DE":{"hash":"Text"}}"#,
        );
    }
}
