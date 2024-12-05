/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @generated SignedSource<<45937ad1bae1a030e8b39f85447135c1>>
 *
 * @flow strict
 */


import IntlVariations from '../IntlVariations';

export default {
  getVariation(n: number): typeof IntlVariations[keyof typeof IntlVariations] {
    if (n >= 0 && n <= 1) {
      return IntlVariations.NUMBER_ONE;
    } else {
      return IntlVariations.NUMBER_OTHER;
    }
  },
};
