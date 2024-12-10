import type { IntlVariationsEnum } from '../IntlVariations';

export default {
  getFallback(): IntlVariationsEnum {
    return 12;
  },

  getNumberVariations(): Array<IntlVariationsEnum> {
    return [4, 20, 12, 24];
  },
};
