/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @generated SignedSource<<713aae9bdf777f1612906952821a264d>>
 *
 * @flow strict
 */

'use strict';

import type { IntlVariationsEnum } from '../IntlVariations';

export default {
  getNumberVariations(): Array<IntlVariationsEnum> {
    // $FlowExpectedError[incompatible-return] Force cast numbers to IntlVariationsEnum
    return [16, 4, 24];
  },

  getFallback(): IntlVariationsEnum {
    // $FlowExpectedError[incompatible-return] Force cast number to IntlVariationsEnum
    return 24;
  },
};
