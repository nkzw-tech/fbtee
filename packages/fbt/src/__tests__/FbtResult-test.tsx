import { describe, expect, it, jest } from '@jest/globals';
import nullthrows from 'babel-plugin-fbt/src/nullthrows.tsx';
import FbtHooks from '../FbtHooks.tsx';
import FbtResult from '../FbtResult.tsx';
import { IFbtErrorListener } from '../Types.tsx';

let _errorListener: IFbtErrorListener | null | undefined;

describe('FbtResult', () => {
  beforeEach(() => {
    FbtHooks.register({
      errorListener: () => ({
        onMissingParameterError: jest.fn(),
        onStringSerializationError: jest.fn(),
      }),
    });

    _errorListener = FbtHooks.getErrorListener({
      hash: 'h',
      translation: 't',
    });
  });

  it('can be flattened into array', () => {
    const errorListener = nullthrows(_errorListener);
    let obj1 = new FbtResult(['prefix'], errorListener);
    const obj2 = new FbtResult(['suffix'], errorListener);
    let obj3 = new FbtResult([obj1, 'content', obj2], errorListener);
    expect(obj3.flattenToArray().join(' ')).toBe('prefix content suffix');

    obj1 = new FbtResult(['prefix'], errorListener);
    obj3 = new FbtResult([obj1, 'content', 'stringable'], errorListener);
    expect(obj3.flattenToArray().join(' ')).toBe('prefix content stringable');
  });

  it('does not invoke onStringSerializationError() when being serialized with valid-FBT contents', () => {
    const errorListener = nullthrows(_errorListener);
    const result = new FbtResult(
      ['hello', new FbtResult(['world'], errorListener)],
      errorListener
    );
    result.toString();
    expect(errorListener?.onStringSerializationError).not.toHaveBeenCalled();
  });
});
