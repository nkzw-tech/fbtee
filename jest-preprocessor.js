import babel from '@babel/core';
import presetReact from '@babel/preset-react';
import presetTypescript from '@babel/preset-typescript';

function createTransformer(opts = {}) {
  return {
    process(src, filename) {
      const options = {
        filename,
        plugins: opts.plugins || [],
        presets: [
          [
            presetReact,
            {
              runtime: 'automatic',
            },
          ],
          presetTypescript,
        ],
        retainLines: true,
      };

      return babel.transform(src, options);
    },
  };
}

export default {
  ...createTransformer(),
  createTransformer,
};
