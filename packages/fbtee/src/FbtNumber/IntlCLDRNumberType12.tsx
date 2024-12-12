import IntlVariations from '../IntlVariations.tsx';

export default {
  getVariation(n: number): IntlVariations {
    return n % 10 === 1 && n % 100 !== 11
      ? IntlVariations.NUMBER_ONE
      : IntlVariations.NUMBER_OTHER;
  },
};
