type GenderConfig = {
  is_female: boolean;
  is_male: boolean;
  is_plural: boolean;
  is_unknown: boolean;
  object: string;
  possessive: string;
  reflexive: string;
  string: string;
  subject: string;
};

export enum GenderConst {
  NOT_A_PERSON = 0,
  FEMALE_SINGULAR = 1,
  MALE_SINGULAR = 2,
  UNKNOWN_SINGULAR = 7,
  UNKNOWN_PLURAL = 11,
}

export const Genders = [
  GenderConst.NOT_A_PERSON,
  GenderConst.FEMALE_SINGULAR,
  GenderConst.MALE_SINGULAR,
  GenderConst.UNKNOWN_SINGULAR,
  GenderConst.UNKNOWN_PLURAL,
] as const;

const NotAPerson = {
  is_female: false,
  is_male: false,
  is_plural: false,
  is_unknown: true,
  object: 'this',
  possessive: 'their',
  reflexive: 'themself',
  string: 'unknown',
  subject: 'they',
};

const data: Partial<Record<GenderConst, GenderConfig>> = {
  [GenderConst.NOT_A_PERSON]: NotAPerson,
  [GenderConst.FEMALE_SINGULAR]: {
    is_female: true,
    is_male: false,
    is_plural: false,
    is_unknown: false,
    object: 'her',
    possessive: 'her',
    reflexive: 'herself',
    string: 'female singular',
    subject: 'she',
  },
  [GenderConst.MALE_SINGULAR]: {
    is_female: false,
    is_male: true,
    is_plural: false,
    is_unknown: false,
    object: 'him',
    possessive: 'his',
    reflexive: 'himself',
    string: 'male singular',
    subject: 'he',
  },
  [GenderConst.UNKNOWN_SINGULAR]: {
    is_female: false,
    is_male: false,
    is_plural: false,
    is_unknown: true,
    object: 'them',
    possessive: 'their',
    reflexive: 'themself',
    string: 'unknown singular',
    subject: 'they',
  },
  [GenderConst.UNKNOWN_PLURAL]: {
    is_female: false,
    is_male: false,
    is_plural: true,
    is_unknown: true,
    object: 'them',
    possessive: 'their',
    reflexive: 'themselves',
    string: 'unknown plural',
    subject: 'they',
  },
} as const;

export function getData(
  gender: GenderConst,
  usage: keyof GenderConfig,
): boolean | string {
  return (data[gender] || NotAPerson)[usage];
}
