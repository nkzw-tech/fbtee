/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 *
 * @noflow
 */

const path = require('path');
const process = require('process');

process.env.NODE_ENV = 'development';

const globalConfig = {
  testMatch: ['**/__tests__/**/*-test.js'],
  transform: {
    '\\.js$': '<rootDir>/jest-preprocessor.js',
  },
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
      roots: ['<rootDir>/packages/babel-plugin-fbt/src'],
      transform: {
        '\\.js$': [
          '<rootDir>/jest-preprocessor.js',
          {
            plugins: [
              [
                toAbsolutePath('packages', 'babel-plugin-fbt'),
                { fbtCommon: { Accept: '...' } },
              ],
              toAbsolutePath('packages', 'babel-plugin-fbt-runtime'),
            ],
          },
        ],
      },
    },
    {
      displayName: 'babel-plugin-fbt-runtime',
      roots: ['<rootDir>/packages/babel-plugin-fbt-runtime'],
    },
    {
      displayName: 'fbt',
      testEnvironment: 'jsdom',
      roots: ['<rootDir>/packages/fbt/src'],
      modulePaths: ['<rootDir>/packages/fbt/src'],
      transform: {
        '\\.js$': [
          '<rootDir>/jest-preprocessor.js',
          {
            plugins: [
              [
                toAbsolutePath('packages', 'babel-plugin-fbt'),
                { fbtCommon: { Accept: '...' } },
              ],
              toAbsolutePath('packages', 'babel-plugin-fbt-runtime'),
            ],
          },
        ],
      },
    },
    {
      displayName: 'demo-app',
      setupFiles: ['<rootDir>/demo-app/run_all.js'],
      roots: ['<rootDir>/demo-app'],
      modulePaths: [
        '<rootDir>/demo-app/src',
        '<rootDir>/demo-app/src/example',
        '<rootDir>/packages/fbt/src',
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
