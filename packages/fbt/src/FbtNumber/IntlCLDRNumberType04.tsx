import IntlVariations from '../IntlVariations';

const IntlCLDRNumberType04 = {
  getVariation(
    n: number
  ): (typeof IntlVariations)[keyof typeof IntlVariations] {
    return n >= 0 && n <= 1
      ? IntlVariations.NUMBER_ONE
      : IntlVariations.NUMBER_OTHER;
  },
} as const;

export default IntlCLDRNumberType04;
