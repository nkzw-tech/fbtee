import { getLocaleLanguage } from '../../localeIdentifier.tsx';
import type { IntlVariations } from '../IntlVariations.tsx';
import { IntlNumberVariations } from '../IntlVariations.tsx';

export type IntlNumberType = Readonly<{
  getFallback(): IntlVariations;
}>;

const MANY_FALLBACK_LANGUAGES = new Set(['be', 'pl', 'ru', 'szl', 'uk']);

function getNumberType(locale: string): IntlNumberType {
  const language = getLocaleLanguage(locale);
  return {
    getFallback(): IntlVariations {
      return MANY_FALLBACK_LANGUAGES.has(language)
        ? IntlNumberVariations.MANY
        : IntlNumberVariations.OTHER;
    },
  };
}

export default {
  forLanguage: getNumberType,
  forLocale: getNumberType,
  get: getNumberType,
};
