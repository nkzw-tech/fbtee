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
npm install fbtee
```

In addition to `fbtee`, you need to install the Babel preset and React plugin for Vite:

```bash
npm install -D @nkzw/babel-preset-fbtee @vitejs/plugin-react
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

**fbtee** uses three scripts to manage translations. These scripts help automate the process of collecting, creating, and compiling translations. Dependending on your setup you might adjust want to adjust them, which we'll cover below. It is recommended to add them to your `package.json`:

```json
{
  "scripts": {
    "fbtee:manifest": "fbtee manifest --src src",
    "fbtee:collect": "fbtee collect --manifest < .src_manifest.json > .source_strings.json",
    "fbtee:translate": "fbtee translate --translations translations/*.json --jenkins > src/translations.json"
  }
}
```

Let's go through these commands ones by one:

- `fbtee manifest --src src` searches through files in the `src` directory and generates a manifest file (`.src_manifest.json`) that lists all the files containing `<fbt>` tags. In addition it creates `.enum_manifest.json` which lists all the files containing `<fbt:enum>` tags. These files will be put into `.gitignore` as they are auto-generated and should not be checked into version control. You can adjust the `--src` parameter to point to your source directory. If your source directory is for example the root use `--src .` or if it's an app folder use `--src app`.
- `fbtee collect --manifest < .src_manifest.json > .source_strings.json` reads the manifest file and extracts all the strings marked for translation into a `.source_strings.json` file. This file should be uploaded to your translation provider as the source for your translations. The file itself will also be put into `.gitignore`. As you might be able to see in theory both the output file name of the manifest command, as well as input and ouput of the collect command are configurable. Yet we recommend to stick with the default values.
- `fbtee translate --translations translations/*.json --jenkins > src/translations.json` reads all the translations in the `translations/` directory and compiles them into a single `src/translations.json` file. This file is used by **fbtee** to display translated content in your app. The `--translations` parameter specifies the path to the translation files. The `--jenkins` flag is used to define the utilized [hash function](https://en.wikipedia.org/wiki/Jenkins_hash_function). You can adjust the `--translations` parameter to point to your translation directory. If your translations are within your app directory in a folder called `i18n`, for example, you'd use `--translations app/i18n/*.json`. The output is the translation file used by **fbtee**. This file is going to be referred to in your applications entry point, therefor it needs to be generated as part of the build, but should not be part of your version control. Also here you should adjust the output file name to your needs. For example if we're going with an app folder structure we could use `> app/translations.json`. As this command requires the translations to be present in the `translations/` directory to create a valid json to be used, you first need to create such files based on the `.source_strings.json` received as part of the collect command.

So in a first step - given you've added the commands to your package.json script section - run these commands to set up the initial files:

```bash
npm run fbtee:manifest && npm run fbtee:collect
```

The files generated by these - as previously said - should not be checked into version control. Add the following entries to your `.gitignore`:

```
.src_manifest.json
.source_strings.json
.enum_manifest.json
src/translations.json
```

Be sure to adjust the paths to your needs if you're not using the default values.

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

> [!NOTE]
> At this point you've not yet generated the translation file. Therefore you'll see an error for it no tbeing able to find the module `./translations.json`. This is expected and will be resolved once you've generated the translation file. Simply running the command at this point wouldn't remedy it, as the empty json file wouldn't adhere to the expected type and would also throw an error.

> [!WARNING]
> To be described: How to handle e.g. React Router with "framework mode" with a client and server entry. How to define the language based on e.g. the users browser settings and ensure that there are no hydration errors or the like. Currently the sample is a hardcoded locale and gender.

Next up, if you are using React and TypeScript in your project, you need to add TypeScript types for **fbtee** to enable proper type checking in JSX. You can do this by referencing the `ReactTypes.d.ts` file in your main `index.tsx` file or a global type declaration file (e.g., `types.d.ts`):

```tsx
/// <reference types="fbtee/ReactTypes.d.ts" />
```

_You’re now ready to define your first translatable element!_

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
npm run fbtee:manifest && npm run fbtee:collect
```

You can now upload the `.source_strings.json` file to your translation provider. One sample for such a translation provider is [Crowdin](https://crowdin.com/).

As a sample the `.source_strings.json` could look like this:

```json
{
    "childParentMappings": {},
    "phrases": [
        {
            "hashToLeaf": {
                "MB6OYuvCF1VzjOmqinI42g==": {
                    "desc": "What's next question",
                    "text": "What's next?"
                }
            },
            "col_beg": 12,
            "col_end": 68,
            "filepath": "app/welcome/welcome.tsx",
            "line_beg": 43,
            "line_end": 43,
            "project": "",
            "jsfbt": {
                "m": [],
                "t": {
                    "desc": "What's next question",
                    "text": "What's next?"
                }
            }
        }
    ]
}
```

With the translated filed being for english US (see fbtee setup above) (e.g. `translations/en_US.json`):

```json
{
    "fb-locale": "en_US",
    "translations": {
        "MB6OYuvCF1VzjOmqinI42g==": {
            "tokens": [],
            "types": [],
            "translations": [
                {
                    "translation": "What's next?",
                    "variations": []
                }
            ]
        }
    }
}
```

For another locale, such as german it could be another file such as `translations/de_DE.json`:

```json
{
    "fb-locale": "de_DE",
    "translations": {
        "MB6OYuvCF1VzjOmqinI42g==": {
            "tokens": [],
            "types": [],
            "translations": [
                {
                    "translation": "Was kommt jetzt?",
                    "variations": []
                }
            ]
        }
    }
}
```

Once you have the translated strings stored in a `translations/` folder as JSON files, you can run the following command to generate the translations file:

```bash
npm run fbtee:translate
```

This will generate the `translation.json` file referred to in the setup done before. This file might look like this:

```json
{"de_DE":{"2HVYhv":"Was kommt jetzt?"},"en_US":{"2HVYhv":"What's next?"}}
```

After generating the translations file, your app is ready to display translated content in other languages. The error you had until now in the `setupFbtee` with regards to the imported translations file should be resolved now.

Keep in mind that the `translations.json` file needs to be created during your build process in order for **fbtee** to work correctly. You can add the `fbtee:translate` command to your build script.

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
