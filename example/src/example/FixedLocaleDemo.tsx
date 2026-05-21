/// <reference types="fbtee/ReactTypes" />
/* eslint-disable @nkzw/fbtee/no-untranslated-strings */

import { VStack } from '@nkzw/stack';
import { fbs, fbt, FixedLocaleContext, setupLocaleContext } from 'fbtee';
import { Suspense } from 'react';
import Locales from './Locales.tsx';

// Set up with ONLY en_US pre-loaded.
// All other locales will be loaded on demand by FixedLocaleContext
// using the registered loadLocale hook.
setupLocaleContext({
  availableLanguages: new Map(
    Object.keys(Locales).map(
      (locale) =>
        [locale, Locales[locale as keyof typeof Locales].displayName] as const,
    ),
  ),
  clientLocales: ['en_US'],
  loadLocale: async (locale: string) => {
    // Simulate network delay to make Suspense visible
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const mod = await import(`../translatedFbts/${locale}.json`);
    return mod.default[locale];
  },
});

// ============================================================
// Child components — standard <fbt>/<fbs>, no special imports
// ============================================================

function SimpleString() {
  return (
    <span>
      <fbt desc="header">Sentence Examples</fbt>
    </span>
  );
}

function FbsString() {
  return <span>{fbs('Sentence Examples', 'header')}</span>;
}

function FbtFunctionalCall() {
  const text = fbt('Sentence Examples', 'header');
  return <span>{text}</span>;
}

function MixedFbtAndFbs() {
  const label = fbs('Sentence Examples', 'header');
  return (
    <span>
      {label}
      {' — '}
      <fbt desc="header">Sentence Examples</fbt>
    </span>
  );
}

// ============================================================
// Test case display
// ============================================================

function TestCase({
  children,
  expect: expected,
  title,
}: {
  children: React.ReactNode;
  expect: string;
  title: string;
}) {
  return (
    <div style={{ borderBottom: '1px solid #ddd', padding: '12px 0' }}>
      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{title}</div>
      <div
        style={{
          display: 'grid',
          gap: '4px 16px',
          gridTemplateColumns: 'auto 1fr',
        }}
      >
        <span style={{ color: '#888' }}>Expected:</span>
        <span>{expected}</span>
        <span style={{ color: '#888' }}>Got:</span>
        <span style={{ background: '#f0f0ff', padding: '2px 6px' }}>
          {children}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// Main demo
// ============================================================

export default function FixedLocaleDemo() {
  return (
    <div
      className="example"
      style={{ margin: '20px auto', maxWidth: 700, width: '100%' }}
    >
      <div className="headline">
        <b>FixedLocaleContext</b> Demo
      </div>

      <VStack gap>
        <p style={{ color: '#666' }}>
          Only en_US is pre-loaded. All other locales are loaded on demand (with
          a 1s simulated delay). Watch for the &quot;Loading...&quot; fallback
          from Suspense.
        </p>

        <h2>Basic: fbt JSX in child component</h2>

        <TestCase
          expect="Beispielsätze"
          title="<fbt> inside FixedLocaleContext (de_DE) — loaded on demand"
        >
          <Suspense fallback={<em>Loading de_DE...</em>}>
            <FixedLocaleContext locale="de_DE">
              <SimpleString />
            </FixedLocaleContext>
          </Suspense>
        </TestCase>

        <TestCase
          expect="Exemples de phrases"
          title="<fbt> inside FixedLocaleContext (fr_FR) — loaded on demand"
        >
          <Suspense fallback={<em>Loading fr_FR...</em>}>
            <FixedLocaleContext locale="fr_FR">
              <SimpleString />
            </FixedLocaleContext>
          </Suspense>
        </TestCase>

        <TestCase
          expect="文例"
          title="<fbt> inside FixedLocaleContext (ja_JP) — loaded on demand"
        >
          <Suspense fallback={<em>Loading ja_JP...</em>}>
            <FixedLocaleContext locale="ja_JP">
              <SimpleString />
            </FixedLocaleContext>
          </Suspense>
        </TestCase>

        <TestCase
          expect="Sentence Examples"
          title="<fbt> WITHOUT FixedLocaleContext (global en_US)"
        >
          <SimpleString />
        </TestCase>

        <h2>fbs() support</h2>

        <TestCase
          expect="Beispielsätze"
          title="fbs() inside FixedLocaleContext (de_DE)"
        >
          <Suspense fallback={<em>Loading...</em>}>
            <FixedLocaleContext locale="de_DE">
              <FbsString />
            </FixedLocaleContext>
          </Suspense>
        </TestCase>

        <h2>Functional fbt() call</h2>

        <TestCase
          expect="Beispielsätze"
          title="fbt() functional call inside FixedLocaleContext (de_DE)"
        >
          <Suspense fallback={<em>Loading...</em>}>
            <FixedLocaleContext locale="de_DE">
              <FbtFunctionalCall />
            </FixedLocaleContext>
          </Suspense>
        </TestCase>

        <h2>Mixed fbt + fbs in same component</h2>

        <TestCase
          expect="Beispielsätze — Beispielsätze"
          title="Mixed fbs() + <fbt> in same component (de_DE)"
        >
          <Suspense fallback={<em>Loading...</em>}>
            <FixedLocaleContext locale="de_DE">
              <MixedFbtAndFbs />
            </FixedLocaleContext>
          </Suspense>
        </TestCase>

        <h2>Nested contexts</h2>

        <TestCase
          expect="Exemples de phrases"
          title="Inner FixedLocaleContext (fr_FR) overrides outer (de_DE)"
        >
          <Suspense fallback={<em>Loading...</em>}>
            <FixedLocaleContext locale="de_DE">
              <FixedLocaleContext locale="fr_FR">
                <SimpleString />
              </FixedLocaleContext>
            </FixedLocaleContext>
          </Suspense>
        </TestCase>

        <TestCase
          expect="Beispielsätze | Exemples de phrases"
          title="Sibling FixedLocaleContexts are independent"
        >
          <Suspense fallback={<em>Loading...</em>}>
            <span style={{ display: 'flex', gap: 8 }}>
              <FixedLocaleContext locale="de_DE">
                <SimpleString />
              </FixedLocaleContext>
              {' | '}
              <FixedLocaleContext locale="fr_FR">
                <SimpleString />
              </FixedLocaleContext>
            </span>
          </Suspense>
        </TestCase>

        <h2>All available locales (all loaded on demand)</h2>

        <Suspense fallback={<em>Loading all locales...</em>}>
          <div
            style={{
              display: 'grid',
              gap: '4px 16px',
              gridTemplateColumns: 'auto 1fr',
            }}
          >
            {(
              [
                'en_US',
                'de_DE',
                'fr_FR',
                'es_LA',
                'ja_JP',
                'ar_AR',
                'he_IL',
                'it_IT',
                'fb_HX',
              ] as const
            ).map((loc) => (
              <div key={loc} style={{ display: 'contents' }}>
                <b>{loc}</b>
                <FixedLocaleContext locale={loc}>
                  <SimpleString />
                </FixedLocaleContext>
              </div>
            ))}
          </div>
        </Suspense>
      </VStack>
    </div>
  );
}
