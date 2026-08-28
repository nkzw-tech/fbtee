'use strict';

let transformModule;

const getLanguage = (filename) => {
  const cleanFilename = filename.split(/[#?]/, 1)[0];
  if (cleanFilename.endsWith('.tsx')) {
    return 'tsx';
  }
  if (cleanFilename.endsWith('.jsx')) {
    return 'jsx';
  }
  if (
    cleanFilename.endsWith('.ts') ||
    cleanFilename.endsWith('.mts') ||
    cleanFilename.endsWith('.cts')
  ) {
    return 'ts';
  }
  return 'js';
};

const formatErrors = (errors) =>
  errors
    .map(({ codeframe, helpMessage, message }) =>
      [message, codeframe, helpMessage].filter(Boolean).join('\n'),
    )
    .join('\n\n');

module.exports = function fbteeLoader(source, inputSourceMap) {
  this.cacheable?.();
  const callback = this.async();

  // Every supported fbtee construct contains one of these static strings.
  // False positives (for example in comments) only incur one native parse.
  if (!source.includes('fbt') && !source.includes('fbs')) {
    callback(null, source, inputSourceMap);
    return;
  }

  transformModule ??= import('@nkzw/oxc-transform-fbtee');
  transformModule.then(({ transformSync }) => {
    const options = this.getOptions?.() ?? {};
    const result = transformSync(this.resourcePath, source, {
      ...options,
      lang: getLanguage(this.resourcePath),
      sourcemap: true,
      sourceType:
        this.resourcePath.endsWith('.cjs') || this.resourcePath.endsWith('.cts')
          ? 'commonjs'
          : 'module',
    });
    if (result.errors.length > 0) {
      callback(new Error(formatErrors(result.errors)));
      return;
    }
    callback(null, result.code, result.map ?? inputSourceMap);
  }, callback);
};
