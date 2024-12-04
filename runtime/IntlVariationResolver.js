/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 *
 * @flow strict-local
 */
const FbtHooks = require('./FbtHooks');
const IntlNumberType = require('./IntlNumberType');
const IntlVariations = require('./IntlVariations');

const invariant = require('invariant');

const EXACTLY_ONE = '_1';

const IntlVariationResolver = {
  EXACTLY_ONE,

  getNumberVariations(number: number): Array<$FlowFixMe | string> {
    const numType = IntlNumberType.get(
      FbtHooks.getViewerContext().locale
    ).getVariation(number);
    invariant(
      // eslint-disable-next-line no-bitwise
      numType & IntlVariations.BITMASK_NUMBER,
      'Invalid number provided: %s (%s)',
      numType,
      typeof numType
    );
    return number === 1 ? [EXACTLY_ONE, numType, '*'] : [numType, '*'];
  },

  getGenderVariations(gender: number): Array<string | number> {
    invariant(
      // eslint-disable-next-line no-bitwise
      gender & IntlVariations.BITMASK_GENDER,
      'Invalid gender provided: %s (%s)',
      gender,
      typeof gender
    );
    return [gender, '*'];
  },
};

module.exports = IntlVariationResolver;
