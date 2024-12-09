import react from '@vitejs/plugin-react';
import EnumManifest from './.enum_manifest.json';
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
        plugins: [
          [
            'babel-plugin-fbt',
            {
              fbtCommon: CommonStrings,
              fbtEnumManifest: EnumManifest,
            },
          ],
          'babel-plugin-fbt-runtime',
        ],
      },
    }),
  ],
  root,
  server: {
    host: true,
  },
};
