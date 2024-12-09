import IntlVariations from '../IntlVariations';

export default {
  getVariation(
    n: number
  ): (typeof IntlVariations)[keyof typeof IntlVariations] {
    if (n === 1) {
      return IntlVariations.NUMBER_ONE;
    } else if (n === 0 || (n !== 1 && n % 100 >= 1 && n % 100 <= 19)) {
      return IntlVariations.NUMBER_FEW;
    } else {
      return IntlVariations.NUMBER_OTHER;
    }
  },
};
