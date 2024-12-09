import IntlVariations from '../IntlVariations';

export default {
  getVariation(
    n: number
  ): (typeof IntlVariations)[keyof typeof IntlVariations] {
    if (n % 10 === 1) {
      return IntlVariations.NUMBER_ONE;
    } else if (n % 10 === 2) {
      return IntlVariations.NUMBER_TWO;
    } else if (
      n % 100 === 0 ||
      n % 100 === 20 ||
      n % 100 === 40 ||
      n % 100 === 60 ||
      n % 100 === 80
    ) {
      return IntlVariations.NUMBER_FEW;
    } else {
      return IntlVariations.NUMBER_OTHER;
    }
  },
};
