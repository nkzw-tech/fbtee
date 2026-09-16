/**
 * @jest-environment node
 */

import { expect, jest } from '@jest/globals';
import type { TranslationDictionary } from '../FbtTranslations.tsx';
import setupLocaleContext, { LocaleLoaderFn, TranslationPromise } from '../setupLocaleContext.tsx';

const availableLanguages = new Map([
  ['en_US', 'English'],
  ['de_AT', 'German'],
  ['fr_FR', 'French'],
]);

test('setLocale still starts loading immediately and selects the locale after loading', async () => {
  const deferred = Promise.withResolvers<Awaited<TranslationPromise>>();
  const loadLocale = jest.fn<LocaleLoaderFn>(() => deferred.promise);
  const context = setupLocaleContext({
    availableLanguages,
    clientLocales: ['en-US'],
    loadLocale,
  });

  expect(context.getLocale()).toBe('en_US');
  expect(loadLocale).not.toHaveBeenCalled();

  const change = context.setLocale('de-AT');
  expect(loadLocale).toHaveBeenCalledWith('de_AT');
  expect(context.getLocale()).toBe('en_US');

  deferred.resolve({ greeting: 'Hallo' });
  await expect(change).resolves.toBe('de_AT');
  expect(context.getLocale()).toBe('de_AT');
});

test('preloads and locale changes share a request across locale aliases', async () => {
  const deferred = Promise.withResolvers<Awaited<TranslationPromise>>();
  const loadLocale = jest.fn<LocaleLoaderFn>(() => deferred.promise);
  const translations: TranslationDictionary = {};
  const context = setupLocaleContext({
    availableLanguages,
    clientLocales: ['en-US'],
    loadLocale,
    translations,
  });

  const requests = [
    context.preloadLocale('de-AT'),
    context.preloadLocale('de_AT'),
    context.setLocale('de-AT'),
  ];
  await Promise.resolve();
  expect(loadLocale).toHaveBeenCalledTimes(1);
  expect(loadLocale).toHaveBeenCalledWith('de_AT');
  expect(context.getLocale()).toBe('en_US');
  expect(translations).toEqual({});

  deferred.resolve({ greeting: 'Hallo' });
  await Promise.all(requests);
  expect(context.getLocale()).toBe('de_AT');
  expect(translations).toEqual({ de_AT: { greeting: 'Hallo' } });

  await context.preloadLocale();
  expect(loadLocale).toHaveBeenCalledTimes(1);
});

test('an initial preload finishing after a locale change does not select its locale', async () => {
  const deferred = Promise.withResolvers<Awaited<TranslationPromise>>();
  const translations: TranslationDictionary = {};
  const context = setupLocaleContext({
    availableLanguages,
    clientLocales: ['de-AT'],
    loadLocale: async (locale) => (locale === 'de_AT' ? deferred.promise : { greeting: 'Bonjour' }),
    translations,
  });

  const initialLoad = context.preloadLocale();
  await context.setLocale('fr-FR');
  deferred.resolve({ greeting: 'Hallo' });
  await initialLoad;

  expect(context.getLocale()).toBe('fr_FR');
  expect(translations).toEqual({
    de_AT: { greeting: 'Hallo' },
    fr_FR: { greeting: 'Bonjour' },
  });
});

test('preloading another locale registers its translations without selecting it', async () => {
  const translations: TranslationDictionary = {};
  const context = setupLocaleContext({
    availableLanguages,
    clientLocales: ['en-US'],
    loadLocale: async () => ({ greeting: 'Hallo' }),
    translations,
  });

  await context.preloadLocale('de-AT');
  expect(context.getLocale()).toBe('en_US');
  expect(translations).toEqual({ de_AT: { greeting: 'Hallo' } });
});

test.each(['de_AT', 'de-AT'])(
  'supplied translations under %s need no initial load',
  async (locale) => {
    const loadLocale = jest.fn(async () => ({}));
    const context = setupLocaleContext({
      availableLanguages,
      clientLocales: ['de-AT'],
      loadLocale,
      translations: { [locale]: {} },
    });

    await context.preloadLocale();
    expect(context.getLocale()).toBe('de_AT');
    expect(loadLocale).not.toHaveBeenCalled();
  },
);

test('a supplied parent catalog does not block loading the regional catalog', async () => {
  const loadLocale = jest.fn<LocaleLoaderFn>(async () => ({ greeting: 'Servus' }));
  const translations = { de: { greeting: 'Hallo' } };
  const context = setupLocaleContext({
    availableLanguages,
    clientLocales: ['de-AT'],
    loadLocale,
    translations,
  });
  await context.preloadLocale();
  expect(loadLocale).toHaveBeenCalledWith('de_AT');
  expect(translations).toEqual({ de: { greeting: 'Hallo' }, de_AT: { greeting: 'Servus' } });
});

test('preloads exact, parent, and configured fallbacks once without loading unrelated locales', async () => {
  const loadLocale = jest.fn(async () => ({}));
  const context = setupLocaleContext({
    availableLanguages: new Map(
      ['en-US', 'fr-CA', 'fr', 'fr-FR', 'de'].map((locale) => [locale, locale]),
    ),
    clientLocales: ['fr-CA'],
    fallbackLocales: ['de'],
    loadLocale,
  });
  await Promise.all([context.preloadLocale(), context.setLocale('fr_CA')]);
  expect(loadLocale.mock.calls).toEqual([['fr-CA'], ['fr'], ['de']]);
  expect(context.getLocale()).toBe('fr-CA');
});

test('a failing parent load can be retried without reloading the regional catalog', async () => {
  const loadLocale = jest.fn<LocaleLoaderFn>(async (locale) => {
    if (locale === 'fr') {
      throw new Error('offline');
    }
    return { greeting: 'Allô' };
  });
  const context = setupLocaleContext({
    availableLanguages: new Map(['en-US', 'fr-CA', 'fr'].map((locale) => [locale, locale])),
    clientLocales: ['en-US'],
    loadLocale,
  });
  await expect(context.setLocale('fr-CA')).rejects.toThrow('offline');
  expect(context.getLocale()).toBe('en-US');
  loadLocale.mockResolvedValue({ greeting: 'Bonjour' });
  await context.setLocale('fr-CA');
  expect(loadLocale.mock.calls).toEqual([['fr-CA'], ['fr'], ['fr']]);
});

test('sourceLocale controls the default selection and does not require a catalog', async () => {
  const loadLocale = jest.fn(async () => ({}));
  const context = setupLocaleContext({
    availableLanguages,
    clientLocales: [],
    loadLocale,
    sourceLocale: 'de-AT',
  });
  await context.preloadLocale();
  expect(context.getLocale()).toBe('de_AT');
  expect(loadLocale).not.toHaveBeenCalled();
});

test('the generic source language does not require a catalog', async () => {
  const loadLocale = jest.fn<LocaleLoaderFn>(async () => ({}));
  const context = setupLocaleContext({
    availableLanguages: new Map([['en', 'English']]),
    clientLocales: ['en-US'],
    loadLocale,
  });
  await context.preloadLocale();
  expect(context.getLocale()).toBe('en');
  expect(loadLocale).not.toHaveBeenCalled();
});

test('the fallback locale and unsupported locales do not load', async () => {
  const loadLocale = jest.fn(async () => ({}));
  const context = setupLocaleContext({
    availableLanguages,
    clientLocales: ['en-US'],
    loadLocale,
  });

  await context.preloadLocale();
  await context.preloadLocale('en_US');
  await context.preloadLocale('unsupported');
  expect(context.getLocale()).toBe('en_US');
  expect(loadLocale).not.toHaveBeenCalled();
});

test.each(['throw', 'reject'])('a loader that fails with %s can be retried', async (failure) => {
  const error = new Error('Could not load translations');
  const loadLocale = jest.fn<() => TranslationPromise>().mockImplementationOnce(() => {
    if (failure === 'throw') {
      throw error;
    }
    return Promise.reject(error);
  });
  loadLocale.mockResolvedValue({ greeting: 'Hallo' });
  const translations: TranslationDictionary = {};
  const context = setupLocaleContext({
    availableLanguages,
    clientLocales: ['en-US'],
    loadLocale,
    translations,
  });

  await expect(
    Promise.all([context.preloadLocale('de-AT'), context.setLocale('de_AT')]),
  ).rejects.toBe(error);
  expect(context.getLocale()).toBe('en_US');
  expect(translations).toEqual({});
  expect(loadLocale).toHaveBeenCalledTimes(1);

  await context.preloadLocale('de-AT');
  expect(loadLocale).toHaveBeenCalledTimes(2);
  expect(context.getLocale()).toBe('en_US');
  expect(translations).toEqual({ de_AT: { greeting: 'Hallo' } });
});
