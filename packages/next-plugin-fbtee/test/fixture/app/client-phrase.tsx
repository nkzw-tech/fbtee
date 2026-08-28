'use client';

import { setupFbtee } from 'fbtee';
import { useState } from 'react';

setupFbtee({ translations: {} });

export default function ClientPhrase() {
  const [count, setCount] = useState(1);
  return (
    <button onClick={() => setCount((value) => value + 1)} type="button">
      <fbt desc="Next.js App Router client fixture">
        Client clicks:{' '}
        <fbt:param name="count" number={count}>
          {count}
        </fbt:param>
      </fbt>
    </button>
  );
}
