import { Link } from "react-router";

export default function StaticPage() {
  return (
    <main className="flex flex-col items-center justify-center pt-16 pb-4 space-y-4">
      <h1>
        <fbt desc="Static Page Content">This route is pre-rendered at build time, based on the config defined in <pre>react-router.config.ts</pre>.</fbt>
      </h1>
      <Link to="/" className="underline">
        <fbt desc="Static Page Link to Home">Return to Home</fbt>
      </Link>
    </main>
  );
}
