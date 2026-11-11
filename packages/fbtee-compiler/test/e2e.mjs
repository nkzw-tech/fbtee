import assert from 'node:assert/strict';
// Source-map tracing is needed only by this package's end-to-end test.
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping';
// The downstream compiler is needed only by this package's end-to-end test.
import { transformSync as lowerSync } from 'oxc-transform';
import {
  collectBatchSync,
  collectSync,
  prepareTranslationsBatchSync,
  prepareTranslationsSync,
  transform,
  transformSync,
} from '../index.js';

const compile = (source, options = {}) => {
  const result = transformSync('source.tsx', source, {
    sourceType: 'module',
    ...options,
    lang: 'tsx',
  });
  assert.deepEqual(result.errors, []);
  return result.code;
};

const fakeRequire = (name) => {
  assert.equal(name, 'fbtee');
  return { _: () => 'ok' };
};

{
  for (const factory of ['createFbteeRuntime', 'useFbt']) {
    const source = `
      const { ${factory}: create } = require('fbtee');
      function message() {
        const { fbt, fbs } = create();
        return [fbt('Rich', 'Scoped CommonJS'), fbs('Plain', 'Scoped CommonJS')];
      }
    `;
    const code = compile(source, { sourceType: 'script' });
    const collected = collectSync('scoped.cjs', source, { sourceType: 'script' });
    assert.deepEqual(collected.errors, []);
    assert.equal(JSON.parse(collected.output).phrases.length, 2);
    const result = Function(
      'require',
      `${code}\nreturn message();`,
    )((name) => {
      assert.equal(name, 'fbtee');
      return {
        [factory]: () => ({
          fbs: { _: (text) => `plain: ${text}` },
          fbt: { _: (text) => `rich: ${text}` },
        }),
      };
    });
    assert.deepEqual(result, ['rich: Rich', 'plain: Plain']);
  }
}

{
  const options = { collectPackager: 'both', lang: 'tsx' };
  const files = [
    { filename: 'first.tsx', sourceText: `fbt('First', 'd');` },
    { filename: 'second.tsx', sourceText: `fbt('Second', 'd');` },
  ];
  const batched = collectBatchSync(files, options);
  assert.deepEqual(batched.errors, []);
  const output = JSON.parse(batched.output);
  assert.deepEqual(
    output.phrases.map(({ filename }) => filename),
    ['first.tsx', 'second.tsx'],
  );
  assert.deepEqual(
    output.phrases,
    files.flatMap(({ filename, sourceText }) => {
      const result = collectSync(filename, sourceText, options);
      assert.deepEqual(result.errors, []);
      return JSON.parse(result.output).phrases;
    }),
  );
}

{
  const options = {
    collectPackager: 'both',
    fbtCommon: { Hello: 'Greeting' },
    fbtEnumManifest: { Items$FbtEnum: { ONE: 'one', TWO: 'two' } },
    lang: 'tsx',
  };
  const sourceText = `
    import Items from './Items$FbtEnum';
    fbt.c('Hello');
    <fbt desc="Items"><b><fbt:enum enum-range={Items} value={item} /></b></fbt>;
  `;
  const first = { filename: 'first.tsx', sourceText };
  const single = collectSync(first.filename, first.sourceText, options);
  assert.deepEqual(single.errors, []);
  assert.deepEqual(collectBatchSync([first], options), single);
  assert.deepEqual(JSON.parse(collectBatchSync([], options).output), {
    childParentMappings: {},
    phrases: [],
  });

  const second = { filename: 'second.tsx', sourceText };
  const batch = collectBatchSync([first, second], options);
  assert.deepEqual(batch.errors, []);
  const output = JSON.parse(batch.output);
  assert.deepEqual(output.phrases, [
    ...JSON.parse(single.output).phrases,
    ...JSON.parse(collectSync(second.filename, second.sourceText, options).output).phrases,
  ]);
  assert.deepEqual(output.childParentMappings, { 2: 1, 5: 4 });

  const invalid = { filename: 'invalid.tsx', sourceText: `fbt.c('Missing');` };
  const error = collectSync(invalid.filename, invalid.sourceText, options);
  assert.notEqual(error.errors.length, 0);
  assert.deepEqual(collectBatchSync([invalid], options), error);
  assert.deepEqual(collectBatchSync([first, invalid, second], options), error);
}

{
  const source = JSON.stringify({
    phrases: [{ hashToLeaf: { hash: { desc: 'd', text: 'Text' } } }],
  });
  const inputs = [{ locale: 'de-DE' }, { locale: 'ja-JP' }];
  assert.deepEqual(
    prepareTranslationsBatchSync(source, inputs),
    inputs.map(({ locale }) => prepareTranslationsSync(source, undefined, locale)),
  );
}

{
  const source = `<fbt desc="Hidden counts">
    <fbt:plural count={a}>book</fbt:plural>
    <b><fbt:plural count={b} name="__plural_0">cat</fbt:plural></b>
    <fbt:plural count={c} name="number" showCount="no">bird</fbt:plural>
    <fbt:plural count={d} name="number" showCount="yes">dog</fbt:plural>
    <fbt:param name="__plural_0_1">{label}</fbt:param>
  </fbt>`;
  const options = { collectPackager: 'both' };
  const result = collectSync('plural.tsx', source, options);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(collectSync('plural.tsx', source, options), result);
  const { phrases } = JSON.parse(result.output);
  assert.equal(phrases.length, 2);
  const tokens = phrases[0].jsfbt.m.map(({ token }) => token);
  assert.equal(new Set(tokens).size, 4);
  assert.equal(tokens[1], '__plural_0');
  assert.equal(tokens[3], 'number');
  assert.ok(!tokens.includes('__plural_0_1'));
  assert.deepEqual(phrases[1].jsfbt.m, phrases[0].jsfbt.m);
  const code = compile(source);
  assert.match(code, /\._plural\(a\)/);
  assert.match(code, /\._plural\(b\)/);
  assert.match(code, /\._plural\(c\)/);
  assert.match(code, /\._plural\(d, "number"\)/);
  for (const phrase of phrases) {
    assert.ok(code.includes(`hk: "${phrase.hash_key}"`));
  }
}

{
  // A shared leaf hash can occur in several sites with different count names.
  const collected = collectBatchSync(
    ['a', 'b'].map((name) => ({
      filename: `${name}.tsx`,
      sourceText: `<fbt desc="Books"><fbt:plural count={count} name="${name}">book</fbt:plural></fbt>`,
    })),
    { collectPackager: 'text' },
  );
  assert.deepEqual(collected.errors, []);
  const { phrases } = JSON.parse(collected.output);
  const manyHash = Object.entries(phrases[0].hashToLeaf).find(
    ([, leaf]) => leaf.text === 'books',
  )[0];
  const group = JSON.parse(prepareTranslationsSync(collected.output, undefined, 'pl-PL'));
  const entry = group.translations[manyHash];
  assert.deepEqual(entry.tokens, ['a', 'b']);
  assert.deepEqual(entry.types, [28, 28]);

  // Existing indexes and translator-authored fields survive adding a dimension.
  Object.assign(entry, {
    notes: 'Reviewed translation',
    status: 'translated',
    tokens: ['b', 'gender'],
    translations: [
      { translation: 'książek', variations: {} },
      { translation: 'książki', variations: { 0: 20 } },
    ],
    types: [28, 3],
  });
  const updated = prepareTranslationsSync(collected.output, JSON.stringify(group), 'pl-PL');
  assert.deepEqual(JSON.parse(updated).translations[manyHash], {
    ...entry,
    tokens: ['b', 'gender', 'a'],
    types: [28, 3, 28],
  });
  assert.equal(prepareTranslationsSync(collected.output, updated, 'pl-PL'), updated);
}

{
  const code = compile(`
    const fbt = require('fbtee');
    const x = fbt('A', 'B');
    globalThis.__fbteeResult = x;
  `);
  const lowered = lowerSync('source.tsx', code, {
    lang: 'tsx',
    sourceType: 'script',
    target: 'es2022',
  });
  assert.deepEqual(lowered.errors, []);
  Function('require', 'globalThis', `${lowered.code};`)(fakeRequire, globalThis);
  assert.equal(globalThis.__fbteeResult, 'ok');
  delete globalThis.__fbteeResult;
}

{
  const code = compile(`
    const x = <fbt desc="outer">Click <b> world </b></fbt>;
  `);
  assert.match(code, /hk: "2oIm1Y"/);
  assert.match(code, /hk: "2FqS8b"/);
}

{
  const code = compile(`
    const x = <fbt desc="outer">
      Click <a title={fbt("Title", "link title")}>here</a>
    </fbt>;
  `);
  assert.doesNotMatch(code, /title={fbt\("Title"/);
  assert.match(code, /title={fbt\._\("Title"/);
}

{
  const code = compile(`
    import { fbt } from 'fbtee';
    const x = <fbt desc="d">Hello <b>world</b></fbt>;
  `);
  assert.match(code, /fbt\._\(/);
  assert.match(code, /fbt\._implicitParam\("=m1"/);
  assert.match(code, /fbt\._\("world"/);
  assert.match(code, /hk: "h8w0J"/);
}

{
  const code = compile(`
    import { fbt } from 'fbtee';
    const x = <fbt desc="d">Hello <b>world <i>inner</i></b></fbt>;
  `);
  assert.match(code, /hk: "36nzit"/);
  assert.match(code, /hk: "2YVHfO"/);
  assert.match(code, /hk: "2JgOvk"/);
}

for (const source of [
  `import type fbt from 'fbtee'; const x = fbt('A', 'd');`,
  `import type * as fbt from 'fbtee'; const x = fbt('A', 'd');`,
  `import type { fbt } from './types'; const x = <fbt desc="d">A</fbt>;`,
]) {
  const code = compile(source);
  assert.match(code, /import { fbt } from ["']fbtee["']/);
  assert.doesNotMatch(code, /import type/);
  const lowered = lowerSync('source.tsx', code, {
    lang: 'tsx',
    sourceType: 'module',
    target: 'es2022',
  });
  assert.deepEqual(lowered.errors, []);
  assert.match(lowered.code, /import { fbt } from ["']fbtee["']/);
}

{
  const code = compile(`
    if (cond) {
      const fbt = require('fbtee');
      const x = fbt('A', 'B');
    }
    const y = <fbt desc="d">C</fbt>;
  `);
  assert.match(code, /const fbt = require\(["']fbtee["']\)/);
  assert.match(code, /fbt\._\("A"/);
  assert.match(code, /import { fbt } from ["']fbtee["']/);
  assert.match(code, /fbt\._\("C"/);
}

{
  const code = compile(
    `
      const fbt = require('fbtee');
      const Example = require('./Example$FbtEnum');
      const x = fbt('Click to see ' + fbt.enum(id, Example), 'enums!');
    `,
    {
      fbtEnumManifest: {
        Example$FbtEnum: { id1: 'groups', id2: 'photos' },
      },
    },
  );
  assert.match(code, /id1: "Click to see groups"/);
  assert.match(code, /fbt\._enum\(id, Example\)/);
}

{
  const source = `const x = fbt('Async', 'description');`;
  const result = await transform('source.tsx', source, { lang: 'tsx' });
  assert.deepEqual(result, transformSync('source.tsx', source, { lang: 'tsx' }));
  assert.match(result.code, /import { fbt } from "fbtee"/);
  assert.doesNotMatch(result.code, /require\("fbtee"\)/);
}

{
  const result = transformSync('source.tsx', `fbt('A', 'B');`, {
    lang: 'tsx',
    sourcemap: true,
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.map?.version, 3);
  assert.match(result.code, /fbt\._\("A"/);
}

{
  const source = [
    'const before = 1;',
    `const translated = fbt('Mapped', 'description');`,
    'const after = 2;',
  ].join('\n');
  const result = transformSync('source.tsx', source, {
    lang: 'tsx',
    sourcemap: true,
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.map?.version, 3);
  assert.deepEqual(result.map?.sources, ['source.tsx']);
  const generatedIndex = result.code.indexOf('fbt._');
  const generatedPrefix = result.code.slice(0, generatedIndex).split('\n');
  const original = originalPositionFor(new TraceMap(result.map), {
    column: generatedPrefix.at(-1).length,
    line: generatedPrefix.length,
  });
  assert.equal(original.line, 2);
  assert.equal(original.column, source.split('\n')[1].indexOf('fbt('));
}

{
  const source = [
    'const before = 1;',
    `const translated = fbt(fbt.param('name', user.name), 'description');`,
    'const after = 2;',
  ].join('\n');
  const result = transformSync('source.tsx', source, {
    lang: 'tsx',
    sourcemap: true,
  });
  assert.deepEqual(result.errors, []);
  const generatedIndex = result.code.indexOf('user.name');
  const generatedPrefix = result.code.slice(0, generatedIndex).split('\n');
  const original = originalPositionFor(new TraceMap(result.map), {
    column: generatedPrefix.at(-1).length,
    line: generatedPrefix.length,
  });
  assert.equal(original.line, 2);
  assert.equal(original.column, source.split('\n')[1].indexOf('user.name'));
}

{
  const source = [
    'const before = 1;',
    `const translated = fbt(fbt.param("x", x), "description");`,
    'const after = 2;',
  ].join('\n');
  const result = transformSync('source.tsx', source, {
    lang: 'tsx',
    sourcemap: true,
  });
  assert.deepEqual(result.errors, []);
  const generatedIndex = result.code.indexOf('", x') + 3;
  const generatedPrefix = result.code.slice(0, generatedIndex).split('\n');
  const original = originalPositionFor(new TraceMap(result.map), {
    column: generatedPrefix.at(-1).length,
    line: generatedPrefix.length,
  });
  assert.equal(original.line, 2);
  assert.equal(original.column, source.split('\n')[1].lastIndexOf('x'));
}

{
  const source = [
    'const translated = fbt(',
    `  fbt.param('plain', value) +`,
    `  fbt.plural('cat', value),`,
    `  'description',`,
    ');',
  ].join('\n');
  const result = transformSync('source.tsx', source, {
    lang: 'tsx',
    sourcemap: true,
  });
  assert.deepEqual(result.errors, []);
  for (const [generatedText, line] of [
    ['_plural(value)', 3],
    ['_param("plain", value)', 2],
  ]) {
    const generatedIndex = result.code.indexOf(generatedText) + generatedText.lastIndexOf('value');
    const generatedPrefix = result.code.slice(0, generatedIndex).split('\n');
    const original = originalPositionFor(new TraceMap(result.map), {
      column: generatedPrefix.at(-1).length,
      line: generatedPrefix.length,
    });
    assert.equal(original.line, line);
    assert.equal(original.column, source.split('\n')[line - 1].indexOf('value'));
  }
}

{
  const source = [
    'const before = 1;',
    'const translated = <fbt desc="outer">',
    '  Click <a title={fbt("Title", "link title")}>here</a>',
    '</fbt>;',
  ].join('\n');
  const result = transformSync('source.tsx', source, {
    lang: 'tsx',
    sourcemap: true,
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.map?.version, 3);
  const generatedIndex = result.code.indexOf('fbt._');
  const generatedPrefix = result.code.slice(0, generatedIndex).split('\n');
  const original = originalPositionFor(new TraceMap(result.map), {
    column: generatedPrefix.at(-1).length,
    line: generatedPrefix.length,
  });
  assert.equal(original.line, 2);
  assert.equal(original.column, source.split('\n')[1].indexOf('<fbt'));
}

for (const sourceType of ['script', 'commonjs']) {
  const result = transformSync('source.tsx', `const translated = fbt('Mapped', 'description');`, {
    lang: 'tsx',
    sourceType,
  });
  assert.deepEqual(result.errors, []);
  assert.doesNotMatch(result.code, /\bimport\b/);
  assert.match(result.code, /const { fbt } = require\("fbtee"\)/);
  const lowered = lowerSync('source.tsx', result.code, {
    lang: 'tsx',
    sourceType,
    target: 'es2022',
  });
  assert.deepEqual(lowered.errors, []);
}

{
  for (const source of [
    `import type { fbt } from 'fbtee'; const translated = fbt('Mapped', 'description');`,
    `import type { fbt, FbtRuntimeCallInput } from 'fbtee'; type Input = FbtRuntimeCallInput; const translated = fbt('Mapped', 'description');`,
  ]) {
    const result = transformSync('source.tsx', source, {
      lang: 'tsx',
      sourceType: 'module',
    });
    assert.deepEqual(result.errors, []);
    assert.match(result.code, /import { fbt(?:, type FbtRuntimeCallInput)? } from "fbtee"/);
    assert.doesNotMatch(result.code, /import type { fbt/);
    const lowered = lowerSync('source.tsx', result.code, {
      lang: 'tsx',
      sourceType: 'module',
      target: 'es2022',
    });
    assert.deepEqual(lowered.errors, []);
    assert.match(lowered.code, /import { fbt } from "fbtee"/);
  }
}

{
  const result = transformSync('source.tsx', `const x = fbt.param('x', x);`, {
    lang: 'tsx',
  });
  assert.equal(result.code, '');
  assert.match(result.errors[0]?.message || '', /must be inside an fbt/);
}
