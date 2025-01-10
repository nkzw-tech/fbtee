/// <reference types="fbtee/ReactTypes.d.ts" />

import type { PlatformProxy } from "wrangler";
// `Env` is defined in worker-configuration.d.ts

type GetLoadContextArgs = {
  request: Request;
  context: {
    cloudflare: Omit<
      PlatformProxy<Env, IncomingRequestCfProperties>,
      "dispose" | "caches"
    > & {
      caches:
        | PlatformProxy<Env, IncomingRequestCfProperties>["caches"]
        | CacheStorage;
    };
  };
};

declare module "react-router" {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface AppLoadContext extends ReturnType<typeof getLoadContext> {
    // This will merge the result of `getLoadContext` into the `AppLoadContext`
  }
}

// Shared implementation compatible with Vite, Wrangler, and Cloudflare Workers
export function getLoadContext({ context }: GetLoadContextArgs) {
  return {
    ...context,
    VALUE_FROM_CLOUDFLARE: context.cloudflare.env.VALUE_FROM_CLOUDFLARE,
  };
}
