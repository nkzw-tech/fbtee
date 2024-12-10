import fs from 'node:fs';
import path from 'node:path';
import yargs from 'yargs';
import type { PlainFbtNode } from '../fbt-nodes/FbtNode';
import type { TableJSFBT } from '../index';
import packagerTypes from './collectFbtConstants';
import {
  buildCollectFbtOutput,
  getFbtCollector,
  getPackagers,
} from './collectFbtUtils';
import type {
  ChildParentMappings,
  IFbtCollector,
  PackagerPhrase,
} from './FbtCollector';

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
   * Consequently, `childParentMappings` will be:
   *
   * ```
   * "childParentMappings": {
   *   // childIndex: parentIndex
   *   "1": 0,
   *   "2": 1
   * }
   * ```
   *
   * The phrase at index 0 is absent from `childParentMappings`'s keys, so it's a top-level string.
   * The phrase at index 1 has a parent at index 0.
   * The phrase at index 2 has a parent at index 1; so it's a grand-child.
   */
  childParentMappings: ChildParentMappings;
  /**
   * List fbt element nodes (which in a sense represents the fbt DOM tree) for each fbt callsite
   * found in the source code.
   *
   * This is done like this so that we only need to represent one fbt DOM tree per fbt callsite.
   * (avoids duplication)
   *
   * This field is present only when the GEN_FBT_NODES script option is `true`
   */
  fbtElementNodes?: Array<PlainFbtNode> | null | undefined;
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

const args = {
  COMMON_STRINGS: 'fbt-common-path',
  CUSTOM_COLLECTOR: 'custom-collector',
  GEN_FBT_NODES: 'gen-fbt-nodes',
  GEN_OUTER_TOKEN_NAME: 'gen-outer-token-name',
  HASH: 'hash-module',
  HELP: 'h',
  MANIFEST: 'manifest',
  OPTIONS: 'options',
  PACKAGER: 'packager',
  PLUGINS: 'plugins',
  PRESETS: 'presets',
  PRETTY: 'pretty',
  TRANSFORM: 'transform',
} as const;

const y = yargs();
const argv = y
  .usage('Collect fbt instances from source:\n$0 [options]')
  .default(args.HASH, import.meta.dirname + '/md5.tsx')
  .describe(args.HASH, 'Path to hashing module to use in text packager.')
  .default(args.PACKAGER, 'text')
  .describe(
    args.PACKAGER,
    'Packager to use.  Choices are:\n' +
      "  'text' - hashing is done at the text (or leaf) level (more granular)\n" +
      "'phrase' - hashing is done at the phrase (entire fbt callsite) level\n" +
      "  'both' - Both phrase and text hashing are performed\n" +
      "  'none' - No hashing or alteration of phrase data\n"
  )
  .choices(args.PACKAGER, Object.values(packagerTypes))
  .describe(args.HELP, 'Display usage message')
  .alias(args.HELP, 'help')
  .boolean(args.MANIFEST)
  .default(args.MANIFEST, false)
  .describe(
    args.MANIFEST,
    'Interpret stdin as JSON map of {<enum-manifest-file>: ' +
      '[<source_file1>, ...]}. Otherwise stdin itself will be parsed'
  )
  .string(args.COMMON_STRINGS)
  .default(args.COMMON_STRINGS, null)
  .describe(
    args.COMMON_STRINGS,
    'Optional path to the common strings module. ' +
      'This is a map from {[text]: [description]}.'
  )
  .boolean(args.PRETTY)
  .default(args.PRETTY, false)
  .describe(args.PRETTY, 'Pretty-print the JSON output')
  .boolean(args.GEN_OUTER_TOKEN_NAME)
  .default(args.GEN_OUTER_TOKEN_NAME, false)
  .describe(
    args.GEN_OUTER_TOKEN_NAME,
    'Generate the outer token name of an inner string in the JSON output. ' +
      'E.g. For the fbt string `<fbt>Hello <i>World</i></fbt>`, ' +
      'the outer string is "Hello {=World}", and the inner string is: "World". ' +
      'So the outer token name of the inner string will be "=World"'
  )
  .boolean(args.GEN_FBT_NODES)
  .default(args.GEN_FBT_NODES, false)
  .describe(
    args.GEN_FBT_NODES,
    'Generate the abstract representation of the fbt callsites as FbtNode trees.'
  )
  .string(args.TRANSFORM)
  .default(args.TRANSFORM, null)
  .describe(
    args.TRANSFORM,
    'A custom transform to call into rather than the default provided. ' +
      'Expects a signature of (source, options, filename) => mixed, and ' +
      'for babel-pluginf-fbt to be run within the transform.'
  )
  .array(args.PLUGINS)
  .default(args.PLUGINS, [])
  .describe(
    args.PLUGINS,
    'List of auxiliary Babel plugins to enable for parsing source.\n' +
      'E.g. --plugins @babel/plugin-syntax-dynamic-import @babel/plugin-syntax-numeric-separator'
  )
  .array(args.PRESETS)
  .default(args.PRESETS, [])
  .describe(
    args.PRESETS,
    'List of auxiliary Babel presets to enable for parsing source.\n' +
      'E.g. --presets @babel/preset-typescript'
  )
  .string(args.OPTIONS)
  .describe(
    args.OPTIONS,
    'additional options that fbt(..., {can: "take"}).  ' +
      `i.e. --${args.OPTIONS} "locale,qux,id"`
  )
  .string(args.CUSTOM_COLLECTOR)
  .describe(
    args.CUSTOM_COLLECTOR,
    `In some complex scenarios, passing custom Babel presets or plugins to preprocess ` +
      `the input JS is not flexible enough. As an alternative, you can provide your own ` +
      `implementation of the FbtCollector module. ` +
      `It must at least expose the same public methods to expose the extract fbt phrases.\n` +
      `i.e. --${args.CUSTOM_COLLECTOR} myFbtCollector.js`
  )
  .parseSync();

const extraOptions: Record<string, any> = {};
const cliExtraOptions = argv[args.OPTIONS];
if (cliExtraOptions) {
  const opts = cliExtraOptions.split(',');
  for (let ii = 0; ii < opts.length; ++ii) {
    extraOptions[opts[ii]] = true;
  }
}

function processJsonSource(collector: IFbtCollector, source: string) {
  const json = JSON.parse(source);
  Object.keys(json).forEach((manifest_path) => {
    let manifest: Record<string, any> = {};
    if (fs.existsSync(manifest_path)) {
      manifest = require(path.resolve(process.cwd(), manifest_path));
    }
    const sources: Array<[string, string]> = [];
    for (const file of json[manifest_path]) {
      sources.push([file, fs.readFileSync(file, 'utf8')]);
    }
    collector.collectFromFiles(sources, manifest);
  });
}

async function writeOutput(collector: IFbtCollector) {
  const packagers = await getPackagers(
    argv[args.PACKAGER] || 'text',
    argv[args.HASH]
  );
  const output = buildCollectFbtOutput(collector, packagers, {
    genFbtNodes: argv[args.GEN_FBT_NODES],
  });
  process.stdout.write(
    JSON.stringify(output, null, argv.pretty ? ' ' : undefined)
  );
  process.stdout.write('\n');
}

async function processSource(collector: IFbtCollector, source: string) {
  if (argv[args.MANIFEST]) {
    processJsonSource(collector, source);
  } else {
    await collector.collectFromOneFile(source, 'file.js');
  }
}

if (argv.help) {
  y.showHelp();
} else {
  const transformPath = argv[args.TRANSFORM];
  const transform = transformPath ? require(transformPath) : null;

  getFbtCollector(
    {
      fbtCommonPath: argv[args.COMMON_STRINGS] || undefined,
      generateOuterTokenName: argv[args.GEN_OUTER_TOKEN_NAME],
      plugins: argv[args.PLUGINS].map(require),
      presets: argv[args.PRESETS].map(require),
      transform,
    },
    extraOptions,
    argv[args.CUSTOM_COLLECTOR]
    // eslint-disable-next-line unicorn/prefer-top-level-await
  ).then(async (collector) => {
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
        sources.push([String(file), fs.readFileSync(file, 'utf8')]);
      }
      collector.collectFromFiles(sources);
      await writeOutput(collector);
    }
  });
}
