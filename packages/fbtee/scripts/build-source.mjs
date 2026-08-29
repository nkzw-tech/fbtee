import { globSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { transformSync } from '@nkzw/oxc-transform-fbtee';

const root = resolve(import.meta.dirname, '..');
rmSync(resolve(root, 'lib-tmp'), { force: true, recursive: true });
for (const sourceFile of globSync('src/**/*.{ts,tsx}', { cwd: root })) {
  if (sourceFile.includes('/__tests__/')) {
    continue;
  }
  const source = readFileSync(resolve(root, sourceFile), 'utf8');
  const result = transformSync(sourceFile, source, {
    lang: sourceFile.endsWith('.tsx') ? 'tsx' : 'ts',
    sourceType: 'module',
  });
  if (result.errors.length > 0) {
    throw new Error(result.errors.map(({ message }) => message).join('\n'));
  }
  const outputFile = resolve(root, 'lib-tmp', relative('src', sourceFile));
  mkdirSync(dirname(outputFile), { recursive: true });
  writeFileSync(outputFile, result.code);
}
