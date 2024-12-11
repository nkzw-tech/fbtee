import process from 'node:process';
import EnumManifest from './example/.enum_manifest.json' with { type: 'json' };
import CommonStrings from './example/common_strings.json' with { type: 'json' };

process.env.NODE_ENV = 'development';

const globalConfig = {
  extensionsToTreatAsEsm: ['.tsx'],
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*-test.(js|jsx|tsx)'],
  transform: {
    '\\.(j|t)sx?$': '<rootDir>/jest-preprocessor.js',
  },
};

const root = process.cwd();

export default {
  projects: [
    {
      displayName: 'babel-plugin-fbt',
      roots: ['<rootDir>/packages/babel-plugin-fbt/src'],
      transform: {
        '\\.(j|t)sx?$': [
          '<rootDir>/jest-preprocessor.js',
          {
            presets: [
              [
                './packages/babel-preset-fbt',
                { fbtCommon: { Accept: '...' } },
              ],
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
            presets: [
              [
                './packages/babel-preset-fbt',
                { fbtCommon: { Accept: '...' } },
              ],
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
      testEnvironment: 'jsdom',
      transform: {
        '\\.(j|t)sx?$': [
          '<rootDir>/jest-preprocessor.js',
          {
            presets: [
              [
                './packages/babel-preset-fbt',
                {
                  fbtCommon: CommonStrings,
                  fbtEnumManifest: EnumManifest,
                },
              ],
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
