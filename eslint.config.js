import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import nkzw from '@nkzw/eslint-config';
import workspaces from 'eslint-plugin-workspaces';

export default [
  ...nkzw,
  {
    ignores: ['packages/*/lib', 'packages/fbtee/lib-tmp/'],
  },
  {
    plugins: { workspaces },
    rules: {
      '@nkzw/no-instanceof': 0,
      '@typescript-eslint/array-type': [2, { default: 'generic' }],
      'import/no-extraneous-dependencies': [
        2,
        {
          devDependencies: [
            './example/vite.config.ts',
            './jest-preprocessor.js',
            './packages/fbtee/babel-build.config.js',
            '**/__tests__/**/*.tsx',
            'eslint.config.js',
          ],
          packageDir: [import.meta.dirname].concat(
            readFileSync('./pnpm-workspace.yaml', 'utf8')
              .split('\n')
              .slice(1)
              .map((n) =>
                join(
                  import.meta.dirname,
                  n
                    .replaceAll(/\s*-\s+/g, '')
                    .replaceAll("'", '')
                    .replaceAll('\r', ''),
                ),
              ),
          ),
        },
      ],
      'import/no-unresolved': [
        2,
        {
          ignore: ['@typescript-eslint/*'],
        },
      ],
      'unicorn/prefer-dom-node-append': 0,
      'workspaces/no-absolute-imports': 2,
      'workspaces/no-relative-imports': 2,
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
