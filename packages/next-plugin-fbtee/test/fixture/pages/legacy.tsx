import { setupFbtee } from 'fbtee';

setupFbtee({ translations: {} });

export default function LegacyPage() {
  return (
    <main>
      <fbt desc="Next.js Pages Router fixture">Pages Router phrase</fbt>
    </main>
  );
}
