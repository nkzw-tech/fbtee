const babel = require('@babel/core');

function createTransformer(opts = {}) {
  return {
    process(src, filename) {
      const options = {
        filename,
        plugins: opts.plugins || [],
        presets: [
          require('@babel/preset-env'),
          [
            require('@babel/preset-react'),
            {
              runtime: 'automatic',
            },
          ],
          require('@babel/preset-typescript'),
        ],
        retainLines: true,
      };

      return babel.transform(src, options);
    },
  };
}

module.exports = {
  ...createTransformer(),
  createTransformer,
};
