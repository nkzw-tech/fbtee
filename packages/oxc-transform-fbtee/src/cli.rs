use serde_json::{Map, Value};

pub fn prepare_translations(
    source_json: &str,
    existing_json: Option<&str>,
    locale: &str,
    sort_by_hash: bool,
) -> Result<String, String> {
    let source: Value = serde_json::from_str(source_json)
        .map_err(|error| format!("Invalid source strings JSON: {error}"))?;
    let mut phrases = Map::new();
    for phrase in source
        .get("phrases")
        .and_then(Value::as_array)
        .ok_or("Source strings JSON must contain a 'phrases' array.")?
    {
        if let Some(hash_to_leaf) = phrase.get("hashToLeaf").and_then(Value::as_object) {
            for (hash, leaf) in hash_to_leaf {
                phrases.insert(hash.clone(), leaf.clone());
            }
        }
    }

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
        if !translations.contains_key(&hash) {
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
                hash,
                serde_json::json!({
                    "description": desc,
                    "status": "new",
                    "tokens": [],
                    "translations": [{"translation": text, "variations": {}}],
                    "types": [],
                }),
            );
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
