const EnumManifest = require('./example/.enum_manifest.json');
const CommonStrings = require('./example/common_strings.json');
const path = require('node:path');
const process = require('node:process');

process.env.NODE_ENV = 'development';

const globalConfig = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*-test.(js|jsx|tsx)'],
  transform: {
    '\\.(j|t)sx?$': '<rootDir>/jest-preprocessor.js',
  },
};

const root = process.cwd();
const toAbsolutePath = (...args) => path.resolve(root, ...args);

module.exports = {
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
      modulePaths: ['<rootDir>/packages/fbt/src'],
      roots: ['<rootDir>/packages/fbt/src'],
      testEnvironment: 'jsdom',
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
      modulePaths: [
        '<rootDir>/example/src',
        '<rootDir>/example/src/example',
        '<rootDir>/packages/fbt/src',
      ],
      roots: ['<rootDir>/example'],
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
  rootDir: root,
};
