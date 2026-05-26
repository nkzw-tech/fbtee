# fbtee

**_fbtee_** is an internationalization framework for JavaScript and React. It lets you write translatable text inline, keep translator context next to the UI, and compile strings into a small runtime format for production.

```tsx
const Greeting = ({ name }) => (
  <fbt desc="Greeting on the home screen">
    Hello, <Name name={name} />!
  </fbt>
);
```

_fbtee_ is a modern continuation of Facebook's `fbt`, rebuilt for TypeScript, ESM, React 19, Vite, Next.js, Babel & SWC.

## Features

- **Inline translations for Better Developer Experience:** Embed translations directly into your code. No need to manage translation keys or wrap your code with `t()` functions. **fbtee** uses a compiler to extract strings from your code and prepare them for translation providers.
- **Proven in Production:** Built on Facebook's `fbt`, with over a decade of production usage serving billions of users, plus years in production at [Athena Crisis](https://athenacrisis.com).
- **Optimized Performance with IR:** Compiles translations into an Intermediate Representation (IR) for extracting strings, then optimizes the runtime output for performance.
- **Easy Setup:** Quick integration with Babel, SWC, Vite, Next.js, and Expo.

## Getting Started

Use one of the templates if you are starting fresh:

- [Web App Template](https://github.com/nkzw-tech/web-app-template)
- [Expo App Template](https://github.com/nkzw-tech/expo-app-template)

For an existing app, install the runtime:

```bash
npm install fbtee
```

_fbtee_ requires Node 22+. React apps should use React 19+.

### Babel, Vite and React

Install the Babel preset and the Rolldown Babel plugin:

```bash
npm install -D @nkzw/babel-preset-fbtee @rolldown/plugin-babel
```

With Vite, `@rolldown/plugin-babel`, and `@vitejs/plugin-react`:

```ts
import fbteePreset from '@nkzw/babel-preset-fbtee';
import babel from '@rolldown/plugin-babel';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    babel({
      presets: [fbteePreset],
    }),
    react(),
  ],
});
```

With a direct Babel setup:

```js
export default {
  presets: ['@nkzw/babel-preset-fbtee'],
};
```

With Next.js and Babel:

```js
export default {
  presets: ['next/babel', '@nkzw/babel-preset-fbtee'],
};
```

### SWC and Turbopack

Install the SWC runtime compiler and the CLI:

```bash
npm install -D @nkzw/swc-plugin-fbtee @nkzw/fbtee-cli
```

For Next.js SWC plugins:

```js
export default {
  experimental: {
    swcPlugins: [
      [
        '@nkzw/swc-plugin-fbtee',
        {
          fbtCommon: {
            Accept: 'Button label for accepting terms',
          },
          fbtEnumManifest: {},
        },
      ],
    ],
  },
};
```

Use the SWC plugin to compile app code. Use `fbtee collect` to extract phrases. Do not pass `collectFbt: true` to the SWC plugin.

### TypeScript JSX Types

React TypeScript projects should include the JSX declarations once in a global type file or app entry point:

```tsx
/// <reference types="fbtee/ReactTypes.d.ts" />
```

## Writing Strings

Every user-facing string should be wrapped in `<fbt>`, `fbt()`, or `fbs()`. Descriptions are required because they are the translator's context.

```tsx
<fbt desc="Empty state title when a project has no tasks">No tasks yet</fbt>
```

Use `fbt()` outside JSX:

```tsx
import { fbt } from 'fbtee';

const title = fbt(
  'No tasks yet',
  'Empty state title when a project has no tasks',
);
```

Use `fbs()` when you need a plain string:

```tsx
import { fbs } from 'fbtee';

<input
  placeholder={fbs('Search projects', 'Project search input placeholder')}
/>;
```

## Dynamic Content

Use `<fbt:param>` for dynamic values. Token names should describe the value, not its current English position.

```tsx
<fbt desc="Greeting with the viewer name">
  Hello, <fbt:param name="viewerName">{viewer.name}</fbt:param>!
</fbt>
```

React elements inside `<fbt>` are automatically turned into implicit params:

```tsx
<fbt desc="Greeting with a linked viewer name">
  Hello, <UserLink user={viewer} />!
</fbt>
```

Use `fbt.sameParam()` or `<fbt:same-param>` when the same token appears more than once.

## Plurals

Use `<fbt:plural>` when a count controls grammar. _fbtee_ handles locale-specific plural rules.

```tsx
<fbt desc="Inbox unread count">
  You have{' '}
  <fbt:plural
    count={count}
    many="unread messages"
    name="unreadCount"
    showCount="yes"
  >
    an unread message
  </fbt:plural>
  .
</fbt>
```

`showCount` can be `yes`, `ifMany`, or `no`.

## Lists

Use `<fbt:list>` for locale-aware lists:

```tsx
<fbt desc="People assigned to a task">
  Assigned to <fbt:list items={assignees} name="assigneeList" />.
</fbt>
```

The standalone `list()` helper is available for non-React code:

```tsx
import { list } from 'fbtee';

const names = list(['Alice', 'Bob', 'Charlie'], 'or', 'comma');
```

## Enums

Use enums when runtime values map to a fixed set of translatable labels:

```tsx
const StatusLabels = {
  done: 'done',
  open: 'open',
};

<fbt desc="Task status label">
  This task is <fbt:enum enum-range={StatusLabels} value={status} />.
</fbt>;
```

For shared enum modules, use the `$FbtEnum` suffix so the collector can resolve them.

## Pronouns and Gender

Use `<fbt:pronoun>` when a phrase depends on a person's gender:

```tsx
<fbt desc="Photo sharing notification">
  <fbt:param name="name">{user.name}</fbt:param> shared{' '}
  <fbt:pronoun gender={user.gender} human type="possessive" /> photo.
</fbt>
```

Supported pronoun types are `subject`, `object`, `possessive`, and `reflexive`.

## Common Strings

Common strings are reusable source strings with shared descriptions:

```tsx
<fbt common>Save</fbt>
```

Pass common strings to the compiler as `fbtCommon`:

```js
{
  fbtCommon: {
    Save: 'Button label for saving changes',
  },
}
```

## Runtime Setup

Most React apps should use `createLocaleContext`:

```tsx
import { createLocaleContext } from 'fbtee';

const availableLanguages = new Map([
  ['en-US', 'English'],
  ['de-DE', 'Deutsch'],
  ['ja-JP', '日本語'],
]);

const loadLocale = async (locale: string) => {
  switch (locale) {
    case 'de-DE':
      return (await import('./translations/de-DE.json')).default['de-DE'];
    case 'ja-JP':
      return (await import('./translations/ja-JP.json')).default['ja-JP'];
    default:
      return {};
  }
};

const LocaleContext = createLocaleContext({
  availableLanguages,
  clientLocales: [navigator.language, ...navigator.languages],
  loadLocale,
});

export const Root = () => (
  <LocaleContext>
    <App />
  </LocaleContext>
);
```

Use `useLocaleContext` to read or change the locale:

```tsx
import { useLocaleContext } from 'fbtee';

const LanguageButton = () => {
  const { locale, setLocale } = useLocaleContext();
  return <button onClick={() => setLocale('de-DE')}>{locale}</button>;
};
```

If you need full control, use `setupLocaleContext` or `setupFbtee` directly.

### Next.js App Router

For App Router, put the locale context in a Client Component. If you render translated strings in Server Components, call `setupFbtee` on the server and re-render the route when the locale changes. Client-only strings can switch locale fully on the client.

See the [Next.js fbtee example](https://github.com/cpojer/nextjs-fbtee-example) for a complete setup.

## Translation Workflow

Extract source strings:

```bash
pnpm fbtee collect
```

This writes `source_strings.json`.

Prepare editable translation files:

```bash
pnpm fbtee prepare-translations --source-strings source_strings.json --output-dir translations --locales de-DE fr-FR ja-JP
```

`prepare-translations` merges source strings into existing locale files, preserves translated entries, and marks new work with `"status": "new"`. New files use BCP 47 locale identifiers by default, such as `de-DE.json` and `es-419.json`.

Compile translations for the app:

```bash
pnpm fbtee translate --source-strings source_strings.json --translations 'translations/*.json' --output-dir src/translations
```

fbtee accepts both modern BCP 47 locale identifiers (`de-DE`, `es-419`) and legacy Facebook-style identifiers (`de_DE`, `es_LA`). If both aliasing files exist, for example `translations/de_DE.json` and `translations/de-DE.json`, fbtee throws and asks you to keep one. Existing legacy files are updated in place; new generated files default to BCP 47. To force a specific output style, pass `--output-locale-style=bcp47`, `--output-locale-style=legacy`, or `--output-locale-style=preserve`.

To migrate editable translation files and generated runtime files to BCP 47 names:

```bash
pnpm fbtee migrate-locales --to bcp47 --dir translations --dir src/translations
pnpm fbtee translate --output-locale-style=bcp47
```

Use `--dry-run` first to preview file renames.

Commit the human-authored translation files. Ignore generated runtime output:

```gitignore
.enum_manifest.json
source_strings.json
src/translations/
```

## Translating Strings with Coding Agents

Coding agents are great at updating _fbtee_ translation files because all the context is in the repository:

1. `fbtee prepare-translations` adds every missing translation and marks it with `"status": "new"`.
1. The agent edits only entries with `"status": "new"`.
1. The agent removes `"status": "new"` after the translation is complete.
1. Code review shows a clean diff of the new localized strings.

This works best when the app already has translated strings. The agent can infer tone, voice, capitalization, punctuation, and product vocabulary from the existing locale files.

### Coding Agent prompt:

```md
Run `fbtee prepare-translations --source-strings source_strings.json --output-dir ares/translations --locales de-DE fr-FR ja-JP pl-PL ru-RU zh-CN es-ES it-IT ko-KR pt-BR uk-UA` for all the translations the app supports.

Look at all updated translation files. For every entry with `"status": "new"`, write a translation that matches the tone, voice, and language already used in the app and in the current locale.

Remove `"status": "new"` from each completed translation entry.
```

## ESLint

Install the optional ESLint plugin:

```bash
npm install -D @nkzw/eslint-plugin-fbtee
```

Use the recommended config:

```js
import fbtee from '@nkzw/eslint-plugin-fbtee';

export default [fbtee.configs.recommended];
```

Use the strict config if you want every user-facing string to be wrapped:

```js
import fbtee from '@nkzw/eslint-plugin-fbtee';

export default [fbtee.configs.strict];
```

## Migration from fbt

_fbtee_ is compatible with the core `fbt` programming model:

1. Replace `fbt` packages with `fbtee` and the matching compiler package.
1. Replace imports from `fbt` with imports from `fbtee`.
1. Use `fbtee collect`, `fbtee prepare-translations`, and `fbtee translate`.
1. Convert CommonJS common strings or enum modules to ESM when needed.
1. Replace legacy setup calls with `setupFbtee`, `createLocaleContext`, or `setupLocaleContext`.

Some archived `fbt` options and legacy behaviors were intentionally removed. The compiler errors should point to the modern replacement when one exists.

## Examples

- [Example App](https://github.com/nkzw-tech/fbtee/tree/main/example)
- [Next.js App Router Example](https://github.com/cpojer/nextjs-fbtee-example)
- [Athena Crisis](https://github.com/nkzw-tech/athena-crisis)

## Credits

- `fbt` was originally created by [Facebook](https://github.com/facebook/fbt).
- The auto-import plugin was created by [@alexandernanberg](https://github.com/alexandernanberg).
- [Nakazawa Tech](https://nkzw.tech) rewrote `fbt` into _fbtee_ and maintains this project.
