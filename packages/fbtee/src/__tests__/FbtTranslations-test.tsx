import { describe, expect, it } from '@jest/globals';
import FbtTranslations from '../FbtTranslations.tsx';
import Hooks from '../Hooks.tsx';

describe('FbtTranslations', () => {
  it('can register and get back translations', () => {
    FbtTranslations.registerTranslations({ en_US: { c1: 'aaa' } });
    expect(FbtTranslations.getRegisteredTranslations()).toMatchInlineSnapshot(`
    {
      "en_US": {
        "c1": "aaa",
      },
    }
  `);
  });

  it('merges translations with the same locale as expected', () => {
    FbtTranslations.registerTranslations({ en_US: { c1: 'aaa' } });
    FbtTranslations.mergeTranslations({ en_US: { c2: 'bbb' } });
    expect(FbtTranslations.getRegisteredTranslations()).toMatchInlineSnapshot(`
    {
      "en_US": {
        "c1": "aaa",
        "c2": "bbb",
      },
    }
  `);
  });

  it('merges translations with different locales as expected', () => {
    FbtTranslations.registerTranslations({ en_US: { c1: 'aaa' } });
    FbtTranslations.mergeTranslations({
      cs_CZ: { c1: 'ccc' },
      es_MX: { c1: 'bbb' },
    });
    expect(FbtTranslations.getRegisteredTranslations()).toMatchInlineSnapshot(`
    {
      "cs_CZ": {
        "c1": "ccc",
      },
      "en_US": {
        "c1": "aaa",
      },
      "es_MX": {
        "c1": "bbb",
      },
    }
  `);
  });

  it('merges translations with the same hash as expected', () => {
    FbtTranslations.registerTranslations({ en_US: { c1: 'aaa', c2: 'bbb' } });
    FbtTranslations.mergeTranslations({ en_US: { c1: 'ccc' } });
    expect(FbtTranslations.getRegisteredTranslations()).toMatchInlineSnapshot(`
    {
      "en_US": {
        "c1": "ccc",
        "c2": "bbb",
      },
    }
  `);
  });

  it('looks up translations through locale aliases', () => {
    FbtTranslations.registerTranslations({ de_DE: { c1: 'Hallo' } });
    Hooks.register({
      getViewerContext: () => ({
        GENDER: 3,
        locale: 'de-DE',
      }),
    });

    expect(
      FbtTranslations.getTranslatedInput({
        args: null,
        options: { hk: 'c1' },
        table: 'Hello',
      }),
    ).toEqual({
      args: null,
      table: 'Hallo',
    });
  });
});
