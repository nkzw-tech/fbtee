import fbt, { PluginOptions } from 'babel-plugin-fbt';
import fbtRuntime from 'babel-plugin-fbt-runtime';

export default function preset(_: unknown, options: PluginOptions) {
  return {
    plugins: [[fbt, options], fbtRuntime],
  };
}
