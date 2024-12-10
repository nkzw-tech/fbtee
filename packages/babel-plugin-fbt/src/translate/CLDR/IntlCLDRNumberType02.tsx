import type { IntlVariations } from '../IntlVariations.tsx';

export default {
  getFallback(): IntlVariations {
    return 24;
  },

  getNumberVariations(): Array<IntlVariations> {
    return [4, 24];
  },
};
