/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @noflow
 */

'use strict';

const moduleMap = require('./moduleMap');
const babelPluginFbtGulp = require('./packages/babel-plugin-fbt/gulpfile');
const { version } = require('./packages/fbt/package.json');
const del = require('del');
const gulp = require('gulp');
const babel = require('gulp-babel');
const concat = require('gulp-concat');
const derequire = require('gulp-derequire');
const flatten = require('gulp-flatten');
const header = require('gulp-header');
const gulpif = require('gulp-if');
const once = require('gulp-once');
const rename = require('gulp-rename');
const gulpUtil = require('gulp-util');
const webpackStream = require('webpack-stream');

const paths = {
  published: 'packages/fbt',
  dist: 'packages/fbt/dist',
  lib: 'packages/fbt/lib',
  license: 'LICENSE',
  runtime: [
    'packages/fbt/src/**/*.js',
    '!packages/fbt/src/**/__tests__/*',
    '!packages/fbt/src/**/__mocks__/*',
  ],
  typedModules: ['flow-types/typed-js-modules/*.flow'],
};

const COPYRIGHT_HEADER = `/**
 * fbt v<%= version %>
 *
 * Copyright (c) Christoph Nakazawa & Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
`;

const buildDist = function (opts) {
  const webpackOpts = {
    externals: {},
    output: {
      filename: opts.output,
      libraryTarget: 'umd',
      library: 'fbt',
    },
    plugins: [
      new webpackStream.webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(
          opts.debug ? 'development' : 'production'
        ),
      }),
      new webpackStream.webpack.LoaderOptionsPlugin({
        debug: opts.debug,
      }),
    ],
    optimization: {
      minimize: false,
    },
  };

  return webpackStream(webpackOpts, null, function (err, stats) {
    if (err) {
      throw new gulpUtil.PluginError('webpack', err);
    }
    if (stats.compilation.errors.length) {
      gulpUtil.log('webpack', '\n' + stats.toString({ colors: true }));
    }
  });
};

const copyLicense = () =>
  gulp.src(paths.license).pipe(gulp.dest(paths.published));

gulp.task('license', gulp.series(copyLicense));

const buildModules = () =>
  gulp
    .src(paths.runtime, { follow: true })
    .pipe(once())
    .pipe(
      babel({
        presets: [
          require('@babel/preset-env'),
          require('@babel/preset-react'),
          require('@babel/preset-flow'),
        ],
        plugins: [
          require('babel-plugin-fbt'),
          require('babel-plugin-fbt-runtime'),
        ],
      })
    )
    .pipe(gulp.dest(paths.lib));

gulp.task('modules', gulp.series(babelPluginFbtGulp.build, buildModules));

const babelTestPresets = {
  presets: [
    require('@babel/preset-env'),
    require('@babel/preset-react'),
    require('@babel/preset-flow'),
  ],
  plugins: [
    ['babel-plugin-fbt', { fbtCommon: { Accept: '...' } }],
    'babel-plugin-fbt-runtime',
  ],
};

const transformTests = (src, dest) =>
  gulp
    .src(src, { follow: true })
    .pipe(once())
    .pipe(babel(babelTestPresets))
    .pipe(flatten())
    .pipe(gulp.dest(dest));

const buildDistTask = () =>
  gulp
    .src('./packages/fbt/lib/FbtPublic.js')
    .pipe(buildDist({ debug: true, output: 'fbt.js' }))
    .pipe(derequire())
    .pipe(gulpif('*.js', header(COPYRIGHT_HEADER, { version })))
    .pipe(gulp.dest(paths.dist));

gulp.task('dist', gulp.series('modules', buildDistTask));

const cleanTask = () =>
  del([
    '.checksums',
    paths.published + '/dist',
    paths.published + '/lib',
    '!' + paths.published + '/package.json',
    '!' + paths.published + '/README.md',
  ]);

gulp.task('clean', gulp.parallel(babelPluginFbtGulp.clean, cleanTask));

gulp.task('build-runtime', gulp.series(gulp.parallel('license', 'modules')));
