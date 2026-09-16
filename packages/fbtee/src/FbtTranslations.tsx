import { numberValues } from './FbtTableAccessor.tsx';
import freezeTranslationsInDEV from './freezeTranslationsInDEV.tsx';
import Hooks, {
  FbtRuntimeCallInput,
  FbtRuntimeInput,
  FbtTranslatedInput,
  FbtTableArgs,
} from './Hooks.tsx';
import { getNumberVariationsForLocale } from './IntlVariationResolver.tsx';
import { getAvailableLocaleChain, getLocaleHierarchy } from './localeFallback.tsx';
import { getLocaleIdentity } from './localeIdentifier.tsx';
import getRuntimeState, { RuntimeState } from './RuntimeState.tsx';

export type TranslationDictionary = {
  [locale: string]: {
    [hashKey: string]: FbtRuntimeInput;
  };
};

export function mergeTranslations(state: RuntimeState, newTranslations: TranslationDictionary) {
  state.localeChains.clear();
  state.missingTranslations.clear();
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
      state.translations[locale] = state.translations[locale]
        ? Object.assign(state.translations[locale], newTranslations[locale])
        : newTranslations[locale];
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
  { args, options, table: sourceTable }: FbtRuntimeCallInput,
  state: RuntimeState,
): FbtTranslatedInput | null {
  const hashKey = options?.hk;
  if (hashKey == null) {
    return null;
  }
  const { locale } = Hooks.getViewerContext(state);
  // Singleton catalogs are mutable and can gain locales without an API call.
  let chain = state.scoped ? state.localeChains.get(locale) : undefined;
  if (!chain) {
    chain = getAvailableLocaleChain(locale, Object.keys(state.translations), state.fallbackOptions);
    if (state.scoped) {
      state.localeChains.set(locale, chain);
    }
  }
  for (const candidate of chain) {
    const table = state.translations[candidate]?.[hashKey];
    if (table != null) {
      return {
        args:
          !args ||
          candidate === locale ||
          getLocaleIdentity(candidate) === getLocaleIdentity(locale)
            ? args
            : localizeNumberArgs(args, candidate),
        table,
      };
    }
  }
  const { onMissingTranslation, sourceLocale = 'en-US' } = state.fallbackOptions;
  if (
    onMissingTranslation &&
    !getLocaleHierarchy(sourceLocale).includes(getLocaleIdentity(locale))
  ) {
    const key = JSON.stringify([locale, hashKey]);
    if (!state.missingTranslations.has(key)) {
      state.missingTranslations.add(key);
      onMissingTranslation({ hashKey, locale, sourceLocale });
    }
  }
  return args && getLocaleIdentity(locale) !== getLocaleIdentity(sourceLocale)
    ? { args: localizeNumberArgs(args, sourceLocale), table: sourceTable }
    : null;
}

function localizeNumberArgs(args: FbtTableArgs | null, locale: string): FbtTableArgs | null {
  return (
    args?.map((arg) => {
      const number = numberValues.get(arg);
      return number == null ? arg : [getNumberVariationsForLocale(number, locale), arg[1]];
    }) ?? null
  );
}

export function registerTranslations(state: RuntimeState, translations: TranslationDictionary) {
  state.localeChains.clear();
  state.missingTranslations.clear();
  if (state.scoped && process.env.NODE_ENV !== 'production') {
    freezeTranslationsInDEV(translations);
  }
  state.translations = translations;
  if (state.scoped) {
    state.resultCaches.clear();
  }
}
