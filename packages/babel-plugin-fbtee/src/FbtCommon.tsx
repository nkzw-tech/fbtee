import type { BindingName } from './FbtConstants.tsx';

export type FbtCommonMap = {
  [text: string]: string;
};
const textToDesc: FbtCommonMap = {};

export function init(
  opts: {
    fbtCommon?: FbtCommonMap | null;
    fbtCommonPath?: string | null;
  } = {}
) {
  if (opts.fbtCommon) {
    Object.assign(textToDesc, opts.fbtCommon);
  }
  if (opts.fbtCommonPath != null) {
    throw new Error(
      `'fbtCommonPath' is no longer supported. Use 'fbtCommon' instead.`
    );
  }
}

export function getCommonDescription(text: string): string | null {
  return textToDesc[text];
}

export function getUnknownCommonStringErrorMessage(
  moduleName: BindingName,
  text: string
): string {
  return `Unknown string "${text}" for <${moduleName} common={true}>`;
}
