import IntlVariations from '../IntlVariations';

const IntlCLDRNumberType04 = {
  getVariation(
    n: number
  ): (typeof IntlVariations)[keyof typeof IntlVariations] {
    if (n >= 0 && n <= 1) {
      return IntlVariations.NUMBER_ONE;
    } else {
      return IntlVariations.NUMBER_OTHER;
    }
  },
} as const;

export default IntlCLDRNumberType04;
