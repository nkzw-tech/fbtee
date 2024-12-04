/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @generated SignedSource<<4e8458a096d50d9a8723d5b73206a769>>
 *
 * @flow strict
 */

'use strict';

import IntlVariations from '../IntlVariations';

export default {
  getVariation(n: number): $Values<typeof IntlVariations> {
    if (n === 1) {
      return IntlVariations.NUMBER_ONE;
    } else if (n === 0 || (n % 100 >= 2 && n % 100 <= 10)) {
      return IntlVariations.NUMBER_FEW;
    } else if (n % 100 >= 11 && n % 100 <= 19) {
      return IntlVariations.NUMBER_MANY;
    } else {
      return IntlVariations.NUMBER_OTHER;
    }
  },
};
