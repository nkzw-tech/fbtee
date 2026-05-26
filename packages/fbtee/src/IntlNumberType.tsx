import IntlVariations from './IntlVariations.tsx';
import { getLocaleAliases, getLocaleLanguage } from './localeIdentifier.tsx';

type IntlNumberType = Readonly<{
  getVariation(n: number): IntlVariations;
}>;

type PluralCategory = Intl.LDMLPluralRule;

const categoryToVariation: Readonly<Record<PluralCategory, IntlVariations>> = {
  few: IntlVariations.NUMBER_FEW,
  many: IntlVariations.NUMBER_MANY,
  one: IntlVariations.NUMBER_ONE,
  other: IntlVariations.NUMBER_OTHER,
  two: IntlVariations.NUMBER_TWO,
  zero: IntlVariations.NUMBER_ZERO,
};

const fallbackNumberTypes: Readonly<Record<string, IntlNumberType>> = {
  ay: { getVariation: () => IntlVariations.NUMBER_OTHER },
  bh: {
    getVariation: (n) =>
      n >= 0 && n <= 1
        ? IntlVariations.NUMBER_ONE
        : IntlVariations.NUMBER_OTHER,
  },
  co: { getVariation: (n) => getOneOtherVariation(n) },
  fb: { getVariation: (n) => getOneOtherVariation(n) },
  fuv: { getVariation: (n) => getZeroOrOneVariation(n) },
  gn: { getVariation: (n) => getOneOtherVariation(n) },
  grc: { getVariation: (n) => getOneOtherVariation(n) },
  ht: { getVariation: (n) => getOneOtherVariation(n) },
  ik: { getVariation: (n) => getOneTwoOtherVariation(n) },
  la: { getVariation: (n) => getOneOtherVariation(n) },
  li: { getVariation: (n) => getOneOtherVariation(n) },
  mi: { getVariation: (n) => getZeroOrOneVariation(n) },
  qu: {
    getVariation: (n) =>
      n % 10 === 1 && n % 100 !== 11
        ? IntlVariations.NUMBER_ONE
        : IntlVariations.NUMBER_OTHER,
  },
  quc: { getVariation: (n) => getOneOtherVariation(n) },
  rn: { getVariation: (n) => getOneOtherVariation(n) },
  root: { getVariation: () => IntlVariations.NUMBER_OTHER },
  rup: {
    getVariation: (n) => {
      if (n === 1) {
        return IntlVariations.NUMBER_ONE;
      } else if (n === 0 || (n !== 1 && n % 100 >= 1 && n % 100 <= 19)) {
        return IntlVariations.NUMBER_FEW;
      }
      return IntlVariations.NUMBER_OTHER;
    },
  },
  rw: { getVariation: (n) => getOneOtherVariation(n) },
  sa: { getVariation: (n) => getOneTwoOtherVariation(n) },
  szl: {
    getVariation: (n) => {
      if (n === 1) {
        return IntlVariations.NUMBER_ONE;
      } else if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) {
        return IntlVariations.NUMBER_FEW;
      }
      return IntlVariations.NUMBER_MANY;
    },
  },
  tg: { getVariation: (n) => getZeroOrOneVariation(n) },
  tlh: { getVariation: (n) => getOneOtherVariation(n) },
  tob: {
    getVariation: (n) => {
      if (n % 10 === 0 || (n % 100 >= 11 && n % 100 <= 19)) {
        return IntlVariations.NUMBER_ZERO;
      } else if (n % 10 === 1 && n % 100 !== 11) {
        return IntlVariations.NUMBER_ONE;
      }
      return IntlVariations.NUMBER_OTHER;
    },
  },
  tt: { getVariation: () => IntlVariations.NUMBER_OTHER },
  zza: { getVariation: (n) => getOneOtherVariation(n) },
};

const pluralRulesCache = new Map<string, Intl.PluralRules>();
const numberTypeCache = new Map<string, IntlNumberType>();

function getOneOtherVariation(n: number): IntlVariations {
  return n === 1 ? IntlVariations.NUMBER_ONE : IntlVariations.NUMBER_OTHER;
}

function getOneTwoOtherVariation(n: number): IntlVariations {
  if (n === 1) {
    return IntlVariations.NUMBER_ONE;
  } else if (n === 2) {
    return IntlVariations.NUMBER_TWO;
  }
  return IntlVariations.NUMBER_OTHER;
}

function getZeroOrOneVariation(n: number): IntlVariations {
  return n === 0 || n === 1
    ? IntlVariations.NUMBER_ONE
    : IntlVariations.NUMBER_OTHER;
}

function getPluralRules(locale: string): Intl.PluralRules | null {
  const cachedRules = pluralRulesCache.get(locale);
  if (cachedRules) {
    return cachedRules;
  }

  try {
    if (Intl.PluralRules.supportedLocalesOf([locale]).length === 0) {
      return null;
    }
    const rules = new Intl.PluralRules(locale);
    pluralRulesCache.set(locale, rules);
    return rules;
  } catch {
    return null;
  }
}

function getSupportedLocale(locale: string): string | null {
  for (const localeAlias of getLocaleAliases(locale)) {
    const normalizedLocale = localeAlias.replaceAll('_', '-');
    if (getPluralRules(normalizedLocale)) {
      return normalizedLocale;
    }
  }
  return null;
}

function getNumberTypeForLocale(locale: string): IntlNumberType {
  const cachedType = numberTypeCache.get(locale);
  if (cachedType) {
    return cachedType;
  }

  const supportedLocale = getSupportedLocale(locale);
  const numberType =
    supportedLocale == null
      ? fallbackNumberTypes[getLocaleLanguage(locale)] ||
        fallbackNumberTypes.root
      : {
          getVariation: (n: number): IntlVariations =>
            categoryToVariation[getPluralRules(supportedLocale)!.select(n)],
        };
  numberTypeCache.set(locale, numberType);
  return numberType;
}

export default {
  forLanguage(language: string): IntlNumberType {
    return getNumberTypeForLocale(language);
  },
  forLocale: getNumberTypeForLocale,
  get: getNumberTypeForLocale,
};
