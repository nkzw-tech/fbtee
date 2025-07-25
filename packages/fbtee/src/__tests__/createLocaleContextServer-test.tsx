/*
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import createLocaleContext, {
  useLocaleContext,
} from '../createLocaleContext.tsx';
import fbtInternal from '../fbt.tsx';
import FbtResult from '../FbtResult.tsx';

const availableLanguages = new Map([
  ['en_US', 'English'],
  ['de_AT', 'German'],
]);

test('locale context does not crash on the server', async () => {
  const loadLocale = jest.fn(async (locale: string) => ({}));

  expect(() =>
    createLocaleContext({
      availableLanguages,
      clientLocales: ['en_US', 'de_AT'],
      fallbackLocale: 'en_US',
      loadLocale,
    }),
  ).not.toThrow();
});

test('returns an array or string instead of an `FbtResult`', () => {
  const loadLocale = jest.fn(async (locale: string) => ({}));

  // It does not crash on the server.
  createLocaleContext({
    availableLanguages,
    clientLocales: ['en_US', 'de_AT'],
    fallbackLocale: 'en_US',
    loadLocale,
  });

  expect(fbtInternal._('sample string') instanceof FbtResult).toBe(false);
  expect(fbtInternal._(['sample string', 'part 2'])).toEqual('sample string');
});

test('useLocaleContext does not crash on the server', () => {
  expect(useLocaleContext()).toMatchInlineSnapshot(`
{
  "gender": 3,
  "locale": "en_US",
  "localeChangeIsPending": false,
  "setGender": [Function],
  "setLocale": [Function],
}
`);
});
