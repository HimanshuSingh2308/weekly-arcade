/**
 * Push Notification Manager for Weekly Arcade
 *
 * Handles FCM token registration, permission requests, and token refresh.
 * Follows the same IIFE singleton pattern as authManager / syncManager.
 *
 * Usage:
 *   await window.notificationManager.init();
 *   const granted = await window.notificationManager.requestPermissionAndRegister();
 *   window.notificationManager.setupTokenRefresh();
 */

const NotificationManager = (() => {
  const TOKEN_KEY = 'push-token-registered';
  const PROMPT_DISMISS_KEY = 'notification-prompt-dismissed';
  const PROMPT_DISMISS_HOURS = 72;
  let vapidKey = null;

  let messaging = null;
  let initialized = false;

  /**
   * Initialize Firebase Messaging (call after Firebase SDK is loaded)
   */
  async function init() {
    if (initialized) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    if (typeof firebase === 'undefined' || !firebase.messaging) return;

    try {
      messaging = firebase.messaging();

      // Fetch VAPID key from API (keeps keys out of source code)
      if (!vapidKey && window.apiClient) {
        try {
          const config = await window.apiClient.getNotificationConfig();
          vapidKey = config.vapidKey;
        } catch (e) {
          console.warn('[NotificationManager] Failed to fetch VAPID key:', e);
        }
      }

      initialized = true;
    } catch (e) {
      console.warn('[NotificationManager] Init failed:', e);
    }
  }

  /**
   * Request notification permission and register FCM token with backend
   * Returns true if permission granted and token registered
   */
  async function requestPermissionAndRegister() {
    if (!messaging) return false;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return false;

      // Wait for service worker to be fully active (pushManager requires active SW)
      const swReg = await navigator.serviceWorker.ready;
      if (!swReg || !swReg.pushManager) return false;

      const tokenOpts = { serviceWorkerRegistration: swReg };
      if (vapidKey) tokenOpts.vapidKey = vapidKey;

      const token = await messaging.getToken(tokenOpts);

      if (token && window.apiClient) {
        await window.apiClient.registerPushToken(token, navigator.userAgent);
        localStorage.setItem(TOKEN_KEY, token);
        return true;
      }
    } catch (e) {
      console.warn('[NotificationManager] Registration failed:', e);
    }

    return false;
  }

  /**
   * Unregister push notifications
   */
  async function unregister() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && window.apiClient) {
      try {
        await window.apiClient.removePushToken(token);
      } catch (e) {
        // Best effort
      }
    }
    localStorage.removeItem(TOKEN_KEY);
    if (messaging) {
      try { await messaging.deleteToken(); } catch (e) { /* ok */ }
    }
  }

  /**
   * Check if user already has a registered token
   */
  function hasToken() {
    return !!localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Set up periodic token refresh (FCM tokens can expire)
   */
  function setupTokenRefresh() {
    if (!messaging) return;

    // Check token validity every 24 hours
    setInterval(async () => {
      try {
        const swReg = await navigator.serviceWorker.ready;
        if (!swReg || !swReg.pushManager) return;

        const tokenOpts = { serviceWorkerRegistration: swReg };
        if (vapidKey) tokenOpts.vapidKey = vapidKey;

        const newToken = await messaging.getToken(tokenOpts);
        const stored = localStorage.getItem(TOKEN_KEY);

        if (newToken && newToken !== stored && window.apiClient) {
          await window.apiClient.registerPushToken(newToken, navigator.userAgent);
          localStorage.setItem(TOKEN_KEY, newToken);
        }
      } catch (e) {
        // Will retry next interval
      }
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Handle foreground messages (show a non-intrusive toast or badge)
   */
  function onForegroundMessage(callback) {
    if (!messaging) return;
    messaging.onMessage((payload) => {
      callback(payload);
    });
  }

  /**
   * Should we show the notification opt-in prompt?
   * Respects dismiss cooldown and checks if already registered.
   */
  function shouldPrompt() {
    // Already registered
    if (hasToken()) return false;
    // Notifications not supported
    if (!('Notification' in window)) return false;
    // Already granted or denied
    if (Notification.permission !== 'default') return false;
    // Dismissed recently
    const dismissed = localStorage.getItem(PROMPT_DISMISS_KEY);
    if (dismissed && Date.now() - parseInt(dismissed, 10) < PROMPT_DISMISS_HOURS * 3600000) {
      return false;
    }
    return true;
  }

  /**
   * Mark prompt as dismissed (user said "not now")
   */
  function dismissPrompt() {
    localStorage.setItem(PROMPT_DISMISS_KEY, Date.now().toString());
  }

  return {
    init,
    requestPermissionAndRegister,
    unregister,
    hasToken,
    setupTokenRefresh,
    onForegroundMessage,
    shouldPrompt,
    dismissPrompt,
  };
})();

window.notificationManager = NotificationManager;
