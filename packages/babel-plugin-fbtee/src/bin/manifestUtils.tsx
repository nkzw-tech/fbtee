import fs, { globSync, statSync } from 'node:fs';
import { parse, relative, resolve } from 'node:path';
import invariant from 'invariant';
import { FBT_ENUM_MODULE_SUFFIX, ModuleNameRegExp } from '../FbtConstants.tsx';
import type { EnumManifest, EnumModule } from '../FbtEnumRegistrar.tsx';

const extensions = '.@(js|jsx|ts|tsx)';

export async function generateManifest(
  paths: ReadonlyArray<string>,
  cwd: string = process.cwd(),
): Promise<{
  enumManifest: EnumManifest;
  files: ReadonlyArray<string>;
}> {
  const enumManifest: {
    [enumModuleName: string]: EnumModule;
  } = {};
  for (const src of paths) {
    const enumFiles: Array<string> = globSync(
      resolve(cwd, src) + '/**/*' + FBT_ENUM_MODULE_SUFFIX + extensions,
    );
    for (const filepath of enumFiles) {
      const name = parse(filepath).name;
      const obj = (await import(resolve(filepath))).default;
      const enumValue: EnumModule = obj.__esModule ? obj.default : obj;

      invariant(
        enumValue != null,
        `No valid enum found for '%s', ensure you are exporting your enum via 'export default { ... };'`,
        name,
      );
      enumManifest[name] = enumValue;
    }
  }

  const files = paths
    .flatMap((src: string) =>
      statSync(src).isDirectory()
        ? globSync(resolve(cwd, src) + '/**/*' + extensions)
        : [src],
    )
    .filter((filepath) =>
      ModuleNameRegExp.test(fs.readFileSync(filepath, 'utf8')),
    )
    .map((filepath) => relative(cwd, filepath));

  return {
    enumManifest,
    files,
  };
}
