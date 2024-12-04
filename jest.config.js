/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 *
 * @format
 * @noflow
 * @oncall i18n_fbt_js
 */

const path = require('path');
const process = require('process');
const runtimePaths = [
  '<rootDir>/runtime',
  '<rootDir>/runtime/FbtNumber',
  '<rootDir>/runtime/mocks',
];

const globalConfig = {
  testMatch: ['**/__tests__/**/*-test.js'],
  transform: {
    '\\.js$': '<rootDir>/jest-preprocessor.js',
  },
  moduleNameMapper: {
    '^FBLocaleToLang$': '<rootDir>/runtime/FBLocaleToLang',
  },
  skipNodeResolution: true,
  testEnvironment: 'node',
};

// We need to use absolute paths in order to use this jest config from other working directories.
// See D28405950 for more info.
const toAbsolutePath = (...args) => path.resolve(__dirname, ...args);

module.exports = {
  rootDir: __dirname,
  projects: [
    {
      displayName: 'babel-plugin-fbt',
      roots: ['<rootDir>/packages/babel-plugin-fbt/dist'],
      snapshotResolver:
        '<rootDir>/packages/babel-plugin-fbt/jest.snapshotResolver.js',
    },
    {
      displayName: 'babel-plugin-fbt-runtime',
      roots: ['<rootDir>/packages/babel-plugin-fbt-runtime'],
    },
    {
      displayName: 'fbt-runtime',
      roots: ['<rootDir>/packages/fbt/lib'],
      modulePaths: ['<rootDir>/packages/fbt/lib'],
    },
    {
      displayName: 'demo-app',
      setupFiles: ['<rootDir>/demo-app/run_all.js'],
      roots: ['<rootDir>/demo-app'],
      modulePaths: [
        '<rootDir>/demo-app/src',
        '<rootDir>/demo-app/src/example',
      ].concat(runtimePaths),
      transformIgnorePatterns: [
        '/node_modules/',
        '<rootDir>/demo-app/run_all\\.js',
      ],
      moduleNameMapper: {
        ...globalConfig.moduleNameMapper,
        '\\.(css)$': '<rootDir>/demo-app/jest/css.js',
      },
      transform: {
        '\\.js$': [
          '<rootDir>/jest-preprocessor.js',
          {
            plugins: [
              [
                toAbsolutePath('packages', 'babel-plugin-fbt'),
                {
                  fbtCommonPath: toAbsolutePath(
                    'demo-app',
                    'common_strings.json'
                  ),
                  fbtEnumPath: toAbsolutePath(
                    'demo-app',
                    '.enum_manifest.json'
                  ),
                },
              ],
              toAbsolutePath('packages', 'babel-plugin-fbt-runtime'),
            ],
          },
        ],
      },
    },
  ]
    .filter(Boolean)
    .map((project) => ({ ...globalConfig, ...project })),
};
