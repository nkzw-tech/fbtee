import type { FbtResolvedPayload } from '../FbtHooks';
import FbtResult from '../FbtResult';

export default function getFbtResult(input: FbtResolvedPayload): FbtResult {
  const contents = input.contents;
  return (contents?.length === 1 && typeof contents[0] === 'string'
    ? contents[0]
    : contents) as unknown as FbtResult;
}
