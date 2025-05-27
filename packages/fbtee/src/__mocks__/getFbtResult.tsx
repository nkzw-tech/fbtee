import type FbtResult from '../FbtResult.tsx';
import type { NestedFbtContentItems } from '../Types.ts';

export default function getFbtResult(
  contents: NestedFbtContentItems,
): FbtResult {
  return (contents?.length === 1 && typeof contents[0] === 'string'
    ? contents[0]
    : contents) as unknown as FbtResult;
}
