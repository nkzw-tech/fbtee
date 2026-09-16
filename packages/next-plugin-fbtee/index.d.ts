import type { TransformOptions } from '@nkzw/fbtee-compiler';
import type { NextConfig } from 'next';

export type FbteeNextPluginOptions = Omit<TransformOptions, 'lang' | 'sourcemap' | 'sourceType'>;

export declare const withFbtee: (
  options?: FbteeNextPluginOptions,
) => (nextConfig?: NextConfig) => NextConfig;

export default withFbtee;
