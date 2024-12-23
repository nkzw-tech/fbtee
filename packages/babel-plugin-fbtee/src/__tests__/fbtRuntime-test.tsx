import { transformSync } from '@babel/core';
import presetReact from '@babel/preset-react';
import { describe, it } from '@jest/globals';
import fbtAutoImport from '@nkzw/babel-plugin-fbtee-auto-import';
import fbtee from '../index.tsx';
import {
  assertSourceAstEqual,
  withFbtImportStatement,
} from './FbtTestUtil.tsx';

const transform = (source: string) =>
  transformSync(source, {
    ast: false,
    plugins: [fbtAutoImport, fbtee],
    presets: [presetReact],
    sourceType: 'module',
  })?.code || '';

const runTest = (data: { input: string; output: string }) =>
  assertSourceAstEqual(data.output, transform(data.input));

describe('Test hash key generation', () => {
  it('should generate hash key for simply string', () => {
    const data = {
      input: withFbtImportStatement(`
        fbt('Foo', 'Bar');
      `),
      output: withFbtImportStatement(`
        fbt._('Foo', null, {hk: '3ktBJ2'});
      `),
    };
    runTest(data);
  });

  it('should generate hash key for nested fbts', () => {
    const data = {
      input: withFbtImportStatement(
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
      output: withFbtImportStatement(
        `fbt._(
          '{two lines} test',
          [
            fbt._param(
              'two lines',
              React.createElement(
                'b',
                null,
                fbt._('simple', null, {hk: '2pjKFw'}),
              ),
            ),
          ],
          {hk: '2xRGl8'},
        );`,
      ),
    };
    runTest(data);
  });

  it('should auto import for <fbt>', () => {
    const data = {
      input: `<fbt desc="d">
          <fbt:param
            name="two
lines">
            <b>
              <fbt desc="test">simple</fbt>
            </b>
          </fbt:param>
          test
        </fbt>;`,
      output: `import { fbt } from 'fbtee';
        fbt._(
          '{two lines} test',
          [
            fbt._param(
              'two lines',
              React.createElement(
                'b',
                null,
                fbt._('simple', null, {hk: '2pjKFw'}),
              ),
            ),
          ],
          {hk: '2xRGl8'},
        );`,
    };
    runTest(data);
  });

  it('should auto import for <fbs>', () => {
    const data = {
      input: `<fbs desc="d">
          test
        </fbs>;`,
      output: `import { fbs } from 'fbtee';
        fbs._(
          'test',
          null,
          {hk: '2zCyVJ'},
        );`,
    };
    runTest(data);
  });
});

describe('Test enum hash keys generation', () => {
  it('should generate single hash key for fbt with enum under regular mode', () => {
    runTest({
      input: withFbtImportStatement(
        `fbt('Foo ' + fbt.enum('a', {a: 'A', b: 'B', c: 'C'}), 'Bar');`,
      ),
      output: withFbtImportStatement(
        `fbt._(
            {
              "a": "Foo A",
              "b": "Foo B",
              "c": "Foo C"
            },
            [
              fbt._enum('a', {
                "a": 'A',
                "b": 'B',
                "c": 'C'
              })
            ],
            {hk: "NT3sR"},
          );`,
      ),
    });
  });
});

test('Test replacing clear token names with mangled tokens', () => {
  const data = {
    input: withFbtImportStatement(
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
    output: `var fbt_sv_arg_0;
      import { fbt } from "fbtee";
      fbt_sv_arg_0 = fbt._plural(ex1.count, "number"),
      fbt._(
        {
          "*": "{=m0} friends {=m2}{number} photos",
          "_1": "{=m0} friends {=m2} a photo",
        },
        [
          fbt_sv_arg_0,
          fbt._implicitParam(
            "=m0",
            /*#__PURE__*/React.createElement(
              "b",
              null,
              fbt._(
                {
                  "*": "Your",
                  "_1": "Your"
                },
                [fbt_sv_arg_0],
                {hk: "3AIVHA"},
              ),
            ),
          ),
          fbt._implicitParam(
            "=m2",
            /*#__PURE__*/React.createElement(
              "b",
              null,
              fbt._(
                {
                  "*": "shared",
                  "_1": "shared"
                },
                [fbt_sv_arg_0],
                {hk: "3CHy8o"},
              ),
            ),
          ),
        ],
        {hk: "2mDoBt"},
      );`,
  };
  runTest(data);
});
