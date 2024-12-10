import invariant from 'invariant';
import type { TableJSFBTTree, TableJSFBTTreeLeaf } from './index.tsx';
import jenkinsHash from './jenkinsHash.tsx';
import { mapLeaves, onEachLeaf } from './JSFbtUtil.tsx';

export default function fbtJenkinsHash(
  jsfbt: Readonly<TableJSFBTTree>
): number {
  let desc: string | null = null;
  let leavesHaveSameDesc = true;
  onEachLeaf({ jsfbt: { m: [], t: jsfbt } }, (leaf: TableJSFBTTreeLeaf) => {
    if (desc == null) {
      desc = leaf.desc;
    } else if (desc !== leaf.desc) {
      leavesHaveSameDesc = false;
    }
  });

  if (leavesHaveSameDesc) {
    const hashInputTree = mapLeaves(
      jsfbt,
      (leaf: Readonly<TableJSFBTTreeLeaf>) => {
        return leaf.tokenAliases != null
          ? { text: leaf.text, tokenAliases: leaf.tokenAliases }
          : leaf.text;
      }
    );
    invariant(
      desc != null,
      'Expect `desc` to be nonnull as `TableJSFBTTree` should contain at least ' +
        'one leaf.'
    );
    const key = JSON.stringify(hashInputTree) + '|' + desc;
    return jenkinsHash(key);
  }

  const hashInputTree = mapLeaves(
    jsfbt,
    (leaf: Readonly<TableJSFBTTreeLeaf>) => {
      const newLeaf = { desc: leaf.desc, text: leaf.text } as const;
      return leaf.tokenAliases != null
        ? { ...newLeaf, tokenAliases: leaf.tokenAliases }
        : newLeaf;
    }
  );
  return jenkinsHash(JSON.stringify(hashInputTree));
}
