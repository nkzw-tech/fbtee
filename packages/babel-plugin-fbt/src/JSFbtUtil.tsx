import nullthrows from 'nullthrows';
import type { FbtTableKey } from '../../fbt/src/FbtTable';
import type {
  ObjectWithJSFBT,
  TableJSFBTTree,
  TableJSFBTTreeBranch,
  TableJSFBTTreeLeaf,
} from './index';

export function isTableJSFBTTreeLeaf(
  value: Partial<TableJSFBTTreeLeaf>
): value is TableJSFBTTreeLeaf {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.desc === 'string' &&
    typeof value.text === 'string' &&
    (typeof value.tokenAliases === 'object' || value.tokenAliases == null)
  );
}

function _runOnNormalizedJSFBTLeaves(
  value: Readonly<TableJSFBTTree>,
  callback: (leaf: TableJSFBTTreeLeaf) => void
): void {
  if (isTableJSFBTTreeLeaf(value)) {
    return callback(value);
  }

  for (const key of Object.keys(value)) {
    _runOnNormalizedJSFBTLeaves(
      nullthrows((value as TableJSFBTTreeBranch)[key]),
      callback
    );
  }
}

export function onEachLeaf(
  phrase: ObjectWithJSFBT,
  callback: (leaf: TableJSFBTTreeLeaf) => void
): void {
  _runOnNormalizedJSFBTLeaves(phrase.jsfbt.t, callback);
}

/**
 * Clone `tree` and replace each leaf in the cloned tree with the result of
 * calling `convertLeaf`.
 */
export function mapLeaves<NewLeaf>(
  tree: Readonly<TableJSFBTTree>,
  convertLeaf: (leaf: Readonly<TableJSFBTTreeLeaf>) => NewLeaf
): NewLeaf {
  if (isTableJSFBTTreeLeaf(tree)) {
    return convertLeaf(tree);
  }

  const newFbtTree: Record<FbtTableKey, NewLeaf> = {};
  for (const tableKey of Object.keys(tree)) {
    newFbtTree[tableKey] = mapLeaves(
      (tree as TableJSFBTTreeBranch)[tableKey]!,
      convertLeaf
    );
  }
  return newFbtTree as NewLeaf;
}
