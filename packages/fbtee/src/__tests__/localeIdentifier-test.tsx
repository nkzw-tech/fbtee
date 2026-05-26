import { describe, expect, it } from '@jest/globals';
import {
  formatLocaleForStyle,
  getLocaleAliases,
  getLocaleIdentity,
  getLocaleLanguage,
} from '../localeIdentifier.tsx';

describe('localeIdentifier', () => {
  it('canonicalizes legacy and BCP 47 locale identifiers to the same identity', () => {
    expect(getLocaleIdentity('de_DE')).toBe('de-DE');
    expect(getLocaleIdentity('de-DE')).toBe('de-DE');
    expect(getLocaleIdentity('es_LA')).toBe('es-419');
    expect(getLocaleIdentity('es-419')).toBe('es-419');
    expect(getLocaleIdentity('en_us')).toBe('en-US');
    expect(getLocaleIdentity('bp_IN')).toBe('bho-IN');
    expect(getLocaleIdentity('iw-IL')).toBe('he-IL');
  });

  it('keeps fbtee pseudo-locales aliasable', () => {
    expect(getLocaleIdentity('fb_HX')).toBe('fb-HX');
    expect(getLocaleIdentity('fb-HX')).toBe('fb-HX');
    expect(getLocaleLanguage('fb_HX')).toBe('en');
  });

  it('extracts languages from legacy and BCP 47 identifiers', () => {
    expect(getLocaleLanguage('ru_RU')).toBe('ru');
    expect(getLocaleLanguage('ru-RU')).toBe('ru');
    expect(getLocaleLanguage('es-419')).toBe('es');
    expect(getLocaleLanguage('zh-Hant-TW')).toBe('zh');
  });

  it('formats locale identifiers for output styles', () => {
    expect(formatLocaleForStyle('de_DE', 'bcp47')).toBe('de-DE');
    expect(formatLocaleForStyle('de-DE', 'legacy')).toBe('de_DE');
    expect(formatLocaleForStyle('es_LA', 'bcp47')).toBe('es-419');
    expect(formatLocaleForStyle('es-419', 'legacy')).toBe('es_LA');
    expect(formatLocaleForStyle('ar', 'legacy')).toBe('ar_AR');
    expect(formatLocaleForStyle('bho-IN', 'legacy')).toBe('bp_IN');
    expect(formatLocaleForStyle('fil-PH', 'legacy')).toBe('tl_PH');
    expect(formatLocaleForStyle('zh-Hant-TW', 'legacy')).toBe('zh_TW');
  });

  it('returns lookup aliases in compatibility order', () => {
    expect(getLocaleAliases('de-DE')).toEqual(['de-DE', 'de_DE', 'de']);
    expect(getLocaleAliases('es_LA')).toEqual(['es_LA', 'es-419', 'es']);
    expect(getLocaleAliases('fb_HX')).toEqual(['fb_HX', 'fb-HX', 'fb']);
    expect(getLocaleAliases('ar')).toEqual(['ar', 'ar_AR', 'fb_AR']);
    expect(getLocaleAliases('bho-IN')).toEqual(['bho-IN', 'bp_IN', 'bho']);
    expect(getLocaleAliases('fil-PH')).toEqual(['fil-PH', 'tl_PH', 'fil']);
  });
});
