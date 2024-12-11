const { join } = require('node:path');
const { existsSync, readFileSync } = require('node:fs');

module.exports = {
  extends: ['@nkzw'],
  ignorePatterns: ['packages/*/lib'],
  overrides: [
    {
      files: ['**/__tests__/**/*.tsx'],
      rules: {
        'no-console': 0,
        'workspaces/no-relative-imports': 0,
      },
    },
    {
      files: ['./.eslintrc.cjs'],
      rules: {
        '@typescript-eslint/no-require-imports': 0,
      },
    },
  ],
  plugins: ['workspaces'],
  rules: {
    '@nkzw/no-instanceof': 0,
    '@typescript-eslint/array-type': [2, { default: 'generic' }],
    'import/no-extraneous-dependencies': [
      2,
      {
        devDependencies: [
          './example/vite.config.ts',
          './jest-preprocessor.js',
          '**/__tests__/**/*.tsx',
        ],
        packageDir: [__dirname].concat(
          readFileSync('./pnpm-workspace.yaml', 'utf8')
            .split('\n')
            .slice(1)
            .map((n) =>
              join(
                __dirname,
                n
                  .replaceAll(/\s*-\s+/g, '')
                  .replaceAll("'", '')
                  .replaceAll('\r', '')
              )
            )
        ),
      },
    ],
    'no-extra-parens': 0,
    'unicorn/prefer-dom-node-append': 0,
    'workspaces/no-absolute-imports': 2,
    'workspaces/no-relative-imports': 2,
  },
};
