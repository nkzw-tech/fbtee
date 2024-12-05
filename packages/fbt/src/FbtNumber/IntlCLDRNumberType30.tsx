/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @generated SignedSource<<8a1554c32dc310dee308c0fcf84b918e>>
 *
 * @flow strict
 */


import IntlVariations from '../IntlVariations';

export default {
  getVariation(n: number): typeof IntlVariations[keyof typeof IntlVariations] {
    if (n % 10 === 1 && n % 100 !== 11) {
      return IntlVariations.NUMBER_ONE;
    } else if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) {
      return IntlVariations.NUMBER_FEW;
    } else {
      return IntlVariations.NUMBER_MANY;
    }
  },
};
