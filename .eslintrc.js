const { join } = require('node:path');
const { existsSync, readFileSync } = require('node:fs');

module.exports = {
  extends: ['@nkzw'],
  ignorePatterns: ['packages/*/lib'],
  overrides: [
    {
      files: ['./test/TestUtil.tsx'],
      rules: {
        'no-console': 0,
      },
    },
    {
      files: ['./.eslintrc.js', './jest.config.js', './jest-preprocessor.js'],
      rules: {
        '@typescript-eslint/no-require-imports': 0,
      },
    },
    {
      files: ['**/__tests__/**/*.tsx'],
      rules: {
        'workspaces/no-relative-imports': 0,
      },
    },
  ],
  plugins: ['workspaces'],
  rules: {
    '@typescript-eslint/array-type': [2, { default: 'generic' }],
    'import/no-extraneous-dependencies': [
      2,
      {
        devDependencies: [
          './example/vite.config.ts',
          './jest-preprocessor.js',
          './test/TestUtil.tsx',
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

    // @nocommit
    // eslint-disable-next-line sort-keys-fix/sort-keys-fix
    '@typescript-eslint/no-explicit-any': 0,
    '@typescript-eslint/no-require-imports': 0,
    // eslint-disable-next-line sort-keys-fix/sort-keys-fix
    '@nkzw/no-instanceof': 0,
  },
};
