import type { PluginItem, PresetAPI, PresetObject } from '@babel/core';
import fbt, { PluginOptions } from '@nkzw/babel-plugin-fbtee';
import autoImport from '@nkzw/babel-plugin-fbtee-auto-import';

export default function preset(
  _: PresetAPI,
  options: PluginOptions & { disableAutoImport?: boolean },
): PresetObject {
  return {
    plugins: [
      ...(options?.disableAutoImport ? [] : [autoImport as PluginItem]),
      [fbt, options] as PluginItem,
    ],
  };
}
