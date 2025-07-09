import { Node } from '@babel/types';
import invariant from 'invariant';
import type { EnumKey } from '../FbtEnumRegistrar.tsx';
import { compactNodeProps, getRawSource, varDump } from '../FbtUtil.tsx';
import type { GenderConst } from '../Gender.tsx';
import {
  EXACTLY_ONE,
  GENDER_ANY,
  IntlVariations,
  NUMBER_ANY,
} from '../translate/IntlVariations.tsx';
import type { AnyFbtNode } from './FbtNode.tsx';

export type AnyStringVariationArg =
  | EnumStringVariationArg
  | GenderStringVariationArg
  | NumberStringVariationArg;
export type AnyFbtArgument = GenericArg | AnyStringVariationArg;

/**
 * Base class representing fbt construct arguments that support dynamic values at runtime.
 *
 * E.g.
 *
 *    <fbt:plural
 *      count={
 *        numParticipants             <-- FbtArgumentBase
 *      }
 *      value={
 *        formatted(numParticipants)  <-- FbtArgumentBase
 *      }
 *      showCount="yes"               <-- hard-coded, so not an FbtArgumentBase
 *    >
 *      challenger
 *    </fbt:plural>
 */
export class FbtArgumentBase<B extends Node | null> {
  readonly fbtNode: AnyFbtNode;
  readonly node: B;

  constructor(fbtNode: AnyFbtNode, node: B) {
    this.fbtNode = fbtNode;
    this.node = node;
  }

  /**
   * For debugging and unit tests:
   *
   * Since node objects are pretty deep and filled with low-level properties
   * that we don't really care about, we'll process any node property of this object so that:
   *
   *   - we convert the property value to a string like `'Node[type=SomeBabelType]'`
   *   - we add a new property like `__*propName*Code` whose value will
   *     be the JS source code of the original node.
   *
   * See snapshot `fbtFunctional-test.js.snap` to find output examples.
   */
  toJSON(): unknown {
    const { fbtNode, node } = this;
    const ret = compactNodeProps({
      fbtNode: fbtNode != null ? fbtNode.constructor.name : fbtNode,
      node,
    });
    Object.defineProperty(ret, 'constructor', {
      enumerable: false,
      value: this.constructor,
    });
    return ret;
  }

  getArgCode(code: string): string {
    invariant(
      !!this.node,
      'Unable to find node object from string variation argument: %s',
      varDump(this),
    );
    return getRawSource(code, this.node);
  }
}

/**
 * Special fbt argument that does NOT produce string variations.
 *
 * E.g.
 *
 *    <fbt:plural
 *      count={
 *        numParticipants             <-- NumberStringVariationArg
 *      }
 *      value={
 *        formatted(numParticipants)  <-- GenericArg (used for UI display only)
 *      }
 *      showCount="yes"
 *    >
 *      challenger
 *    </fbt:plural>
 */
class GenericArg extends FbtArgumentBase<Node> {}

/**
 * Given an fbt callsite that may generate multiple string variations,
 * we know that these variations are issued from some specific arguments.
 *
 * This is the base class that represents these string variation arguments.
 *
 * I.e.
 *
 *     fbt(
 *       [
 *         'Wish ',
 *         fbt.pronoun(
 *           'object',
 *           personGender, // <-- the string varation argument
 *           {human: true}
 *         ),
 *         ' a happy birthday.',
 *       ],
 *       'text with pronoun',
 *     );
 *
 * The string variation argument would be based on the `personGender` variable.
 */
export abstract class StringVariationArg<
  Value,
  B extends Node | null = Node,
> extends FbtArgumentBase<B> {
  /**
   * List of candidate values that this SVArgument might have.
   */
  readonly candidateValues: ReadonlyArray<Value>;

  /**
   * Current SVArgument value of this instance among candidates from `candidateValues`.
   */
  readonly value: Value | null | undefined;

  /**
   * Given a list of SV arguments, some of them can be omitted because they're "redundant".
   * Note: a SV argument cam be omitted because another one of the same type and same node
   * source code expression already exist in the list of SV arguments.
   * Set this property to `true` if that's the case.
   */
  readonly isCollapsible: boolean;

  constructor(
    fbtNode: AnyFbtNode,
    node: B,
    candidateValues: ReadonlyArray<Value>,
    value?: Value | null,
    isCollapsible: boolean = false,
  ) {
    super(fbtNode, node);
    this.candidateValues = candidateValues;
    this.value = value;
    this.isCollapsible = isCollapsible;
  }

  cloneWithValue(value: Value, isCollapsible: boolean): this {
    return new (this.constructor as new (
      fbtNode: AnyFbtNode,
      node: B,
      candidateValues: ReadonlyArray<Value>,
      value?: Value | null,
      isCollapsible?: boolean,
    ) => this)(
      this.fbtNode,
      this.node,
      this.candidateValues,
      value,
      isCollapsible,
    );
  }

  override toJSON() {
    return Object.assign(super.toJSON() as Record<string, unknown>, {
      candidateValues: this.candidateValues,
      isCollapsible: this.isCollapsible,
      value: this.value,
    });
  }
}

export class EnumStringVariationArg extends StringVariationArg<EnumKey> {}

export class GenderStringVariationArg extends StringVariationArg<
  GenderConst | typeof GENDER_ANY
> {}

export class NumberStringVariationArg extends StringVariationArg<
  typeof NUMBER_ANY | typeof EXACTLY_ONE | IntlVariations,
  Node | null
> {}

export class StringVariationArgsMap {
  readonly _map: Map<AnyFbtNode, AnyStringVariationArg>;

  constructor(svArgs: ReadonlyArray<AnyStringVariationArg>) {
    this._map = new Map(svArgs.map((arg) => [arg.fbtNode, arg]));
    invariant(
      svArgs.length === this._map.size,
      'Expected only one StringVariationArg per FbtNode. ' +
        'Input array length=%s but resulting map size=%s',
      svArgs.length,
      this._map.size,
    );
  }

  get(fbtNode: AnyFbtNode) {
    const ret = this._map.get(fbtNode);
    invariant(
      ret != null,
      'Unable to find entry for FbtNode: %s',
      varDump(fbtNode),
    );
    return ret;
  }
}
