import type { FbtSubstitution, FbtTableKey } from './FbtTable';

export type FbtTableArg = [
  Array<FbtTableKey> | null | undefined,
  FbtSubstitution | null | undefined
];

export default {
  getEnumResult(value: FbtTableKey): FbtTableArg {
    return [[value], null];
  },

  getGenderResult(
    variation: Array<FbtTableKey>,
    substitution?: FbtSubstitution | null
  ): FbtTableArg {
    return [variation, substitution];
  },

  getNumberResult(
    variation: Array<FbtTableKey>,
    substitution?: FbtSubstitution | null
  ): FbtTableArg {
    return [variation, substitution];
  },

  getSubstitution(substitution: FbtSubstitution): FbtTableArg {
    return [null, substitution];
  },

  getPronounResult(genderKey: number): FbtTableArg {
    return [[genderKey, '*'], null];
  },
};
