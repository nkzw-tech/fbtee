import { join } from 'node:path';

export const wasmPath = join(import.meta.dirname, 'swc_plugin_fbtee.wasm');

export const createFbteePluginOptions = (options = {}) => {
  const { fbtEnumManifest, ...rest } = options;
  return {
    ...rest,
    ...(fbtEnumManifest
      ? {
          fbtEnumManifestEntries: Object.entries(fbtEnumManifest).map(
            ([moduleName, entries]) => [moduleName, Object.entries(entries)],
          ),
        }
      : {}),
  };
};

export default wasmPath;
