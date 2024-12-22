/**
 * Reads the JSON payload of the source strings of the following form:
 *
 * {
 *  "phrases": [
 *    {
 *      "hashToText": {
 *        "40bd5bc10bd59fe020569068cfd7d814": "Your FBT Demo"
 *      },
 *      ...,
 *      "jsfbt": "Your FBT Demo"
 *    },
 *    ...
 *  ],
 * }
 *
 * and JSON payloads (either in an arbitrary number of files when
 * using --translations) or grouped in a monolithic JSON file when
 * using --stdin array under `translationGroups`
 *
 *  {
 *    "fb-locale": "fb_HX",
 *    "translations": {
 *      "JBhJwfCe2TutVvTr9c9HLw==": {
 *        "tokens": {},
 *        "types": {},
 *        "translations": [{
 *          "translation": "Y0ur FBT D3m0",
 *          "variations": []
 *        }]
 *      }
 *    }
 *  }
 *
 * and by default, returns the translated phrases in the following format:
 *
 * [
 *   {
 *     "fb-locale":"fb_HX",
 *     "translatedPhrases":[
 *       "Y0ur FBT D3m0",
 *        ...,
 *     ]
 *   }
 *   ...,
 * ]
 *
 * If intended for use as a runtime dictionary (accessed within the
 * runtime `fbt._` via `FbtTranslations` when using the
 * babel-fbt-runtime plugin), You can:
 *
 *  (A) Rely on the jenkins hash default and pass the --jenkins option OR
 *  (B) Pass in a custom hash module as --fbt-hash-module.
 *    You MUST ensure this is the same hash module as used in the
 *    babel-fbt-runtime.  Otherwise, you'll have a BAD time
 *
 * When using the runtime dictionary options, output will be of the form:
 *
 *  {
 *    <locale>: {
 *      <hash>: <payload>,
 *      ...
 *    },
 *    ...
 *   }
 *
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path, { join } from 'node:path';
import yargs from 'yargs';
import {
  LocaleToHashToTranslationResult,
  processFiles,
  processJSON,
  TranslatedGroups,
} from './translateUtils.tsx';

const y = yargs(process.argv.slice(2));
const argv = y
  .usage('Translate fbt phrases with provided translations:\n$0 [options]')
  .boolean('jenkins')
  .default('jenkins', false)
  .describe(
    'jenkins',
    'By default, we output the translations as an associative array whose ' +
      "indices match the phrases provided.  If instead, you'd like a mapping " +
      'from the associated "jenkins" hash to translation payload (for use in ' +
      'babel-fbt-runtime plugin, for instance) you can use this',
  )
  .string('fbt-hash-module')
  .default('fbt-hash-module', false)
  .describe(
    'fbt-hash-module',
    `Similar to --jenkins, but pass the hash-module of your choice.  The ` +
      'module should export a function with the same signature and operation ' +
      'of fbt-hash-module',
  )
  .boolean('stdin')
  .default('stdin', false)
  .describe(
    'stdin',
    'Instead of reading translation files and source file separately, read ' +
      'from STDIN as a monolithic JSON payload',
  )
  .string('source-strings')
  .default('source-strings', join(process.cwd(), '.source_strings.json'))
  .describe(
    'source-strings',
    'The file containing source strings, as collected by collectFbt.js',
  )
  .array('translations')
  .describe(
    'translations',
    'The translation files containing translations corresponding to source-strings',
  )
  .boolean('pretty')
  .default('pretty', false)
  .describe('pretty', 'pretty print the translation output')
  .describe('h', 'Display usage message')
  .alias('h', 'help')
  .string('output-dir')
  .default('output-dir', null)
  .alias('output-dir', 'o')
  .describe(
    'output-dir',
    'By default, we write the output to stdout. If you instead would like to split ' +
      'the output by locale you can use this arg to specify an output directory. ' +
      'This is useful when you want to lazy load translations per locale.',
  )
  .boolean('strict')
  .default('strict', false)
  .describe(
    'strict',
    'By default, we log missing values in the translation file to stderr. ' +
      'If you instead would like to stop execution on missing values you can use this.',
  )
  .parseSync();

function createJSON(obj: unknown) {
  return JSON.stringify(obj, null, argv.pretty ? 2 : undefined);
}

function writeOutput(
  output: LocaleToHashToTranslationResult | TranslatedGroups,
) {
  const outputDir = argv['output-dir'];
  if (outputDir) {
    mkdirSync(outputDir, { recursive: true });
    Object.keys(output).forEach((locale) => {
      writeFileSync(
        path.join(outputDir, `${locale}.json`),
        // @ts-expect-error
        createJSON({ [locale]: output[locale] }),
      );
    });
  } else {
    process.stdout.write(createJSON(output));
  }
}

if (argv.help) {
  y.showHelp();
  process.exit(0);
}

const translationOptions = {
  hashModule: argv['fbt-hash-module'],
  jenkins: argv['jenkins'],
  strict: argv['strict'],
} as const;

if (argv['stdin']) {
  const stream = process.stdin;
  let source = '';
  stream
    .setEncoding('utf8')
    .on('data', (chunk) => {
      source += chunk;
    })
    .on('end', async () => {
      writeOutput(await processJSON(JSON.parse(source), translationOptions));
    });
} else {
  writeOutput(
    await processFiles(
      argv['source-strings'],
      argv['translations']?.map(String) || [],
      translationOptions,
    ),
  );
}
