import { setupFbtee } from 'fbtee';
import ClientPhrase from './client-phrase.tsx';

setupFbtee({ translations: {} });

export default function Page() {
  return (
    <main>
      <h1>
        <fbt desc="Next.js App Router server fixture">App Router server phrase</fbt>
      </h1>
      <ClientPhrase />
    </main>
  );
}
