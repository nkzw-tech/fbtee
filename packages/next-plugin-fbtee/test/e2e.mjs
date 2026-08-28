import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import withFbtee, { withFbtee as namedWithFbtee } from '../index.js';

const require = createRequire(import.meta.url);
const loader = require('../loader.cjs');
const packageDirectory = fileURLToPath(new URL('../', import.meta.url));
const fixtureDirectory = join(packageDirectory, 'test', 'fixture');

assert.equal(withFbtee, namedWithFbtee);

const options = { fbtCommon: { Continue: 'Continue button label' } };
let userWebpackCalled = false;
const existingTurbopackRule = { loaders: ['existing-loader'] };
const configured = withFbtee(options)({
  turbopack: { rules: { '*.tsx': existingTurbopackRule } },
  webpack(configuration) {
    userWebpackCalled = true;
    configuration.existing = true;
    return configuration;
  },
});
assert.equal(configured.existing, undefined);
assert.ok(Array.isArray(configured.turbopack.rules['*.tsx']));
assert.equal(configured.turbopack.rules['*.tsx'][1], existingTurbopackRule);
assert.deepEqual(
  configured.turbopack.rules['*.tsx'][0].loaders[0].options,
  options,
);
const webpackConfiguration = configured.webpack({ module: { rules: [] } }, {});
assert.equal(userWebpackCalled, true);
assert.equal(webpackConfiguration.existing, true);
assert.equal(webpackConfiguration.module.rules[0].enforce, 'pre');
assert.deepEqual(webpackConfiguration.module.rules[0].use[0].options, options);
const asyncConfigured = withFbtee()({
  async webpack() {},
});
assert.equal(
  (await asyncConfigured.webpack({ module: { rules: [] } }, {})).module.rules[0]
    .enforce,
  'pre',
);

const createLoaderCallback =
  (resolve, reject, getCacheable) => (error, code, map) =>
    error ? reject(error) : resolve({ cacheable: getCacheable(), code, map });

const runLoader = (source, resourcePath, loaderOptions = {}) =>
  new Promise((resolve, reject) => {
    let cacheable = false;
    loader.call(
      {
        async: () => createLoaderCallback(resolve, reject, () => cacheable),
        cacheable: () => {
          cacheable = true;
        },
        getOptions: () => loaderOptions,
        resourcePath,
      },
      source,
      { version: 3 },
    );
  });

const skipped = await runLoader(
  `export const value = 'plain';`,
  join(fixtureDirectory, 'plain.ts'),
);
assert.equal(skipped.cacheable, true);
assert.equal(skipped.code, `export const value = 'plain';`);
assert.deepEqual(skipped.map, { version: 3 });

const transformed = await runLoader(
  `export const value = <fbt desc="Next loader fixture">Hello</fbt>;`,
  join(fixtureDirectory, 'source.tsx'),
);
assert.match(transformed.code, /fbt\._\("Hello"/);
assert.equal(transformed.map.version, 3);
assert.deepEqual(transformed.map.sources, [
  join(fixtureDirectory, 'source.tsx'),
]);

await assert.rejects(
  runLoader(
    `export const value = fbt.param('name', value);`,
    join(fixtureDirectory, 'invalid.ts'),
  ),
  /must be inside an fbt/,
);

const collectFiles = (directory) => {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(path));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
};

const readBuildOutput = (directory) =>
  collectFiles(directory)
    .filter((file) => /\.(?:html|js|json|rsc)$/.test(file))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');

const fixtureSources = [
  join(fixtureDirectory, 'app', 'page.tsx'),
  join(fixtureDirectory, 'app', 'client-phrase.tsx'),
  join(fixtureDirectory, 'pages', 'legacy.tsx'),
];
const expectedHashes = (
  await Promise.all(
    fixtureSources.map(async (file) =>
      runLoader(readFileSync(file, 'utf8'), file),
    ),
  )
).flatMap(({ code }) =>
  Array.from(code.matchAll(/hk:\s*"([^"]+)"/g), (match) => match[1]),
);
assert.equal(expectedHashes.length, 3);
const bundledPhrases = [
  'App Router server phrase',
  'Client clicks:',
  'Pages Router phrase',
];

for (const mode of ['turbopack', 'webpack']) {
  const distDirectory = '.next';
  const args = ['build', fixtureDirectory];
  if (mode === 'webpack') {
    args.push('--webpack');
  }
  const result = spawnSync(
    process.execPath,
    [require.resolve('next/dist/bin/next'), ...args],
    {
      cwd: packageDirectory,
      encoding: 'utf8',
      env: {
        ...process.env,
        CI: '1',
        NEXT_TELEMETRY_DISABLED: '1',
      },
      maxBuffer: 20 * 1024 * 1024,
    },
  );
  assert.equal(
    result.status,
    0,
    result.error?.message || `${result.stdout}\n${result.stderr}`,
  );

  const buildDirectory = join(fixtureDirectory, distDirectory);
  const output = readBuildOutput(buildDirectory);
  for (const text of bundledPhrases) {
    assert.equal(output.includes(text), true);
  }
  for (const hash of expectedHashes) {
    assert.equal(output.includes(hash), true);
  }

  const serverOutput = readBuildOutput(join(buildDirectory, 'server'));
  assert.equal(serverOutput.includes(expectedHashes[0]), true);
  assert.equal(serverOutput.includes(expectedHashes[1]), true);

  const clientOutput = readBuildOutput(join(buildDirectory, 'static'));
  assert.equal(clientOutput.includes(expectedHashes[1]), true);
  assert.equal(clientOutput.includes(expectedHashes[2]), true);
}
