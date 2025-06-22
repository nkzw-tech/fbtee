import {
  createContext,
  ReactNode,
  use,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { FbtRuntimeInput, Hooks } from './Hooks.tsx';
import { TranslationDictionary } from './index.tsx';
import IntlVariations from './IntlVariations.tsx';
import setupFbtee from './setupFbtee.tsx';

export type TranslationPromise = Promise<{
  [hashKey: string]: FbtRuntimeInput;
}>;
export type LocaleLoaderFn = (locale: string) => TranslationPromise;

type LocaleContextProps = Readonly<{
  availableLanguages: ReadonlyMap<string, string>;
  clientLocales: ReadonlyArray<string>;
  fallbackLocale?: string;
  hooks?: Hooks;
  loadLocale: LocaleLoaderFn;
  translations?: TranslationDictionary;
}>;

export function setupLocaleContext({
  availableLanguages,
  clientLocales,
  fallbackLocale = 'en_US',
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
          .flatMap((locale: string) => {
            if (!locale) {
              return null;
            }

            const [first = '', second] = locale.toLowerCase().split(/-|_/);
            if (!first.length) {
              return null;
            }

            return second.length
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
    return currentLocale;
  };

  setupFbtee({
    hooks: {
      ...hooks,
      getViewerContext: () => ({
        GENDER: IntlVariations.GENDER_UNKNOWN,
        locale: getLocale(),
      }),
    },
    translations,
  });

  return { getLocale, setLocale, translations };
}

export type LocaleContext = {
  locale: string;
  setLocale: (locale: string) => Promise<void>;
};

export const Context = createContext<LocaleContext>(
  null as unknown as LocaleContext,
);

export default function LocaleContext({
  availableLanguages,
  children,
  clientLocales,
  fallbackLocale,
  hooks,
  loadLocale,
  translations,
}: LocaleContextProps &
  Readonly<{
    children: ReactNode;
  }>) {
  const { getLocale, setLocale } = useMemo(
    () =>
      setupLocaleContext({
        availableLanguages,
        clientLocales,
        fallbackLocale,
        hooks,
        loadLocale,
        translations,
      }),
    [
      availableLanguages,
      clientLocales,
      fallbackLocale,
      hooks,
      loadLocale,
      translations,
    ],
  );

  const [locale, _setLocale] = useState(getLocale);

  return (
    <Context
      value={{
        locale,
        setLocale: useCallback(
          async (newLocale: string) => {
            _setLocale((await setLocale(newLocale)) || locale);
          },
          [locale, setLocale],
        ),
      }}
    >
      {children}
    </Context>
  );
}

export function useLocaleContext(): LocaleContext {
  return use(Context);
}
