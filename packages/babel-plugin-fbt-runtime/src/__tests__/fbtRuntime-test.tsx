import { transformSync as babelTransform } from '@babel/core';
import { withFbtRequireStatement } from 'babel-plugin-fbt/src/__tests__/FbtTestUtil';
import { assertSourceAstEqual } from '../../../../test/TestUtil';

function transform(source: string, extraOptions?: Record<string, unknown>) {
  return (
    babelTransform(source, {
      ast: false,
      plugins: [
        require('@babel/plugin-syntax-jsx'),
        require('@babel/plugin-transform-react-jsx'),
        [require('babel-plugin-fbt'), { extraOptions: extraOptions }],
        require('../index'),
      ],
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

describe('Test extra options generation', () => {
  it('should generate extra options for simple string', () => {
    const data = {
      input: withFbtRequireStatement(`fbt("Foo", "Bar", {locale: "ar_AR"});`),
      output: withFbtRequireStatement(`
        fbt._('Foo', null, {eo: {locale: "ar_AR"}, hk: '3ktBJ2'});
      `),
    };
    const validExtraOptions = { locale: true };
    runTest(data, validExtraOptions);
  });

  it('should generate extra options for nested fbts', () => {
    const data = {
      input: withFbtRequireStatement(
        `<fbt desc="d" private="no">
          <fbt:param
            name="two
lines">
            <b>
              <fbt desc="test" private="yes">simple</fbt>
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
                fbt._(
                  'simple',
                  null,
                  {eo: {private: 'yes'}, hk: '2pjKFw'},
                ),
              ),
            ),
          ],
          {eo: {private: 'no'}, hk: '2xRGl8'},
        );`
      ),
    };
    const validExtraOptions = { private: { yes: true, no: true } };
    runTest(data, validExtraOptions);
  });

  it('should generate extra options for nested strings', () => {
    const data = {
      input: withFbtRequireStatement(
        `<fbt desc="d" private="no">
          I wrote
          <b>
            <fbt:plural many="inner strings" count={count} showCount="ifMany">
              an inner string
            </fbt:plural>
          </b>
        </fbt>;`
      ),
      output: `var fbt_sv_arg_0;
        const fbt = require("fbt");
        fbt_sv_arg_0 = fbt._plural(count, "number"),
        fbt._(
          {
            "*": "I wrote {=m1}",
            "_1": "I wrote {=m1}",
          },
          [
            fbt_sv_arg_0,
            fbt._implicitParam(
              "=m1",
              /*#__PURE__*/React.createElement(
                "b",
                null,
                fbt._(
                  {
                    "*": "{number} inner strings",
                    "_1": "an inner string"
                  },
                  [fbt_sv_arg_0],
                  {eo: {private: 'no'}, hk: "2HM8na"},
                ),
              ),
            ),
          ],
          {eo: {private: 'no'}, hk: 'fglLv'},
        );`,
    };
    const validExtraOptions = { private: { yes: true, no: true } };
    runTest(data, validExtraOptions);
  });
});
