const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, 'dist'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  resolve: {
    alias: {
      '@weekly-arcade/shared$': join(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: false,
      sourceMap: true,
      externalDependencies: [
        'firebase-admin',
        '@nestjs/common',
        '@nestjs/core',
        '@nestjs/platform-express',
        '@nestjs/websockets',
        '@nestjs/platform-socket.io',
        'socket.io',
        'reflect-metadata',
        'rxjs',
        'express',
      ],
    }),
  ],
};
