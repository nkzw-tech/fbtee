import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const packageDirectory = process.argv[2];
assert.ok(packageDirectory, 'Missing packed package directory');
const resolvedPackageDirectory = isAbsolute(packageDirectory)
  ? packageDirectory
  : resolve(packageDirectory);
const tarballs = readdirSync(resolvedPackageDirectory)
  .filter((file) => file.endsWith('.tgz'))
  .map((file) => join(resolvedPackageDirectory, file));
assert.equal(
  tarballs.length,
  3,
  'Expected transform, Vite, and platform package tarballs',
);

const consumer = mkdtempSync(join(tmpdir(), 'fbtee-native-smoke-'));
try {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const installed = spawnSync(
    npm,
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', ...tarballs],
    { cwd: consumer, encoding: 'utf8' },
  );
  assert.equal(installed.status, 0, installed.stderr || installed.stdout);

  const entry = join(
    consumer,
    'node_modules',
    '@nkzw',
    'oxc-transform-fbtee',
    'index.js',
  );
  const { transformSync } = await import(pathToFileURL(entry));
  const result = transformSync(
    'native-smoke.tsx',
    `const message = <fbt desc="native smoke">Hello <b>world</b></fbt>;`,
    { lang: 'tsx', sourceType: 'module' },
  );
  assert.deepEqual(result.errors, []);
  assert.match(result.code, /fbt\._\(/);
  assert.match(result.code, /fbt\._implicitParam\(/);

  const viteEntry = join(
    consumer,
    'node_modules',
    '@nkzw',
    'vite-plugin-fbtee',
    'index.js',
  );
  const { default: createFbteeVitePlugin } = await import(
    pathToFileURL(viteEntry)
  );
  const plugin = createFbteeVitePlugin();
  assert.equal(
    plugin.transform.handler(`const value = 'plain';`, 'plain.ts'),
    null,
  );
  assert.match(
    plugin.transform.handler(
      `<fbt desc="native Vite smoke">Hello</fbt>;`,
      'native-smoke.tsx',
    ).code,
    /fbt\._\(/,
  );
} finally {
  rmSync(consumer, { force: true, recursive: true });
}
