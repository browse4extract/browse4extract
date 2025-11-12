const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  entry: {
    main: './src/renderer/index.tsx',
    debug: './src/renderer/debug.tsx'
  },
  target: 'electron-renderer',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        include: /src/,
        use: [{ loader: 'ts-loader' }]
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader']
      },
      {
        test: /\.(png|jpe?g|gif|svg|ico)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/[name][ext]'
        }
      }
    ]
  },
  output: {
    path: path.resolve(__dirname, 'dist/renderer'),
    filename: '[name].js'
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/renderer/index.html',
      filename: 'index.html',
      chunks: ['main']
    }),
    new HtmlWebpackPlugin({
      template: './src/renderer/index.html',
      filename: 'debug.html',
      chunks: ['debug'],
      inject: 'body',
      scriptLoading: 'blocking'
    }),
    new webpack.DefinePlugin({
      BUILD_DATE: JSON.stringify(new Date().toISOString().split('T')[0]),
      BUILD_TIME: JSON.stringify(new Date().toISOString()),
      APP_VERSION: JSON.stringify(require('./package.json').version)
    })
  ],
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist/renderer')
    },
    port: 3000,
    hot: true
  }
};
