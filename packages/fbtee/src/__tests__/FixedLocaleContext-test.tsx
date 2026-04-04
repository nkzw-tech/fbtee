/// <reference types="../../ReactTypes.d.ts" />

import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react';
import fbsInternal from '../fbs.tsx';
import fbtInternal from '../fbt.tsx';
import FixedLocaleContext from '../FixedLocaleContext.tsx';
import Hooks from '../Hooks.tsx';
import { setupFbtee } from '../index.tsx';
import IntlViewerContext from '../ViewerContext.tsx';

setupFbtee({
  hooks: {
    getViewerContext: () => IntlViewerContext,
  },
  translations: {
    de_DE: {
      hash1: 'Hallo Welt',
      hash2: 'Beispielsätze',
    },
    en_US: {},
    fr_FR: {
      hash1: 'Bonjour le monde',
      hash2: 'Exemples de phrases',
    },
  },
});

function HelloWorld() {
  // Simulates what the babel plugin generates:
  // 1. Call fbt.__locale() to get the override from context
  // 2. Pass it as 4th arg to fbt._()
  const __fbtLocaleOverride = fbtInternal.__locale?.() ?? null;
  return (
    <span>
      {fbtInternal
        ._(['Hello World', 'hash1'], null, { hk: 'hash1' }, __fbtLocaleOverride)
        .toString()}
    </span>
  );
}

function SentenceExamples() {
  const __fbtLocaleOverride = fbtInternal.__locale?.() ?? null;
  return (
    <span>
      {fbtInternal
        ._(
          ['Sentence Examples', 'hash2'],
          null,
          { hk: 'hash2' },
          __fbtLocaleOverride,
        )
        .toString()}
    </span>
  );
}

describe('FixedLocaleContext', () => {
  it('should render children in the fixed locale', () => {
    const { container } = render(
      <FixedLocaleContext locale="de_DE">
        <HelloWorld />
      </FixedLocaleContext>,
    );
    expect(container.textContent).toBe('Hallo Welt');
  });

  it('should not affect components outside the context', () => {
    const { container } = render(
      <div>
        <HelloWorld />
        <FixedLocaleContext locale="de_DE">
          <SentenceExamples />
        </FixedLocaleContext>
      </div>,
    );
    const spans = container.querySelectorAll('span');
    expect(spans[0].textContent).toBe('Hello World');
    expect(spans[1].textContent).toBe('Beispielsätze');
  });

  it('should support nested contexts (inner overrides outer)', () => {
    const { container } = render(
      <FixedLocaleContext locale="de_DE">
        <div>
          <HelloWorld />
          <FixedLocaleContext locale="fr_FR">
            <SentenceExamples />
          </FixedLocaleContext>
        </div>
      </FixedLocaleContext>,
    );
    const spans = container.querySelectorAll('span');
    expect(spans[0].textContent).toBe('Hallo Welt');
    expect(spans[1].textContent).toBe('Exemples de phrases');
  });

  it('should not affect the global viewer context', () => {
    render(
      <FixedLocaleContext locale="de_DE">
        <HelloWorld />
      </FixedLocaleContext>,
    );
    expect(Hooks.getViewerContext().locale).toBe('en_US');
  });

  it('should work with fbs calls', () => {
    function FbsComponent() {
      const __fbtLocaleOverride = fbsInternal.__locale?.() ?? null;
      return (
        <span>
          {fbsInternal
            ._(
              ['Hello World', 'hash1'],
              null,
              { hk: 'hash1' },
              __fbtLocaleOverride,
            )
            .toString()}
        </span>
      );
    }

    const { container } = render(
      <FixedLocaleContext locale="de_DE">
        <FbsComponent />
      </FixedLocaleContext>,
    );
    expect(container.textContent).toBe('Hallo Welt');
  });
});
