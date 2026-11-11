import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpus } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

if (process.argv[2] !== '--worker') {
  const entries = [['current', new URL('../lib/index.mjs', import.meta.url).href]];
  if (process.argv[2]) {
    entries.unshift(['baseline', pathToFileURL(resolve(process.argv[2])).href]);
  }
  const rounds = Number(process.env.FBTEE_BENCHMARK_ROUNDS ?? 1);
  assert.ok(Number.isInteger(rounds) && rounds > 0);
  for (let round = 0; round < rounds; round++) {
    for (const mode of ['browser', 'server']) {
      for (const [version, entry] of round % 2 ? [...entries].reverse() : entries) {
        const result = spawnSync(
          process.execPath,
          [
            '--expose-gc',
            import.meta.filename,
            '--worker',
            mode,
            version,
            entry,
            String(round + 1),
          ],
          {
            encoding: 'utf8',
            env: { ...process.env, NODE_ENV: 'production' },
          },
        );
        assert.equal(result.status, 0, result.stderr);
        process.stdout.write(result.stdout);
      }
    }
  }
} else {
  const [, , , mode, version, entry, round] = process.argv;
  if (mode === 'browser') {
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
  }
  const { createFbteeRuntime } = await import(entry);
  const { createElement, useEffect, version: reactVersion } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { fbs, fbt, list } = createFbteeRuntime({
    locale: 'de-DE',
    translations: { 'de-DE': { greeting: 'Hallo {name}', message: 'Hallo' } },
  });
  const messageOptions = { hk: 'message' };
  const greetingOptions = { hk: 'greeting' };
  const names = ['Alice', 'Bob'];
  const text = (index) =>
    fbt._('Hello {name}', [fbt._param('name', names[index & 1])], greetingOptions);
  const rich = (index, keyed) =>
    fbt._(
      'Hello {name}',
      [fbt._param('name', createElement('b', keyed ? { key: 'name' } : null, names[index & 1]))],
      greetingOptions,
    );
  const nested = (index) =>
    fbt._('{greeting}!', [fbt._param('greeting', rich(index, false))], { hk: 'nested' });
  let sink;
  function measure(fn, iterations = 50_000) {
    for (let index = 0; index < iterations; index++) {
      sink = fn(index);
    }
    const samples = [];
    for (let sample = 0; sample < 9; sample++) {
      global.gc();
      const start = performance.now();
      for (let index = 0; index < iterations; index++) {
        sink = fn(index);
      }
      samples.push(((performance.now() - start) * 1e6) / iterations);
    }
    const sorted = [...samples].sort((a, b) => a - b);
    return {
      iterations,
      maxNs: Math.round(sorted[8]),
      medianNs: Math.round(sorted[4]),
      minNs: Math.round(sorted[0]),
      samplesNs: samples.map(Math.round),
    };
  }
  assert.equal(String(text(0)), 'Hallo Alice');
  assert.equal(renderToStaticMarkup(rich(0, false)), 'Hallo <b>Alice</b>');
  assert.equal(renderToStaticMarkup(nested(0)), 'Hallo <b>Alice</b>!');
  assert.equal(renderToStaticMarkup(list(['Alice', 'Bob', 'Carol'])), 'Alice, Bob and Carol');
  const measurements = {};
  for (const [name, fn] of [
    ['cachedText', () => fbt._('Hello', null, messageOptions)],
    ['textParameter', text],
    ['nestedText', (index) => fbt._('{greeting}!', [fbt._param('greeting', text(index))])],
    [
      'fbsParameter',
      (index) => fbs._('Hello {name}', [fbs._param('name', names[index & 1])], greetingOptions),
    ],
    ['keyedRich', (index) => rich(index, true)],
    ['unkeyedRich', (index) => rich(index, false)],
    ['nestedRich', nested],
    ['textList', () => list(['Alice', 'Bob', 'Carol'])],
  ]) {
    measurements[name] = measure(fn);
  }
  measurements.serverRender = measure((index) => renderToStaticMarkup(nested(index)), 5000);
  let mounts;
  if (mode === 'browser') {
    const { createRoot } = await import('react-dom/client');
    const { flushSync } = await import('react-dom');
    const container = document.createElement('div');
    const root = createRoot(container);
    mounts = 0;
    function Child({ name }) {
      useEffect(() => {
        mounts++;
      }, []);
      return createElement('input', { defaultValue: name });
    }
    measurements.clientUpdate = measure((index) => {
      flushSync(() =>
        root.render(
          fbt._(
            'Hello {name}',
            [fbt._param('name', createElement(Child, { name: names[index & 1] }))],
            greetingOptions,
          ),
        ),
      );
    }, 2000);
    assert.equal(container.querySelectorAll('input').length, 1);
    flushSync(() => root.unmount());
  }
  const retained = [];
  global.gc();
  const before = process.memoryUsage().heapUsed;
  for (let index = 0; index < 20_000; index++) {
    retained.push(rich(index, false));
  }
  global.gc();
  const retainedBytesPerRichResult = Math.round(
    (process.memoryUsage().heapUsed - before) / retained.length,
  );
  assert.equal(retained.length, 20_000);
  assert.notEqual(sink, null);
  process.stdout.write(
    `${JSON.stringify({ cpu: cpus()[0].model, measurements, mode, mounts, node: process.version, react: reactVersion, retainedBytesPerRichResult, round: Number(round), version })}\n`,
  );
}
