import invariant from 'invariant';
import type {
  LangToNumberTypeValues,
  LocaleToNumberTypeValues,
} from './CLDR/IntlNumberType.tsx';
import IntlNumberType from './CLDR/IntlNumberType.tsx';
import { forLocale, type IntlGenderType } from './gender/IntlGenderType.tsx';

/**
 * Represents a given locale's variation (number/gender) configuration.
 * i.e. which variations we should default to when unknown
 */
export default class TranslationConfig {
  readonly numberType: LangToNumberTypeValues | LocaleToNumberTypeValues;
  readonly genderType: IntlGenderType;

  constructor(
    numberType: LangToNumberTypeValues | LocaleToNumberTypeValues,
    genderType: IntlGenderType
  ) {
    this.numberType = numberType;
    this.genderType = genderType;
  }

  isDefaultVariation(variation: unknown): boolean {
    // variation could be "*", or it could be number variation or
    // gender variation value in either string or number type.
    let value;
    if (typeof variation === 'number') {
      value = variation;
    } else {
      invariant(
        typeof variation === 'string',
        'Expect keys in translated payload to be either string or number type ' +
          'but got a key of type `%s`',
        variation
      );
      value = Number.parseInt(variation, 10);
    }
    if (Number.isNaN(value)) {
      return false;
    }
    return (
      value === this.numberType.getFallback() ||
      value === this.genderType.getFallback()
    );
  }

  static fromFBLocale(locale: string): TranslationConfig {
    return new TranslationConfig(
      IntlNumberType.forLocale(locale),
      forLocale(locale)
    );
  }
}
