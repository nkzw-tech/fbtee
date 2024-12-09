const EnumManifest = require('./example/.enum_manifest.json');
const CommonStrings = require('./example/common_strings.json');
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

const root = process.cwd();
const toAbsolutePath = (...args) => path.resolve(root, ...args);

module.exports = {
  rootDir: root,
  projects: [
    {
      displayName: 'babel-plugin-fbt',
      roots: ['<rootDir>/packages/babel-plugin-fbt/src'],
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
                  fbtCommon: CommonStrings,
                  fbtEnumManifest: EnumManifest,
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
