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
      launchShowDuration: 2000,
      fadeOutDuration: 300,
      backgroundColor: '#0f0f1a',
      showSpinner: true,
      spinnerColor: '#8B5CF6',
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
