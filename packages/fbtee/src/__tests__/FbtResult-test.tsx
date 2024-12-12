import { describe, expect, it, jest } from '@jest/globals';
import FbtResult from '../FbtResult.tsx';
import Hooks from '../Hooks.tsx';
import type { IFbtErrorListener } from '../Types.d.ts';

let errorListener: IFbtErrorListener | null;

describe('FbtResult', () => {
  beforeEach(() => {
    Hooks.register({
      errorListener: () => ({
        onStringSerializationError: jest.fn(),
      }),
    });

    errorListener = Hooks.getErrorListener({
      hash: 'h',
      translation: 't',
    });
  });

  it('can be flattened into array', () => {
    let obj1 = new FbtResult(['prefix'], errorListener, null);
    const obj2 = new FbtResult(['suffix'], errorListener, null);
    let obj3 = new FbtResult([obj1, 'content', obj2], errorListener, null);
    expect(obj3.flattenToArray().join(' ')).toBe('prefix content suffix');

    obj1 = new FbtResult(['prefix'], errorListener, null);
    obj3 = new FbtResult([obj1, 'content', 'stringable'], errorListener, null);
    expect(obj3.flattenToArray().join(' ')).toBe('prefix content stringable');
  });

  it('does not invoke onStringSerializationError() when being serialized with valid-FBT contents', () => {
    const result = new FbtResult(
      ['hello', new FbtResult(['world'], errorListener, null)],
      errorListener,
      null,
    );
    result.toString();
    expect(errorListener?.onStringSerializationError).not.toHaveBeenCalled();
  });
});
