/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @generated SignedSource<<9a601435b386941abfcd73250fb0462e>>
 *
 * @flow strict
 */


import IntlVariations from '../IntlVariations';

export default {
  getVariation(n: number): typeof IntlVariations[keyof typeof IntlVariations] {
    if (n % 10 === 1 && (n % 100 < 11 || n % 100 > 19)) {
      return IntlVariations.NUMBER_ONE;
    } else if (n % 10 >= 2 && n % 10 <= 9 && (n % 100 < 11 || n % 100 > 19)) {
      return IntlVariations.NUMBER_FEW;
    } else {
      return IntlVariations.NUMBER_OTHER;
    }
  },
};
