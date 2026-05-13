import { existsSync, globSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import yargs from 'yargs';
import { CollectFbtOutput } from './collect.tsx';
import { HashToLeaf } from './FbtCollector.tsx';
import { updateTranslations } from './prepareTranslationsUtils.tsx';
import { loadJSON, TranslationGroup } from './translateUtils.tsx';

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
  .describe('h', 'Display usage message')
  .alias('h', 'help')
  .parseSync();

if (argv.help) {
  y.showHelp();
  process.exit(0);
}

const outputDirectory = join(root, argv['output-dir']);
const files = globSync(join(outputDirectory, '*.json'));

const source = loadJSON<CollectFbtOutput>(join(root, argv['source-strings']));

let phrases: HashToLeaf = Object.create(null);
for (const phrase of source.phrases) {
  if (phrase.hashToLeaf) {
    phrases = { ...phrases, ...phrase.hashToLeaf };
  }
}

const locales = new Set(argv.locales?.map(String) || []);
for (const file of files) {
  locales.add(basename(file, '.json'));
}

for (const locale of locales) {
  console.log('Processing locale:', locale);
  const filePath = join(outputDirectory, `${locale}.json`);
  const { translations, ...props } = existsSync(filePath)
    ? loadJSON<TranslationGroup>(filePath)
    : { translations: {} };

  writeFileSync(
    filePath,
    JSON.stringify(
      {
        'fb-locale': locale,
        ...props,
        translations: updateTranslations(
          phrases,
          translations,
          argv['sort-by-hash'],
        ),
      } satisfies TranslationGroup,
      null,
      2,
    ),
  );
}
