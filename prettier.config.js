module.exports = {
  importOrderParserPlugins: ['importAssertions', 'flow', 'jsx'],
  plugins: [
    '@ianvs/prettier-plugin-sort-imports',
    'prettier-plugin-packagejson',
  ],
  singleQuote: true,
};
