import type { PatternHash } from './CompilerTypes.ts';
import type { IFbtErrorListener, NestedFbtContentItems } from './Types.ts';

export default function getFbsResult(
  contents: NestedFbtContentItems,
  hashKey: PatternHash | null | undefined,
  errorListener: IFbtErrorListener | null,
): string {
  if (contents.length === 1 && typeof contents[0] === 'string') {
    return contents[0];
  }
  let result = '';
  for (const content of contents) {
    if (typeof content === 'string') {
      result += content;
    } else if (Array.isArray(content)) {
      result += getFbsResult(content, hashKey, errorListener);
    } else {
      errorListener?.onStringSerializationError?.(content);
    }
  }
  return result;
}
