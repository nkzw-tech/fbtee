import type { FbtResolvedPayload } from './FbtHooks.tsx';
import FbtPureStringResult from './FbtPureStringResult.tsx';

export default function getFbsResult(
  input: FbtResolvedPayload
): FbtPureStringResult {
  return new FbtPureStringResult(input.contents, input.errorListener);
}
