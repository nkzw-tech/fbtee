import type { ReactElement, ReactNode } from 'react';
import GenderConst from './GenderConst.tsx';
import IntlVariations from './IntlVariations.tsx';

export type TranslatedString = string & { __fbt_do_not_access: true };
export type FbtResult = string | ReactElement;
export type FbtString = string;
export type FbtElement = ReactElement;
export type FbtWithoutString = FbtResult;
export type Fbt = FbtResult;
export type FbtCollection = Fbt | ReadonlyArray<Fbt>;
export type FbtContentItem = ReactNode;
export type NestedFbtContentItems = ReadonlyArray<ReactNode>;

export type FbtErrorContext = {
  hash?: string | null;
  translation: string;
};

export interface IFbtErrorListener {
  readonly onStringSerializationError?: (content: FbtContentItem) => void;
}

type FbtParamInput = ReactNode;
export type FbsParamInput = string | number;

// Represents the output of an fbt.param, fbt.enum, etc...
// It's voluntarily not an accurate representation of the real output.
// Non-internal i18n code should not need to know its actual type.
type FbsParamOutput = string;
type FbtParamOutput = FbsParamOutput;

export type FbtConjunction = 'and' | 'none' | 'or';
export type FbtDelimiter = 'bullet' | 'comma' | 'semicolon';

type FbtAPIT<Output, ParamInput, ParamOutput> = {
  (
    text: string | ReadonlyArray<string>,
    description: string,
    options?: {
      author?: string;
      project?: string;
      subject?: IntlVariations;
    },
  ): Output;
  c: (text: string) => Output;
  enum: (
    value: string,
    range: ReadonlyArray<string> | Readonly<{ [key: string]: string }>,
  ) => ParamOutput;
  list: (
    name: string,
    items: ReadonlyArray<
      (Output extends TranslatedString ? string : ParamInput) | null | undefined
    >,
    conjunction?: FbtConjunction,
    delimiter?: FbtDelimiter,
  ) => ParamOutput;
  name: (name: string, value: string, gender: IntlVariations) => ParamOutput;
  param: (
    name: string,
    value: ParamInput,
    options?: {
      gender?: IntlVariations;
      number?: boolean | number;
    },
  ) => ParamOutput;
  plural: (
    label: string,
    count: number,
    options?: {
      many?: string;
      name?: string;
      showCount?: 'ifMany' | 'no' | 'yes'; // token name
      value?: ParamInput; // optional value to replace token (rather than count)
    },
  ) => ParamOutput;
  pronoun: (
    usage: 'object' | 'possessive' | 'reflexive' | 'subject',
    gender: GenderConst,
    options?: {
      capitalize?: boolean;
      human?: boolean;
    },
  ) => ParamOutput;
  sameParam: (name: string) => ParamOutput;
};

type StringBasedFbtFunctionAPI<Output, ParamInput, ParamOutput> = FbtAPIT<
  Output,
  ParamInput,
  ParamOutput
>;

type ArrayBasedFbtFunctionAPI<Output, ParamInput> = FbtAPIT<Output, ParamInput, FbtParamOutput>;

export type FbtAPI = StringBasedFbtFunctionAPI<FbtResult, FbtParamInput, string> &
  ArrayBasedFbtFunctionAPI<FbtResult, FbtParamInput>;

export type FbsAPI = StringBasedFbtFunctionAPI<TranslatedString, FbsParamInput, FbtParamOutput> &
  ArrayBasedFbtFunctionAPI<TranslatedString, FbsParamInput>;
