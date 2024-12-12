import FbtResult from '../FbtResult.tsx';
import { NestedFbtContentItems } from '../Types.tsx';

export default function getFbtResult(
  contents: NestedFbtContentItems
): FbtResult {
  return (contents?.length === 1 && typeof contents[0] === 'string'
    ? contents[0]
    : contents) as unknown as FbtResult;
}
