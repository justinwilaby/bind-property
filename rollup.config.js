import fs from 'fs';
import { rollup } from 'rollup';
import babel from 'rollup-plugin-babel';
import nodeResolve from 'rollup-plugin-node-resolve';
import replace from 'rollup-plugin-replace';
import { uglify } from 'rollup-plugin-uglify';
import pack from './package.json';

const development = process.argv[ 2 ] === 'dev';
const production = process.argv[ 2 ] === 'prod';
const es6 = process.argv[ 3 ];

process.env.NODE_ENV = development ? 'development' : 'production';
const babelConfig = JSON.parse(fs.readFileSync('.babelrc', 'utf8'));

const config = {
  input: 'src/index.js',
  plugins: [
    babel(babelConfig),
    nodeResolve({
      jsnext: true,
      main: true
    }),
    replace({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      VERSION: pack.version
    })
  ]
};
const bundleConfig = {
  sourceMap: 'inline',
  file: 'bind-property.js',
  format: 'umd',
  dir: 'build',
  name: 'bind-property'
};
if (production && !es6) {
  config.plugins.push(
    uglify({
      warnings: false,
      compress: {
        screw_ie8: true,
        dead_code: true,
        unused: true,
        drop_debugger: true,
        booleans: true // various optimizations for boolean context, for example !!a ? b : c → a ? b : c
      },
      mangle: {
        screw_ie8: true
      }
    })
  );
}
rollup(config).then(bundle => bundle.write(bundleConfig));
