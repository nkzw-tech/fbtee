export type ConcreteFbtNodeType =
  | 'enum'
  | 'list'
  | 'name'
  | 'param'
  | 'plural'
  | 'pronoun'
  | 'sameParam';

export type FbtNodeType =
  | ConcreteFbtNodeType
  | 'element'
  | 'implicitParam'
  | 'text';

export const isConcreteFbtNode = (node: string): node is ConcreteFbtNodeType =>
  node === 'enum' ||
  node === 'list' ||
  node === 'name' ||
  node === 'param' ||
  node === 'plural' ||
  node === 'pronoun' ||
  node === 'sameParam';

const isFbtNode = (node: string): node is FbtNodeType =>
  node === 'element' ||
  node === 'implicitParam' ||
  node === 'text' ||
  isConcreteFbtNode(node);

export function getNodeType(node: string): FbtNodeType | null {
  return isFbtNode(node) ? node : null;
}
