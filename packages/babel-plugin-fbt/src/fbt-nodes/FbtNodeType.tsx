export const FbtNodeType = {
  Element: 'element',
  Enum: 'enum',
  ImplicitParam: 'implicitParam',
  Name: 'name',
  Param: 'param',
  Plural: 'plural',
  Pronoun: 'pronoun',
  SameParam: 'sameParam',
  Text: 'text',

  element: 'element',
  enum: 'enum',
  implicitParam: 'implicitParam',
  name: 'name',
  param: 'param',
  plural: 'plural',
  pronoun: 'pronoun',
  sameParam: 'sameParam',
  text: 'text',
} as const;

export type FbtNodeType = (typeof FbtNodeType)[keyof typeof FbtNodeType];
