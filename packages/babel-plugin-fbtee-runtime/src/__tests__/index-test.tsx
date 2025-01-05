import { transformSync } from '@babel/core';
import presetReact from '@babel/preset-react';
import { describe, it } from '@jest/globals';
import fbtee from '@nkzw/babel-plugin-fbtee';
import fbtAutoImport from '@nkzw/babel-plugin-fbtee-auto-import';
import { withFbtImportStatement } from '@nkzw/babel-plugin-fbtee/src/__tests__/FbtTestUtil.tsx';
import fbteeRuntime from '../index.tsx';

const transform = (source: string) =>
  transformSync(source, {
    ast: false,
    plugins: [fbtAutoImport, fbtee, fbteeRuntime],
    presets: [presetReact],
    sourceType: 'module',
  })?.code || '';

describe('Test hash key generation', () => {
  it('should generate hash key for simply string', () => {
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
