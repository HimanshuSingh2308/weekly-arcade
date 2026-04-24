/**
 * Native Bridge — wraps Capacitor plugins with web fallbacks.
 * Safe to load on web; every method is a no-op if Capacitor is absent.
 */
window.nativeBridge = {
  isNative: function() {
    return window.Capacitor?.isNativePlatform?.() ?? false;
  },

  /** Trigger haptic feedback (native only) */
  haptic: function(style) {
    if (!this.isNative() || !window.Capacitor?.Plugins?.Haptics) return;
    try {
      window.Capacitor.Plugins.Haptics.impact({ style: style || 'Medium' });
    } catch (e) { /* ignore */ }
  },

  /** Light haptic tap */
  hapticTap: function() {
    this.haptic('Light');
  },

  /** Native share sheet, fallback to Web Share API */
  share: function(title, text, url) {
    if (this.isNative() && window.Capacitor?.Plugins?.Share) {
      window.Capacitor.Plugins.Share.share({ title: title, text: text, url: url });
    } else if (navigator.share) {
      navigator.share({ title: title, text: text, url: url });
    }
  },

  /** Hide splash screen (call after game loads) */
  hideSplash: function() {
    if (!this.isNative() || !window.Capacitor?.Plugins?.SplashScreen) return;
    try {
      window.Capacitor.Plugins.SplashScreen.hide({ fadeOutDuration: 300 });
    } catch (e) { /* ignore */ }
  },

  /** Status bar styling handled by @capacitor-community/safe-area plugin.
   *  It makes env(safe-area-inset-*) work correctly on Android. */

  /** Register for push notifications */
  registerPush: function(onToken) {
    if (!this.isNative() || !window.Capacitor?.Plugins?.PushNotifications) return;
    var PN = window.Capacitor.Plugins.PushNotifications;
    PN.requestPermissions().then(function(result) {
      if (result.receive === 'granted') {
        PN.register();
      }
    });
    PN.addListener('registration', function(token) {
      console.log('Push token:', token.value);
      if (onToken) onToken(token.value);
    });
  },

  /** Initialize all native features */
  init: function() {
    if (!this.isNative()) return;
    this.hideSplash();
  },
};

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { window.nativeBridge.init(); });
} else {
  window.nativeBridge.init();
}
