import { describe, expect, it } from '@jest/globals';
import getFbtResult from '../__mocks__/getFbtResult.tsx';
import intlList, { Conjunctions, Delimiters } from '../intlList.tsx';
import IntlViewerContext from '../IntlViewerContext.tsx';
import setupFbtee from '../setupFbtee.tsx';

setupFbtee({
  hooks: {
    getFbtResult,
    getViewerContext: () => IntlViewerContext,
  },
  translations: { en_US: {} },
});

describe('intlList', () => {
  it('should handle an empty list', () => {
    expect(intlList([])).toBe('');
  });
  it('should handle a list full of null/undefined items', () => {
    expect(intlList([null, undefined])).toBe('');
  });
  it('should handle a single item', () => {
    expect(intlList(['first'])).toBe('first');
  });
  it('should handle two items', () => {
    expect(intlList(['first', 'second'])).toBe('first and second');
  });
  it('should handle three items', () => {
    expect(intlList(['first', 'second', 'third'])).toBe(
      'first, second and third',
    );
  });
  it('should handle a bunch of items', () => {
    const items = ['1', '2', '3', '4', '5', '6', '7', '8'];
    const result = intlList(items);
    expect(result).toBe('1, 2, 3, 4, 5, 6, 7 and 8');
  });
  it('should handle a bunch of items, some of which are null/undefined', () => {
    const items = ['1', '2', '3', '4', null, '5', undefined, '6', '7', '8'];
    const result = intlList(items);
    expect(result).toBe('1, 2, 3, 4, 5, 6, 7 and 8');
  });
  it('should handle no conjunction', () => {
    expect(intlList(['first', 'second', 'third'], Conjunctions.NONE)).toBe(
      'first, second, third',
    );
  });
  it('should handle optional delimiter', () => {
    expect(
      intlList(
        ['first', 'second', 'third'],
        Conjunctions.NONE,
        Delimiters.SEMICOLON,
      ),
    ).toBe('first; second; third');
  });
  it('should handle bullet delimiters', () => {
    expect(
      intlList(
        ['first', 'second', 'third'],
        Conjunctions.NONE,
        Delimiters.BULLET,
      ),
    ).toBe('first \u2022 second \u2022 third');
  });
});
