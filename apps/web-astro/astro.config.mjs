import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  outDir: '../../dist/apps/web-astro',
  site: 'https://weeklyarcade.games',
  trailingSlash: 'always',
  build: {
    assets: '_assets',
  },
  vite: {
    build: {
      cssMinify: true,
    },
  },
});
