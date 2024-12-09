import IntlVariations from '../IntlVariations';

export default {
  getVariation(
    n: number
  ): (typeof IntlVariations)[keyof typeof IntlVariations] {
    if (n === 1) {
      return IntlVariations.NUMBER_ONE;
    } else if (n === 2) {
      return IntlVariations.NUMBER_TWO;
    } else if ((n < 0 || n > 10) && n % 10 === 0) {
      return IntlVariations.NUMBER_MANY;
    } else {
      return IntlVariations.NUMBER_OTHER;
    }
  },
};
