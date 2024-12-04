/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @generated SignedSource<<f51eb049ddb11aca65cebf04561ada92>>
 *
 * @flow strict
 */

'use strict';

import IntlVariations from '../IntlVariations';

export default {
  getVariation(n: number): $Values<typeof IntlVariations> {
    if ((n >= 0 && n <= 1) || (n >= 11 && n <= 99)) {
      return IntlVariations.NUMBER_ONE;
    } else {
      return IntlVariations.NUMBER_OTHER;
    }
  },
};
