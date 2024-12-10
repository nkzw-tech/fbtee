import assert from 'node:assert';
import babel, { PluginItem } from '@babel/core';
import generate from '@babel/generator';
import { parse as babelParse } from '@babel/parser';
import { Node } from '@babel/types';
import jsonDiff from 'json-diff';

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
      `Code must be a string or AST object but got: ${typeof code}`
    );
  }
  return babelParse(code, {
    plugins: ['typescript', 'jsx', 'nullishCoalescingOperator'],
    sourceType: 'module',
  });
}

export function generateFormattedCodeFromAST(babelNode: Node) {
  return generate.default(babelNode, { comments: true }, '').code.trim();
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
      sourceCode
    )
    .code.trim();
}

/**
 * This function allows you to use mutliline template strings in your test
 * cases without worrying about non standard loc's. It does this by stripping
 * leading whitespace so the contents lines up based on the first lines
 * offset.
 */
export function stripCodeBlockWhitespace(code: string) {
  // Find standard whitespace offset for block
  const match = code.match(/(\n\s*)\S/);
  const strippedCode =
    match == null
      ? code
      : // Strip from each line
        code.replaceAll(new RegExp(match[1], 'g'), '\n');

  return strippedCode;
}

export function assertSourceAstEqual(
  expected: string,
  actual: string,
  options?: Options
) {
  const expectedTree = stripMeta(
    parse(normalizeSourceCode(expected)).program,
    options
  );
  const actualTree = stripMeta(
    parse(normalizeSourceCode(actual)).program,
    options
  );
  try {
    assert.deepStrictEqual(actualTree, expectedTree);
  } catch (error) {
    const expectedFormattedCode = formatSourceCode(expected);
    const actualFormattedCode = formatSourceCode(actual);
    const commonStr = firstCommonSubstring(
      expectedFormattedCode,
      actualFormattedCode
    );
    const excerptLength = 60;
    const excerptDiffFromExpected = expectedFormattedCode.slice(
      commonStr.length,
      commonStr.length + excerptLength
    );
    const excerptDiffFromActual = actualFormattedCode.slice(
      commonStr.length,
      commonStr.length + excerptLength
    );

    const errMessage = `deepEqual node AST assert failed for the following code:

Expected output: <<<${expectedFormattedCode}>>>

Actual output: <<<${actualFormattedCode}>>>

First common string: <<<${commonStr}>>>

The first difference is (${excerptLength} chars max):

Expected : <<<${excerptDiffFromExpected}>>>

Actual   : <<<${excerptDiffFromActual}>>>

AST diff:
====
${jsonDiff.diffString(expectedTree, actualTree)}
====
`;
    console.error(errMessage);

    const err = new Error(errMessage);
    if (error instanceof Error) {
      err.stack = error.stack;
    }
    throw err;
  }
}

export function testSectionAsync(
  testData: TestCases,
  transform: (
    source: string,
    options?: Record<string, unknown>
  ) => Promise<string>,
  options: Options
) {
  Object.entries(testData).forEach(([title, testInfo]) => {
    test(title, async () => {
      if (testInfo.throws === true) {
        await expect(
          transform(testInfo.input, testInfo.options)
        ).rejects.toThrow();
      } else if (typeof testInfo.throws === 'string') {
        await expect(
          transform(testInfo.input, testInfo.options)
        ).rejects.toThrow(testInfo.throws);
      } else {
        expect(
          (async () => {
            const transformOutput = await transform(
              testInfo.input,
              testInfo.options
            );
            if (options && options.matchSnapshot) {
              expect(transformOutput).toMatchSnapshot();
            } else if (testInfo.output) {
              assertSourceAstEqual(testInfo.output, transformOutput, options);
            }
            return true;
          })()
        ).resolves.toBe(true);
      }
    });
  });
}

export function testSection(
  testData: TestCases,
  transform: (source: string, options?: Options) => string,
  options?: Options
) {
  Object.entries(testData).forEach(([title, testInfo]) => {
    test(title, () => {
      if (testInfo.throws === true) {
        expect(() => transform(testInfo.input, testInfo.options)).toThrow();
      } else if (typeof testInfo.throws === 'string') {
        expect(() => transform(testInfo.input, testInfo.options)).toThrow(
          testInfo.throws
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

export function testCase(
  name: string,
  plugins: Array<PluginItem>,
  testData: TestCases,
  options: Options
) {
  describe(name, () =>
    testSection(
      testData,
      (source: string) =>
        babel.transformSync(source, {
          plugins,
        })?.code || '',
      options
    )
  );
}
