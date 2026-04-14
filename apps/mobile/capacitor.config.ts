import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'games.weeklyarcade.app',
  appName: 'Weekly Arcade',
  // Local files as fallback (used for offline)
  webDir: '../../dist/apps/web-astro',
  server: {
    // Load from live hosted URL for smooth navigation (no full-page reloads).
    // The service worker handles caching for offline play.
    url: 'https://weeklyarcade.games',
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      launchShowDuration: 0, // We control splash via JS
      backgroundColor: '#0f0f1a',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f0f1a',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Keyboard: {
      resize: 'none',
    },
  },
};

export default config;
