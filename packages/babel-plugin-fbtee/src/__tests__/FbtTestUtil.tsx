import { PluginOptions, transformSync } from '@babel/core';
import generate from '@babel/generator';
import { parse as babelParse } from '@babel/parser';
import syntaxJSX from '@babel/plugin-syntax-jsx';
import presetReact from '@babel/preset-react';
import presetTypeScript from '@babel/preset-typescript';
import { Node } from '@babel/types';
import { expect } from '@jest/globals';
import prettier from 'prettier-2';
import { SENTINEL } from '../FbtConstants.tsx';
import fbt from '../index.tsx';

export function payload(obj: Record<string, unknown>): string {
  return JSON.stringify(
    `__FBT__${JSON.stringify({ ...obj, project: obj.project || '' })}__FBT__`,
  );
}

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
  return transform(source, { fbtBase64: true, ...pluginOptions });
}

function transformKeepJsx(source: string, pluginOptions?: PluginOptions) {
  return prettier.format(
    transformSync(source, {
      ast: false,
      filename: 'source.js',
      plugins: [syntaxJSX, [fbt, pluginOptions]],
      presets: [presetTypeScript],
      sourceType: 'module',
    })?.code || '',
    { parser: 'babel' },
  );
}

export const snapshotTransformKeepJsx = (
  source: string,
  pluginOptions?: PluginOptions,
) => transformKeepJsx(source, { fbtBase64: true, ...pluginOptions });

export function withFbsImportStatement(code: string): string {
  return `import { fbs } from "fbtee";
  ${code}`;
}

export function withFbtImportStatement(code: string): string {
  return `import { fbt } from "fbtee";
  ${code}`;
}

/**
 * Serialize JS source code that contains fbt client-side code.
 * For readability, the JSFBT payload is deconstructed and the FBT sentinels are
 * replaced by inline comments.
 * Usage: see https://jestjs.io/docs/en/expect#expectaddsnapshotserializerserializer
 */
export const jsCodeFbtCallSerializer = {
  serialize(rawValue: string) {
    const decoded = rawValue.replaceAll(
      /(["'])__FBT__(.*?)__FBT__\1/gm,
      (_match, _quote, body) => {
        const json = Buffer.from(body, 'base64').toString('utf8');
        return `/* ${SENTINEL} start */ ${json} /* ${SENTINEL} end */`;
      },
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
      (char) =>
        String.raw`\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
    );
  },

  test(rawValue: unknown): rawValue is string {
    return typeof rawValue === 'string';
  },
} as const;

type Options = Readonly<{
  comments?: boolean;
  matchSnapshot?: boolean;
}>;

type TestCase = Readonly<{
  input: string;
  options?: Record<string, unknown>;
  output?: string;
  throws?: boolean | string;
}>;

type TestCases = Record<string, TestCase>;

const IGNORE_KEYS = [
  '__clone',
  'start',
  'end',
  'raw',
  'rawValue',
  'loc',
  'tokens',
  'parenthesized',
  'parenStart',
];

function stripMeta(node: Node, options?: Options) {
  const ignoreKeys = options?.comments
    ? [...IGNORE_KEYS]
    : [...IGNORE_KEYS, 'leadingComments', 'trailingComments'];
  for (const key of ignoreKeys) {
    // @ts-expect-error
    delete node[key];
  }

  for (const p of Object.keys(node)) {
    // @ts-expect-error
    const entry = node[p];
    if (entry && typeof entry === 'object') {
      stripMeta(entry, options);
    }
  }
  return node;
}

function parse(code: string) {
  if ((typeof code !== 'string' && typeof code !== 'object') || code == null) {
    throw new Error(
      `Code must be a string or AST object but got: ${typeof code}`,
    );
  }
  return babelParse(code, {
    plugins: ['typescript', 'jsx', 'nullishCoalescingOperator'],
    sourceType: 'module',
  });
}

function generateFormattedCodeFromAST(node: Node) {
  return generate.default(node, { comments: true }, '').code.trim();
}

function formatSourceCode(input: string) {
  return generateFormattedCodeFromAST(parse(input));
}

function firstCommonSubstring(left: string, right: string) {
  let i = 0;
  for (i = 0; i < left.length && i < right.length; i++) {
    if (left.charAt(i) !== right.charAt(i)) {
      break;
    }
  }
  return left.slice(0, Math.max(0, i));
}

function normalizeSourceCode(sourceCode: string) {
  return generate
    .default(
      parse(sourceCode),
      {
        comments: true,
      },
      sourceCode,
    )
    .code.trim();
}

const indent = (code: string) =>
  code
    .split('\n')
    .map((line) => ' '.repeat(2) + line)
    .join('\n');

function assertSourceAstEqual(
  expected: string,
  actual: string,
  options?: Options,
) {
  const expectedTree = stripMeta(
    parse(normalizeSourceCode(expected)).program,
    options,
  );
  const actualTree = stripMeta(
    parse(normalizeSourceCode(actual)).program,
    options,
  );
  try {
    expect(actualTree).toStrictEqual(expectedTree);
  } catch (error) {
    const expectedFormattedCode = formatSourceCode(expected);
    const receivedFormattedCode = formatSourceCode(actual);
    const commonStr = firstCommonSubstring(
      expectedFormattedCode,
      receivedFormattedCode,
    );
    const excerptLength = 60;
    const excerptDiffFromExpected = expectedFormattedCode.slice(
      commonStr.length,
      commonStr.length + excerptLength,
    );
    const excerptDiffFromReceived = receivedFormattedCode.slice(
      commonStr.length,
      commonStr.length + excerptLength,
    );

    throw new Error(`${error instanceof Error ? `${error.message}\n` : ``}}
Expect nodes to be equal but received:

Expected output:

${indent(expectedFormattedCode)}
Received output:

${indent(receivedFormattedCode)}

Excerpt of the difference:
Expected:

${indent(excerptDiffFromExpected)}
Received:

${indent(excerptDiffFromReceived)}
`);
  }
}

export function testSection(
  testData: TestCases,
  transform: (source: string, options?: Options) => string,
  options?: Options,
) {
  Object.entries(testData).forEach(([title, testInfo]) => {
    test(title, () => {
      if (testInfo.throws === true) {
        expect(() => transform(testInfo.input, testInfo.options)).toThrow();
      } else if (typeof testInfo.throws === 'string') {
        expect(() => transform(testInfo.input, testInfo.options)).toThrow(
          testInfo.throws,
        );
      } else {
        expect(() => {
          const transformOutput = transform(testInfo.input, testInfo.options);
          if (options?.matchSnapshot) {
            expect(transformOutput).toMatchSnapshot();
          } else if (testInfo.output) {
            assertSourceAstEqual(testInfo.output, transformOutput, options);
          }
        }).not.toThrow();
      }
    });
  });
}
