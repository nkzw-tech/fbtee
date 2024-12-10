import path from 'node:path';
import type { JSModuleNameType } from './FbtConstants';

export type FbtCommonMap = {
  [text: string]: string;
};
const textToDesc: FbtCommonMap = {};

export function init(
  opts: {
    fbtCommon?: FbtCommonMap;
    fbtCommonPath?: string | null | undefined;
  } = {}
) {
  if (opts.fbtCommon) {
    Object.assign(textToDesc, opts.fbtCommon);
  }
  if (opts.fbtCommonPath != null) {
    let fbtCommonData;
    try {
      fbtCommonData = require(path.resolve(opts.fbtCommonPath));
    } catch (error) {
      if (error instanceof Error) {
        error.message +=
          `\nopts.fbtCommonPath: ${opts.fbtCommonPath}` +
          `\nCurrent path: ${process.cwd()}`;
      }
      throw error;
    }
    Object.assign(textToDesc, fbtCommonData);
  }
}

export function getDesc(text: string): string | null | undefined {
  return textToDesc[text];
}

export function getUnknownCommonStringErrorMessage(
  moduleName: JSModuleNameType,
  text: string
): string {
  return `Unknown string "${text}" for <${moduleName} common={true}>`;
}
