import path from 'node:path';
import { generateManifest } from '../manifestUtils.tsx';

describe('manifest', () => {
  it('should extract strings', async () => {
    const srcPath = 'bin/__fixtures__';
    const enumManifestPath = path.join(srcPath, '.enum_manifest.json');

    const { enumManifest, srcManifest } = await generateManifest(
      enumManifestPath,
      [srcPath],
      import.meta.dirname + '/../..',
    );

    expect(JSON.stringify(srcManifest, null, 2)).toMatchSnapshot();
    expect(JSON.stringify(enumManifest, null, 2)).toMatchSnapshot();
  });
});
