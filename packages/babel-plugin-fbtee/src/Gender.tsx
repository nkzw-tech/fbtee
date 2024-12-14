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
  FEMALE = 1,
  MALE = 2,
  UNKNOWN_SINGULAR = 7,
  UNKNOWN_PLURAL = 11,
}

export const Genders = [
  GenderConst.NOT_A_PERSON,
  GenderConst.UNKNOWN_SINGULAR,
  GenderConst.UNKNOWN_PLURAL,
  GenderConst.FEMALE,
  GenderConst.MALE,
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
  [GenderConst.FEMALE]: {
    is_female: true,
    is_male: false,
    is_plural: false,
    is_unknown: false,
    object: 'her',
    possessive: 'her',
    reflexive: 'herself',
    string: 'female',
    subject: 'she',
  },
  [GenderConst.MALE]: {
    is_female: false,
    is_male: true,
    is_plural: false,
    is_unknown: false,
    object: 'him',
    possessive: 'his',
    reflexive: 'himself',
    string: 'male',
    subject: 'he',
  },
} as const;

export function getData(
  gender: GenderConst,
  usage: keyof GenderConfig,
): boolean | string {
  return (data[gender] || NotAPerson)[usage];
}
