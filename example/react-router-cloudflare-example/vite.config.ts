import { cloudflareDevProxy } from "@react-router/dev/vite/cloudflare";
import { reactRouter } from "@react-router/dev/vite";
import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import babel from "vite-plugin-babel";
import { getLoadContext } from "./load-context";

export default defineConfig(({ isSsrBuild }) => ({

  css: {
    postcss: {
      plugins: [tailwindcss, autoprefixer],
    },
  },
  plugins: [
		babel({
			filter: (name) => name.endsWith("tsx"),
			include: ["./app/**/*"],
		}),
    cloudflareDevProxy({ getLoadContext }),
    reactRouter(),
    tsconfigPaths(),
  ],
  ssr: {
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
      conditions: ["workerd", "worker", "browser"],
    },
    target: "webworker",
  },
}));
