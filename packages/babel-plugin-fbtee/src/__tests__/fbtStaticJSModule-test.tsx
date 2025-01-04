import { PluginOptions } from '@babel/core';
import { describe, expect, it } from '@jest/globals';
import {
  assertSourceAstEqual,
  jsCodeFbtCallSerializer,
  payload,
  snapshotTransform,
  transform,
  withFbtImportStatement,
} from './FbtTestUtil.tsx';

function runTest(
  data: { input: string; output: string },
  extra?: PluginOptions,
) {
  const expected = data.output;
  const actual = transform(data.input, extra);
  assertSourceAstEqual(expected, actual);
}

expect.addSnapshotSerializer(jsCodeFbtCallSerializer);

describe('fbt preserveWhitespace argument', () => {
  // TODO: Fix space normalization.
  // Here we are intentionally testing for the wrong behavior. We will come
  // back and update the expected output after we fix space normalization.
  describe('should NOT preserve whitespaces that do not neighbor raw text', () => {
    it('jsx elements and raw text', () => {
      expect(
        snapshotTransform(
          withFbtImportStatement(`
            var x =
              <fbt desc="d">
                <span>
                  Where do
                </span>
                <b>spaces</b>
                <i>go?</i>
                Good
                <i>question</i>
                !
              </fbt>;
          `),
        ),
      ).toMatchSnapshot();
    });

    it('jsx elements and string variation arguments nested inside jsx element', () => {
      expect(
        snapshotTransform(
          withFbtImportStatement(`
            var x =
              <fbt desc="d">
                <a>OuterJsx1</a>
                RawText
                <b>OuterJsx2</b>
                <b>
                  <i>InnerJsx1</i>
                  <fbt:plural count={this.state.ex1Count}>(plural)</fbt:plural>
                  <i>InnerJsx2</i>
                </b>
              </fbt>;
          `),
        ),
      ).toMatchSnapshot();
    });

    it('jsx elements with string variation arguments', () => {
      expect(
        snapshotTransform(
          withFbtImportStatement(`
            var x =
              <fbt desc="d">
                <span>
                  There should be
                </span>
                <b>
                  <fbt:plural
                    many="spaces"
                    showCount="ifMany"
                    count={this.state.ex1Count}>
                    a space
                  </fbt:plural>
                </b>
                !
              </fbt>;
          `),
        ),
      ).toMatchSnapshot();
    });

    it('should not preserve whitespace around text in JSXExpression', () => {
      expect(
        snapshotTransform(
          withFbtImportStatement(`
            var x =
              <fbt desc="d">
                <a>OuterJsx1</a>
                {'textInJSXExpression'}
                <b>OuterJsx2</b>
                <b>
                  rawText
                  {'textInJSXExpression'}
                  <i>InnerJsx1</i>
                  {'textInJSXExpression'}
                  <fbt:plural count={this.state.ex1Count}>(plural)</fbt:plural>
                  {'text' + 'InJSXExpression'}
                  <i>InnerJsx2</i>
                  {\`text${'InJSXExpression'}\`}
                </b>
              </fbt>;
          `),
        ),
      ).toMatchSnapshot();
    });

    it('should preserve voluntarily added spaces between NON-raw text', () => {
      expect(
        snapshotTransform(
          withFbtImportStatement(`
            var x =
              <fbt desc="d">
                <a>OuterJsx1</a>
                {' '}
                <b>OuterJsx2</b>
                <b>
                  {' '}
                  <i>InnerJsx1</i>
                  {' '}
                  <fbt:plural count={this.state.ex1Count}>(plural)</fbt:plural>
                  {' '}
                  <i>InnerJsx2</i>
                  {' '}
                  <i>InnerJsx3</i>
                  {' '}
                </b>
              </fbt>;
          `),
        ),
      ).toMatchSnapshot();
    });

    it('should treat comments in JSXExpression like they are not here', () => {
      expect(
        snapshotTransform(
          withFbtImportStatement(`
            var x =
              <fbt desc="d">
                <a>OuterJsx1</a>
                {/* someComment */}
                <b>OuterJsx2</b>
                <b>
                  {/* someComment */}
                  <i>InnerJsx1</i>
                  {/* someComment */}
                  <fbt:plural count={this.state.ex1Count}>(plural)</fbt:plural>
                  {/* someComment */}
                  rawText
                </b>
              </fbt>;
          `),
        ),
      ).toMatchSnapshot();
    });
  });

  describe('should preserve whitespace around text', () => {
    it('with inner text and string variation', () => {
      expect(
        snapshotTransform(
          withFbtImportStatement(`
            var x =
              <fbt desc="d">
                outerText
                <a>outerJsx</a>
                <b>
                  <i>innerJsx</i>
                  innerText
                  <fbt:plural count={this.state.ex1Count}>(plural)</fbt:plural>
                </b>
              </fbt>;
          `),
        ),
      ).toMatchSnapshot();
    });
  });

  it('should preserve whitespace in text when requested', () => {
    runTest({
      input: withFbtImportStatement(
        String.raw`var x = fbt("two\nlines", "one line", {preserveWhitespace:true});`,
      ),
      output: withFbtImportStatement(
        `var x = fbt._(${payload({
          jsfbt: {
            m: [],
            t: {
              desc: 'one line',
              text: 'two\nlines',
            },
          },
        })})`,
      ),
    });

    runTest({
      input: withFbtImportStatement(
        'var x = fbt("two  spaces", "one space", {preserveWhitespace:true});',
      ),
      output: withFbtImportStatement(
        `var x = fbt._(${payload({
          jsfbt: {
            m: [],
            t: {
              desc: 'one space',
              text: 'two  spaces',
            },
          },
        })})`,
      ),
    });
  });

  it('should preserve whitespace in desc when requested', () => {
    runTest({
      input: withFbtImportStatement(
        `var x = fbt('one line', 'two\\nlines', {preserveWhitespace: true});`,
      ),

      output: withFbtImportStatement(
        `var x = fbt._(
            ${payload({
              jsfbt: {
                m: [],
                t: {
                  desc: 'two\nlines',
                  text: 'one line',
                },
              },
            })},
          );`,
      ),
    });

    runTest({
      input: withFbtImportStatement(
        `var x = fbt('one space', 'two  spaces', {preserveWhitespace: true});`,
      ),
      output: withFbtImportStatement(
        `var x = fbt._(
            ${payload({
              jsfbt: {
                m: [],
                t: {
                  desc: 'two  spaces',
                  text: 'one space',
                },
              },
            })},
          );`,
      ),
    });
  });

  it('should coalesce whitespace in text when not requested', () => {
    runTest({
      input: withFbtImportStatement(
        `var x = fbt('two  spaces', 'one space', {preserveWhitespace: false});`,
      ),
      output: withFbtImportStatement(
        `var x = fbt._(
            ${payload({
              jsfbt: {
                m: [],
                t: {
                  desc: 'one space',
                  text: 'two spaces',
                },
              },
            })},
          );`,
      ),
    });

    runTest({
      input: withFbtImportStatement(
        `var x = fbt('two\\nlines', 'one line', {preserveWhitespace: false});`,
      ),
      output: withFbtImportStatement(
        `var x = fbt._(
            ${payload({
              jsfbt: {
                m: [],
                t: {
                  desc: 'one line',
                  text: 'two lines',
                },
              },
            })},
          );`,
      ),
    });
  });

  it('should coalesce whitespace in desc when not requested', () => {
    runTest({
      input: withFbtImportStatement(
        `var x = fbt('one line', 'two\\nlines', {preserveWhitespace: false});`,
      ),
      output: withFbtImportStatement(
        `var x = fbt._(
            ${payload({
              jsfbt: {
                m: [],
                t: {
                  desc: 'two lines',
                  text: 'one line',
                },
              },
            })},
          );`,
      ),
    });

    runTest({
      input: withFbtImportStatement(
        `var x = fbt('one space', 'two spaces', {preserveWhitespace: false});`,
      ),
      output: withFbtImportStatement(
        `var x = fbt._(
            ${payload({
              jsfbt: {
                m: [],
                t: {
                  desc: 'two spaces',
                  text: 'one space',
                },
              },
            })},
          );`,
      ),
    });
  });
});
