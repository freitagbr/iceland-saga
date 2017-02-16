const path = require('path');

module.exports = {
  context: path.join(__dirname, '/src'),
  entry: './index',
  output: {
    filename: 'app.js',
    path: path.join(__dirname, '/dist'),
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /(node_modules|bower_components)/,
        loader: 'babel-loader',
        query: {
          presets: ['es2015'],
        },
      },
    ],
  },
};
