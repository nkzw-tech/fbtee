import babelSyntaxTypescript from '@babel/plugin-syntax-typescript';
import babelFbteeRuntime from '../babel-plugin-fbtee-runtime/lib/index.js';
import babelFbtee from '../babel-plugin-fbtee/lib/index.js';

export default {
  plugins: [
    babelFbtee,
    babelFbteeRuntime,
    [babelSyntaxTypescript, { isTSX: true }],
  ],
};
