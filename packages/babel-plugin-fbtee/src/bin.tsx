#!/usr/bin/env -S node --experimental-strip-types --no-warnings
const command = process.argv[2];

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

if (
  command == null ||
  command === 'help' ||
  command === '--help' ||
  command === '-h'
) {
  showHelp();
} else if (command === 'translate') {
  process.argv.splice(2, 1);
  import('./bin/translate.tsx');
} else if (command === 'prepare-translations') {
  process.argv.splice(2, 1);
  import('./bin/prepare-translations.tsx');
} else if (command === 'migrate-locales') {
  process.argv.splice(2, 1);
  import('./bin/migrate-locales.tsx');
} else if (command === 'collect') {
  process.argv.splice(2, 1);
  import('./bin/collect.tsx');
} else {
  process.stderr.write(`Unknown command: ${command}\n\n`);
  showHelp();
  process.exit(1);
}
