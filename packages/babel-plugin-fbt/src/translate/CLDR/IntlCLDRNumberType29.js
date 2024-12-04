/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @generated SignedSource<<f538641121d4da29a1d30daa44820bb8>>
 *
 * @flow strict
 */

'use strict';

import type { IntlVariationsEnum } from '../IntlVariations';

export default {
  getNumberVariations(): Array<IntlVariationsEnum> {
    // $FlowExpectedError[incompatible-return] Force cast numbers to IntlVariationsEnum
    return [4, 20, 12, 24];
  },

  getFallback(): IntlVariationsEnum {
    // $FlowExpectedError[incompatible-return] Force cast number to IntlVariationsEnum
    return 24;
  },
};
