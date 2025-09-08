import { PatternHash } from '@nkzw/babel-plugin-fbtee';
import FbtPureStringResult from './FbtPureStringResult.tsx';
import type { IFbtErrorListener, NestedFbtContentItems } from './Types.ts';

export default function getFbsResult(
  contents: NestedFbtContentItems,
  hashKey: PatternHash | null | undefined,
  errorListener: IFbtErrorListener | null,
) {
  return String(new FbtPureStringResult(contents, errorListener, hashKey));
}
