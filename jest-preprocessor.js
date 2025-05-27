import babel from '@babel/core';
// eslint-disable-next-line import-x/no-unresolved
import pluginSyntaxAttributes from '@babel/plugin-syntax-import-attributes';
import presetReact from '@babel/preset-react';
import presetTypescript from '@babel/preset-typescript';

const createTransformer = (opts = {}) => ({
  process: (src, filename) =>
    babel.transform(src, {
      filename,
      plugins: [pluginSyntaxAttributes],
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
