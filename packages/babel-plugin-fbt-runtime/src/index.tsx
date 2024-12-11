import { NodePath, PluginOptions } from '@babel/core';
import {
  identifier,
  isCallExpression,
  isObjectExpression,
  nullLiteral,
  objectExpression,
  objectProperty,
  stringLiteral,
  StringLiteral,
} from '@babel/types';
import {
  fbtHashKey,
  mapLeaves,
  replaceClearTokensWithTokenAliases,
  SENTINEL,
} from 'babel-plugin-fbt';
import type { ObjectWithJSFBT } from 'babel-plugin-fbt/src/index.tsx';
import invariant from 'invariant';

type Plugin = { opts: Partial<PluginOptions> & { fbtSentinel?: string } };

function getPluginOptions(plugin: Plugin): {
  fbtSentinel?: string;
} {
  const { opts } = plugin;
  if (opts == null || typeof opts !== 'object') {
    throw new Error(
      `Expected to opts property to be an object. ` +
        `Current value is ${String(opts)} (${typeof opts})`
    );
  }
  return opts as {
    fbtSentinel?: string;
  };
}

export default function BabelPluginFbtRuntime() {
  return {
    name: 'fbt-runtime',
    pre() {
      const visitor = this as unknown as Plugin;
      const { fbtSentinel } = getPluginOptions(visitor);
      if (visitor.opts) {
        visitor.opts.fbtSentinel = fbtSentinel || SENTINEL;
      }
    },
    visitor: {
      /**
       * Transform the following:
       * fbt._(
       *   fbtSentinel +
       *   JSON.strinfigy({
       *     type: "text",
       *     jsfbt: "jsfbt test" | {
       *       "t": {... jsfbt table}
       *        ...
       *     },
       *     desc: "desc",
       *     project: "project",
       *   }) +
       *   fbtSentinel
       * );
       * to:
       * fbt._("jsfbt test") or fbt._({... jsfbt table})
       */
      StringLiteral(path: NodePath<StringLiteral>) {
        const { fbtSentinel } = getPluginOptions(this as unknown as Plugin);
        if (fbtSentinel == null || fbtSentinel.trim() == '') {
          throw new Error(
            `fbtSentinel must be a non-empty string. Current value is ${String(
              fbtSentinel
            )} (${typeof fbtSentinel})`
          );
        }
        const sentinelLength = fbtSentinel.length;
        const phrase = path.node.value;
        if (
          !phrase.startsWith(fbtSentinel) ||
          !phrase.endsWith(fbtSentinel) ||
          phrase.length <= sentinelLength * 2
        ) {
          return;
        }

        const parsedPhrase = JSON.parse(
          phrase.slice(sentinelLength, phrase.length - sentinelLength)
        ) as ObjectWithJSFBT;

        const runtimeInput = mapLeaves(parsedPhrase.jsfbt.t, (leaf) =>
          replaceClearTokensWithTokenAliases(leaf.text, leaf.tokenAliases)
        );
        path.replaceWithSourceString(JSON.stringify(runtimeInput));

        const parentNode = path.parentPath && path.parentPath.node;
        invariant(
          isCallExpression(parentNode),
          `Expected parent node to be a 'CallExpression'`
        );

        // Append runtime options - key for runtime dictionary lookup
        if (parentNode.arguments.length === 1) {
          // Second param 'args' could be omitted sometimes. Use null here.
          parentNode.arguments.push(nullLiteral());
        }

        // Append hash key to the options argument
        const optionsNode = parentNode.arguments[2];
        invariant(
          optionsNode == null || isObjectExpression(optionsNode),
          'Expect options node to be either null or an object expression but got %s (%s)',
          optionsNode,
          typeof optionsNode
        );

        parentNode.arguments[2] = objectExpression([
          ...(optionsNode == null ? [] : [...optionsNode.properties]),
          objectProperty(
            identifier('hk'),
            stringLiteral(fbtHashKey(parsedPhrase.jsfbt.t))
          ),
        ]);
      },
    },
  };
}
