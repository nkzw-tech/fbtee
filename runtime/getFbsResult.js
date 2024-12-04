/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 *
 * @flow strict-local
 */
import type { FbtResolvedPayload } from './FbtHooks';

const FbtPureStringResult = require('./FbtPureStringResult');

/**
 * This factory function lives in standalone and not hanging off of
 * FbtPureStringResult because our libdef definitions are a little
 * convoluted right now.
 */
function getFbsResult(input: FbtResolvedPayload): mixed {
  return new FbtPureStringResult(input.contents, input.errorListener);
}

module.exports = getFbsResult;
