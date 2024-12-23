#!/usr/bin/env -S node --experimental-strip-types --no-warnings
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const fileName = join(import.meta.dirname, '../Strings.json');
const strings = JSON.parse(readFileSync(fileName, 'utf8'));

for (const key in strings.phrases) {
  strings.phrases[key].filepath = 'node_modules/fbtee/lib/index.js';
}

writeFileSync(fileName, JSON.stringify(strings, null, 2), 'utf8');
