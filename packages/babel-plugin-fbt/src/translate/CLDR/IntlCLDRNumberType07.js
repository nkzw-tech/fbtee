/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @generated SignedSource<<e6a66698d091ba52687fa7a62a04402a>>
 *
 * @flow strict
 */

'use strict';

import type { IntlVariationsEnum } from '../IntlVariations';

export default {
  getNumberVariations(): Array<IntlVariationsEnum> {
    // $FlowExpectedError[incompatible-return] Force cast numbers to IntlVariationsEnum
    return [4, 24];
  },

  getFallback(): IntlVariationsEnum {
    // $FlowExpectedError[incompatible-return] Force cast number to IntlVariationsEnum
    return 24;
  },
};
