import { transformSync } from '@babel/core';
import presetReact from '@babel/preset-react';
import { describe, it } from '@jest/globals';
import fbtAutoImport from '@nkzw/babel-plugin-fbtee-auto-import';
import * as swc from '@swc/core';
import fbtee from '../index.tsx';
import { fbtSwcPlugin, withFbtImportStatement } from './FbtTestUtil.tsx';

const transform = (source: string) => {
  const useSwc = process.env.USE_SWC === '1';

  if (!useSwc) {
    // Default to Babel until SWC plugin host compatibility is resolved.
    return (
      transformSync(source, {
        ast: false,
        filename: 'source.js',
        plugins: [fbtAutoImport, fbtee],
        presets: [presetReact],
        sourceType: 'module',
      })?.code || ''
    );
  }

  return (
    swc.transformSync(source, {
      isModule: true,
      filename: 'source.js',
      jsc: {
        target: 'es2020',
        parser: {
          syntax: 'ecmascript',
          jsx: true,
        },
        transform: {
          react: {
            runtime: 'preserve',
            throwIfNamespace: false,
          },
        },
        experimental: {
          plugins: [[fbtSwcPlugin, {}]],
        },
      },
    }).code || ''
  );
};

describe('Test hash key generation', () => {
  it('should generate hash key for simple string', () => {
    expect(
      transform(
        withFbtImportStatement(`
        fbt('Foo', 'Bar');
      `),
      ),
    ).toMatchSnapshot();
  });

  it('should generate hash key for nested fbts', () => {
    expect(
      transform(
        withFbtImportStatement(
          `<fbt desc="d">
            <fbt:param
              name="two
  lines">
              <b>
                <fbt desc="test">simple</fbt>
              </b>
            </fbt:param>
            test
          </fbt>;`,
        ),
      ),
    ).toMatchSnapshot();
  });

  it('should auto import for <fbt>', () => {
    expect(
      transform(`
        <fbt desc="d">
          <fbt:param
            name="two
lines">
            <b>
              <fbt desc="test">simple</fbt>
            </b>
          </fbt:param>
          test
        </fbt>;`),
    ).toMatchSnapshot();
  });

  it('should auto import for <fbs>', () => {
    expect(
      transform(`<fbs desc="d">
          test
        </fbs>;`),
    ).toMatchSnapshot();
  });
});

describe('Test enum hash keys generation', () => {
  it('should generate single hash key for fbt with enum under regular mode', () => {
    expect(
      transform(
        withFbtImportStatement(
          `fbt('Foo ' + fbt.enum('a', {a: 'A', b: 'B', c: 'C'}), 'Bar');`,
        ),
      ),
    ).toMatchSnapshot();
  });
});

test('Test replacing clear token names with mangled tokens', () => {
  expect(
    transform(
      withFbtImportStatement(
        `<fbt desc="d">
          <b>Your</b>
          friends
          <b>shared</b>
          <fbt:plural
            many="photos"
            showCount="ifMany"
            count={ex1.count}>
            a photo
          </fbt:plural>
        </fbt>;`,
      ),
    ),
  ).toMatchSnapshot();
});
