import { cloudflareDevProxy } from "@react-router/dev/vite/cloudflare";
import { reactRouter } from "@react-router/dev/vite";
import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import fbteePreset from "@nkzw/babel-preset-fbtee";
import babel from "vite-plugin-babel";
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
  plugins: [
    babel({
      babelConfig: {
        presets: [fbteePreset],
      },
    }),
    cloudflareDevProxy({ getLoadContext }),
    reactRouter(),
    {
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
      // This plugin is required so both `index.js` / `worker.js can be
      // generated for the `build` config above
      name: "react-router-cloudflare-workers",
    },
    tsconfigPaths(),
  ],
  ssr: {
    external: ["node:async_hooks"],
    noExternal: true,
    optimizeDeps: {
      include: [
        "react",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom",
        "react-dom/server",
        "react-router",
        "fbtee",
      ],
    },
    resolve: {
      conditions: ["workerd", "browser"],
    },
    target: "webworker",
  },
}));
