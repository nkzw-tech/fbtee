import fbt, { PluginOptions } from 'babel-plugin-fbt';
import autoImport from 'babel-plugin-fbt-auto-import';
import fbtRuntime from 'babel-plugin-fbt-runtime';

export default function preset(
  _: unknown,
  options: PluginOptions & { disableAutoImport?: boolean }
) {
  return {
    plugins: [
      ...(options?.disableAutoImport ? [] : [autoImport]),
      [fbt, options],
      fbtRuntime,
    ],
  };
}
