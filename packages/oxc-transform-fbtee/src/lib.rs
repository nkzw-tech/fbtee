#![expect(clippy::needless_pass_by_value)]

mod transform;

use std::{collections::HashMap, path::Path};

use indexmap::IndexMap;
use napi::{bindgen_prelude::AsyncTask, Task};
use napi_derive::napi;
use oxc::{
    allocator::Allocator,
    codegen::{Codegen, CodegenOptions},
    diagnostics::Diagnostics,
    parser::Parser,
    semantic::SemanticBuilder,
};
use oxc_napi::{get_source_type, OxcError};
use oxc_sourcemap::napi::SourceMap;

use crate::transform::{transform_program, FbteeOptions};

#[napi(object)]
#[derive(Default, Debug)]
pub struct TransformOptions {
    #[napi(ts_type = "'js' | 'jsx' | 'ts' | 'tsx' | 'dts'")]
    pub lang: Option<String>,
    #[napi(ts_type = "'script' | 'module' | 'commonjs' | 'unambiguous'")]
    pub source_type: Option<String>,
    pub sourcemap: Option<bool>,
    pub collect_fbt: Option<bool>,
    pub fbt_common: Option<HashMap<String, String>>,
    pub fbt_enum_manifest: Option<IndexMap<String, IndexMap<String, String>>>,
}

impl TransformOptions {
    fn fbtee_options(&self) -> FbteeOptions {
        FbteeOptions {
            collect_fbt: self.collect_fbt.unwrap_or(false),
            fbt_common: self
                .fbt_common
                .clone()
                .unwrap_or_default()
                .into_iter()
                .collect(),
            fbt_enum_manifest: self.fbt_enum_manifest.clone().unwrap_or_default(),
        }
    }
}

#[derive(Default)]
#[napi(object)]
pub struct TransformResult {
    pub code: String,
    pub map: Option<SourceMap>,
    pub errors: Vec<OxcError>,
}

fn transform_impl(
    filename: &str,
    source_text: &str,
    options: Option<TransformOptions>,
) -> TransformResult {
    let options = options.unwrap_or_default();
    let source_type = get_source_type(
        filename,
        options.lang.as_deref(),
        Some(options.source_type.as_deref().unwrap_or("module")),
    );
    let sourcemap = options.sourcemap.unwrap_or(false);
    let allocator = Allocator::default();
    let parser_return = Parser::new(&allocator, source_text, source_type).parse();
    let mut diagnostics = parser_return.diagnostics;
    let mut program = parser_return.program;
    if diagnostics.has_errors() {
        return error_result(filename, source_text, diagnostics);
    }

    let semantic_return = SemanticBuilder::new().build(&program);
    if semantic_return.diagnostics.has_errors() {
        diagnostics.extend(semantic_return.diagnostics);
        return error_result(filename, source_text, diagnostics);
    }

    let scoping = semantic_return.semantic.into_scoping();
    diagnostics.extend(transform_program(
        &allocator,
        &mut program,
        scoping,
        options.fbtee_options(),
    ));
    if diagnostics.has_errors() {
        return error_result(filename, source_text, diagnostics);
    }

    let codegen_return = Codegen::new()
        .with_options(CodegenOptions {
            source_map_path: sourcemap.then(|| Path::new(filename).to_path_buf()),
            ..CodegenOptions::default()
        })
        .build(&program);
    TransformResult {
        code: codegen_return.code,
        map: codegen_return.map.map(SourceMap::from),
        errors: OxcError::from_diagnostics(filename, source_text, diagnostics),
    }
}

fn error_result(filename: &str, source_text: &str, diagnostics: Diagnostics) -> TransformResult {
    TransformResult {
        errors: OxcError::from_diagnostics(filename, source_text, diagnostics),
        ..TransformResult::default()
    }
}

#[napi]
pub fn transform_sync(
    filename: String,
    source_text: String,
    options: Option<TransformOptions>,
) -> TransformResult {
    transform_impl(&filename, &source_text, options)
}

pub struct TransformTask {
    filename: String,
    source_text: String,
    options: Option<TransformOptions>,
}

#[napi]
impl Task for TransformTask {
    type JsValue = TransformResult;
    type Output = TransformResult;

    fn compute(&mut self) -> napi::Result<Self::Output> {
        Ok(transform_impl(
            &self.filename,
            &self.source_text,
            self.options.take(),
        ))
    }

    fn resolve(&mut self, _: napi::Env, result: Self::Output) -> napi::Result<Self::JsValue> {
        Ok(result)
    }
}

#[napi]
pub fn transform(
    filename: String,
    source_text: String,
    options: Option<TransformOptions>,
) -> AsyncTask<TransformTask> {
    AsyncTask::new(TransformTask {
        filename,
        source_text,
        options,
    })
}
