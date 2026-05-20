import { VStack } from '@nkzw/stack';
import { useLocaleContext } from 'fbtee';
import {
  CheckCircle,
  Code as CodeIcon,
  createLucideIcon,
  ExternalLink,
  FileText,
  Globe,
  Languages,
  Rocket,
  Settings,
  Shield,
  Sparkles,
  Terminal,
  Users,
  Zap,
} from 'lucide-react';
import { AnchorHTMLAttributes, useTransition } from 'react';
import AvailableLanguages from './AvailableLanguages.tsx';
import { Badge } from './components/Badge.tsx';
import { Button } from './components/Button.tsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './components/Card.tsx';
import Code from './components/Code.tsx';
import H2 from './components/H2.tsx';
import { Separator } from './components/Separator.tsx';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from './components/Tabs.tsx';
import cx from './lib/cx.tsx';

const Github = createLucideIcon('github', [
  [
    'path',
    {
      d: 'M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4',
      key: 'tonef',
    },
  ],
  ['path', { d: 'M9 18c-4.51 2-5-2-7-2', key: '9comsn' }],
]);

const Link = ({ ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
  <a {...props} />
);

const LocaleSwitcher = () => {
  const [, startTransition] = useTransition();
  const { locale: currentLocale, setLocale } = useLocaleContext();

  return (
    <>
      <Button
        asChild
        className="hover:text-blue-600 dark:hover:text-blue-400"
        size="lg"
        variant="outline"
      >
        <button
          className="flex cursor-pointer items-center space-x-2"
          popoverTarget="locale-switcher"
          popoverTargetAction="show"
        >
          <Languages className="h-4 w-4" />
          <fbt desc="Locale switcher button">Change Language</fbt>
        </button>
      </Button>
      <Card
        className="group self-center justify-self-center border-purple-100 bg-white shadow transition-all hover:border-purple-200 hover:shadow-lg dark:bg-black"
        id="locale-switcher"
        popover="auto"
      >
        <VStack alignCenter center className="w-64" gap={12} padding={16}>
          {[...AvailableLanguages.entries()].map(([locale, name]) => (
            <Button
              asChild
              className={cx({
                'bg-blue-100 dark:bg-blue-900': currentLocale === locale,
              })}
              key={locale}
              size="sm"
              variant="outline"
            >
              <a
                className="w-full flex-1 cursor-pointer p-2"
                onClick={() =>
                  startTransition(() => {
                    setLocale(locale);
                    localStorage.setItem('fbtee:locale', locale);
                  })
                }
              >
                {name}
              </a>
            </Button>
          ))}
        </VStack>
      </Card>
    </>
  );
};

export default function App() {
  return (
    <div className="bg-background min-h-screen">
      <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 border-b backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 py-1">
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Globe className="h-6 w-6 text-sky-500" />
            </div>
            <span className="bg-linear-to-r from-sky-500 to-blue-500 bg-clip-text text-xl font-semibold text-transparent">
              fbtee
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <Button asChild size="sm" variant="ghost">
              <Link
                className="hover:text-blue-600 dark:hover:text-blue-400"
                href="https://github.com/nkzw-tech/fbtee"
                target="_blank"
              >
                <Github className="h-4 w-4" />
                <span>GitHub</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>
      <section className="relative overflow-hidden px-4 py-10">
        <div className="absolute inset-0 border-b bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/20 dark:to-blue-950/20"></div>
        <div className="relative container mx-auto max-w-4xl text-center">
          <Badge
            className="mb-6 border-blue-200 bg-blue-100 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-900 dark:hover:bg-blue-900"
            variant="secondary"
          >
            <Sparkles className="mr-1 h-3 w-3" />
            Far Better Translations, Extended Edition
          </Badge>
          <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">
            <span className="bg-linear-to-r from-sky-500 to-blue-500 bg-clip-text font-semibold text-transparent">
              fbtee
            </span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-xl italic">
            <fbt desc="fbtee tagline">
              An internationalization framework for JavaScript & React designed
              to be{' '}
              <span className="font-semibold text-sky-600">powerful</span>,{' '}
              <span className="font-semibold text-blue-600">flexible</span>, and{' '}
              <span className="font-semibold text-indigo-600">intuitive</span>.
            </fbt>
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              asChild
              className="transition-background bg-gradient-to-r from-blue-600 to-sky-600 duration-200 hover:from-blue-500 hover:to-sky-500"
              size="lg"
            >
              <Link
                className="flex items-center space-x-1"
                href="#getting-started"
              >
                <Rocket className="h-4 w-4" />
                <span>
                  <fbt desc="Get started button label">Get Started</fbt>
                </span>
              </Link>
            </Button>
            <Button
              asChild
              className="hover:text-blue-600 dark:hover:text-blue-400"
              size="lg"
              variant="outline"
            >
              <Link href="https://github.com/nkzw-tech/fbtee" target="_blank">
                <Github className="h-4 w-4" />
                <span>
                  <fbt desc="Button label">View on GitHub</fbt>
                </span>
              </Link>
            </Button>
            <LocaleSwitcher />
          </div>
        </div>
      </section>
      <section className="px-4 py-8">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-8 text-center">
            <H2 className="mb-4 text-3xl">
              <fbt desc="Headline">
                <span className="font-bold">fbtee</span> Features
              </fbt>
            </H2>
            <p className="mx-auto max-w-2xl">
              <fbt desc="Tagline">
                The core pieces you need to localize modern JavaScript and React
                apps.
              </fbt>
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-slate-100 shadow transition-all hover:border-slate-200 hover:shadow-lg">
              <CardHeader>
                <div className="squircle mb-2 flex h-12 w-12 items-center justify-center bg-gradient-to-br from-slate-500 to-indigo-500 transition-transform duration-200">
                  <CodeIcon className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">
                  <fbt desc="Headline">Inline Translations</fbt>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  <fbt desc="Inline translations description">
                    Write translatable text inline. No translation keys or t()
                    wrappers; the compiler extracts strings for translation
                    providers.
                  </fbt>
                </p>
              </CardContent>
            </Card>
            <Card className="border-indigo-100 shadow transition-all hover:border-indigo-200 hover:shadow-lg">
              <CardHeader>
                <div className="squircle mb-2 flex h-12 w-12 items-center justify-center bg-gradient-to-br from-indigo-500 to-blue-500 transition-transform duration-200">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">
                  <fbt desc="Headline">Proven in Production</fbt>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  <fbt desc="Proven in production description">
                    Built on Facebook&apos;s fbt, with over a decade of
                    production usage serving billions of users, plus years in
                    production at Athena Crisis.
                  </fbt>
                </p>
              </CardContent>
            </Card>
            <Card className="border-blue-100 shadow transition-all hover:border-blue-200 hover:shadow-lg">
              <CardHeader>
                <div className="squircle mb-2 flex h-12 w-12 items-center justify-center bg-gradient-to-br from-blue-500 to-purple-500 transition-transform duration-200">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">
                  <fbt desc="Headline">Optimized Performance</fbt>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  <fbt desc="Optimized performance description">
                    Compiles translations into an Intermediate Representation
                    (IR) for extraction, then optimizes the runtime output for
                    performance.
                  </fbt>
                </p>
              </CardContent>
            </Card>
            <Card className="border-purple-100 shadow transition-all hover:border-purple-200 hover:shadow-lg">
              <CardHeader>
                <div className="squircle mb-2 flex h-12 w-12 items-center justify-center bg-gradient-to-br from-purple-500 to-slate-500 transition-transform duration-200">
                  <Rocket className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">
                  <fbt desc="Headline">Easy Setup</fbt>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  <fbt desc="Easy setup description">
                    Quick integration with Babel, SWC, Vite, Next.js, and Expo.
                  </fbt>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      <section className="px-4 py-8">
        <div className="container mx-auto max-w-2xl">
          <H2 className="mb-4 text-center">
            <fbt desc="Headline">
              <span className="font-bold">fbtee</span> in Action
            </fbt>
          </H2>
          <Code
            code={`const WelcomeMessage = ({ messageCount, user }) => (
  <div>
    <fbt desc="Welcome message with user component">
      Welcome back, <UserWithAvatar user={user} />!
      You have <fbt:plural
        count={messageCount}
        many="messages"
        name="messageCount"
        showCount="ifMany"
      >
        one message
      </fbt:plural>.
    </fbt>
  </div>
);`}
          />
        </div>
      </section>
      <section
        className="bg-gradient-to-br from-blue-50/50 to-sky-50/50 px-4 py-8 dark:from-blue-950/10 dark:to-sky-950/10"
        id="getting-started"
      >
        <div className="container mx-auto max-w-4xl">
          <div className="mb-8 text-center">
            <H2 className="mb-4 text-center">
              <fbt desc="Headline">Getting Started</fbt>
            </H2>
            <p className="">
              <fbt desc="Getting started description">
                Use a template for a new app, or install the runtime in an
                existing app.
              </fbt>
            </p>
          </div>

          <div className="space-y-12">
            <div>
              <div className="mb-6 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-sky-500">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-2xl">
                  <fbt desc="Headline">Quick Start Templates</fbt>
                </h3>
              </div>
              <p className="mb-6">
                <fbt desc="Quick start templates description">
                  These templates come with{' '}
                  <span className="font-bold">fbtee</span> configured:
                </fbt>
              </p>
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="group border-blue-200 shadow transition-all hover:border-blue-300 hover:shadow-lg">
                  <CardHeader>
                    <div className="flex items-center space-x-2">
                      <Globe className="h-5 w-5 text-blue-600" />
                      <CardTitle className="text-lg">
                        <fbt desc="Headline">Web App Template</fbt>
                      </CardTitle>
                    </div>
                    <CardDescription>
                      <fbt desc="Web app template description">
                        Vite and React app setup
                      </fbt>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      asChild
                      className="transition-background border-blue-200 bg-transparent duration-200 hover:bg-blue-50 dark:hover:bg-blue-900"
                      size="sm"
                      variant="outline"
                    >
                      <Link
                        href="https://github.com/nkzw-tech/web-app-template"
                        target="_blank"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span>
                          <fbt desc="Use template link">Use Template</fbt>
                        </span>
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
                <Card className="group border-sky-200 shadow transition-all hover:border-sky-300 hover:shadow-lg">
                  <CardHeader>
                    <div className="flex items-center space-x-2">
                      <Users className="h-5 w-5 text-sky-600" />
                      <CardTitle className="text-lg">
                        <fbt desc="Headline">Expo App Template</fbt>
                      </CardTitle>
                    </div>
                    <CardDescription>
                      <fbt desc="Expo app template description">
                        React Native and Expo app setup
                      </fbt>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      asChild
                      className="transition-background border-sky-200 bg-transparent duration-200 hover:bg-sky-50 dark:hover:bg-sky-900"
                      size="sm"
                      variant="outline"
                    >
                      <Link
                        href="https://github.com/nkzw-tech/expo-app-template"
                        target="_blank"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span>
                          <fbt desc="Use template link">Use Template</fbt>
                        </span>
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
            <Separator />

            <div>
              <div className="mb-6 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-blue-500">
                  <Terminal className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-2xl">
                  <fbt desc="Headline">Manual Installation</fbt>
                </h3>
              </div>
              <div className="squircle mb-4 bg-gradient-to-r from-blue-500 to-sky-500 p-6 text-white dark:from-blue-600 dark:to-sky-600">
                <p className="mb-4 text-slate-200">
                  <fbt desc="Manual installation description">
                    <strong>Requirements:</strong> Node 22+, React 19+ (if using
                    React)
                  </fbt>
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center space-x-2">
                    <code className="text-slate-200">$</code>
                    <code>npm install fbtee</code>
                  </div>
                  <div className="flex items-center space-x-2">
                    <code className="text-slate-200">$</code>
                    <code>
                      {
                        'npm install -D @nkzw/babel-preset-fbtee @rolldown/plugin-babel'
                      }
                    </code>
                  </div>
                  <div className="flex items-center space-x-2">
                    <code className="text-slate-200">$</code>
                    <code>
                      npm install -D @nkzw/swc-plugin-fbtee @nkzw/fbtee-cli
                    </code>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-6 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-emerald-500">
                  <Settings className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-2xl">
                  <fbt desc="Headline">Framework Setup</fbt>
                </h3>
              </div>

              <Tabs className="w-full" defaultValue="vite">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="vite">Vite</TabsTrigger>
                  <TabsTrigger value="swc">
                    <fbt desc="Framework setup tab">SWC</fbt>
                  </TabsTrigger>
                  <TabsTrigger value="nextjs">Next.js</TabsTrigger>
                  <TabsTrigger value="babel">Babel</TabsTrigger>
                </TabsList>
                <TabsContent className="space-y-4" value="vite">
                  <p className="">
                    <fbt desc="Vite setup instructions">
                      Use the Rolldown Babel plugin with Vite and the React
                      plugin:
                    </fbt>
                  </p>
                  <Code
                    code={`import fbteePreset from '@nkzw/babel-preset-fbtee';
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
});`}
                  />
                </TabsContent>
                <TabsContent className="space-y-4" value="swc">
                  <p className="">
                    <fbt desc="SWC setup instructions">
                      Use the SWC plugin to compile app code. Use fbtee collect
                      to extract phrases.
                    </fbt>
                  </p>
                  <Code
                    code={`export default {
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
};`}
                  />
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    <fbt desc="SWC collect note">
                      Do not pass collectFbt: true to the SWC plugin.
                    </fbt>
                  </p>
                </TabsContent>
                <TabsContent className="space-y-4" value="nextjs">
                  <p className="">
                    <fbt desc="Next.js setup instructions">
                      With Next.js and Babel, create a babel.config.js file in
                      your project root:
                    </fbt>
                  </p>
                  <Code
                    code={`export default {
  presets: ['next/babel', '@nkzw/babel-preset-fbtee'],
};`}
                  />
                  <div className="squircle border border-blue-200 bg-blue-50 p-4 dark:bg-blue-900">
                    <p className="text-sm text-blue-800 dark:text-blue-50">
                      <fbt desc="Next.js tip">
                        <strong>Next.js Tip:</strong> Check out the{' '}
                        <Link
                          className="underline"
                          href="https://github.com/cpojer/nextjs-fbtee-example"
                          target="_blank"
                        >
                          Next.js App fbtee Example
                        </Link>{' '}
                        for a complete setup with App Router and Server
                        Components.
                      </fbt>
                    </p>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    <fbt desc="Next.js SWC plugin note">
                      For Turbopack, configure @nkzw/swc-plugin-fbtee through
                      the Next.js SWC plugin list instead of using Babel.
                    </fbt>
                  </p>
                </TabsContent>
                <TabsContent className="space-y-4" value="babel">
                  <p className="">
                    <fbt desc="Babel setup instructions">
                      With a direct Babel setup, add the preset:
                    </fbt>
                  </p>
                  <Code
                    code={`export default {
  presets: ['@nkzw/babel-preset-fbtee'],
};`}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </section>
      <section className="px-4 py-8">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-8 text-center">
            <H2>
              <fbt desc="Headline">Usage Guide</fbt>
            </H2>
            <p className="">
              <fbt desc="Usage guide description">
                The main patterns for writing and shipping translated strings
                with <span className="font-bold">fbtee</span>.
              </fbt>
            </p>
          </div>

          <div className="space-y-12">
            <div>
              <div className="mb-6 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-blue-500">
                  <Globe className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-2xl">
                  <fbt desc="Headline">App Setup</fbt>
                </h3>
              </div>

              <p className="mb-6">
                <fbt desc="App setup description">
                  React TypeScript projects should include the JSX declarations
                  once in a global type file or app entry point:
                </fbt>
              </p>

              <Code code={`/// <reference types="fbtee/ReactTypes.d.ts" />`} />

              <p className="mb-4">
                <fbt desc="LocaleContext setup description">
                  Most React apps should use createLocaleContext:
                </fbt>
              </p>

              <Code
                code={`import { createLocaleContext } from 'fbtee';

// Define available languages
const availableLanguages = new Map([
  ['en_US', 'English'],
  ['de_DE', 'Deutsch'],
  ['ja_JP', '日本語'],
]);

const loadLocale = async (locale: string) => {
  switch (locale) {
    case 'de_DE':
      return (await import('./translations/de_DE.json')).default.de_DE;
    case 'ja_JP':
      return (await import('./translations/ja_JP.json')).default.ja_JP;
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
);`}
              />
              <Separator />
            </div>

            <div>
              <div className="mb-6 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-emerald-500">
                  <CodeIcon className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-2xl">
                  <fbt desc="Headline">Writing Strings</fbt>
                </h3>
              </div>

              <p className="mb-4">
                <fbt desc="Usage description">
                  Every user-facing string should be wrapped in{' '}
                  <code className="bg-muted rounded px-1">&lt;fbt&gt;</code>,{' '}
                  <code className="bg-muted rounded px-1">fbt()</code>, or{' '}
                  <code className="bg-muted rounded px-1">fbs()</code>.
                  Descriptions are required because they are the
                  translator&apos;s context.
                </fbt>
              </p>

              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="mb-2 font-semibold text-red-600 dark:text-red-400">
                    <fbt desc="Before example label">Before</fbt>
                  </h4>
                  <div className="squircle border border-red-200 bg-red-50 p-4 font-mono text-sm dark:bg-red-900">
                    <pre>{`const Greeting = () => (
  <div>Hello, World!</div>
);`}</pre>
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 font-semibold text-green-600 dark:text-green-400">
                    <fbt desc="After example label">After</fbt>
                  </h4>
                  <div className="squircle border border-green-200 bg-green-50 p-4 font-mono text-sm dark:bg-green-900">
                    <pre>{`const Greeting = () => (
  <div>
    <fbt desc="Greeting">
      Hello, World!
    </fbt>
  </div>
);`}</pre>
                  </div>
                </div>
              </div>

              <div className="squircle mt-4 border border-sky-200 bg-sky-50 p-4 dark:bg-sky-900">
                <p className="text-sm text-sky-800 dark:text-sky-50">
                  <fbt desc="Usage note">
                    <code>&lt;fbt&gt;</code> is auto-imported by the fbtee
                    compiler integration. Use fbt() outside JSX.
                  </fbt>
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <div className="mb-6 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-indigo-500">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-2xl">
                  <fbt desc="Headline">Dynamic Content</fbt>
                </h3>
              </div>

              <p className="mb-4">
                <fbt desc="Dynamic content description">
                  Use{' '}
                  <code className="bg-muted rounded px-1">
                    &lt;fbt:param&gt;
                  </code>{' '}
                  for dynamic values. Token names should describe the value, not
                  its current English position.
                </fbt>
              </p>

              <Tabs className="w-full" defaultValue="param">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="param">
                    <fbt desc="Tab label">Parameters</fbt>
                  </TabsTrigger>
                  <TabsTrigger value="components">
                    <fbt desc="Tab label">Components</fbt>
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="param">
                  <Code
                    code={`const UserGreeting = ({ name, score }) => (
  <div>
    <fbt desc="User greeting with score">
      Hello, <fbt:param name="userName">{name}</fbt:param>!
      You have <fbt:param name="userScore">{score}</fbt:param> points.
    </fbt>
  </div>
);`}
                  />
                </TabsContent>
                <TabsContent value="components">
                  <div className="mb-2">
                    <fbt desc="Components explanation">
                      React elements inside <code>&lt;fbt&gt;</code> are
                      automatically turned into implicit params:
                    </fbt>
                  </div>
                  <Code
                    code={`const WelcomeMessage = ({ user }) => (
  <div>
    <fbt desc="Welcome message with user component">
      Welcome back, <UserWithAvatar user={user} />!
      Check out your <Link href="/dashboard">dashboard</Link>.
    </fbt>
  </div>
);`}
                  />
                </TabsContent>
              </Tabs>
              <div className="squircle mt-4 border border-sky-200 bg-sky-50 p-4 dark:bg-sky-900">
                <p className="text-sm text-sky-800 dark:text-sky-50">
                  <fbt desc="Same param note">
                    Use fbt.sameParam() or &lt;fbt:same-param&gt; when the same
                    token appears more than once.
                  </fbt>
                </p>
              </div>
              <Separator />
            </div>

            <div>
              <div className="mb-6 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-sky-500">
                  <Users className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-2xl">
                  <fbt desc="Headline">Lists</fbt>
                </h3>
              </div>

              <p className="mb-4">
                <fbt desc="Lists description">
                  <code className="bg-muted rounded px-1">
                    &lt;fbt:list&gt;
                  </code>{' '}
                  builds locale-aware lists:
                </fbt>
              </p>

              <Code
                code={`<fbt desc="People assigned to a task">
  Assigned to <fbt:list items={assignees} name="assigneeList" />.
</fbt>
`}
              />

              <p className="mb-4">
                <fbt desc="List function description">
                  The standalone list() helper is available for non-React code:
                </fbt>
              </p>

              <Code
                code={`import { list } from 'fbtee';

const userList = list(['Alice', 'Bob', 'Charlie'], 'or', 'comma');
// "Alice, Bob, or Charlie"`}
              />
              <Separator />
            </div>

            <div>
              <div className="mb-6 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-500">
                  <Languages className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-2xl">
                  <fbt desc="Headline">Plurals</fbt>
                </h3>
              </div>

              <p className="mb-4">
                <fbt desc="Pluralization description">
                  Use{' '}
                  <code className="bg-muted rounded px-1">
                    &lt;fbt:plural&gt;
                  </code>
                  when a count controls grammar. fbtee handles locale-specific
                  plural rules.
                </fbt>
              </p>

              <Code
                code={`<fbt desc="Inbox unread count">
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

// showCount can be "yes", "ifMany", or "no".`}
              />

              <Separator />
            </div>

            <div>
              <div className="mb-6 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-blue-500">
                  <Users className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-2xl">
                  <fbt desc="Headline">Enums</fbt>
                </h3>
              </div>

              <p className="mb-4">
                <fbt desc="Enums description">
                  Use enums when runtime values map to a fixed set of
                  translatable labels:
                </fbt>
              </p>

              <Code
                code={`const StatusLabels = {
  done: 'done',
  open: 'open',
};

<fbt desc="Task status label">
  This task is <fbt:enum enum-range={StatusLabels} value={status} />.
</fbt>;`}
              />
              <p className="mb-4">
                <fbt desc="Enum module note">
                  For shared enum modules, use the $FbtEnum suffix so the
                  collector can resolve them.
                </fbt>
              </p>
              <Separator />
            </div>

            <div>
              <div className="mb-6 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-blue-500">
                  <Users className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-2xl">
                  <fbt desc="Headline">Pronouns and Gender</fbt>
                </h3>
              </div>

              <p className="mb-4">
                <fbt desc="Pronouns description">
                  Use{' '}
                  <code className="bg-muted rounded px-1">
                    &lt;fbt:pronoun&gt;
                  </code>
                  when a phrase depends on a person&apos;s gender:
                </fbt>
              </p>

              <Code
                code={`<fbt desc="Photo sharing notification">
  <fbt:param name="name">{user.name}</fbt:param>
  shared{' '}
  <fbt:pronoun gender={user.gender} human type="possessive" /> photo.
</fbt>

// Supported pronoun types are "subject", "object", "possessive", and "reflexive".`}
              />
              <Separator />
            </div>

            <div>
              <div className="mb-6 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-teal-500 to-green-500">
                  <FileText className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-2xl">
                  <fbt desc="Headline">Common Strings</fbt>
                </h3>
              </div>

              <p className="mb-4">
                <fbt desc="Common strings description">
                  Common strings are reusable source strings with shared
                  descriptions:
                </fbt>
              </p>

              <Code
                code={`<fbt common>Save</fbt>

// Pass common strings to the compiler:
{
  fbtCommon: {
    Save: 'Button label for saving changes',
  },
}`}
              />
              <Separator />
            </div>

            <div>
              <div className="mb-6 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-teal-500 to-green-500">
                  <FileText className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-2xl">
                  <fbt desc="Headline">Plain Strings</fbt>
                </h3>
              </div>

              <p className="mb-4">
                <fbt desc="Plain text usage description">
                  Use <code className="bg-muted rounded px-1">fbs()</code> when
                  you need a plain string, such as in HTML attributes:
                </fbt>
              </p>

              <Code
                code={`import { fbs } from 'fbtee';

<input
  type="text"
  placeholder={fbs('Enter your name', 'Placeholder for name input')}
/>

<button
  title={fbs('Click to save', 'Save button tooltip')}
  aria-label={fbs('Save document', 'Save button accessibility label')}
>
  Save
</button>`}
              />
              <Separator />
            </div>

            <div>
              <div className="mb-6 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-blue-500">
                  <Terminal className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-2xl">
                  <fbt desc="Headline">Translation Workflow</fbt>
                </h3>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="mb-2 font-semibold">
                    <fbt desc="Step number and description">
                      1. Extract Strings
                    </fbt>
                  </h4>
                  <div className="squircle mb-4 bg-gradient-to-r from-blue-500 to-sky-500 p-6 text-white dark:from-blue-600 dark:to-sky-600">
                    <code>
                      <code className="text-slate-200">$</code> pnpm fbtee
                      collect
                    </code>
                  </div>
                  <p className="mt-2">
                    <fbt desc="Extract strings explanation">
                      This writes <code>source_strings.json</code>.
                    </fbt>
                  </p>
                </div>

                <div>
                  <h4 className="mb-2 font-semibold">
                    <fbt desc="Step number and description">
                      2. Prepare Editable Translation Files
                    </fbt>
                  </h4>
                  <p className="mb-2">
                    <fbt desc="Translation files instructions">
                      Prepare editable locale files from the current source
                      strings:
                    </fbt>
                  </p>
                  <Code
                    code={`pnpm fbtee prepare-translations --source-strings source_strings.json --output-dir translations --locales de_DE fr_FR ja_JP`}
                  />
                  <p className="mt-2">
                    <fbt desc="Prepare translations explanation">
                      prepare-translations keeps existing translations, adds
                      missing entries, and marks new work with{' '}
                      <code>&quot;status&quot;: &quot;new&quot;</code>.
                    </fbt>
                  </p>
                </div>

                <div>
                  <h4 className="mb-2 font-semibold">
                    <fbt desc="Step number and description">
                      3. Translating Strings with Coding Agents
                    </fbt>
                  </h4>
                  <p className="mb-2">
                    <fbt desc="Coding agent translation explanation">
                      Coding agents work well on fbtee translation files because
                      the app context, existing translations, and product
                      vocabulary are in the repository.
                    </fbt>
                  </p>
                  <h5 className="mb-2 font-semibold">
                    <fbt desc="Coding agent prompt heading">
                      Coding Agent prompt:
                    </fbt>
                  </h5>
                  <Code
                    code={`Run \`fbtee prepare-translations --source-strings source_strings.json --output-dir ares/translations --locales de_DE fr_FR ja_JP pl_PL ru_RU zh_CN es_ES it_IT ko_KR pt_BR uk_UA\` for all the translations the app supports.

Look at all updated translation files. For every entry with \`"status": "new"\`, write a translation that matches the tone, voice, and language already used in the app and in the current locale.

Remove \`"status": "new"\` from each completed translation entry.`}
                  />
                </div>

                <div>
                  <h4 className="mb-2 font-semibold">
                    <fbt desc="Step number and description">
                      4. Compile Translations
                    </fbt>
                  </h4>
                  <div className="squircle mb-4 bg-gradient-to-r from-blue-500 to-sky-500 p-6 text-white dark:from-blue-600 dark:to-sky-600">
                    <code>
                      <code className="text-slate-200">$</code> pnpm fbtee
                      translate --source-strings source_strings.json
                      --translations &apos;translations/*.json&apos;
                      --output-dir src/translations
                    </code>
                  </div>
                  <p className="mt-2">
                    <fbt desc="Compile translations explanation">
                      This generates optimized runtime files in{' '}
                      <code>src/translations/</code>.
                    </fbt>
                  </p>
                </div>

                <div>
                  <h4 className="mb-2 font-semibold">
                    <fbt desc="Step number and description">
                      5. Ignore Generated Runtime Output
                    </fbt>
                  </h4>
                  <Code
                    code={`.enum_manifest.json
source_strings.json
src/translations/`}
                  />
                </div>
              </div>
              <Separator />
            </div>

            <div>
              <div className="mb-6 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-emerald-500">
                  <Globe className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-2xl">
                  <fbt desc="Headline">Locale Management</fbt>
                </h3>
              </div>

              <p className="mb-4">
                <fbt desc="Locale management description">
                  Use <code>useLocaleContext</code> to read or change the
                  locale:
                </fbt>
              </p>

              <Code
                code={`import { useLocaleContext } from 'fbtee';

const LanguageButton = () => {
  const { locale, setLocale } = useLocaleContext();

  return <button onClick={() => setLocale('de_DE')}>{locale}</button>;
};`}
              />
              <Separator />
            </div>

            <div>
              <div className="mb-6 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-500">
                  <Shield className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-2xl">
                  <fbt desc="Headline">ESLint Plugin</fbt>
                </h3>
              </div>

              <p className="mb-4">
                <fbt desc="ESLint plugin description">
                  Install the optional ESLint plugin:
                </fbt>
              </p>

              <div className="squircle mb-4 bg-gradient-to-r from-blue-500 to-sky-500 p-6 text-white dark:from-blue-600 dark:to-sky-600">
                <code>
                  <code className="text-slate-200">$</code> npm install -D
                  @nkzw/eslint-plugin-fbtee
                </code>
              </div>

              <Tabs className="w-full" defaultValue="recommended">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="recommended">
                    <fbt desc="Tab label">Recommended</fbt>
                  </TabsTrigger>
                  <TabsTrigger value="strict">
                    <fbt desc="Tab label">Strict</fbt>
                  </TabsTrigger>
                  <TabsTrigger value="custom">
                    <fbt desc="Tab label">Custom</fbt>
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="recommended">
                  <Code
                    code={`import fbtee from '@nkzw/eslint-plugin-fbtee';

export default [fbtee.configs.recommended];`}
                  />
                </TabsContent>
                <TabsContent value="strict">
                  <div className="mb-2">
                    <fbt desc="Strict configuration description">
                      Use the strict config if you want every user-facing string
                      to be wrapped.
                    </fbt>
                  </div>
                  <Code
                    code={`import fbtee from '@nkzw/eslint-plugin-fbtee';

export default [fbtee.configs.strict];`}
                  />
                </TabsContent>
                <TabsContent value="custom">
                  <Code
                    code={`import fbtee from '@nkzw/eslint-plugin-fbtee';

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
];`}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t bg-gradient-to-br from-sky-50 to-blue-50 px-4 py-8 dark:from-sky-950/20 dark:to-blue-950/20">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-8 text-center">
            <H2 className="mb-4">
              <fbt desc="Headline">Migration from fbt</fbt>
            </H2>
            <p className="">
              <fbt desc="Better about fbtee description">
                fbtee keeps the core fbt programming model and modernizes the
                toolchain around it.
              </fbt>
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-6">
              <div className="flex items-start space-x-3">
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-emerald-500">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-emerald-600">
                    <fbt desc="Feature title">Modern Compiler Packages</fbt>
                  </h4>
                  <p className="text-sm">
                    <fbt desc="Easier setup description">
                      Replace legacy fbt packages with fbtee and the matching
                      Babel or SWC compiler package.
                    </fbt>
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-indigo-500">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-indigo-600">
                    <fbt desc="Feature title">TypeScript and ESM</fbt>
                  </h4>
                  <p className="text-sm">
                    <fbt desc="Statically typed description">
                      Use TypeScript JSX declarations and modern ESM modules for
                      app code, common strings, and enums.
                    </fbt>
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-500">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-purple-600">
                    <fbt desc="Feature title">Modern React Support</fbt>
                  </h4>
                  <p className="text-sm">
                    <fbt desc="React compatibility description">
                      Works with React 19, fragments, Server Components, and
                      current JSX patterns.
                    </fbt>
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="flex items-start space-x-3">
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-sky-500">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-sky-600">
                    <fbt desc="Feature title">Current CLI Workflow</fbt>
                  </h4>
                  <p className="text-sm">
                    <fbt desc="Enhanced features description">
                      Use fbtee collect, fbtee prepare-translations, and fbtee
                      translate for the full translation workflow.
                    </fbt>
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-blue-500">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-blue-600">
                    <fbt desc="Feature title">Runtime Setup</fbt>
                  </h4>
                  <p className="text-sm">
                    <fbt desc="Modernized codebase description">
                      Replace legacy setup calls with setupFbtee,
                      setupLocaleContext, or createLocaleContext.
                    </fbt>
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-emerald-500">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-emerald-600">
                    <fbt desc="Feature title">Clearer Errors</fbt>
                  </h4>
                  <p className="text-sm">
                    <fbt desc="Updated tooling description">
                      Archived fbt options were removed, and compiler errors
                      point to modern replacements when one exists.
                    </fbt>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t px-4 py-8">
        <div className="container mx-auto max-w-4xl">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="mb-4 flex items-center space-x-2">
                <div className="relative">
                  <Globe className="h-6 w-6 text-sky-500" />
                </div>
                <span className="bg-linear-to-r from-sky-500 to-blue-500 bg-clip-text text-xl font-semibold text-transparent">
                  fbtee
                </span>
              </div>
              <p className="text-sm italic">
                <fbt desc="Tagline">
                  Far Better Translations, Extended Edition
                </fbt>
              </p>
            </div>
            <div>
              <h3 className="mb-4 font-semibold text-blue-500">
                <fbt desc="Footer section title">Resources</fbt>
              </h3>
              <div className="space-y-2">
                <Link
                  className="block text-sm transition-colors hover:text-blue-600 dark:hover:text-blue-400"
                  href="https://github.com/nkzw-tech/fbtee"
                  target="_blank"
                >
                  GitHub
                </Link>
                <Link
                  className="block text-sm transition-colors hover:text-blue-600 dark:hover:text-blue-400"
                  href="https://github.com/cpojer/nextjs-fbtee-example"
                  target="_blank"
                >
                  <fbt desc="Link text">Next.js Example</fbt>
                </Link>
              </div>
            </div>
            <div>
              <h3 className="mb-4 font-semibold text-sky-500">
                <fbt desc="Footer section title">Templates</fbt>
              </h3>
              <div className="space-y-2">
                <Link
                  className="block text-sm transition-colors hover:text-sky-600"
                  href="https://github.com/nkzw-tech/web-app-template"
                  target="_blank"
                >
                  <fbt desc="Link text">Web App Template</fbt>
                </Link>
                <Link
                  className="block text-sm transition-colors hover:text-sky-600"
                  href="https://github.com/nkzw-tech/expo-app-template"
                  target="_blank"
                >
                  <fbt desc="Link text">Expo App Template</fbt>
                </Link>
              </div>
            </div>
            <div>
              <Link href="https://nakazawa.tech" target="_blank">
                <svg
                  height="42"
                  viewBox="100 300 900 600"
                  width="42"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <linearGradient
                      gradientUnits="userSpaceOnUse"
                      id="linear-gradient"
                      x1="771.22"
                      x2="451.18"
                      y1="808.32"
                      y2="856.73"
                    >
                      <stop offset="0" stopColor="#3d87f5" />
                      <stop offset=".53" stopColor="#a855f7" />
                      <stop offset="1" stopColor="#d946ef" />
                    </linearGradient>
                    <linearGradient
                      id="linear-gradient-2"
                      x1="362.58"
                      x2="752.54"
                      xlinkHref="#linear-gradient"
                      y1="285.94"
                      y2="205.26"
                    />
                    <linearGradient
                      id="linear-gradient-3"
                      x1="372.48"
                      x2="762.44"
                      xlinkHref="#linear-gradient"
                      y1="333.79"
                      y2="253.11"
                    />
                    <linearGradient
                      id="linear-gradient-4"
                      x1="363.56"
                      x2="753.52"
                      xlinkHref="#linear-gradient"
                      y1="290.67"
                      y2="209.99"
                    />
                    <linearGradient
                      id="linear-gradient-5"
                      x1="771.54"
                      x2="451.5"
                      xlinkHref="#linear-gradient"
                      y1="810.46"
                      y2="858.87"
                    />
                    <linearGradient
                      gradientUnits="userSpaceOnUse"
                      id="linear-gradient-6"
                      x1="860.16"
                      x2="860.16"
                      y1="749.93"
                      y2="313.74"
                    >
                      <stop offset="0" stopColor="#3d87f5" />
                      <stop offset=".53" stopColor="#a855f7" />
                      <stop offset="1" stopColor="#d946ef" />
                    </linearGradient>
                    <linearGradient
                      gradientUnits="userSpaceOnUse"
                      id="linear-gradient-7"
                      x1="224.24"
                      x2="224.24"
                      y1="786.73"
                      y2="396.02"
                    >
                      <stop offset="0" stopColor="#d946ef" />
                      <stop offset=".47" stopColor="#a855f7" />
                      <stop offset="1" stopColor="#3d87f5" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M678.76 833.83c-21.94 5.07-44.5 5.7-58.42-3.56-.29-11.52-12.1-29.46-27.47-33.44-16.47-4.02-31.46.04-41.28 10.98-4.19-18.82-45.33-47.27-76.16-9.59-21.69 34.1 55.89 112.64 158.7 99.35 30.44-4.72 55.27-13.24 75.53-24.12l-31.57-39.46c.23-.05.45-.11.68-.17Z"
                    fill="url(#linear-gradient)"
                    strokeWidth="0"
                  />
                  <path
                    d="M433.64 265.39c23.56-16.38 81.71-35.21 108.04-17.7-.41 10.82 15.03 29.3 26.7 32.5 16.01 3.91 30.22 1.08 40.29-9.53 2.19 14.11 42.88 43.62 73.86 8.18 20.44-26.27-54.32-109.48-154.25-96.56-80.24 12.44-120.52 52.02-140.05 91.01l15.58 19.46c9.38-11.84 19.5-20.17 29.83-27.35Z"
                    fill="url(#linear-gradient-2)"
                    strokeWidth="0"
                  />
                  <path
                    d="M491.37 323.73c10.41 9.79 39.18 11.47 38.95-10.94.23-10.3-11.82-27.14-50.99-26.12-23.07.9-42.66 12.24-58.35 27.53l13.41 16.74c17.57-11.33 49.78-13.99 56.98-7.21Z"
                    fill="url(#linear-gradient-3)"
                    strokeWidth="0"
                  />
                  <path
                    d="M332.41 709.93V364.65l150.44 188.03 49.59-61.98-179.11-223.68h-90.88v343.03c6.83 20.91 16.76 40.5 29.65 58.25 11.43 15.75 24.97 29.69 40.31 41.63ZM770.75 441.24V788.3l-158.8-198.31-49.64 62L741.3 875.7h99.41V487.84c-.76-.77-1.51-1.56-2.31-2.31-20.33-19.05-43.08-33.93-67.65-44.29Z"
                    fill="currentColor"
                    strokeWidth="0"
                  />
                  <path
                    d="M741.3 266.98 306.01 811.01c-4.81-1.19-9.58-2.59-13.19-4.13-7.85-2.79-24.79-12.74-24.79-12.74l-5.59-.88v82.39h90.88L840.7 267l-99.41-.02Z"
                    fill="currentColor"
                    strokeWidth="0"
                  />
                  <path
                    d="M665.23 205.89c8.22-8.39 39.91-19.57 66.91-3.1 15.71 9.85 13.72 25.11 9.38 31.41-7.14 12.24-32.37 16.41-41.64-13.05-1.94-7.46-21.86-16.61-34.65-15.27Z"
                    fill="url(#linear-gradient-4)"
                    strokeWidth="0"
                  />
                  <path
                    d="M492 873.24c-8.46 8.63-41.07 20.13-68.84 3.19-16.17-10.13-14.11-25.83-9.66-32.32 7.35-12.6 35.86-17.48 41.55 15.73 2 7.68 23.79 14.78 36.95 13.39Z"
                    fill="url(#linear-gradient-5)"
                    strokeWidth="0"
                  />
                  <path
                    d="M945.09 483.67c14.11-70.16-41.22-140.41-108.79-168.64-1.04-.44-2.09-.87-3.14-1.29l-15.38 19.21c77.25 21.75 108.43 100.86 106.42 116.79-19.93-27.68-25.54-40.89-85.51-75.49-13.28-6.73-27.01-12.11-40.98-16.23l-42.4 52.94c36 10.71 69.83 30.19 99.03 57.55 47.76 44.75 38.23 118.22 9.69 180.47v40.24c8.24-10.93 15.57-22.26 21.26-32.97 21.53-40.55 27.03-78.5 31.57-105.01 12.53 15.77 11.89 60.1.94 86.21-6.98 18.89-25.06 50.59-53.76 83.59v28.89c41.11-34.07 73-73.83 87.59-111.79 33.53-87.24-6.53-154.47-6.53-154.47Z"
                    fill="url(#linear-gradient-6)"
                    strokeWidth="0"
                  />
                  <path
                    d="M333.48 739.37c-69.13-45.45-107.28-121.99-105.36-206.64.36-16.02 4.32-30.62 11.02-43.85V375.09C192.78 410.64 178.89 455 178.89 455c-61.69 36.28-77.12 124.36-53.08 193.54 25.05 73.4 103.52 119.74 150.44 123.01 6.81 4.55 14.02 8.68 21.56 12.42l35.68-44.6Zm-180.72-79.68c-45.71-73.83-5.49-152.52 14.78-166.48-7.33 33.31-13.43 46.3.79 114.06 15.18 56.81 50.72 104.91 94.2 137.97-8.67-1.86-64.06-11.72-109.77-85.55Z"
                    fill="url(#linear-gradient-7)"
                    strokeWidth="0"
                  />
                </svg>
              </Link>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="flex flex-col items-center justify-between md:flex-row">
            <div className="mb-4 text-sm md:mb-0">
              <p>
                <fbt desc="Footer credit">
                  Originally created by Facebook • Maintained by{' '}
                  <Link
                    className="text-blue-500 hover:text-blue-600 dark:hover:text-blue-400"
                    href="https://nakazawa.tech"
                    target="_blank"
                  >
                    Nakazawa Tech
                  </Link>
                </fbt>
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Button asChild size="sm" variant="ghost">
                <Link
                  className="hover:text-blue-600 dark:hover:text-blue-400"
                  href="https://github.com/nkzw-tech/fbtee"
                  target="_blank"
                >
                  <Github className="mr-2 h-4 w-4" />
                  <fbt desc="Button label">Star on GitHub</fbt>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
