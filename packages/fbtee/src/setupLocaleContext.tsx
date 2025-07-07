import { FbtRuntimeInput, Hooks } from './Hooks.tsx';
import { TranslationDictionary } from './index.tsx';
import IntlVariations from './IntlVariations.tsx';
import setupFbtee from './setupFbtee.tsx';

export type TranslationPromise = Promise<{
  [hashKey: string]: FbtRuntimeInput;
}>;
export type LocaleLoaderFn = (locale: string) => TranslationPromise;

export type LocaleContextProps = Readonly<{
  availableLanguages: ReadonlyMap<string, string>;
  clientLocales: ReadonlyArray<string | null>;
  fallbackLocale?: string;
  gender?: IntlVariations;
  hooks?: Hooks;
  loadLocale: LocaleLoaderFn;
  translations?: TranslationDictionary;
}>;

export default function setupLocaleContext({
  availableLanguages,
  clientLocales,
  fallbackLocale = 'en_US',
  gender = IntlVariations.GENDER_UNKNOWN,
  hooks,
  loadLocale,
  translations = { [fallbackLocale]: {} },
}: LocaleContextProps) {
  const availableLocales = new Map<string, string>();
  let currentLocale: string | null;

  for (const [locale] of availableLanguages) {
    availableLocales.set(locale, locale);
    availableLocales.set(locale.split('_')[0], locale);
  }

  const getLocales = (): ReadonlyArray<string> =>
    Array.from(
      new Set(
        [...clientLocales, fallbackLocale]
          .flatMap((locale) => {
            if (!locale) {
              return null;
            }

            const [first = '', second] = locale.toLowerCase().split(/-|_/);
            if (!first?.length) {
              return null;
            }

            return second?.length
              ? [`${first}${second ? `_${second.toUpperCase()}` : ''}`, first]
              : [first];
          })
          .filter((locale): locale is string => !!locale),
      ),
    );

  const getLocale = (): string => {
    if (currentLocale) {
      return currentLocale;
    }

    for (const locale of getLocales()) {
      const localeName = availableLocales.get(locale);
      if (localeName) {
        currentLocale = localeName;
        return localeName;
      }
    }

    currentLocale = fallbackLocale;
    return fallbackLocale;
  };

  const maybeLoadLocale = async (
    locale: string,
    loadLocale: LocaleLoaderFn,
  ) => {
    if (
      availableLocales.has(locale) &&
      !translations[locale] &&
      locale !== fallbackLocale
    ) {
      translations[locale] = await loadLocale(locale);
    }
  };

  const setLocale = async (locale: string) => {
    if (availableLocales.has(locale)) {
      await maybeLoadLocale(locale, loadLocale);
      if (locale !== currentLocale) {
        currentLocale = locale;
      }
    }
    return currentLocale || getLocale();
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

  return { getLocale, setLocale };
}
