# Welcome to React Router on Cloudflare Workers with D1!

A modern, production-ready template for building full-stack React applications using React Router, hosted on Cloudflare Workers with D1 as the database.

You can quickly create a new React Router application from this template by running:

```
npx create-react-router@latest --template matthewlynch/react-router-cloudflare-d1
```

Some of the code in this repo was adapted from the [React Router Cloudflare D1 template](https://github.com/remix-run/react-router-templates/tree/main/cloudflare-d1).

## Features

- 🚀 Server-side rendering
- ⚡️ Hot Module Replacement (HMR)
- 📦 Asset bundling and optimization
- 🔄 Data loading and mutations
- 🔒 TypeScript by default
- 🎉 TailwindCSS for styling
- 🟧️ Setup to deploy to Cloudflare Workers
- 📊 Cloudflare D1 database for production and SQLite database for local development
- 📜 Pre-render routes at build time
- 🌍 Separate environments for preview and production
- 📟 [`cloudflareDevProxy`](https://github.com/remix-run/remix/blob/main/packages/remix-dev/vite/cloudflare-proxy-plugin.ts) to make Cloudflare bindings work locally
- 📖 [React Router docs](https://reactrouter.com/)
- 📖 [Cloudflare Workers docs](https://developers.cloudflare.com/workers/)
- 📖 [D1 database docs](https://developers.cloudflare.com/d1/)

## Getting Started

1. Run `cp .dev-example.vars .dev.vars` to create an .env file you can use to override variables defined in `wrangler.toml` or set secret values you don't want to check into source control
2. Update the `name` field in `wranlger.toml`
3. Install dependencies `pnpm install`
4. Create a database by running [`wrangler d1 create <name>`](https://developers.cloudflare.com/d1/wrangler-commands/#d1-create) and update `wranlger.toml` with the UUID and name for the database
   1. Create an additional database for the "preview" environment and update `env.preview.d1_databases` in `wranlger.toml` with the UUID and name for the preview database
   2. OR delete `env.preview*` if you don't want to deploy a preview version of your app
5. Add your Cloudflare Account ID/Database UUID/Token to `.dev.vars` (you only need this when you want to view data via Drizzle Studio for your remote database)
6. Run `pnpm typegen` any time you make changes to `wranlger.toml` to ensure types from bindings and module rules are up to date for type safety

### Development

Run an initial database migration:

```bash
pnpm db:migrate
```

Start the development server with HMR:

```bash
pnpm dev
```

Your application will be available at [`http://localhost:5173`](http://localhost:5173).

### Database

You can develop against a local SQLite database then push changes to your remote D1 database.

#### Workflow

1. Make changes to the schema in `./database/schema.ts`
2. Run `pnpm db:generate` to generate SQL migration files
3. Run `pnpm db:migrate` to apply the generated migration files to your local SQLite database
4. Run `pnpm db:migrate:production` to apply the changes to your remote D1 database

#### Viewing data (via Drizzle Studio)

Run `pnpm db:studio` to browse data in your local database on disk or `pnpm db:studio:production` to browse your remote D1 database.

You need to have added your Cloudflare Account ID/Database UUID/Token to `.dev.vars` if you want to run `pnpm db:studio:production`.

#### Creating a Cloudflare token for Drizzle Studio

1. Log in to Cloudflare and visit https://dash.cloudflare.com/profile/api-tokens and click "Create Token"
2. Scroll down to "Create Custom Token" and click on "Get Started"
3. Enter a name for the token
4. "Permissions" needs to be set to "Account" / "D1" / "Edit"
5. Click "Continue to summary" and copy the token value so you can set the `CLOUDFLARE_TOKEN` environment variable in `.dev.vars`

## Building for Production

Create a production build:

```bash
pnpm build
```

## Deployment

Deployment is done using the Wrangler CLI.

Make sure you have run `pnpm db:generate` & `pnpm db:migrate:production` so the deployed app can query the database.

To deploy directly to production from your machine:

```sh
npx wrangler deploy
```

Or to deploy to the preview environment:

```sh
npx wrangler versions upload --env preview
```

The CLI will output the URL you can use to view the app and the UUID of the deployment.

You can then promote a version to production after verification or roll it out progressively.

```sh
npx wrangler versions deploy
```

Select the UUID of the deployment you want to promote.

## Continuous deployment via GitHub

You can configure CD via GitHub once you have run the deployment steps above

1. Visit the "Workers & Pages" page in the Cloudflare Dashboard
2. Click on the worker you deployed (the name will match what is defined in `wrangler.toml#name` field)
3. Click "Settings"
4. Scroll down to "Build" and click on "Connect"
5. Select your repository and branch
6. Click "connect"
7. Push changes to the repo for automatic deployments

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever CSS framework you prefer.

---

Built with ❤️ by [Matt](https://mattlynch.dev)
