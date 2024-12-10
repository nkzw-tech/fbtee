import FbtHooks, {
  FbtRuntimeCallInput,
  FbtRuntimeInput,
  FbtTranslatedInput,
} from './FbtHooks';

export type TranslationDict = {
  [locale: string]: {
    [hashKey: string]: FbtRuntimeInput;
  };
};

let currentTranslations: TranslationDict = {};

const defaultLocale = 'en_US';

export default {
  getRegisteredTranslations(): TranslationDict {
    return currentTranslations;
  },

  getTranslatedInput(
    input: FbtRuntimeCallInput
  ): FbtTranslatedInput | null | undefined {
    const { args, options } = input;
    const hashKey = options?.hk;
    const { locale } = FbtHooks.getViewerContext();
    const table = currentTranslations[locale];
    if (process.env.NODE_ENV === 'development') {
      if (!table && locale !== defaultLocale) {
        // eslint-disable-next-line no-console
        console.warn('Translations have not been provided.');
      }
    }

    if (hashKey == null || table?.[hashKey] == null) {
      return null;
    }
    return {
      args,
      table: table[hashKey],
    };
  },

  mergeTranslations(newTranslations: TranslationDict): undefined {
    Object.keys(newTranslations).forEach((locale) => {
      currentTranslations[locale] = Object.assign(
        currentTranslations[locale] ?? {},
        newTranslations[locale]
      );
    });
  },

  registerTranslations(translations: TranslationDict): undefined {
    currentTranslations = translations;
  },
};
