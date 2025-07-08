/// <reference types="fbtee/ReactTypes.d.ts" />

import App from './App.tsx';
import './App.css';
import { createLocaleContext } from 'fbtee';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AvailableLanguages from './AvailableLanguages.tsx';

const loadLocale = async (locale: string) => {
  switch (locale) {
    case 'ja_JP':
      return (await import('./translations/ja_JP.json')).default.ja_JP;
    case 'de_DE':
      return (await import('./translations/de_DE.json')).default.de_DE;
    default: {
      return {};
    }
  }
};

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
