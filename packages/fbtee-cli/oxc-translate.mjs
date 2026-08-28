import { globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path, { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { translateSync } from '@nkzw/oxc-transform-fbtee';
import yargs from 'yargs';
import {
  formatLocaleForStyle,
  getAvailableLocaleFile,
  getLocaleAliases,
  getLocaleIdentity,
  getLocaleLanguage,
  throwIfLocaleFileConflicts,
} from './oxc-locale.mjs';

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
  .describe('source-strings', 'The file containing source strings, as collected by collectFbt.js')
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
    'By default, we split the output into separate JSON files per locale (en-US.json) ' +
      'in the `src/translations/` folder. Use this parameter to change the output folder. ' +
      'This is useful when you want to lazy load translations per locale.',
  )
  .boolean('strict')
  .default('strict', false)
  .describe(
    'strict',
    'By default, we log missing values in the translation file to stderr. ' +
      'If you instead would like to stop execution on missing values you can use this.',
  )
  .string('output-file')
  .describe(
    'output-file',
    'Specify the file path where the combined translations should be written.',
  )
  .choices('output-locale-style', ['bcp47', 'legacy', 'preserve'])
  .default('output-locale-style', 'bcp47')
  .alias('output-locale-style', 'locale-style')
  .describe(
    'output-locale-style',
    'Controls generated locale identifiers. Existing output files with an aliasing locale name are updated in place.',
  )
  .parseSync();

if (argv.help) {
  y.showHelp();
  process.exit(0);
}

const outputLocaleStyle = argv['output-locale-style'];

function checkTranslations(group) {
  const translations = {};
  for (const [hash, translation] of Object.entries(group.translations)) {
    if (translation == null) {
      const message = `Missing ${group['fb-locale']} translation for string (${hash})`;
      if (argv.strict) {
        throw new Error(message);
      }
      process.stderr.write(`${message}\n`);
    } else {
      translations[hash] = translation;
    }
  }
  return {
    ...group,
    '__gender-fallback': genderFallback(group['fb-locale']),
    '__number-fallback': ['be', 'pl', 'ru', 'szl', 'uk'].includes(
      getLocaleLanguage(group['fb-locale']),
    )
      ? 12
      : 24,
    '__output-locale': formatLocaleForStyle(group['fb-locale'], outputLocaleStyle),
    translations,
  };
}

function genderFallback(locale) {
  const mergedLocales = new Set([
    'ar_AR',
    'ks_IN',
    'lv_LV',
    'ps_AF',
    'qk_DZ',
    'qs_DE',
    'qv_IT',
    'sq_AL',
    'ti_ET',
  ]);
  const mergedLanguages = new Set(['ar', 'dsb', 'kab', 'ks', 'lv', 'ps', 'sq', 'ti', 'vec']);
  return getLocaleAliases(locale).some((alias) => mergedLocales.has(alias)) ||
    mergedLanguages.has(getLocaleLanguage(locale))
    ? 1
    : 3;
}

async function processInput(input) {
  const groups = input.translationGroups.map(checkTranslations);
  const nativeInput = { phrases: input.phrases, translationGroups: groups };
  const translated = JSON.parse(translateSync(JSON.stringify(nativeInput), argv.jenkins));
  if (argv.jenkins || !argv['hash-module']) {
    return translated;
  }
  const hashModule = await import(pathToFileURL(resolve(root, argv['hash-module'])).href);
  const hash = hashModule.default;
  const output = {};
  for (const group of translated) {
    const dictionary = (output[group['fb-locale']] = {});
    input.phrases.forEach((phrase, index) => {
      dictionary[hash(phrase.jsfbt.t)] = group.translatedPhrases[index];
    });
  }
  return output;
}

function checkLocaleGroups(groups) {
  const identities = new Map();
  for (const group of groups) {
    const locale = group['fb-locale'];
    const identity = getLocaleIdentity(locale);
    const locales = identities.get(identity) || [];
    locales.push(locale);
    identities.set(identity, locales);
  }
  const conflicts = [...identities].filter(([, locales]) => locales.length > 1);
  if (conflicts.length > 0) {
    throw new Error(
      conflicts
        .map(
          ([identity, locales]) =>
            `Conflicting translation groups for locale "${identity}": ${locales.join(', ')}`,
        )
        .join('\n'),
    );
  }
}

async function processFiles() {
  const files = argv.translations?.map(String) || [];
  throwIfLocaleFileConflicts(files);
  const input = {
    phrases: JSON.parse(readFileSync(join(root, argv['source-strings']), 'utf8')).phrases,
    translationGroups: files.map((file) => JSON.parse(readFileSync(resolve(root, file), 'utf8'))),
  };
  checkLocaleGroups(input.translationGroups);
  return processInput(input);
}

function writeSingleOutput(filepath, output) {
  mkdirSync(path.dirname(filepath), { recursive: true });
  writeFileSync(filepath, JSON.stringify(output, null, 2));
}

function writeOutput(directory, output) {
  checkLocaleGroups(Object.keys(output).map((locale) => ({ 'fb-locale': locale })));
  mkdirSync(directory, { recursive: true });
  for (const locale of Object.keys(output)) {
    const existingFile = getAvailableLocaleFile(directory, locale);
    const outputLocale = existingFile
      ? basename(existingFile, '.json')
      : formatLocaleForStyle(locale, outputLocaleStyle);
    writeFileSync(
      join(directory, `${outputLocale}.json`),
      JSON.stringify({ [outputLocale]: output[locale] }, null, 2),
    );
  }
}

if (argv.stdin) {
  let source = '';
  process.stdin
    .setEncoding('utf8')
    .on('data', (chunk) => {
      source += chunk;
    })
    .on('end', async () => {
      const input = JSON.parse(source);
      checkLocaleGroups(input.translationGroups);
      process.stdout.write(JSON.stringify(await processInput(input), null, 2));
    });
} else if (argv['output-file']) {
  writeSingleOutput(join(root, argv['output-file']), await processFiles());
} else if (argv['output-dir']) {
  writeOutput(join(root, argv['output-dir']), await processFiles());
}
