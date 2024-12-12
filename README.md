# fbtee

**fbtee** (Far Better Translations, _Extended Edition_) is an internationalization framework for JavaScript & React designed to be **powerful**, **flexible**, and **intuitive**.

## Why fbtee?

- **Inline Translations for Better Developer Experience:** Embed translations directly into your code. No need to manage translation keys or wrap your code with `t()` functions. **fbtee** uses a compiler to extract strings from your code and prepare them for translation providers.
- **Proven in Production:** Built on Facebook's `fbt`, with over a decade of production usage, serving billions of users and one year of production usage in [Athena Crisis](https://athenacrisis.com).
- **Optimized Performance with IR:** Compiles translations into an Intermediate Representation (IR) for extracting strings, and optimizes the runtime output for performance.
- **Easy Setup:** Quick integration with tools like Babel and Vite means you can get started instantly.

## Status: Ready for Early Adopters

This is a fork of Facebook's original `fbt` library, which has been archived. The aim of this fork is to create the best and most modern internationalization library for JavaScript & React.

## Getting Started

```bash
npm install fbtee @nkzw/babel-fbtee
```

In your `vite.config.ts`:

```ts
import fbteePreset from '@nkzw/babel-fbtee';
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

_You’re now ready to go!_

## Usage

## What's better about fbtee than fbt?

Facebook has done an amazing job with `fbt`, an internationalization library that has been successfully used in production at Facebook for over 10 years. Their work provided a strong foundation for modern localization tools.

The open-source version of `fbt`, however, became unmaintained, difficult to set up, and incompatible with modern tools. It was eventually archived in November 2024. **fbtee** builds on this foundation with several improvements:

- **Easier Setup:** fbtee works with modern tools like Vite.
- **Improved React Compatibility:** Removed React-specific hacks and added support for implicit React fragments (`<>`).
- **Enhanced Features:** Fixed and exported `intlList`, which was not functional in the original `fbt`.
- **Modernized Codebase:** Rewritten using TypeScript, ES modules (ESM), eslint, and modern JavaScript standards. Removed cruft and legacy code.
- **Updated Tooling:** Uses modern tools like pnpm, Vite, and esbuild for faster and more efficient development of **fbtee**.

**fbtee** remains compatible with `fbt` and migration is straightforward.

## Migration from `fbt`:

**fbtee** is compatible with `fbt`. If you are already using `fbt`, migrating to fbtee is straightforward:

- Replace `import { fbt } from 'fbt'` with `import { fbt } from 'fbtee'`.
- Rename commands from `fbt-collect`, `fbt-manifest` and `fbt-translate` to `fbtee-collect`, `fbtee-manifest` and `fbtee-translate`.
- If you were using CommonJS modules for common strings or enums, convert them to ES modules.
- Ensure you are using the latest version of Node.js 22 or later.

After these changes, your project should work seamlessly with **fbtee**.

_Note: Some legacy behavior and options were removed from `fbtee`. If you have a complex setup, please consider [reaching out to us for help](mailto:fbtee@nakazawa.dev)._

## Credits

- `fbt` was originally created by [Facebook](https://github.com/facebook/fbt).
- The auto-import plugin was created by [@alexandernanberg](https://github.com/alexandernanberg).
- [Nakazawa Tech](https://nkzw.tech) rewrote `fbt` into `fbtee` and continues to maintain this project.
