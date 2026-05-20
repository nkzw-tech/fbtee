import babel from '@babel/core';
// eslint-disable-next-line import-x/no-unresolved
import pluginSyntaxAttributes from '@babel/plugin-syntax-import-attributes';
import presetReact from '@babel/preset-react';
import presetTypescript from '@babel/preset-typescript';
import { transformSync as swcTransformSync } from '@swc/core';
import swcFbteePlugin from './packages/swc-plugin-fbtee/index.js';

const getFbteeOptions = (opts) => {
  for (const preset of opts?.presets || []) {
    if (
      Array.isArray(preset) &&
      typeof preset[0] === 'string' &&
      preset[0].includes('babel-preset-fbtee')
    ) {
      return preset[1] || {};
    }
  }
  return null;
};

const createTransformer = (opts = {}) => ({
  process: (src, filename) => {
    const fbteeOptions = getFbteeOptions(opts);
    if (process.env.FBTEE_JEST_COMPILER === 'swc' && fbteeOptions) {
      return swcTransformSync(src, {
        filename,
        jsc: {
          experimental: {
            plugins: [[swcFbteePlugin, fbteeOptions]],
          },
          parser: {
            decorators: true,
            importAttributes: true,
            syntax: 'typescript',
            tsx: filename.endsWith('.tsx') || filename.endsWith('.jsx'),
          },
          target: 'es2022',
          transform: {
            react: {
              runtime: 'automatic',
            },
          },
        },
        module: {
          type: 'es6',
        },
      });
    }

    return babel.transform(src, {
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
    });
  },
});

export default {
  ...createTransformer(),
  createTransformer,
};
