import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const npmDirectory = fileURLToPath(new URL('../npm/', import.meta.url));
const packages = readdirSync(npmDirectory, { withFileTypes: true }).filter((entry) =>
  entry.isDirectory(),
);
const rootPackage = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const expectedPackages = new Set(Object.keys(rootPackage.optionalDependencies));
const missing = [];

for (const entry of packages) {
  const directory = join(npmDirectory, entry.name);
  const packageJson = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
  expectedPackages.delete(packageJson.name);
  if (!existsSync(join(directory, packageJson.main))) {
    missing.push(`${packageJson.name}: ${packageJson.main}`);
  }
}
for (const packageName of expectedPackages) {
  missing.push(`${packageName}: package directory`);
}

if (missing.length > 0) {
  throw new Error(`Missing native binding artifacts:\n${missing.join('\n')}`);
}
