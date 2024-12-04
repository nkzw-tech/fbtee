/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 *
 * @flow strict-local
 */
import type { FbtResolvedPayload } from './FbtHooks';
import FbtPureStringResult from './FbtPureStringResult';

export default function getFbsResult(input: FbtResolvedPayload): mixed {
  return new FbtPureStringResult(input.contents, input.errorListener);
}
