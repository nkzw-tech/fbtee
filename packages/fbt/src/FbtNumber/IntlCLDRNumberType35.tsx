import IntlVariations from '../IntlVariations';

export default {
  getVariation(
    n: number
  ): (typeof IntlVariations)[keyof typeof IntlVariations] {
    if (n === 0) {
      return IntlVariations.NUMBER_ZERO;
    } else if (n === 1) {
      return IntlVariations.NUMBER_ONE;
    } else if (n === 2) {
      return IntlVariations.NUMBER_TWO;
    } else if (n === 3) {
      return IntlVariations.NUMBER_FEW;
    } else if (n === 6) {
      return IntlVariations.NUMBER_MANY;
    } else {
      return IntlVariations.NUMBER_OTHER;
    }
  },
};
