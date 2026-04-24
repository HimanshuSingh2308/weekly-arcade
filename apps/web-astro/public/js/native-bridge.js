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

  /** Set status bar style and expose height as CSS variable */
  setStatusBar: function() {
    if (!this.isNative() || !window.Capacitor?.Plugins?.StatusBar) return;
    try {
      var SB = window.Capacitor.Plugins.StatusBar;
      SB.setStyle({ style: 'DARK' });
      SB.setBackgroundColor({ color: '#00000000' });
      SB.setOverlaysWebView({ overlay: true });

      // Expose status bar height as CSS variable so headers can use it
      SB.getInfo().then(function(info) {
        var h = (info && info.height) ? info.height : 48;
        document.documentElement.style.setProperty('--safe-area-top', h + 'px');
      }).catch(function() {
        document.documentElement.style.setProperty('--safe-area-top', '48px');
      });
    } catch (e) { /* ignore */ }
  },

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
    this.setStatusBar();
    this.hideSplash();
  },
};

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { window.nativeBridge.init(); });
} else {
  window.nativeBridge.init();
}
