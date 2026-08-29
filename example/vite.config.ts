import fbtee from '@nkzw/vite-plugin-fbtee';
import react from '@vitejs/plugin-react';
import EnumManifest from './.enum_manifest.json' with { type: 'json' };
import CommonStrings from './common_strings.json' with { type: 'json' };

const root = process.cwd();

export default {
  define: {
    'process.env.NODE_ENV': `"development"`,
  },
  plugins: [
    fbtee({
      fbtCommon: CommonStrings,
      fbtEnumManifest: EnumManifest,
    }),
    react(),
  ],
  root,
  server: {
    host: true,
  },
};
