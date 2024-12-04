/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @generated SignedSource<<d84e21ac42a62e4f546661c61b0019e5>>
 *
 * @flow strict
 */

'use strict';

import IntlVariations from '../IntlVariations';

const IntlCLDRNumberType04 = {
  getVariation(n: number): $Values<typeof IntlVariations> {
    if (n >= 0 && n <= 1) {
      return IntlVariations.NUMBER_ONE;
    } else {
      return IntlVariations.NUMBER_OTHER;
    }
  },
};

export default IntlCLDRNumberType04;
