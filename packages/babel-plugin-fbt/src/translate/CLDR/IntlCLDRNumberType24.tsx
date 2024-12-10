import type { IntlVariationsEnum } from '../IntlVariations.tsx';

export default {
  getFallback(): IntlVariationsEnum {
    return 24;
  },

  getNumberVariations(): Array<IntlVariationsEnum> {
    return [4, 8, 12, 24];
  },
};
