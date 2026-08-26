import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDirectory = fileURLToPath(new URL('../', import.meta.url));
const inferPlatform = () => {
  if (process.platform === 'darwin') {
    return `darwin-${process.arch}`;
  }
  if (process.platform === 'win32') {
    return `win32-${process.arch}-msvc`;
  }
  if (process.platform === 'linux') {
    const report = process.report?.getReport();
    const libc = report?.header?.glibcVersionRuntime ? 'gnu' : 'musl';
    return `linux-${process.arch}-${libc}`;
  }
};
const platform = process.argv[2] ?? inferPlatform();
assert.match(platform ?? '', /^[\da-z-]+$/, 'Missing platform package name');

const platformDirectory = join(packageDirectory, 'npm', platform);
const packageJsonPath = join(platformDirectory, 'package.json');
assert.ok(existsSync(packageJsonPath), `Unknown platform package: ${platform}`);

const { main } = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const sourceBinding = join(packageDirectory, main);
assert.ok(
  existsSync(sourceBinding),
  `Built binding is missing: ${sourceBinding}`,
);
copyFileSync(sourceBinding, join(platformDirectory, main));

const outputDirectory = join(packageDirectory, '.native-smoke');
rmSync(outputDirectory, { force: true, recursive: true });
mkdirSync(outputDirectory);

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
for (const directory of [
  platformDirectory,
  packageDirectory,
  join(packageDirectory, '..', 'vite-plugin-fbtee'),
]) {
  const result = spawnSync(
    pnpm,
    ['--dir', directory, 'pack', '--pack-destination', outputDirectory],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
}
