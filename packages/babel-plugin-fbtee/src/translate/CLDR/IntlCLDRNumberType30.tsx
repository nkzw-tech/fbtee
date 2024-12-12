import type { IntlVariations } from '../IntlVariations.tsx';

export default {
  getFallback(): IntlVariations {
    return 12;
  },

  getNumberVariations(): Array<IntlVariations> {
    return [4, 20, 12, 24];
  },
};
