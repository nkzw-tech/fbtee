import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import fbtee, { fbtee as namedFbtee } from '../index.js';

assert.equal(fbtee, namedFbtee);

const plugin = fbtee();
assert.equal(plugin.name, 'vite-plugin-fbtee');
assert.equal(plugin.enforce, 'pre');
assert.equal(plugin.transform.filter.code.test(`const value = fbt('A', 'd');`), true);
assert.equal(plugin.transform.filter.code.test(`// fbs can be used here`), true);
assert.equal(plugin.transform.filter.code.test(`const value = 'plain';`), false);
assert.equal(plugin.transform.handler(`const value = 'plain';`, 'source.ts'), null);

const transformed = plugin.transform.handler(
  `const value = <fbt desc="vite test">Hello</fbt>;`,
  'source.tsx?v=1',
);
assert.match(transformed.code, /fbt\._\("Hello"/);
assert.equal(transformed.map.version, 3);
assert.deepEqual(transformed.map.sources, ['source.tsx?v=1']);

const bundle = await build({
  build: {
    minify: false,
    rollupOptions: {
      external: ['fbtee'],
      input: 'virtual-entry.tsx',
    },
    write: false,
  },
  logLevel: 'silent',
  plugins: [
    {
      load(id) {
        if (id === 'virtual-entry.tsx') {
          return `export const value = <fbt desc="Vite integration">Hello</fbt>;`;
        }
      },
      name: 'virtual-entry',
      resolveId(id) {
        if (id === 'virtual-entry.tsx') {
          return id;
        }
      },
    },
    fbtee(),
  ],
});
assert.match(bundle.output[0].code, /\._\("Hello"/);
assert.match(bundle.output[0].code, /hk:/);

const browserEntry = fileURLToPath(new URL('../../fbtee/test/browser-entry.tsx', import.meta.url));
const browserBundle = await build({
  build: {
    minify: false,
    rollupOptions: { input: browserEntry },
    write: false,
  },
  logLevel: 'silent',
  plugins: [
    {
      load(id) {
        if (id === browserEntry) {
          return `
            import { fbs, setupFbtee } from 'fbtee/server';
            setupFbtee({ translations: {} });
            document.title = fbs('Browser server entry', 'Browser server entry');
          `;
        }
      },
      name: 'browser-entry',
      resolveId(id) {
        if (id === browserEntry) {
          return id;
        }
      },
    },
    fbtee(),
  ],
});
const browserCode = browserBundle.output.map((chunk) => chunk.code || '').join('\n');
assert.match(browserCode, /Browser server entry/);
assert.doesNotMatch(browserCode, /node:|AsyncLocalStorage/);
