import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const binary = process.env.FBTEE_BENCH_CLI
  ? resolve(process.env.FBTEE_BENCH_CLI)
  : join(root, 'target/release', process.platform === 'win32' ? 'fbtee.exe' : 'fbtee');
const directory = mkdtempSync(join(tmpdir(), 'fbtee-benchmark-'));
const output = join(directory, 'output.json');
const enumManifest = join(directory, 'enums.json');

try {
  mkdirSync(join(directory, 'source'));
  for (let file = 0; file < 32; file++) {
    const source = Array.from(
      { length: 40 },
      (_, phrase) =>
        `<fbt desc="Greeting ${file}-${phrase}">Hello <b><fbt:param name="user">{user}</fbt:param></b>, you have <fbt:plural count={count} showCount="yes">message</fbt:plural>.</fbt>;`,
    ).join('\n');
    writeFileSync(
      join(directory, 'source', `${String(file).padStart(2, '0')}.tsx`),
      `import { fbt } from 'fbtee';\n${source}`,
    );
  }
  const results = [];
  for (const [name, cwd, args] of [
    ['example', root, ['--src', 'example/src', '--common', 'example/common_strings.json']],
    ['nested-32-files', directory, ['--src', 'source']],
  ]) {
    const run = () => {
      const result = spawnSync(
        binary,
        [
          'collect',
          ...args,
          '--disable-babel-config',
          '--enum-manifest',
          enumManifest,
          '--out',
          output,
        ],
        { cwd, encoding: 'utf8' },
      );
      assert.equal(result.status, 0, result.error?.message ?? result.stderr);
    };
    run();
    const digest = createHash('sha256').update(readFileSync(output)).digest('hex');
    const samples = [];
    for (let sample = 0; sample < 9; sample++) {
      let iterations = 0;
      const start = performance.now();
      do {
        run();
        iterations++;
      } while (performance.now() - start < 100);
      samples.push((performance.now() - start) / iterations);
    }
    samples.sort((a, b) => a - b);
    results.push({ digest, maxMs: samples[8], medianMs: samples[4], minMs: samples[0], name });
  }
  process.stdout.write(
    `${JSON.stringify({ arch: process.arch, node: process.version, results }, null, 2)}\n`,
  );
} finally {
  rmSync(directory, { force: true, recursive: true });
}
