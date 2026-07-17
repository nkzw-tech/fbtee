import { transformSync as transformSyncBabel8 } from '@babel/core';
// @ts-expect-error Babel 7 standalone does not ship TypeScript declarations.
import { transform as transformBabel7 } from '@babel/standalone';
import { describe, expect, it } from '@jest/globals';
import autoImport from '@nkzw/babel-plugin-fbtee-auto-import';
import fbtee from '../index.tsx';

const plugins = [autoImport, fbtee];

type Transform = (
  source: string,
  options: {
    babelrc: false;
    configFile: false;
    parserOpts: { plugins: Array<'jsx'> };
    plugins: Array<unknown>;
  },
) => { code?: string | null } | null;

const babelVersions = [
  ['Babel 7', transformBabel7 as unknown as Transform],
  ['Babel 8', transformSyncBabel8 as unknown as Transform],
] as const;

const transform = (
  transformSync: Transform,
  plugins: Array<unknown>,
  source: string,
) =>
  transformSync(source, {
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ['jsx'] },
    plugins,
  })?.code || '';

describe.each(babelVersions)('%s compatibility', (_, transformSync) => {
  it('transforms JSX and auto-imports fbtee', () => {
    const code = transform(
      transformSync,
      plugins,
      `<fbt desc="A greeting">Hello, world!</fbt>;`,
    );

    expect(code).toContain('import { fbt } from "fbtee";');
    expect(code).toContain('fbt._("Hello, world!"');
  });

  it('does not add a duplicate import for an existing binding', () => {
    const code = transform(
      transformSync,
      plugins,
      `import { fbt } from 'fbtee';
      <fbt desc="A greeting">Hello, world!</fbt>;`,
    );

    expect(code.match(/from ["']fbtee["']/g)).toHaveLength(1);
  });

  it('rejects nested calls in string variation arguments', () => {
    expect(() =>
      transform(
        transformSync,
        plugins,
        `import { fbt } from 'fbtee';
        fbt(
          [
            'There is ',
            <strong>
              {fbt.plural('item', condition ? getCount() : count)}
            </strong>,
          ],
          'A count',
        );`,
      ),
    ).toThrow(
      `Argument 'count' cannot contain a function call or class instantiation.`,
    );
  });
});
