import fs from 'node:fs';
import { parse, relative, resolve } from 'node:path';
import { globSync } from 'glob';
import invariant from 'invariant';
import {
  FBT_ENUM_MODULE_SUFFIX as ENUM_FILE,
  ModuleNameRegExp,
} from '../FbtConstants.tsx';
import type { EnumManifest, EnumModule } from '../FbtEnumRegistrar.tsx';

const FILE_EXT = '.@(js|jsx|ts|tsx)';

export async function generateManifest(
  enumManifestPath: string,
  srcPaths: ReadonlyArray<string>,
  cwd: string = process.cwd()
): Promise<{
  enumManifest: EnumManifest;
  srcManifest: {
    [enumManifestPath: string]: Array<string>;
  };
}> {
  const enumManifest: {
    [enumModuleName: string]: EnumModule;
  } = {};
  for (const src of srcPaths) {
    const enumFiles: Array<string> = globSync(
      resolve(cwd, src) + '/**/*' + ENUM_FILE + FILE_EXT,
      {
        nodir: true,
      }
    );
    for (const filepath of enumFiles) {
      const name = parse(filepath).name;
      const obj = (await import(resolve(filepath))).default;
      const enumValue: EnumModule = obj.__esModule ? obj.default : obj;

      invariant(
        enumValue != null,
        'No valid enum found for `%s`, ensure you are exporting your enum ' +
          'via `export default { ... };`',
        name
      );
      enumManifest[name] = enumValue;
    }
  }

  // Find source files that are fbt-containing candidates
  const getFiles = (src: string) =>
    globSync(resolve(cwd, src) + '/**/*' + FILE_EXT, { nodir: true });

  const srcFiles = srcPaths
    .flatMap(getFiles)
    .filter((filepath) =>
      fs
        .readFileSync(filepath)
        .toString('utf8')
        .split('\n')
        .some((line) => ModuleNameRegExp.test(line))
    )
    .map((filepath) => relative(cwd, filepath));

  return {
    enumManifest,
    srcManifest: { [enumManifestPath]: srcFiles },
  };
}
