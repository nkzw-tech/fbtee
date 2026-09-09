import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { collectBatchSync, collectSync, transformSync, translateSync } from '../index.js';

const options = { collectPackager: 'both', lang: 'tsx' };
const repeat = (source, count) => `import { fbt } from 'fbtee';\n${source.repeat(count)}`;
const simple = repeat(`fbt('Hello world', 'Greeting');\n`, 200);
const nested = repeat(
  `<fbt desc="Greeting">Hello <b><fbt:param name="user">{user}</fbt:param></b>, you have <fbt:plural count={count} showCount="yes">message</fbt:plural>.</fbt>;\n`,
  40,
);
const example = readFileSync(
  new URL('../../../example/src/example/Example.tsx', import.meta.url),
  'utf8',
);
const exampleOptions = {
  ...options,
  fbtCommon: JSON.parse(
    readFileSync(new URL('../../../example/common_strings.json', import.meta.url), 'utf8'),
  ),
  fbtEnumManifest: {
    Example$FbtEnum: { LINK: 'link', PAGE: 'page', PHOTO: 'photo', POST: 'post', VIDEO: 'video' },
  },
};
const checked = (result) => {
  assert.deepEqual(result.errors, []);
  return result;
};
const cases = [];
for (const [name, padding] of [
  ['ascii', 'padding '],
  ['unicode', '日本語 😀 '],
]) {
  const source = `/*${padding.repeat(60_000)}*/\n${simple}`;
  cases.push([`collect/large-${name}`, () => collectSync('source.tsx', source, options)]);
}
cases.push([
  'collect/example-text',
  () =>
    collectSync('source.tsx', example, {
      ...exampleOptions,
      collectPackager: 'text',
    }),
]);
for (const [name, source, config] of [
  ['simple', simple, options],
  ['nested', nested, options],
  [
    'variations',
    repeat(
      `fbt([fbt.enum(kind, {a: 'Alpha', b: 'Beta', c: 'Gamma'}), ' ', fbt.plural('item', count, {showCount: 'yes'}), ' for ', fbt.pronoun('object', gender)], 'Inventory');\n`,
      40,
    ),
    options,
  ],
  ['example', example, exampleOptions],
  ['call-options', repeat(`fbt('Hello', 'Greeting', {preserveWhitespace: true});\n`, 200), options],
  ['subject', repeat(`fbt('Hello', 'Greeting', {subject: viewer.gender});\n`, 200), options],
  [
    'jsx-subject',
    repeat(`<fbt desc="Greeting" subject={viewer.gender}>Hello</fbt>;\n`, 200),
    options,
  ],
]) {
  for (const [operation, run] of [
    ['transform', transformSync],
    ['collect', collectSync],
  ]) {
    cases.push([`${operation}/${name}`, () => run('source.tsx', source, config)]);
  }
}
for (const count of [1, 32]) {
  const files = Array.from({ length: count }, (_, index) => ({
    filename: `source-${index}.tsx`,
    sourceText: nested,
  }));
  cases.push([`collect/batch-${count}`, () => collectBatchSync(files, options)]);
}
for (const count of [0, 1, 4, 32]) {
  const files = Array.from({ length: count }, (_, index) => ({
    filename: `source-${index}.tsx`,
    sourceText: `fbt('Hello', 'Greeting');`,
  }));
  cases.push([`collect/tiny-batch-${count}`, () => collectBatchSync(files, options)]);
}
const manifestOptions = {
  ...options,
  fbtCommon: Object.fromEntries(
    Array.from({ length: 2000 }, (_, i) => [`Text ${i}`, `Description ${i}`]),
  ),
  fbtEnumManifest: Object.fromEntries(
    Array.from({ length: 100 }, (_, i) => [
      `Enum${i}$FbtEnum`,
      Object.fromEntries(Array.from({ length: 10 }, (_, j) => [`KEY_${j}`, `Value ${j}`])),
    ]),
  ),
};
const manifestFiles = Array.from({ length: 32 }, (_, index) => ({
  filename: `source-${index}.tsx`,
  sourceText: `import E from './Enum0$FbtEnum'; fbt(fbt.enum(value, E), 'Greeting'); fbt.c('Text 0');`,
}));
cases.push(
  [
    'transform/large-manifest',
    () => transformSync('source.tsx', manifestFiles[0].sourceText, manifestOptions),
  ],
  ['collect/large-manifest-batch', () => collectBatchSync(manifestFiles, manifestOptions)],
);
const { phrases } = JSON.parse(checked(collectSync('source.tsx', nested, options)).output);
for (const count of [1, 20]) {
  const input = JSON.stringify({
    phrases,
    translationGroups: Array.from({ length: count }, (_, index) => ({
      '__output-locale': `locale-${index}`,
      'fb-locale': 'en_US',
      translations: {},
    })),
  });
  cases.push([`translate/${count}-locales`, () => translateSync(input)]);
}

const results = [];
for (const [name, run] of cases) {
  const output = run();
  if (typeof output !== 'string') {
    checked(output);
  }
  const digest = createHash('sha256').update(JSON.stringify(output)).digest('hex');
  for (let i = 0; i < 10; i++) {
    run();
  }
  const samples = [];
  for (let sample = 0; sample < 9; sample++) {
    let iterations = 0;
    const start = performance.now();
    do {
      run();
      iterations++;
    } while (performance.now() - start < 100);
    samples.push((performance.now() - start) / iterations);
  }
  samples.sort((a, b) => a - b);
  results.push({ digest, maxMs: samples[8], medianMs: samples[4], minMs: samples[0], name });
}
process.stdout.write(
  `${JSON.stringify({ arch: process.arch, node: process.version, results }, null, 2)}\n`,
);
