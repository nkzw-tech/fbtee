import { FbtTableKey } from '@nkzw/babel-plugin-fbtee';
import type { FbtSubstitution } from './FbtTable.tsx';

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

  getPronounResult(genderKey: number): FbtTableArg {
    return [[genderKey, '*'], null];
  },

  getSubstitution(substitution: FbtSubstitution): FbtTableArg {
    return [null, substitution];
  },
};
