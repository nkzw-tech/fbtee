/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @generated SignedSource<<49dca20390077055c51a6d31d2ed663f>>
 *
 * @flow strict
 */

'use strict';

import IntlVariations from '../IntlVariations';

export default {
  getVariation(n: number): $Values<typeof IntlVariations> {
    if (n === 1) {
      return IntlVariations.NUMBER_ONE;
    } else {
      return IntlVariations.NUMBER_OTHER;
    }
  },
};
