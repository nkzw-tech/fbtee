import type {IntlVariationsEnum} from '../IntlVariations';

export default {
  getNumberVariations(): Array<IntlVariationsEnum> {
    return [16, 4, 8, 20, 12, 24];
  },

  getFallback(): IntlVariationsEnum {
    return 24;
  },
};
