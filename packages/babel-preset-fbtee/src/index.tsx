import fbt, { PluginOptions } from '@nkzw/babel-plugin-fbtee';
import autoImport from '@nkzw/babel-plugin-fbtee-auto-import';

export default function preset(
  _: unknown,
  options: PluginOptions & { disableAutoImport?: boolean },
) {
  return {
    plugins: [
      ...(options?.disableAutoImport ? [] : [autoImport]),
      [fbt, options],
    ],
  };
}
