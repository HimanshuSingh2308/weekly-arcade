import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  output: 'static',
  outDir: '../../dist/apps/web-astro',
  site: 'https://weeklyarcade.games',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404'),
      changefreq: 'weekly',
      priority: 0.8,
      customPages: [],
      serialize(item) {
        // Higher priority for homepage and games
        if (item.url === 'https://weeklyarcade.games/') {
          item.priority = 1.0;
          item.changefreq = 'weekly';
        } else if (item.url.includes('/games/')) {
          item.priority = 0.9;
          item.changefreq = 'weekly';
        } else if (item.url.includes('/leaderboard/')) {
          item.priority = 0.7;
          item.changefreq = 'daily';
        } else if (item.url.includes('/about/')) {
          item.priority = 0.6;
          item.changefreq = 'monthly';
        } else if (item.url.includes('/privacy/') || item.url.includes('/terms/')) {
          item.priority = 0.3;
          item.changefreq = 'yearly';
        } else if (item.url.includes('/profile/')) {
          item.priority = 0.5;
          item.changefreq = 'monthly';
        }
        return item;
      },
    }),
  ],
  build: {
    assets: '_assets',
  },
  vite: {
    build: {
      cssMinify: true,
    },
  },
});
