import process from 'node:process';
import EnumManifest from './example/.enum_manifest.json' with { type: 'json' };
import CommonStrings from './example/common_strings.json' with { type: 'json' };

process.env.NODE_ENV = 'development';

const globalConfig = {
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*-test.(js|jsx|ts|tsx)'],
  transform: {
    '\\.(j|t)sx?$': '<rootDir>/jest-preprocessor.js',
  },
};

const root = process.cwd();

export default {
  projects: [
    {
      displayName: 'compiler',
      roots: ['<rootDir>/test'],
      testMatch: ['<rootDir>/test/compiler-test.mjs'],
      transform: {},
    },
    {
      displayName: 'fbtee',
      modulePaths: ['<rootDir>/packages/fbtee/src'],
      roots: ['<rootDir>/packages/fbtee/src'],
      testEnvironment: 'jsdom',
      transform: {
        '\\.(j|t)sx?$': [
          '<rootDir>/jest-preprocessor.js',
          {
            fbtee: { fbtCommon: { Accept: '...' } },
          },
        ],
      },
    },
    {
      displayName: 'example',
      modulePaths: [
        '<rootDir>/example/src',
        '<rootDir>/example/src/example',
        '<rootDir>/packages/fbtee/src',
      ],
      roots: ['<rootDir>/example'],
      testEnvironment: 'jsdom',
      transform: {
        '\\.(j|t)sx?$': [
          '<rootDir>/jest-preprocessor.js',
          {
            fbtee: {
              fbtCommon: CommonStrings,
              fbtEnumManifest: EnumManifest,
            },
          },
        ],
      },
    },
    {
      displayName: '@nkzw/eslint-plugin-fbtee',
      modulePaths: ['<rootDir>/packages/eslint-plugin-fbtee'],
      roots: ['<rootDir>/packages/eslint-plugin-fbtee/src'],
      transform: {
        '\\.(j|t)sx?$': ['<rootDir>/jest-preprocessor.js'],
      },
    },
  ]
    .filter(Boolean)
    .map((project) => ({ ...globalConfig, ...project })),
  rootDir: root,
};
