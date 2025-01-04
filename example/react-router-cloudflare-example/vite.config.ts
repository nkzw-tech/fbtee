import { cloudflareDevProxy } from "@react-router/dev/vite/cloudflare";
import { reactRouter } from "@react-router/dev/vite";
import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import fbteePreset from '@nkzw/babel-preset-fbtee';
import react from '@vitejs/plugin-react';
import { getLoadContext } from "./load-context";

export default defineConfig(({ isSsrBuild }) => ({
  build: {
    rollupOptions: isSsrBuild
      ? {
          input: {
            // `index.js` is the entrypoint for pre-rendering at build time
            "index.js": "virtual:react-router/server-build",
            // `worker.js` is the entrypoint for deployments on Cloudflare
            "worker.js": "./workers/app.ts",
          },
        }
      : undefined,
  },
  css: {
    postcss: {
      plugins: [tailwindcss, autoprefixer],
    },
  },
  ssr: {
    target: "webworker",
    noExternal: true,
    external: ["node:async_hooks"],
    resolve: {
      conditions: ["workerd", "browser"],
    },
    optimizeDeps: {
      include: [
        "react",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom",
        "react-dom/server",
        "react-router",
        "fbtee"
      ],
    },
  },
  plugins: [
    react({
      babel: {
        presets: [fbteePreset],
      },
    }),
    cloudflareDevProxy({ getLoadContext }),
    reactRouter(),
    {
      // This plugin is required so both `index.js` / `worker.js can be
      // generated for the `build` config above
      name: "react-router-cloudflare-workers",
      config: () => ({
        build: {
          rollupOptions: isSsrBuild
            ? {
                output: {
                  entryFileNames: "[name]",
                },
              }
            : undefined,
        },
      }),
    },
    tsconfigPaths(),
  ],
}));
