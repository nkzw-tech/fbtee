import { Form, Link, useNavigation } from "react-router";
import logoDark from "./logo-dark.svg";
import logoLight from "./logo-light.svg";
import { fbs, fbt } from "fbtee";

const linkClassName =
  "group flex items-center gap-3 self-stretch p-3 leading-normal text-blue-700 hover:underline dark:text-blue-500";

export function Welcome({
  message,
}: {
  message: string;
}) {
  return (
    <main className="flex items-center justify-center pt-16 pb-4">
      <div className="flex-1 flex flex-col items-center gap-16 min-h-0">
        <header className="flex flex-col items-center gap-9">
          <div className="w-[500px] max-w-[100vw] p-4">
            <img
              src={logoLight}
              alt={fbs(
                "React Router Logo (Light Theme)",
                "Alt text for light theme logo"
              )}
              className="block w-full dark:hidden"
            />
            <img
              src={logoDark}
              alt={fbs(
                "React Router Logo (Dark Theme)",
                "Alt text for dark theme logo"
              )}
              className="hidden w-full dark:block"
            />
          </div>
        </header>
        <div className="max-w-[300px] w-full space-y-6 px-4">
          <nav className="rounded-3xl border border-gray-200 p-6 dark:border-gray-700 space-y-4">
            <p className="leading-6 text-gray-700 dark:text-gray-200 text-center">
              <fbt desc="Navigation Prompt">
                What would you like to explore next?
              </fbt>
            </p>
            <ul>
              {resources.map(({ href, external, text, icon }) => (
                <li key={href}>
                  {external ? (
                    <a
                      className={linkClassName}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {icon}
                      {text}
                    </a>
                  ) : (
                    <Link className={linkClassName} to={href}>
                      {icon}
                      {text}
                    </Link>
                  )}
                </li>
              ))}
              <li className="self-stretch p-3 leading-normal text-center">
                {message}
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </main>
  );
}

const resources = [
  {
    href: "https://reactrouter.com/docs",
    external: true,
    text: fbt(
      "React Router Docs",
      "Link to React Router official documentation"
    ),
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        className="stroke-gray-600 group-hover:stroke-current dark:stroke-gray-300"
        aria-hidden="true"
      >
        <path
          d="M9.99981 10.0751V9.99992M17.4688 17.4688C15.889 19.0485 11.2645 16.9853 7.13958 12.8604C3.01467 8.73546 0.951405 4.11091 2.53116 2.53116C4.11091 0.951405 8.73546 3.01467 12.8604 7.13958C16.9853 11.2645 19.0485 15.889 17.4688 17.4688ZM2.53132 17.4688C0.951566 15.8891 3.01483 11.2645 7.13974 7.13963C11.2647 3.01471 15.8892 0.951453 17.469 2.53121C19.0487 4.11096 16.9854 8.73551 12.8605 12.8604C8.73562 16.9853 4.11107 19.0486 2.53132 17.4688Z"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: "https://rmx.as/discord",
    external: true,
    text: fbt(
      "Join React Router Discord",
      "Link to React Router community Discord"
    ),
    icon: <DiscordIcon />,
  },
  {
    href: "https://developers.cloudflare.com/workers/",
    external: true,
    text: fbt(
      "Cloudflare Workers Docs",
      "Link to Cloudflare Workers official documentation"
    ),
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        width="24"
        height="24"
        aria-hidden="true"
      >
        <path
          d="M8.16 23h21.177v-5.86l-4.023-2.307-.694-.3-16.46.113z"
          fill="#fff"
        />
        <path
          d="M22.012 22.222c.197-.675.122-1.294-.206-1.754-.3-.422-.807-.666-1.416-.694l-11.545-.15c-.075 0-.14-.038-.178-.094s-.047-.13-.028-.206c.038-.113.15-.197.272-.206l11.648-.15c1.38-.066 2.88-1.182 3.404-2.55l.666-1.735a.38.38 0 0 0 .02-.225c-.75-3.395-3.78-5.927-7.4-5.927-3.34 0-6.17 2.157-7.184 5.15-.657-.488-1.5-.75-2.392-.666-1.604.16-2.9 1.444-3.048 3.048a3.58 3.58 0 0 0 .084 1.191A4.84 4.84 0 0 0 0 22.1c0 .234.02.47.047.703.02.113.113.197.225.197H21.58a.29.29 0 0 0 .272-.206l.16-.572z"
          fill="#f38020"
        />
        <path
          d="M25.688 14.803l-.32.01c-.075 0-.14.056-.17.13l-.45 1.566c-.197.675-.122 1.294.206 1.754.3.422.807.666 1.416.694l2.457.15c.075 0 .14.038.178.094s.047.14.028.206c-.038.113-.15.197-.272.206l-2.56.15c-1.388.066-2.88 1.182-3.404 2.55l-.188.478c-.038.094.028.188.13.188h8.797a.23.23 0 0 0 .225-.169A6.41 6.41 0 0 0 32 21.106a6.32 6.32 0 0 0-6.312-6.302"
          fill="#faae40"
        />
      </svg>
    ),
  },
  {
    href: "https://discord.com/invite/cloudflaredev",
    external: true,
    text: fbt(
      "Join Cloudflare Discord",
      "Link to Cloudflare community Discord"
    ),
    icon: <DiscordIcon />,
  },
  {
    href: "/pre-rendered",
    external: false,
    text: fbt(
      "View a pre-rendered route",
      "Link to pre-rendered route for demonstration"
    ),
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10 12.5 8 15l2 2.5"></path>
        <path d="m14 12.5 2 2.5-2 2.5"></path>
        <path d="M14 2v4a2 2 0 0 0 2 2h4"></path>
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"></path>
      </svg>
    ),
  },
];

function DiscordIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="20"
      viewBox="0 0 24 20"
      fill="none"
      className="stroke-gray-600 group-hover:stroke-current dark:stroke-gray-300"
      aria-hidden="true"
    >
      <path
        d="M15.0686 1.25995L14.5477 1.17423L14.2913 1.63578C14.1754 1.84439 14.0545 2.08275 13.9422 2.31963C12.6461 2.16488 11.3406 2.16505 10.0445 2.32014C9.92822 2.08178 9.80478 1.84975 9.67412 1.62413L9.41449 1.17584L8.90333 1.25995C7.33547 1.51794 5.80717 1.99419 4.37748 2.66939L4.19 2.75793L4.07461 2.93019C1.23864 7.16437 0.46302 11.3053 0.838165 15.3924L0.868838 15.7266L1.13844 15.9264C2.81818 17.1714 4.68053 18.1233 6.68582 18.719L7.18892 18.8684L7.50166 18.4469C7.96179 17.8268 8.36504 17.1824 8.709 16.4944L8.71099 16.4904C10.8645 17.0471 13.128 17.0485 15.2821 16.4947C15.6261 17.1826 16.0293 17.8269 16.4892 18.4469L16.805 18.8725L17.3116 18.717C19.3056 18.105 21.1876 17.1751 22.8559 15.9238L23.1224 15.724L23.1528 15.3923C23.5873 10.6524 22.3579 6.53306 19.8947 2.90714L19.7759 2.73227L19.5833 2.64518C18.1437 1.99439 16.6386 1.51826 15.0686 1.25995ZM16.6074 10.7755L16.6074 10.7756C16.5934 11.6409 16.0212 12.1444 15.4783 12.1444C14.9297 12.1444 14.3493 11.6173 14.3493 10.7877C14.3493 9.94885 14.9378 9.41192 15.4783 9.41192C16.0471 9.41192 16.6209 9.93851 16.6074 10.7755ZM8.49373 12.1444C7.94513 12.1444 7.36471 11.6173 7.36471 10.7877C7.36471 9.94885 7.95323 9.41192 8.49373 9.41192C9.06038 9.41192 9.63892 9.93712 9.6417 10.7815C9.62517 11.6239 9.05462 12.1444 8.49373 12.1444Z"
        strokeWidth="1.5"
      />
    </svg>
  );
}
