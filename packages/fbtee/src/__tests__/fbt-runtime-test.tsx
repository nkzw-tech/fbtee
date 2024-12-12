import { describe, expect, it, jest } from '@jest/globals';
import fbtRuntime from '../fbt.tsx';
import { FbtTableArg } from '../FbtTableAccessor.tsx';
import Hooks, { FbtRuntimeInput } from '../Hooks.tsx';
import { setupFbtee } from '../index.tsx';
import intlNumUtils from '../intlNumUtils.tsx';
// Warning: importing JS modules outside of beforeEach blocks is generally bad practice
// in jest tests. We might need to move these modules inside beforeEach().
// These ones can stay here for now since they have a consistent behavior across this test suite.
import IntlVariations from '../IntlVariations.tsx';
import IntlViewerContext from '../IntlViewerContext.tsx';

const ONE = String(IntlVariations.NUMBER_ONE);
const FEW = String(IntlVariations.NUMBER_FEW);
const MALE = String(IntlVariations.GENDER_MALE);
const FEMALE = String(IntlVariations.GENDER_FEMALE);

setupFbtee({
  translations: {},
});

// Ignore missing translations.
console.warn = jest.fn();

describe('fbt', () => {
  it('should handle variated numbers', () => {
    Hooks.register({
      // IntlCLDRNumberType31
      getViewerContext: () => ({ ...IntlViewerContext, locale: 'br_FR' }),
    });
    const numToType = {
      1_000_000: IntlVariations.NUMBER_MANY,
      103: IntlVariations.NUMBER_FEW,
      15: IntlVariations.NUMBER_OTHER,
      21: IntlVariations.NUMBER_ONE,
      22: IntlVariations.NUMBER_TWO,
    } as const;
    for (const n of Object.keys(numToType)) {
      const type = numToType[n as unknown as keyof typeof numToType];
      const displayNumber = intlNumUtils.formatNumberWithThousandDelimiters(
        Number.parseFloat(n),
      );
      expect(fbtRuntime._param('num', Number.parseInt(n, 10), [0])).toEqual([
        [type, '*'],
        { num: displayNumber },
      ]);
    }
  });

  it('should access table with fallback logic', () => {
    let genderMock: IntlVariations;
    Hooks.register({
      getViewerContext: jest.fn(() => ({
        GENDER: genderMock,
        locale: 'ro_RO', // IntlCLDRNumberType19
      })),
    });

    const table: FbtRuntimeInput = {
      '*': {
        A: {
          '*': 'A,UNKNOWN,OTHER {name} has {num}',
          [FEW]: 'A,UNKNOWN,FEW {name} has {num}',
          [ONE]: 'A,UNKNOWN,ONE {name} has {num}',
        },
        B: {
          '*': 'B,UNKNOWN,OTHER {name} has {num}',
          [FEW]: 'B,UNKNOWN,FEW {name} has {num}',
          [ONE]: 'B,UNKNOWN,ONE {name} has {num}',
        },
      },
      [FEMALE]: {
        B: {
          '*': 'B,FEMALE,OTHER {name} has {num}',
          [FEW]: 'B,FEMALE,FEW {name} has {num}',
        },
      },
      [MALE]: {
        A: {
          '*': 'A,MALE,OTHER {name} has {num}',
          [ONE]: 'A,MALE,ONE {name} has {num}',
        },
      },
      __vcg: 1,
    };

    const few = fbtRuntime._param('num', 10, [0] /*Variations.NUMBER*/);
    const other = fbtRuntime._param('num', 20, [0]);
    const one = fbtRuntime._param('num', 1, [0]);
    const A = fbtRuntime._enum('A', { A: 'A', B: 'B' });
    const B = fbtRuntime._enum('B', { A: 'A', B: 'B' });
    const name = fbtRuntime._param('name', 'Bob');

    // GENDER UNKNOWN
    genderMock = IntlVariations.GENDER_UNKNOWN;
    let tests = [
      { arg: [A, few, name], expected: 'A,UNKNOWN,FEW Bob has 10' },
      { arg: [A, one, name], expected: 'A,UNKNOWN,ONE Bob has 1' },
      { arg: [A, other, name], expected: 'A,UNKNOWN,OTHER Bob has 20' },
      { arg: [B, few, name], expected: 'B,UNKNOWN,FEW Bob has 10' },
      { arg: [B, one, name], expected: 'B,UNKNOWN,ONE Bob has 1' },
      { arg: [B, other, name], expected: 'B,UNKNOWN,OTHER Bob has 20' },
    ];
    const runTest = function (test: {
      arg: Array<FbtTableArg>;
      expected: string;
    }) {
      try {
        expect(fbtRuntime._(table, test.arg).toString()).toBe(test.expected);
      } catch (error) {
        if (error instanceof Error) {
          error.message += `\ntest.expected="${test.expected}"`;
        }
        throw error;
      }
    };
    tests.forEach(runTest);

    genderMock = IntlVariations.GENDER_MALE;
    tests = [
      { arg: [A, few, name], expected: 'A,MALE,OTHER Bob has 10' },
      { arg: [A, one, name], expected: 'A,MALE,ONE Bob has 1' },
      { arg: [A, other, name], expected: 'A,MALE,OTHER Bob has 20' },
      { arg: [B, few, name], expected: 'B,UNKNOWN,FEW Bob has 10' },
      { arg: [B, one, name], expected: 'B,UNKNOWN,ONE Bob has 1' },
      { arg: [B, other, name], expected: 'B,UNKNOWN,OTHER Bob has 20' },
    ];
    tests.forEach(runTest);

    genderMock = IntlVariations.GENDER_FEMALE;
    tests = [
      { arg: [A, few, name], expected: 'A,UNKNOWN,FEW Bob has 10' },
      { arg: [A, one, name], expected: 'A,UNKNOWN,ONE Bob has 1' },
      { arg: [A, other, name], expected: 'A,UNKNOWN,OTHER Bob has 20' },
      { arg: [B, few, name], expected: 'B,FEMALE,FEW Bob has 10' },
      { arg: [B, one, name], expected: 'B,FEMALE,OTHER Bob has 1' },
      { arg: [B, other, name], expected: 'B,FEMALE,OTHER Bob has 20' },
    ];
    tests.forEach(runTest);
  });
});
