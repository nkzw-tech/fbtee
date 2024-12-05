import type {IntlVariationsEnum} from '../IntlVariations';

export default {
  getNumberVariations(): Array<IntlVariationsEnum> {
    return [16, 4, 24];
  },

  getFallback(): IntlVariationsEnum {
    return 24;
  },
};
