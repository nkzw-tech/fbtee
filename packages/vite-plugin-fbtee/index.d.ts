import type { TransformOptions } from '@nkzw/oxc-transform-fbtee';
import type { Plugin } from 'vite';

export type FbteeVitePluginOptions = Omit<TransformOptions, 'lang' | 'sourcemap' | 'sourceType'>;

export declare const fbtee: (options?: FbteeVitePluginOptions) => Plugin;

export default fbtee;
