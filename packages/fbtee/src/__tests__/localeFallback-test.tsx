import { describe, expect, it, jest } from '@jest/globals';
import { createFbtRuntime } from '../fbt.tsx';
import { getTranslatedInput, mergeTranslations } from '../FbtTranslations.tsx';
import type { FbtRuntimeInput } from '../Hooks.tsx';
import { getAvailableLocaleChain, negotiateLocale } from '../localeFallback.tsx';
import { createRuntimeState } from '../RuntimeState.tsx';
import { setupRuntime } from '../setupFbtee.tsx';

describe('locale negotiation', () => {
  it.each([
    ['fr-CA', ['fr', 'fr-CA', 'fr-FR'], 'fr-CA'],
    ['fr-BE', ['fr-FR', 'fr'], 'fr'],
    ['fr', ['fr-CA', 'fr-FR'], 'fr-FR'],
    ['fr', ['fr-FR', 'fr-CA'], 'fr-FR'],
    ['de-AT', ['de_AT'], 'de_AT'],
    ['iw-IL', ['he-IL'], 'he-IL'],
    ['en-US-u-nu-arab', ['en-US', 'en-GB'], 'en-US'],
    ['zh-TW', ['zh', 'zh-Hant'], 'zh-Hant'],
    ['zh-Hant-HK', ['zh', 'zh-TW'], 'zh-TW'],
    ['zh-Hant', ['zh-Hans', 'zh-CN'], null],
    ['sr-Latn', ['sr-Cyrl', 'sr'], null],
    ['invalid_locale', ['en-US'], null],
    ['fb_HX', ['fb-HX'], 'fb-HX'],
  ])('matches %s against %j', (locale, available, expected) => {
    expect(negotiateLocale(locale, available)).toBe(expected);
  });

  it('never lets a generic locale overwrite an exact match through a shared alias', () => {
    expect(negotiateLocale('fr', ['fr', 'fr-CA'])).toBe('fr');
    expect(negotiateLocale('fr', ['fr-CA', 'fr'])).toBe('fr');
  });

  it('preserves script parents and recognizes implied scripts', () => {
    expect(getAvailableLocaleChain('zh-Hant-TW', ['zh', 'zh-Hant', 'zh_TW', 'en-US'])).toEqual([
      'zh_TW',
      'zh-Hant',
      'en-US',
    ]);
    expect(getAvailableLocaleChain('sr-Latn-RS', ['sr', 'sr-Latn', 'en-US'])).toEqual([
      'sr-Latn',
      'en-US',
    ]);
  });

  it('supports cyclic mappings, legacy spellings, and defaults without duplicate catalogs', () => {
    expect(
      getAvailableLocaleChain('fr-CA', ['fr_CA', 'fr', 'de', 'en-US'], {
        fallbackLocales: { de: ['fr-CA'], default: ['de'], fr_CA: ['de'] },
      }),
    ).toEqual(['fr_CA', 'fr', 'de', 'en-US']);
  });
});

describe('per-message fallback', () => {
  const input = (hashKey: string) => ({ args: null, options: { hk: hashKey }, table: 'Source' });

  it('checks each message independently, preserving empty translations and arguments', () => {
    const state = createRuntimeState({ GENDER: 3, locale: 'fr-CA' }, true);
    setupRuntime(state, {
      translations: {
        'en-US': { source: 'English catalog' },
        fr: { empty: 'Nonempty', greeting: 'Bonjour', regional: 'Parent' },
        'fr-CA': { empty: '', regional: 'Allô' },
      },
    });
    expect(getTranslatedInput(input('regional'), state)?.table).toBe('Allô');
    expect(getTranslatedInput(input('greeting'), state)?.table).toBe('Bonjour');
    expect(getTranslatedInput(input('empty'), state)?.table).toBe('');
    expect(getTranslatedInput(input('source'), state)?.table).toBe('English catalog');
    expect(getTranslatedInput(input('missing'), state)).toBeNull();
  });

  it('only uses another regional catalog when explicitly configured', () => {
    const state = createRuntimeState({ GENDER: 3, locale: 'fr-CA' }, true);
    const translations = { 'fr-FR': { greeting: 'Bonjour' } };
    setupRuntime(state, { translations });
    expect(getTranslatedInput(input('greeting'), state)).toBeNull();
    setupRuntime(state, { fallbackLocales: { fr_CA: ['fr-FR'] }, translations });
    expect(getTranslatedInput(input('greeting'), state)?.table).toBe('Bonjour');
  });

  it('reports exhausted fallbacks once, ignores source messages, and resets after merging', () => {
    const onMissingTranslation = jest.fn();
    const state = createRuntimeState({ GENDER: 3, locale: 'fr-CA' }, true);
    setupRuntime(state, { onMissingTranslation, translations: { fr: { greeting: 'Bonjour' } } });
    getTranslatedInput(input('greeting'), state);
    getTranslatedInput({ ...input('missing'), options: null }, state);
    expect(onMissingTranslation).not.toHaveBeenCalled();
    getTranslatedInput(input('missing'), state);
    getTranslatedInput(input('missing'), state);
    expect(onMissingTranslation).toHaveBeenCalledTimes(1);
    expect(onMissingTranslation).toHaveBeenCalledWith({
      hashKey: 'missing',
      locale: 'fr-CA',
      sourceLocale: 'en-US',
    });
    mergeTranslations(state, { 'fr-CA': { missing: 'Trouvé' } });
    expect(getTranslatedInput(input('missing'), state)?.table).toBe('Trouvé');
    getTranslatedInput(input('another'), state);
    expect(onMissingTranslation).toHaveBeenCalledTimes(2);
    state.viewerContext.locale = 'en-US';
    getTranslatedInput(input('missing-source'), state);
    expect(onMissingTranslation).toHaveBeenCalledTimes(2);
  });

  it('uses a custom source locale and clears options when reinitialized', () => {
    const onMissingTranslation = jest.fn();
    const state = createRuntimeState({ GENDER: 3, locale: 'de-DE' }, true);
    setupRuntime(state, { onMissingTranslation, sourceLocale: 'de-DE', translations: {} });
    getTranslatedInput(input('missing'), state);
    expect(onMissingTranslation).not.toHaveBeenCalled();
    setupRuntime(state, { translations: {} });
    getTranslatedInput(input('missing'), state);
    expect(onMissingTranslation).not.toHaveBeenCalled();
  });

  it.each([false, true])('selects plural rules from the supplying catalog (param: %s)', (param) => {
    const state = createRuntimeState({ GENDER: 3, locale: 'ja-JP' }, true);
    setupRuntime(state, {
      fallbackLocales: ['fr'],
      translations: { fr: { count: { '*': 'plusieurs {n}', '4': 'un {n}' } } },
    });
    const fbt = createFbtRuntime(state);
    const arg = param ? fbt._param('n', 0, [0]) : fbt._plural(0, 'n');
    const originalVariation = arg[0];
    expect(String(fbt._('source {n}', [arg], { hk: 'count' }))).toBe('un 0');
    expect(arg[0]).toBe(originalVariation);
  });

  it('uses source plural rules after exhausting translations', () => {
    const state = createRuntimeState({ GENDER: 3, locale: 'fr-CA' }, true);
    setupRuntime(state, { translations: {} });
    const fbt = createFbtRuntime(state);
    const source: FbtRuntimeInput = { '*': '{n} messages', '4': '{n} message' };
    expect(String(fbt._(source, [fbt._plural(0, 'n')], { hk: 'count' }))).toBe('0 messages');
  });

  it('invalidates cached locale chains when a new parent is merged', () => {
    const state = createRuntimeState({ GENDER: 3, locale: 'fr-CA' }, true);
    setupRuntime(state, { translations: {} });
    expect(getTranslatedInput(input('greeting'), state)).toBeNull();
    mergeTranslations(state, { fr: { greeting: 'Bonjour' } });
    expect(getTranslatedInput(input('greeting'), state)?.table).toBe('Bonjour');
  });
});
