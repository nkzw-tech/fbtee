import { describe, expect, it } from '@jest/globals';
import {
  jsCodeFbtCallSerializer,
  snapshotTransform,
  transform,
  withFbtImportStatement,
} from './FbtTestUtil.tsx';

expect.addSnapshotSerializer(jsCodeFbtCallSerializer);

describe('fbt pronoun support', () => {
  it('"capitalize" option accepts boolean literal true', () => {
    expect(
      snapshotTransform(
        withFbtImportStatement(
          `var x = fbt(
            fbt.pronoun('possessive', gender, {capitalize: true}) +
              ' birthday is today.',
            'Capitalized possessive pronoun',
          );`,
        ),
      ),
    ).toMatchSnapshot();
  });

  it('Should throw when using non-Boolean option value', () => {
    // Note: Using StringLiteral '"true"' instead of BooleanLiteral 'true'.
    const input = withFbtImportStatement(
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
    const input = withFbtImportStatement(
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
    const input = withFbtImportStatement(
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
    expect(
      snapshotTransform(
        // I.e. Wish them a happy birthday.
        withFbtImportStatement(
          `var x = fbt(
            'Wish ' +
              fbt.pronoun('object', gender, {human: true}) +
              ' a happy birthday.',
            'Elided false option',
          );`,
        ),
      ),
    ).toMatchSnapshot();
  });
});
