/// <reference types="fbtee/ReactTypes.d.ts" />

import App from './App.tsx';
import './App.css';
import { createLocaleContext, type FbtRuntimeInput } from 'fbtee';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AvailableLanguages, {
  type AvailableLocale,
} from './AvailableLanguages.tsx';

type TranslationModule<Locale extends AvailableLocale> = {
  default: Record<Locale, Record<string, FbtRuntimeInput>>;
};

type LocaleLoaders = {
  [Locale in Exclude<AvailableLocale, 'en_US'>]: () => Promise<
    TranslationModule<Locale>
  >;
};

const localeLoaders: LocaleLoaders = {
  ar_AR: () => import('./translations/ar_AR.json'),
  de_AT: () => import('./translations/de_AT.json'),
  de_DE: () => import('./translations/de_DE.json'),
  es_LA: () => import('./translations/es_LA.json'),
  fb_HX: () => import('./translations/fb_HX.json'),
  fr_FR: () => import('./translations/fr_FR.json'),
  he_IL: () => import('./translations/he_IL.json'),
  it_IT: () => import('./translations/it_IT.json'),
  ja_JP: () => import('./translations/ja_JP.json'),
  ru_RU: () => import('./translations/ru_RU.json'),
} satisfies LocaleLoaders;

const loadAvailableLocale = async <
  Locale extends Exclude<AvailableLocale, 'en_US'>,
>(
  locale: Locale,
) => (await localeLoaders[locale]()).default[locale];

const loadLocale = async (locale: string) => {
  if (
    locale === 'en_US' ||
    !AvailableLanguages.has(locale as AvailableLocale)
  ) {
    return {};
  }

  return loadAvailableLocale(locale as Exclude<AvailableLocale, 'en_US'>);
};

const locale = localStorage.getItem('fbtee:locale');
const translations = locale
  ? {
      [locale]: await loadLocale(locale),
    }
  : {};

// Preload all locales so that switching is fast. After all, this is a website about localization.
for (const [locale] of AvailableLanguages) {
  loadLocale(locale);
}

const LocaleContext = createLocaleContext({
  availableLanguages: AvailableLanguages,
  clientLocales: [locale, navigator.language, ...navigator.languages],
  loadLocale,
  translations,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleContext>
      <App />
    </LocaleContext>
  </StrictMode>,
);
