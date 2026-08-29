import { chmodSync, copyFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDirectory = fileURLToPath(new URL('../', import.meta.url));
const repositoryDirectory = fileURLToPath(new URL('../../../', import.meta.url));

const inferPlatform = () => {
  if (process.platform === 'darwin') {
    return `darwin-${process.arch}`;
  }
  if (process.platform === 'win32') {
    return `win32-${process.arch}-msvc`;
  }
  if (process.platform === 'linux') {
    const libc = process.report?.getReport()?.header?.glibcVersionRuntime ? 'gnu' : 'musl';
    return `linux-${process.arch}-${libc}`;
  }
};

const platform = process.env.FBTEE_CLI_PLATFORM || inferPlatform();
if (!platform) {
  throw new Error(`Unsupported native CLI platform: ${process.platform}-${process.arch}`);
}
const binaryName = platform.startsWith('win32-') ? 'fbtee.exe' : 'fbtee';
const source = process.env.FBTEE_CLI_BINARY
  ? resolve(process.env.FBTEE_CLI_BINARY)
  : join(repositoryDirectory, 'target', 'release', binaryName);
const destination = join(packageDirectory, 'npm', platform, binaryName);
if (!existsSync(source)) {
  throw new Error(`Built native CLI is missing: ${source}`);
}
copyFileSync(source, destination);
if (process.platform !== 'win32') {
  chmodSync(destination, 0o755);
}
