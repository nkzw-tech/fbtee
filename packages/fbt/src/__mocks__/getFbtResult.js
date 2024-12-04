/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 *
 * @flow strict-local
 */

import type { FbtResolvedPayload } from '../FbtHooks';

export default function getFbtResult(input: FbtResolvedPayload): mixed {
  const contents = input.contents;
  return contents?.length === 1 && typeof contents[0] === 'string'
    ? contents[0]
    : contents;
}
