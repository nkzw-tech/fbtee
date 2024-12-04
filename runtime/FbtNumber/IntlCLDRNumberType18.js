/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @generated SignedSource<<3ac11a54b52d0aab15e7cd1493c051d2>>
 *
 * @flow strict
 */

'use strict';

const IntlVariations = require('../IntlVariations');

const IntlCLDRNumberType18 = {
  getVariation(n: number): $Values<typeof IntlVariations> {
    if (n === 0 || n === 1) {
      return IntlVariations.NUMBER_ONE;
    } else if (n >= 2 && n <= 10) {
      return IntlVariations.NUMBER_FEW;
    } else {
      return IntlVariations.NUMBER_OTHER;
    }
  },
};

module.exports = IntlCLDRNumberType18;
