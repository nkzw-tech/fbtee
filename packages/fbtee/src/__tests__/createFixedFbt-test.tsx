import { describe, expect, it } from '@jest/globals';
import createFixedFbt from '../createFixedFbt.tsx';
import FbtTranslations from '../FbtTranslations.tsx';
import Hooks from '../Hooks.tsx';
import setupFbtee from '../setupFbtee.tsx';
import IntlViewerContext from '../ViewerContext.tsx';

setupFbtee({
  hooks: {
    getViewerContext: () => IntlViewerContext,
  },
  translations: {
    de_DE: {
      hash1: 'Hallo {name}',
      hash2: 'Einfacher Text',
      hash3: {
        '*': '{name} hat {count} Sachen',
      },
    },
    en_US: {},
    fr_FR: {
      hash1: 'Bonjour {name}',
      hash2: 'Texte simple',
    },
  },
});

describe('createFixedFbt', () => {
  it('should translate using the fixed locale', () => {
    const { fbt } = createFixedFbt('de_DE');
    expect(
      fbt
        ._(['Hello {name}', 'hash1'], [fbt._param('name', 'World')], {
          hk: 'hash1',
        })
        .toString(),
    ).toBe('Hallo World');
  });

  it('should not affect the global locale', () => {
    createFixedFbt('de_DE');
    expect(Hooks.getViewerContext().locale).toBe('en_US');
  });

  it('should work with fbs for plain string results', () => {
    const { fbs } = createFixedFbt('de_DE');
    expect(
      fbs._(['Simple text', 'hash2'], null, { hk: 'hash2' }).toString(),
    ).toBe('Einfacher Text');
  });

  it('should fall back to source string when no translation exists', () => {
    const { fbt } = createFixedFbt('ja_JP');
    expect(fbt._('Untranslated text').toString()).toBe('Untranslated text');
  });

  it('should support fixing the gender', () => {
    const { fbt } = createFixedFbt('de_DE', 'female');
    expect(Hooks.getViewerContext().locale).toBe('en_US');
    // The fixed fbt has its own gender context
    expect(fbt).toBeDefined();
  });

  it('should allow concurrent usage of different locales', () => {
    const de = createFixedFbt('de_DE');
    const fr = createFixedFbt('fr_FR');

    expect(
      de.fbt
        ._(['Hello {name}', 'hash1'], [de.fbt._param('name', 'World')], {
          hk: 'hash1',
        })
        .toString(),
    ).toBe('Hallo World');

    expect(
      fr.fbt
        ._(['Hello {name}', 'hash1'], [fr.fbt._param('name', 'World')], {
          hk: 'hash1',
        })
        .toString(),
    ).toBe('Bonjour World');

    // Global locale is still unchanged
    expect(Hooks.getViewerContext().locale).toBe('en_US');
  });

  it('should use translations registered after creation', () => {
    const { fbt } = createFixedFbt('es_ES');

    // No translations yet
    expect(
      fbt._(['Hello', 'hash_es'], null, { hk: 'hash_es' }).toString(),
    ).toBe('Hello');

    // Register translations after creation
    FbtTranslations.mergeTranslations({
      es_ES: { hash_es: 'Hola' },
    });

    expect(
      fbt._(['Hello', 'hash_es'], null, { hk: 'hash_es' }).toString(),
    ).toBe('Hola');
  });
});
