import FBLocaleToLang from '../FBLocaleToLang.tsx';
import { Gender } from '../IntlVariations.tsx';
import {
  getFallback as getFallbackA,
  getGenderVariations as getGenderVariationsA,
} from './IntlDefaultGenderType.tsx';
import {
  getFallback as getFallbackB,
  getGenderVariations as getGenderVariationsB,
} from './IntlMergedUnknownGenderType.tsx';

const IntlDefaultGenderType = {
  getFallback: getFallbackA,
  getGenderVariations: getGenderVariationsA,
};

const IntlMergedUnknownGenderType = {
  getFallback: getFallbackB,
  getGenderVariations: getGenderVariationsB,
};

export type IntlGenderType = Readonly<{
  getFallback(): (typeof Gender)[keyof typeof Gender];
  getGenderVariations(): ReadonlyArray<(typeof Gender)[keyof typeof Gender]>;
}>;

const _mergedLocales = {
  ar_AR: 1,
  ks_IN: 1,
  lv_LV: 1,
  ps_AF: 1,
  qk_DZ: 1,
  qs_DE: 1,
  qv_IT: 1,
  sq_AL: 1,
  ti_ET: 1,
} as const;

const _mergedLangs = {
  ar: 1,
  dsb: 1,
  kab: 1,
  ks: 1,
  lv: 1,
  ps: 1,
  sq: 1,
  ti: 1,
  vec: 1,
} as const;

export function forLanguage(lang: string): IntlGenderType {
  return _mergedLangs[lang as keyof typeof _mergedLangs]
    ? IntlMergedUnknownGenderType
    : IntlDefaultGenderType;
}

export function forLocale(locale: string): IntlGenderType {
  return _mergedLocales[locale as keyof typeof _mergedLocales]
    ? IntlMergedUnknownGenderType
    : forLanguage(FBLocaleToLang.get(locale));
}
