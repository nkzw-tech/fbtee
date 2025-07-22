import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path, { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import yargs from 'yargs';
import type { PlainFbtNode } from '../fbt-nodes/FbtNode.tsx';
import { FbtOptionConfig } from '../FbtConstants.tsx';
import type { TableJSFBT } from '../index.tsx';
import packagerTypes from './collectFbtConstants.tsx';
import {
  buildCollectFbtOutput,
  getFbtCollector,
  getPackagers,
} from './collectFbtUtils.tsx';
import type {
  IFbtCollector,
  PackagerPhrase,
  RawChildParentMappings,
} from './FbtCollector.tsx';
import { generateManifest } from './manifestUtils.tsx';

/**
 * This represents the JSON output format of this script.
 */
export type CollectFbtOutput = {
  /**
   * Mapping of child phrase index to their parent phrase index.
   * This allows us to determine which phrases (from the `phrases` field) are "top-level" strings,
   * and which other phrases are its children.
   * Since JSX elements can be nested, child phrases can also contain other children too.
   *
   * Given an fbt callsite like:
   *
   * <fbt desc="...">
   *   Welcome <b>to the <i>jungle</i></b>
   * </fbt>
   *
   * The phrases will be:
   *
   *   Index 0: phrase for "Welcome {=to the jungle}"
   *   Index 1: phrase for "to the {=jungle}"
   *   Index 2: phrase for "jungle"
   *
   * Consequently, `childParentMappings` maps from childIndex to parentIndex:
   *
   * ```
   * "childParentMappings": {
   *   1: 0,
   *   2: 1,
   * }
   * ```
   *
   * The phrase at index 0 is absent from `childParentMappings`'s keys, so it's a top-level string.
   * The phrase at index 1 has a parent at index 0.
   * The phrase at index 2 has a parent at index 1; so it's a grand-child.
   */
  childParentMappings: RawChildParentMappings;
  /**
   * List fbt element nodes (which in a sense represents the fbt DOM tree) for each fbt callsite
   * found in the source code.
   *
   * This is done like this so that we only need to represent one fbt DOM tree per fbt callsite.
   * (avoids duplication)
   *
   * This field is present only when the GEN_FBT_NODES script option is `true`
   */
  fbtElementNodes?: Array<PlainFbtNode> | null;
  /**
   * List of phrases extracted from the given JS source code.
   * Note that for a given fbt callsite, we may extract multiple phrases.
   */
  phrases: Array<
    PackagerPhrase & {
      /**
       * This field is present only when the TERSE script option is `false`
       */
      jsfbt?: TableJSFBT;
    }
  >;
};

export type CollectFbtOutputPhrase = CollectFbtOutput['phrases'][number];

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
  .choices('packager', Object.values(packagerTypes))
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
  .describe(
    'transform',
    'A custom transform to call into rather than the default provided. ' +
      'Expects a signature of (source, options, filename) => mixed, and ' +
      'for babel-pluginf-fbt to be run within the transform.',
  )
  .array('plugins')
  .default('plugins', [])
  .describe(
    'plugins',
    'List of auxiliary Babel plugins to enable for parsing source.\n' +
      'E.g. --plugins @babel/plugin-syntax-dynamic-import @babel/plugin-syntax-numeric-separator',
  )
  .array('presets')
  .default('presets', [])
  .describe(
    'presets',
    'List of auxiliary Babel presets to enable for parsing source.\n' +
      'E.g. --presets @babel/preset-typescript',
  )
  .string('options')
  .describe(
    'options',
    'additional options that fbt(..., {can: "take"}).  ' +
      `i.e. --options "locale,qux,id"`,
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

const require = createRequire(root);
const extraOptions: FbtOptionConfig = {};
const cliExtraOptions = argv['options'];

if (cliExtraOptions) {
  const opts = cliExtraOptions.split(',');
  for (let ii = 0; ii < opts.length; ++ii) {
    extraOptions[opts[ii]] = true;
  }
}

async function writeOutput(collector: IFbtCollector) {
  const packagers = await getPackagers(
    argv['packager'] || 'text',
    argv['hash-module'] || null,
  );
  const output = buildCollectFbtOutput(collector, packagers, {
    genFbtNodes: argv['generate-fbt-nodes'],
  });

  if (argv['include-default-strings']) {
    const getDefaultStringModulePath = () => {
      const stringModulePath = 'fbtee/Strings.json';
      try {
        return require.resolve(stringModulePath);
      } catch {
        /* empty */
      }

      const modulePath = path.join(root, 'node_modules', stringModulePath);
      if (existsSync(modulePath)) {
        return modulePath;
      }

      throw new Error(
        `Could not find default strings module at '${stringModulePath}'. Please install 'fbtee'.`,
      );
    };

    try {
      const modulePath = getDefaultStringModulePath();
      const json = (
        await import(pathToFileURL(modulePath).href, {
          with: { type: 'json' },
        })
      ).default as CollectFbtOutput;

      output.childParentMappings = {
        ...output.childParentMappings,
        ...json.childParentMappings,
      };
      output.phrases.push(...json.phrases);
    } catch (error) {
      console.error(
        `Attempted to include default strings from 'fbtee', but couldn't locate them.${error instanceof Error ? `\nError: ${error.message}` : ''}`,
      );
    }
  }

  if (argv['legacy-format']) {
    for (const [key, phrase] of output.phrases.entries()) {
      output.phrases[key] = {
        ...phrase,
        ...({
          col_beg: phrase.loc?.start.column,
          col_end: phrase.loc?.end.column,
          filepath: phrase.filename,
          line_beg: phrase.loc?.start.line,
          line_end: phrase.loc?.end.line,
        } as object),
      };
    }
  }
  writeFileSync(join(root, argv['out']), JSON.stringify(output, null, 2));
}

if (argv.help) {
  y.showHelp();
  process.exit(0);
}

const transformPath = argv['transform'];
const transform = transformPath
  ? (await import(pathToFileURL(transformPath).href)).default
  : null;

const commonFile = argv['common']?.length
  ? resolve(root, argv['common'])
  : null;
const fbtCommon = commonFile?.length
  ? (commonFile.endsWith('.json')
      ? await import(pathToFileURL(commonFile).href, {
          with: { type: 'json' },
        })
      : await import(pathToFileURL(commonFile).href)
    ).default
  : null;

const collector = await getFbtCollector(
  {
    fbtCommon,
    plugins: argv['plugins'].map(require),
    presets: argv['presets'].map(require),
    transform,
  },
  extraOptions,
  argv['custom-collector'],
);

const { enumManifest, files } = await generateManifest(argv.src);

writeFileSync(argv['enum-manifest'], JSON.stringify(enumManifest));

const sources: Array<[string, string]> = [];
for (const file of files) {
  sources.push([file, readFileSync(file, 'utf8')]);
}
collector.collectFromFiles(sources, enumManifest);
await writeOutput(collector);
