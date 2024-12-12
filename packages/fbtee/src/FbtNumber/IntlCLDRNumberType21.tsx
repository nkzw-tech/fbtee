import IntlVariations from '../IntlVariations.tsx';

export default {
  getVariation(n: number): IntlVariations {
    if (n === 1 || n === 11) {
      return IntlVariations.NUMBER_ONE;
    } else if (n === 2 || n === 12) {
      return IntlVariations.NUMBER_TWO;
    } else if ((n >= 3 && n <= 10) || (n >= 13 && n <= 19)) {
      return IntlVariations.NUMBER_FEW;
    } else {
      return IntlVariations.NUMBER_OTHER;
    }
  },
};
