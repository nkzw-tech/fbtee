/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 *
 */

import path from 'path';
import { generateManifest } from '../manifestUtils';

describe('manifest', () => {
  it('should extract strings', () => {
    const srcPath = 'bin/__fixtures__';
    const enumManifestPath = path.join(srcPath, '.enum_manifest.json');

    const { enumManifest, srcManifest } = generateManifest(
      enumManifestPath,
      [srcPath],
      __dirname + '/../..'
    );

    expect(JSON.stringify(srcManifest, null, 2)).toMatchSnapshot();
    expect(JSON.stringify(enumManifest, null, 2)).toMatchSnapshot();
  });
});
