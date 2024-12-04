/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * @format
 * @noflow
 * @oncall i18n_fbt_js
 */
const babel = require('@babel/core');

const cacheKeyPackages = [
  'babel-plugin-fbt',
  'babel-plugin-fbt-runtime',
].map(name =>
  // Find the actual module root from the package.json file,
  // otherwise, the result may be incorrect if a custom "main" path was set.
  // See https://stackoverflow.com/a/49455609/104598
  require.resolve(`${name}/package.json`),
);

function createTransformer(opts /*: Object */ = {}) {
  return {
    process(src /*: string */, filename /*: string */) {
      const options = {
        presets: [
          [require('@babel/preset-react'), {throwIfNamespace: false}],
        ],
        plugins: opts.plugins || [],
        filename,
        retainLines: true,
      };

      return babel.transform(src, options);
    },
  };
}

module.exports = {
  ...createTransformer(),
  createTransformer,
};
