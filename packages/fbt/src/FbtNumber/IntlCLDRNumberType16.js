/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @generated SignedSource<<160b4ecd07e5e85b31efb814762013f1>>
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
    } else {
      return IntlVariations.NUMBER_OTHER;
    }
  },
};
