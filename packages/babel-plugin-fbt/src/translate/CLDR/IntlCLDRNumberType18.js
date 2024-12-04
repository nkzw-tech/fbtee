/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @generated SignedSource<<1d115ddf79ba56b1d145531dc138c672>>
 *
 * @flow strict
 */

'use strict';

import type { IntlVariationsEnum } from '../IntlVariations';

const IntlCLDRNumberType18 = {
  getNumberVariations(): Array<IntlVariationsEnum> {
    // $FlowExpectedError[incompatible-return] Force cast numbers to IntlVariationsEnum
    return [4, 20, 24];
  },

  getFallback(): IntlVariationsEnum {
    // $FlowExpectedError[incompatible-return] Force cast number to IntlVariationsEnum
    return 24;
  },
};

module.exports = IntlCLDRNumberType18;
