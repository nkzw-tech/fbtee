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
    case 'es_ES':
      return (await import('./translations/es_LA.json')).default.es_LA;
    case 'ru_RU':
      return (await import('./translations/ru_RU.json')).default.ru_RU;
    case 'fb_HX':
      return (await import('./translations/fb_HX.json')).default.fb_HX;
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
