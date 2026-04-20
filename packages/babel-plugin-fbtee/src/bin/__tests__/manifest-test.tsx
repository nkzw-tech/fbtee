import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { generateManifest } from '../manifestUtils.tsx';

describe('manifest', () => {
  it('should extract strings', async () => {
    const srcPath = join(import.meta.dirname, '../__fixtures__');

    const { enumManifest, files } = await generateManifest(
      [srcPath],
      import.meta.dirname + '/../..',
    );

    expect(JSON.stringify(files, null, 2)).toMatchSnapshot();
    expect(JSON.stringify(enumManifest, null, 2)).toMatchSnapshot();
  });

  it('should skip directories whose names match the file extension glob', async () => {
    const srcPath = join(import.meta.dirname, '../__fixtures__');
    const DIRNAME = 'dir-with-js-extension.js';
    // ensure the fixture directory exists (otherwise test will pass even if fixture was renamed/removed)
    expect(existsSync(join(srcPath, DIRNAME))).toBe(true);

    const { files } = await generateManifest([srcPath], srcPath);

    expect(files).not.toContain(DIRNAME);
  });
});
