import invariant from 'invariant';
import fbt, { createRuntime, Variations } from './fbt.tsx';
import FbtPureStringResult from './FbtPureStringResult.tsx';
import Hooks from './Hooks.tsx';
import type { RuntimeState } from './RuntimeState.tsx';
import type { FbtAPI } from './Types.ts';

export function createFbsRuntime(fbtRuntime = fbt, state?: RuntimeState) {
  return createRuntime({
    getResult: Hooks.getFbsResult,
    listRuntime: fbtRuntime as unknown as FbtAPI,
    param: (label, value?: string | FbtPureStringResult, variations?: Variations) => {
      if (value instanceof FbtPureStringResult) {
        value = String(value);
      }
      invariant(
        typeof value === 'string',
        'Expected fbs parameter value to be the result of fbs(), <fbs/>, or a string; ' +
          'instead we got `%s` (type: %s)',
        value,
        typeof value,
      );
      return fbtRuntime._param(label, value, variations);
    },
    plural: (count, label, value?: string | FbtPureStringResult) => {
      if (value instanceof FbtPureStringResult) {
        value = String(value);
      }
      invariant(
        value == null || typeof value === 'string',
        'Expected fbs plural UI value to be nullish or the result of fbs(), <fbs/>, or a string; ' +
          'instead we got `%s` (type: %s)',
        value,
        typeof value,
      );
      return fbtRuntime._plural(count, label, value);
    },
    state,
  });
}

export default createFbsRuntime();
