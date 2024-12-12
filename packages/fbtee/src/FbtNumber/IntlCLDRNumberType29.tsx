import IntlVariations from '../IntlVariations.tsx';

export default {
  getVariation(n: number): IntlVariations {
    if (n === 1) {
      return IntlVariations.NUMBER_ONE;
    } else if (n === 0 || (n % 100 >= 2 && n % 100 <= 10)) {
      return IntlVariations.NUMBER_FEW;
    } else if (n % 100 >= 11 && n % 100 <= 19) {
      return IntlVariations.NUMBER_MANY;
    } else {
      return IntlVariations.NUMBER_OTHER;
    }
  },
};
