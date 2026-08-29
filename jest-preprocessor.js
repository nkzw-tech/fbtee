import { createHash } from 'node:crypto';
import { transformSync as oxcTransformSync } from 'oxc-transform';
import { transformSync as oxcFbteeTransformSync } from './packages/oxc-transform-fbtee/index.js';

const createTransformer = (opts = {}) => ({
  getCacheKey: (source, filename, { configString }) =>
    createHash('sha256')
      .update(source)
      .update(filename)
      .update(configString)
      .update(JSON.stringify(opts))
      .update('oxc')
      .digest('hex'),
  process: (src, filename) => {
    const fbteeOptions = opts.fbtee;
    if (fbteeOptions) {
      const fbteeResult = oxcFbteeTransformSync(filename, src, {
        ...fbteeOptions,
        lang: filename.endsWith('.tsx') || filename.endsWith('.jsx') ? 'tsx' : 'ts',
        sourceType: 'module',
      });
      if (fbteeResult.errors.length > 0) {
        throw new Error(fbteeResult.errors.map((error) => error.message).join('\n'));
      }
      src = fbteeResult.code;
    }
    const result = oxcTransformSync(filename, src, {
      jsx: { runtime: 'automatic' },
      lang: filename.endsWith('.tsx') || filename.endsWith('.jsx') ? 'tsx' : 'ts',
      sourceType: 'module',
      target: 'es2022',
    });
    if (result.errors.length > 0) {
      throw new Error(result.errors.map((error) => error.message).join('\n'));
    }
    return result;
  },
});

export default {
  ...createTransformer(),
  createTransformer,
};
