import IntlVariations from '../IntlVariations';

export default {
  getVariation(
    n: number
  ): (typeof IntlVariations)[keyof typeof IntlVariations] {
    return n === 0 || n === 1 ? IntlVariations.NUMBER_ONE : IntlVariations.NUMBER_OTHER;
  },
};
