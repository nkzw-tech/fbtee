import { existsSync, globSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, parse, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { collectBatchSync } from '@nkzw/oxc-transform-fbtee';
import yargs from 'yargs';

const command = process.argv[2];
const babelConfigFilenames = [
  '.babelignore',
  '.babelrc',
  '.babelrc.cjs',
  '.babelrc.cts',
  '.babelrc.js',
  '.babelrc.json',
  '.babelrc.mjs',
  '.babelrc.mts',
  '.babelrc.ts',
  'babel.config.cjs',
  'babel.config.cts',
  'babel.config.js',
  'babel.config.json',
  'babel.config.mjs',
  'babel.config.mts',
  'babel.config.ts',
];

function showHelp() {
  process.stdout.write(`Usage: fbtee <command> [options]

Commands:
  collect                 Collect fbt instances from source.
  translate               Translate fbt phrases with provided translations.
  prepare-translations    Prepare translation files from collected strings.
  migrate-locales         Rename locale JSON artifacts between locale styles.

Run "fbtee <command> --help" for command-specific options.
`);
}

if (command == null || command === 'help' || command === '--help' || command === '-h') {
  showHelp();
} else if (command === 'prepare-translations') {
  process.argv.splice(2, 1);
  await import('./oxc-prepare-translations.mjs');
} else if (command === 'migrate-locales') {
  process.argv.splice(2, 1);
  await import('./oxc-migrate-locales.mjs');
} else if (command === 'translate') {
  process.argv.splice(2, 1);
  await import('./oxc-translate.mjs');
} else if (command !== 'collect') {
  process.stderr.write(`Unknown command: ${command}\n\n`);
  showHelp();
  process.exitCode = 1;
} else {
  process.argv.splice(2, 1);

  const root = process.cwd();
  const y = yargs(process.argv.slice(2));
  const argv = y
    .scriptName('fbtee')
    .usage('Collect fbt instances from source:\n$0 [options]')
    .string('hash-module')
    .describe('hash-module', 'Path to hashing module to use in text packager.')
    .default('packager', 'text')
    .describe(
      'packager',
      'Packager to use.  Choices are:\n' +
        "  'text' - hashing is done at the text (or leaf) level (more granular)\n" +
        "'phrase' - hashing is done at the phrase (entire fbt callsite) level\n" +
        "  'both' - Both phrase and text hashing are performed\n" +
        "  'none' - No hashing or alteration of phrase data\n",
    )
    .choices('packager', ['both', 'none', 'phrase', 'text'])
    .describe('h', 'Display usage message')
    .alias('h', 'help')
    .string('common')
    .default('common', '')
    .describe(
      'common',
      'Optional path to the common strings module. ' +
        'This is a map from {[text]: [description]}.',
    )
    .string('enum-manifest')
    .default('enum-manifest', join(root, '.enum_manifest.json'))
    .describe(
      'enum-manifest',
      'The path or filename to write the enum manfiest (accessed when ' +
        'processing shared enums)',
    )
    .boolean('generate-fbt-nodes')
    .default('generate-fbt-nodes', false)
    .describe(
      'generate-fbt-nodes',
      'Generate the abstract representation of the fbt callsites as FbtNode trees.',
    )
    .string('transform')
    .default('transform', null)
    .describe('transform', 'A custom transform to call into rather than the default provided.')
    .string('options')
    .describe(
      'options',
      'additional options that fbt(..., {can: "take"}).  ' + `i.e. --options "locale,qux,id"`,
    )
    .string('custom-collector')
    .describe(
      'custom-collector',
      `In some complex scenarios, passing custom Babel presets or plugins to preprocess ` +
        `the input JS is not flexible enough. As an alternative, you can provide your own ` +
        `implementation of the FbtCollector module. ` +
        `It must at least expose the same public methods to expose the extract fbt phrases.\n` +
        `i.e. --custom-collector myFbtCollector.js`,
    )
    .boolean('include-default-strings')
    .default('include-default-strings', true)
    .describe(
      'include-default-strings',
      `Include the default strings required by fbtee, such as for '<fbt:list>'.`,
    )
    .boolean('disable-babel-config')
    .default('disable-babel-config', false)
    .describe(
      'disable-babel-config',
      `Runs the collector without loading the Babel config specified in the repository.`,
    )
    .boolean('legacy-format')
    .default('legacy-format', false)
    .describe(
      'legacy-format',
      `Use the legacy output format for the fbt strings for use with various translation providers.`,
    )
    .array('src')
    .default('src', [root])
    .describe(
      'src',
      'The source folder(s) or files in which to look for JS source containing fbt and ' +
        'files with the $FbtEnum.js suffix. Defaults to CWD',
    )
    .string('out')
    .default('out', 'source_strings.json')
    .describe('out', 'Output file to write the collected fbt strings to.')
    .parseSync();

  if (argv.help) {
    y.showHelp();
    process.exit(0);
  }

  for (const option of ['custom-collector', 'transform']) {
    if (argv[option]) {
      throw new Error(`--${option} is not supported together with --oxc.`);
    }
  }
  if (argv['generate-fbt-nodes']) {
    throw new Error(
      '--generate-fbt-nodes emits Babel AST nodes and is not available together with --oxc.',
    );
  }

  const extensions = '.@(js|jsx|ts|tsx)';
  const sourceFiles = argv.src
    .flatMap((src) =>
      statSync(String(src)).isDirectory()
        ? globSync(resolve(root, String(src)) + '/**/*' + extensions)
        : [String(src)],
    )
    .filter((filepath) => statSync(filepath).isFile());
  if (!argv['disable-babel-config']) {
    const babelConfig = findBabelConfig(root, sourceFiles);
    if (babelConfig) {
      throw new Error(
        `The native Oxc collector cannot execute Babel configuration from '${relative(root, babelConfig) || babelConfig}'. ` +
          'Use the Babel collector, or pass --disable-babel-config to explicitly collect the unmodified source.',
      );
    }
  }
  const extraOptions = argv.options ? argv.options.split(',') : [];

  const enumManifest = {};
  for (const src of argv.src) {
    const enumFiles = globSync(resolve(root, String(src)) + '/**/*$FbtEnum' + extensions);
    for (const filepath of enumFiles) {
      const name = parse(filepath).name;
      const imported = (await import(pathToFileURL(resolve(filepath)).href)).default;
      const value = imported?.__esModule ? imported.default : imported;
      if (value == null) {
        throw new Error(
          `No valid enum found for '${name}', ensure you are exporting your enum via 'export default { ... };'`,
        );
      }
      enumManifest[name] = value;
    }
  }
  writeFileSync(argv['enum-manifest'], JSON.stringify(enumManifest));

  const commonFile = argv.common?.length ? resolve(root, argv.common) : null;
  const fbtCommon = commonFile
    ? (
        await import(pathToFileURL(commonFile).href, {
          with: commonFile.endsWith('.json') ? { type: 'json' } : undefined,
        })
      ).default
    : undefined;

  const files = sourceFiles
    .map((filepath) => ({
      filename: relative(root, filepath),
      source: readFileSync(filepath, 'utf8'),
    }))
    .filter(({ source }) => /<[Ff]b[st]\b|fb[st](\.c)?\s*\(/.test(source));

  const output = { childParentMappings: {}, phrases: [] };
  let customHash = null;
  if (argv['hash-module']) {
    const hashModule = await import(pathToFileURL(resolve(root, argv['hash-module'])).href);
    customHash = hashModule.default;
    if (typeof customHash !== 'function' && typeof customHash?.getFbtHash !== 'function') {
      throw new Error(
        'Expected hashing module to expose a default function or an object with getFbtHash().',
      );
    }
    customHash = typeof customHash === 'function' ? customHash : customHash.getFbtHash;
  }
  const result = collectBatchSync(
    files.map(({ filename, source }) => ({ filename, sourceText: source })),
    {
      collectPackager:
        customHash && argv.packager === 'text'
          ? 'none'
          : customHash && argv.packager === 'both'
            ? 'phrase'
            : argv.packager,
      extraOptions,
      fbtCommon,
      fbtEnumManifest: enumManifest,
      sourceType: 'unambiguous',
    },
  );
  if (result.errors.length > 0) {
    throw new Error(result.errors.map(({ message }) => message).join('\n'));
  }
  const collected = JSON.parse(result.output);
  if (customHash && ['text', 'both'].includes(argv.packager)) {
    for (const [index, phrase] of collected.phrases.entries()) {
      const hashToLeaf = {};
      visitLeaves(phrase.jsfbt.t, ({ desc, text }) => {
        hashToLeaf[customHash(text, desc)] = { desc, text };
      });
      if (argv.packager === 'both') {
        const { hash_code, hash_key, ...rest } = phrase;
        collected.phrases[index] = {
          hash_code,
          hash_key,
          hashToLeaf,
          ...rest,
        };
      } else {
        collected.phrases[index] = { hashToLeaf, ...phrase };
      }
    }
  }
  output.childParentMappings = collected.childParentMappings;
  output.phrases = collected.phrases;

  if (argv['include-default-strings']) {
    const require = createRequire(root);
    try {
      let stringsPath;
      try {
        stringsPath = require.resolve('fbtee/Strings.json');
      } catch {
        const fallback = join(root, 'node_modules/fbtee/Strings.json');
        if (existsSync(fallback)) {
          stringsPath = fallback;
        }
      }
      if (!stringsPath) {
        throw new Error(
          `Could not find default strings module at 'fbtee/Strings.json'. Please install 'fbtee'.`,
        );
      }
      const defaults = JSON.parse(readFileSync(stringsPath, 'utf8'));
      Object.assign(output.childParentMappings, defaults.childParentMappings);
      output.phrases.push(...defaults.phrases);
    } catch (error) {
      process.stderr.write(
        `Attempted to include default strings from 'fbtee', but couldn't locate them.${error instanceof Error ? `\nError: ${error.message}` : ''}\n`,
      );
    }
  }

  if (argv['legacy-format']) {
    for (const phrase of output.phrases) {
      phrase.col_beg = phrase.loc?.start.column;
      phrase.col_end = phrase.loc?.end.column;
      phrase.filepath = phrase.filename;
      phrase.line_beg = phrase.loc?.start.line;
      phrase.line_end = phrase.loc?.end.line;
    }
  }

  writeFileSync(join(root, argv.out), JSON.stringify(output, null, 2));
}

function visitLeaves(value, visit) {
  if (
    value &&
    typeof value === 'object' &&
    typeof value.desc === 'string' &&
    typeof value.text === 'string'
  ) {
    visit(value);
    return;
  }
  for (const child of Object.values(value)) {
    visitLeaves(child, visit);
  }
}

function findBabelConfig(root, sources) {
  const directories = new Set([root]);
  for (const source of sources) {
    const absolute = resolve(root, source);
    if (!existsSync(absolute)) {
      continue;
    }
    let directory = statSync(absolute).isDirectory() ? absolute : dirname(absolute);
    while (directory === root || !relative(root, directory).startsWith('..')) {
      directories.add(directory);
      if (directory === root) {
        break;
      }
      const parent = dirname(directory);
      if (parent === directory) {
        break;
      }
      directory = parent;
    }
  }

  for (const directory of directories) {
    for (const filename of babelConfigFilenames) {
      const path = join(directory, filename);
      if (existsSync(path)) {
        return path;
      }
    }
    const packagePath = join(directory, 'package.json');
    if (existsSync(packagePath)) {
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
      if (Object.hasOwn(packageJson, 'babel')) {
        return packagePath;
      }
    }
  }
  return null;
}
