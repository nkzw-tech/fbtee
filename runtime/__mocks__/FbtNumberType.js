/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 *
 * @flow strict-local
 * @format
 * @oncall i18n_fbt_js
 */
import {
  NUMBER_ONE,
  NUMBER_OTHER,
  type IntlVariationsEnum,
} from '../IntlVariations';

const FbtNumberType: {
  getVariation: JestMockFn<$ReadOnlyArray<number>, IntlVariationsEnum>,
} = {
  getVariation: jest.fn<$ReadOnlyArray<number>, IntlVariationsEnum>(
    (n: number) =>
      // English plural rules (AKA IntlCLDRNumberType05 in CLDR v34)
      n === 1 ? NUMBER_ONE : NUMBER_OTHER
  ),
};

export default FbtNumberType;
