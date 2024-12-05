import nullthrows from 'nullthrows';
import FbtHooks from '../FbtHooks';
import FbtResult from '../FbtResult';
import { IFbtErrorListener } from '../Types';

let _errorListener: IFbtErrorListener | null | undefined;

describe('FbtResult', function () {
  beforeEach(() => {
    FbtHooks.register({
      errorListener: () => ({
        onStringSerializationError: jest.fn(),
        onMissingParameterError: jest.fn(),
      }),
    });

    _errorListener = FbtHooks.getErrorListener({
      hash: 'h',
      translation: 't',
    });
  });

  it('can be flattened into array', function () {
    const errorListener = nullthrows(_errorListener);
    let obj1 = new FbtResult(['prefix'], errorListener);
    const obj2 = new FbtResult(['suffix'], errorListener);
    let obj3 = new FbtResult([obj1, 'content', obj2], errorListener);
    expect(
      // flow doesn't think FbtResult.flattenToArray exists because of
      // our egregious lies spat out in module.exports of FbtResultBase.js
      // $FlowFixMe[prop-missing] flattenToArray
      obj3.flattenToArray().join(' ')
    ).toBe('prefix content suffix');

    obj1 = new FbtResult(['prefix'], errorListener);

    obj3 = new FbtResult([obj1, 'content', 'stringable'], errorListener);
    expect(
      // flow doesn't think FbtResult.flattenToArray exists because of
      // our egregious lies spat out in module.exports of FbtResultBase.js
      // $FlowFixMe[prop-missing] flattenToArray
      obj3.flattenToArray().join(' ')
    ).toBe('prefix content stringable');
  });

  it('does not invoke onStringSerializationError() when being serialized with valid-FBT contents', function () {
    const errorListener = nullthrows(_errorListener);
    const result = new FbtResult(
      ['hello', new FbtResult(['world'], errorListener)],
      errorListener
    );
    result.toString();
    expect(errorListener?.onStringSerializationError).not.toHaveBeenCalled();
  });
});
