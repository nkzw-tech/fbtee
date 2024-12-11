import babel from '@babel/core';
import presetReact from '@babel/preset-react';
import presetTypescript from '@babel/preset-typescript';

const createTransformer = (opts = {}) => ({
  process: (src, filename) =>
    babel.transform(src, {
      filename,
      presets: [
        ...(opts?.presets || []),
        [
          presetReact,
          {
            runtime: 'automatic',
          },
        ],
        presetTypescript,
      ],
      retainLines: true,
    }),
});

export default {
  ...createTransformer(),
  createTransformer,
};
