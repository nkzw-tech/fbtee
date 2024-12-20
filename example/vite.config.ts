import fbteePreset from '@nkzw/babel-preset-fbtee';
import react from '@vitejs/plugin-react';
import EnumManifest from './.enum_manifest.json' with { type: 'json' };
import CommonStrings from './common_strings.json' with { type: 'json' };

const root = process.cwd();

export default {
  build: {
    target: 'modules',
  },
  define: {
    'process.env.NODE_ENV': `"development"`,
  },
  plugins: [
    react({
      babel: {
        presets: [
          [
            fbteePreset,
            {
              fbtCommon: CommonStrings,
              fbtEnumManifest: EnumManifest,
            },
          ],
        ],
      },
    }),
  ],
  root,
  server: {
    host: true,
  },
};
