import fbteePreset from '@nkzw/babel-preset-fbtee';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    babel({
      presets: [fbteePreset, reactCompilerPreset()],
    }),
  ],
});
