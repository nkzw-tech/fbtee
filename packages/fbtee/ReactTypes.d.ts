import {
  FbtConjunction,
  FbtDelimiter,
  FbtWithoutString,
} from './lib/index.d.ts';

enum IntlVariations {
  GENDER_MALE = 1,
  GENDER_FEMALE = 2,
  GENDER_UNKNOWN = 3,
  NUMBER_ONE = 4,
  NUMBER_TWO = 8,
  NUMBER_MANY = 12,
  NUMBER_ZERO = 16,
  NUMBER_FEW = 20,
  NUMBER_OTHER = 24,
  BITMASK_NUMBER = 28,
}

enum GenderConst {
  NOT_A_PERSON = 0,
  FEMALE_SINGULAR = 1,
  MALE_SINGULAR = 2,
  UNKNOWN_SINGULAR = 7,
  UNKNOWN_PLURAL = 11,
}

export type ParamOptions = {
  /**
   * `IntlVariations.GENDER_*` Pass the gender of the parameter for correctly variated text.
   */
  gender?: IntlVariations;
  /**
   * Passing a value of type `number` into the `number` option uses that value as the input for which we determine the [CLDR plural value](http://cldr.unicode.org/index/cldr-spec/plural-rules).
   * You can pass `true` to simply use the parameter value (the same value that replaces the token).
   */
  number?: number | true;
};

export type PronounOptions = {
  /**
   * Whether to capitalize the pronoun in the source string.
   */
  capitalize?: boolean;
  /**
   * Whether to elide the NOT_A_PERSON option in the text variations generated.
   */
  human?: boolean;
};

export type PluralOptions = {
  /**
   * Represents the "few" form of the string (e.g., 2-4 in Russian). Falls back to `many` if not provided.
   */
  few?: string;
  /**
   * Represents the plural form of the string in English. Default is `{singular} + 's'`
   */
  many?: string;
  /**
   * Name of the token where count shows up. (Default: `"number"`)
   */
  name?: string;
  /**
   * `"yes"|"no"|"ifMany"`: Whether to show the `{number}` in the string.
   *
   * > Note that the singular phrase never has a token, but inlines to `1`.
   * ? This is to account for languages like Hebrew for which showing the actual number isn't appropriate
   *
   *  - "no": (DEFAULT) Don't show the count
   *  - "ifMany": Show the count only in plural case
   *  - "yes": Show the count in all cases
   */
  showCount?: 'yes' | 'no' | 'ifMany';
  /**
   * Represents the "two" form of the string (e.g., exactly 2 in Arabic). Falls back to `many` if not provided.
   */
  two?: string;
  /**
   * For overriding the displayed number
   */
  value?: unknown;
  /**
   * Represents the "zero" form of the string (e.g., 0 in Arabic). Falls back to `many` if not provided.
   */
  zero?: string;
};

export type FbtOptions = {
  /**
   * Text author
   */
  author?: string;
  /**
   *  Use a "common" string repository
   *  To use the strings at runtime, there is the fbt.c(...) function call or the <fbt common=true>...</fbt> JSX API.
   *  NOTE: The transform will throw if it encounters a common string not in the map provided.
   *  See: https://facebook.github.io/fbt/docs/common#runtime-api
   */
  common?: boolean;
  /**
   *  Informs [collection](https://facebook.github.io/fbt/docs/collection/) to skip this string (useful for tests/mocks)
   */
  doNotExtract?: boolean;
  /**
   *  (Default: false) FBT normally consolidates whitespace down to one space (' '). Turn this off by setting this to true
   */
  preserveWhitespace?: boolean;
  /**
   * Project to which the text belongs
   */
  project?: string;
  /**
   * IntlVariations.GENDER_*: Pass an [implicit subject](https://facebook.github.io/fbt/docs/implicit_params/) gender to a partially formed text
   */
  subject?: IntlVariations;
};

type FbtOutput = {
  fbt: string;
  params: string;
};

type FbsOutput = {
  fbt: string;
  params: string;
};

type FbtEnumProps = {
  'enum-range': Array<string> | { [enumKey: string]: string };
  key?: string | null;
  value: string;
};

type FbtParamProps = ParamOptions & {
  key?: string | null;
  name: string;
};

type FbtPluralProps = PluralOptions & {
  count: number;
  key?: string | null;
};

type FbtPronounProps = PronounOptions & {
  gender: GenderConst;
  key?: string | null;
  type: PronounType;
};

type FbtNameProps = {
  gender: IntlVariations;
  key?: string | null;
  name: string;
};

type FbtSameParamProps = {
  key?: string | null;
  name: string;
};

type FbtProps = { key?: string | null } & (
  | (FbtOptions & {
      desc: string;
    })
  | { common: true }
);

type FbtListProps = {
  conjunction?: FbtConjunction;
  delimiter?: FbtDelimiter;
  items: Array<FbtWithoutString | React.ReactElement | null | undefined>;
  key?: string | null;
  name: string;
};

declare module 'react' {
  namespace JSX {
    type PropsWithChildren<P> = P & { children?: React.ReactNode | undefined };
    type PropsWithStringChild<P> = P & {
      children?: string | Array<string> | undefined;
    };

    interface IntrinsicElements {
      fbs: PropsWithChildren<FbtProps>;
      'fbs:enum': FbtEnumProps;
      'fbs:name': PropsWithStringChild<FbtNameProps>;
      'fbs:param': PropsWithStringChild<FbtParamProps>;
      'fbs:plural': PropsWithStringChild<FbtPluralProps>;
      'fbs:pronoun': FbtPronounProps;
      'fbs:same-param': FbtSameParamProps;
      fbt: PropsWithChildren<FbtProps>;
      'fbt:enum': FbtEnumProps;
      'fbt:list': FbtListProps;
      'fbt:name': PropsWithChildren<FbtNameProps>;
      'fbt:param': PropsWithChildren<FbtParamProps>;
      'fbt:plural': PropsWithChildren<FbtPluralProps>;
      'fbt:pronoun': FbtPronounProps;
      'fbt:same-param': FbtSameParamProps;
    }
  }
}
