/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 *
 * @flow
 * @noformat
 */

'use strict';

import babel from '@babel/core';

export default function transform(code, options, plugins, presets) {
  const { fbtModule, ...pluginOptions } = options;
  babel.transformSync(code, {
    ast: false,
    code: false,
    filename: options.filename,
    plugins: [...plugins, [fbtModule, pluginOptions]],
    presets,
    sourceType: 'unambiguous',
  });
}
