import type { FbtTableKey, PatternHash, PatternString } from 'babel-plugin-fbt';
import FbtResult from './FbtResult.tsx';
import type { FbtTableArg } from './FbtTableAccessor.tsx';
import IntlViewerContext from './IntlViewerContext.tsx';
import {
  FbtErrorContext,
  FbtPureStringResult,
  IFbtErrorListener,
  NestedFbtContentItems,
} from './Types.tsx';

export type FbtResolvedPayload = {
  contents: NestedFbtContentItems;
  errorListener: IFbtErrorListener | null | undefined;
  patternHash: PatternHash | null | undefined;
  patternString: PatternString;
};

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
  args: FbtTableArgs | null | undefined;
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
  args: FbtTableArgs | null | undefined;
  options: FbtInputOpts | null | undefined;
  table: FbtRuntimeInput;
};
export type FbtImpressionOptions = {
  inputTable: FbtRuntimeInput;
  tokens: Array<FbtTableKey>;
};

export type FbtHookRegistrations = Partial<{
  errorListener: (
    context: FbtErrorContext
  ) => IFbtErrorListener | null | undefined;
  getFbsResult: (input: FbtResolvedPayload) => FbtPureStringResult;
  getFbtResult: (input: FbtResolvedPayload) => FbtResult;
  getTranslatedInput: (
    input: FbtRuntimeCallInput
  ) => FbtTranslatedInput | null | undefined | null | undefined;
  getViewerContext: () => typeof IntlViewerContext;
  logImpression: (
    hash: string,
    options?: FbtImpressionOptions
  ) => void | null | undefined;
  onTranslationOverride: (hash: string) => void | null | undefined;
}>;

const _registrations: FbtHookRegistrations = {};

export default {
  getErrorListener(
    context: FbtErrorContext
  ): IFbtErrorListener | null | undefined {
    return _registrations.errorListener?.(context);
  },

  getFbsResult(input: FbtResolvedPayload): FbtPureStringResult {
    const { getFbsResult } = _registrations;
    if (!getFbsResult) {
      throw new Error(`FbtHooks: 'getFbsResult' is not registered`);
    }
    return getFbsResult(input);
  },

  getFbtResult(input: FbtResolvedPayload): FbtResult {
    const { getFbtResult } = _registrations;
    if (!getFbtResult) {
      throw new Error(`FbtHooks: 'getFbtResult' is not registered`);
    }
    return getFbtResult(input);
  },

  getTranslatedInput(input: FbtRuntimeCallInput): FbtTranslatedInput {
    return _registrations.getTranslatedInput?.(input) ?? input;
  },

  getViewerContext(): typeof IntlViewerContext {
    const { getViewerContext } = _registrations;
    if (!getViewerContext) {
      throw new Error(`FbtHooks: 'getViewerContext' is not registered`);
    }
    return getViewerContext();
  },

  logImpression(hash: string, options?: FbtImpressionOptions): undefined {
    _registrations.logImpression?.(hash, options);
  },

  onTranslationOverride(hash: string): undefined {
    _registrations.onTranslationOverride?.(hash);
  },

  register(registrations: FbtHookRegistrations): undefined {
    Object.assign(_registrations, registrations);
  },
};
