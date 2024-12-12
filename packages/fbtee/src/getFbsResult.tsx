import { PatternHash } from '@nkzw/babel-plugin-fbtee';
import FbtPureStringResult from './FbtPureStringResult.tsx';
import type { IFbtErrorListener, NestedFbtContentItems } from './Types.d.ts';

export default function getFbsResult(
  contents: NestedFbtContentItems,
  hashKey: PatternHash | null | undefined,
  errorListener: IFbtErrorListener | null,
): FbtPureStringResult {
  return new FbtPureStringResult(contents, errorListener, hashKey);
}
