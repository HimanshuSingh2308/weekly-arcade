import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'games.weeklyarcade.app',
  appName: 'Weekly Arcade',
  // Local files as fallback (used for offline)
  webDir: '../../dist/apps/web-astro',
  server: {
    // Live URL for smooth navigation + instant web updates.
    url: 'https://weeklyarcade.games',
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1000,
      launchFadeOutDuration: 200,
      fadeOutDuration: 200,
      backgroundColor: '#1a2456',
      showSpinner: false,
      useDialog: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1a1a2e',
      overlaysWebView: false,
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
