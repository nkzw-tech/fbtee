import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ReactNode, Suspense, use, useState } from 'react';
import { createFbteeRuntime, fbt, FbtResult } from '../index-core.tsx';
import LocaleProvider, { useFbt } from '../LocaleProvider.tsx';
import setupFbtee from '../setupFbtee.tsx';

const german = createFbteeRuntime({ locale: 'de-DE', translations: { 'de-DE': {} } });
const french = createFbteeRuntime({ locale: 'fr-FR', translations: { 'fr-FR': {} } });

function Intermediary({ children }: { children: ReactNode }) {
  return <section>{children}</section>;
}

function Number({ wait = Promise.resolve() }: { wait?: Promise<void> }) {
  const { fbs, fbt, locale } = useFbt();
  const [saved, setSaved] = useState('');
  return (
    <article data-testid={locale}>
      <p>{fbs([fbs.param('number', '1234.5')], 'Plain number')}</p>
      <p>
        <fbt desc="Formatted number">
          <fbt:param name="number" number>
            {1234.5}
          </fbt:param>
        </fbt>
      </p>
      <button
        onClick={async () => {
          await wait;
          setSaved(String(fbt([fbt.param('number', 1234.5, { number: true })], 'Saved number')));
        }}
        type="button"
      >
        Save
      </button>
      <output>{saved}</output>
    </article>
  );
}

function Global() {
  return <aside>{fbt([fbt.param('number', 1234.5, { number: true })], 'Global number')}</aside>;
}

beforeEach(() => {
  setupFbtee({
    hooks: { getViewerContext: () => ({ GENDER: 3, locale: 'en-US' }) },
    translations: {},
  });
});

test('providers scope descendants, nested providers and independent roots without changing globals', () => {
  render(
    <LocaleProvider runtime={german}>
      <Intermediary>
        <Number />
        <LocaleProvider runtime={french}>
          <Number />
        </LocaleProvider>
        <Global />
      </Intermediary>
    </LocaleProvider>,
  );
  expect(within(screen.getByTestId('de-DE')).getByText('1.234,5')).toBeTruthy();
  expect(within(screen.getByTestId('fr-FR')).getByText('1 234,5')).toBeTruthy();
  expect(screen.getByText('1,234.5')).toBeTruthy();
  const second = render(
    <LocaleProvider runtime={german}>
      <Number />
    </LocaleProvider>,
  );
  expect(within(second.container).getByText('1.234,5')).toBeTruthy();
});

test('pending actions retain the captured runtime when the provider changes', async () => {
  const gate = Promise.withResolvers<void>();
  const { container, rerender } = render(
    <LocaleProvider runtime={german}>
      <Number wait={gate.promise} />
    </LocaleProvider>,
  );
  fireEvent.click(screen.getByRole('button'));
  rerender(
    <LocaleProvider runtime={french}>
      <Number wait={gate.promise} />
    </LocaleProvider>,
  );
  expect(screen.getByText('1 234,5')).toBeTruthy();
  await act(async () => gate.resolve());
  expect(container.querySelector('output')!.textContent).toBe('1.234,5');
  await act(async () => fireEvent.click(screen.getByRole('button')));
  expect(container.querySelector('output')!.textContent).toBe('1 234,5');
});

test('suspended descendants use their provider after resuming', async () => {
  const gate = Promise.withResolvers<void>();
  function Deferred() {
    use(gate.promise);
    return <Number />;
  }
  await act(async () => {
    render(
      <>
        <LocaleProvider runtime={german}>
          <Suspense fallback="Loading">
            <Deferred />
          </Suspense>
        </LocaleProvider>
        <LocaleProvider runtime={french}>
          <Number />
        </LocaleProvider>
      </>,
    );
  });
  expect(screen.getByText('Loading')).toBeTruthy();
  await act(async () => gate.resolve());
  expect(within(screen.getByTestId('de-DE')).getByText('1.234,5')).toBeTruthy();
  expect(within(screen.getByTestId('fr-FR')).getByText('1 234,5')).toBeTruthy();
});

test('useFbt fails clearly without a provider', () => {
  expect(() => render(<Number />)).toThrow('useFbt must be used within a LocaleProvider.');
});

test('merging translations updates mounted consumers of only that runtime', async () => {
  const runtime = createFbteeRuntime({ locale: 'en-US', translations: {} });
  const other = createFbteeRuntime({ locale: 'en-US', translations: {} });
  function Message() {
    const { fbt } = useFbt();
    return <p>{fbt('Message', 'Provider merge')}</p>;
  }
  const { fbt } = runtime;
  const hash = (fbt('Message', 'Provider merge') as unknown as FbtResult).key!;
  render(
    <>
      <LocaleProvider runtime={runtime}>
        <Message />
      </LocaleProvider>
      <LocaleProvider runtime={other}>
        <Message />
      </LocaleProvider>
    </>,
  );
  expect(screen.getAllByText('Message')).toHaveLength(2);
  await act(async () => runtime.mergeTranslations({ 'en-US': { [hash]: 'Updated' } }));
  expect(screen.getAllByText('Message')).toHaveLength(1);
  expect(screen.getAllByText('Updated')).toHaveLength(1);
});
