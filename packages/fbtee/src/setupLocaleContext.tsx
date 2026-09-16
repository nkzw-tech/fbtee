import { mergeTranslations } from './FbtTranslations.tsx';
import { FbtRuntimeInput, Hooks } from './Hooks.tsx';
import { TranslationDictionary } from './index.tsx';
import IntlVariations from './IntlVariations.tsx';
import {
  areEquivalentLocales,
  getAvailableLocaleChain,
  getLocaleHierarchy,
  LocaleFallbackOptions,
  negotiateLocale,
} from './localeFallback.tsx';
import { getLocaleIdentity } from './localeIdentifier.tsx';
import getRuntimeState from './RuntimeState.tsx';
import setupFbtee from './setupFbtee.tsx';

export type TranslationPromise = Promise<{
  [hashKey: string]: FbtRuntimeInput;
}>;
export type LocaleLoaderFn = (locale: string) => TranslationPromise;

export type Gender = IntlVariations | 'male' | 'female' | 'unknown';

export function resolveGender(gender: Gender): IntlVariations {
  if (gender === 'male') {
    return IntlVariations.GENDER_MALE;
  } else if (gender === 'female') {
    return IntlVariations.GENDER_FEMALE;
  } else if (gender === 'unknown') {
    return IntlVariations.GENDER_UNKNOWN;
  }

  return gender;
}

export type LocaleContextProps = LocaleFallbackOptions &
  Readonly<{
    availableLanguages: ReadonlyMap<string, string>;
    clientLocales: ReadonlyArray<string | null>;
    fallbackLocale?: string;
    gender?: Gender;
    hooks?: Hooks;
    loadLocale: LocaleLoaderFn;
    translations?: TranslationDictionary;
  }>;

export default function setupLocaleContext({
  availableLanguages,
  clientLocales,
  sourceLocale = 'en-US',
  fallbackLocale = sourceLocale,
  fallbackLocales,
  gender: initialGender = IntlVariations.GENDER_UNKNOWN,
  hooks,
  loadLocale,
  onMissingTranslation,
  translations: initialTranslations,
}: LocaleContextProps) {
  const runtimeState = getRuntimeState();
  const fallbackOptions = { fallbackLocales, onMissingTranslation, sourceLocale };
  const resolvedLocales = new Map<string, string | null>();
  const pendingLocales = new Map<string, Promise<void>>();
  let currentLocale: string | null;
  let gender = resolveGender(initialGender);

  const resolveLocale = (locale: string): string | null => {
    if (!resolvedLocales.has(locale)) {
      resolvedLocales.set(locale, negotiateLocale(locale, availableLanguages.keys()));
    }
    return resolvedLocales.get(locale) ?? null;
  };

  const resolvedFallbackLocale = resolveLocale(fallbackLocale) || fallbackLocale;
  const translations = initialTranslations || {};

  const getLocales = (): ReadonlyArray<string> =>
    Array.from(
      new Set(
        [...clientLocales, resolvedFallbackLocale].filter((locale): locale is string => !!locale),
      ),
    );

  const getLocale = (): string => {
    if (currentLocale) {
      return currentLocale;
    }

    for (const locale of getLocales()) {
      const localeName = resolveLocale(locale);
      if (localeName) {
        currentLocale = localeName;
        return localeName;
      }
    }

    currentLocale = resolvedFallbackLocale;
    return resolvedFallbackLocale;
  };

  const loadCatalog = async (localeName: string): Promise<void> => {
    if (
      getLocaleHierarchy(sourceLocale).some((parent) => areEquivalentLocales(localeName, parent))
    ) {
      return;
    }
    // A parent catalog must not prevent loading a more specific regional catalog.
    if (
      Object.keys(runtimeState.translations).some((key) => areEquivalentLocales(key, localeName))
    ) {
      return;
    }

    const identity = getLocaleIdentity(localeName);
    let pending = pendingLocales.get(identity);
    if (!pending) {
      pending = new Promise<Awaited<TranslationPromise>>((resolve) => {
        resolve(loadLocale(localeName));
      })
        .then((loadedTranslations) => {
          mergeTranslations(runtimeState, { [localeName]: loadedTranslations });
        })
        .finally(() => {
          pendingLocales.delete(identity);
        });
      pendingLocales.set(identity, pending);
    }
    await pending;
  };

  const preloadLocale = async (locale: string = getLocale()): Promise<void> => {
    const localeName = resolveLocale(locale);
    if (localeName) {
      await Promise.all(
        getAvailableLocaleChain(localeName, availableLanguages.keys(), fallbackOptions).map(
          loadCatalog,
        ),
      );
    }
  };

  const setLocale = async (locale: string) => {
    const localeName = resolveLocale(locale);
    if (localeName) {
      await preloadLocale(localeName);
      if (localeName !== currentLocale) {
        currentLocale = localeName;
      }
    }
    return currentLocale || getLocale();
  };

  const setGender = (newGender: Gender) => {
    return (gender = resolveGender(newGender));
  };

  setupFbtee({
    ...fallbackOptions,
    hooks: {
      ...hooks,
      getViewerContext: () => ({
        GENDER: gender,
        locale: getLocale(),
      }),
    },
    translations,
  });

  return { gender, getLocale, preloadLocale, setGender, setLocale };
}
