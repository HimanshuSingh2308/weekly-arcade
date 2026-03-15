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
      '@weekly-arcade/game-wordle$': join(__dirname, '../../packages/game-wordle/src/index.ts'),
    },
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: false,
      sourceMap: true,
      externalDependencies: [
        // List external packages but NOT our workspace packages
        'firebase-admin',
        'firebase-functions',
        '@nestjs/common',
        '@nestjs/core',
        '@nestjs/platform-express',
        'class-validator',
        'class-transformer',
        'reflect-metadata',
        'rxjs',
        'express',
      ],
    }),
  ],
};
