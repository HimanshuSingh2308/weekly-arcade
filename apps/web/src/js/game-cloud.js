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
    const poll = setInterval(() => {
      if (window.authManager?.isInitialized) {
        clearInterval(poll);
        window.authManager.onAuthStateChanged(user => {
          currentUser = user;
          _updateAuthBtn(opts);
          if (user && opts.onSignIn) opts.onSignIn(user);
          if (!user && opts.onSignOut) opts.onSignOut();
        });
      }
    }, 100);
  }

  function _updateAuthBtn(opts) {
    const btn = opts.authBtnId ? document.getElementById(opts.authBtnId) : null;
    if (!btn) return;

    if (currentUser) {
      btn.textContent = (opts.signInStyle === 'button')
        ? 'Profile'
        : (currentUser.displayName?.split(' ')[0] || 'Player');
      btn.onclick = () => { window.location.href = '/profile/'; };
    } else {
      btn.textContent = 'Sign In';
      btn.onclick = () => {
        if (window.authManager) window.authManager.signInWithGoogle();
      };
    }
  }

  function getUser() { return currentUser; }
  function isSignedIn() { return !!currentUser; }

  // ─── Score Submission ───

  async function submitScore(gameId, scoreData) {
    if (!currentUser || !window.apiClient) {
      if (window.authNudge) window.authNudge.show();
      return null;
    }

    try {
      const result = await window.apiClient.submitScore(gameId, scoreData);
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
  };
})();
