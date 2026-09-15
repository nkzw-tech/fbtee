import { createFbteeRuntime, FbteeRuntime, FbteeRuntimeOptions, FbtAPI } from 'fbtee';

export function messages(runtime: FbteeRuntime) {
  const { fbs, fbt, list } = runtime;
  return {
    apostrophe: (name: string) => fbt([fbt.param('name', name), '’'], 'Scoped apostrophe'),
    embeddedNames: () => (
      <fbt desc="Scoped list">
        People: <fbt:list items={['Alice', 'Bob']} name="people" />
      </fbt>
    ),
    message: () => fbt('Message', 'Scoped message'),
    names: () => list(['Alice', 'Bob']),
    number: (value: number) => fbt([fbt.param('number', value, { number: true })], 'Scoped number'),
    plainMessage: () => fbs('Message', 'Scoped message'),
    plainNames: () => fbs(['People: ', fbs.list('people', ['Alice', 'Bob'])], 'Plain scoped list'),
    plural: (count: number) =>
      fbt(
        [fbt.plural('item', count, { many: 'items', name: 'count', showCount: 'yes' })],
        'Scoped plural',
      ),
    rich: () => (
      <fbt desc="Bound rich">
        Hello <b>world</b>
      </fbt>
    ),
    save: async (wait: Promise<void>) => {
      await wait;
      return fbt('Message', 'Scoped message');
    },
    viewer: () => fbt('Viewer', 'Scoped viewer'),
  };
}

export function factory(options: FbteeRuntimeOptions) {
  const { fbt } = createFbteeRuntime(options);
  return () => fbt('Message', 'Scoped message');
}

export function helper(fbt: FbtAPI) {
  return <fbt desc="Scoped message">Message</fbt>;
}
