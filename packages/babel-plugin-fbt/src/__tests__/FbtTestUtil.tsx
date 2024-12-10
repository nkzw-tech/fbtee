import { PluginOptions, transformSync } from '@babel/core';
import prettier from 'prettier';
import { SENTINEL } from '../FbtConstants';
import presetReact from '@babel/preset-react';
import presetTypeScript from '@babel/preset-typescript';
import fbt from '../index';
import syntaxJSX from '@babel/plugin-syntax-jsx';

export function payload(obj: Record<string, unknown>): string {
  return JSON.stringify(
    `__FBT__${JSON.stringify({ ...obj, project: obj.project || '' })}__FBT__`
  );
}

export function transform(source: string, pluginOptions?: PluginOptions) {
  return (
    transformSync(source, {
      ast: false,
      filename: 'source.js',
      plugins: [
        [fbt, pluginOptions],
      ],
      presets: [presetTypeScript, presetReact],
      sourceType: 'module',
    })?.code || ''
  );
}

export function snapshotTransform(
  source: string,
  pluginOptions?: PluginOptions
): string {
  return transform(source, { fbtBase64: true, ...pluginOptions });
}

async function transformKeepJsx(
  source: string,
  pluginOptions?: PluginOptions
): Promise<string> {
  return prettier.format(
    transformSync(source, {
      ast: false,
      filename: 'source.js',
      plugins: [
        syntaxJSX,
        [fbt, pluginOptions],
      ],
      presets: [presetTypeScript],
      sourceType: 'module',
    })?.code || '',
    { parser: 'babel' }
  );
}

export const snapshotTransformKeepJsx = (
  source: string,
  pluginOptions?: PluginOptions
): Promise<string> =>
  transformKeepJsx(source, { fbtBase64: true, ...pluginOptions });

export function withFbsRequireStatement(code: string): string {
  return `const fbs = require("fbs");
  ${code}`;
}

export function withFbtRequireStatement(code: string): string {
  return `const fbt = require("fbt");
  ${code}`;
}

const fbtSentinelRegex = /(["'])__FBT__(.*?)__FBT__\1/gm;

/**
 * Serialize JS source code that contains fbt client-side code.
 * For readability, the JSFBT payload is deconstructed and the FBT sentinels are
 * replaced by inline comments.
 * Usage: see https://jestjs.io/docs/en/expect#expectaddsnapshotserializerserializer
 */
export const jsCodeFbtCallSerializer = {
  serialize(rawValue: string) {
    const decoded = rawValue.replaceAll(
      fbtSentinelRegex,
      (_match, _quote, body) => {
        const json = Buffer.from(body, 'base64').toString('utf8');
        return `/* ${SENTINEL} start */ ${json} /* ${SENTINEL} end */`;
      }
    );
    return prettier.format(decoded, { parser: 'babel' });
  },

  test(rawValue: unknown): rawValue is string {
    return typeof rawValue === 'string';
  },
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
      (char) => String.raw`\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
    );
  },

  test(rawValue: unknown): rawValue is string {
    return typeof rawValue === 'string';
  },
} as const;
