import IntlVariations from '../IntlVariations.tsx';

export default {
  getVariation(
    n: number
  ): (typeof IntlVariations)[keyof typeof IntlVariations] {
    return IntlVariations.NUMBER_OTHER;
  },
};
