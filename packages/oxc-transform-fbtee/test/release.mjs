import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDirectory = fileURLToPath(new URL('../', import.meta.url));
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'fbtee-release-test-'));
const sourceDirectory = join(temporaryDirectory, 'source');
const outputDirectory = join(temporaryDirectory, 'output');

const download = (source) =>
  spawnSync(
    process.execPath,
    [join(packageDirectory, 'scripts/download-artifacts.mjs')],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        FBTEE_NATIVE_ARTIFACTS_DIRECTORY: source,
        FBTEE_NATIVE_ARTIFACTS_OUTPUT_DIRECTORY: outputDirectory,
      },
    },
  );

try {
  mkdirSync(sourceDirectory);
  const expected = readdirSync(join(packageDirectory, 'npm'), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) =>
      JSON.parse(
        readFileSync(
          join(packageDirectory, 'npm', entry.name, 'package.json'),
          'utf8',
        ),
      ),
    )
    .map((packageJson) => packageJson.main)
    .sort();
  for (const name of expected) {
    writeFileSync(join(sourceDirectory, name), name);
  }

  const result = download(sourceDirectory);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readdirSync(outputDirectory).sort(), expected);

  const preservedBinding = expected[0];
  const preservedContents = readFileSync(
    join(outputDirectory, preservedBinding),
    'utf8',
  );
  rmSync(join(sourceDirectory, preservedBinding));
  const incompleteResult = download(sourceDirectory);
  assert.notEqual(incompleteResult.status, 0);
  assert.match(incompleteResult.stderr, /Downloaded artifacts are incomplete/);
  assert.equal(
    readFileSync(join(outputDirectory, preservedBinding), 'utf8'),
    preservedContents,
  );
} finally {
  rmSync(temporaryDirectory, { force: true, recursive: true });
}
