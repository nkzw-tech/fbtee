import { PluginOptions } from '@babel/core';
import { describe, expect, it } from '@jest/globals';
import {
  assertSourceAstEqual,
  payload,
  transform,
  withFbtRequireStatement,
} from './FbtTestUtil.tsx';

function runTest(
  data: { input: string; output: string },
  extra?: PluginOptions,
) {
  const expected = data.output;
  const actual = transform(data.input, extra);
  assertSourceAstEqual(expected, actual);
}

describe('fbt pronoun support', () => {
  it('"capitalize" option accepts boolean literal true', () => {
    runTest({
      input: withFbtRequireStatement(
        `var x = fbt(
            fbt.pronoun('possessive', gender, {capitalize: true}) +
              ' birthday is today.',
            'Capitalized possessive pronoun',
          );`,
      ),

      output: withFbtRequireStatement(
        `var x = fbt._(
          ${payload({
            jsfbt: {
              m: [null],
              t: {
                '*': {
                  desc: 'Capitalized possessive pronoun',
                  text: 'Their birthday is today.',
                },
                1: {
                  desc: 'Capitalized possessive pronoun',
                  text: 'Her birthday is today.',
                },
                2: {
                  desc: 'Capitalized possessive pronoun',
                  text: 'His birthday is today.',
                },
              },
            },
          })},
          [fbt._pronoun(1, gender)],
        );`,
      ),
    });
  });

  it('Should throw when using non-Boolean option value', () => {
    // Note: Using StringLiteral '"true"' instead of BooleanLiteral 'true'.
    const input = withFbtRequireStatement(
      `var x = fbt(
        'Today is ' +
          fbt.pronoun('possessive', gender, {human: 'true'}) +
          ' a happy birthday.',
        'Expect error exception',
      );`,
    );
    expect(() => transform(input)).toThrow(
      "Expected boolean value instead of 'true' (string)",
    );
  });

  it('Should throw when using non-Boolean option value in a template', () => {
    // Note: Using StringLiteral '"true"' instead of BooleanLiteral 'true'.
    const input = withFbtRequireStatement(
      `var x = fbt(
        \`Today is \${fbt.pronoun('possessive', gender, {
          human: 'true',
        })} a happy birthday.\`,
        'Expect error exception',
      );`,
    );
    expect(() => transform(input)).toThrow(
      "Expected boolean value instead of 'true' (string)",
    );
  });

  it('Should throw when using unknown "usage" value', () => {
    // Note: Using "possession" instead of "possessive".
    const input = withFbtRequireStatement(
      `var x = fbt(
        'Today is ' +
          fbt.pronoun('possession', gender, {human: false}) +
          ' a happy birthday.',
        'Expect error exception',
      );`,
    );
    expect(() => transform(input)).toThrow(
      '`usage`, the first argument of fbt.pronoun() - Expected value to be ' +
        "one of [object, possessive, reflexive, subject] but we got 'possession' (string) instead",
    );
  });

  it('Should elide false "human" option from fbt.pronoun()', () => {
    runTest({
      input:
        // I.e. Wish them a happy birthday.
        withFbtRequireStatement(
          `var x = fbt(
            'Wish ' +
              fbt.pronoun('object', gender, {human: true}) +
              ' a happy birthday.',
            'Elided false option',
          );`,
        ),

      output: withFbtRequireStatement(
        `var x = fbt._(
          ${payload({
            jsfbt: {
              m: [null],
              t: {
                '*': {
                  desc: 'Elided false option',
                  text: 'Wish them a happy birthday.',
                },
                1: {
                  desc: 'Elided false option',
                  text: 'Wish her a happy birthday.',
                },
                2: {
                  desc: 'Elided false option',
                  text: 'Wish him a happy birthday.',
                },
              },
            },
          })},
          [fbt._pronoun(0, gender, {human: 1})],
        );`,
      ),
    });
  });
});
