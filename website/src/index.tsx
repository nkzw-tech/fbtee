/// <reference types="fbtee/ReactTypes.d.ts" />
/// <reference types="vite/client" />

import App from './App.tsx';
import './App.css';
import { createLocaleContext, type FbtRuntimeInput } from 'fbtee';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AvailableLanguages, {
  type AvailableLocale,
} from './AvailableLanguages.tsx';

type TranslationModule = {
  default: Partial<Record<AvailableLocale, Record<string, FbtRuntimeInput>>>;
};

const translationModules = import.meta.glob<TranslationModule>(
  './translations/*.json',
);

const loadAvailableLocale = async <
  Locale extends Exclude<AvailableLocale, 'en_US'>,
>(
  locale: Locale,
) => {
  const loadModule = translationModules[`./translations/${locale}.json`];
  if (!loadModule) {
    throw new Error(
      `Missing generated translations for ${locale}. Run 'pnpm fbtee translate' in the website package.`,
    );
  }

  return (await loadModule()).default[locale] ?? {};
};

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
