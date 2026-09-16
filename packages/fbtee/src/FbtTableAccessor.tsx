import type { FbtTableKey } from './CompilerTypes.ts';
import type { FbtSubstitution } from './FbtTable.tsx';

export type FbtTableArg = [
  Array<FbtTableKey> | null | undefined,
  FbtSubstitution | null | undefined,
];

// Preserve the original count so a fallback catalog can select its own plural rules.
export const numberValues = new WeakMap<FbtTableArg, number>();

export default {
  getEnumResult(value: FbtTableKey): FbtTableArg {
    return [[value], null];
  },

  getGenderResult(
    variation: Array<FbtTableKey>,
    substitution?: FbtSubstitution | null,
  ): FbtTableArg {
    return [variation, substitution];
  },

  getNumberResult(
    variation: Array<FbtTableKey>,
    substitution?: FbtSubstitution | null,
    number?: number,
  ): FbtTableArg {
    const result: FbtTableArg = [variation, substitution];
    if (number != null) {
      numberValues.set(result, number);
    }
    return result;
  },

  getPronounResult(genderKey: number): FbtTableArg {
    return [[genderKey, '*'], null];
  },

  getSubstitution(substitution: FbtSubstitution): FbtTableArg {
    return [null, substitution];
  },
};
