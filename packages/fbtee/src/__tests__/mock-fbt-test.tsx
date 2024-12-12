import { describe, expect, it } from '@jest/globals';
import getFbtResult from '../__mocks__/getFbtResult.tsx';
import { fbt } from '../index.tsx';
import IntlViewerContext from '../IntlViewerContext.tsx';
import setupFbtee from '../setupFbtee.tsx';

setupFbtee({
  hooks: {
    getFbtResult,
    getViewerContext: () => IntlViewerContext,
  },
  translations: { en_US: {} },
});

// Note that running the typechecker in jst turns on fbt preprocessing so we
// have two almost identical test files: typechecked and not typechecked.
describe('mock fbt (no typechecks)', () => {
  it('should handle simple declarative strings', () => {
    expect(<fbt desc="description">some text</fbt>).toEqual('some text');
  });

  it("should handle <fbt> with embedded <fbt:param>'s", () => {
    const sample = (
      <fbt desc="description">
        {'Hello '}
        <fbt:param name="name">{'bubba'}</fbt:param>
      </fbt>
    );
    expect(sample).toEqual('Hello bubba');
  });

  it('should handle trivial strings', () => {
    expect(fbt('some text', 'description')).toEqual('some text');
  });

  it('should munge together fbt.param calls', () => {
    expect(fbt('Hello ' + fbt.param('name', 'bubba'), 'description')).toEqual(
      'Hello bubba',
    );
  });

  it('should work with enums', () => {
    expect(fbt('bar ' + fbt.enum('a', ['a', 'b']), 'd')).toEqual('bar a');
  });

  it('should work with enums/plurals/params mixed', () => {
    expect(
      fbt(
        'bar ' +
          fbt.enum('a', ['a', 'b']) +
          ' ' +
          fbt.plural('a thing', 3, { many: 'things', showCount: 'ifMany' }) +
          ' more plain text ' +
          fbt.param('baz', 'w00t') +
          ' ' +
          fbt.param('baz2', 'w00t2') +
          ' ' +
          fbt.enum('b', ['a', 'b']) +
          '. The end.',
        'd',
      ),
    ).toEqual('bar a 3 things more plain text w00t w00t2 b. The end.');
  });
});
