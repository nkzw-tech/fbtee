export declare const wasmPath: string;
export declare const createFbteePluginOptions: <
  Options extends Record<string, unknown>,
>(
  options?: Options,
) => Omit<Options, 'fbtEnumManifest'> & {
  fbtEnumManifestEntries?: Array<[string, Array<[string, string]>]>;
};
export default wasmPath;
