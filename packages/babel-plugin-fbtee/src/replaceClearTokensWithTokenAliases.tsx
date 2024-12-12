import { tokenNameToTextPattern } from './fbt-nodes/FbtNodeUtil.tsx';
import { TokenAliases } from './index.tsx';
import { PatternString } from './Types.tsx';

/**
 * Clear token names in translations and runtime call texts need to be replaced
 * by their aliases in order for the runtime logic to work.
 */
export default function replaceClearTokensWithTokenAliases(
  textOrTranslation: PatternString,
  tokenAliases?: TokenAliases | null,
): string {
  if (tokenAliases == null) {
    return textOrTranslation;
  }

  return Object.keys(tokenAliases).reduce(
    (mangledText: string, clearToken: string) => {
      const clearTokenName = tokenNameToTextPattern(clearToken);
      const mangledTokenName = tokenNameToTextPattern(tokenAliases[clearToken]);
      // Since a string is not allowed to have implicit params with duplicated
      // token names, replacing the first and therefore the only occurence of
      // `clearTokenName` is sufficient.
      return mangledText.replace(clearTokenName, mangledTokenName);
    },
    textOrTranslation,
  );
}
