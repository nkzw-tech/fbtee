/// <reference types="fbtee/ReactTypes.d.ts" />
/// <reference types="vite/client" />

import { createLocaleContext, type FbtRuntimeInput } from 'fbtee';
import './App.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import AvailableLanguages, {
  type AvailableLocale,
  LegacyLocaleAliases,
} from './AvailableLanguages.tsx';

type TranslationModule = {
  default: Partial<Record<AvailableLocale, Record<string, FbtRuntimeInput>>>;
};

const translationModules = import.meta.glob('./translations/*.json') as Record<
  string,
  () => Promise<TranslationModule>
>;

const loadAvailableLocale = async <Locale extends Exclude<AvailableLocale, 'en-US'>>(
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
  if (locale === 'en-US' || !AvailableLanguages.has(locale as AvailableLocale)) {
    return {};
  }

  return loadAvailableLocale(locale as Exclude<AvailableLocale, 'en-US'>);
};

const storedLocale = localStorage.getItem('fbtee:locale');
const locale = storedLocale
  ? AvailableLanguages.has(storedLocale as AvailableLocale)
    ? (storedLocale as AvailableLocale)
    : LegacyLocaleAliases.get(storedLocale) || null
  : null;
if (locale && locale !== storedLocale) {
  localStorage.setItem('fbtee:locale', locale);
}
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
