import { join } from 'node:path';

export const wasmPath = join(import.meta.dirname, 'swc_plugin_fbtee.wasm');

export default wasmPath;
