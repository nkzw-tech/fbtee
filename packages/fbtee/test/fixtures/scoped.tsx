import { fbs, fbt, list } from 'fbtee';

export const moduleMessage = fbs('Module message', 'Module initialization');

export const message = () => fbt('Message', 'Scoped message');
export const plainMessage = () => fbs('Message', 'Scoped message');
export const viewer = () => fbt('Viewer', 'Scoped viewer');

export const number = (value: number) =>
  fbt([fbt.param('number', value, { number: true })], 'Scoped number');

export const plural = (count: number) =>
  fbt(
    [fbt.plural('item', count, { many: 'items', name: 'count', showCount: 'yes' })],
    'Scoped plural',
  );

export const names = () => list(['Alice', 'Bob']);

export const embeddedNames = () => (
  <fbt desc="Scoped list">
    People: <fbt:list items={['Alice', 'Bob']} name="people" />
  </fbt>
);

export const punctuation = (name: string) =>
  fbt([fbt.param('name', name), '.'], 'Scoped punctuation');

export const apostrophe = (name: string) =>
  fbt([fbt.param('name', name), '’'], 'Scoped apostrophe');

export const richMessage = () => (
  <fbt desc="Scoped rich message">
    Hello,{' '}
    <fbt:param name="name">
      <strong>Alice</strong>
    </fbt:param>
  </fbt>
);

export function Message() {
  return (
    <p>
      <fbt desc="Scoped message">Message</fbt>
    </p>
  );
}

export function SuspendedMessage({ ready, wait }: { ready: () => boolean; wait: Promise<void> }) {
  if (!ready()) {
    throw wait;
  }
  return <Message />;
}
