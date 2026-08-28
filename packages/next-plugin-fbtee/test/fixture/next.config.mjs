import { resolve } from 'node:path';
import { withFbtee } from '../../index.js';

export default withFbtee()({
  turbopack: {
    root: resolve(import.meta.dirname, '../../../..'),
  },
});
