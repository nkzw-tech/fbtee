import { existsSync, globSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { prepareTranslationsBatchSync } from '@nkzw/oxc-transform-fbtee';
import yargs from 'yargs';
import {
  formatLocaleForStyle,
  getAvailableLocaleFile,
  throwIfLocaleFileConflicts,
} from './oxc-locale.mjs';

const root = process.cwd();
const y = yargs(process.argv.slice(2));
const argv = y
  .scriptName('fbtee')
  .usage(
    'Prepare translation files by merging phrases with existing translations:\n$0 [options]',
  )
  .string('source-strings')
  .default('source-strings', 'source_strings.json')
  .describe(
    'source-strings',
    'The file containing source strings, as collected by collectFbt.js',
  )
  .string('output-dir')
  .alias('output-dir', 'o')
  .default('output-dir', 'translations/')
  .describe(
    'output-dir',
    'The directory where all translation files will be written. Existing translation files will be loaded from this directory.',
  )
  .describe(
    'locales',
    'A list of locales to process. Useful to create the initial translation files if none exist.',
  )
  .array('locales')
  .alias('locales', 'locale')
  .boolean('sort-by-hash')
  .default('sort-by-hash', false)
  .describe(
    'sort-by-hash',
    'Sort translation entries by hash key in output JSON. Applies to all entries (both existing and new).',
  )
  .choices('output-locale-style', ['bcp47', 'legacy', 'preserve'])
  .default('output-locale-style', 'bcp47')
  .alias('output-locale-style', 'locale-style')
  .describe(
    'output-locale-style',
    'Controls newly-created locale file names and fb-locale values. Existing locale files are updated in place.',
  )
  .describe('h', 'Display usage message')
  .alias('h', 'help')
  .parseSync();

if (argv.help) {
  y.showHelp();
  process.exit(0);
}

const outputDirectory = join(root, argv['output-dir']);
const files = globSync(join(outputDirectory, '*.json'));
throwIfLocaleFileConflicts(files);
const locales = new Set(argv.locales?.map(String) || []);
for (const file of files) {
  locales.add(basename(file, '.json'));
}
const source = readFileSync(join(root, argv['source-strings']), 'utf8');
const pending = [];
for (const locale of locales) {
  const existingFile = getAvailableLocaleFile(outputDirectory, locale);
  const outputLocale = existingFile
    ? basename(existingFile, '.json')
    : formatLocaleForStyle(locale, argv['output-locale-style']);
  process.stdout.write(`Processing locale: ${outputLocale}\n`);
  const filePath =
    existingFile || join(outputDirectory, `${outputLocale}.json`);
  pending.push({
    existingJson: existsSync(filePath)
      ? readFileSync(filePath, 'utf8')
      : undefined,
    filePath,
    locale: outputLocale,
  });
}
const outputs = prepareTranslationsBatchSync(
  source,
  pending.map(({ existingJson, locale }) => ({ existingJson, locale })),
  argv['sort-by-hash'],
);
for (let index = 0; index < pending.length; index++) {
  const { filePath } = pending[index];
  const output = outputs[index];
  writeFileSync(filePath, JSON.stringify(JSON.parse(output), null, 2));
}
