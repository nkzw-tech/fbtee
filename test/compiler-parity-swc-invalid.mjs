import { readFileSync } from 'node:fs';
import { transformSync } from '@swc/core';
import swcFbteePlugin, {
  createFbteePluginOptions,
} from '../packages/swc-plugin-fbtee/index.js';

const fixtures = JSON.parse(readFileSync(0, 'utf8'));
const accepted = [];

for (const fixture of fixtures) {
  try {
    transformSync(fixture.source, {
      filename: 'fixture.tsx',
      jsc: {
        experimental: {
          plugins: [
            [swcFbteePlugin, createFbteePluginOptions(fixture.options ?? {})],
          ],
        },
        parser: {
          syntax: 'typescript',
          tsx: true,
        },
        target: 'es2022',
      },
      module: {
        type: 'es6',
      },
    });
    accepted.push(fixture.name);
  } catch {
    // Invalid fixtures are expected to make the SWC WASM plugin panic.
  }
}

process.stdout.write(JSON.stringify(accepted));
