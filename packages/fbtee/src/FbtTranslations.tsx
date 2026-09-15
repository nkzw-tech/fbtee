import freezeTranslationsInDEV from './freezeTranslationsInDEV.tsx';
import Hooks, { FbtRuntimeCallInput, FbtRuntimeInput, FbtTranslatedInput } from './Hooks.tsx';
import { getLocaleAliases } from './localeIdentifier.tsx';
import getRuntimeState, { RuntimeState } from './RuntimeState.tsx';

export type TranslationDictionary = {
  [locale: string]: {
    [hashKey: string]: FbtRuntimeInput;
  };
};

const defaultLocale = 'en-US';

export function mergeTranslations(state: RuntimeState, newTranslations: TranslationDictionary) {
  if (state.scoped) {
    if (process.env.NODE_ENV !== 'production') {
      freezeTranslationsInDEV(newTranslations);
    }
    const translations = { ...state.translations };
    for (const locale of Object.keys(newTranslations)) {
      translations[locale] = translations[locale]
        ? { ...translations[locale], ...newTranslations[locale] }
        : newTranslations[locale];
    }
    if (process.env.NODE_ENV !== 'production') {
      freezeTranslationsInDEV(translations);
    }
    state.translations = translations;
    state.resultCaches.clear();
  } else {
    for (const locale of Object.keys(newTranslations)) {
      state.translations[locale] = Object.assign(
        state.translations[locale] ?? {},
        newTranslations[locale],
      );
    }
  }
}

export default {
  getRegisteredTranslations(): TranslationDictionary {
    return getRuntimeState().translations;
  },

  getTranslatedInput(input: FbtRuntimeCallInput): FbtTranslatedInput | null {
    return getTranslatedInput(input, getRuntimeState());
  },

  mergeTranslations(newTranslations: TranslationDictionary) {
    mergeTranslations(getRuntimeState(), newTranslations);
  },

  registerTranslations(translations: TranslationDictionary) {
    registerTranslations(getRuntimeState(), translations);
  },
};

export function getTranslatedInput(
  { args, options }: FbtRuntimeCallInput,
  state: RuntimeState,
): FbtTranslatedInput | null {
  const hashKey = options?.hk;
  const { locale } = Hooks.getViewerContext(state);
  const currentTranslations = state.translations;
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
}

export function registerTranslations(state: RuntimeState, translations: TranslationDictionary) {
  if (state.scoped && process.env.NODE_ENV !== 'production') {
    freezeTranslationsInDEV(translations);
  }
  state.translations = translations;
  if (state.scoped) {
    state.resultCaches.clear();
  }
}
