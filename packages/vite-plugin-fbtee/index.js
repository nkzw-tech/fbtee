import { transformSync } from '@nkzw/oxc-transform-fbtee';

const fbteeSourcePattern = /fbt|fbs/;

const getLanguage = (id) => {
  const filename = id.split(/[#?]/, 1)[0];
  if (filename.endsWith('.tsx')) {
    return 'tsx';
  }
  if (filename.endsWith('.jsx')) {
    return 'jsx';
  }
  if (filename.endsWith('.ts')) {
    return 'ts';
  }
  return 'js';
};

export const fbtee = (options = {}) => ({
  enforce: 'pre',
  name: 'vite-plugin-fbtee',
  transform: {
    filter: {
      code: fbteeSourcePattern,
      id: {
        exclude: '**/node_modules/**',
        include: '**/*.{js,jsx,ts,tsx}',
      },
    },
    handler(source, id) {
      // Vite and Rolldown apply the hook filter before invoking this handler.
      // Keep the string check as a cheap fallback for compatible hosts that do
      // not yet support hook filters. False positives, including comments, are
      // harmless; every supported fbtee construct contains `fbt` or `fbs`.
      if (!source.includes('fbt') && !source.includes('fbs')) {
        return null;
      }

      const result = transformSync(id, source, {
        ...options,
        lang: getLanguage(id),
        sourcemap: true,
        sourceType: 'module',
      });
      if (result.errors.length > 0) {
        throw new Error(result.errors.map(({ message }) => message).join('\n'));
      }
      return { code: result.code, map: result.map };
    },
  },
});

export default fbtee;
