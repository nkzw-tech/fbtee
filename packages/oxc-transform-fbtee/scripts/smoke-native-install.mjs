import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const smokeInstalledPackages = async (consumer) => {
  const entry = join(
    consumer,
    'node_modules',
    '@nkzw',
    'oxc-transform-fbtee',
    'index.js',
  );
  const {
    collectSync,
    migrateLocaleJsonSync,
    prepareTranslationsSync,
    transformSync,
    translateSync,
  } = await import(pathToFileURL(entry));
  for (const nativeFunction of [
    collectSync,
    migrateLocaleJsonSync,
    prepareTranslationsSync,
    transformSync,
    translateSync,
  ]) {
    assert.equal(typeof nativeFunction, 'function');
  }
  const result = transformSync(
    'native-smoke.tsx',
    `const message = <fbt desc="native smoke">Hello <b>world</b></fbt>;`,
    { lang: 'tsx', sourceType: 'module' },
  );
  assert.deepEqual(result.errors, []);
  assert.match(result.code, /fbt\._\(/);
  assert.match(result.code, /fbt\._implicitParam\(/);

  const collected = collectSync(
    'native-smoke.tsx',
    `const message = <fbt desc="native collector smoke">Hello</fbt>;`,
    { collectPackager: 'text', lang: 'tsx', sourceType: 'module' },
  );
  assert.deepEqual(collected.errors, []);
  assert.equal(JSON.parse(collected.output).phrases.length, 1);

  const translated = translateSync(
    JSON.stringify({
      phrases: [
        {
          hashToLeaf: { hash: { desc: 'd', text: 'A' } },
          jsfbt: { m: [], t: { desc: 'd', text: 'A' } },
        },
      ],
      translationGroups: [
        {
          'fb-locale': 'de_DE',
          translations: {
            hash: {
              tokens: [],
              translations: [{ translation: 'Ein A', variations: {} }],
              types: [],
            },
          },
        },
      ],
    }),
    false,
  );
  assert.equal(JSON.parse(translated)[0].translatedPhrases[0], 'Ein A');

  const prepared = prepareTranslationsSync(
    JSON.stringify({
      phrases: [
        { hashToLeaf: { hash: { desc: 'description', text: 'Source' } } },
      ],
    }),
    null,
    'de-DE',
    false,
  );
  assert.equal(JSON.parse(prepared)['fb-locale'], 'de-DE');
  const migrated = migrateLocaleJsonSync(
    JSON.stringify({ de_DE: { hash: 'Text' }, 'fb-locale': 'de_DE' }),
    'de-DE',
    ['de_DE', 'de-DE'],
  );
  assert.equal(JSON.parse(migrated)['fb-locale'], 'de-DE');
  assert.deepEqual(JSON.parse(migrated)['de-DE'], { hash: 'Text' });

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

  const nextEntry = join(
    consumer,
    'node_modules',
    '@nkzw',
    'next-plugin-fbtee',
    'index.js',
  );
  const { default: withFbtee } = await import(pathToFileURL(nextEntry));
  const nextConfig = withFbtee()({});
  const nextRule = nextConfig.turbopack.rules['*.tsx'];
  assert.ok(existsSync(nextRule.loaders[0].loader));
  const webpackConfig = nextConfig.webpack({ module: { rules: [] } }, {});
  assert.ok(existsSync(webpackConfig.module.rules[0].use[0].loader));
};

const run = async () => {
  if (process.argv[2] === '--smoke-installed') {
    const consumer = process.argv[3];
    assert.ok(consumer, 'Missing installed package directory');
    await smokeInstalledPackages(consumer);
    return;
  }

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
    4,
    'Expected transform, Next.js, Vite, and platform package tarballs',
  );

  const consumer = mkdtempSync(join(tmpdir(), 'fbtee-native-smoke-'));
  try {
    const args = [
      'install',
      '--ignore-scripts',
      '--legacy-peer-deps',
      '--no-audit',
      '--no-fund',
      ...tarballs,
    ];
    const isWindows = process.platform === 'win32';
    const installed = spawnSync(
      isWindows ? (process.env.ComSpec ?? 'cmd.exe') : 'npm',
      isWindows ? ['/d', '/s', '/c', 'npm', ...args] : args,
      { cwd: consumer, encoding: 'utf8' },
    );
    assert.equal(
      installed.status,
      0,
      installed.error?.message ||
        installed.stderr ||
        installed.stdout ||
        'npm install failed without output.',
    );

    // Native modules remain locked for the lifetime of a Node process on
    // Windows. Load and exercise the binding in a child so it is released
    // before the temporary installation is removed.
    const smoked = spawnSync(
      process.execPath,
      [import.meta.filename, '--smoke-installed', consumer],
      { encoding: 'utf8' },
    );
    assert.equal(
      smoked.status,
      0,
      smoked.error?.message ||
        smoked.stderr ||
        smoked.stdout ||
        'Native package smoke test failed without output.',
    );
  } finally {
    rmSync(consumer, {
      force: true,
      maxRetries: 5,
      recursive: true,
      retryDelay: 100,
    });
  }
};

await run();
