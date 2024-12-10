import IntlVariations from '../IntlVariations.tsx';

export default {
  getVariation(n: number): IntlVariations {
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
