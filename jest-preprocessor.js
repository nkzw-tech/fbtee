/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * @noflow
 */
const babel = require('@babel/core');

function createTransformer(opts /*: Object */ = {}) {
  return {
    process(src /*: string */, filename /*: string */) {
      const options = {
        presets: [
          require('@babel/preset-env'),
          require('@babel/preset-react'),
          require('@babel/preset-flow'),
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
