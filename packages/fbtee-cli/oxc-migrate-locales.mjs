import { existsSync, globSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { migrateLocaleJsonSync } from '@nkzw/oxc-transform-fbtee';
import yargs from 'yargs';
import {
  formatLocaleForStyle,
  getLocaleFileAliases,
  getLocaleIdentity,
  throwIfLocaleFileConflicts,
} from './oxc-locale.mjs';

const root = process.cwd();
const y = yargs(process.argv.slice(2));
const argv = y
  .scriptName('fbtee')
  .usage('Rename locale JSON artifacts between legacy and BCP 47 spelling:\n$0')
  .array('dir')
  .default('dir', ['translations/'])
  .describe(
    'dir',
    'A directory containing locale-named JSON files. Repeat this option to migrate multiple directories.',
  )
  .choices('to', ['bcp47', 'legacy'])
  .default('to', 'bcp47')
  .describe('to', 'The target locale identifier style.')
  .boolean('dry-run')
  .default('dry-run', false)
  .describe('dry-run', 'Print planned changes without writing files.')
  .describe('h', 'Display usage message')
  .alias('h', 'help')
  .parseSync();

if (argv.help) {
  y.showHelp();
  process.exit(0);
}

for (const directory of argv.dir.map(String)) {
  const files = globSync(join(root, directory, '*.json'));
  throwIfLocaleFileConflicts(files);
  for (const file of files) {
    const locale = basename(file, '.json');
    const targetLocale = formatLocaleForStyle(locale, argv.to);
    const targetFile = join(dirname(file), `${targetLocale}.json`);
    const input = JSON.parse(readFileSync(file, 'utf8'));
    const targetIdentity = getLocaleIdentity(targetLocale);
    // File aliases describe spelling variants of the same locale (de_DE/de-DE).
    // Language fallback aliases such as `de` are distinct translation payloads and
    // must never be renamed over the regional locale.
    const equivalentLocales = new Set(getLocaleFileAliases(targetLocale));
    for (const key of Object.keys(input)) {
      if (getLocaleIdentity(key) === targetIdentity) {
        equivalentLocales.add(key);
      }
    }
    if (
      typeof input['fb-locale'] === 'string' &&
      getLocaleIdentity(input['fb-locale']) === targetIdentity
    ) {
      equivalentLocales.add(input['fb-locale']);
    }
    const updated = migrateLocaleJsonSync(JSON.stringify(input), targetLocale, [
      ...equivalentLocales,
    ]);
    const output = JSON.stringify(JSON.parse(updated), null, 2);
    if (file === targetFile) {
      if (argv['dry-run']) {
        process.stdout.write(`Update ${file}\n`);
      } else {
        writeFileSync(file, output);
      }
    } else {
      if (existsSync(targetFile)) {
        throw new Error(`Cannot rename ${file} to ${targetFile}: target exists.`);
      }
      if (argv['dry-run']) {
        process.stdout.write(`Rename ${file} -> ${targetFile}\n`);
      } else {
        mkdirSync(dirname(targetFile), { recursive: true });
        writeFileSync(file, output);
        renameSync(file, targetFile);
      }
    }
  }
}
