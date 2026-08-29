#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { accessSync, chmodSync, constants, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const localBinary = fileURLToPath(
  new URL(
    `../../target/release/fbtee${process.platform === 'win32' ? '.exe' : ''}`,
    import.meta.url,
  ),
);

const platformPackage = () => {
  if (process.platform === 'darwin' && ['arm64', 'x64'].includes(process.arch)) {
    return `@nkzw/oxc-transform-fbtee-binding-darwin-${process.arch}`;
  }
  if (process.platform === 'win32' && ['arm64', 'x64'].includes(process.arch)) {
    return `@nkzw/oxc-transform-fbtee-binding-win32-${process.arch}-msvc`;
  }
  if (process.platform === 'linux' && ['arm64', 'x64'].includes(process.arch)) {
    const libc = process.report?.getReport()?.header?.glibcVersionRuntime ? 'gnu' : 'musl';
    return `@nkzw/oxc-transform-fbtee-binding-linux-${process.arch}-${libc}`;
  }
  return null;
};

let binary = existsSync(localBinary) ? localBinary : null;
const packageName = platformPackage();
if (!binary && packageName) {
  try {
    const packageJson = require.resolve(`${packageName}/package.json`);
    binary = join(dirname(packageJson), process.platform === 'win32' ? 'fbtee.exe' : 'fbtee');
  } catch {
    // The friendly error below covers missing optional platform packages.
  }
}

if (!binary || !existsSync(binary)) {
  process.stderr.write(
    `fbtee does not provide a native executable for ${process.platform}-${process.arch}, or the optional platform package was not installed.\n`,
  );
  process.exit(1);
}

if (process.platform !== 'win32') {
  try {
    accessSync(binary, constants.X_OK);
  } catch {
    chmodSync(binary, 0o755);
  }
}

const result = spawnSync(binary, process.argv.slice(2), { stdio: 'inherit' });
if (result.error) {
  throw result.error;
}
process.exit(result.status ?? 1);
