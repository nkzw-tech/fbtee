const Locales = {
  ar_AR: {
    bcp47: 'ar',
    displayName: '\u0627\u0644\u0639\u0631\u0628\u064A\u0629',
    englishName: 'Arabic',
    rtl: true,
  },
  en_US: {
    bcp47: 'en-US',
    displayName: 'English (US)\u200e',
    englishName: 'English (US)',
    rtl: false,
  },
  es_LA: {
    bcp47: 'es-419',
    displayName: 'Espa\u00F1ol',
    englishName: 'Spanish',
    rtl: false,
  },
  fb_HX: {
    bcp47: 'fb-HX',
    displayName: 'l33t 5p34k',
    englishName: 'FB H4x0r',
    rtl: false,
  },
  he_IL: {
    bcp47: 'he',
    displayName: '\u05E2\u05D1\u05E8\u05D9\u05EA',
    englishName: 'Hebrew',
    rtl: true,
  },
  ja_JP: {
    bcp47: 'ja',
    displayName: '\u65E5\u672C\u8A9E',
    englishName: 'Japanese',
    rtl: false,
  },
  ru_RU: {
    bcp47: 'ru',
    displayName: 'Русский',
    englishName: 'Russian',
    rtl: false,
  },
} as const;

export type Locale = keyof typeof Locales;

export default Locales;
