import type { FbtAPI } from 'fbtee';

export default async function scopedSave(fbt: FbtAPI, amount: number) {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return fbt(
    ['Saved ', fbt.param('amount', amount, { number: true }), '.'],
    'Scoped demo save confirmation',
  );
}
