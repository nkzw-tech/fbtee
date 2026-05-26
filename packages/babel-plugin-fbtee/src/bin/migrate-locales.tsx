import {
  existsSync,
  globSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import yargs from 'yargs';
import {
  formatLocaleForStyle,
  getLocaleIdentity,
  throwIfLocaleFileConflicts,
} from '../localeIdentifier.tsx';
import type { LocaleStyle } from '../localeIdentifier.tsx';

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
  .choices('to', ['bcp47', 'legacy'] as const)
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

function updateLocaleKeys(value: unknown, targetLocale: string): unknown {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const object = value as Record<string, unknown>;
  const next = { ...object };
  if (
    typeof next['fb-locale'] === 'string' &&
    getLocaleIdentity(next['fb-locale']) === getLocaleIdentity(targetLocale)
  ) {
    next['fb-locale'] = targetLocale;
  }

  for (const key of Object.keys(next)) {
    if (getLocaleIdentity(key) === getLocaleIdentity(targetLocale)) {
      const value = next[key];
      delete next[key];
      next[targetLocale] = value;
    }
  }

  return next;
}

for (const directory of argv.dir.map(String)) {
  const absoluteDirectory = join(root, directory);
  const files = globSync(join(absoluteDirectory, '*.json'));
  throwIfLocaleFileConflicts(files);

  for (const file of files) {
    const locale = basename(file, '.json');
    const targetLocale = formatLocaleForStyle(locale, argv.to as LocaleStyle);
    const targetFile = join(dirname(file), `${targetLocale}.json`);
    const json = JSON.parse(readFileSync(file, 'utf8'));
    const updatedJSON = JSON.stringify(
      updateLocaleKeys(json, targetLocale),
      null,
      2,
    );

    if (file === targetFile) {
      if (argv['dry-run']) {
        console.log(`Update ${file}`);
      } else {
        writeFileSync(file, updatedJSON);
      }
      continue;
    }

    if (existsSync(targetFile)) {
      throw new Error(`Cannot rename ${file} to ${targetFile}: target exists.`);
    }

    if (argv['dry-run']) {
      console.log(`Rename ${file} -> ${targetFile}`);
    } else {
      mkdirSync(dirname(targetFile), { recursive: true });
      writeFileSync(file, updatedJSON);
      renameSync(file, targetFile);
    }
  }
}
