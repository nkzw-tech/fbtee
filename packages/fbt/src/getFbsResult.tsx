import type { FbtResolvedPayload } from './FbtHooks.tsx';
import FbtPureStringResult from './FbtPureStringResult.tsx';

export default function getFbsResult({
  contents,
  errorListener,
  hashKey,
}: FbtResolvedPayload): FbtPureStringResult {
  return new FbtPureStringResult(contents, errorListener, hashKey);
}
