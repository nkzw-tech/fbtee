'use client';

import { createFbteeRuntime, LocaleProvider, setupFbtee, useFbt } from 'fbtee';
import { useState } from 'react';

setupFbtee({ translations: {} });

const german = createFbteeRuntime({ locale: 'de-DE', translations: {} });

function ScopedPhrase() {
  const { fbt } = useFbt();
  return (
    <p>
      {fbt(
        ['Scoped amount: ', fbt.param('amount', 1234.5, { number: true })],
        'Next.js scoped client fixture',
      )}
    </p>
  );
}

export default function ClientPhrase() {
  const [count, setCount] = useState(1);
  return (
    <>
      <button onClick={() => setCount((value) => value + 1)} type="button">
        <fbt desc="Next.js App Router client fixture">
          Client clicks:{' '}
          <fbt:param name="count" number={count}>
            {count}
          </fbt:param>
        </fbt>
      </button>
      <LocaleProvider runtime={german}>
        <ScopedPhrase />
      </LocaleProvider>
    </>
  );
}
