import { PluginOptions, transformSync } from '@babel/core';
import syntaxJSX from '@babel/plugin-syntax-jsx';
import presetReact from '@babel/preset-react';
import presetTypeScript from '@babel/preset-typescript';
import prettier from 'prettier-2';
import fbt from '../index.tsx';

export function transform(source: string, pluginOptions?: PluginOptions) {
  return (
    transformSync(source, {
      ast: false,
      filename: 'source.js',
      plugins: [[fbt, pluginOptions]],
      presets: [presetTypeScript, presetReact],
      sourceType: 'module',
    })?.code || ''
  );
}

export function snapshotTransform(
  source: string,
  pluginOptions?: PluginOptions,
): string {
  return transform(source, pluginOptions);
}

const transformKeepJsx = (source: string, pluginOptions?: PluginOptions) =>
  prettier.format(
    transformSync(source, {
      ast: false,
      filename: 'source.js',
      plugins: [syntaxJSX, [fbt, pluginOptions]],
      presets: [presetTypeScript],
      sourceType: 'module',
    })?.code || '',
    { parser: 'babel' },
  );

export const snapshotTransformKeepJsx = (
  source: string,
  pluginOptions?: PluginOptions,
) => transformKeepJsx(source, pluginOptions);

export function withFbtImportStatement(code: string): string {
  return `import { fbt } from "fbtee";
  ${code}`;
}

export const jsCodeFbtCallSerializer = {
  serialize: (rawValue: string) =>
    prettier.format(rawValue, { parser: 'babel' }),
  test: (rawValue: unknown) => typeof rawValue === 'string',
} as const;

const nonASCIICharRegex = /[^\0-~]/g;
/**
 * Serialize JS source code that contains non-ASCII characters in unicode.
 * Non-ASCII characters in unicode string will be replaced with utf-8 representation.
 * E.g.'み' -> '\u307f'
 */
export const jsCodeNonASCIICharSerializer = {
  serialize(rawValue: unknown) {
    return JSON.stringify(rawValue).replaceAll(
      nonASCIICharRegex,
      (char) =>
        String.raw`\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
    );
  },

  test(rawValue: unknown): rawValue is string {
    return typeof rawValue === 'string';
  },
} as const;
