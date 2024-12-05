/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 */
const babel = require('@babel/core');

function createTransformer(opts = {}) {
  return {
    process(src, filename) {
      const options = {
        presets: [
          require('@babel/preset-env'),
          require('@babel/preset-react'),
          require('@babel/preset-typescript'),
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
