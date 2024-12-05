import type { FbtResolvedPayload } from './FbtHooks';
import FbtPureStringResult from './FbtPureStringResult';

export default function getFbsResult(
  input: FbtResolvedPayload
): FbtPureStringResult {
  return new FbtPureStringResult(input.contents, input.errorListener);
}
