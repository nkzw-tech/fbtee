import nkzw from '@nkzw/oxlint-config';
import { defineConfig } from 'oxlint';

export default defineConfig({
  env: {
    browser: true,
    builtin: true,
    es2024: true,
    node: true,
  },
  extends: [nkzw],
  ignorePatterns: [
    'packages/*/lib',
    'packages/fbtee/lib-tmp/',
    'packages/next-plugin-fbtee/test/fixture/.next*/',
    'packages/next-plugin-fbtee/test/fixture/next-env.d.ts',
    'packages/oxc-transform-fbtee/index.d.ts',
    'packages/oxc-transform-fbtee/index.js',
    'target/',
    'website/dist/',
    'website/vite.config.ts.timestamp-*',
  ],
  jsPlugins: ['@nkzw/eslint-plugin-fbtee', 'eslint-plugin-workspaces'],
  overrides: [
    {
      files: ['packages/**/*.tsx'],
      rules: {
        '@nkzw/fbtee/no-empty-strings': 'off',
        '@nkzw/fbtee/no-unhelpful-desc': 'off',
        '@nkzw/fbtee/no-untranslated-strings': 'off',
      },
    },
    {
      files: ['**/__tests__/**/*.tsx'],
      rules: {
        'no-console': 'off',
        'unicorn/consistent-function-scoping': 'off',
        'workspaces/no-relative-imports': 'off',
      },
    },
  ],
  rules: {
    '@nkzw/fbtee/no-empty-strings': 'error',
    '@nkzw/fbtee/no-unhelpful-desc': 'error',
    '@nkzw/fbtee/no-untranslated-strings': [
      'error',
      {
        ignoredWords: [
          'Far Better Translations, Extended Edition',
          'fbtee',
          'GitHub',
          'Next.js',
          'Vite',
        ],
      },
    ],
    '@nkzw/no-instanceof': 'off',
    'unicorn/prefer-dom-node-append': 'off',
    'workspaces/no-absolute-imports': 'error',
    'workspaces/no-relative-imports': 'error',
  },
});
