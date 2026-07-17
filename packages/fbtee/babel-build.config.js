import babelSyntaxJSX from '@babel/plugin-syntax-jsx';
import babelSyntaxTypescript from '@babel/plugin-syntax-typescript';
import babelFbtee from '../babel-plugin-fbtee/lib/index.mjs';

export default {
  plugins: [babelFbtee, babelSyntaxJSX, babelSyntaxTypescript],
};
