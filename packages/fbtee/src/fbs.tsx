import invariant from 'invariant';
import { createRuntime, fbtParam, fbtPlural, Variations } from './fbt.tsx';
import FbtPureStringResult from './FbtPureStringResult.tsx';
import Hooks from './Hooks.tsx';

export function fbsParam(
  label: string,
  value?: string | FbtPureStringResult,
  variations?: Variations,
) {
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
  return fbtParam(label, value, variations);
}

export function fbsPlural(
  count: number,
  label?: string | null,
  value?: string | FbtPureStringResult,
) {
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
  return fbtPlural(count, label, value);
}

export default createRuntime({
  getResult: Hooks.getFbsResult,
  param: fbsParam,
  plural: fbsPlural,
});
