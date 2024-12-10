import IntlVariations from '../IntlVariations.tsx';

export default {
  getVariation(n: number): IntlVariations {
    if (n === 0 || n === 1) {
      return IntlVariations.NUMBER_ONE;
    } else if (n >= 2 && n <= 10) {
      return IntlVariations.NUMBER_FEW;
    } else {
      return IntlVariations.NUMBER_OTHER;
    }
  },
};
