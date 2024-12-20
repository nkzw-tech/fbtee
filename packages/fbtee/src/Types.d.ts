import { ReactElement, ReactNode, ReactPortal } from 'react';
import GenderConst from './GenderConst.tsx';
import IntlVariations from './IntlVariations.tsx';

/**
 * Translated string from an `fbt()` call.
 *
 * This is an opaque type so you may _only_ create an `FbtString` by calling
 * `fbt()` or one of its methods.
 *
 * You may use an `FbtString` as any normal string, but you can't create a new
 * `FbtString` without `fbt()`.
 *
 * @warning Because fbt.param() accepts any value,
 * we can't guarantee that this Fbt contents isn't made of React elements
 */
export type FbtString = string;

/**
 * Translated string from an `<fbt>` element.
 *
 * Unlike `FbtString`, you cannot use `FbtElement` like any normal string. Since
 * `<fbt>` can have nested React nodes its internal structure is hidden from the
 * end user.
 *
 * There are some string-like properties and methods you may use, like `length`
 * and `toString()`.
 */
export type FbtElement = BaseResult;

/**
 * All translated strings. Could either be a translated string returned by an
 * `fbt()` call or a translated string returned by an `<fbt>` element.
 */
export type FbtWithoutString = FbtString | FbtElement;

/**
 * All translated strings wrapped in `fbt` and the `string` type. `string` is
 * mostly included for legacy purposes.
 *
 * NOTE: If you want to use a type that requires your string to be wrapped in
 * `fbt` use `FbtWithoutString`. Not this type. It may be wise to run a
 * codemod which renames this `Fbt` type to `Fbt | string` and renames
 * `FbtWithoutString` to `Fbt` so that all future uses of `Fbt` require
 * translated strings.
 */
export type Fbt = string | FbtWithoutString;

// Read-only array of Fbt items. Use this only when your code is meant to
// handle a list of Fbts from different source code locations.
// Avoid returning an array of Fbt like [<fbt/>, <fbt/>] for a single site
// because it's an anti-pattern similar to string concatenation.
// Favor using a single <fbt/> element as often as possible.
export type FbtCollection = Fbt | ReadonlyArray<Fbt>;

export type FbtContentItem =
  | boolean
  | FbtElement
  | PureStringResult
  | FbtString
  | null
  | number
  | ReactElement
  | ReactPortal
  | string
  | void;

export type NestedFbtContentItems = ReadonlyArray<
  FbtContentItem | NestedFbtContentItems
>;

export type FbtErrorContext = {
  hash?: string | null;
  translation: string;
};

/**
 * A delegate used in FbtResult for handling errors when toString
 * can't serialize due to non-string and non-Fbt elements in the
 * interpolated payload (e.g. React nodes, DOM nodes, etc).
 */
export interface IFbtErrorListener {
  /**
   * Handle the error scenario where the FbtResultBase contains non-string elements
   * (usually React components) and tries to run .toString()
   *
   * Example of bad usage of <fbt> with rich contents that will trigger this error
   *
   * render() {
   *   const text = (
   *     <fbt desc="...">
   *       I have <Link href="#">no name</Link>.
   *     </fbt>
   *   );
   *   return (
   *     <div className={cx('FiddleCSS/root')}>
   *       <p>Text = "{text}"</p>
   *       <p>Truncated Text = "{text.substr(0, 9)}"</p> // will output: "I have ."
   *       <em>You might have expected "I have no name" but we don't support
   *           this in the FBT API.</em>
   *     </div>
   *   );
   * }
   */
  readonly onStringSerializationError?: (content: FbtContentItem) => void;
}

export type BaseResult = {
  getContents(): NestedFbtContentItems;
  toJSON(): string;
};

export type PureStringResult = BaseResult;

// Represents the input of an fbt.param
type FbtParamInput = ReactNode;
export type FbsParamInput = PureStringResult | string;

// Represents the output of an fbt.param, fbt.enum, etc...
// It's voluntarily not an accurate representation of the real output.
// Non-internal i18n code should not need to know its actual type.
type FbsParamOutput = string;
type FbtParamOutput = FbsParamOutput;

type FbtAPIT<Output, ParamInput, ParamOutput> = {
  (
    text: string | ReadonlyArray<string>,
    description: string,
    options?: {
      author?: string;
      project?: string;
      subject: IntlVariations;
    },
  ): Output;
  c: (text: string) => Output;
  enum: (
    value: string,
    range: ReadonlyArray<string> | Readonly<{ [key: string]: string }>,
  ) => ParamOutput;
  name: (
    tokenName: string,
    value: string,
    gender: IntlVariations,
  ) => ParamOutput;
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
      value?: FbtContentItem; // optional value to replace token (rather than count)
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

type ArrayBasedFbtFunctionAPI<Output, ParamInput> = FbtAPIT<
  Output,
  ParamInput,
  FbtParamOutput
>;

export type TranslatedString = string & { __fbt_do_not_access: true };

export type FbtAPI = StringBasedFbtFunctionAPI<
  TranslatedString,
  FbtParamInput,
  string
> &
  ArrayBasedFbtFunctionAPI<TranslatedString, FbtParamInput>;

export type FbsAPI = StringBasedFbtFunctionAPI<
  TranslatedString,
  FbsParamInput,
  FbtParamOutput
> &
  ArrayBasedFbtFunctionAPI<TranslatedString, FbsParamInput>;
