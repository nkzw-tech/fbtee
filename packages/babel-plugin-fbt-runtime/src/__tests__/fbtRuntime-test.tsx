import { transformSync as babelTransform } from '@babel/core';
import presetReact from '@babel/preset-react';
import { describe, it } from '@jest/globals';
import fbt from 'babel-plugin-fbt';
import { withFbtRequireStatement } from 'babel-plugin-fbt/src/__tests__/FbtTestUtil.tsx';
import { assertSourceAstEqual } from '../../../../test/TestUtil.tsx';
import fbtRuntime from '../index.tsx';

function transform(source: string, extraOptions?: Record<string, unknown>) {
  return (
    babelTransform(source, {
      ast: false,
      plugins: [[fbt, { extraOptions }], fbtRuntime],
      presets: [presetReact],
      sourceType: 'module',
    })?.code || ''
  );
}

function runTest(
  data: { input: string; output: string },
  extraOptions?: Record<string, unknown>
) {
  assertSourceAstEqual(data.output, transform(data.input, extraOptions));
}

describe('Test hash key generation', () => {
  it('should generate hash key for simply string', () => {
    const data = {
      input: withFbtRequireStatement(`
        fbt('Foo', 'Bar');
      `),
      output: withFbtRequireStatement(`
        fbt._('Foo', null, {hk: '3ktBJ2'});
      `),
    };
    runTest(data);
  });

  it('should generate hash key for nested fbts', () => {
    const data = {
      input: withFbtRequireStatement(
        `<fbt desc="d">
          <fbt:param
            name="two
lines">
            <b>
              <fbt desc="test">simple</fbt>
            </b>
          </fbt:param>
          test
        </fbt>;`
      ),
      output: withFbtRequireStatement(
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
        );`
      ),
    };
    runTest(data);
  });
});

describe('Test enum hash keys generation', () => {
  it('should generate single hash key for fbt with enum under regular mode', () => {
    runTest({
      input: withFbtRequireStatement(
        `fbt('Foo ' + fbt.enum('a', {a: 'A', b: 'B', c: 'C'}), 'Bar');`
      ),
      output: withFbtRequireStatement(
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
          );`
      ),
    });
  });
});

describe('Test replacing clear token names with mangled tokens', () => {
  const data = {
    input: withFbtRequireStatement(
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
        </fbt>;`
    ),
    output: `var fbt_sv_arg_0;
      const fbt = require("fbt");
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
