import type { Node } from '@babel/types';
import type { ValidPronounUsagesType } from '../../fbt/src/FbtRuntimeTypes';

export type FbtOptionValue = string | boolean | Node;
export type FbtOptionValues = Partial<
  Record<string, FbtOptionValue | null | undefined>
>;
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
  author?: FbtOptionValue | null | undefined;
  common?: FbtOptionValue | null | undefined;
  doNotExtract?: boolean | null | undefined;
  preserveWhitespace?: FbtOptionValue | null | undefined;
  project: string;
  subject?: FbtOptionValue | null | undefined;
}>;

export type JSModuleNameType = 'fbt' | 'fbs';
export type ValidPronounUsagesKey = keyof ValidPronounUsagesType;

export const SENTINEL = '__FBT__';

export const PluralRequiredAttributes = {
  count: true,
} as const;

const ShowCount = {
  yes: true,
  no: true,
  ifMany: true,
} as const;

export const ShowCountKeys = {
  yes: 'yes',
  no: 'no',
  ifMany: 'ifMany',
} as const;

export const PluralOptions = {
  value: true, // optional value to replace token (rather than count)
  showCount: ShowCount,
  name: true, // token
  many: true,
} as const;

export const ValidPluralOptions = {
  ...PluralOptions,
  ...PluralRequiredAttributes,
} as const;

export const ValidPronounUsages: ValidPronounUsagesType = {
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
  human: { true: true, false: true },
  capitalize: { true: true, false: true },
} as const;

export const PronounRequiredAttributes = {
  type: true, // See ValidPronounUsages for valid strings
  gender: true,
} as const;

/**
 * Valid options allowed in the fbt(...) calls.
 */
export const ValidFbtOptions = Object.freeze({
  author: true,
  common: true,
  doNotExtract: true,
  preserveWhitespace: true,
  project: true,
  subject: true,
});

export const FbtBooleanOptions = {
  preserveWhitespace: true,
  doNotExtract: true,
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
  number: true,
  gender: true,
  ...RequiredParamOptions,
} as const;

export const FbtType = {
  TABLE: 'table',
  TEXT: 'text',
} as const;

export const JSModuleName = {
  FBT: 'fbt',
  REACT_FBT: 'Fbt',
  FBS: 'fbs',
} as const;

export type FbtTypeValue = (typeof FbtType)[keyof typeof FbtType];

// Used to help detect the usage of the JS fbt/fbs API inside a JS file
// Closely matches the Grep regexp in https://fburl.com/code/y1yt6slg
export const ModuleNameRegExp: RegExp = /<[Ff]b[st]\b|fb[st](\.c)?\s*\(/;

export const FBT_ENUM_MODULE_SUFFIX = '$FbtEnum';

export const EXTRA_OPTIONS_KEY = 'eo';
