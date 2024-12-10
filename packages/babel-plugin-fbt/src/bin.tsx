#! /usr/bin/env node
const command = process.argv[2];
process.argv.splice(2, 1);

if (command === 'manifest') {
  import('./bin/manifest.tsx');
} else if (command === 'translate') {
  import('./bin/translate.tsx');
} else if (command === 'collect') {
  import('./bin/collect.tsx');
}
