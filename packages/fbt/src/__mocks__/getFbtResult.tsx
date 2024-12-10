import type { FbtResolvedPayload } from '../FbtHooks.tsx';
import FbtResult from '../FbtResult.tsx';

export default function getFbtResult({
  contents,
}: FbtResolvedPayload): FbtResult {
  return (contents?.length === 1 && typeof contents[0] === 'string'
    ? contents[0]
    : contents) as unknown as FbtResult;
}
