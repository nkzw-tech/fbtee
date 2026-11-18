import invariant from 'invariant';
import fbt, { createRuntime, Variations } from './fbt.tsx';
import Hooks from './Hooks.tsx';
import type { RuntimeState } from './RuntimeState.tsx';
import type { FbsAPI } from './Types.ts';

export function createFbsRuntime(fbtRuntime = fbt, state?: RuntimeState) {
  const runtime = createRuntime({
    getResult: Hooks.getFbsResult,
    listRuntime: fbtRuntime,
    param: (label, value?: string | number, variations?: Variations) => {
      invariant(
        typeof value === 'string' || typeof value === 'number',
        'Expected fbs parameter value to be the result of fbs(), <fbs/>, or a string or number; ' +
          'instead we got `%s` (type: %s)',
        value,
        typeof value,
      );
      return fbtRuntime._param(label, value, variations);
    },
    plural: (count, label, value?: string | number) => {
      invariant(
        value == null || typeof value === 'string' || typeof value === 'number',
        'Expected fbs plural UI value to be nullish or the result of fbs(), <fbs/>, or a string or number; ' +
          'instead we got `%s` (type: %s)',
        value,
        typeof value,
      );
      return fbtRuntime._plural(count, label, value);
    },
    state,
  });
  // The compiler replaces the public source syntax with the runtime methods above.
  return runtime as typeof runtime & FbsAPI;
}

export default createFbsRuntime();
