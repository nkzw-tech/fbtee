use std::{
    collections::{HashMap, HashSet},
    env, fs,
    io::{self, Read},
    path::{Path, PathBuf},
};

use indexmap::IndexMap;
use serde_json::{Map, Value};

use crate::{cli, collect_batch_sync, translate, CollectInput, TransformOptions};

const ROOT_HELP: &str = r#"Usage: fbtee <command> [options]

Commands:
  collect                 Collect fbt instances from source.
  translate               Translate fbt phrases with provided translations.
  prepare-translations    Prepare translation files from collected strings.
  migrate-locales         Rename locale JSON artifacts between locale styles.

Run "fbtee <command> --help" for command-specific options.
"#;

const COLLECT_HELP: &str = r#"Collect fbt instances from source:
fbtee [options]

Options:
  -h, --help                     Show help
      --packager                 both, none, phrase, or text [default: text]
      --common                   Path to a static common strings module or JSON file
      --enum-manifest            Enum manifest output [default: .enum_manifest.json]
      --options                  Additional comma-separated fbt callsite options
      --include-default-strings  Include fbtee's default strings [default: true]
      --disable-babel-config     Collect unmodified source even when Babel config exists
      --legacy-format            Emit legacy location fields [default: false]
      --src                      Source folders or files [default: current directory]
      --out                      Collection output [default: source_strings.json]
"#;

const TRANSLATE_HELP: &str = r#"Translate fbt phrases with provided translations:
fbtee [options]

Options:
  -h, --help                         Show help
      --jenkins                      Emit Jenkins-hash dictionaries [default: true]
      --stdin                        Read a monolithic JSON payload from stdin
      --source-strings               Source strings file [default: source_strings.json]
      --translations                 Translation JSON files [default: translations/*.json]
  -o, --output-dir                   Locale output directory [default: src/translations/]
      --output-file                  Combined translation output file
      --strict                       Fail on missing translations
      --output-locale-style, --locale-style
                                      bcp47, legacy, or preserve [default: bcp47]
"#;

const PREPARE_HELP: &str = r#"Prepare translation files by merging phrases with existing translations:
fbtee [options]

Options:
  -h, --help                         Show help
      --source-strings               Source strings file [default: source_strings.json]
  -o, --output-dir                   Translation directory [default: translations/]
      --locales, --locale            Locales to process
      --sort-by-hash                 Sort translation entries by hash
      --output-locale-style, --locale-style
                                      bcp47, legacy, or preserve [default: bcp47]
"#;

const MIGRATE_HELP: &str = r#"Rename locale JSON artifacts between legacy and BCP 47 spelling:
fbtee

Options:
  -h, --help     Show help
      --dir      Locale directory [default: translations/]
      --to       bcp47 or legacy [default: bcp47]
      --dry-run  Print changes without writing files
"#;

const BABEL_CONFIG_FILENAMES: &[&str] = &[
    ".babelignore",
    ".babelrc",
    ".babelrc.cjs",
    ".babelrc.cts",
    ".babelrc.js",
    ".babelrc.json",
    ".babelrc.mjs",
    ".babelrc.mts",
    ".babelrc.ts",
    "babel.config.cjs",
    "babel.config.cts",
    "babel.config.js",
    "babel.config.json",
    "babel.config.mjs",
    "babel.config.mts",
    "babel.config.ts",
];

const SOURCE_EXTENSIONS: &[&str] = &["js", "jsx", "ts", "tsx"];

pub fn run() -> Result<(), String> {
    let mut args = env::args().skip(1).collect::<Vec<_>>();
    let Some(command) = args.first().cloned() else {
        print!("{ROOT_HELP}");
        return Ok(());
    };
    if matches!(command.as_str(), "help" | "--help" | "-h") {
        print!("{ROOT_HELP}");
        return Ok(());
    }
    if command == "--version" {
        println!("{}", env!("CARGO_PKG_VERSION"));
        return Ok(());
    }
    args.remove(0);
    match command.as_str() {
        "collect" => collect(args),
        "translate" => translate_command(args),
        "prepare-translations" => prepare_translations(args),
        "migrate-locales" => migrate_locales(args),
        _ => {
            eprintln!("Unknown command: {command}\n");
            print!("{ROOT_HELP}");
            std::process::exit(1);
        }
    }
}

#[derive(Default)]
struct ParsedArguments {
    values: HashMap<String, Vec<String>>,
    booleans: HashMap<String, bool>,
    help: bool,
    version: bool,
}

impl ParsedArguments {
    fn value(&self, name: &str) -> Option<&str> {
        self.values
            .get(name)
            .and_then(|values| values.last())
            .map(String::as_str)
    }

    fn values(&self, name: &str) -> Vec<String> {
        self.values.get(name).cloned().unwrap_or_default()
    }

    fn boolean(&self, name: &str, default: bool) -> bool {
        self.booleans.get(name).copied().unwrap_or(default)
    }
}

fn parse_arguments(
    args: Vec<String>,
    strings: &[&str],
    arrays: &[&str],
    booleans: &[&str],
    aliases: &[(&str, &str)],
) -> Result<ParsedArguments, String> {
    let aliases = aliases.iter().copied().collect::<HashMap<_, _>>();
    let mut output = ParsedArguments::default();
    if args
        .iter()
        .any(|arg| matches!(arg.as_str(), "-h" | "--help"))
    {
        output.help = true;
        return Ok(output);
    }
    if args.iter().any(|arg| arg == "--version") {
        output.version = true;
        return Ok(output);
    }
    let mut index = 0;
    while index < args.len() {
        let raw = &args[index];
        if !raw.starts_with('-') {
            return Err(format!("Unknown argument: {raw}"));
        }
        let (mut name, attached) = if let Some(value) = raw.strip_prefix("--") {
            value
                .split_once('=')
                .map_or((value, None), |(name, value)| {
                    (name, Some(value.to_string()))
                })
        } else {
            let short = raw.trim_start_matches('-');
            (short, None)
        };
        name = aliases.get(name).copied().unwrap_or(name);
        if name == "oxc" {
            index += 1;
            continue;
        }
        if let Some(positive) = name.strip_prefix("no-") {
            if booleans.contains(&positive) {
                output.booleans.insert(positive.into(), false);
                index += 1;
                continue;
            }
        }
        if booleans.contains(&name) {
            let value = attached
                .as_deref()
                .map(parse_boolean)
                .transpose()?
                .unwrap_or(true);
            output.booleans.insert(name.into(), value);
            index += 1;
            continue;
        }
        if strings.contains(&name) {
            let value = match attached {
                Some(value) => value,
                None => {
                    index += 1;
                    args.get(index)
                        .filter(|value| !value.starts_with('-'))
                        .cloned()
                        .ok_or_else(|| format!("Missing value for --{name}"))?
                }
            };
            output.values.entry(name.into()).or_default().push(value);
            index += 1;
            continue;
        }
        if arrays.contains(&name) {
            let mut values = vec![];
            if let Some(value) = attached {
                values.push(value);
            }
            index += 1;
            while let Some(value) = args.get(index) {
                if value.starts_with('-') {
                    break;
                }
                values.push(value.clone());
                index += 1;
            }
            if values.is_empty() {
                return Err(format!("Missing value for --{name}"));
            }
            output.values.entry(name.into()).or_default().extend(values);
            continue;
        }
        if matches!(
            name,
            "hash-module" | "custom-collector" | "transform" | "generate-fbt-nodes"
        ) {
            return Err(format!(
                "--{name} was removed in fbtee 4.0 because it requires the legacy Babel/JavaScript pipeline."
            ));
        }
        return Err(format!("Unknown argument: {raw}"));
    }
    Ok(output)
}

fn parse_boolean(value: &str) -> Result<bool, String> {
    match value {
        "true" => Ok(true),
        "false" => Ok(false),
        _ => Err(format!("Expected a boolean, received '{value}'.")),
    }
}

fn collect(args: Vec<String>) -> Result<(), String> {
    let args = parse_arguments(
        args,
        &["packager", "common", "enum-manifest", "options", "out"],
        &["src"],
        &[
            "include-default-strings",
            "disable-babel-config",
            "legacy-format",
        ],
        &[],
    )?;
    if args.version {
        println!("{}", env!("CARGO_PKG_VERSION"));
        return Ok(());
    }
    if args.help {
        print!("{COLLECT_HELP}");
        return Ok(());
    }
    let root = env::current_dir().map_err(|error| error.to_string())?;
    let sources = {
        let values = args.values("src");
        if values.is_empty() {
            vec![root.to_string_lossy().into_owned()]
        } else {
            values
        }
    };
    let packager = args.value("packager").unwrap_or("text");
    if !["both", "none", "phrase", "text"].contains(&packager) {
        return Err(format!("Invalid packager '{packager}'."));
    }
    let source_files = discover_source_files(&root, &sources)?;
    let mut files = Vec::new();
    let mut collected_paths = Vec::new();
    for path in source_files {
        let source_text = fs::read_to_string(&path)
            .map_err(|error| format!("Could not read '{}': {error}", path.display()))?;
        if contains_fbtee_source(&source_text) {
            files.push(CollectInput {
                filename: display_relative(&root, &path),
                source_text,
            });
            collected_paths.push(path);
        }
    }
    if !files.is_empty() && !args.boolean("disable-babel-config", false) {
        if let Some(config) = find_babel_config(&root, &collected_paths)? {
            return Err(format!(
                "The native Oxc collector cannot execute Babel configuration from '{}'. Remove the legacy configuration or pass --disable-babel-config to explicitly collect the unmodified source.",
                display_relative(&root, &config)
            ));
        }
    }

    let enum_manifest = discover_enum_manifest(&root, &sources)?;
    let enum_manifest_path = resolve_from(
        &root,
        args.value("enum-manifest").unwrap_or(".enum_manifest.json"),
    );
    write_text(
        &enum_manifest_path,
        &serde_json::to_string(&enum_manifest).map_err(|error| error.to_string())?,
    )?;

    let fbt_common = args
        .value("common")
        .filter(|value| !value.is_empty())
        .map(|value| read_static_string_map(&resolve_from(&root, value)))
        .transpose()?
        .unwrap_or_default();
    let extra_options = args
        .value("options")
        .map(|value| value.split(',').map(str::to_string).collect())
        .unwrap_or_default();
    let result = collect_batch_sync(
        files,
        Some(TransformOptions {
            collect_packager: Some(packager.into()),
            extra_options: Some(extra_options),
            fbt_common: Some(fbt_common.into_iter().collect()),
            fbt_enum_manifest: Some(enum_manifest),
            source_type: Some("unambiguous".into()),
            ..TransformOptions::default()
        }),
    );
    if !result.errors.is_empty() {
        return Err(result
            .errors
            .into_iter()
            .map(|error| error.message)
            .collect::<Vec<_>>()
            .join("\n"));
    }
    let mut output: Value = serde_json::from_str(
        result
            .output
            .as_deref()
            .ok_or("The native collector did not return output.")?,
    )
    .map_err(|error| error.to_string())?;
    if args.boolean("include-default-strings", true) {
        append_default_strings(&mut output)?;
    }
    if args.boolean("legacy-format", false) {
        add_legacy_locations(&mut output);
    }
    let output_path = resolve_from(&root, args.value("out").unwrap_or("source_strings.json"));
    write_text(&output_path, &json_pretty(output)?)
}

fn discover_source_files(root: &Path, sources: &[String]) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    for source in sources {
        let path = resolve_from(root, source);
        let metadata = fs::metadata(&path)
            .map_err(|error| format!("Could not inspect '{}': {error}", path.display()))?;
        if metadata.is_file() {
            files.push(path);
            continue;
        }
        files.extend(discover_directory_files(&path, false)?);
    }
    Ok(files)
}

fn discover_enum_manifest(
    root: &Path,
    sources: &[String],
) -> Result<IndexMap<String, IndexMap<String, String>>, String> {
    let mut manifest = IndexMap::new();
    for source in sources {
        let path = resolve_from(root, source);
        if !path.is_dir() {
            continue;
        }
        let files = discover_directory_files(&path, true)?;
        for file in files {
            let name = file
                .file_stem()
                .expect("enum file has a stem")
                .to_string_lossy()
                .into_owned();
            manifest.insert(name, read_static_string_map(&file)?);
        }
    }
    Ok(manifest)
}

// Node's fs.globSync emits files in lexical order within each directory and
// traverses subdirectories in reverse lexical order. Collection order is part
// of fbtee's serialized format, so preserve that behavior explicitly.
fn discover_directory_files(directory: &Path, enums_only: bool) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    let mut directories = Vec::new();
    for entry in fs::read_dir(directory)
        .map_err(|error| format!("Could not read '{}': {error}", directory.display()))?
    {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        if file_type.is_dir() {
            directories.push(path);
        } else if file_type.is_file()
            && is_source_file(&path)
            && (!enums_only
                || path
                    .file_stem()
                    .is_some_and(|name| name.to_string_lossy().ends_with("$FbtEnum")))
        {
            files.push(path);
        }
    }
    files.sort_by(|left, right| left.as_os_str().cmp(right.as_os_str()));
    directories.sort_by(|left, right| right.as_os_str().cmp(left.as_os_str()));
    for directory in directories {
        files.extend(discover_directory_files(&directory, enums_only)?);
    }
    Ok(files)
}

fn is_source_file(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| SOURCE_EXTENSIONS.contains(&value))
}

fn contains_fbtee_source(source: &str) -> bool {
    let bytes = source.as_bytes();
    for index in 0..bytes.len() {
        if bytes[index] == b'<'
            && matches!(bytes.get(index + 1), Some(b'f' | b'F'))
            && bytes.get(index + 2) == Some(&b'b')
            && matches!(bytes.get(index + 3), Some(b't' | b's'))
            && bytes
                .get(index + 4)
                .is_none_or(|byte| !byte.is_ascii_alphanumeric() && *byte != b'_')
        {
            return true;
        }
        if bytes.get(index) != Some(&b'f')
            || bytes.get(index + 1) != Some(&b'b')
            || !matches!(bytes.get(index + 2), Some(b't' | b's'))
        {
            continue;
        }
        let mut cursor = index + 3;
        if bytes.get(cursor) == Some(&b'.') && bytes.get(cursor + 1) == Some(&b'c') {
            cursor += 2;
        }
        while let Some(character) = source.get(cursor..).and_then(|value| value.chars().next()) {
            if !character.is_whitespace() && character != '\u{feff}' {
                break;
            }
            cursor += character.len_utf8();
        }
        if bytes.get(cursor) == Some(&b'(') {
            return true;
        }
    }
    false
}

fn find_babel_config(root: &Path, sources: &[PathBuf]) -> Result<Option<PathBuf>, String> {
    let mut directories = vec![root.to_path_buf()];
    for source in sources {
        let mut directory = source.parent().unwrap_or(root);
        loop {
            if directory.starts_with(root) && !directories.iter().any(|item| item == directory) {
                directories.push(directory.to_path_buf());
            }
            if directory == root {
                break;
            }
            let Some(parent) = directory.parent() else {
                break;
            };
            directory = parent;
        }
    }
    for directory in directories {
        for filename in BABEL_CONFIG_FILENAMES {
            let path = directory.join(filename);
            if path.exists() {
                return Ok(Some(path));
            }
        }
        let package_path = directory.join("package.json");
        if package_path.exists() {
            let package: Value = serde_json::from_str(
                &fs::read_to_string(&package_path).map_err(|error| error.to_string())?,
            )
            .map_err(|error| error.to_string())?;
            if package.get("babel").is_some() {
                return Ok(Some(package_path));
            }
        }
    }
    Ok(None)
}

fn read_static_string_map(path: &Path) -> Result<IndexMap<String, String>, String> {
    let source = fs::read_to_string(path)
        .map_err(|error| format!("Could not read static module '{}': {error}", path.display()))?;
    if path.extension().and_then(|value| value.to_str()) == Some("json") {
        return serde_json::from_str(&source)
            .map_err(|error| format!("Invalid string map '{}': {error}", path.display()));
    }
    if let Some(specifier) = reexport_default_specifier(&source) {
        let target = resolve_module_specifier(path, &specifier)?;
        return read_static_string_map(&target);
    }
    let object_start = if let Some(index) = source.find("export default") {
        let remainder = &source[index + "export default".len()..];
        let trimmed = remainder.trim_start();
        if trimmed.starts_with('{') {
            source.len() - trimmed.len()
        } else {
            let identifier = trimmed
                .split(|character: char| {
                    !character.is_ascii_alphanumeric() && character != '$' && character != '_'
                })
                .next()
                .filter(|value| !value.is_empty())
                .ok_or_else(|| format!("Unsupported default export in '{}'.", path.display()))?;
            let declaration = source
                .find(&format!("const {identifier}"))
                .or_else(|| source.find(&format!("let {identifier}")))
                .or_else(|| source.find(&format!("var {identifier}")))
                .ok_or_else(|| {
                    format!(
                        "Could not find static export '{identifier}' in '{}'.",
                        path.display()
                    )
                })?;
            source[declaration..]
                .find('{')
                .map(|offset| declaration + offset)
                .ok_or_else(|| {
                    format!(
                        "Static export '{identifier}' is not an object in '{}'.",
                        path.display()
                    )
                })?
        }
    } else {
        return Err(format!(
            "Static module '{}' must export a default object literal.",
            path.display()
        ));
    };
    let object = extract_braced_object(&source, object_start)
        .ok_or_else(|| format!("Unterminated object literal in '{}'.", path.display()))?;
    json5::from_str(object)
        .map_err(|error| format!("Unsupported static object in '{}': {error}", path.display()))
}

fn reexport_default_specifier(source: &str) -> Option<String> {
    let marker = "export { default } from";
    let index = source.find(marker)?;
    let rest = source[index + marker.len()..].trim_start();
    let quote = rest.chars().next()?;
    if quote != '\'' && quote != '"' {
        return None;
    }
    let tail = &rest[quote.len_utf8()..];
    Some(tail.split(quote).next()?.to_string())
}

fn resolve_module_specifier(source: &Path, specifier: &str) -> Result<PathBuf, String> {
    if !specifier.starts_with('.') {
        return Err(format!(
            "Static re-export '{}' in '{}' must be relative.",
            specifier,
            source.display()
        ));
    }
    let path = source.parent().unwrap_or(Path::new(".")).join(specifier);
    if path.exists() {
        return Ok(path);
    }
    for extension in SOURCE_EXTENSIONS.iter().chain([&"json"]) {
        let candidate = path.with_extension(extension);
        if candidate.exists() {
            return Ok(candidate);
        }
    }
    Err(format!(
        "Could not resolve static re-export '{}' from '{}'.",
        specifier,
        source.display()
    ))
}

fn extract_braced_object(source: &str, start: usize) -> Option<&str> {
    let bytes = source.as_bytes();
    if bytes.get(start) != Some(&b'{') {
        return None;
    }
    let mut depth = 0usize;
    let mut quote = None;
    let mut escaped = false;
    let mut line_comment = false;
    let mut block_comment = false;
    let mut index = start;
    while index < bytes.len() {
        let byte = bytes[index];
        let next = bytes.get(index + 1).copied();
        if line_comment {
            if byte == b'\n' {
                line_comment = false;
            }
            index += 1;
            continue;
        }
        if block_comment {
            if byte == b'*' && next == Some(b'/') {
                block_comment = false;
                index += 2;
            } else {
                index += 1;
            }
            continue;
        }
        if let Some(active_quote) = quote {
            if escaped {
                escaped = false;
            } else if byte == b'\\' {
                escaped = true;
            } else if byte == active_quote {
                quote = None;
            }
            index += 1;
            continue;
        }
        if (byte == b'\'' || byte == b'"' || byte == b'`') && quote.is_none() {
            quote = Some(byte);
        } else if byte == b'/' && next == Some(b'/') {
            line_comment = true;
            index += 2;
            continue;
        } else if byte == b'/' && next == Some(b'*') {
            block_comment = true;
            index += 2;
            continue;
        } else if byte == b'{' {
            depth += 1;
        } else if byte == b'}' {
            depth -= 1;
            if depth == 0 {
                return source.get(start..=index);
            }
        }
        index += 1;
    }
    None
}

fn append_default_strings(output: &mut Value) -> Result<(), String> {
    // This checked-in file bootstraps clean native builds. `build:fbtee-strings`
    // regenerates it after the CLI is available, and CI verifies that it stayed current.
    let defaults: Value = serde_json::from_str(include_str!("../../fbtee/Strings.json"))
        .map_err(|error| format!("Invalid embedded default strings: {error}"))?;
    let output = output
        .as_object_mut()
        .ok_or("Collector output must be an object.")?;
    let mappings = output
        .get_mut("childParentMappings")
        .and_then(Value::as_object_mut)
        .ok_or("Collector output must contain childParentMappings.")?;
    for (key, value) in defaults
        .get("childParentMappings")
        .and_then(Value::as_object)
        .ok_or("Default strings must contain childParentMappings.")?
    {
        mappings.insert(key.clone(), value.clone());
    }
    output
        .get_mut("phrases")
        .and_then(Value::as_array_mut)
        .ok_or("Collector output must contain phrases.")?
        .extend(
            defaults
                .get("phrases")
                .and_then(Value::as_array)
                .ok_or("Default strings must contain phrases.")?
                .iter()
                .cloned(),
        );
    Ok(())
}

fn add_legacy_locations(output: &mut Value) {
    let Some(phrases) = output.get_mut("phrases").and_then(Value::as_array_mut) else {
        return;
    };
    for phrase in phrases {
        let Some(phrase) = phrase.as_object_mut() else {
            continue;
        };
        let start = phrase
            .get("loc")
            .and_then(|loc| loc.get("start"))
            .cloned()
            .unwrap_or(Value::Null);
        let end = phrase
            .get("loc")
            .and_then(|loc| loc.get("end"))
            .cloned()
            .unwrap_or(Value::Null);
        let filename = phrase.get("filename").cloned().unwrap_or(Value::Null);
        phrase.insert(
            "col_beg".into(),
            start.get("column").cloned().unwrap_or(Value::Null),
        );
        phrase.insert(
            "col_end".into(),
            end.get("column").cloned().unwrap_or(Value::Null),
        );
        phrase.insert("filepath".into(), filename);
        phrase.insert(
            "line_beg".into(),
            start.get("line").cloned().unwrap_or(Value::Null),
        );
        phrase.insert(
            "line_end".into(),
            end.get("line").cloned().unwrap_or(Value::Null),
        );
    }
}

fn translate_command(args: Vec<String>) -> Result<(), String> {
    let args = parse_arguments(
        args,
        &[
            "source-strings",
            "output-dir",
            "output-file",
            "output-locale-style",
        ],
        &["translations"],
        &["jenkins", "stdin", "strict"],
        &[("o", "output-dir"), ("locale-style", "output-locale-style")],
    )?;
    if args.version {
        println!("{}", env!("CARGO_PKG_VERSION"));
        return Ok(());
    }
    if args.help {
        print!("{TRANSLATE_HELP}");
        return Ok(());
    }
    let style = locale_style(args.value("output-locale-style").unwrap_or("bcp47"))?;
    let use_jenkins = args.boolean("jenkins", true);
    let strict = args.boolean("strict", false);
    if args.boolean("stdin", false) {
        let mut input = String::new();
        io::stdin()
            .read_to_string(&mut input)
            .map_err(|error| error.to_string())?;
        let value: Value = serde_json::from_str(&input).map_err(|error| error.to_string())?;
        let translated = process_translation_input(value, use_jenkins, strict, style)?;
        print!("{}", json_pretty(translated)?);
        return Ok(());
    }

    let root = env::current_dir().map_err(|error| error.to_string())?;
    let source_path = resolve_from(
        &root,
        args.value("source-strings")
            .unwrap_or("source_strings.json"),
    );
    let source: Value = serde_json::from_str(
        &fs::read_to_string(&source_path)
            .map_err(|error| format!("Could not read '{}': {error}", source_path.display()))?,
    )
    .map_err(|error| error.to_string())?;
    let files = {
        let values = args.values("translations");
        if values.is_empty() {
            list_json_files(&root.join("translations"))?
        } else {
            values
                .into_iter()
                .map(|value| resolve_from(&root, &value))
                .collect()
        }
    };
    throw_if_locale_file_conflicts(&files)?;
    let groups = files
        .iter()
        .map(|file| {
            serde_json::from_str::<Value>(
                &fs::read_to_string(file)
                    .map_err(|error| format!("Could not read '{}': {error}", file.display()))?,
            )
            .map_err(|error| error.to_string())
        })
        .collect::<Result<Vec<_>, _>>()?;
    check_locale_groups(&groups)?;
    let input = serde_json::json!({
        "phrases": source.get("phrases").cloned().unwrap_or(Value::Null),
        "translationGroups": groups,
    });
    let output = process_translation_input(input, use_jenkins, strict, style)?;
    if let Some(file) = args.value("output-file") {
        return write_text(&resolve_from(&root, file), &json_pretty(output)?);
    }
    let output_directory = resolve_from(
        &root,
        args.value("output-dir").unwrap_or("src/translations/"),
    );
    write_translation_outputs(&output_directory, output, style)
}

fn process_translation_input(
    mut input: Value,
    use_jenkins: bool,
    strict: bool,
    style: LocaleStyle,
) -> Result<Value, String> {
    let groups = input
        .get_mut("translationGroups")
        .and_then(Value::as_array_mut)
        .ok_or("Translation input must contain a translationGroups array.")?;
    check_locale_groups(groups)?;
    for group in groups {
        prepare_translation_group(group, strict, style)?;
    }
    let translated = translate::translate(
        &serde_json::to_string(&input).map_err(|error| error.to_string())?,
        use_jenkins,
    )?;
    serde_json::from_str(&translated).map_err(|error| error.to_string())
}

fn prepare_translation_group(
    group: &mut Value,
    strict: bool,
    style: LocaleStyle,
) -> Result<(), String> {
    let group = group
        .as_object_mut()
        .ok_or("Translation groups must be objects.")?;
    let locale = group
        .get("fb-locale")
        .and_then(Value::as_str)
        .ok_or("Translation groups must contain fb-locale.")?
        .to_string();
    let translations = group
        .get_mut("translations")
        .and_then(Value::as_object_mut)
        .ok_or("Translation groups must contain a translations object.")?;
    translations.retain(|hash, translation| {
        if translation.is_null() {
            let message = format!("Missing {locale} translation for string ({hash})");
            if strict {
                return true;
            }
            eprintln!("{message}");
            false
        } else {
            true
        }
    });
    if strict {
        if let Some((hash, _)) = translations.iter().find(|(_, value)| value.is_null()) {
            return Err(format!("Missing {locale} translation for string ({hash})"));
        }
    }
    group.insert("__gender-fallback".into(), gender_fallback(&locale).into());
    group.insert(
        "__number-fallback".into(),
        if ["be", "pl", "ru", "szl", "uk"].contains(&locale_language(&locale).as_str()) {
            12
        } else {
            24
        }
        .into(),
    );
    group.insert(
        "__output-locale".into(),
        format_locale(&locale, style).into(),
    );
    Ok(())
}

fn gender_fallback(locale: &str) -> i64 {
    const MERGED_LOCALES: &[&str] = &[
        "ar_AR", "ks_IN", "lv_LV", "ps_AF", "qk_DZ", "qs_DE", "qv_IT", "sq_AL", "ti_ET",
    ];
    const MERGED_LANGUAGES: &[&str] = &["ar", "dsb", "kab", "ks", "lv", "ps", "sq", "ti", "vec"];
    if locale_aliases(locale)
        .iter()
        .any(|alias| MERGED_LOCALES.contains(&alias.as_str()))
        || MERGED_LANGUAGES.contains(&locale_language(locale).as_str())
    {
        1
    } else {
        3
    }
}

fn write_translation_outputs(
    directory: &Path,
    output: Value,
    style: LocaleStyle,
) -> Result<(), String> {
    let output = output
        .as_object()
        .ok_or("Translated output must be a locale dictionary.")?;
    let locale_groups = output
        .keys()
        .map(|locale| serde_json::json!({"fb-locale": locale}))
        .collect::<Vec<_>>();
    check_locale_groups(&locale_groups)?;
    fs::create_dir_all(directory).map_err(|error| error.to_string())?;
    for (locale, translations) in output {
        let existing = available_locale_file(directory, locale)?;
        let output_locale = existing
            .as_ref()
            .and_then(|path| path.file_stem())
            .map(|value| value.to_string_lossy().into_owned())
            .unwrap_or_else(|| format_locale(locale, style));
        let path = directory.join(format!("{output_locale}.json"));
        let value = Value::Object(Map::from_iter([(output_locale, translations.clone())]));
        write_text(&path, &json_pretty(value)?)?;
    }
    Ok(())
}

fn prepare_translations(args: Vec<String>) -> Result<(), String> {
    let args = parse_arguments(
        args,
        &["source-strings", "output-dir", "output-locale-style"],
        &["locales"],
        &["sort-by-hash"],
        &[
            ("o", "output-dir"),
            ("locale", "locales"),
            ("locale-style", "output-locale-style"),
        ],
    )?;
    if args.version {
        println!("{}", env!("CARGO_PKG_VERSION"));
        return Ok(());
    }
    if args.help {
        print!("{PREPARE_HELP}");
        return Ok(());
    }
    let root = env::current_dir().map_err(|error| error.to_string())?;
    let style = locale_style(args.value("output-locale-style").unwrap_or("bcp47"))?;
    let output_directory = resolve_from(&root, args.value("output-dir").unwrap_or("translations/"));
    let files = list_json_files(&output_directory)?;
    throw_if_locale_file_conflicts(&files)?;
    let mut locales = args.values("locales");
    for file in &files {
        let locale = file
            .file_stem()
            .expect("JSON file has a stem")
            .to_string_lossy()
            .into_owned();
        if !locales.contains(&locale) {
            locales.push(locale);
        }
    }
    let source_path = resolve_from(
        &root,
        args.value("source-strings")
            .unwrap_or("source_strings.json"),
    );
    let source = fs::read_to_string(&source_path)
        .map_err(|error| format!("Could not read '{}': {error}", source_path.display()))?;
    let phrases = cli::source_phrases(&source)?;
    for locale in locales {
        let existing = available_locale_file(&output_directory, &locale)?;
        let output_locale = existing
            .as_ref()
            .and_then(|path| path.file_stem())
            .map(|value| value.to_string_lossy().into_owned())
            .unwrap_or_else(|| format_locale(&locale, style));
        println!("Processing locale: {output_locale}");
        let path =
            existing.unwrap_or_else(|| output_directory.join(format!("{output_locale}.json")));
        let existing_json = path
            .exists()
            .then(|| fs::read_to_string(&path))
            .transpose()
            .map_err(|error| error.to_string())?;
        let output = cli::prepare_translations_with_phrases(
            &phrases,
            existing_json.as_deref(),
            &output_locale,
            args.boolean("sort-by-hash", false),
        )?;
        let value: Value = serde_json::from_str(&output).map_err(|error| error.to_string())?;
        write_text(&path, &json_pretty(value)?)?;
    }
    Ok(())
}

fn migrate_locales(args: Vec<String>) -> Result<(), String> {
    let args = parse_arguments(args, &["to"], &["dir"], &["dry-run"], &[])?;
    if args.version {
        println!("{}", env!("CARGO_PKG_VERSION"));
        return Ok(());
    }
    if args.help {
        print!("{MIGRATE_HELP}");
        return Ok(());
    }
    let root = env::current_dir().map_err(|error| error.to_string())?;
    let style = match args.value("to").unwrap_or("bcp47") {
        "bcp47" => LocaleStyle::Bcp47,
        "legacy" => LocaleStyle::Legacy,
        value => return Err(format!("Invalid locale style '{value}'.")),
    };
    let directories = {
        let values = args.values("dir");
        if values.is_empty() {
            vec!["translations/".into()]
        } else {
            values
        }
    };
    for directory in directories {
        let files = list_json_files(&resolve_from(&root, &directory))?;
        throw_if_locale_file_conflicts(&files)?;
        for file in files {
            let locale = file
                .file_stem()
                .expect("JSON file has a stem")
                .to_string_lossy()
                .into_owned();
            let target_locale = format_locale(&locale, style);
            let target_file = file.with_file_name(format!("{target_locale}.json"));
            let input = fs::read_to_string(&file).map_err(|error| error.to_string())?;
            let value: Value = serde_json::from_str(&input).map_err(|error| error.to_string())?;
            let target_identity = locale_identity(&target_locale);
            let mut equivalents = locale_file_aliases(&target_locale);
            if let Some(object) = value.as_object() {
                for key in object.keys() {
                    if locale_identity(key) == target_identity && !equivalents.contains(key) {
                        equivalents.push(key.clone());
                    }
                }
                if let Some(locale) = object.get("fb-locale").and_then(Value::as_str) {
                    if locale_identity(locale) == target_identity
                        && !equivalents.iter().any(|item| item == locale)
                    {
                        equivalents.push(locale.into());
                    }
                }
            }
            let output = cli::migrate_locale_json(&input, &target_locale, &equivalents)?;
            let value: Value = serde_json::from_str(&output).map_err(|error| error.to_string())?;
            let output = json_pretty(value)?;
            if file == target_file {
                if args.boolean("dry-run", false) {
                    println!("Update {}", file.display());
                } else {
                    write_text(&file, &output)?;
                }
            } else {
                if target_file.exists() {
                    return Err(format!(
                        "Cannot rename {} to {}: target exists.",
                        file.display(),
                        target_file.display()
                    ));
                }
                if args.boolean("dry-run", false) {
                    println!("Rename {} -> {}", file.display(), target_file.display());
                } else {
                    write_text(&file, &output)?;
                    fs::rename(&file, &target_file).map_err(|error| error.to_string())?;
                }
            }
        }
    }
    Ok(())
}

#[derive(Clone, Copy)]
enum LocaleStyle {
    Bcp47,
    Legacy,
    Preserve,
}

fn locale_style(value: &str) -> Result<LocaleStyle, String> {
    match value {
        "bcp47" => Ok(LocaleStyle::Bcp47),
        "legacy" => Ok(LocaleStyle::Legacy),
        "preserve" => Ok(LocaleStyle::Preserve),
        _ => Err(format!("Invalid locale style '{value}'.")),
    }
}

const LEGACY_TO_BCP47: &[(&str, &str)] = &[
    ("ar_AR", "ar"),
    ("es_LA", "es-419"),
    ("fb_AA", "fb-AA"),
    ("fb_AC", "fb-AC"),
    ("fb_AR", "ar"),
    ("fb_HA", "fb-HA"),
    ("fb_HX", "fb-HX"),
    ("fb_LL", "fb-LL"),
    ("fb_LS", "fb-LS"),
    ("fb_RL", "fb-RL"),
    ("fb_ZH", "zh"),
    ("fbt_AC", "fbt-AC"),
];

const SPECIAL_LOCALE_LANGUAGES: &[(&str, &str)] = &[
    ("bp_IN", "bho"),
    ("bv_DE", "bar"),
    ("cb_IQ", "ckb"),
    ("ck_US", "chr"),
    ("cx_PH", "ceb"),
    ("eh_IN", "hi"),
    ("em_ZM", "bem"),
    ("fb_AA", "en"),
    ("fb_AC", "en"),
    ("fb_AR", "ar"),
    ("fb_HA", "en"),
    ("fb_HX", "en"),
    ("fb_LL", "en"),
    ("fb_LS", "en"),
    ("fb_RL", "en"),
    ("fb_ZH", "zh"),
    ("fbt_AC", "en"),
    ("fn_IT", "fur"),
    ("fv_NG", "fuv"),
    ("gx_GR", "grc"),
    ("lr_IT", "lij"),
    ("nh_MX", "nah"),
    ("ns_ZA", "nso"),
    ("qb_DE", "hsb"),
    ("qc_GT", "quc"),
    ("qe_US", "esu"),
    ("qk_DZ", "kab"),
    ("qr_GR", "rup"),
    ("qs_DE", "dsb"),
    ("qt_US", "tli"),
    ("qv_IT", "vec"),
    ("qz_MM", "my"),
    ("sy_SY", "syr"),
    ("sz_PL", "szl"),
    ("tl_PH", "fil"),
    ("tl_ST", "tlh"),
    ("tq_AR", "tob"),
    ("tz_MA", "tzm"),
    ("zz_TR", "zza"),
];

fn legacy_alias(locale: &str) -> Option<String> {
    let normalized = locale.trim().replace('-', "_");
    let (language, region) = normalized.split_once('_')?;
    if !(2..=3).contains(&language.len())
        || !(2..=3).contains(&region.len())
        || !language
            .chars()
            .all(|character| character.is_ascii_alphabetic())
        || !region
            .chars()
            .all(|character| character.is_ascii_alphanumeric())
    {
        return None;
    }
    Some(format!(
        "{}_{}",
        language.to_ascii_lowercase(),
        region.to_ascii_uppercase()
    ))
}

fn canonicalize_locale(locale: &str) -> String {
    let parts = locale.trim().replace('_', "-");
    let mut parts = parts.split('-').filter(|part| !part.is_empty());
    let Some(language) = parts.next() else {
        return locale.trim().into();
    };
    let language = match language.to_ascii_lowercase().as_str() {
        "iw" => "he".into(),
        "in" => "id".into(),
        "ji" => "yi".into(),
        value => value.into(),
    };
    let mut output = vec![language];
    for part in parts {
        output.push(
            if part.len() == 4
                && part
                    .chars()
                    .all(|character| character.is_ascii_alphabetic())
            {
                let mut characters = part.chars();
                format!(
                    "{}{}",
                    characters.next().unwrap().to_ascii_uppercase(),
                    characters.as_str().to_ascii_lowercase()
                )
            } else if (part.len() == 2
                && part
                    .chars()
                    .all(|character| character.is_ascii_alphabetic()))
                || (part.len() == 3 && part.chars().all(|character| character.is_ascii_digit()))
            {
                part.to_ascii_uppercase()
            } else {
                part.to_ascii_lowercase()
            },
        );
    }
    output.join("-")
}

fn locale_identity(locale: &str) -> String {
    if let Some(alias) = legacy_alias(locale) {
        if let Some((_, bcp47)) = LEGACY_TO_BCP47.iter().find(|(legacy, _)| *legacy == alias) {
            return canonicalize_locale(bcp47);
        }
        if let Some((_, language)) = SPECIAL_LOCALE_LANGUAGES
            .iter()
            .find(|(legacy, _)| *legacy == alias)
        {
            let region = alias
                .split_once('_')
                .map(|(_, region)| region)
                .unwrap_or("");
            return canonicalize_locale(&format!("{language}-{region}"));
        }
        return canonicalize_locale(&alias);
    }
    canonicalize_locale(locale)
}

fn locale_language(locale: &str) -> String {
    if let Some(alias) = legacy_alias(locale) {
        if let Some((_, language)) = SPECIAL_LOCALE_LANGUAGES
            .iter()
            .find(|(legacy, _)| *legacy == alias)
        {
            return (*language).into();
        }
    }
    locale_identity(locale)
        .split('-')
        .next()
        .unwrap_or(locale)
        .into()
}

fn known_legacy(identity: &str) -> Option<&'static str> {
    for (legacy, bcp47) in LEGACY_TO_BCP47 {
        if locale_identity(bcp47) == identity {
            return Some(legacy);
        }
    }
    for (legacy, language) in SPECIAL_LOCALE_LANGUAGES {
        let region = legacy
            .split_once('_')
            .map(|(_, region)| region)
            .unwrap_or("");
        if locale_identity(&format!("{language}-{region}")) == identity {
            return Some(legacy);
        }
    }
    None
}

fn format_locale(locale: &str, style: LocaleStyle) -> String {
    if matches!(style, LocaleStyle::Preserve) {
        return locale.into();
    }
    let identity = locale_identity(locale);
    if matches!(style, LocaleStyle::Bcp47) {
        return identity;
    }
    if let Some(legacy) = known_legacy(&identity) {
        return legacy.into();
    }
    if let Some(alias) = legacy_alias(locale) {
        return alias;
    }
    identity.replace('-', "_")
}

fn locale_aliases(locale: &str) -> Vec<String> {
    let identity = locale_identity(locale);
    let mut aliases = vec![
        locale.into(),
        identity.clone(),
        format_locale(locale, LocaleStyle::Legacy),
    ];
    for (legacy, bcp47) in LEGACY_TO_BCP47 {
        if locale_identity(bcp47) == identity {
            aliases.push((*legacy).into());
        }
    }
    for (legacy, language) in SPECIAL_LOCALE_LANGUAGES {
        let region = legacy
            .split_once('_')
            .map(|(_, region)| region)
            .unwrap_or("");
        if locale_identity(&format!("{language}-{region}")) == identity {
            aliases.push((*legacy).into());
        }
    }
    aliases.push(locale_language(&identity));
    dedupe(aliases)
}

fn locale_file_aliases(locale: &str) -> Vec<String> {
    let language = locale_language(locale);
    locale_aliases(locale)
        .into_iter()
        .filter(|alias| alias != &language || locale_identity(locale) == language)
        .collect()
}

fn dedupe(values: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    values
        .into_iter()
        .filter(|value| !value.is_empty() && seen.insert(value.clone()))
        .collect()
}

fn check_locale_groups(groups: &[Value]) -> Result<(), String> {
    let mut identities: IndexMap<String, Vec<String>> = IndexMap::new();
    for group in groups {
        let locale = group
            .get("fb-locale")
            .and_then(Value::as_str)
            .ok_or("Translation group must contain fb-locale.")?;
        identities
            .entry(locale_identity(locale))
            .or_default()
            .push(locale.into());
    }
    let conflicts = identities
        .into_iter()
        .filter(|(_, locales)| locales.len() > 1)
        .map(|(identity, locales)| {
            format!(
                "Conflicting translation groups for locale \"{identity}\": {}",
                locales.join(", ")
            )
        })
        .collect::<Vec<_>>();
    if conflicts.is_empty() {
        Ok(())
    } else {
        Err(conflicts.join("\n"))
    }
}

fn available_locale_file(directory: &Path, locale: &str) -> Result<Option<PathBuf>, String> {
    let files = list_json_files(directory)?;
    let aliases = locale_file_aliases(locale)
        .into_iter()
        .collect::<HashSet<_>>();
    let matches = files
        .into_iter()
        .filter(|file| {
            file.file_stem()
                .is_some_and(|name| aliases.contains(name.to_string_lossy().as_ref()))
        })
        .collect::<Vec<_>>();
    throw_if_locale_file_conflicts(&matches)?;
    Ok(matches.into_iter().next())
}

fn throw_if_locale_file_conflicts(files: &[PathBuf]) -> Result<(), String> {
    let mut identities: IndexMap<String, Vec<&PathBuf>> = IndexMap::new();
    for file in files {
        let locale = file
            .file_stem()
            .expect("JSON file has a stem")
            .to_string_lossy();
        identities
            .entry(locale_identity(&locale))
            .or_default()
            .push(file);
    }
    let conflicts = identities
        .into_iter()
        .filter(|(_, files)| files.len() > 1)
        .map(|(identity, files)| {
            format!(
                "Conflicting translation files for locale \"{identity}\":\n{}\nKeep only one file. These names refer to the same locale.",
                files
                    .iter()
                    .map(|file| format!("- {}", file.display()))
                    .collect::<Vec<_>>()
                    .join("\n")
            )
        })
        .collect::<Vec<_>>();
    if conflicts.is_empty() {
        Ok(())
    } else {
        Err(conflicts.join("\n\n"))
    }
}

fn list_json_files(directory: &Path) -> Result<Vec<PathBuf>, String> {
    if !directory.exists() {
        return Ok(vec![]);
    }
    let mut files = fs::read_dir(directory)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.extension().and_then(|value| value.to_str()) == Some("json"))
        .collect::<Vec<_>>();
    files.sort_by(|left, right| left.as_os_str().cmp(right.as_os_str()));
    Ok(files)
}

fn json_pretty(mut value: Value) -> Result<String, String> {
    apply_javascript_property_order(&mut value);
    serde_json::to_string_pretty(&value).map_err(|error| error.to_string())
}

fn apply_javascript_property_order(value: &mut Value) {
    match value {
        Value::Array(values) => values.iter_mut().for_each(apply_javascript_property_order),
        Value::Object(object) => {
            let old = std::mem::take(object);
            let mut numeric = Vec::new();
            let mut other = Vec::new();
            for (key, mut value) in old {
                apply_javascript_property_order(&mut value);
                if let Some(index) = javascript_array_index(&key) {
                    numeric.push((index, key, value));
                } else {
                    other.push((key, value));
                }
            }
            numeric.sort_by_key(|(index, _, _)| *index);
            object.extend(numeric.into_iter().map(|(_, key, value)| (key, value)));
            object.extend(other);
        }
        _ => {}
    }
}

fn javascript_array_index(value: &str) -> Option<u32> {
    if value.is_empty() || (value.starts_with('0') && value != "0") {
        return None;
    }
    let index = value.parse::<u32>().ok()?;
    (index != u32::MAX && index.to_string() == value).then_some(index)
}

fn write_text(path: &Path, value: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(path, value).map_err(|error| format!("Could not write '{}': {error}", path.display()))
}

fn resolve_from(root: &Path, value: &str) -> PathBuf {
    let path = Path::new(value);
    if path.is_absolute() {
        path.to_path_buf()
    } else {
        root.join(path)
    }
}

fn display_relative(root: &Path, path: &Path) -> String {
    pathdiff::diff_paths(path, root)
        .unwrap_or_else(|| path.to_path_buf())
        .to_string_lossy()
        .into_owned()
}

#[cfg(test)]
mod tests {
    use super::{
        canonicalize_locale, extract_braced_object, format_locale, locale_identity, LocaleStyle,
    };

    #[test]
    fn extracts_static_objects() {
        let source = "export default { a: '}', nested: { b: 'c' } } as const;";
        let start = source.find('{').unwrap();
        assert_eq!(
            extract_braced_object(source, start),
            Some("{ a: '}', nested: { b: 'c' } }")
        );
    }

    #[test]
    fn formats_legacy_locales() {
        assert_eq!(locale_identity("es_LA"), "es-419");
        assert_eq!(format_locale("es-419", LocaleStyle::Legacy), "es_LA");
        assert_eq!(canonicalize_locale("zh_hans_cn"), "zh-Hans-CN");
    }
}
