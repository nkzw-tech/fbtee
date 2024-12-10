import type { PatternHash, PatternString } from 'babel-plugin-fbt';
import invariant from 'invariant';
import fbt from './fbt';
import FbtHooks, { ExtraOptionValues } from './FbtHooks';
import FbtPureStringResult from './FbtPureStringResult';
import type { ParamVariationType } from './FbtRuntimeTypes';
import type { FbtTableArg } from './FbtTableAccessor';
import type GenderConstEnum from './GenderConst';
import { $FbsParamInput, Fbs, Fbt, NestedFbtContentItems } from './Types';

const cachedFbsResults: Partial<Record<PatternString, Fbt>> = {};

const FbsImpl = {
  ...fbt,

  _param(
    label: string,
    value: $FbsParamInput,
    variations?:
      | [ParamVariationType['number'], number | null | undefined]
      | [ParamVariationType['gender'], GenderConstEnum]
  ): FbtTableArg {
    invariant(
      typeof value === 'string' || value instanceof FbtPureStringResult,
      'Expected fbs parameter value to be the result of fbs(), <fbs/>, or a string; ' +
        'instead we got `%s` (type: %s)',
      value,
      typeof value
    );
    return fbt._param(label, value, variations);
  },

  _plural(count: number, label?: string | null, value?: unknown): FbtTableArg {
    invariant(
      value == null ||
        typeof value === 'string' ||
        value instanceof FbtPureStringResult,
      'Expected fbs plural UI value to be nullish or the result of fbs(), <fbs/>, or a string; ' +
        'instead we got `%s` (type: %s)',
      value,
      typeof value
    );
    return fbt._plural(count, label, value);
  },

  _wrapContent(
    fbtContent: NestedFbtContentItems | string,
    translation: PatternString,
    hash?: PatternHash | null,
    extraOptions?: ExtraOptionValues | null
  ): Fbs {
    const contents = typeof fbtContent === 'string' ? [fbtContent] : fbtContent;
    const errorListener = FbtHooks.getErrorListener({ hash, translation });
    return FbtHooks.getFbsResult({
      contents,
      errorListener,
      extraOptions,
      patternHash: hash,
      patternString: translation,
    });
  },
  cachedResults: cachedFbsResults,
} as const;

export default FbsImpl;
