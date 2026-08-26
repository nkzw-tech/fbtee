import assert from 'node:assert/strict';
import { build } from 'vite';
import fbtee, { fbtee as namedFbtee } from '../index.js';

assert.equal(fbtee, namedFbtee);

const plugin = fbtee();
assert.equal(plugin.name, 'vite-plugin-fbtee');
assert.equal(plugin.enforce, 'pre');
assert.equal(
  plugin.transform.filter.code.test(`const value = fbt('A', 'd');`),
  true,
);
assert.equal(
  plugin.transform.filter.code.test(`// fbs can be used here`),
  true,
);
assert.equal(
  plugin.transform.filter.code.test(`const value = 'plain';`),
  false,
);
assert.equal(
  plugin.transform.handler(`const value = 'plain';`, 'source.ts'),
  null,
);

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
