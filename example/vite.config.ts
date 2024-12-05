import path from 'node:path';
import react from '@vitejs/plugin-react';

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
              fbtCommonPath: './common_strings.json',
              // We can also provide the fbt enum manifest directly as a JS variable
              // fbtEnumManifest: require('./.enum_manifest.json'),
              fbtEnumPath: path.join(__dirname, '.enum_manifest.json'),
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
