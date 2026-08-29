import { chmodSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDirectory = fileURLToPath(new URL('../', import.meta.url));
const artifactsDirectory = join(packageDirectory, 'artifacts');
for (const entry of readdirSync(join(packageDirectory, 'npm'), { withFileTypes: true })) {
  if (!entry.isDirectory()) {
    continue;
  }
  const windows = entry.name.startsWith('win32-');
  const artifact = join(artifactsDirectory, `fbtee.${entry.name}${windows ? '.exe' : ''}`);
  if (!existsSync(artifact)) {
    throw new Error(`Missing native CLI artifact: ${artifact}`);
  }
  const destination = join(packageDirectory, 'npm', entry.name, windows ? 'fbtee.exe' : 'fbtee');
  copyFileSync(artifact, destination);
  if (!windows) {
    chmodSync(destination, 0o755);
  }
}
