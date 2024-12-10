import IntlVariations from '../IntlVariations.tsx';

const IntlCLDRNumberType04 = {
  getVariation(n: number): IntlVariations {
    return n >= 0 && n <= 1
      ? IntlVariations.NUMBER_ONE
      : IntlVariations.NUMBER_OTHER;
  },
} as const;

export default IntlCLDRNumberType04;
