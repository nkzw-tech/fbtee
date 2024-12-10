import invariant from 'invariant';
import GenderConst from './GenderConst.tsx';

type DisplayGenderConstType = 'UNKNOWN' | 'FEMALE' | 'MALE' | 'NEUTER';

const DisplayGenderConst = {
  FEMALE: 'FEMALE',
  MALE: 'MALE',
  NEUTER: 'NEUTER',
  UNKNOWN: 'UNKNOWN',
} as const;

/**
 * Map an array of genders to a single value.
 * Logic here mirrors that of :fbt:pronoun::render().
 */
function fromMultiple(genders: Array<number>): number {
  invariant(0 < genders.length, 'Cannot have pronoun for zero people');
  return genders.length === 1 ? genders[0] : GenderConst.UNKNOWN_PLURAL;
}

/**
 * Maps a DisplayGenderConst value (usually retrieved through the Gender
 * GraphQL type) to a GenderConst value usable by Fbt.
 */
function fromDisplayGender(gender: DisplayGenderConstType): number {
  switch (gender) {
    case DisplayGenderConst.MALE:
      return GenderConst.MALE_SINGULAR;
    case DisplayGenderConst.FEMALE:
      return GenderConst.FEMALE_SINGULAR;
    case DisplayGenderConst.NEUTER:
      return GenderConst.NEUTER_SINGULAR;
    default:
      return GenderConst.NOT_A_PERSON;
  }
}

module.exports = {
  fromDisplayGender,
  fromMultiple,
};
