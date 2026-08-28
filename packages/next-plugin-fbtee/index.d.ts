import type { TransformOptions } from '@nkzw/oxc-transform-fbtee';
import type { NextConfig } from 'next';

export type FbteeNextPluginOptions = Omit<TransformOptions, 'lang' | 'sourcemap' | 'sourceType'>;

export declare const withFbtee: (
  options?: FbteeNextPluginOptions,
) => (nextConfig?: NextConfig) => NextConfig;

export default withFbtee;
