import { Fragment } from 'react';
import type { PatternHash } from './CompilerTypes.ts';
import type { FbtResult, NestedFbtContentItems } from './Types.ts';

export default function getFbtResult(
  contents: NestedFbtContentItems,
  hashKey?: PatternHash | null,
): FbtResult {
  return contents.length === 1 && typeof contents[0] === 'string' ? (
    contents[0]
  ) : (
    <Fragment key={hashKey}>{contents}</Fragment>
  );
}
