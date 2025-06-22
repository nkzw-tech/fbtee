import type {
  FbtTableKey,
  PatternHash,
  PatternString,
} from '@nkzw/babel-plugin-fbtee';
import FbtResult from './FbtResult.tsx';
import type { FbtTableArg } from './FbtTableAccessor.tsx';
import type {
  BaseResult,
  FbtErrorContext,
  IFbtErrorListener,
  NestedFbtContentItems,
  PureStringResult,
} from './Types.ts';
import IntlViewerContext from './ViewerContext.tsx';

export type ResolverFn<T extends BaseResult> = (
  contents: NestedFbtContentItems,
  hashKey: PatternHash | null | undefined,
  errorListener: IFbtErrorListener | null,
) => T;

/**
 * This is the main input payload to the fbt._(...) runtime call.
 *
 * - For simple fbt calls without interpolation (fbt.param) or multiplexing (fbt.plural,
 *   fbt.enum, viewer context variation, etc), this is a simple vanilla string.
 * - Otherwise this is a table whose keys correspond to the associated runtime
 *   parameters passed to fbt._, named `args`.
 *
 *  See the docblock for fbt._ for an example of the nested table and its behavior
 */
export type FbtRuntimeInput =
  | PatternString
  | [PatternString, PatternHash]
  | FbtInputTable;

type FbtInputBranch = {
  [K in FbtTableKey]:
    | PatternString
    | [PatternString, PatternHash]
    | FbtInputBranch;
};

export type FbtInputTable = Record<
  FbtTableKey,
  | number // Allow __vcg.
  | PatternString
  | [PatternString, PatternHash]
  | FbtInputBranch
>;

export type FbtTableArgs = Array<FbtTableArg>;
export type FbtTranslatedInput = {
  args: FbtTableArgs | null;
  table: FbtRuntimeInput & { __vcg?: 1 };
};

export type FbtEnumHashKeyTable = Partial<Record<FbtTableKey, PatternString>>;
export type FbtInputOpts = {
  // hash key
  hk?: string;
};
/**
 * Map of extra fbt options (or JSX attributes) to accept on fbt callsites.
 *
 * We accept them at the parsing phase and output them when rendering fbt._()
 * callsites, without doing any further processing on them.
 *
 * Extra options are then exposed in fbt hooks which allows external developers
 * to use them for custom logic.
 */
export type ExtraOptionValues = {
  [optionName: string]: ExtraOptionValue;
};
export type ExtraOptionValue = string;
export type FbtRuntimeCallInput = {
  args: FbtTableArgs | null;
  options: FbtInputOpts | null;
  table: FbtRuntimeInput;
};
export type FbtImpressionOptions = {
  inputTable: FbtRuntimeInput;
  tokens: Array<FbtTableKey>;
};

export type Hooks = Partial<{
  errorListener: (context: FbtErrorContext) => IFbtErrorListener | null;
  getFbsResult: ResolverFn<PureStringResult>;
  getFbtResult: ResolverFn<FbtResult>;
  getTranslatedInput: (input: FbtRuntimeCallInput) => FbtTranslatedInput | null;
  getViewerContext: () => typeof IntlViewerContext;
}>;

const _registrations: Hooks = {};

export default {
  getErrorListener(context: FbtErrorContext): IFbtErrorListener | null {
    return _registrations.errorListener?.(context) || null;
  },

  getFbsResult(
    contents: NestedFbtContentItems,
    hashKey: PatternHash | null | undefined,
    errorListener: IFbtErrorListener | null,
  ): PureStringResult {
    const { getFbsResult } = _registrations;
    if (!getFbsResult) {
      throw new Error(`Hooks: 'getFbsResult' is not registered`);
    }
    return getFbsResult(contents, hashKey, errorListener);
  },

  getFbtResult(
    contents: NestedFbtContentItems,
    hashKey: PatternHash | null | undefined,
    errorListener: IFbtErrorListener | null,
  ): FbtResult {
    const { getFbtResult } = _registrations;
    if (!getFbtResult) {
      throw new Error(`Hooks: 'getFbtResult' is not registered`);
    }
    return getFbtResult(contents, hashKey, errorListener);
  },

  getTranslatedInput(input: FbtRuntimeCallInput): FbtTranslatedInput {
    return _registrations.getTranslatedInput?.(input) ?? input;
  },

  getViewerContext(): typeof IntlViewerContext {
    const { getViewerContext } = _registrations;
    if (!getViewerContext) {
      throw new Error(`Hooks: 'getViewerContext' is not registered`);
    }
    return getViewerContext();
  },

  register(registrations: Hooks) {
    Object.assign(_registrations, registrations);
  },
};
