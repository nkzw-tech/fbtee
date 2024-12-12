import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import yargs from 'yargs';
import { generateManifest } from './manifestUtils.tsx';

const root = process.cwd();

const y = yargs(process.argv.slice(2));
const argv = y
  .usage(
    'Generate the enum manifest and its corresponding source manifest ' +
      'intended for consumption by the fbt transform and collectFbt',
  )
  .describe('h', 'Display usage message')
  .alias('h', 'help')
  .array('src')
  .default('src', [root])
  .describe(
    'src',
    'The source folder(s) in which to look for JS source containing fbt and ' +
      'files with the $FbtEnum.js suffix. Defaults to CWD',
  )
  .default('enum-manifest', join(root, '.enum_manifest.json'))
  .describe(
    'enum-manifest',
    'The path or filename to write the enum manfiest (accessed when ' +
      'processing shared enums)',
  )
  .default('src-manifest', join(root, '.src_manifest.json'))
  .describe('src-manifest', 'The path or filename to write the source manifest')
  .parseSync();

if (argv.help) {
  y.showHelp();
  process.exit(0);
}

const enumManifestPath = argv['enum-manifest'];
const { enumManifest, srcManifest } = await generateManifest(
  enumManifestPath,
  argv.src,
);

writeFileSync(enumManifestPath, JSON.stringify(enumManifest));
writeFileSync(argv['src-manifest'], JSON.stringify(srcManifest));
