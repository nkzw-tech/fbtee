import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Exercise the README workflow in a consumer project, through the CLI rather
// than the binding API. spawnSync passes quoted glob arguments literally.
export const testCliWorkflow = (command, prefix = []) => {
  const cwd = mkdtempSync(join(tmpdir(), 'fbtee cli [workflow]-'));
  const run = (...args) => {
    const result = spawnSync(command, [...prefix, ...args], { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, `${args.join(' ')}\n${result.error || result.stderr}`);
    return result.stdout;
  };
  const fails = (args, diagnostic) => {
    const result = spawnSync(command, [...prefix, ...args], { cwd, encoding: 'utf8' });
    assert.equal(result.status, 1, result.error?.message || result.stdout);
    assert.match(result.stderr, diagnostic);
  };
  const read = (path) => JSON.parse(readFileSync(join(cwd, path), 'utf8'));
  const write = (path, value) => writeFileSync(join(cwd, path), JSON.stringify(value));
  const locales = ['de-DE', 'fr-FR', 'ja-JP'];
  const translated = ['Hallo Welt', 'Bonjour le monde', 'こんにちは世界'];
  try {
    mkdirSync(join(cwd, 'src'));
    writeFileSync(
      join(cwd, 'src/App.tsx'),
      'export const Greeting = () => <fbt desc="Home greeting">Hello world</fbt>;',
    );
    run('collect');
    const source = read('source_strings.json');
    const phrase = source.phrases.find(({ jsfbt }) => jsfbt.t.text === 'Hello world');
    assert.ok(phrase, 'collect must extract the app phrase');
    const hash = Object.keys(phrase.hashToLeaf)[0];
    assert.deepEqual(read('.enum_manifest.json'), {});

    run(
      'prepare-translations',
      '--source-strings',
      'source_strings.json',
      '--output-dir',
      'translations',
      '--locales',
      ...locales,
    );
    assert.deepEqual(
      readdirSync(join(cwd, 'translations')).sort(),
      locales.map((l) => `${l}.json`),
    );
    for (const [index, locale] of locales.entries()) {
      const path = `translations/${locale}.json`;
      const group = read(path);
      assert.equal(group['fb-locale'], locale);
      assert.equal(group.translations[hash].status, 'new');
      assert.equal(group.translations[hash].description, 'Home greeting');
      group.translations[hash].translations[0].translation = translated[index];
      delete group.translations[hash].status;
      write(path, group);
    }

    // The short workflow merges already configured locales without --locales.
    run(
      'prepare-translations',
      '--source-strings',
      'source_strings.json',
      '--output-dir',
      'translations',
    );
    for (const [index, locale] of locales.entries()) {
      const entry = read(`translations/${locale}.json`).translations[hash];
      assert.equal(entry.status, undefined);
      assert.equal(entry.translations[0].translation, translated[index]);
    }

    run(
      'translate',
      '--source-strings',
      'source_strings.json',
      '--translations',
      'translations/*.json',
      '--output-dir',
      'src/translations',
    );
    const expected = Object.fromEntries(
      locales.map((locale, index) => {
        const output = read(`src/translations/${locale}.json`);
        assert.deepEqual(Object.keys(output), [locale]);
        assert.ok(Object.values(output[locale]).includes(translated[index]));
        return [locale, output[locale]];
      }),
    );
    assert.deepEqual(
      readdirSync(join(cwd, 'src/translations')).sort(),
      locales.map((l) => `${l}.json`),
    );

    // Defaults, shell-expanded paths, absolute globs, recursive globs, and
    // overlapping inputs must all compile the same dictionaries.
    mkdirSync(join(cwd, 'translations/ignored.json'));
    for (const inputs of [
      [],
      ['translations/de-DE.json', 'translations/fr-FR.json', 'translations/ja-JP.json'],
      [join(cwd, 'translations').replaceAll(/[[\]]/g, (character) => `[${character}]`) + '/*.json'],
      ['translations/**/*.json'],
      ['translations/*.json', './translations/de-DE.json', 'translations/??-??.json'],
    ]) {
      run(
        'translate',
        ...(inputs.length ? ['--translations', ...inputs] : []),
        '--output-file',
        'combined.json',
      );
      assert.deepEqual(read('combined.json'), expected);
    }
    mkdirSync(join(cwd, 'translations/nested'));
    renameSync(join(cwd, 'translations/fr-FR.json'), join(cwd, 'translations/nested/fr-FR.json'));
    run('translate', '--translations', 'translations/*.json', '--output-file', 'shallow.json');
    assert.deepEqual(read('shallow.json'), {
      'de-DE': expected['de-DE'],
      'ja-JP': expected['ja-JP'],
    });
    run('translate', '--translations', 'translations/**/*.json', '--output-file', 'recursive.json');
    assert.deepEqual(read('recursive.json'), expected);
    run(
      'translate',
      '--translations',
      'translations/*.json',
      '--translations',
      'translations/nested/*.json',
      '--output-file',
      'repeated.json',
    );
    assert.deepEqual(read('repeated.json'), expected);
    renameSync(join(cwd, 'translations/nested/fr-FR.json'), join(cwd, 'translations/fr-FR.json'));
    fails(
      ['translate', '--translations', 'translations/missing.json'],
      /Could not read.*missing\.json/,
    );
    fails(['translate', '--translations', 'translations/[.json'], /Invalid translation glob/);
    run('translate', '--translations', 'missing/*.json', '--output-file', 'empty.json');
    assert.deepEqual(read('empty.json'), {});

    write('translations/de_DE.json', read('translations/de-DE.json'));
    fails(
      ['translate', '--translations', 'translations/*.json'],
      /Conflicting translation files.*de-DE/,
    );
    rmSync(join(cwd, 'translations/de_DE.json'));
    rmSync(join(cwd, 'translations/ignored.json'), { recursive: true });

    run('migrate-locales', '--to', 'legacy', '--dir', 'translations', '--dir', 'src/translations');
    const legacy = read('translations/de_DE.json');
    assert.equal(legacy['fb-locale'], 'de_DE');
    assert.deepEqual(read('src/translations/de_DE.json'), { de_DE: expected['de-DE'] });
    const dryRun = run(
      'migrate-locales',
      '--to',
      'bcp47',
      '--dir',
      'translations',
      '--dir',
      'src/translations',
      '--dry-run',
    );
    assert.match(dryRun, /Rename/);
    assert.deepEqual(read('translations/de_DE.json'), legacy);
    assert.equal(existsSync(join(cwd, 'translations/de-DE.json')), false);

    run('migrate-locales', '--to', 'bcp47', '--dir', 'translations', '--dir', 'src/translations');
    run('translate', '--output-locale-style=bcp47');
    for (const locale of locales) {
      assert.equal(read(`translations/${locale}.json`)['fb-locale'], locale);
      assert.deepEqual(read(`src/translations/${locale}.json`), { [locale]: expected[locale] });
      assert.equal(existsSync(join(cwd, `translations/${locale.replace('-', '_')}.json`)), false);
    }
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
};

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  testCliWorkflow(resolve(process.argv[2]));
}
