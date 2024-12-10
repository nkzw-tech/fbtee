import IntlVariations from '../IntlVariations';

export default {
  getVariation(
    n: number
  ): (typeof IntlVariations)[keyof typeof IntlVariations] {
    return n % 10 === 1 && n % 100 !== 11 ? IntlVariations.NUMBER_ONE : IntlVariations.NUMBER_OTHER;
  },
};
