import babelSyntaxTypescript from '@babel/plugin-syntax-typescript';
import babelFbtee from '../babel-plugin-fbtee/lib/index.js';

export default {
  plugins: [babelFbtee, [babelSyntaxTypescript, { isTSX: true }]],
};
