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
 * and returns the translated phrases in the following format:
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
 *  (B) Pass in a custom hash module as --hash-module.
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

import { globSync, mkdirSync, writeFileSync } from 'node:fs';
import path, { join } from 'node:path';
import yargs from 'yargs';
import {
  LocaleToHashToTranslationResult,
  processFiles,
  processJSON,
} from './translateUtils.tsx';

const root = process.cwd();

const y = yargs(process.argv.slice(2));
const argv = y
  .scriptName('fbtee')
  .usage('Translate fbt phrases with provided translations:\n$0 [options]')
  .boolean('jenkins')
  .default('jenkins', true)
  .describe(
    'jenkins',
    `By default translations are output mapping the associated "jenkins" hash to the translation payload.
    Disabling this option will output the translations as an associative array whose
    indices match the phrases provided.`,
  )
  .string('hash-module')
  .default('hash-module', false)
  .describe(
    'hash-module',
    `The hash-module of your choice. The module should export a function with the same signature and operation of hash-module`,
  )
  .boolean('stdin')
  .default('stdin', false)
  .describe(
    'stdin',
    'Instead of reading translation files and source file separately, read ' +
      'from STDIN as a monolithic JSON payload',
  )
  .string('source-strings')
  .default('source-strings', 'source_strings.json')
  .describe(
    'source-strings',
    'The file containing source strings, as collected by collectFbt.js',
  )
  .array('translations')
  .default('translations', globSync('translations/*.json', { cwd: root }))
  .describe(
    'translations',
    'The translation files containing translations corresponding to source-strings',
  )
  .describe('h', 'Display usage message')
  .alias('h', 'help')
  .string('output-dir')
  .alias('output-dir', 'o')
  .default('output-dir', 'src/translations/')
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

if (argv.help) {
  y.showHelp();
  process.exit(0);
}

const writeOutput = (
  outputDir: string,
  output: LocaleToHashToTranslationResult,
) => {
  mkdirSync(outputDir, { recursive: true });
  Object.keys(output).forEach((locale) => {
    writeFileSync(
      path.join(outputDir, `${locale}.json`),
      JSON.stringify({ [locale]: output[locale] }, null, 2),
    );
  });
};

const translationOptions = {
  hashModule: argv['hash-module'],
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
      process.stdout.write(
        JSON.stringify(
          await processJSON(JSON.parse(source), translationOptions),
          null,
          2,
        ),
      );
    });
} else if (argv['output-dir']) {
  writeOutput(
    join(root, argv['output-dir']),
    await processFiles(
      join(root, argv['source-strings']),
      argv['translations']?.map(String) || [],
      translationOptions,
    ),
  );
}
