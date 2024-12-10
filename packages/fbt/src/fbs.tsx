import type { PatternHash, PatternString } from 'babel-plugin-fbt';
import invariant from 'invariant';
import fbt from './fbt.tsx';
import FbtHooks from './FbtHooks.tsx';
import FbtPureStringResult from './FbtPureStringResult.tsx';
import type { ParamVariationType } from './FbtRuntimeTypes.tsx';
import type { FbtTableArg } from './FbtTableAccessor.tsx';
import type GenderConst from './GenderConst.tsx';
import { $FbsParamInput, Fbs, Fbt, NestedFbtContentItems } from './Types.tsx';

const cachedFbsResults: Partial<Record<PatternString, Fbt>> = {};

const FbsImpl = {
  ...fbt,

  _param(
    label: string,
    value: $FbsParamInput,
    variations?:
      | [ParamVariationType['number'], number | null | undefined]
      | [ParamVariationType['gender'], GenderConst]
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
    hash?: PatternHash | null
  ): Fbs {
    const contents = typeof fbtContent === 'string' ? [fbtContent] : fbtContent;
    const errorListener = FbtHooks.getErrorListener({ hash, translation });
    return FbtHooks.getFbsResult({
      contents,
      errorListener,
      patternHash: hash,
      patternString: translation,
    });
  },
  cachedResults: cachedFbsResults,
} as const;

export default FbsImpl;
