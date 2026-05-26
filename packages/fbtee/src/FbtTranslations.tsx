import Hooks, {
  FbtRuntimeCallInput,
  FbtRuntimeInput,
  FbtTranslatedInput,
} from './Hooks.tsx';
import { getLocaleAliases } from './localeIdentifier.tsx';

export type TranslationDictionary = {
  [locale: string]: {
    [hashKey: string]: FbtRuntimeInput;
  };
};

let currentTranslations: TranslationDictionary = {};

const defaultLocale = 'en-US';

export default {
  getRegisteredTranslations(): TranslationDictionary {
    return currentTranslations;
  },

  getTranslatedInput({
    args,
    options,
  }: FbtRuntimeCallInput): FbtTranslatedInput | null {
    const hashKey = options?.hk;
    const { locale } = Hooks.getViewerContext();
    const table = getLocaleAliases(locale)
      .map((localeAlias) => currentTranslations[localeAlias])
      .find(Boolean);
    if (process.env.NODE_ENV === 'development') {
      if (!table && !getLocaleAliases(defaultLocale).includes(locale)) {
        // eslint-disable-next-line no-console
        console.warn('Translations have not been provided.');
      }
    }

    return hashKey == null || table?.[hashKey] == null
      ? null
      : {
          args,
          table: table[hashKey],
        };
  },

  mergeTranslations(newTranslations: TranslationDictionary) {
    Object.keys(newTranslations).forEach((locale) => {
      currentTranslations[locale] = Object.assign(
        currentTranslations[locale] ?? {},
        newTranslations[locale],
      );
    });
  },

  registerTranslations(translations: TranslationDictionary) {
    currentTranslations = translations;
  },
};
