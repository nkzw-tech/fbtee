/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @generated SignedSource<<55cde8b93ebc79b8f4869f84ef52703b>>
 *
 * @flow strict
 */


import IntlVariations from '../IntlVariations';

export default {
  getVariation(n: number): typeof IntlVariations[keyof typeof IntlVariations] {
    if (n === 1) {
      return IntlVariations.NUMBER_ONE;
    } else if (n === 2) {
      return IntlVariations.NUMBER_TWO;
    } else if ((n < 0 || n > 10) && n % 10 === 0) {
      return IntlVariations.NUMBER_MANY;
    } else {
      return IntlVariations.NUMBER_OTHER;
    }
  },
};
