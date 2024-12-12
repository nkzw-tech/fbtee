enum IntlVariations {
  BITMASK_NUMBER = 28,
  NUMBER_ZERO = 16,
  NUMBER_ONE = 4,
  NUMBER_TWO = 8,
  NUMBER_FEW = 20,
  NUMBER_MANY = 12,
  NUMBER_OTHER = 24,
  GENDER_MALE = 1,
  GENDER_FEMALE = 2,
  GENDER_UNKNOWN = 3,
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
   * For overriding the displayed number
   */
  value?: unknown;
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
  value: string;
};

type FbtParamProps = ParamOptions & {
  name: string;
};

type FbtPluralProps = PluralOptions & {
  count: number;
};

type FbtPronounProps = PronounOptions & {
  gender: GenderConst;
  type: PronounType;
};

type FbtNameProps = {
  gender: IntlVariations;
  name: string;
};

type FbtSameParamProps = {
  name: string;
};

type FbtProps =
  | (FbtOptions & {
      desc: string;
    })
  | { common: true };

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
      'fbt:name': PropsWithChildren<FbtNameProps>;
      'fbt:param': PropsWithChildren<FbtParamProps>;
      'fbt:plural': PropsWithChildren<FbtPluralProps>;
      'fbt:pronoun': FbtPronounProps;
      'fbt:same-param': FbtSameParamProps;
    }
  }
}
