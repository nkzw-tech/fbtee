import { describe, expect, it } from '@jest/globals';
import getFbtResult from '../__mocks__/getFbtResult.tsx';
import { fbt } from '../index.tsx';
import list from '../list.tsx';
import setupFbtee from '../setupFbtee.tsx';
import IntlViewerContext from '../ViewerContext.tsx';

setupFbtee({
  hooks: {
    getFbtResult,
    getViewerContext: () => IntlViewerContext,
  },
  translations: { en_US: {} },
});

describe('list', () => {
  it('should handle an empty list', () => {
    expect(list([])).toBe('');
  });
  it('should handle a list full of null/undefined items', () => {
    expect(list([null, undefined])).toBe('');
  });
  it('should handle a single item', () => {
    expect(list(['first'])).toBe('first');
  });
  it('should handle two items', () => {
    expect(list(['first', 'second'])).toBe('first and second');
  });
  it('should handle three items', () => {
    expect(list(['first', 'second', 'third'])).toBe('first, second and third');
  });
  it('should handle a bunch of items', () => {
    expect(list(['1', '2', '3', '4', '5', '6', '7', '8'])).toBe(
      '1, 2, 3, 4, 5, 6, 7 and 8',
    );
  });
  it('should handle a bunch of items, some of which are null/undefined', () => {
    expect(
      list(['1', '2', '3', '4', null, '5', undefined, '6', '7', '8']),
    ).toBe('1, 2, 3, 4, 5, 6, 7 and 8');
  });
  it('should handle no conjunction', () => {
    expect(list(['first', 'second', 'third'], 'none')).toBe(
      'first, second, third',
    );
  });
  it('should handle optional delimiter', () => {
    expect(list(['first', 'second', 'third'], 'none', 'semicolon')).toBe(
      'first; second; third',
    );
  });
  it('should handle bullet delimiters', () => {
    expect(list(['first', 'second', 'third'], 'none', 'bullet')).toBe(
      'first \u2022 second \u2022 third',
    );
  });
});

test('fbt.list()', () => {
  expect(
    fbt(
      'Available Locations: ' +
        fbt.list('locations', ['Tokyo', 'London', 'Vienna']),
      'Lists',
    ),
  ).toMatchSnapshot();
});

test('<fbt:list>', () => {
  expect(
    <fbt desc="Lists">
      Available Locations:{' '}
      <fbt:list items={['Tokyo', 'London', 'Vienna']} name="locations" />.
    </fbt>,
  ).toMatchSnapshot();
});
