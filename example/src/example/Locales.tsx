const Locales = {
  ar_AR: {
    bcp47: 'ar',
    displayName: '\u0627\u0644\u0639\u0631\u0628\u064A\u0629',
    englishName: 'Arabic',
  },
  de_DE: {
    bcp47: 'de',
    displayName: 'Deutsch',
    englishName: 'German',
  },
  en_US: {
    bcp47: 'en-US',
    displayName: 'English (US)\u200e',
    englishName: 'English (US)',
  },
  es_LA: {
    bcp47: 'es-419',
    displayName: 'Espa\u00F1ol',
    englishName: 'Spanish',
  },
  fb_HX: {
    bcp47: 'fb-HX',
    displayName: 'l33t 5p34k',
    englishName: 'FB H4x0r',
  },
  fr_FR: {
    bcp47: 'fr',
    displayName: 'Fran\u00E7ais',
    englishName: 'French',
  },
  he_IL: {
    bcp47: 'he',
    displayName: '\u05E2\u05D1\u05E8\u05D9\u05EA',
    englishName: 'Hebrew',
  },
  it_IT: {
    bcp47: 'it',
    displayName: 'Italiano',
    englishName: 'Italian',
  },
  ja_JP: {
    bcp47: 'ja',
    displayName: '\u65E5\u672C\u8A9E',
    englishName: 'Japanese',
  },
  ru_RU: {
    bcp47: 'ru',
    displayName: 'Русский',
    englishName: 'Russian',
  },
} as const;

export type Locale = keyof typeof Locales;
export type TextDirection = 'ltr' | 'rtl';

type LocaleTextInfo = {
  direction?: TextDirection;
};

type IntlLocaleWithTextInfo = Intl.Locale & {
  getTextInfo?: () => LocaleTextInfo;
  textInfo?: LocaleTextInfo;
};

const RTL_LANGUAGES = new Set([
  'ar',
  'dv',
  'fa',
  'he',
  'ks',
  'ku',
  'ps',
  'sd',
  'ug',
  'ur',
  'yi',
]);

export function getLocaleDirection(locale: string): TextDirection {
  try {
    const intlLocale = new Intl.Locale(locale) as IntlLocaleWithTextInfo;
    const textInfo = intlLocale.getTextInfo?.() ?? intlLocale.textInfo;
    if (textInfo?.direction === 'rtl') {
      return 'rtl';
    } else if (textInfo?.direction === 'ltr') {
      return 'ltr';
    }
    return RTL_LANGUAGES.has(intlLocale.language) ? 'rtl' : 'ltr';
  } catch {
    const language = locale.split(/[_-]/)[0]?.toLowerCase();
    return language && RTL_LANGUAGES.has(language) ? 'rtl' : 'ltr';
  }
}

export function updateDocumentLocale(locale: Locale) {
  const { bcp47 } = Locales[locale];
  document.documentElement.dir = getLocaleDirection(bcp47);
  document.documentElement.lang = bcp47;
}

export default Locales;
