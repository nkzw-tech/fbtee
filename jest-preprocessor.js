import { createHash } from 'node:crypto';
import { transformSync } from '@babel/core';
import presetReact from '@babel/preset-react';
import presetTypescript from '@babel/preset-typescript';
import { transformSync as swcTransformSync } from '@swc/core';
import { transformSync as oxcTransformSync } from 'oxc-transform';
import { transformSync as oxcFbteeTransformSync } from './packages/oxc-transform-fbtee/index.js';
import swcFbteePlugin, {
  createFbteePluginOptions,
} from './packages/swc-plugin-fbtee/index.js';

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
  getCacheKey: (source, filename, { configString }) =>
    createHash('sha256')
      .update(source)
      .update(filename)
      .update(configString)
      .update(JSON.stringify(opts))
      .update(process.env.FBTEE_JEST_COMPILER || 'babel')
      .update('babel-8')
      .digest('hex'),
  process: (src, filename) => {
    const fbteeOptions = getFbteeOptions(opts);
    if (process.env.FBTEE_JEST_COMPILER === 'oxc' && fbteeOptions) {
      const fbteeResult = oxcFbteeTransformSync(filename, src, {
        ...fbteeOptions,
        lang:
          filename.endsWith('.tsx') || filename.endsWith('.jsx') ? 'tsx' : 'ts',
        sourceType: 'module',
      });
      if (fbteeResult.errors.length > 0) {
        throw new Error(
          fbteeResult.errors.map((error) => error.message).join('\n'),
        );
      }
      const result = oxcTransformSync(filename, fbteeResult.code, {
        jsx: {
          runtime: 'automatic',
        },
        lang:
          filename.endsWith('.tsx') || filename.endsWith('.jsx') ? 'tsx' : 'ts',
        sourceType: 'module',
        target: 'es2022',
      });
      if (result.errors.length > 0) {
        throw new Error(result.errors.map((error) => error.message).join('\n'));
      }
      return result;
    }
    if (process.env.FBTEE_JEST_COMPILER === 'swc' && fbteeOptions) {
      return swcTransformSync(src, {
        filename,
        jsc: {
          experimental: {
            plugins: [[swcFbteePlugin, createFbteePluginOptions(fbteeOptions)]],
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

    return transformSync(src, {
      filename,
      presets: [
        ...(opts?.presets || []),
        [
          presetReact,
          {
            runtime: 'automatic',
          },
        ],
        [presetTypescript, { onlyRemoveTypeImports: false }],
      ],
      retainLines: true,
    });
  },
});

export default {
  ...createTransformer(),
  createTransformer,
};
