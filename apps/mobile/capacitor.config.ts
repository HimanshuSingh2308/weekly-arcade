import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'games.weeklyarcade.app',
  appName: 'Weekly Arcade',
  // Local files as fallback (used for offline)
  webDir: '../../dist/apps/web-astro',
  server: {
    // Load from live hosted URL for smooth navigation
    url: 'https://weeklyarcade.games',
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 0,
      fadeOutDuration: 0,
      backgroundColor: '#1a2456',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1e2a5e',
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
