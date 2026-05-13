/* eslint-disable perfectionist/sort-objects */
import { describe, expect, it } from '@jest/globals';
import type { HashToLeaf } from '../FbtCollector.tsx';
import { updateTranslations } from '../prepareTranslationsUtils.tsx';
import type { Translations } from '../translateUtils.tsx';

const phrase = (desc: string, text: string) => ({ desc, text });

const existingEntry = (translation: string, description = 'desc') => ({
  description,
  status: 'translated',
  tokens: [],
  translations: [{ translation, variations: {} }],
  types: [],
});

describe('updateTranslations', () => {
  describe('without sortByHash (default)', () => {
    it('preserves pre-existing order and appends new hashes at the end', () => {
      const phrases: HashToLeaf = {
        zzz: phrase('z desc', 'z text'),
        aaa: phrase('a desc', 'a text'),
        mmm: phrase('m desc', 'm text'),
        newOne: phrase('new desc', 'new text'),
      };
      const translations: Translations = {
        zzz: existingEntry('Z translated'),
        aaa: existingEntry('A translated'),
        mmm: existingEntry('M translated'),
      };

      const result = updateTranslations(phrases, translations);

      expect(Object.keys(result)).toEqual(['zzz', 'aaa', 'mmm', 'newOne']);
      expect(result.zzz?.translations[0].translation).toBe('Z translated');
      expect(result.newOne?.status).toBe('new');
    });
  });

  describe('with sortByHash=true', () => {
    it('sorts pre-existing entries by hash and preserves translation values', () => {
      const phrases: HashToLeaf = {
        zzz: phrase('z desc', 'z text'),
        aaa: phrase('a desc', 'a text'),
        mmm: phrase('m desc', 'm text'),
      };
      const translations: Translations = {
        zzz: existingEntry('Z translated'),
        aaa: existingEntry('A translated'),
        mmm: existingEntry('M translated'),
      };

      const result = updateTranslations(phrases, translations, true);

      expect(Object.keys(result)).toEqual(['aaa', 'mmm', 'zzz']);
      expect(result.aaa?.translations[0].translation).toBe('A translated');
      expect(result.mmm?.translations[0].translation).toBe('M translated');
      expect(result.zzz?.translations[0].translation).toBe('Z translated');
    });

    it('sorts mixed existing + new entries and drops removed ones', () => {
      const phrases: HashToLeaf = {
        keep2: phrase('keep2 desc', 'keep2 text'),
        new1: phrase('new1 desc', 'new1 text'),
        keep1: phrase('keep1 desc', 'keep1 text'),
        new2: phrase('new2 desc', 'new2 text'),
      };
      const translations: Translations = {
        keep1: existingEntry('keep1 translated'),
        remove1: existingEntry('remove1 translated'),
        keep2: existingEntry('keep2 translated'),
      };

      const result = updateTranslations(phrases, translations, true);

      expect(Object.keys(result)).toEqual(['keep1', 'keep2', 'new1', 'new2']);
      expect(result.remove1).toBeUndefined();
      expect(result.keep1?.translations[0].translation).toBe(
        'keep1 translated',
      );
      expect(result.keep2?.translations[0].translation).toBe(
        'keep2 translated',
      );
      expect(result.new1?.status).toBe('new');
      expect(result.new1?.translations[0].translation).toBe('new1 text');
      expect(result.new2?.status).toBe('new');
    });

    it('sorts when there are no pre-existing translations', () => {
      const phrases: HashToLeaf = {
        zzz: phrase('z desc', 'z text'),
        aaa: phrase('a desc', 'a text'),
        mmm: phrase('m desc', 'm text'),
      };

      const result = updateTranslations(phrases, {}, true);

      expect(Object.keys(result)).toEqual(['aaa', 'mmm', 'zzz']);
    });

    it('returns an empty object when all pre-existing entries are removed', () => {
      const translations: Translations = {
        gone1: existingEntry('gone1 translated'),
        gone2: existingEntry('gone2 translated'),
      };

      const result = updateTranslations({}, translations, true);

      expect(result).toEqual({});
    });

    it('produces deterministic output regardless of input insertion order', () => {
      const phrasesA: HashToLeaf = {
        zzz: phrase('z desc', 'z text'),
        aaa: phrase('a desc', 'a text'),
        mmm: phrase('m desc', 'm text'),
      };
      const phrasesB: HashToLeaf = {
        mmm: phrase('m desc', 'm text'),
        zzz: phrase('z desc', 'z text'),
        aaa: phrase('a desc', 'a text'),
      };
      const translationsA: Translations = {
        zzz: existingEntry('Z translated'),
        aaa: existingEntry('A translated'),
      };
      const translationsB: Translations = {
        aaa: existingEntry('A translated'),
        zzz: existingEntry('Z translated'),
      };

      const resultA = updateTranslations(phrasesA, translationsA, true);
      const resultB = updateTranslations(phrasesB, translationsB, true);

      expect(Object.keys(resultA)).toEqual(Object.keys(resultB));
      expect(resultA).toEqual(resultB);
    });
  });
});
