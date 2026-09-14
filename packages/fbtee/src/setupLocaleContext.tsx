import FbtTranslations, { mergeTranslations } from './FbtTranslations.tsx';
import { FbtRuntimeInput, Hooks } from './Hooks.tsx';
import { TranslationDictionary } from './index.tsx';
import IntlVariations from './IntlVariations.tsx';
import { getLocaleAliases } from './localeIdentifier.tsx';
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

export type LocaleContextProps = Readonly<{
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
  fallbackLocale = 'en-US',
  gender: initialGender = IntlVariations.GENDER_UNKNOWN,
  hooks,
  loadLocale,
  translations: initialTranslations,
}: LocaleContextProps) {
  const runtimeState = getRuntimeState();
  const { scoped } = runtimeState;
  const availableLocales = new Map<string, string>();
  const resolvedLocales = new Map<string, string | null>();
  const pendingLocales = new Map<string, Promise<void>>();
  let currentLocale: string | null;
  let gender = resolveGender(initialGender);

  for (const [locale] of availableLanguages) {
    for (const localeAlias of getLocaleAliases(locale)) {
      availableLocales.set(localeAlias, locale);
    }
  }

  const resolveLocale = (locale: string): string | null => {
    const directLocale = availableLocales.get(locale);
    if (directLocale) {
      return directLocale;
    }

    if (resolvedLocales.has(locale)) {
      return resolvedLocales.get(locale) || null;
    }

    const resolvedLocale =
      getLocaleAliases(locale)
        .map((localeAlias) => availableLocales.get(localeAlias))
        .find((locale): locale is string => !!locale) || null;
    resolvedLocales.set(locale, resolvedLocale);
    return resolvedLocale;
  };

  const resolvedFallbackLocale = resolveLocale(fallbackLocale) || fallbackLocale;
  let translations = initialTranslations || { [resolvedFallbackLocale]: {} };

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

  const preloadLocale = async (locale: string = getLocale()): Promise<void> => {
    const localeName = resolveLocale(locale);
    if (!localeName || localeName === resolvedFallbackLocale) {
      return;
    }

    const currentTranslations = scoped ? runtimeState.translations : translations;
    const hasTranslations =
      !!currentTranslations[localeName] ||
      getLocaleAliases(localeName).some((localeAlias) => currentTranslations[localeAlias]);
    if (hasTranslations) {
      return;
    }

    let pending = pendingLocales.get(localeName);
    if (!pending) {
      pending = new Promise<Awaited<TranslationPromise>>((resolve) => {
        resolve(loadLocale(localeName));
      })
        .then((loadedTranslations) => {
          if (scoped) {
            mergeTranslations(runtimeState, { [localeName]: loadedTranslations });
          } else {
            translations[localeName] = loadedTranslations;
          }
        })
        .finally(() => {
          pendingLocales.delete(localeName);
        });
      pendingLocales.set(localeName, pending);
    }
    await pending;
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
    hooks: {
      ...hooks,
      getViewerContext: () => ({
        GENDER: gender,
        locale: getLocale(),
      }),
    },
    translations,
  });
  translations = FbtTranslations.getRegisteredTranslations();

  return { gender, getLocale, preloadLocale, setGender, setLocale };
}
