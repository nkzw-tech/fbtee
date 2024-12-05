import type {IntlVariationsEnum} from '../IntlVariations';

export default {
  getNumberVariations(): Array<IntlVariationsEnum> {
    return [4, 24];
  },

  getFallback(): IntlVariationsEnum {
    return 24;
  },
};
