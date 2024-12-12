import type { IntlVariations } from '../IntlVariations.tsx';

export default {
  getFallback(): IntlVariations {
    return 24;
  },

  getNumberVariations(): Array<IntlVariations> {
    return [16, 4, 8, 20, 12, 24];
  },
};
