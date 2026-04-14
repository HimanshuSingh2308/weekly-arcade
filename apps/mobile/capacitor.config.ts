import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'games.weeklyarcade.app',
  appName: 'Weekly Arcade',
  // Local files as fallback (used for offline)
  webDir: '../../dist/apps/web-astro',
  server: {
    // Live URL for smooth navigation + instant web updates.
    // Splash GIF loads from CDN (small delay but navigation works perfectly).
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
