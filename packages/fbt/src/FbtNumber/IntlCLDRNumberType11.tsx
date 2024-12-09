import IntlVariations from '../IntlVariations';

const IntlCLDRNumberType11 = {
  getVariation(
    n: number
  ): (typeof IntlVariations)[keyof typeof IntlVariations] {
    if (n % 10 === 1 && n % 100 !== 11) {
      return IntlVariations.NUMBER_ONE;
    } else {
      return IntlVariations.NUMBER_OTHER;
    }
  },
} as const;

export default IntlCLDRNumberType11;
