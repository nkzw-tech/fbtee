import type { Node } from '@babel/types';

export type FbtOptionValue = string | boolean | Node;
export type FbtOptionValues = Partial<Record<string, FbtOptionValue | null>>;
export type FbtOptionConfig = Partial<
  Record<
    string,
    | {
        [optionValue: string]: true;
      }
    | true
  >
>;

export type FbtCallSiteOptions = Partial<{
  author?: FbtOptionValue | null;
  common?: FbtOptionValue | null;
  doNotExtract?: boolean | null;
  preserveWhitespace?: FbtOptionValue | null;
  project: string;
  subject?: FbtOptionValue | null;
}>;

export type JSModuleNameType = 'fbt' | 'fbs';
export type ValidPronounUsagesKey = keyof typeof ValidPronounUsages;

export const SENTINEL = '__FBT__';

export const PluralRequiredAttributes = {
  count: true,
} as const;

const ShowCount = {
  ifMany: true,
  no: true,
  yes: true,
} as const;

export const ShowCountKeys = {
  ifMany: 'ifMany',
  no: 'no',
  yes: 'yes',
} as const;

export const PluralOptions = {
  many: true,
  name: true,
  showCount: ShowCount,
  value: true,
} as const;

export const ValidPluralOptions = {
  ...PluralOptions,
  ...PluralRequiredAttributes,
} as const;

export const ValidPronounUsages = {
  object: 0,
  possessive: 1,
  reflexive: 2,
  subject: 3,
} as const;

export const ValidPronounUsagesKeys = {
  object: 'object',
  possessive: 'possessive',
  reflexive: 'reflexive',
  subject: 'subject',
} as const;

export const ValidPronounOptions = {
  capitalize: { false: true, true: true },
  human: { false: true, true: true },
} as const;

export const PronounRequiredAttributes = {
  // See ValidPronounUsages for valid strings
  gender: true,
  type: true,
} as const;

/**
 * Valid options allowed in the fbt(...) calls.
 */
export const ValidFbtOptions = {
  author: true,
  common: true,
  doNotExtract: true,
  preserveWhitespace: true,
  project: true,
  subject: true,
} as const;

export const FbtBooleanOptions = {
  doNotExtract: true,
  preserveWhitespace: true,
} as const;

export const CommonOption = 'common';
export const FbtCallMustHaveAtLeastOneOfTheseAttributes = new Set([
  'desc',
  CommonOption,
]);

export const FbtRequiredAttributes = {
  desc: true,
} as const;

export const PLURAL_PARAM_TOKEN = 'number';

export const RequiredParamOptions = {
  name: true,
} as const;

export const ValidParamOptions = {
  gender: true,
  number: true,
  ...RequiredParamOptions,
} as const;

export const FbtType = {
  TABLE: 'table',
  TEXT: 'text',
} as const;

export const JSModuleName = {
  FBS: 'fbs',
  FBT: 'fbt',
  REACT_FBT: 'Fbt',
} as const;

export type FbtTypeValue = (typeof FbtType)[keyof typeof FbtType];

// Used to help detect the usage of the JS fbt/fbs API inside a JS file
// Closely matches the Grep regexp in https://fburl.com/code/y1yt6slg
export const ModuleNameRegExp: RegExp = /<[Ff]b[st]\b|fb[st](\.c)?\s*\(/;

export const FBT_ENUM_MODULE_SUFFIX = '$FbtEnum';
