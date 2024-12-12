import invariant from 'invariant';
import FbtTable from './FbtTable.tsx';
import { FbtTableArgs } from './Hooks.tsx';
import { Substitutions } from './substituteTokens.tsx';
import type { FbtContentItem } from './Types.d.ts';

export default function getAllSubstitutions(args: FbtTableArgs) {
  let substitutions: Substitutions | null = null;
  for (const arg of args) {
    const substitution = arg[FbtTable.ARG.SUBSTITUTION];
    if (!substitution) {
      continue;
    }
    for (const tokenName of Object.keys(substitution)) {
      if (!substitutions) {
        substitutions = {};
      }
      invariant(
        substitutions[tokenName] == null,
        'Cannot register a substitution with token=`%s` more than once',
        tokenName,
      );
      substitutions[tokenName] = substitution[tokenName] as FbtContentItem;
    }
  }
  return substitutions;
}
