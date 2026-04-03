/**
 * Game Cloud — shared score submission, cloud state, and guest score management.
 *
 * Eliminates ~200 lines of duplicated boilerplate per game.
 *
 * Usage:
 *   // Init auth listener with game-specific callbacks
 *   window.gameCloud.initAuth({
 *     onSignIn: (user) => { loadMyStuff(); },
 *     onSignOut: () => {},
 *     authBtnId: 'authBtn',         // optional, updates sign-in button text
 *     signInStyle: 'name'           // 'name' (shows first name) or 'button' (shows "Sign In")
 *   });
 *
 *   // Submit score (handles guest nudge automatically)
 *   await window.gameCloud.submitScore('snake', { score: 100, level: 3, timeMs: 5000, metadata: {} });
 *
 *   // Cloud state
 *   const state = await window.gameCloud.loadState('snake');
 *   await window.gameCloud.saveState('snake', { gamesPlayed: 1, ... });
 *
 *   // Guest scores (for games that queue scores locally)
 *   window.gameCloud.saveGuestScore('2048', scoreData);
 *   await window.gameCloud.syncGuestScores('2048');
 */

(function () {
  let currentUser = null;
  let authCallbacks = {};

  // ─── Auth ───

  function initAuth(opts = {}) {
    authCallbacks = opts;

    // Instant render from cached user (before Firebase loads)
    const cached = window.authManager?.user;
    console.log('[GameCloud] initAuth — cached user:', cached ? cached.displayName : 'none');
    if (cached) {
      currentUser = cached;
      _updateAuthBtn(opts);
      // Call onSignIn immediately if we have a cached token (user is functional)
      if (window.apiClient?.token && opts.onSignIn) opts.onSignIn(cached);
    }

    // Poll for Firebase to finish initializing
    const poll = setInterval(() => {
      if (window.authManager?.isInitialized) {
        clearInterval(poll);
        window.authManager.onAuthStateChanged(user => {
          currentUser = user;
          _updateAuthBtn(opts);
          if (user) {
            _initNotifications();
            if (opts.onSignIn) opts.onSignIn(user);
          }
          if (!user && opts.onSignOut) opts.onSignOut();
        });
      }
    }, 100);
  }

  function _updateAuthBtn(opts) {
    const btn = opts.authBtnId ? document.getElementById(opts.authBtnId) : null;
    if (!btn) return;

    if (currentUser) {
      // Show avatar (like 2048) — compact, works on mobile
      const photo = currentUser.photoURL;
      const name = currentUser.displayName || 'Player';
      if (photo) {
        btn.innerHTML = '';
        btn.style.cssText = 'padding:0;background:none;border:2px solid var(--accent,#e94560);border-radius:50%;width:32px;height:32px;cursor:pointer;overflow:hidden;display:flex;align-items:center;justify-content:center;min-width:32px;';
        const img = document.createElement('img');
        img.src = photo;
        img.alt = name;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
        img.onerror = () => { btn.textContent = name.charAt(0); btn.style.cssText = 'width:32px;height:32px;border-radius:50%;background:var(--accent,#e94560);color:#fff;border:none;font-weight:700;font-size:0.85rem;cursor:pointer;display:flex;align-items:center;justify-content:center;'; };
        btn.appendChild(img);
      } else {
        btn.textContent = name.charAt(0);
        btn.style.cssText = 'width:32px;height:32px;border-radius:50%;background:var(--accent,#e94560);color:#fff;border:none;font-weight:700;font-size:0.85rem;cursor:pointer;display:flex;align-items:center;justify-content:center;';
      }
      btn.onclick = () => { window.location.href = '/profile/'; };
    } else {
      btn.innerHTML = '';
      btn.removeAttribute('style');
      btn.textContent = 'Sign In';
      btn.onclick = () => {
        if (window.authManager) window.authManager.signInWithGoogle();
      };
    }
  }

  function getUser() { return currentUser; }
  function isSignedIn() { return !!currentUser; }

  // ─── Push Notifications ───

  let notificationsInitialized = false;

  async function _initNotifications() {
    if (notificationsInitialized) return;
    notificationsInitialized = true;

    // Dynamically load notification manager if not present
    if (!window.notificationManager) {
      await new Promise((resolve) => {
        const s = document.createElement('script');
        s.src = '/js/notification-manager.js';
        s.onload = resolve;
        s.onerror = resolve; // Don't block on failure
        document.head.appendChild(s);
      });
    }
    if (!window.notificationManager) return;

    await window.notificationManager.init();

    if (window.notificationManager.hasToken()) {
      // Already registered — just set up token refresh
      window.notificationManager.setupTokenRefresh();
    } else if (Notification.permission === 'granted') {
      // Permission was granted but token never registered (e.g. previous error)
      const registered = await window.notificationManager.requestPermissionAndRegister();
      if (registered) window.notificationManager.setupTokenRefresh();
    }
    // Otherwise, prompt will be triggered on first score submission via _promptNotifications()
  }

  async function _promptNotifications() {
    if (!window.notificationManager || !window.notificationManager.shouldPrompt()) return;
    // Auto-request after first successful score submission
    const granted = await window.notificationManager.requestPermissionAndRegister();
    if (granted) {
      window.notificationManager.setupTokenRefresh();
    } else {
      window.notificationManager.dismissPrompt();
    }
  }

  // ─── Screen Wake Lock ───
  // Prevents screen from sleeping during gameplay on mobile
  let wakeLock = null;

  async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (e) {
      // Wake lock request failed (e.g. low battery, background tab)
    }
  }

  function releaseWakeLock() {
    if (wakeLock) { wakeLock.release(); wakeLock = null; }
  }

  // Re-acquire wake lock when tab becomes visible again
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !wakeLock) {
      requestWakeLock();
    }
  });

  // Auto-acquire on load (game pages)
  requestWakeLock();

  // ─── Score Submission ───

  async function submitScore(gameId, scoreData) {
    if (!currentUser || !window.apiClient) {
      if (window.authNudge) window.authNudge.show();
      return null;
    }

    try {
      const result = await window.apiClient.submitScore(gameId, scoreData);
      // Prompt for push notifications after first successful score submit
      _promptNotifications();
      return result;
    } catch (error) {
      console.error(`[${gameId}] Score submit failed:`, error);
      return null;
    }
  }

  // Submit or queue: tries to submit if signed in, saves as guest score if not
  async function submitOrQueue(gameId, scoreData, opts = {}) {
    if (currentUser && window.apiClient) {
      try {
        const result = await window.apiClient.submitScore(gameId, scoreData);
        return result;
      } catch (error) {
        console.error(`[${gameId}] Score submit failed, saving locally:`, error);
        saveGuestScore(gameId, scoreData);
        return null;
      }
    } else {
      saveGuestScore(gameId, scoreData);
      if (!opts.silent && window.authNudge) window.authNudge.show();
      return null;
    }
  }

  // ─── Cloud State ───

  async function loadState(gameId) {
    if (!currentUser || !window.apiClient) return null;
    try {
      return await window.apiClient.getGameState(gameId);
    } catch (error) {
      console.error(`[${gameId}] Cloud state load failed:`, error);
      return null;
    }
  }

  async function saveState(gameId, state) {
    if (!currentUser || !window.apiClient) return null;
    try {
      return await window.apiClient.saveGameState(gameId, state);
    } catch (error) {
      console.error(`[${gameId}] Cloud state save failed:`, error);
      return null;
    }
  }

  // ─── Guest Score Queue ───

  function saveGuestScore(gameId, scoreData) {
    const key = `${gameId}-pending-scores`;
    const pending = JSON.parse(localStorage.getItem(key) || '[]');

    // Deduplicate: keep highest score per level (or just append if no level)
    const level = scoreData.level ?? scoreData.metadata?.level;
    if (level !== undefined) {
      const idx = pending.findIndex(s => (s.level ?? s.metadata?.level) === level);
      if (idx >= 0) {
        if (scoreData.score > pending[idx].score) {
          pending[idx] = { ...scoreData, timestamp: Date.now() };
        }
      } else {
        pending.push({ ...scoreData, timestamp: Date.now() });
      }
    } else {
      pending.push({ ...scoreData, timestamp: Date.now() });
    }

    // Keep only last 10
    localStorage.setItem(key, JSON.stringify(pending.slice(-10)));
  }

  async function syncGuestScores(gameId) {
    if (!currentUser || !window.apiClient) return;
    const key = `${gameId}-pending-scores`;
    const pending = JSON.parse(localStorage.getItem(key) || '[]');
    if (pending.length === 0) return;

    // Submit the best score
    const best = pending.reduce((a, b) => b.score > a.score ? b : a, pending[0]);
    try {
      await window.apiClient.submitScore(gameId, {
        score: best.score,
        level: best.level,
        timeMs: best.timeMs,
        metadata: best.metadata,
      });
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`[${gameId}] Guest score sync failed:`, error);
    }
  }

  // ─── Achievements ───

  async function unlockAchievement(achievementId, gameId) {
    if (!currentUser || !window.apiClient) return;
    try {
      await window.apiClient.unlockAchievement(achievementId, gameId);
    } catch (error) {
      // Silent fail for achievements
    }
  }

  // ─── Export ───

  window.gameCloud = {
    initAuth,
    getUser,
    isSignedIn,
    submitScore,
    submitOrQueue,
    loadState,
    saveState,
    saveGuestScore,
    syncGuestScores,
    unlockAchievement,
    requestWakeLock,
    releaseWakeLock,
  };
})();
