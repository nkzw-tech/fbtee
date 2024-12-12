import invariant from 'invariant';
import fbt, { createRuntime, Variations } from './fbt.tsx';
import FbtPureStringResult from './FbtPureStringResult.tsx';
import Hooks from './Hooks.tsx';

export default createRuntime({
  getResult: Hooks.getFbsResult,
  param: (
    label,
    value?: string | FbtPureStringResult,
    variations?: Variations,
  ) => {
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
    return fbt._param(label, value, variations);
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
    return fbt._plural(count, label, value);
  },
});
