/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @generated SignedSource<<12aed717959427147365c881ac304798>>
 *
 * @flow strict
 */

'use strict';

import IntlVariations from '../IntlVariations';

export default {
  getVariation(n: number): $Values<typeof IntlVariations> {
    if (n === 1) {
      return IntlVariations.NUMBER_ONE;
    } else if (n >= 2 && n <= 4) {
      return IntlVariations.NUMBER_FEW;
    } else {
      return IntlVariations.NUMBER_OTHER;
    }
  },
};
