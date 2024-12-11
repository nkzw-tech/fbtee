import react from '@vitejs/plugin-react';
// @ts-expect-error
import EnumManifest from './.enum_manifest.json';
// @ts-expect-error
import CommonStrings from './common_strings.json';

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
            'babel-preset-fbt',
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
