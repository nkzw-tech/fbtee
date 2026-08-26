import fbtee from '@nkzw/vite-plugin-fbtee';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    fbtee(),
    babel({
      presets: [reactCompilerPreset()],
    }),
    tailwindcss(),
    react(),
  ],
});
