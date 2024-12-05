export default function escapeRegex(str: string): string {
  return str.replace(/([.?*+\^$\[\]\\(){}|\-])/g, '\\$1');
}
