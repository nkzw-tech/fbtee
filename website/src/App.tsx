import { VStack } from '@nkzw/stack';
import { useLocaleContext } from 'fbtee';
import {
  ArrowRight,
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
        className="transition-background border-purple-200 bg-transparent duration-200 hover:border-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900"
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
        <VStack alignCenter center gap={12} padding={16}>
          {[...AvailableLanguages.entries()].map(([locale, name]) => (
            <Button
              asChild
              className={cx(
                'transition-background border-purple-200 bg-transparent duration-200 hover:border-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900',
                {
                  'bg-purple-100 dark:bg-purple-900': currentLocale === locale,
                },
              )}
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
              <Globe className="h-6 w-6 text-indigo-600" />
            </div>
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-xl font-bold text-transparent">
              fbtee
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <Button asChild size="sm" variant="ghost">
              <Link
                className="flex items-center space-x-1 hover:text-purple-600"
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
        <div className="absolute inset-0 bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 dark:from-purple-950/20 dark:via-pink-950/20 dark:to-indigo-950/20"></div>
        <div className="container relative mx-auto max-w-4xl text-center">
          <Badge
            className="mb-6 border-purple-200 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
            variant="secondary"
          >
            <Sparkles className="mr-1 h-3 w-3" />
            Far Better Translations, Extended Edition
          </Badge>
          <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              fbtee
            </span>
          </h1>
          <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-xl">
            <fbt desc="fbtee tagline">
              An internationalization framework for JavaScript & React designed
              to be{' '}
              <span className="font-semibold text-purple-600">powerful</span>,{' '}
              <span className="font-semibold text-indigo-600">flexible</span>,
              and{' '}
              <span className="font-semibold text-pink-600">intuitive</span>.
            </fbt>
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              asChild
              className="transition-background bg-gradient-to-r from-purple-600 to-pink-600 duration-200 hover:from-purple-700 hover:to-pink-700"
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
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              className="transition-background border-purple-200 bg-transparent duration-200 hover:border-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900"
              size="lg"
              variant="outline"
            >
              <Link
                className="flex items-center space-x-1"
                href="https://github.com/nkzw-tech/fbtee"
                target="_blank"
              >
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
            <h2 className="mb-4 text-3xl">
              <fbt desc="Headline">
                Why choose <span className="font-bold">fbtee</span>?
              </fbt>
            </h2>
            <p className="text-muted-foreground mx-auto max-w-2xl">
              <fbt desc="Tagline">
                Modern internationalization that scales with your application.
              </fbt>
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="group border-purple-100 shadow transition-all hover:border-purple-200 hover:shadow-lg">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 transition-transform duration-200 group-hover:scale-110">
                  <CodeIcon className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">
                  <fbt desc="Headline">Inline Translations</fbt>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  <fbt desc="Inline translations description">
                    Embed translations directly into your code. No need to
                    manage translation keys or wrap your code with t()
                    functions.
                  </fbt>
                </p>
              </CardContent>
            </Card>
            <Card className="group border-indigo-100 shadow transition-all hover:border-indigo-200 hover:shadow-lg">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-blue-500 transition-transform duration-200 group-hover:scale-110">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">
                  <fbt desc="Headline">Proven in Production</fbt>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  <fbt desc="Proven in production description">
                    Built on Facebook&apos;s fbt, with over a decade of
                    production usage, serving billions of users.
                  </fbt>
                </p>
              </CardContent>
            </Card>
            <Card className="group border-blue-100 shadow transition-all hover:border-blue-200 hover:shadow-lg">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-pink-500 transition-transform duration-200 group-hover:scale-110">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">
                  <fbt desc="Headline">Optimized Performance</fbt>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  <fbt desc="Optimized performance description">
                    Compiles translations into an Intermediate Representation
                    (IR) for extracting strings, then optimizes runtime output.
                  </fbt>
                </p>
              </CardContent>
            </Card>
            <Card className="group border-pink-100 shadow transition-all hover:border-pink-200 hover:shadow-lg">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-red-500 transition-transform duration-200 group-hover:scale-110">
                  <Rocket className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg">
                  <fbt desc="Headline">Easy Setup</fbt>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  <fbt desc="Easy setup description">
                    Quick integration with tools like Babel and Vite means you
                    can get started instantly.
                  </fbt>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      <section className="px-4 py-8">
        <div className="container mx-auto max-w-2xl">
          <div className="text-center">
            <h2 className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text pb-4 text-3xl font-bold text-transparent">
              <fbt desc="Headline">
                <span className="font-bold">fbtee</span> in Action
              </fbt>
            </h2>
          </div>
          <Code
            code={`const WelcomeMessage = ({ user }) => (
  <div>
    <fbt desc="Welcome message with user component">
      Welcome back, <UserWithAvatar user={user} />!
      You have <fbt:plural
        count={messageCount}
        many="messages"
        name="messageCount"
        showCount="yes"
      >
        one message
      </fbt:plural>.
      Check out your <Link href="/dashboard">dashboard</Link>.
    </fbt>
  </div>
);`}
          />
        </div>
      </section>
      <section
        className="bg-gradient-to-br from-purple-50/50 via-pink-50/50 to-indigo-50/50 px-4 py-8 dark:from-purple-950/10 dark:via-pink-950/10 dark:to-indigo-950/10"
        id="getting-started"
      >
        <div className="container mx-auto max-w-4xl">
          <div className="mb-8 text-center">
            <h2 className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text pb-4 text-3xl font-bold text-transparent">
              <fbt desc="Headline">Getting Started</fbt>
            </h2>
            <p className="text-muted-foreground">
              <fbt desc="Getting started description">
                Choose your preferred way to start with{' '}
                <span className="font-bold">fbtee</span>.
              </fbt>
            </p>
          </div>

          <div className="space-y-12">
            <div>
              <div className="mb-6 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-xl font-semibold">
                  <fbt desc="Headline">Quick Start Templates</fbt>
                </h3>
              </div>
              <p className="text-muted-foreground mb-6">
                <fbt desc="Quick start templates description">
                  Skip the setup hassle! These templates come with{' '}
                  <span className="font-bold">fbtee</span> pre-configured and
                  ready to go:
                </fbt>
              </p>
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="group border-purple-200 shadow transition-all hover:border-purple-300 hover:shadow-lg">
                  <CardHeader>
                    <div className="flex items-center space-x-2">
                      <Globe className="h-5 w-5 text-purple-600" />
                      <CardTitle className="text-lg">
                        <fbt desc="Headline">Web App Template</fbt>
                      </CardTitle>
                    </div>
                    <CardDescription>
                      <fbt desc="Web app template description">
                        Complete web application setup with Vite and React
                      </fbt>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      asChild
                      className="transition-background border-purple-200 bg-transparent duration-200 hover:bg-purple-50 dark:hover:bg-purple-900"
                      size="sm"
                      variant="outline"
                    >
                      <Link
                        className="flex items-center space-x-2"
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
                <Card className="group border-pink-200 shadow transition-all hover:border-pink-300 hover:shadow-lg">
                  <CardHeader>
                    <div className="flex items-center space-x-2">
                      <Users className="h-5 w-5 text-pink-600" />
                      <CardTitle className="text-lg">
                        <fbt desc="Headline">Expo App Template</fbt>
                      </CardTitle>
                    </div>
                    <CardDescription>
                      <fbt desc="Expo app template description">
                        React Native with Expo setup for mobile apps
                      </fbt>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      asChild
                      className="transition-background border-pink-200 bg-transparent duration-200 hover:bg-pink-50 dark:hover:bg-pink-900"
                      size="sm"
                      variant="outline"
                    >
                      <Link
                        className="flex items-center space-x-2"
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
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-purple-500">
                  <Terminal className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-xl font-semibold">
                  <fbt desc="Headline">Manual Installation</fbt>
                </h3>
              </div>
              <div className="mb-4 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 p-6 text-white">
                <p className="mb-4 text-purple-100">
                  <fbt desc="Manual installation description">
                    <strong>Requirements:</strong> Node 22+, React 19+ (if using
                    React)
                  </fbt>
                </p>
                <div className="space-y-2 font-mono text-sm">
                  <div className="flex items-center space-x-2">
                    <span className="text-purple-300">$</span>
                    <span>npm install fbtee</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-purple-300">$</span>
                    <span>npm install -D @nkzw/babel-preset-fbtee</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-6 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-green-500 to-teal-500">
                  <Settings className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-xl font-semibold">
                  <fbt desc="Headline">Framework Setup</fbt>
                </h3>
              </div>

              <Tabs className="w-full" defaultValue="vite">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="vite">Vite</TabsTrigger>
                  <TabsTrigger value="nextjs">Next.js</TabsTrigger>
                  <TabsTrigger value="babel">Babel</TabsTrigger>
                </TabsList>
                <TabsContent className="space-y-4" value="vite">
                  <p className="text-muted-foreground">
                    <fbt desc="Vite setup instructions">
                      Install the Vite React plugin and configure your
                      vite.config.ts:
                    </fbt>
                  </p>
                  <Code
                    code={`import fbteePreset from '@nkzw/babel-preset-fbtee';
import react from '@vitejs/plugin-react';

export default {
  plugins: [
    react({
      babel: {
        presets: [fbteePreset],
      },
    }),
  ],
};`}
                  />
                </TabsContent>
                <TabsContent className="space-y-4" value="nextjs">
                  <p className="text-muted-foreground">
                    <fbt desc="Next.js setup instructions">
                      Create a babel.config.js file in your project root:
                    </fbt>
                  </p>
                  <Code
                    code={`export default {
  presets: ['next/babel', '@nkzw/babel-preset-fbtee'],
};`}
                  />
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:bg-blue-900">
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
                </TabsContent>
                <TabsContent className="space-y-4" value="babel">
                  <p className="text-muted-foreground">
                    <fbt desc="Babel setup instructions">
                      For custom Babel setups, add the preset to your .babelrc
                      or babel.config.js:
                    </fbt>
                  </p>
                  <Code
                    code={`{
  "presets": ["@nkzw/babel-preset-fbtee"]
}`}
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
            <h2 className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text pb-4 text-3xl font-bold text-transparent">
              <fbt desc="Headline">Usage Guide</fbt>
            </h2>
            <p className="text-muted-foreground">
              <fbt desc="Usage guide description">
                Everything you need to know to use{' '}
                <span className="font-bold">fbtee</span> effectively.
              </fbt>
            </p>
          </div>

          <div className="space-y-12">
            <div>
              <div className="mb-6 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500">
                  <Globe className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-2xl font-semibold">
                  <fbt desc="Headline">App Setup</fbt>
                </h3>
              </div>

              <p className="text-muted-foreground mb-6">
                <fbt desc="App setup description">
                  Set up <span className="font-bold">fbtee</span>&apos;s runtime
                  to manage locales in your app. First, add TypeScript support:
                </fbt>
              </p>

              <Code
                code={`// In your main index.tsx or types.d.ts file:
/// <reference types="fbtee/ReactTypes.d.ts" />`}
              />

              <p className="text-muted-foreground mb-4">
                <fbt desc="LocaleContext setup description">
                  Then create a LocaleContext to manage translations:
                </fbt>
              </p>

              <Code
                code={`import { createLocaleContext } from 'fbtee';

// Define available languages
const availableLanguages = new Map([
  ['en_US', 'English'],
  ['ja_JP', '日本語 (Japanese)'],
  ['es_ES', 'Español'],
]);

// Get client locales (Web)
const clientLocales = [navigator.language, ...navigator.languages];

// Load translations for a locale
const loadLocale = async (locale: string) => {
  if (locale === 'ja_JP') {
    return (await import('./translations/ja_JP.json')).default.ja_JP;
  }
  if (locale === 'es_ES') {
    return (await import('./translations/es_ES.json')).default.es_ES;
  }
  return {}; // Default to empty for en_US
};

const LocaleContext = createLocaleContext({
  availableLanguages,
  clientLocales,
  loadLocale,
});

// Wrap your app
const App = () => (
  <LocaleContext>
    <YourAppContent />
  </LocaleContext>
);`}
              />
            </div>

            <Separator />

            <div>
              <div className="mb-6 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-green-500 to-teal-500">
                  <CodeIcon className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-2xl font-semibold">
                  <fbt desc="Headline">Usage</fbt>
                </h3>
              </div>

              <p className="text-muted-foreground mb-4">
                <fbt desc="Usage description">
                  All translatable strings must be wrapped with{' '}
                  <code className="bg-muted rounded px-1">&lt;fbt&gt;</code> or{' '}
                  <code className="bg-muted rounded px-1">fbt()</code>:
                </fbt>
              </p>

              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="mb-2 font-semibold text-red-600 dark:text-red-400">
                    <fbt desc="Before example label">Before</fbt>
                  </h4>
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 font-mono text-sm dark:bg-red-900">
                    <pre>{`const Greeting = () => (
  <div>Hello, World!</div>
);`}</pre>
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 font-semibold text-green-600 dark:text-green-400">
                    <fbt desc="After example label">After</fbt>
                  </h4>
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 font-mono text-sm dark:bg-green-900">
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

              <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-4 dark:bg-purple-900">
                <p className="text-sm text-purple-800 dark:text-purple-50">
                  <fbt desc="Usage note">
                    <strong>Note:</strong> The <code>desc</code> attribute is
                    required and provides context for translators.{' '}
                    <code>&lt;fbt&gt;</code> is auto-imported by the Babel
                    preset.
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
                <h3 className="text-2xl font-semibold">
                  <fbt desc="Headline">Dynamic Content</fbt>
                </h3>
              </div>

              <p className="text-muted-foreground mb-4">
                <fbt desc="Dynamic content description">
                  Use{' '}
                  <code className="bg-muted rounded px-1">
                    &lt;fbt:param&gt;
                  </code>{' '}
                  to insert variables and React components:
                </fbt>
              </p>

              <Tabs className="w-full" defaultValue="param">
                <TabsList>
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
                      React components are automatically converted to{' '}
                      <code>&lt;fbt:param&gt;</code>:
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
            </div>

            <Separator />

            <div>
              <div className="mb-6 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-red-500">
                  <Users className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-2xl font-semibold">
                  <fbt desc="Headline">Lists & Conjunctions</fbt>
                </h3>
              </div>

              <p className="text-muted-foreground mb-4">
                <fbt desc="Lists description">
                  <code className="bg-muted rounded px-1">
                    &lt;fbt:list&gt;
                  </code>{' '}
                  handles grammatical lists with proper conjunctions:
                </fbt>
              </p>

              <Code
                code={`<fbt desc="Players in game">
  <fbt:list
    items={['Alice', 'Bob', 'Charlie']}
    conjunction="and"
    delimiter="comma"
    name="playerList"
  /> joined the game.
</fbt>

// Output: "Alice, Bob, and Charlie joined the game."

// Available options:
// conjunction: "and" | "or" | "none"
// delimiter: "comma" | "semicolon" | "bullet"`}
              />

              <p className="text-muted-foreground mb-4">
                <fbt desc="List function description">
                  You can also use the list function outside React:
                </fbt>
              </p>

              <Code
                code={`import { list } from 'fbtee';

const userList = list(['Alice', 'Bob', 'Charlie'], 'or', 'comma');
// "Alice, Bob, or Charlie"`}
              />
            </div>

            <Separator />

            <div>
              <div className="mb-6 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-purple-500">
                  <Languages className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-2xl font-semibold">
                  <fbt desc="Headline">Pluralization</fbt>
                </h3>
              </div>

              <p className="text-muted-foreground mb-4">
                <fbt desc="Pluralization description">
                  Handle singular and plural forms with{' '}
                  <code className="bg-muted rounded px-1">
                    &lt;fbt:plural&gt;
                  </code>
                  :
                </fbt>
              </p>

              <Code
                code={`<fbt desc="Item count">
  You have
  <fbt:plural
    count={itemCount}
    many="items"
    name="itemCount"
    showCount="yes"
  >
    an item
  </fbt:plural>
  in your cart.
</fbt>

// count={1}: "You have 1 item in your cart."
// count={5}: "You have 5 items in your cart."

// showCount options:
// "yes" - always show count
// "no" - never show count  
// "ifMany" - only show count for plural`}
              />

              <Code
                code={`<fbt desc="Bot game confirmation">
  Do you want to play against
  <fbt:plural
    count={botCount}
    many="bots"
    name="numberOfBots"
    showCount="ifMany"
  >
    a bot
  </fbt:plural>?
</fbt>

// count={1}: "Do you want to play against a bot?"
// count={3}: "Do you want to play against 3 bots?"`}
              />
            </div>

            <Separator />

            <div>
              <div className="mb-6 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-blue-500">
                  <Users className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-2xl font-semibold">
                  <fbt desc="Headline">Pronouns</fbt>
                </h3>
              </div>

              <p className="text-muted-foreground mb-4">
                <fbt desc="Pronouns description">
                  Handle gendered pronouns with{' '}
                  <code className="bg-muted rounded px-1">
                    &lt;fbt:pronoun&gt;
                  </code>
                  :
                </fbt>
              </p>

              <Code
                code={`<fbt desc="Photo sharing text">
  <fbt:param name="name">{user.name}</fbt:param>
  shared
  <fbt:pronoun
    type="possessive"
    gender={user.pronounGender}
    human
  />
  photo with you.
</fbt>

// Types: "subject" | "object" | "possessive" | "reflexive"
// Gender: GENDER_MALE | GENDER_FEMALE | GENDER_UNKNOWN`}
              />
            </div>

            <Separator />

            <div>
              <div className="mb-6 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-teal-500 to-green-500">
                  <FileText className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-2xl font-semibold">
                  <fbt desc="Headline">Plain Text Usage</fbt>
                </h3>
              </div>

              <p className="text-muted-foreground mb-4">
                <fbt desc="Plain text usage description">
                  For non-JSX contexts like HTML attributes, use{' '}
                  <code className="bg-muted rounded px-1">fbs()</code>:
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
            </div>

            <Separator />

            <div>
              <div className="mb-6 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500">
                  <Terminal className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-2xl font-semibold">
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
                  <div className="mb-4 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-3 text-white">
                    <code>
                      <span className="text-purple-300">$</span> pnpm fbtee
                      collect
                    </code>
                  </div>
                  <p className="text-muted-foreground mt-2">
                    <fbt desc="Extract strings explanation">
                      Creates <code>source_strings.json</code> with all
                      translatable strings
                    </fbt>
                  </p>
                </div>

                <div>
                  <h4 className="mb-2 font-semibold">
                    <fbt desc="Step number and description">
                      2. Create Translation Files
                    </fbt>
                  </h4>
                  <p className="text-muted-foreground mb-2">
                    <fbt desc="Translation files instructions">
                      Upload
                      <code>source_strings.json</code> to your translation
                      service, or create files manually:
                    </fbt>
                  </p>
                  <Code
                    code={`echo '{"fb-locale": "ja_JP", "translations": {}}' > translations/ja_JP.json`}
                  />
                </div>

                <div>
                  <h4 className="mb-2 font-semibold">
                    <fbt desc="Step number and description">
                      3. Compile Translations
                    </fbt>
                  </h4>
                  <div className="mb-4 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-3 text-white">
                    <code>
                      <span className="text-purple-300">$</span> pnpm fbtee
                      translate
                    </code>
                  </div>
                  <p className="text-muted-foreground mt-2">
                    <fbt desc="Compile translations explanation">
                      Generates optimized translation files in{' '}
                      <code>src/translations/</code>
                    </fbt>
                  </p>
                </div>

                <div>
                  <h4 className="mb-2 font-semibold">
                    <fbt desc="Step number and description">
                      4. Add to .gitignore
                    </fbt>
                  </h4>
                  <Code
                    code={`.enum_manifest.json
source_strings.json
src/translations/`}
                  />
                </div>

                <div>
                  <h4 className="mb-2 font-semibold">
                    <fbt desc="Step number and description">
                      5. Custom Scripts (Optional)
                    </fbt>
                  </h4>
                  <p className="text-muted-foreground mb-2">
                    <fbt desc="Custom scripts instructions">
                      Add custom commands to package.json:
                    </fbt>
                  </p>
                  <Code
                    code={`{
  "scripts": {
    "fbtee:collect": "fbtee collect --src src",
    "fbtee:translate": "fbtee translate --translations translations/*.json -o src/translations/"
  }
}`}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <div className="mb-6 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-green-500 to-teal-500">
                  <Globe className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-2xl font-semibold">
                  <fbt desc="Headline">Locale Management</fbt>
                </h3>
              </div>

              <p className="text-muted-foreground mb-4">
                <fbt desc="Locale management description">
                  Access and change locales in your components:
                </fbt>
              </p>

              <Code
                code={`import { useLocaleContext } from 'fbtee';

const LocaleSwitcher = () => {
  const [, startTransition] = useTransition();
  const { locale, setLocale } = useLocaleContext();

  return (
    <div>
      <p>Current: {locale}</p>
      {Array.from(AvailableLanguages.entries()).map(([code, name]) => (
        <button
          key={code}
          onClick={() => startTransition(() => setLocale(code))}
          className={locale === code ? 'active' : ''}
        >
          {name}
        </button>
      ))}
    </div>
  );
};`}
              />
            </div>

            <Separator />

            <div>
              <div className="mb-6 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-pink-500">
                  <Shield className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-2xl font-semibold">
                  <fbt desc="Headline">ESLint Plugin</fbt>
                </h3>
              </div>

              <p className="text-muted-foreground mb-4">
                <fbt desc="ESLint plugin description">
                  Install the ESLint plugin to catch common mistakes:
                </fbt>
              </p>

              <div className="mb-4 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-3 text-white">
                <code>
                  <span className="text-purple-300">$</span> npm install -D
                  @nkzw/eslint-plugin-fbtee
                </code>
              </div>

              <Tabs className="w-full" defaultValue="recommended">
                <TabsList>
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
                    code={`{
  "extends": ["plugin:@nkzw/eslint-plugin-fbtee/recommended"],
  "plugins": ["@nkzw/eslint-plugin-fbtee"]
}`}
                  />
                </TabsContent>
                <TabsContent value="strict">
                  <div className="mb-2">
                    <fbt desc="Strict configuration description">
                      This configuration errors on every untranslated string.
                    </fbt>
                  </div>
                  <Code
                    code={`{
  "extends": ["plugin:@nkzw/eslint-plugin-fbtee/strict"],
  "plugins": ["@nkzw/eslint-plugin-fbtee"]
}`}
                  />
                </TabsContent>
                <TabsContent value="custom">
                  <Code
                    code={`{
  "plugins": ["@nkzw/eslint-plugin-fbtee"],
  "rules": {
    "@nkzw/fbtee/no-empty-strings": "error",
    "@nkzw/fbtee/no-unhelpful-desc": "error",
    "@nkzw/fbtee/no-untranslated-strings": "error"
  }
}`}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-purple-50/50 via-pink-50/50 to-indigo-50/50 px-4 py-8 dark:from-purple-950/10 dark:via-pink-950/10 dark:to-indigo-950/10">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-8 text-center">
            <h2 className="mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-3xl font-bold text-transparent">
              <fbt desc="Headline">What&apos;s Better About fbtee?</fbt>
            </h2>
            <p className="text-muted-foreground">
              <fbt desc="Better about fbtee description">
                Originally created by Facebook, rewritten from the ground up.
              </fbt>
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-6">
              <div className="flex items-start space-x-3">
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-green-500 to-emerald-500">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-green-700">
                    <fbt desc="Feature title">Easier Setup</fbt>
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    <fbt desc="Easier setup description">
                      Works seamlessly with modern tools like Vite, Next.js, and
                      Expo.
                    </fbt>
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-indigo-500">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-blue-700">
                    <fbt desc="Feature title">Statically Typed</fbt>
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    <fbt desc="Statically typed description">
                      Full TypeScript support with compiler validation and
                      ESLint plugin.
                    </fbt>
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-purple-700">
                    <fbt desc="Feature title">Improved React Compatibility</fbt>
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    <fbt desc="React compatibility description">
                      Support for React fragments, Server Components, and modern
                      patterns.
                    </fbt>
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="flex items-start space-x-3">
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-red-500">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-orange-700">
                    <fbt desc="Feature title">Enhanced Features</fbt>
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    <fbt desc="Enhanced features description">
                      Fixed and exported intlList as functional &lt;fbt:list&gt;
                      component.
                    </fbt>
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-teal-500 to-green-500">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-teal-700">
                    <fbt desc="Feature title">Modernized Codebase</fbt>
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    <fbt desc="Modernized codebase description">
                      Rewritten in TypeScript with ESM and modern JavaScript
                      standards.
                    </fbt>
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-purple-500">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-pink-700">
                    <fbt desc="Feature title">Updated Tooling</fbt>
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    <fbt desc="Updated tooling description">
                      Uses pnpm, Vite, and esbuild for faster, more efficient
                      development.
                    </fbt>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t bg-gradient-to-br from-purple-50/30 via-pink-50/30 to-indigo-50/30 px-4 py-8 dark:from-purple-950/10 dark:via-pink-950/10 dark:to-indigo-950/10">
        <div className="container mx-auto max-w-4xl">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="mb-4 flex items-center space-x-2">
                <Globe className="h-5 w-5 text-indigo-600" />
                <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text font-bold text-transparent">
                  fbtee
                </span>
              </div>
              <p className="text-muted-foreground text-sm italic">
                <fbt desc="Tagline">
                  Far Better Translations, Extended Edition
                </fbt>
              </p>
            </div>
            <div>
              <h3 className="mb-4 font-semibold text-purple-700">
                <fbt desc="Footer section title">Resources</fbt>
              </h3>
              <div className="space-y-2">
                <Link
                  className="text-muted-foreground block text-sm transition-colors hover:text-purple-600"
                  href="https://github.com/nkzw-tech/fbtee"
                  target="_blank"
                >
                  GitHub
                </Link>
                <Link
                  className="text-muted-foreground block text-sm transition-colors hover:text-purple-600"
                  href="https://github.com/cpojer/nextjs-fbtee-example"
                  target="_blank"
                >
                  <fbt desc="Link text">Next.js Example</fbt>
                </Link>
              </div>
            </div>
            <div>
              <h3 className="mb-4 font-semibold text-pink-700">
                <fbt desc="Footer section title">Templates</fbt>
              </h3>
              <div className="space-y-2">
                <Link
                  className="text-muted-foreground block text-sm transition-colors hover:text-pink-600"
                  href="https://github.com/nkzw-tech/web-app-template"
                  target="_blank"
                >
                  <fbt desc="Link text">Web App Template</fbt>
                </Link>
                <Link
                  className="text-muted-foreground block text-sm transition-colors hover:text-pink-600"
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
            <div className="text-muted-foreground mb-4 text-sm md:mb-0">
              <p>
                <fbt desc="Footer credit">
                  Originally created by Facebook • Maintained by{' '}
                  <Link
                    className="text-purple-600 hover:text-purple-700"
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
                  className="text-purple-600 hover:text-purple-700"
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
