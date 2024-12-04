/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @generated SignedSource<<82e94583b2ec6421c459d1b49290bde0>>
 *
 * @flow strict
 */

'use strict';

import IntlVariations from '../IntlVariations';

const IntlCLDRNumberType23 = {
  getVariation(n: number): $Values<typeof IntlVariations> {
    if (n % 100 === 1) {
      return IntlVariations.NUMBER_ONE;
    } else if (n % 100 === 2) {
      return IntlVariations.NUMBER_TWO;
    } else if (n % 100 >= 3 && n % 100 <= 4) {
      return IntlVariations.NUMBER_FEW;
    } else {
      return IntlVariations.NUMBER_OTHER;
    }
  },
};

export default IntlCLDRNumberType23;
