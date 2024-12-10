import {
  CallExpression,
  Expression,
  isCallExpression,
  isStringLiteral,
  stringLiteral,
} from '@babel/types';
import invariant from 'invariant';
import { JSModuleNameType } from '../FbtConstants';
import FbtNodeChecker from '../FbtNodeChecker';
import type { CallExpressionArg } from '../FbtUtil';
import {
  createFbtRuntimeArgCallExpression,
  enforceBabelNodeCallExpressionArg,
  errorAt,
} from '../FbtUtil';
import { GENDER_ANY } from '../translate/IntlVariations';
import type { StringVariationArgsMap } from './FbtArguments';
import { GenderStringVariationArg } from './FbtArguments';
import FbtNode from './FbtNode';
import { FbtNodeType } from './FbtNodeType';
import { tokenNameToTextPattern } from './FbtNodeUtil';

type Options = {
  // `BabelNode` representing the `gender` of the fbt:name's value
  gender: CallExpressionArg;
  name: string; // Name of the string token,
  // `BabelNode` representing the `value` of the fbt:name to render on the UI
  value: CallExpressionArg;
};

/**
 * Represents an <fbt:name> or fbt.name() construct.
 * @see docs/params.md
 */
export default class FbtNameNode extends FbtNode<
  GenderStringVariationArg,
  CallExpression,
  null,
  Options
> {
  static readonly type: FbtNodeType = FbtNodeType.Name;

  override getOptions(): Options {
    try {
      const { moduleName } = this;
      const [node, initialValue, initialGender] =
        this.getCallNodeArguments() || [];

      invariant(
        isStringLiteral(node),
        'Expected first argument of %s.name to be a string literal, but got %s',
        moduleName,
        node && node.type
      );
      const value = enforceBabelNodeCallExpressionArg(
        initialValue,
        `Second argument of ${moduleName}.name`
      );
      const gender = enforceBabelNodeCallExpressionArg(
        initialGender,
        `Third argument of ${moduleName}.name`
      );

      return { gender, name: node.value, value };
    } catch (error) {
      throw errorAt(this.node, error);
    }
  }

  static fromBabelNode({
    moduleName,
    node,
  }: {
    moduleName: JSModuleNameType;
    node: Expression;
  }): FbtNameNode | null | undefined {
    if (!isCallExpression(node)) {
      return null;
    }

    const checker = FbtNodeChecker.forModule(moduleName);
    const constructName = checker.getFbtConstructNameFromFunctionCall(node);
    return constructName === FbtNameNode.type
      ? new FbtNameNode({
          moduleName,
          node,
        })
      : null;
  }

  override getArgsForStringVariationCalc(): ReadonlyArray<GenderStringVariationArg> {
    return [
      new GenderStringVariationArg(this, this.options.gender, [GENDER_ANY]),
    ];
  }

  override getTokenName(_argsMap: StringVariationArgsMap): string {
    return this.options.name;
  }

  override getText(argsMap: StringVariationArgsMap): string {
    try {
      argsMap.mustHave(this);
      return tokenNameToTextPattern(this.options.name);
    } catch (error: any) {
      throw errorAt(this.node, error);
    }
  }

  override getFbtRuntimeArg(): CallExpression {
    const { gender, name, value } = this.options;
    return createFbtRuntimeArgCallExpression(
      this,
      [stringLiteral(name), value, gender].filter(Boolean)
    );
  }

  override getArgsThatShouldNotContainFunctionCallOrClassInstantiation(): Readonly<{
    [argName: string]: CallExpressionArg;
  }> {
    return { gender: this.options.gender };
  }
}
