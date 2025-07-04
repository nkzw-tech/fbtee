import { existsSync, globSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import yargs from 'yargs';
import { loadJSON, TranslationGroup, Translations } from './translateUtils.tsx';
import { CollectFbtOutput } from './collect.tsx';
import { HashToLeaf } from './FbtCollector.tsx';
import { PatternString } from '../Types.ts';
import { SerializedTranslationData } from '../translate/TranslationData.tsx';

const y = yargs(process.argv.slice(2));
const argv = y
  .usage(
    'Prepare translation files by merging phrases with existing translations:\n$0 [options]',
  )
  .string('source-strings')
  .default('source-strings', 'source_strings.json')
  .describe(
    'source-strings',
    'The file containing source strings, as collected by collectFbt.js',
  )
  .demandOption('output-dir')
  .default('output-dir', null)
  .alias('output-dir', 'o')
  .describe(
    'output-dir',
    'The directory where all translation files will be written. Existing translation files will be loaded from this directory.',
  )
  .describe(
    'locales',
    'A list of locales to process. Useful to create the initial translation files if none exist.',
  )
  .array('locales')
  .boolean('pretty')
  .default('pretty', true)
  .describe('pretty', 'pretty print the translation output')
  .describe('h', 'Display usage message')
  .alias('h', 'help')
  .parseSync();

if (argv.help) {
  y.showHelp();
  process.exit(0);
}

type TranslationsWithMetadata = Partial<
  Record<
    PatternString,
    | (SerializedTranslationData & { description?: string; status?: string })
    | null
  >
>;

const toJSON = (obj: unknown) =>
  JSON.stringify(obj, null, argv.pretty ? 2 : undefined);

const updateTranslations = (
  phrases: HashToLeaf,
  translations: Translations,
) => {
  const hashes = new Set(Object.keys(phrases));
  const translatedHashes = new Set(Object.keys(translations));
  const newHashes = [...hashes].filter((hash) => !translatedHashes.has(hash));
  const removedHashes = [...translatedHashes].filter(
    (hash) => !hashes.has(hash),
  );

  const updatedTranslations: TranslationsWithMetadata = { ...translations };
  for (const hash of newHashes) {
    if (!updatedTranslations[hash]) {
      const phrase = phrases[hash];
      if (phrase) {
        updatedTranslations[hash] = {
          description: phrase.desc,
          status: 'new',
          tokens: [],
          translations: [
            {
              translation: phrase.text,
              variations: {},
            },
          ],
          types: [],
        };
      }
    }
  }

  for (const hash of removedHashes) {
    if (updatedTranslations[hash]) {
      delete updatedTranslations[hash];
    }
  }

  return updatedTranslations;
};

const outputDir = argv['output-dir'];

if (!outputDir) {
  console.error(
    `fbtee: Output directory is required. Use '--output-dir' or '-o' to specify the path to your translation files.`,
  );
  process.exit(1);
}

const outputDirectory = join(process.cwd(), outputDir);
const files = globSync(join(outputDirectory, '*.json'));

const source = loadJSON<CollectFbtOutput>(
  join(process.cwd(), argv['source-strings']),
);

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
    toJSON({
      'fb-locale': locale,
      ...props,
      translations: updateTranslations(phrases, translations),
    } satisfies TranslationGroup),
  );
}
