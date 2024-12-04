/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @generated SignedSource<<7a6ad6c1331bd64aea0911ba77a826c5>>
 *
 * @flow strict
 */

'use strict';

import IntlVariations from '../IntlVariations';

export default {
  getVariation(n: number): $Values<typeof IntlVariations> {
    if (n === 0) {
      return IntlVariations.NUMBER_ZERO;
    } else if (n === 1) {
      return IntlVariations.NUMBER_ONE;
    } else if (n === 2) {
      return IntlVariations.NUMBER_TWO;
    } else if (n === 3) {
      return IntlVariations.NUMBER_FEW;
    } else if (n === 6) {
      return IntlVariations.NUMBER_MANY;
    } else {
      return IntlVariations.NUMBER_OTHER;
    }
  },
};
