# fbtee

**_fbtee_** is an internationalization framework for JavaScript and React. It lets you write translatable text inline, keep translator context next to the UI, and compile strings into a small runtime format for production.

```tsx
const Greeting = ({ name }) => (
  <fbt desc="Greeting on the home screen">
    Hello, <Name name={name} />!
  </fbt>
);
```

_fbtee_ is a modern continuation of Facebook's `fbt`, rebuilt for TypeScript, ESM, React 19, Vite, Next.js, and Oxc.

## Features

- **Inline translations for Better Developer Experience:** Embed translations directly into your code. No need to manage translation keys or wrap your code with `t()` functions. **fbtee** uses a compiler to extract strings from your code and prepare them for translation providers.
- **Proven in Production:** Built on Facebook's `fbt`, with over a decade of production usage serving billions of users, plus years in production at [Athena Crisis](https://athenacrisis.com).
- **Optimized Performance with IR:** Compiles translations into an Intermediate Representation (IR) for extracting strings, then optimizes the runtime output for performance.
- **Easy Setup:** Quick integration with Vite, Next.js, Oxc, and Expo.

## Getting Started

For a new project, start with the [fate stack](https://stack.fate.technology) or the [Expo template](https://github.com/nkzw-tech/expo-app-template). For an existing app, install the fbtee runtime and compiler:

```bash
npm install fbtee
npm install -D @nkzw/fbtee-compiler
```

The compiler package includes the `fbtee` command and the JavaScript compiler API. Keep it in `devDependencies`; applications use `fbtee` at runtime.

The toolchain requires Node 22.12+. React apps require React 19+.

### Vite

```bash
npm install -D @nkzw/vite-plugin-fbtee
```

Place fbtee before the React plugin:

```ts
import fbtee from '@nkzw/vite-plugin-fbtee';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [fbtee(), react()],
});
```

### Next.js

```bash
npm install -D @nkzw/next-plugin-fbtee
```

```ts
import withFbtee from '@nkzw/next-plugin-fbtee';

export default withFbtee()({});
```

The plugin supports Turbopack and Webpack.

<details>
<summary>Custom builds with Oxc</summary>

Run the fbtee transform before lowering TypeScript and JSX:

```bash
npm install -D @nkzw/fbtee-compiler oxc-transform
```

```ts
import { transformSync as transformFbtee } from '@nkzw/fbtee-compiler';
import { transformSync as transformOxc } from 'oxc-transform';

export function compile(filename: string, source: string) {
  const translated = transformFbtee(filename, source);
  if (translated.errors.length) {
    throw new Error(translated.errors.map(({ message }) => message).join('\n'));
  }

  return transformOxc(filename, translated.code, {
    jsx: { runtime: 'automatic' },
  });
}
```

The returned Oxc result contains the generated code and any downstream errors. See the [transform options](https://github.com/nkzw-tech/fbtee/blob/main/packages/fbtee-compiler/index.d.ts) for common strings and enum configuration.

</details>

### TypeScript

Add the JSX declarations to a global type file or your app entry point:

```tsx
/// <reference types="fbtee/ReactTypes.d.ts" />
```

## Writing Strings

Wrap a sentence in `<fbt>` and describe where it appears. The description helps translators choose the right words:

```tsx
<fbt desc="Empty state when a project has no tasks">No tasks yet</fbt>
```

The compiler supplies the global `fbt` import for JSX. Use `fbt()` in JavaScript, or `fbs()` where an API requires a plain string:

```tsx
import { fbs, fbt } from 'fbtee';

const title = fbt('No tasks yet', 'Empty state when a project has no tasks');

<input placeholder={fbs('Search projects', 'Project search placeholder')} />;
```

### Dynamic Content

Give dynamic values meaningful names with `<fbt:param>`. React elements inside a sentence become parameters automatically, as in the greeting above.

```tsx
<fbt desc="Greeting with the viewer name">
  Hello, <fbt:param name="viewerName">{viewer.name}</fbt:param>!
</fbt>
```

For repeated values, use `<fbt:same-param>` or `fbt.sameParam()`.

### Plurals and Lists

Describe the singular and plural forms in your source language. fbtee selects the translated form for the locale:

```tsx
<fbt desc="Inbox unread count">
  You have{' '}
  <fbt:plural count={count} many="unread messages" name="count" showCount="yes">
    unread message
  </fbt:plural>.
</fbt>
```

`showCount` accepts `yes`, `ifMany`, or `no`. For lists, use `<fbt:list>` or the standalone `list()` helper:

```tsx
<fbt desc="People assigned to a task">
  Assigned to <fbt:list items={assignees} name="assignees" />.
</fbt>
```

fbtee also supports enums, gender, and pronouns. See the [website examples](https://fbtee.dev) for each.

### Common Strings

Share a description for labels that mean the same thing throughout the app. Define them in `common_strings.json`:

```json
{
  "Save": "Button label for saving changes"
}
```

Pass this object as `fbtCommon` to your compiler plugin and add `--common common_strings.json` when collecting strings. Then use the label without repeating its description:

```tsx
<fbt common>Save</fbt>
```

## Translation Workflow

First, extract the strings and prepare a file for each language:

```bash
npx fbtee collect
npx fbtee prepare-translations --source-strings source_strings.json --output-dir translations --locales de-DE ja-JP
```

Translate the entries marked `"status": "new"`, then remove that status. Existing translations are preserved when you run the command again. Compile the files for your app:

```bash
npx fbtee translate --source-strings source_strings.json --translations 'translations/*.json' --output-dir src/translations
```

Generated runtime catalogs omit messages with no completed translation, including entries still marked `"status": "new"`. This lets partial catalogs fall back to another language. After upgrading, recompile existing catalogs to enable this behavior. Explicit translations equal to the source text are preserved. Fallback applies to whole messages; a partially translated plural/gender table keeps its existing within-message fallback behavior.

Use `fbtee translate --strict` to require a completed entry for every collected source hash in each supplied locale. Missing entries, entries marked `"status": "new"`, and empty translation lists fail before output is written. Explicit empty-string translations and translations equal to the source remain valid.

Commit the editable files in `translations/`. Add generated files to `.gitignore`:

```gitignore
.enum_manifest.json
source_strings.json
src/translations/
```

The npm package includes a [translation skill](https://github.com/nkzw-tech/fbtee/blob/main/packages/fbtee/skills/fbtee-translate/SKILL.md) for coding agents. It prepares translations, fills every new entry across the supported locales, and uses existing translations and source-code context to match terminology and tone. To use it, ask your agent:

```text
Read node_modules/fbtee/skills/fbtee-translate/SKILL.md and translate all new strings for all supported locales.
```

Review the resulting diff as you would any translation.

## Runtime Setup

For an app with one active language, use `createLocaleContext`. It selects a supported locale from the browser's preferences and loads translations when the language changes.

```tsx
import { createLocaleContext } from 'fbtee';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const LocaleContext = createLocaleContext({
  availableLanguages: new Map([
    ['en-US', 'English'],
    ['de-DE', 'Deutsch'],
  ]),
  clientLocales: navigator.languages,
  loadLocale: async (locale) =>
    locale === 'de-DE' ? (await import('./translations/de-DE.json')).default['de-DE'] : {},
});

await LocaleContext.preload();

createRoot(document.getElementById('root')!).render(
  <LocaleContext>
    <App />
  </LocaleContext>,
);
```

Call `preload()` once before rendering to load the initial language and its available fallback catalogs. Creating the context does not load them automatically. You can skip preloading if you supply all those catalogs at setup; the source locale does not require a catalog.

Preloading and language changes share pending loads. Loading failures reject the promise; calling again retries them.

Use `useLocaleContext()` to change the language in a React transition:

```tsx
import { useLocaleContext } from 'fbtee';
import { useTransition } from 'react';

function LanguageButton() {
  const { locale, setLocale } = useLocaleContext();
  const [, startTransition] = useTransition();

  return <button onClick={() => startTransition(() => setLocale('de-DE'))}>{locale}</button>;
}
```

Outside React, use `setupLocaleContext` and await `preloadLocale()`, or configure the runtime directly with `setupFbtee`.

### Formatting Numbers and Dates

Use JavaScript's native `Intl` APIs for numbers, currencies, dates, times, and relative time. Pass fbtee's active locale to the formatter and insert the result with `<fbt:param>`:

```tsx
import { useLocaleContext } from 'fbtee';

function Price({ amount, currency }: { amount: number; currency: string }) {
  const { locale } = useLocaleContext();
  const price = new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);

  return (
    <fbt desc="Product price">
      Price: <fbt:param name="price">{price}</fbt:param>
    </fbt>
  );
}
```

With scoped runtimes, use the `locale` returned by `useFbt()`. Reuse formatter instances when formatting many values with the same locale and options. For server-rendered dates and relative times, keep the locale, time zone, and reference time consistent between server and client; these settings belong to your application.

### Locale Matching and Fallback

Fallback works automatically for each message: `fr-CA` checks its Canadian French catalog, then `fr`, then the source locale's catalog if supplied, and finally the inline source text. A translated regional message always wins. An empty string counts as a translation.

To use a shared French catalog, include `fr` alongside `fr-CA` in `availableLanguages` and return each catalog from `loadLocale`. `preload()` and language changes load the available fallback catalogs in parallel, share pending loads, and retry failed loads. A supplied `fr` catalog does not prevent loading `fr-CA`. With `setupFbtee`, `createFbteeRuntime`, or `runWithFbtee`, supply the fallback catalogs in `translations`.

Matching accepts BCP 47 and legacy identifiers such as `fr-CA` and `fr_CA`. It prefers exact locales, then language/script parents. If none are available during language selection, it chooses a region with the same language and script, preferring the region inferred by `Intl.Locale` and using a stable order for ties. Catalog insertion order does not determine the selected language. Traditional Chinese falls back through `zh-Hant`; it does not automatically use a Simplified Chinese catalog. Per-message fallback does not choose arbitrary sibling regions.

Most apps need no additional settings. All setup APIs accept these optional settings:

```tsx
const runtime = createFbteeRuntime({
  locale: 'fr-CA',
  translations,
  sourceLocale: 'en-US', // Default; change this for non-English inline messages.
  fallbackLocales: {
    'fr-CA': ['fr-FR'], // After natural parents, before the source locale.
    default: ['en-GB'], // Additional fallbacks for every locale.
  },
  onMissingTranslation: ({ locale, hashKey, sourceLocale }) => {
    reportMissingTranslation({ locale, hashKey, sourceLocale });
  },
});
```

`fallbackLocales` also accepts an array, such as `['fr', 'en-GB']`, for every locale. Mappings can refer to other mapped locales; cycles and duplicate catalogs are ignored. Plural selection and phonological rewrites follow the language of the catalog supplying the message, or `sourceLocale` for inline source text; interpolated numbers retain the viewer's number formatting.

`onMissingTranslation` runs only when no catalog in the chain contains the message and inline source text is used. It reports each locale/message once per runtime, resets when translations are registered or merged, and does not report normal source-locale rendering. No generic missing-catalog warning is emitted. Custom `hooks.getTranslatedInput` implementations remain responsible for their own fallback and reporting. They can return `locale` alongside `args` and `table` to select the message's phonological rewrites; omitting it preserves the viewer locale.

For locale contexts, `fallbackLocale` controls the selected language when none of `clientLocales` is supported. It defaults to `sourceLocale`. Use `fallbackLocales` to configure per-message fallback, and set `sourceLocale` when the inline messages are not US English.

### Scoped Runtimes

Use `LocaleProvider` when part of a page needs its own language. Create a runtime with its translations, then call `useFbt()` in the components that translate:

```tsx
import { createFbteeRuntime, LocaleProvider, useFbt } from 'fbtee';
import german from './translations/de-DE.json' with { type: 'json' };

const germanRuntime = createFbteeRuntime({ locale: 'de-DE', translations: german });

function SaveButton() {
  const { fbt } = useFbt();
  return <button>{fbt('Save', 'Save button')}</button>;
}

function Preview() {
  return (
    <LocaleProvider runtime={germanRuntime}>
      <SaveButton />
    </LocaleProvider>
  );
}
```

Create runtimes once, outside rendering or with React state. Each translating component calls `useFbt()`, which requires a provider and also returns `fbs`, `list`, and `locale`. Nested providers and separate roots can use different runtimes. Global imports keep their existing behavior.

A runtime's locale and gender are fixed; switch the provider's runtime to change them. Async actions keep the translator they captured, even across `await`. Pass it explicitly to helpers in other modules:

```tsx
import type { FbtAPI } from 'fbtee';

export async function saveMessage(fbt: FbtAPI) {
  await saveDocument();
  return fbt('Saved', 'Save confirmation');
}
```

Keep the local names `fbt` and `fbs`. For helper arguments and imported runtimes, annotate with the imported `FbtAPI`, `FbsAPI`, or `FbteeRuntime` type so the compiler recognizes them. If a linter reports a JSX-only translator as unused, keep the binding and suppress the warning or use the function form.

Load more translations with `germanRuntime.mergeTranslations(bundle)`, using compiled bundles shaped as `{ locale: { hash: translation } }`. Mounted consumers update automatically. Load before displaying the relevant UI to avoid briefly showing source strings.

### Server Rendering

In Node.js, wrap the render in `runWithFbtee` to give each request its own locale. Imported `fbt`, `fbs`, and `list` calls use that scope, including across asynchronous work:

```tsx
import { runWithFbtee } from 'fbtee/server';
import { renderToString } from 'react-dom/server';
import App from './App.tsx';
import german from './translations/de-DE.json' with { type: 'json' };

export function renderPage() {
  return runWithFbtee({ locale: 'de-DE', translations: german }, () => renderToString(<App />));
}
```

Start the actual renderer inside the callback, including for streaming SSR. Wrapping a component's JSX return does not scope its descendants. Load translations before rendering, and use the same locale and translations for client hydration.

Each request has its own hooks and caches. Calls to `setupFbtee` and `FbtTranslations` inside the callback affect only that scope; nested scopes start with their own configuration. Promises, timers, and Suspense retries created inside it retain the scope. Use Node's `AsyncLocalStorage.bind()` for callbacks handed to an external scheduler.

The Next.js plugin handles compilation, not request isolation. Use `runWithFbtee` where you control the renderer or in Node route handlers. Server Components can use explicit runtimes; `LocaleProvider` and `useFbt()` belong in Client Components. Pass locale and translation data across that boundary, since runtime objects contain functions. Server-rendered translations need a new server render when the language changes.

### Shared Translations

Scoped runtimes and requests share catalogs by reference. Treat them as read-only: use `runtime.mergeTranslations()` or, inside a request, `FbtTranslations.mergeTranslations()` and `registerTranslations()` for updates. Merges copy affected locale maps while sharing nested tables. Scoped catalogs are frozen automatically in development and tests; production registration does not freeze or copy them. Ordinary singleton catalogs remain mutable.

## Linting

The optional ESLint plugin checks strings and translator descriptions:

```bash
npm install -D @nkzw/eslint-plugin-fbtee
```

```js
import fbtee from '@nkzw/eslint-plugin-fbtee';

export default [
  {
    plugins: { '@nkzw/fbtee': fbtee },
    rules: fbtee.configs.recommended.rules,
  },
];
```

Use `fbtee.configs.strict.rules` to also check for untranslated text.

## Migration from fbtee 4

fbtee 5 combines `@nkzw/fbtee-cli` and `@nkzw/oxc-transform-fbtee` into `@nkzw/fbtee-compiler`:

```sh
npm uninstall @nkzw/fbtee-cli @nkzw/oxc-transform-fbtee
npm install fbtee@^5
npm install -D @nkzw/fbtee-compiler@^5
```

Update any installed fbtee Vite, Next.js, and ESLint plugins to v5. For custom compiler integrations, replace imports from `@nkzw/oxc-transform-fbtee` with `@nkzw/fbtee-compiler`. The compiler API and existing `fbtee` commands are unchanged. Runtime imports continue to use `fbtee`.

## Migration from fbt

_fbtee_ is compatible with the core `fbt` programming model:

1. Replace `fbt` packages with `fbtee` and the matching compiler package.
1. Replace imports from `fbt` with imports from `fbtee`.
1. Use `fbtee collect`, `fbtee prepare-translations`, and `fbtee translate`.
1. Convert CommonJS common strings or enum modules to ESM when needed.
1. Replace legacy setup calls with `setupFbtee`, `createLocaleContext`, or `setupLocaleContext`.

Some archived `fbt` options and legacy behaviors were intentionally removed. The compiler errors should point to the modern replacement when one exists.

fbtee uses Oxc and a native CLI. Replace the Babel integration with the Vite or Next.js plugin above, or use `@nkzw/fbtee-compiler` directly. Babel-specific extensions (`--custom-collector`, `--transform`, `--generate-fbt-nodes`, and `--hash-module`) are no longer supported. The collector cannot execute Babel configuration or apply `.babelignore`; remove that legacy configuration, or use `--disable-babel-config` to collect unmodified source.

Both `de-DE` and legacy locale names such as `de_DE` work. To rename catalogs, run `npx fbtee migrate-locales --to bcp47 --dir translations --dir src/translations --dry-run`, then repeat without `--dry-run`. Keep one file per locale; new files use BCP 47 names by default.

## Examples and Credits

- [Example app](https://github.com/nkzw-tech/fbtee/tree/main/example), including independent locale widgets.
- [Next.js example](https://github.com/cpojer/nextjs-fbtee-example).
- [Athena Crisis](https://github.com/nkzw-tech/athena-crisis).

Originally created as [`fbt` at Facebook](https://github.com/facebook/fbt), with auto-import support by [@alexandernanberg](https://github.com/alexandernanberg). Rebuilt and maintained as fbtee by [Nakazawa Tech](https://nkzw.tech).
