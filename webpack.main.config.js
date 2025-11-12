const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    main: './src/main/main.ts',
    preload: './src/preload/preload.ts'
  },
  target: 'electron-main',
  module: {
    rules: [
      {
        test: /\.ts$/,
        include: /src/,
        use: [{ loader: 'ts-loader' }]
      }
    ]
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name]/[name].js'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  node: {
    __dirname: false,
    __filename: false
  },
  externals: {
    'puppeteer': 'commonjs puppeteer',
    'puppeteer-extra': 'commonjs puppeteer-extra',
    'puppeteer-extra-plugin-stealth': 'commonjs puppeteer-extra-plugin-stealth',
    'puppeteer-extra-plugin-adblocker': 'commonjs puppeteer-extra-plugin-adblocker'
  },
  ignoreWarnings: [
    {
      module: /node_modules/,
    },
  ],
  stats: {
    errorDetails: false,
    errors: true,
    warnings: false
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'assets',
          to: 'assets',
          globOptions: {
            ignore: ['**/*.psd']
          }
        }
      ]
    })
  ]
};
