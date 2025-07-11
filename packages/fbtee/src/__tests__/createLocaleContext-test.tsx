import { expect, jest } from '@jest/globals';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useTransition } from 'react';
import getFbtResult from '../__mocks__/getFbtResult.tsx';
import createLocaleContext, {
  useLocaleContext,
} from '../createLocaleContext.tsx';
import setupLocaleContext, {
  TranslationPromise,
} from '../setupLocaleContext.tsx';

const availableLanguages = new Map([
  ['en_US', 'English'],
  ['de_AT', 'German'],
]);

const hooks = {
  getFbtResult,
} as const;

const Button = () => {
  const [, startTransition] = useTransition();
  const { locale, setLocale } = useLocaleContext();
  return (
    <button onClick={() => startTransition(() => setLocale('de_AT'))}>
      {locale}
    </button>
  );
};

const GenderButton = () => {
  const { gender, setGender } = useLocaleContext();
  return <button onClick={() => setGender('female')}>{gender}</button>;
};

const InvalidLocaleButton = () => {
  const [, startTransition] = useTransition();
  const { locale, setLocale } = useLocaleContext();
  return (
    <button onClick={() => startTransition(() => setLocale('pirate'))}>
      {locale}
    </button>
  );
};

test('locale context allows setting up a full fbtee context', async () => {
  const loadLocale = jest.fn(async (locale: string) => ({}));
  const LocaleContext = createLocaleContext({
    availableLanguages,
    clientLocales: ['en_US', 'de_AT'],
    fallbackLocale: 'en_US',
    hooks,
    loadLocale,
  });

  const { asFragment } = render(
    <LocaleContext>
      <Button />
    </LocaleContext>,
  );

  expect(asFragment()).toMatchInlineSnapshot(`
   <DocumentFragment>
     <button>
       en_US
     </button>
   </DocumentFragment>
  `);

  await act(async () => {
    fireEvent.click(screen.getByRole('button'));
  });
  await waitFor(() =>
    expect(screen.getByRole('button').textContent).toBe('de_AT'),
  );

  expect(asFragment()).toMatchInlineSnapshot(`
   <DocumentFragment>
     <button>
       de_AT
     </button>
   </DocumentFragment>
  `);
});

test('locale context does not allow setting invalid locales', async () => {
  const loadLocale = jest.fn(async (locale: string) => ({}));
  const LocaleContext = createLocaleContext({
    availableLanguages,
    clientLocales: ['en_US'],
    fallbackLocale: 'en_US',
    hooks,
    loadLocale,
  });

  const { asFragment } = render(
    <LocaleContext>
      <InvalidLocaleButton />
    </LocaleContext>,
  );

  await act(async () => {
    fireEvent.click(screen.getByRole('button'));
  });
  await waitFor(() =>
    expect(screen.getByRole('button').textContent).toBe('en_US'),
  );

  expect(asFragment()).toMatchInlineSnapshot(`
   <DocumentFragment>
     <button>
       en_US
     </button>
   </DocumentFragment>
  `);
});

test('loading locales mutates the translations object', async () => {
  const translations = { en_US: {} };
  const { getLocale, setLocale } = setupLocaleContext({
    availableLanguages: new Map([
      ['en_US', 'English'],
      ['de_AT', 'German'],
    ]),
    clientLocales: ['en_US', 'de_AT'],
    loadLocale: jest.fn(
      async (locale: string): TranslationPromise =>
        locale === 'de_AT'
          ? {
              Hey: 'Banane',
            }
          : {},
    ),
    translations,
  });

  expect(translations).toMatchInlineSnapshot(`
   {
     "en_US": {},
   }
  `);

  await act(async () => {
    await setLocale('de_AT');
  });

  expect(getLocale()).toBe('de_AT');
  expect(translations).toMatchInlineSnapshot(`
   {
     "de_AT": {
       "Hey": "Banane",
     },
     "en_US": {},
   }
  `);
});

test('the gender can be changed', async () => {
  const loadLocale = jest.fn(async (locale: string) => ({}));
  const LocaleContext = createLocaleContext({
    availableLanguages,
    clientLocales: ['en_US', 'de_AT'],
    gender: 'unknown',
    hooks,
    loadLocale,
  });

  const { asFragment } = render(
    <LocaleContext>
      <GenderButton />
    </LocaleContext>,
  );

  expect(asFragment()).toMatchInlineSnapshot(`
<DocumentFragment>
  <button>
    3
  </button>
</DocumentFragment>
`);

  await act(async () => {
    fireEvent.click(screen.getByRole('button'));
  });
  await waitFor(() => expect(screen.getByRole('button').textContent).toBe('2'));

  expect(asFragment()).toMatchInlineSnapshot(`
<DocumentFragment>
  <button>
    2
  </button>
</DocumentFragment>
`);
});
