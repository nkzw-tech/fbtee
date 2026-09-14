import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

if (process.argv[2] !== '--worker') {
  const entry = new URL('../lib/index.mjs', import.meta.url).href;
  const modes = [
    ['singleton', entry],
    ['server-singleton', entry],
    ['scoped', entry],
  ];
  if (process.argv[2]) {
    modes.unshift(['baseline', pathToFileURL(resolve(process.argv[2])).href]);
  }
  for (const [mode, entry] of modes) {
    const result = spawnSync(
      process.execPath,
      ['--expose-gc', import.meta.filename, '--worker', mode, entry],
      { encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production' } },
    );
    assert.equal(result.status, 0, result.stderr);
    process.stdout.write(result.stdout);
  }
} else {
  const mode = process.argv[3];
  const { fbt, setupFbtee } = await import(process.argv[4]);
  const server =
    mode === 'scoped' || mode === 'server-singleton'
      ? await import('../lib/index-server.mjs')
      : null;
  const translations = { 'de-DE': { greeting: 'Hallo {name}', message: 'Hallo' } };
  setupFbtee({
    hooks: { getViewerContext: () => ({ GENDER: 3, locale: 'de-DE' }) },
    translations,
  });
  const run = (callback) =>
    mode === 'scoped'
      ? server.runWithFbtee({ locale: 'de-DE', translations }, callback)
      : callback();
  const options = { hk: 'message' };
  const paramOptions = { hk: 'greeting' };
  const nanosecondsPerCall = run(() => {
    const results = {};
    for (const [name, fn] of [
      ['cached', () => fbt._('Hello', null, options)],
      ['parameter', () => fbt._('Hello {name}', [fbt._param('name', 'Alice')], paramOptions)],
    ]) {
      for (let index = 0; index < 100_000; index++) {
        fn();
      }
      const samples = [];
      for (let sample = 0; sample < 7; sample++) {
        const start = performance.now();
        for (let index = 0; index < 100_000; index++) {
          fn();
        }
        samples.push((performance.now() - start) * 10);
      }
      samples.sort((a, b) => a - b);
      results[name] = Math.round(samples[3]);
      assert.ok(String(fn()).startsWith('Hallo'));
    }
    return results;
  });
  let catalogMeasurements;
  if (mode === 'scoped') {
    const largeCatalog = {
      'de-DE': Object.fromEntries(
        Array.from({ length: 10_000 }, (_, index) => [
          `message-${index}`,
          { '*': [`Translation ${index}`, `hash-${index}`] },
        ]),
      ),
    };
    const start = performance.now();
    server.runWithFbtee({ locale: 'de-DE', translations: largeCatalog }, () => {
      assert.equal(server.FbtTranslations.getRegisteredTranslations(), largeCatalog);
    });
    const initialScopeMs = performance.now() - start;
    const gate = Promise.withResolvers();
    global.gc();
    const before = process.memoryUsage().heapUsed;
    const requests = Array.from({ length: 1000 }, () =>
      server.runWithFbtee({ locale: 'de-DE', translations: largeCatalog }, async () => {
        assert.equal(server.FbtTranslations.getRegisteredTranslations(), largeCatalog);
        await gate.promise;
      }),
    );
    global.gc();
    catalogMeasurements = {
      initialScopeMs: Number(initialScopeMs.toFixed(2)),
      messages: 10_000,
      pendingRequestHeapBytes: process.memoryUsage().heapUsed - before,
      pendingRequests: requests.length,
    };
    gate.resolve();
    await Promise.all(requests);
  }
  process.stdout.write(`${JSON.stringify({ catalogMeasurements, mode, nanosecondsPerCall })}\n`);
}
