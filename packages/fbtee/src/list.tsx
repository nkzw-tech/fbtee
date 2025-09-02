/// <reference types="../ReactTypes.d.ts" />

import type { ReactElement, ReactNode } from 'react';
import fbt from './fbt.tsx';
import type { FbtConjunction, FbtDelimiter } from './Types.ts';

export default function list(
  items: ReadonlyArray<string | ReactElement | null | undefined>,
  conjunction: FbtConjunction = 'and',
  delimiter: FbtDelimiter = 'comma',
): ReactNode {
  // Ensure the local version of `fbt` is used instead of auto-importing `fbtee`.
  // eslint-disable-next-line no-unused-expressions, @typescript-eslint/no-unused-expressions
  fbt;

  items = items.filter(Boolean);

  const count = items.length;
  if (count === 0) {
    return '';
  } else if (count === 1) {
    return items[0];
  }

  const lastItem = items.at(-1);
  let output: ReactNode = items[0];

  for (let index = 1; index < count - 1; index++) {
    switch (delimiter) {
      case 'semicolon':
        output = (
          <fbt desc='A list of items of various types, for example: "San Francisco; London; Tokyo". {previous items} and {following items} are themselves lists that contain one or more items.'>
            <fbt:param name="previous items">{output}</fbt:param>
            {'; '}
            <fbt:param name="following items">{items[index]}</fbt:param>
          </fbt>
        );
        break;
      case 'bullet':
        output = (
          <fbt desc='A list of items of various types separated by bullets, for example: "San Francisco \u2022 London \u2022 Tokyo". {previous items} and {following items} are themselves lists that contain one or more items.'>
            <fbt:param name="previous items">{output}</fbt:param> &bull;{' '}
            <fbt:param name="following items">{items[index]}</fbt:param>
          </fbt>
        );
        break;
      default:
        output = (
          <fbt desc='A list of items of various types separated by commas, for example: "San Francisco, London, Tokyo". {previous items} and {following items} are themselves lists that contain one or more items.'>
            <fbt:param name="previous items">{output}</fbt:param>
            {', '}
            <fbt:param name="following items">{items[index]}</fbt:param>
          </fbt>
        );
    }
  }

  switch (conjunction) {
    case 'and':
      return (
        <fbt desc='A list of items of various types, for example: "item1, item2, item3 and item4"'>
          <fbt:param name="list of items">{output}</fbt:param>
          and
          <fbt:param name="last item">{lastItem}</fbt:param>
        </fbt>
      );

    case 'or':
      return (
        <fbt desc='A list of items of various types, for example: "item1, item2, item3 or item4"'>
          <fbt:param name="list of items">{output}</fbt:param>
          or
          <fbt:param name="last item">{lastItem}</fbt:param>
        </fbt>
      );

    case 'none':
      switch (delimiter) {
        case 'semicolon':
          return (
            <fbt desc='A list of items of various types, for example: "San Francisco; London; Tokyo". {previous items} itself contains one or more items.'>
              <fbt:param name="previous items">{output}</fbt:param>
              {'; '}
              <fbt:param name="last item">{lastItem}</fbt:param>
            </fbt>
          );
        case 'bullet':
          return (
            <fbt desc='A list of items of various types separated by bullets, for example: "San Francisco \u2022 London \u2022 Tokyo". {previous items} contains one or more items.'>
              <fbt:param name="list of items">{output}</fbt:param> &bull;{' '}
              <fbt:param name="last item">{lastItem}</fbt:param>
            </fbt>
          );
        default:
          return (
            <fbt desc='A list of items of various types, for example: "item1, item2, item3, item4"'>
              <fbt:param name="list of items">{output}</fbt:param>
              {', '}
              <fbt:param name="last item">{lastItem}</fbt:param>
            </fbt>
          );
      }
    default: {
      conjunction satisfies never;
      throw new Error(
        `Invalid conjunction ${conjunction} provided to '<fbt:list>'.`,
      );
    }
  }
}

export function List({
  conjunction,
  delimiter,
  items,
}: {
  conjunction?: FbtConjunction;
  delimiter?: FbtDelimiter;
  items: Array<string | React.ReactElement | null | undefined>;
}) {
  return list(items, conjunction, delimiter);
}
