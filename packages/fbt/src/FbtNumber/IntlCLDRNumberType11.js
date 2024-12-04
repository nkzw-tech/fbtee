/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @generated SignedSource<<6e1edc22da35b87f08bfe3fa18814243>>
 *
 * @flow strict
 */

'use strict';

import IntlVariations from '../IntlVariations';

const IntlCLDRNumberType11 = {
  getVariation(n: number): $Values<typeof IntlVariations> {
    if (n % 10 === 1 && n % 100 !== 11) {
      return IntlVariations.NUMBER_ONE;
    } else {
      return IntlVariations.NUMBER_OTHER;
    }
  },
};

export default IntlCLDRNumberType11;
