# fbtee

_**fbtee** (Far Better Translations, Extended Edition) is an internationalization framework for JavaScript & React designed to be **powerful**, **flexible**, and **intuitive**._

fbtee features inline translations and supports dynamic content, pluralization, lists, and more. It is built on top of Facebook's `fbt` library, which has been used in production for over a decade, serving billions of users.

```tsx
const Greeting = ({ name }) => (
  <div>
    <fbt desc="Greeting">
      Hello, <Name name={name} />!
    </fbt>
  </div>
);
```

## Why choose **fbtee**?

- **Inline translations for Better Developer Experience:** Embed translations directly into your code. No need to manage translation keys or wrap your code with `t()` functions. **fbtee** uses a compiler to extract strings from your code and prepare them for translation providers.
- **Proven in Production:** Built on Facebook's `fbt`, with over a decade of production usage, serving billions of users and two years of production usage in [Athena Crisis](https://athenacrisis.com).
- **Optimized Performance with IR:** Compiles translations into an Intermediate Representation (IR) for extracting strings, then optimizes the runtime output for performance.
- **Easy Setup:** Quick integration with tools like Babel and Vite means you can get started instantly.

## Getting Started

Tired of setting up new projects? Check out these templates for web and React Native that come with **fbtee** pre-configured:

- [Web App Template](https://github.com/nkzw-tech/web-app-template)
- [Expo App Template](https://github.com/nkzw-tech/expo-app-template)

### Examples

Sometimes it's easiest to learn by example and copy-paste the setup from existing projects. Here are some examples of using **fbtee**:

- [Next.js App fbtee Example](https://github.com/cpojer/nextjs-fbtee-example) - A Next.js App Router example using **fbtee** with Server Components.
- [Athena Crisis](https://github.com/nkzw-tech/athena-crisis) - an open source video game using **fbtee**

### Installation

**fbtee** requires at least Node 22, and React 19 if you are using React.

```bash
npm install fbtee
```

In addition to `fbtee`, you need to install the Babel preset.

```bash
npm install -D @nkzw/babel-preset-fbtee
```

### Tooling Setup

If you are using Vite, install the React plugin for Vite:

```bash
npm install -D @vitejs/plugin-react
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

#### Using Babel directly instead of Vite's React Plugin

If you are not using `@vitejs/plugin-react`, for example, because you are using the latest version of React Router in framework mode, you can use `vite-plugin-babel` instead:

```tsx
import fbteePreset from '@nkzw/babel-preset-fbtee';
import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
import babel from 'vite-plugin-babel';

export default defineConfig({
  plugins: [
    babel({
      babelConfig: { presets: [fbteePreset] },
    }),
    reactRouter(),
  ],
});
```

#### Using **fbtee** with Next.js

Create a `babel.config.js` file in the root of your Next.js project and add the **fbtee** preset:

```tsx
export default {
  presets: ['next/babel', '@nkzw/babel-preset-fbtee'],
};
```

#### Scripts

**fbtee** uses two scripts to manage translations. These scripts help automate the process of collecting, creating, and compiling translations.

- `fbtee collect`: This command reads your source files and extracts all the translatable strings into a `source_strings.json` file. This file should be uploaded to your translation provider as the source for your translations.
- `fbtee translate`: This command takes the collected strings and your translations, and compiles them into an optimized format for use in your application.

By default, **fbtee** expects your source code to be anywhere within your project, your translations in a `translations` folder, and the generated translations in `src/translations`. You can customize these paths using command line arguments:

- The `--translations` parameter can be specified to `fbtee translate` to customize the path to the input translation files.
- `--output-dir` can be specified to define where the output translations should be written so they can be loaded in your app. You can also use `--out` parameter to output a single file such as `translations.json`, which can be used directly in your app without loading individual translation files.

If you want to use different paths, it is recommended to define custom commands in your `package.json`:

```json
{
  "scripts": {
    "fbtee:collect": "fbtee collect --src src",
    "fbtee:translate": "fbtee translate --translations translations/*.json -o src/translations/"
  }
}
```

Now, run the collect command to set up the initial strings for translation:

```bash
pnpm fbtee collect
```

Add the files generated by these commands to your `.gitignore`:

```
.enum_manifest.json
source_strings.json
src/translations/
```

Because no translations exist yet, you can run this command to create an empty file for now:

```bash
mkdir -p translations
echo '{"fb-locale": "ja_JP", "translations": {}}' > translations/ja_JP.json
```

If you are not using a translation provider, you can also run `fbtee prepare-translations --locales ja_JP` to generate a JSON file that can be edited directly.

### App Setup

**fbtee**'s runtime can manage the currently selected locale for you through the `<LocaleContext />` component. All you need to do is define the available languages, the locales provided by the browser or device, and a function to load translations for a given locale:

```tsx
import { getLocales } from 'expo-localization';
import { createLocaleContext } from 'fbtee';

// Define the available languages in your app:
const availableLanguages = new Map([
  ['en_US', 'English'],
  ['ja_JP', '日本語 (Japanese)'],
]);

// Web:
const clientLocalesWeb = [navigator.language, ...navigator.languages];
// React Native:
const clientLocalesRN = getLocales().map(({ languageTag }) => languageTag);

// A loader function to fetch translations for a given locale:
const loadLocale = async (locale: string) => {
  if (locale === 'ja_JP') {
    return (await import('./translations/ja_JP.json')).default.ja_JP;
  }

  return {};
};

const LocaleContext = createLocaleContext({
  availableLanguages,
  clientLocales: clientLocalesWeb, // or clientLocalesRN for React Native
  loadLocale,
});

// Now wrap your app with `LocaleContext`:
const MyAppEntryPoint = () => (
  <LocaleContext>
    <App />
  </LocaleContext>
);
```

If you need to access the current locale or set the locale, you can use the `useLocaleContext` hook:

```tsx
import { useLocaleContext } from 'fbtee';

const MyComponent = () => {
  const { locale, setLocale } = useLocaleContext();

  return (
    <div>
      <p>Current Locale: {locale}</p>
      <button onClick={() => setLocale('ja_JP')}>Switch to Japanese</button>
    </div>
  );
};
```

Next up, if you are using React and TypeScript in your project, you need to add TypeScript types for **fbtee** to enable proper type checking in JSX. You can do this by referencing the `ReactTypes.d.ts` file in your main `index.tsx` file or a global type declaration file (e.g., `types.d.ts`):

```tsx
/// <reference types="fbtee/ReactTypes.d.ts" />
```

_You’re now ready to define your first translatable element!_

### Alternative Setup Methods

If you need to build your own locale context with custom functionality, you can use the `setupLocaleContext` function. It takes the same arguments as the `LocaleContext` component, but gives you full control over how you manage locales.

```tsx
const { getLocale, setLocale } = setupLocaleContext({
  availableLanguages: AvailableLanguages,
  clientLocales,
  fallbackLocale,
  hooks,
  loadLocale,
  translations,
});

// Now you can call `getLocale` and `setLocale` anytime, even outside of React components.
if (getLocale() === 'en_US') {
  setLocale('ja_JP'); // Switch to Japanese locale
}
```

A full example of using `setupLocaleContext` to build your own `LocaleContext` abstraction can be found in the [Athena Crisis](https://github.com/nkzw-tech/athena-crisis/blob/main/hera/i18n/LocaleContext.tsx#L41) repository.

### Gender Variations

`createLocaleContext` and `setupLocaleContext` also support setting the user's gender:

```tsx
createLocaleContext({
  …
  gender: 'female', // 'male', 'female' or 'unknown' are supported.
});
```

If you need to adjust the user's gender dynamically, you can use the `setGender` function provided by the `useLocaleContext` hook:

```tsx
import { useLocaleContext } from 'fbtee';

const GenderSelector = () => {
  const { gender, setGender } = useLocaleContext();

  return (
    <div>
      <button onClick={() => setGender('male')}>
        <fbt desc="Male gender">Male</fbt>
      </button>
      <button onClick={() => setGender('female')}>
        <fbt desc="Female gender">Female</fbt>
      </button>
      <button onClick={() => setGender('unknown')}>
        <fbt desc="Unknown gender">Unknown</fbt>
      </button>
    </div>
  );
};
```

#### Full Customization

Finally, if you are using something other than React, or need even more control over how **fbtee** is configured, you can use the `setupFbtee` function. This function allows you to set up **fbtee** with custom hooks and translations:

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

### Usage with Next.js

If you are using Next.js with App Router, check out the [Next.js App fbtee Example](https://github.com/cpojer/nextjs-fbtee-example). You'll need to set up a `<LocaleContext />` as a Client Component, and call `setupFbtee` in the root layout of your app for Server Component support.

When using Next.js with **fbtee**, translated strings are inserted when your Server Components are rendered. This means that changing locales on the client will not automatically update the Server Component's translated strings. To handle locale changes, you need to call a server action that updates the locale, and then re-render your app with the new locale, for example by reloading the page.

If you are exclusively using **fbtee** within Client Components, you can handle locale changes directly on the client only.

## Usage

_If you want to learn by example, check out the [examples](https://github.com/nkzw-tech/fbtee/tree/main/example) directory. You can also check out [Athena Crisis](https://github.com/nkzw-tech/athena-crisis), a large open source video game using **fbtee**_

With **fbtee**, all strings must be wrapped using `<fbt>` (for React/JSX) or `fbt()` (for JavaScript). This ensures strings can be extracted and translated properly. The `desc` attribute is required and provides context for translators, helping them understand the intended meaning of the string.

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

`<fbt>` is a special React component that marks text for translation. The **fbtee** compiler analyzes them to extract strings, and compiles them into an Intermediate Representation (IR). Here is a more complex example of what you can do with **fbtee**:

```tsx
<fbt desc="Feed item">
  <fbt:list items={users} name="userList" />{' '}
  <fbt:plural
    count={users.length}
    many="are"
    name="number of players"
    showCount="no"
  >
    is
  </fbt:plural>{' '}
  playing on
  <fbt:param name="mapName">{game.mapName}</fbt:param>
</fbt>
```

_Note: `<fbt>` is auto-imported for you by the `@nkzw/babel-preset-fbtee` plugin._

This example highlights several features of **fbtee**:

- `<fbt:list>`: Renders a list of items, automatically handling conjunctions and delimiters.
- `<fbt:plural>`: Handles singular and plural forms based on a count value.
- `<fbt:param>`: Allows you to insert dynamic content into your strings, such as variables or React components.

With the above components, you can handle complex strings that are translatable into multiple languages while maintaining clarity and context for translators. This sentence structure supports many variations, such as "Alice is playing on Forest Battle.", or "Alice, Bob and Charlie are playing on Giant Crisis".

Let's look at each of these features in detail:

### Dynamic Content

**fbtee** supports dynamic content through <fbt:param> or by using other React components within your text. For example, if you want to greet a specific user based on a name passed as a prop, you can use `<fbt:param>`:

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

### Lists

`<fbt:list>` is used to render a list of items with conjunctions and delimiters. It automatically handles the grammatical structure of the list based on the locale:

```tsx
<fbt:list
  conjunction="or"
  delimiter="comma"
  items={['Alice', 'Bob', <CharlieNameExampleComponent key="charlieUserID" />]}
  name="userList"
/> // "Alice, Bob, or Charlie"
```

The default conjunction is "and", and the default delimiter is "comma". You can use "or" or "none" as conjunction, and "bullet", "comma", or "semicolon" as delimiters. The `name` attribute is required to provide context for translators. **fbtee** also exports a `list` function that can be used in contexts outside of React:

```tsx
import { list } from 'fbtee';

const userList = list(['Alice', 'Bob', 'Charlie'], 'or', 'comma');
```

### Singular & Plural Forms

**fbtee** supports singular and plural forms using the `<fbt:plural>` component. While in English, the plural form is often just an "s" at the end of a word, in other languages, it can be more complex. **fbtee** handles this automatically based on the count value you provide. Here's an example:

```tsx
<fbt desc="end turn confirmation">
  Do you want to play against
  <fbt:plural count={bots} many="bots" name="numberOfBots" showCount="ifMany">
    a bot
  </fbt:plural>?
</fbt>
```

This sentence might be translated to one of the following variations:

- "Do you want to play against 1 bot?"
- "Do you want to play against 2 bots?"

`<fbt:plural>` expects the singular phrase as children, and an item `count` as prop. You can provide the plural form using the `many` prop. The `showCount` prop can be used to control whether the count should be displayed in the string. `ifMany` only shows the count in the plural case, while `yes` shows it in all cases, and `no` hides it completely. The `name` prop is required to provide context for translators.

### Using Pronouns

You can use `<fbt:pronoun>` to handle pronouns in your strings. This is particularly useful for gendered languages where the pronoun changes based on the subject:

```tsx
<fbt desc="Photo sharing text">
  <fbt:param name="name">{user.name}</fbt:param>
  shared
  <fbt:pronoun type="possessive" gender={user.pronounGender} human />
  photo with you.
</fbt>
```

### Plain Text Usage

In some situations, you may want to use **fbtee** to represent plain text strings without any React components, for example when using alert dialogs or HTML attributes like `placeholder`. For these situations, you can use the `fbs()` function, which is a subset of `fbt` that only supports plain text.

```tsx
import { fbs } from 'fbtee';

<input
  type="text"
  placeholder={fbs('Enter your name', 'Placeholder for name input')}
/>;
```

### Extracting Strings & Translating

After marking your strings for translation with `<fbt>`, run the following commands to extract, and compile translations:

```bash
pnpm fbtee collect
```

You can now upload the `source_strings.json` file to your translation provider, for example [Crowdin](https://crowdin.com/). If you'd like to manually edit the strings, you can use the `fbtee prepare-translations --locales de_DE` to generate a JSON file that can be edited directly.

#### Generated File Structure

Your `source_strings.json` might look like this:

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

Based on the above source string, the US English translation (ie. `translations/en_US.json`) might look like this:

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

And German (`translations/de_DE.json`) might look like this:

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

Once you have the translated strings stored in a `translations/` folder as JSON files using the locale name, for example `en_US.json` or `de_DE.json`, you can run the following command to generate the translations for use in your app:

```bash
pnpm fbtee translate
```

By default, **fbtee** outputs the generated translations in `src/translations`. It will create one JSON file per locale. For example, if you have `translations/en_US.json` and `translations/de_DE.json`, it will generate `src/translations/en_US.json` and `src/translations/de_DE.json`. These files are an optimized representation of your translation file, ready to be used in your app:

```json
{
  "de_DE": {
    "2HVYhv": "Was kommt jetzt?"
  }
}
```

After generating the translation files, your app is ready to display translated content in other languages. Since the `src/translations` folder is auto-generated, it should be ignored by version control and be part of your build process.

## Setting the initial locale

If you know the user's locale ahead of time, you can set it when creating the `LocaleContext` by passing the locale as the first item in the `clientLocales` array:

```tsx
// Read the user locale from localStorage etc.
const userLocale = localStorage.getItem('locale');
const LocaleContext = createLocaleContext({
  availableLanguages,
  clientLocales: [userLocale, navigator.language, ...navigator.languages],
  loadLocale,
});
```

Note that if you are picking the locale ahead of time like this, you need to manually load the translations. This is because the `loadLocale` function is only called when the locale changes, and not when the context is first created. This gives you full control over your app's startup:

```tsx
const loadLocale = async (locale: string) => {
  if (locale === 'ja_JP') {
    return (await import('./translations/ja_JP.json')).default.ja_JP;
  }
  return {};
};

const translations = {
  [userLocale]: await loadLocale(userLocale),
};

const LocaleContext = createLocaleContext({
  availableLanguages,
  clientLocales: [userLocale, navigator.language, ...navigator.languages],
  loadLocale,
  translations,
});
```

If you have to wait for data from your server to determine the user's locale, you can use the `setLocale` function provided by `useLocaleContext` to set the locale after the initial render:

```tsx
import { useLocaleContext } from 'fbtee';

const Root = () => {
  // Fetch the locale from the server.
  const userLocale = useUserLocale();
  const { locale, setLocale } = useLocaleContext();

  useEffect(() => {
    if (locale !== userLocale) {
      setLocale(userLocale);
    }
  }, [locale, setLocale, userLocale]);

  return children;
};
```

## ESLint Plugin

You can install the optional ESLint plugin to catch common mistakes and enforce best practices when using **fbtee**:

```bash
npm install -D @nkzw/eslint-plugin-fbtee
```

Add the following configuration to your ESLint configuration:

```js
import fbtee from '@nkzw/eslint-plugin-fbtee';

export default [
  fbtee.configs.recommended,
  {
    plugins: {
      '@nkzw/fbtee': fbtee,
    },
  },
];
```

If you want stricter enforcement of translation rules, you can use the strict configuration, which enables the `no-untranslated-strings` rule. This ensures that all strings in your codebase are marked for translation.

```js
import fbtee from '@nkzw/eslint-plugin-fbtee';

export default [
  fbtee.configs.strict,
  {
    plugins: {
      '@nkzw/fbtee': fbtee,
    },
  },
];
```

Alternatively, if you'd like more granular control over the rules:

```js
import fbtee from '@nkzw/eslint-plugin-fbtee';

export default [
  fbtee,
  {
    plugins: {
      '@nkzw/fbtee': fbtee,
    },
    rules: {
      '@nkzw/fbtee/no-empty-strings': [
        'error',
        {
          ignoredWords: ['Banana', 'pnpm install fbtee'],
        },
      ],
      '@nkzw/fbtee/no-unhelpful-desc': 'error',
      '@nkzw/fbtee/no-untranslated-strings': 'error',
    },
  },
];
```

## What's better about `fbtee` than `fbt`?

Facebook has done an amazing job with `fbt`, an internationalization library that has been successfully used in production at Facebook for over 10 years. Their work provided a strong foundation for modern localization tools.

The open-source version of `fbt`, however, became unmaintained, difficult to set up, and incompatible with modern tools. It was eventually archived in November 2024. **fbtee** builds on this foundation with several improvements:

- **Easier Setup:** fbtee works with modern tools like Vite.
- **Statically Typed:** The fbtee compiler ensures correct usage of fbtee, library TypeScript types are provided, and an eslint plugin helps fix common mistakes.
- **Improved React Compatibility:** Removed React-specific hacks and added support for implicit React fragments (`<>`).
- **Enhanced Features:** Fixed and exported `intlList` as a new `<fbt:list>` construct, which was not functional in the original `fbt`.
- **Modernized Codebase:** Rewritten using TypeScript, ES modules (ESM), eslint, and modern JavaScript standards. Removed cruft and legacy code.
- **Updated Tooling:** Uses modern tools like pnpm, Vite, and esbuild for faster and more efficient development of **fbtee**.

**fbtee** remains compatible with `fbt` and migration is straightforward.

## Migration from `fbt`

**fbtee** is compatible with `fbt`. If you are already using `fbt`, migrating to fbtee is straightforward:

- Follow the "Getting Started" guide above and remove all "fbt" related packages.
- Make sure you are using React 19.
- Replace `import { fbt } from 'fbt'` with `import { fbt } from 'fbtee'`.
- Rename commands from `fbt-collect`, and `fbt-translate` to `fbtee-collect`, and `fbtee-translate`. `fbt manifest` was removed and `fbtee collect` now handles this step automatically.
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
