/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 *
 * @flow strict
 */

export default function escapeRegex(str: string): string {
  return str.replace(/([.?*+\^$\[\]\\(){}|\-])/g, '\\$1');
}
