import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { collectSync, transformSync, translateSync } from '@nkzw/fbtee-compiler';
import { runWithFbtee } from 'fbtee/server';
import { renderToPipeableStream } from 'next/dist/compiled/react-server-dom-webpack/server.node.js';
import { transformSync as lowerSync } from 'oxc-transform';
import { createElement } from 'react';

const source = `
import { fbs } from 'fbtee';

export async function Page({ started, wait }) {
  started();
  await wait;
  return <p title={fbs('Title', 'Request title')}><fbt desc="Request message">Message</fbt></p>;
}
`;
const transformed = transformSync('page.tsx', source);
assert.deepEqual(transformed.errors, []);
const lowered = lowerSync('page.tsx', transformed.code, { jsx: { runtime: 'automatic' } });
assert.deepEqual(lowered.errors, []);
const { Page } = await (async () => {
  const directory = mkdtempSync(join(tmpdir(), 'fbtee-rsc-'));
  try {
    const code = lowered.code.replaceAll(
      /from\s+(["'])([^"']+)\1/g,
      (_, _quote, specifier) => `from ${JSON.stringify(import.meta.resolve(specifier))}`,
    );
    writeFileSync(join(directory, 'page.mjs'), code);
    return await import(pathToFileURL(join(directory, 'page.mjs')));
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
})();

const collected = collectSync('page.tsx', source, { collectPackager: 'text' });
assert.deepEqual(collected.errors, []);
const { phrases } = JSON.parse(collected.output);

function catalog(locale, messages) {
  const translations = {};
  for (const { hashToLeaf } of phrases) {
    for (const [hash, { text }] of Object.entries(hashToLeaf)) {
      translations[hash] = {
        tokens: [],
        translations: [{ translation: messages[text], variations: {} }],
        types: [],
      };
    }
  }
  return JSON.parse(
    translateSync(
      JSON.stringify({
        phrases,
        translationGroups: [{ 'fb-locale': locale, translations }],
      }),
    ),
  );
}

test(
  'the RSC renderer retains scope across concurrent async Server Components',
  { timeout: 10_000 },
  async () => {
    function render(locale, messages) {
      const started = Promise.withResolvers();
      const gate = Promise.withResolvers();
      const output = runWithFbtee(
        { locale, translations: catalog(locale, messages) },
        () =>
          new Promise((resolve, reject) => {
            const destination = new PassThrough();
            let chunks = '';
            destination.on('data', (chunk) => {
              chunks += chunk;
            });
            destination.on('end', () => resolve(chunks));
            destination.on('error', reject);
            renderToPipeableStream(
              createElement(Page, { started: () => started.resolve(), wait: gate.promise }),
              {},
              { onError: reject },
            ).pipe(destination);
          }),
      );
      return { output, resume: () => gate.resolve(), started: started.promise };
    }

    const german = render('de-DE', { Message: 'Nachricht', Title: 'Deutscher Titel' });
    const french = render('fr-FR', { Message: 'Message français', Title: 'Titre français' });
    await Promise.all([german.started, french.started]);
    french.resume();
    const frenchOutput = await french.output;
    german.resume();
    const germanOutput = await german.output;

    assert.match(germanOutput, /"children":"Nachricht"/);
    assert.match(germanOutput, /"title":"Deutscher Titel"/);
    assert.doesNotMatch(germanOutput, /Message français|Titre français/);
    assert.match(frenchOutput, /"children":"Message français"/);
    assert.match(frenchOutput, /"title":"Titre français"/);
    assert.doesNotMatch(frenchOutput, /Nachricht|Deutscher Titel/);
  },
);
