import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path, { resolve } from 'node:path';
import yargs from 'yargs';
import type { PlainFbtNode } from '../fbt-nodes/FbtNode.tsx';
import { FbtOptionConfig } from '../FbtConstants.tsx';
import { EnumManifest } from '../FbtEnumRegistrar.tsx';
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

const y = yargs(process.argv.slice(2));
const argv = y
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
  .boolean('manifest')
  .default('manifest', false)
  .describe(
    'manifest',
    'Interpret stdin as JSON map of {<enum-manifest-file>: ' +
      '[<source_file1>, ...]}. Otherwise stdin itself will be parsed',
  )
  .string('fbt-common-path')
  .default('fbt-common-path', '')
  .describe(
    'fbt-common-path',
    'Optional path to the common strings module. ' +
      'This is a map from {[text]: [description]}.',
  )
  .boolean('pretty')
  .default('pretty', false)
  .describe('pretty', 'Pretty-print the JSON output')
  .boolean('gen-outer-token-name')
  .default('gen-outer-token-name', false)
  .describe(
    'gen-outer-token-name',
    'Generate the outer token name of an inner string in the JSON output. ' +
      'E.g. For the fbt string `<fbt>Hello <i>World</i></fbt>`, ' +
      'the outer string is "Hello {=World}", and the inner string is: "World". ' +
      'So the outer token name of the inner string will be "=World"',
  )
  .boolean('gen-fbt-nodes')
  .default('gen-fbt-nodes', false)
  .describe(
    'gen-fbt-nodes',
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
  .parseSync();

const root = process.cwd();
const require = createRequire(root);
const extraOptions: FbtOptionConfig = {};
const cliExtraOptions = argv['options'];

if (cliExtraOptions) {
  const opts = cliExtraOptions.split(',');
  for (let ii = 0; ii < opts.length; ++ii) {
    extraOptions[opts[ii]] = true;
  }
}

async function processJsonSource(collector: IFbtCollector, source: string) {
  const json = JSON.parse(source);
  for (const manifestPath of Object.keys(json)) {
    let manifest: EnumManifest = {};
    if (existsSync(manifestPath)) {
      manifest = (
        await import(path.resolve(root, manifestPath), {
          with: { type: 'json' },
        })
      ).default;
    }
    const sources: Array<[string, string]> = [];
    for (const file of json[manifestPath]) {
      sources.push([file, readFileSync(file, 'utf8')]);
    }
    collector.collectFromFiles(sources, manifest);
  }
}

async function writeOutput(collector: IFbtCollector) {
  const packagers = await getPackagers(
    argv['packager'] || 'text',
    argv['hash-module'] || null,
  );
  const output = buildCollectFbtOutput(collector, packagers, {
    genFbtNodes: argv['gen-fbt-nodes'],
  });

  if (argv['include-default-strings']) {
    try {
      const json = (
        await import(require.resolve('fbtee/Strings.json'), {
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

  process.stdout.write(
    JSON.stringify(output, null, argv.pretty ? ' ' : undefined),
  );
  process.stdout.write('\n');
}

async function processSource(collector: IFbtCollector, source: string) {
  await (argv['manifest']
    ? processJsonSource(collector, source)
    : collector.collectFromOneFile(source, 'file.js'));
}

if (argv.help) {
  y.showHelp();
} else {
  const transformPath = argv['transform'];
  const transform = transformPath
    ? (await import(transformPath)).default
    : null;

  const commonFile = argv['fbt-common-path']?.length
    ? resolve(root, argv['fbt-common-path'])
    : null;
  const fbtCommon = commonFile?.length
    ? (commonFile.endsWith('.json')
        ? await import(commonFile, {
            with: { type: 'json' },
          })
        : await import(commonFile)
      ).default
    : null;

  const collector = await getFbtCollector(
    {
      fbtCommon,
      generateOuterTokenName: argv['gen-outer-token-name'],
      plugins: argv['plugins'].map(require),
      presets: argv['presets'].map(require),
      transform,
    },
    extraOptions,
    argv['custom-collector'],
  );

  if (!argv._.length) {
    // No files given, read stdin as the sole input.
    const stream = process.stdin;
    let source = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      source += chunk;
    });
    stream.on('end', async () => {
      await processSource(collector, source);
      await writeOutput(collector);
    });
  } else {
    const sources: Array<[string, string]> = [];
    for (const file of argv._) {
      sources.push([String(file), readFileSync(file, 'utf8')]);
    }
    collector.collectFromFiles(sources);
    await writeOutput(collector);
  }
}
