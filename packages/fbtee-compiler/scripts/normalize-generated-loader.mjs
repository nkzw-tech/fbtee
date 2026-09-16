import { readFileSync, writeFileSync } from 'node:fs';
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const loaderPath = new URL('../index.js', import.meta.url);
let loader = readFileSync(loaderPath, 'utf8');

const generatedVersionCheck = `bindingPackageVersion !== '${packageJson.version}'`;
const generatedMessage = `expected ${packageJson.version} but got`;
const generatedVersionCheckCount = loader.split(generatedVersionCheck).length - 1;
const generatedMessageCount = loader.split(generatedMessage).length - 1;

if (generatedVersionCheckCount === 0) {
  if (
    loader.includes("const packageVersion = require('./package.json').version;") &&
    loader.includes('bindingPackageVersion !== packageVersion') &&
    loader.includes('expected ${packageVersion} but got')
  ) {
    process.exit(0);
  }

  throw new Error(`Could not find NAPI-RS version checks for ${packageJson.version} in index.js.`);
}

if (generatedVersionCheckCount !== generatedMessageCount) {
  throw new Error(
    `Found ${generatedVersionCheckCount} NAPI-RS version checks but ${generatedMessageCount} version messages.`,
  );
}

const requireDeclaration = 'const require = createRequire(import.meta.url)';
if (!loader.includes(requireDeclaration)) {
  throw new Error('Could not find the generated createRequire declaration in index.js.');
}

loader = loader
  .replace(
    requireDeclaration,
    `${requireDeclaration}\nconst packageVersion = require('./package.json').version`,
  )
  .replaceAll(generatedVersionCheck, 'bindingPackageVersion !== packageVersion')
  .replaceAll(generatedMessage, 'expected ${packageVersion} but got');

writeFileSync(loaderPath, loader);
