import nkzw from '@nkzw/eslint-config';
import fbtee from '@nkzw/eslint-plugin-fbtee';
import { findWorkspacePackages } from '@pnpm/find-workspace-packages';
import workspaces from 'eslint-plugin-workspaces';

export default [
  ...nkzw,
  fbtee.configs.strict,
  {
    ignores: [
      'packages/*/lib',
      'packages/fbtee/lib-tmp/',
      'website/dist/',
      'website/vite.config.ts.timestamp-*',
    ],
  },
  {
    plugins: {
      '@nkzw/fbtee': fbtee,
      workspaces,
    },
    rules: {
      '@nkzw/fbtee/no-untranslated-strings': [
        2,
        {
          ignoredWords: [
            'Babel',
            'Far Better Translations, Extended Edition',
            'fbtee',
            'GitHub',
            'Next.js',
            'Vite',
          ],
        },
      ],
      '@nkzw/no-instanceof': 0,
      '@typescript-eslint/array-type': [2, { default: 'generic' }],
      'import-x/no-extraneous-dependencies': [
        2,
        {
          devDependencies: [
            './example/vite.config.ts',
            './jest-preprocessor.js',
            './packages/fbtee/babel-build.config.js',
            './website/vite.config.ts',
            '**/__tests__/**/*.tsx',
            '**/eslint.config.js',
          ],
          packageDir: await findWorkspacePackages(process.cwd()).then(
            (packages) => packages.map((pkg) => pkg.dir),
          ),
        },
      ],
      'unicorn/prefer-dom-node-append': 0,
      'workspaces/no-absolute-imports': 2,
      'workspaces/no-relative-imports': 2,
    },
  },
  {
    files: ['packages/**/*.tsx'],
    rules: {
      '@nkzw/fbtee/no-empty-strings': 0,
      '@nkzw/fbtee/no-unhelpful-desc': 0,
      '@nkzw/fbtee/no-untranslated-strings': 0,
    },
  },
  {
    files: [
      'packages/babel-plugin-fbtee/src/bin/*.tsx',
      'packages/fbtee/babel-build.config.js',
      '**/__tests__/**/*.tsx',
    ],
    rules: {
      'no-console': 0,
      'workspaces/no-relative-imports': 0,
    },
  },
];
