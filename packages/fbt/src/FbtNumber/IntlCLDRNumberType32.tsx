import IntlVariations from '../IntlVariations.tsx';

export default {
  getVariation(n: number): IntlVariations {
    if (n === 1) {
      return IntlVariations.NUMBER_ONE;
    } else if (n === 2) {
      return IntlVariations.NUMBER_TWO;
    } else if (n >= 3 && n <= 6) {
      return IntlVariations.NUMBER_FEW;
    } else if (n >= 7 && n <= 10) {
      return IntlVariations.NUMBER_MANY;
    } else {
      return IntlVariations.NUMBER_OTHER;
    }
  },
};
