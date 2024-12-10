import IntlVariations from '../IntlVariations.tsx';

export default {
  getVariation(
    n: number
  ): (typeof IntlVariations)[keyof typeof IntlVariations] {
    return n === 1 ? IntlVariations.NUMBER_ONE : IntlVariations.NUMBER_OTHER;
  },
};
