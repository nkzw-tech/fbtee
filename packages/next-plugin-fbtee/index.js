import { fileURLToPath } from 'node:url';

const loader = fileURLToPath(new URL('./loader.cjs', import.meta.url));
const extensions = ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'mts', 'cts'];

const addWebpackLoader = (configuration, options) => {
  configuration.module ??= {};
  configuration.module.rules ??= [];
  configuration.module.rules.unshift({
    enforce: 'pre',
    exclude: /node_modules/,
    test: /\.[cm]?[jt]sx?$/,
    use: [{ loader, options }],
  });
  return configuration;
};

const prependTurbopackRule = (existingRule, rule) =>
  existingRule
    ? [rule, ...(Array.isArray(existingRule) ? existingRule : [existingRule])]
    : rule;

const createTurbopackRules = (rules, options) => {
  const nextRules = { ...rules };
  for (const extension of extensions) {
    const pattern = `*.${extension}`;
    const rule = {
      condition: {
        all: [{ not: 'foreign' }, { content: /fbt|fbs/ }],
      },
      loaders: [{ loader, options }],
    };
    nextRules[pattern] = prependTurbopackRule(nextRules[pattern], rule);
  }
  return nextRules;
};

export const withFbtee =
  (options = {}) =>
  (nextConfig = {}) => {
    const userWebpack = nextConfig.webpack;
    return {
      ...nextConfig,
      turbopack: {
        ...nextConfig.turbopack,
        rules: createTurbopackRules(nextConfig.turbopack?.rules, options),
      },
      webpack(configuration, context) {
        const configured =
          userWebpack?.(configuration, context) ?? configuration;
        return configured && typeof configured.then === 'function'
          ? configured.then((value) =>
              addWebpackLoader(value ?? configuration, options),
            )
          : addWebpackLoader(configured, options);
      },
    };
  };

export default withFbtee;
