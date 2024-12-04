/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @generated SignedSource<<dacfc0f94029ce38fcc287d049f61565>>
 *
 * @flow strict
 */

'use strict';

const IntlVariations = require('../IntlVariations');

const IntlCLDRNumberType40 = {
  getVariation(n: number): $Values<typeof IntlVariations> {
    if (n === 1) {
      return IntlVariations.NUMBER_ONE;
    } else if (n === 2) {
      return IntlVariations.NUMBER_TWO;
    } else {
      return IntlVariations.NUMBER_OTHER;
    }
  },
};

module.exports = IntlCLDRNumberType40;
