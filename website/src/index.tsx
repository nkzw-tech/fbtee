/// <reference types="fbtee/ReactTypes.d.ts" />

import App from './App.tsx';
import './App.css';
import { createLocaleContext } from 'fbtee';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AvailableLanguages from './AvailableLanguages.tsx';

const loadLocale = async (locale: string) =>
  locale !== 'en_US' && AvailableLanguages.has(locale)
    ? (await import(`./translations/${locale}.json`)).default[locale]
    : {};

const locale = localStorage.getItem('fbtee:locale');
const translations = locale
  ? {
      [locale]: await loadLocale(locale),
    }
  : {};

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
