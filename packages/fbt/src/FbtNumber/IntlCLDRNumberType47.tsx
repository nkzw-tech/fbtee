import IntlVariations from '../IntlVariations.tsx';

export default {
  getVariation(n: number): IntlVariations {
    if (n % 10 === 0 || (n % 100 >= 11 && n % 100 <= 19)) {
      return IntlVariations.NUMBER_ZERO;
    } else if (n % 10 === 1 && n % 100 !== 11) {
      return IntlVariations.NUMBER_ONE;
    } else {
      return IntlVariations.NUMBER_OTHER;
    }
  },
};
