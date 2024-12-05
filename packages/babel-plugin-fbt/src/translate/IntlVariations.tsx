import invariant from 'invariant';

export const IntlNumberVariations = {
  // Cast below values to IntlVariationsEnum
  ZERO: 16, //  0b10000
  ONE: 4, //    0b00100
  TWO: 8, //    0b01000
  FEW: 20, //   0b10100
  MANY: 12, //  0b01100
  OTHER: 24, // 0b11000
} as const;

export type IntlVariationsEnum =
  (typeof IntlNumberVariations)[keyof typeof IntlNumberVariations];

// Must match with `IntlVariations.js`
export const Gender = {
  // Cast below values to IntlVariationsEnum
  MALE: 1,
  FEMALE: 2,
  UNKNOWN: 3,
} as const;

// Two bitmasks for representing gender/number variations.  Give a bit
// between number/gender in case CLDR ever exceeds 7 options
export const Mask = {
  NUMBER: 28,
  GENDER: 3,
} as const;

export type IntlVariationMaskValue = (typeof Mask)[keyof typeof Mask];

export const FbtVariationType = {
  GENDER: 1,
  NUMBER: 2,
  PRONOUN: 3,
} as const;

export type IntlFbtVariationTypeValue =
  (typeof FbtVariationType)[keyof typeof FbtVariationType];

export const VIEWING_USER = '__viewing_user__';
export const SUBJECT = '__subject__';

// Gender variation key used in JSFBT to represent any gender
export const GENDER_ANY: '*' = '*';
// Number variation key used in JSFBT to represent "many" (i.e. non-exactly one)
export const NUMBER_ANY: '*' = '*';

// This is not CLDR, but an fbt-specific marker that exists so that
// singular phrases are not overwritten by multiplexed plural phrases
// with a singular entry
export const EXACTLY_ONE: '_1' = '_1';

const SPECIALS = {
  // The default entry.  When no entry exists, we fallback to this in the fbt
  // table access logic.
  '*': true,
  EXACTLY_ONE: true,
} as const;

export function getType(
  n: (typeof Mask)[keyof typeof Mask]
): (typeof Mask)[keyof typeof Mask] {
  invariant(isValidValue(n), 'Invalid NumberType: %s', n);

  return n & Mask.NUMBER ? Mask.NUMBER : Mask.GENDER;
}

export function isValidValue(value: string | number): boolean {
  const num = Number(value);
  return (
    SPECIALS[value as keyof typeof SPECIALS] ||
    (num & Mask.NUMBER && !(num & ~Mask.NUMBER)) ||
    (num & Mask.GENDER && !(num & ~Mask.GENDER))
  );
}
