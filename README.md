# fbtee

_**fbtee** (Far Better Translations, Extended Edition) is an internationalization framework for JavaScript & React designed to be **powerful**, **flexible**, and **intuitive**._

## Why `fbtee`?

- **Inline Translations for Better Developer Experience:** Embed translations directly into your code. No need to manage translation keys or wrap your code with `t()` functions. **fbtee** uses a compiler to extract strings from your code and prepare them for translation providers.
- **Proven in Production:** Built on Facebook's `fbt`, with over a decade of production usage, serving billions of users and one year of production usage in [Athena Crisis](https://athenacrisis.com).
- **Optimized Performance with IR:** Compiles translations into an Intermediate Representation (IR) for extracting strings, and optimizes the runtime output for performance.
- **Easy Setup:** Quick integration with tools like Babel and Vite means you can get started instantly.

## Status: Ready for Early Adopters

This is a fork of Facebook's original `fbt` library, which has been archived. The aim of this fork is to create the best and most modern internationalization library for JavaScript & React.

## Getting Started

**fbtee** requires at least Node 22, and React 19 if you are using React.

```bash
npm install fbtee @nkzw/babel-preset-fbtee
```

In your `vite.config.ts`:

```ts
import fbteePreset from '@nkzw/babel-preset-fbtee';
import react from '@vitejs/plugin-react';

export default {
  plugins: [
    react({
      babel: {
        presets: [fbteePreset],
      },
    }),
  ],
};
```

**fbtee** uses three scripts to manage translations. These scripts help automate the process of collecting, creating, and compiling translations. It is recommended to add them to your `package.json`:

```json
{
  "scripts": {
    "fbtee:collect": "fbtee collect --manifest < .src_manifest.json > .source_strings.json",
    "fbtee:manifest": "fbtee manifest --src src",
    "fbtee:translate": "fbtee translate --translations translations/*.json --jenkins > src/translations.json"
  }
}
```

Run these commands to set up the initial translation files:

```bash
npm run fbtee:manifest && npm run fbtee:collect && npm run fbtee:translate
```

The files generated by these commands are auto-generated and should not be checked into version control. Add the following entries to your `.gitignore`:

```
.src_manifest.json
.source_strings.json
.enum_manifest.json
src/translations.json
```

Next, set up **fbtee** in your app's initialization code (e.g., `src/index.tsx`):

```tsx
import { IntlVariations, setupFbtee } from 'fbtee';
import translations from './translations.json';

setupFbtee({
  hooks: {
    getViewerContext: () => ({
      GENDER: IntlVariations.GENDER_UNKNOWN,
      locale: 'en_US',
    }),
  },
  translations,
});
```

Finally, if you are using React and TypeScript in your project, you need to add TypeScript types for **fbtee** to enable proper type checking in JSX. You can do this by referencing the `ReactTypes.d.ts` file in your main `index.tsx` file or a global type declaration file (e.g., `types.d.ts`):

```tsx
/// <reference types="fbtee/ReactTypes.d.ts" />
```

_You’re now ready to go!_

## Usage

_If you want to learn by example, check out the [examples](https://github.com/nkzw-tech/fbtee/tree/main/example) directory._

All strings need to be wrapped by `<fbt>` (for React/JSX) or `fbt()` (for JavaScript). This ensures strings can be extracted and translated properly. The `desc` attribute is required and provides context for translators, helping them understand the intended meaning of the string.

Here are some basic examples:

```tsx
const Greeting = () => <div>Hello, World!</div>;
```

You can wrap the string with `<fbt>`:

```tsx
const Greeting = () => (
  <div>
    <fbt desc="Greeting">Hello, World!</fbt>
  </div>
);
```

`<fbt>` is a special React component that marks text for translation. The `fbtee` compiler analyzes them to extract strings, and compiles them into an Intermediate Representation (IR). It supports dynamic content through <fbt:param> or even other React components. For example, if you want to greet a specific user based on a name passed as a prop, you can use `<fbt:param>`:

```tsx
const Greeting = ({ name }) => (
  <div>
    <fbt desc="Greeting">
      Hello, <fbt:param name="name">{name}</fbt:param>!
    </fbt>
  </div>
);
```

**fbtee** allows you to use regular React Components inside of `<fbt>` which will automatically create `<fbt:param>` calls for you:

```tsx
const Greeting = ({ name }) => (
  <div>
    <fbt desc="Greeting">
      Hello, <Name name={name} />!
    </fbt>
  </div>
);
```

_Note: `<fbt>` is auto-imported for you by the `@nkzw/babel-preset-fbtee` plugin._

After marking your strings for translation with `<fbt>`, run the following commands to extract, and compile translations:

```bash
npm run fbtee:collect
```

You can now upload the `.source_strings.json` file to your translation provider. Once you have the translated strings stored in a `translations/` folder as JSON files, you can run the following command to generate the translations file:

```bash
npm run fbtee:translate
```

After generating the translations file, your app is ready to display translated content in other languages.

## ESLint Plugin

You can install the optional eslint plugin to catch common mistakes and enforce best practices when using **fbtee**:

```bash
npm install @nkzw/eslint-plugin-fbtee
```

Add the following configuration to your ESLint configuration:

```js
{
  extends: ['plugin:@nkzw/eslint-plugin-fbtee/recommended'],
  plugins: ['@nkzw/eslint-plugin-fbtee'],
}
```

If you want stricter enforcement of translation rules, you can use the strict configuration, which enables the `no-untranslated-strings` rule. This ensures that all strings in your codebase are marked for translation.

```js
{
  extends: ['plugin:@nkzw/eslint-plugin-fbtee/strict'],
  plugins: ['@nkzw/eslint-plugin-fbtee'],
}
```

Or, if you'd like more granular control over the rules:

```js
{
  plugins: ['@nkzw/eslint-plugin-fbtee'],
  rules: {
    '@nkzw/fbtee/no-empty-strings': 'error',
    '@nkzw/fbtee/no-unhelpful-desc': 'error',
    '@nkzw/fbtee/no-untranslated-strings': 'error',
  },
}
```

## What's better about `fbtee` than `fbt`?

Facebook has done an amazing job with `fbt`, an internationalization library that has been successfully used in production at Facebook for over 10 years. Their work provided a strong foundation for modern localization tools.

The open-source version of `fbt`, however, became unmaintained, difficult to set up, and incompatible with modern tools. It was eventually archived in November 2024. **fbtee** builds on this foundation with several improvements:

- **Easier Setup:** fbtee works with modern tools like Vite.
- **Statically Typed:** The fbtee compiler ensures correct usage of fbtee, libary TypeScript types are provided, and an eslint plugin helps fix common mistakes.
- **Improved React Compatibility:** Removed React-specific hacks and added support for implicit React fragments (`<>`).
- **Enhanced Features:** Fixed and exported `inltList` as a new `<fbt:list>` construt, which was not functional in the original `fbt`.
- **Modernized Codebase:** Rewritten using TypeScript, ES modules (ESM), eslint, and modern JavaScript standards. Removed cruft and legacy code.
- **Updated Tooling:** Uses modern tools like pnpm, Vite, and esbuild for faster and more efficient development of **fbtee**.

**fbtee** remains compatible with `fbt` and migration is straightforward.

## Migration from `fbt`:

**fbtee** is compatible with `fbt`. If you are already using `fbt`, migrating to fbtee is straightforward:

- Follow the "Getting Started" guide above and remove all "fbt" related packages.
- Make sure you are using React 19.
- Replace `import { fbt } from 'fbt'` with `import { fbt } from 'fbtee'`.
- Rename commands from `fbt-collect`, `fbt-manifest` and `fbt-translate` to `fbtee-collect`, `fbtee-manifest` and `fbtee-translate`.
- If you were using CommonJS modules for common strings or enums, convert them to ES modules.
- Ensure you are using the latest version of Node.js 22 or later.
- Rename your `init({})` call to `setupFbtee({})`.

After these changes, your project should work seamlessly with **fbtee**.

_Note: Some legacy behavior and options were removed from `fbtee`. If you have a complex setup, please consider [reaching out to us for help](mailto:fbtee@nakazawa.dev)._

## Credits

- `fbt` was originally created by [Facebook](https://github.com/facebook/fbt).
- The auto-import plugin was created by [@alexandernanberg](https://github.com/alexandernanberg).
- [Nakazawa Tech](https://nkzw.tech) rewrote `fbt` into `fbtee` and continues to maintain this project.

## Support

- Check out the [#fbtee channel on Reactiflux's Discord server](https://discord.gg/reactiflux).
