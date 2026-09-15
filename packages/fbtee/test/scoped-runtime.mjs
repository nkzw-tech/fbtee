import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { beforeEach, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { collectSync, transformSync, translateSync } from '@nkzw/oxc-transform-fbtee';
import {
  createFbteeRuntime,
  fbs,
  fbt,
  FbtResult,
  FbtTranslations,
  setupFbtee,
  setupLocaleContext,
} from 'fbtee';
import {
  fbs as serverFbs,
  fbt as serverFbt,
  FbtTranslations as serverTranslations,
  runWithFbtee,
} from 'fbtee/server';
import { transformSync as lowerSync } from 'oxc-transform';
import { createElement, Suspense } from 'react';

const isProduction = process.env.NODE_ENV === 'production';

const source = readFileSync(new URL('./fixtures/scoped.tsx', import.meta.url), 'utf8');
const boundSource = readFileSync(new URL('./fixtures/bound.tsx', import.meta.url), 'utf8');
const transformed = transformSync('scoped.tsx', source + '\n' + boundSource);
assert.deepEqual(transformed.errors, []);
const lowered = lowerSync('scoped.tsx', transformed.code, { jsx: { runtime: 'automatic' } });
assert.deepEqual(lowered.errors, []);
setupFbtee({ translations: {} });
const fixture = await (async () => {
  const directory = mkdtempSync(join(tmpdir(), 'fbtee-scoped-'));
  try {
    const code = lowered.code.replaceAll(
      /from\s+(["'])([^"']+)\1/g,
      (_, _quote, specifier) => `from ${JSON.stringify(import.meta.resolve(specifier))}`,
    );
    writeFileSync(join(directory, 'fixture.mjs'), code);
    return await import(pathToFileURL(join(directory, 'fixture.mjs')));
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
})();

const collected = collectSync('scoped.tsx', source + '\n' + boundSource, {
  collectPackager: 'text',
});
assert.deepEqual(collected.errors, []);
const phrases = [
  ...JSON.parse(collected.output).phrases,
  ...JSON.parse(readFileSync(new URL('../Strings.json', import.meta.url), 'utf8')).phrases,
];

function catalog(locale, messages) {
  const translations = {};
  for (const phrase of phrases) {
    for (const [hash, { text }] of Object.entries(phrase.hashToLeaf)) {
      if (messages[text] !== undefined) {
        translations[hash] = {
          tokens: [],
          translations: [{ translation: messages[text], variations: {} }],
          types: [],
        };
      }
    }
  }
  return JSON.parse(
    translateSync(
      JSON.stringify({ phrases, translationGroups: [{ 'fb-locale': locale, translations }] }),
    ),
  );
}

const german = catalog('de-DE', {
  '{list of items} and {last item}': '{list of items} und {last item}',
  Message: 'Nachricht',
});
const french = catalog('fr-FR', {
  '{list of items} and {last item}': '{list of items} et {last item}',
  Message: 'Message français',
});

beforeEach(() => {
  setupFbtee({
    hooks: { getViewerContext: () => ({ GENDER: 3, locale: 'en-US' }) },
    translations: {},
  });
});

test('all public entry points share the same runtime', () => {
  assert.equal(fbt, serverFbt);
  assert.equal(fbs, serverFbs);
  assert.equal(FbtTranslations, serverTranslations);
  assert.equal(
    runWithFbtee({ locale: 'de-DE', translations: german }, fixture.message),
    'Nachricht',
  );
  assert.equal(fixture.message(), 'Message');
});

test('reusing singleton hook options does not bind new runtimes to the singleton', () => {
  const hooks = {};
  setupFbtee({ hooks, translations: {} });
  const originalHooks = { ...hooks };
  const bound = createFbteeRuntime({ hooks, locale: 'de-DE', translations: german });
  assert.equal(fixture.messages(bound).message(), 'Nachricht');
  assert.equal(fixture.messages(bound).plainMessage(), 'Nachricht');
  runWithFbtee({ hooks, locale: 'fr-FR', translations: french }, () => {
    assert.equal(fixture.message(), 'Message français');
    assert.equal(fixture.number(1234.5), new Intl.NumberFormat('fr-FR').format(1234.5));
    assert.equal(fixture.messages(bound).message(), 'Nachricht');
  });
  assert.deepEqual(hooks, originalHooks);
  assert.equal(fixture.message(), 'Message');
});

test('browser entry points do not import the server adapter', () => {
  const visited = new Set();
  function visit(url) {
    if (visited.has(url.href)) {
      return;
    }
    visited.add(url.href);
    const code = readFileSync(url, 'utf8');
    assert.doesNotMatch(code, /node:|AsyncLocalStorage/);
    for (const [, specifier] of code.matchAll(/from\s*["']([^"']+)["']/g)) {
      if (specifier.startsWith('.')) {
        visit(new URL(specifier, url));
      }
    }
  }
  visit(new URL('../lib/index.mjs', import.meta.url));
  visit(new URL('../lib/index-core.mjs', import.meta.url));
  assert.ok(visited.size > 1);
});

test('phonological rewrites follow the request locale', () => {
  runWithFbtee({ locale: 'tr-TR', translations: {} }, () => {
    assert.equal(fixture.apostrophe('Ada'), "Ada'");
    runWithFbtee({ locale: 'de-DE', translations: {} }, () => {
      assert.equal(fixture.apostrophe('Ada'), 'Ada’');
    });
    assert.equal(fixture.apostrophe('Ada'), "Ada'");
  });
});

test('concurrent async operations use their own translations and formatting', async () => {
  const gate = Promise.withResolvers();
  const first = runWithFbtee({ locale: 'de-DE', translations: german }, async () => {
    assert.equal(fixture.message(), 'Nachricht');
    await gate.promise;
    assert.equal(fixture.plainMessage(), 'Nachricht');
    assert.equal(fixture.names(), 'Alice und Bob');
    assert.equal(fixture.embeddedNames(), 'People: Alice und Bob');
    assert.equal(fixture.number(1234.5), new Intl.NumberFormat('de-DE').format(1234.5));
    assert.equal(fixture.punctuation('Alice.'), 'Alice.');
  });
  const second = runWithFbtee({ locale: 'fr-FR', translations: french }, async () => {
    await delay(1);
    assert.equal(fixture.message(), 'Message français');
    assert.equal(fixture.plainMessage(), 'Message français');
    assert.equal(fixture.names(), 'Alice et Bob');
    assert.equal(fixture.number(1234.5), new Intl.NumberFormat('fr-FR').format(1234.5));
    gate.resolve();
  });
  await Promise.all([first, second]);
  assert.equal(fixture.message(), 'Message');
});

test('nested scopes restore their parent after returns, throws, and rejections', async () => {
  const failure = new Error('Request failed');
  await runWithFbtee({ locale: 'de-DE', translations: german }, async () => {
    assert.equal(
      runWithFbtee({ locale: 'fr-FR', translations: french }, fixture.message),
      'Message français',
    );
    assert.equal(fixture.message(), 'Nachricht');
    assert.throws(
      () =>
        runWithFbtee({ locale: 'fr-FR', translations: french }, () => {
          throw failure;
        }),
      failure,
    );
    assert.equal(fixture.message(), 'Nachricht');
    await assert.rejects(
      runWithFbtee({ locale: 'fr-FR', translations: french }, async () => {
        await delay(1);
        throw failure;
      }),
      failure,
    );
    assert.equal(fixture.message(), 'Nachricht');
  });
  assert.equal(fixture.message(), 'Message');
});

test('callbacks scheduled in a scope retain it after the callback returns', async () => {
  const finished = Promise.withResolvers();
  assert.equal(
    runWithFbtee({ locale: 'de-DE', translations: german }, () => {
      setImmediate(() => {
        try {
          assert.equal(fixture.message(), 'Nachricht');
          finished.resolve();
        } catch (error) {
          finished.reject(error);
        }
      });
      return 42;
    }),
    42,
  );
  assert.equal(fixture.message(), 'Message');
  await finished.promise;
});

test('scopes do not inherit missing translations or hooks from their parent', () => {
  runWithFbtee(
    {
      hooks: { getFbtResult: () => 'parent hook' },
      locale: 'de-DE',
      translations: german,
    },
    () => {
      assert.equal(fixture.message(), 'parent hook');
      runWithFbtee({ locale: 'de-DE', translations: {} }, () => {
        assert.equal(fixture.message(), 'Message');
        assert.equal(fixture.moduleMessage, 'Module message');
      });
      assert.equal(fixture.message(), 'parent hook');
    },
  );
});

test('registration, merging, and setup do not mutate shared catalogs or other requests', () => {
  const shared = Object.freeze({ 'de-DE': Object.freeze({ ...german['de-DE'] }) });
  const changed = catalog('de-DE', { Message: 'Geändert' });
  runWithFbtee({ locale: 'de-DE', translations: shared }, () => {
    FbtTranslations.mergeTranslations(changed);
    assert.equal(fixture.message(), 'Geändert');
    runWithFbtee({ locale: 'de-DE', translations: shared }, () => {
      assert.equal(fixture.message(), 'Nachricht');
      setupFbtee({ translations: changed });
      assert.equal(fixture.message(), 'Geändert');
      FbtTranslations.registerTranslations(shared);
      assert.equal(fixture.message(), 'Nachricht');
    });
    assert.equal(fixture.message(), 'Geändert');
  });
  assert.deepEqual(shared, german);
  assert.equal(fixture.message(), 'Message');
});

for (const [name, install] of [
  ['registration', (translations) => FbtTranslations.registerTranslations(translations)],
  ['merging', (translations) => FbtTranslations.mergeTranslations(translations)],
  [
    'loading',
    async (translations) => {
      const context = setupLocaleContext({
        availableLanguages: new Map([
          ['en-US', 'English'],
          ['de-DE', 'German'],
        ]),
        clientLocales: ['de-DE'],
        loadLocale: async () => translations['de-DE'],
      });
      await context.preloadLocale();
    },
  ],
]) {
  test(`${name} shares nested tables and isolates updates through the API`, async () => {
    const base = catalog('en-US', {})['en-US'];
    const hash = Object.keys(base).find((hash) => base[hash]?.['*'] === '{count} items');
    assert.ok(hash);
    const shared = {
      'de-DE': { [hash]: { __vcg: 1, '*': { '*': ['{count} Dinge', 'leaf-hash'] } } },
    };
    const original = structuredClone(shared);
    setupFbtee({
      hooks: { getViewerContext: () => ({ GENDER: 3, locale: 'de-DE' }) },
      translations: shared,
    });

    await runWithFbtee({ locale: 'de-DE', translations: shared }, async () => {
      assert.equal(fixture.plural(2), '2 Dinge');
      await install(shared);
      await runWithFbtee({ locale: 'de-DE', translations: shared }, async () => {
        await install(shared);
        const table = FbtTranslations.getRegisteredTranslations()['de-DE'][hash];
        assert.equal(table, shared['de-DE'][hash]);
        assert.equal(Object.isFrozen(table), !isProduction);
        assert.equal(Object.isFrozen(table['*']), !isProduction);
        assert.equal(Object.isFrozen(table['*']['*']), !isProduction);
        if (!isProduction) {
          assert.throws(() => {
            table['*']['*'][0] = '{count} geändert';
          }, TypeError);
          assert.throws(() => {
            table['*']['*'] = ['{count} ersetzt', 'replacement-hash'];
          }, TypeError);
          assert.throws(() => {
            table.__vcg = 0;
          }, TypeError);
        }
        FbtTranslations.mergeTranslations({
          'de-DE': { [hash]: { __vcg: 1, '*': { '*': ['{count} ersetzt', 'replacement-hash'] } } },
        });
        assert.equal(fixture.plural(2), '2 ersetzt');
      });
      assert.equal(fixture.plural(2), '2 Dinge');
    });

    assert.equal(fixture.plural(2), '2 Dinge');
    assert.deepEqual(shared, original);
    await runWithFbtee({ locale: 'de-DE', translations: shared }, async () => {
      await install(shared);
      if (!isProduction) {
        assert.throws(() => {
          shared['de-DE'][hash]['*']['*'][0] = '{count} außerhalb';
        }, TypeError);
      }
      assert.equal(fixture.plural(2), '2 Dinge');
    });
    assert.equal(fixture.plural(2), '2 Dinge');
  });
}

test('requests retain the catalog itself without copying or revisiting its entries', () => {
  let reads = 0;
  const shared = {
    'de-DE': new Proxy(
      { message: 'Nachricht' },
      {
        ownKeys(target) {
          reads++;
          return Reflect.ownKeys(target);
        },
      },
    ),
  };
  runWithFbtee({ locale: 'de-DE', translations: shared }, () => {
    assert.equal(FbtTranslations.getRegisteredTranslations(), shared);
  });
  const preparationReads = reads;
  assert.equal(preparationReads > 0, !isProduction);
  for (let index = 0; index < 10; index++) {
    runWithFbtee({ locale: 'de-DE', translations: shared }, () => {
      assert.equal(FbtTranslations.getRegisteredTranslations(), shared);
    });
  }
  assert.equal(reads, preparationReads);
});

test(
  'development rejects accessors that could return mutable translation tables',
  { skip: isProduction },
  () => {
    const translations = {
      'de-DE': {
        get phrase() {
          return { '*': 'Mutable' };
        },
      },
    };
    assert.throws(
      () => runWithFbtee({ locale: 'de-DE', translations }, () => {}),
      /data properties/,
    );
  },
);

test(
  'development freezes nested tables even in shallow-frozen catalogs',
  { skip: isProduction },
  () => {
    const shared = Object.freeze({
      'de-DE': Object.freeze({ phrase: { '*': ['Original', 'hash'] } }),
    });
    runWithFbtee({ locale: 'de-DE', translations: shared }, () => {
      const registered = FbtTranslations.getRegisteredTranslations();
      assert.equal(registered, shared);
      assert.throws(() => {
        registered['de-DE'].phrase['*'][0] = 'Changed';
      }, TypeError);
    });
  },
);

test('the singleton preserves catalog references for registration, merging, and loading', async () => {
  const translations = { 'en-US': { existing: { '*': ['Original', 'original-hash'] } } };
  setupFbtee({ translations });
  assert.equal(FbtTranslations.getRegisteredTranslations(), translations);
  assert.equal(Object.isFrozen(translations), false);
  assert.equal(Object.isFrozen(translations['en-US'].existing['*']), false);
  const merged = { '*': { '*': ['Merged', 'merged-hash'] } };
  FbtTranslations.mergeTranslations({ 'en-US': { merged } });
  assert.equal(translations['en-US'].merged, merged);
  assert.equal(Object.isFrozen(merged), false);

  const loaded = { existing: { '*': ['Geladen', 'loaded-hash'] } };
  const context = setupLocaleContext({
    availableLanguages: new Map([
      ['en-US', 'English'],
      ['de-DE', 'German'],
    ]),
    clientLocales: ['de-DE'],
    loadLocale: async () => loaded,
    translations,
  });
  await context.preloadLocale();
  assert.equal(FbtTranslations.getRegisteredTranslations(), translations);
  assert.equal(translations['de-DE'], loaded);
  assert.equal(Object.isFrozen(loaded), false);
  assert.equal(Object.isFrozen(loaded.existing['*']), false);
});

test('catalog freezing is not exposed in the public API', async () => {
  assert.equal('freezeTranslations' in (await import('fbtee')), false);
  assert.equal('freezeTranslations' in (await import('fbtee/server')), false);
});

test('locale context preloading writes to the owning request dictionary', async () => {
  const shared = Object.freeze({ 'en-US': Object.freeze({}) });
  const loaded = Object.freeze({ ...german['de-DE'] });
  const gate = Promise.withResolvers();
  const pending = runWithFbtee({ locale: 'en-US', translations: shared }, async () => {
    const context = setupLocaleContext({
      availableLanguages: new Map([
        ['en-US', 'English'],
        ['de-DE', 'German'],
      ]),
      clientLocales: ['de-DE'],
      loadLocale: async () => {
        await gate.promise;
        return loaded;
      },
      translations: shared,
    });
    await context.preloadLocale();
    assert.equal(fixture.message(), 'Nachricht');
    FbtTranslations.mergeTranslations(catalog('de-DE', { Message: 'Geändert' }));
    assert.equal(fixture.message(), 'Geändert');
  });
  runWithFbtee({ locale: 'fr-FR', translations: french }, () => {
    assert.equal(fixture.message(), 'Message français');
    gate.resolve();
  });
  await pending;
  assert.deepEqual(shared, { 'en-US': {} });
  assert.deepEqual(loaded, german['de-DE']);
  assert.equal(fixture.message(), 'Message');
});

test('result caches and frozen hook configurations are isolated', () => {
  for (const label of ['first', 'second']) {
    let calls = 0;
    const hooks = Object.freeze({
      getFbsResult: () => `${label} string`,
      getFbtResult: () => {
        calls++;
        return label;
      },
    });
    runWithFbtee({ hooks, locale: 'en-US', translations: {} }, () => {
      assert.equal(fixture.message(), label);
      assert.equal(fixture.message(), label);
      assert.equal(calls, 1);
      assert.equal(fixture.plainMessage(), `${label} string`);
      setupFbtee({ hooks: { getFbtResult: () => `${label} updated` }, translations: {} });
      assert.equal(fixture.message(), `${label} updated`);
    });
  }
  assert.equal(fixture.message(), 'Message');
  assert.equal(fixture.plainMessage(), 'Message');
});

test('returned rich results retain their error listener after leaving the scope', () => {
  const errors = [];
  const result = runWithFbtee(
    {
      hooks: {
        errorListener: () => ({ onStringSerializationError: () => errors.push('German') }),
        getFbtResult: (contents, hash, listener) => new FbtResult(contents, listener, hash),
      },
      locale: 'de-DE',
      translations: german,
    },
    fixture.richMessage,
  );
  runWithFbtee({ locale: 'fr-FR', translations: french }, () => {
    assert.equal(String(result), 'Hello, ');
  });
  assert.deepEqual(errors, ['German']);
});

test('compiled plural helpers and viewer gender use request state', async () => {
  const base = catalog('en-US', {});
  const pluralHash = Object.keys(base['en-US']).find(
    (hash) => base['en-US'][hash]?.['*'] === '{count} items',
  );
  const viewerHash = Object.keys(base['en-US']).find((hash) => base['en-US'][hash] === 'Viewer');
  assert.ok(pluralHash);
  assert.ok(viewerHash);
  const table = {
    [pluralHash]: { _1: 'one {count}', '*': 'other {count}', 20: 'few {count}' },
    [viewerHash]: { __vcg: 1, '*': 'unknown', 1: 'male', 2: 'female' },
  };
  await Promise.all([
    runWithFbtee(
      { gender: 'female', locale: 'ru-RU', translations: { 'ru-RU': table } },
      async () => {
        await delay(1);
        assert.equal(fixture.plural(2), 'few 2');
        assert.equal(fixture.viewer(), 'female');
      },
    ),
    runWithFbtee(
      { gender: 'male', locale: 'en-US', translations: { 'en-US': table } },
      async () => {
        await delay(1);
        assert.equal(fixture.plural(2), 'other 2');
        assert.equal(fixture.viewer(), 'male');
      },
    ),
  ]);
});

if (!process.execArgv.includes('--conditions=react-server')) {
  test('LocaleProvider preserves independent trees during server Suspense retries', async () => {
    const { LocaleProvider, useFbt } = await import('fbtee');
    const { renderToPipeableStream } = await import('react-dom/server');
    const gate = Promise.withResolvers();
    const shell = Promise.withResolvers();
    let ready = false;
    function BoundMessage({ suspend = false }) {
      const { fbt } = useFbt();
      if (suspend && !ready) {
        throw gate.promise;
      }
      return createElement('p', null, fixture.helper(fbt));
    }
    const output = new Promise((resolve, reject) => {
      const destination = new PassThrough();
      let html = '';
      destination.on('data', (chunk) => {
        html += chunk;
      });
      destination.on('end', () => resolve(html));
      destination.on('error', reject);
      const tree = createElement(
        'main',
        null,
        ...[
          ['de-DE', german],
          ['fr-FR', french],
        ].map(([locale, translations]) =>
          createElement(
            LocaleProvider,
            {
              key: locale,
              runtime: createFbteeRuntime({ locale, translations }),
            },
            createElement(
              Suspense,
              { fallback: createElement(BoundMessage) },
              createElement(BoundMessage, { suspend: true }),
            ),
          ),
        ),
      );
      const stream = renderToPipeableStream(tree, {
        onError: reject,
        onShellReady() {
          stream.pipe(destination);
          shell.resolve();
        },
      });
    });
    await shell.promise;
    ready = true;
    gate.resolve();
    const html = await output;
    assert.equal(html.split('<p>Nachricht</p>').length - 1, 2);
    assert.equal(html.split('<p>Message français</p>').length - 1, 2);
  });

  test(
    'streaming SSR retains each request across Suspense retries',
    { timeout: 10_000 },
    async () => {
      const { renderToPipeableStream } = await import('react-dom/server');
      function render(locale, translations) {
        const gate = Promise.withResolvers();
        const shell = Promise.withResolvers();
        let ready = false;
        const html = runWithFbtee(
          { locale, translations },
          () =>
            new Promise((resolve, reject) => {
              const destination = new PassThrough();
              let output = '';
              destination.on('data', (chunk) => {
                output += chunk;
              });
              destination.on('end', () => resolve(output));
              destination.on('error', reject);
              const stream = renderToPipeableStream(
                createElement(
                  'main',
                  null,
                  createElement(
                    Suspense,
                    { fallback: createElement(fixture.Message) },
                    createElement(fixture.SuspendedMessage, {
                      ready: () => ready,
                      wait: gate.promise,
                    }),
                  ),
                ),
                {
                  onError: reject,
                  onShellReady() {
                    stream.pipe(destination);
                    shell.resolve();
                  },
                },
              );
            }),
        );
        return {
          html,
          resume: () => {
            ready = true;
            gate.resolve();
          },
          shell: shell.promise,
        };
      }
      const de = render('de-DE', german);
      const fr = render('fr-FR', french);
      await Promise.all([de.shell, fr.shell]);
      fr.resume();
      const frenchHtml = await fr.html;
      de.resume();
      const germanHtml = await de.html;
      assert.equal(germanHtml.split('<p>Nachricht</p>').length - 1, 2);
      assert.equal(frenchHtml.split('<p>Message français</p>').length - 1, 2);
      assert.equal(germanHtml.includes('Message français'), false);
      assert.equal(frenchHtml.includes('Nachricht'), false);
      assert.equal(fixture.message(), 'Message');
    },
  );
}

test('bound runtimes preserve every operation across ambient scopes and async actions', async () => {
  const de = createFbteeRuntime({ locale: 'de-DE', translations: german });
  const fr = createFbteeRuntime({ locale: 'fr-FR', translations: french });
  const deMessages = fixture.messages(de);
  const frMessages = fixture.messages(fr);
  const gate = Promise.withResolvers();
  const deAction = deMessages.save(gate.promise);
  const frAction = frMessages.save(gate.promise);
  await runWithFbtee({ locale: 'fr-FR', translations: french }, async () => {
    assert.equal(deMessages.message(), 'Nachricht');
    assert.equal(deMessages.plainMessage(), 'Nachricht');
    assert.equal(deMessages.plainNames(), 'People: Alice und Bob');
    assert.equal(deMessages.names(), 'Alice und Bob');
    assert.equal(deMessages.embeddedNames(), 'People: Alice und Bob');
    assert.equal(deMessages.number(1234.5), '1.234,5');
    assert.equal(frMessages.names(), 'Alice et Bob');
    assert.equal(fixture.helper(de.fbt), 'Nachricht');
    assert.equal(fixture.factory({ locale: 'de-DE', translations: german })(), 'Nachricht');
    gate.resolve();
    assert.deepEqual(await Promise.all([deAction, frAction]), ['Nachricht', 'Message français']);
    assert.equal(fixture.message(), 'Message français');
  });
  assert.equal(fixture.message(), 'Message');
  assert.equal(deMessages.message(), 'Nachricht');
  assert.equal(frMessages.message(), 'Message français');
});

test('bound runtimes isolate merges and support loading after creation', async () => {
  const first = createFbteeRuntime({ locale: 'de-DE', translations: german });
  const second = createFbteeRuntime({ locale: 'de-DE', translations: german });
  const lazy = createFbteeRuntime({ locale: 'en-US', translations: {} });
  const firstMessages = fixture.messages(first);
  const secondMessages = fixture.messages(second);
  const lazyMessages = fixture.messages(lazy);
  assert.equal(firstMessages.message(), 'Nachricht');
  assert.equal(lazyMessages.message(), 'Message');
  await Promise.resolve();
  first.mergeTranslations({
    'de-DE': Object.fromEntries(
      Object.entries(catalog('de-DE', { Message: 'Aktualisiert' })['de-DE']).filter(
        ([, value]) => value === 'Aktualisiert',
      ),
    ),
  });
  lazy.mergeTranslations(catalog('en-US', { Message: 'Loaded' }));
  assert.equal(firstMessages.message(), 'Aktualisiert');
  assert.equal(firstMessages.plainMessage(), 'Aktualisiert');
  assert.equal(firstMessages.names(), 'Alice und Bob');
  assert.equal(secondMessages.message(), 'Nachricht');
  assert.equal(lazyMessages.message(), 'Loaded');
  FbtTranslations.registerTranslations({});
  assert.equal(secondMessages.message(), 'Nachricht');
});

test('bound runtimes use their own plural rules, viewer context, hooks and punctuation', () => {
  const runtime = createFbteeRuntime({
    gender: 'female',
    hooks: {
      getTranslatedInput: ({ args, table }) => ({
        args,
        table: table === 'Viewer' ? { __vcg: 1, '*': 'Unknown', 1: 'Male', 2: 'Female' } : table,
      }),
    },
    locale: 'ru-RU',
    translations: {},
  });
  const messages = fixture.messages(runtime);
  assert.equal(messages.viewer(), 'Female');
  const pluralRuntime = createFbteeRuntime({
    hooks: {
      getTranslatedInput: ({ args }) => ({
        args,
        table: { '*': 'other {count}', 12: 'many {count}', 20: 'few {count}' },
      }),
    },
    locale: 'ru-RU',
    translations: {},
  });
  assert.equal(fixture.messages(pluralRuntime).plural(2), 'few 2');
  assert.equal(fixture.messages(pluralRuntime).plural(5), 'many 5');
  const tr = createFbteeRuntime({ locale: 'tr-TR', translations: {} });
  assert.equal(fixture.messages(tr).apostrophe('Ada'), "Ada'");
  assert.equal(fixture.apostrophe('Ada'), 'Ada’');
});

test('bound result hooks and rich nested phrases keep their runtime', () => {
  const events = [];
  const runtime = createFbteeRuntime({
    hooks: {
      errorListener: (context) => {
        events.push(context.translation);
        return null;
      },
      getFbtResult: (contents) => {
        assert.equal(fixture.message(), 'Message');
        return new FbtResult(contents, null);
      },
    },
    locale: 'de-DE',
    translations: german,
  });
  assert.equal(String(fixture.messages(runtime).message()), 'Nachricht');
  const rich = fixture.messages(runtime).rich();
  assert.ok(rich instanceof FbtResult);
  assert.equal(rich.getContents()[1].type, 'b');
  assert.ok(events.includes('Nachricht'));
  assert.ok(events.includes('world'));
});
