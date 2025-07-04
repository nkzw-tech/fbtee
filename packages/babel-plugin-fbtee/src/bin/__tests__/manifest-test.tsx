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
});
