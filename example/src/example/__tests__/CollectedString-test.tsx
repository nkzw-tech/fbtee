import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from '@jest/globals';
import { CollectFbtOutput } from '../../../../packages/babel-plugin-fbtee/src/bin/collect.tsx';

const { childParentMappings, phrases } = JSON.parse(
  readFileSync(
    join(import.meta.dirname, '../../../source_strings.json'),
    'utf8',
  ),
) as CollectFbtOutput;

test('fbtee strings are included in the collected strings of the example project', () => {
  expect(
    phrases.some(
      ({ filename }) => filename === 'node_modules/fbtee/lib/index.js',
    ),
  ).toBe(true);
});

test('fbtee child-parent mappings are included in the collected strings of the example project', () => {
  expect(childParentMappings).toMatchInlineSnapshot(`
{
  "14": 13,
  "23": 22,
  "24": 23,
  "40": 39,
  "49": 48,
  "50": 49,
}
`);
});
