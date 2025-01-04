import type { Route } from "./+types/home";
import { Welcome } from "~/welcome/welcome";
import { fbs } from "fbtee";

export function meta({}: Route.MetaArgs) {
  return [
    { title: fbs("Home | React Router App on Cloudflare", "Meta Title for Home Route") },
    {
      name: "description",
      content: fbs("Welcome to a React Router app hosted on Cloudflare Workers.", "Meta Description for Home Route"),
    },
  ];
}
export async function loader({ context }: Route.LoaderArgs) {
  return {
    message: context.VALUE_FROM_CLOUDFLARE,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <Welcome
      message={loaderData.message}
    />
  );
}
