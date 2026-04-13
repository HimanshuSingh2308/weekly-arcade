import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'games.weeklyarcade.app',
  appName: 'Weekly Arcade',
  // Points to the Astro static build output
  webDir: '../../dist/apps/web-astro',
  server: {
    // For development: uncomment to load from Astro dev server
    // url: 'http://10.0.2.2:4201', // Android emulator → host machine
    // url: 'http://YOUR_IP:4201',   // iOS simulator → host machine
    androidScheme: 'https', // Use https so cookies/SW behave like production
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
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
      resize: 'none', // Games manage their own layout
    },
  },
};

export default config;
