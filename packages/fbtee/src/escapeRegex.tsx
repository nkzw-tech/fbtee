export default function escapeRegex(str: string): string {
  return str.replaceAll(/([$()*+.?[\\\]^{|}-])/g, String.raw`\$1`);
}
