import assert from 'node:assert/strict';
import { transformSync } from '@swc/core';
import swcFbteePlugin from '../index.js';

const compile = (source, options = {}) =>
  transformSync(source, {
    filename: 'source.tsx',
    jsc: {
      experimental: {
        plugins: [[swcFbteePlugin, options]],
      },
      parser: {
        syntax: 'typescript',
        tsx: true,
      },
      target: 'es2022',
      transform: {
        react: {
          runtime: 'automatic',
        },
      },
    },
    module: {
      type: 'commonjs',
    },
  }).code;

{
  const code = compile(`
    const fbt = require('fbtee');
    const x = fbt('A', 'B');
    globalThis.__fbteeResult = x;
  `);
  const fakeRequire = (name) => {
    assert.equal(name, 'fbtee');
    return {
      _: () => 'ok',
    };
  };
  Function('require', 'globalThis', `${code};`)(fakeRequire, globalThis);
  assert.equal(globalThis.__fbteeResult, 'ok');
  delete globalThis.__fbteeResult;
}

{
  const code = compile(`
    import { fbt } from 'fbtee';
    const x = <fbt desc="d">Hello <b>world</b></fbt>;
  `);
  assert.match(code, /fbt\._\(/);
  assert.match(code, /fbt\._implicitParam\("=m1"/);
  assert.match(code, /fbt\._\("world"/);
  assert.match(code, /hk:\s*"h8w0J"/);
}

{
  const code = compile(`
    import { fbt } from 'fbtee';
    const x = <fbt desc="d">Hello <b>world <i>inner</i></b></fbt>;
  `);
  assert.match(code, /hk:\s*"36nzit"/);
  assert.match(code, /hk:\s*"2YVHfO"/);
  assert.match(code, /hk:\s*"2JgOvk"/);
}

{
  const code = compile(`
    if (cond) {
      const fbt = require('fbtee');
      const x = fbt('A', 'B');
    }
    const y = <fbt desc="d">C</fbt>;
  `);
  assert.match(code, /require\("fbtee"\)/);
  assert.match(code, /const fbt = require\('fbtee'\)/);
  assert.match(code, /fbt\._\("A"/);
  assert.match(code, /fbtee\.fbt\._\("C"/);
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
        Example$FbtEnum: {
          id1: 'groups',
          id2: 'photos',
        },
      },
    },
  );
  assert.match(code, /id1:\s*"Click to see groups"/);
  assert.match(code, /fbt\._enum\(id, Example\)/);
}
