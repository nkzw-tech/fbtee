/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 *
 */

const path = require('path');
const process = require('process');

process.env.NODE_ENV = 'development';

const globalConfig = {
  testMatch: ['**/__tests__/**/*-test.(js|jsx|tsx)'],
  transform: {
    '\\.(j|t)sx?$': '<rootDir>/jest-preprocessor.js',
  },
  testEnvironment: 'node',
};

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
        '\\.(j|t)sx?$': [
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
      displayName: 'example',
      roots: ['<rootDir>/example'],
      modulePaths: [
        '<rootDir>/example/src',
        '<rootDir>/example/src/example',
        '<rootDir>/packages/fbt/src',
      ],
      transform: {
        '\\.(j|t)sx?$': [
          '<rootDir>/jest-preprocessor.js',
          {
            plugins: [
              [
                toAbsolutePath('packages', 'babel-plugin-fbt'),
                {
                  fbtCommonPath: toAbsolutePath(
                    'example',
                    'common_strings.json'
                  ),
                  fbtEnumPath: toAbsolutePath('example', '.enum_manifest.json'),
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
