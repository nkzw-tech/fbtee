import IntlVariations from '../IntlVariations.tsx';

export default {
  getVariation(n: number): IntlVariations {
    return n === 0 || n === 1
      ? IntlVariations.NUMBER_ONE
      : IntlVariations.NUMBER_OTHER;
  },
};
