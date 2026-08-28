#!/usr/bin/env node

const oxcFlag = process.argv.indexOf('--oxc', 2);
if (oxcFlag === -1) {
  await import('@nkzw/babel-plugin-fbtee/lib/bin.mjs');
} else {
  process.argv.splice(oxcFlag, 1);
  await import('./oxc-cli.mjs');
}
