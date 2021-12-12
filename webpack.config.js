const path = require("path");

module.exports = {
  entry: './src/channel.ts',
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: '/node_modules/'
      },
    ],
  },
  resolve: {
    extensions: ['.ts']
  },
  output: {
    filename: 'channel.js',
    path: path.resolve(__dirname, 'dist'),
  },
};
