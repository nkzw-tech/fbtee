import type { IntlVariationsEnum } from '../IntlVariations.tsx';

export default {
  getFallback(): IntlVariationsEnum {
    return 24;
  },

  getNumberVariations(): Array<IntlVariationsEnum> {
    return [16, 4, 8, 20, 12, 24];
  },
};
