/**
 * Firebase Authentication for Weekly Arcade
 * Handles user sign-in, sign-out, and auth state management
 */

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAFA4KwOaQpa0A-v2auCulStCrOgScrz-g",
  authDomain: "loyal-curve-425715-h6.firebaseapp.com",
  projectId: "loyal-curve-425715-h6",
  storageBucket: "loyal-curve-425715-h6.firebasestorage.app",
  messagingSenderId: "5171085645",
  appId: "1:5171085645:web:b01fbc558d626f649e3704"
};

class AuthManager {
  constructor() {
    this.user = null;
    this.isInitialized = false;
    this.listeners = [];
    this.firebase = null;
    this.auth = null;
    this._cacheKey = 'wa-cached-user';

    // Restore cached user immediately (before Firebase loads)
    this._restoreCachedUser();
  }

  _restoreCachedUser() {
    try {
      const cached = localStorage.getItem(this._cacheKey);
      if (!cached) return;
      const data = JSON.parse(cached);
      // Expire after 24 hours to prevent stale sessions
      if (data._ts && Date.now() - data._ts > 86400000) {
        localStorage.removeItem(this._cacheKey);
        return;
      }
      // Create a lightweight user-like object for instant UI rendering
      this.user = {
        uid: data.uid,
        email: data.email,
        displayName: data.displayName,
        photoURL: data.photoURL,
        _cached: true, // flag so we know this isn't a real Firebase user
      };
    } catch (e) {
      // Cache corrupted — ignore
      localStorage.removeItem(this._cacheKey);
    }
  }

  _cacheUser(user) {
    try {
      if (user) {
        localStorage.setItem(this._cacheKey, JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          _ts: Date.now(),
        }));
      } else {
        localStorage.removeItem(this._cacheKey);
        localStorage.removeItem('wa-cached-token');
      }
    } catch (e) {}
  }

  _cacheToken(token) {
    try {
      if (token) {
        localStorage.setItem('wa-cached-token', JSON.stringify({
          token,
          _ts: Date.now(),
        }));
      }
    } catch (e) {}
  }

  _getCachedToken() {
    try {
      const cached = localStorage.getItem('wa-cached-token');
      if (!cached) return null;
      const data = JSON.parse(cached);
      // Firebase ID tokens expire after 1 hour — use if less than 55 min old
      if (data._ts && Date.now() - data._ts > 55 * 60 * 1000) {
        localStorage.removeItem('wa-cached-token');
        return null;
      }
      return data.token;
    } catch (e) {
      return null;
    }
  }

  /**
   * Initialize Firebase Auth
   */
  async init() {
    if (this.isInitialized) return;
    const _t0 = performance.now();
    console.log('[Auth] init() started at', Math.round(_t0), 'ms');

    // If we have a cached user, notify listeners immediately for instant UI
    if (this.user && this.user._cached) {
      this.isInitialized = true;
      this.notifyListeners();
      console.log('[Auth] Cached user notified at', Math.round(performance.now() - _t0), 'ms');

      // Try to restore the Firebase ID token from localStorage cache
      // (Firebase stores it but onAuthStateChanged takes 20-30s to fire)
      const cachedToken = this._getCachedToken();
      if (cachedToken) {
        window.apiClient?.setToken(cachedToken);
        console.log('[Auth] Cached token restored at', Math.round(performance.now() - _t0), 'ms');
      }
    }

    try {
      // Dynamically load Firebase SDK if not already present
      if (typeof firebase === 'undefined') {
        console.log('[Auth] Loading Firebase SDK...');
        await this._loadFirebaseSDK();
        console.log('[Auth] Firebase SDK loaded at', Math.round(performance.now() - _t0), 'ms');
      } else {
        console.log('[Auth] Firebase SDK already present at', Math.round(performance.now() - _t0), 'ms');
      }

      if (typeof firebase === 'undefined') {
        console.warn('Firebase SDK failed to load. Auth features disabled.');
        this.isInitialized = true;
        return;
      }

      // Initialize Firebase if not already initialized
      if (!firebase.apps.length) {
        this.firebase = firebase.initializeApp(firebaseConfig);
      } else {
        this.firebase = firebase.app();
      }
      console.log('[Auth] Firebase app initialized at', Math.round(performance.now() - _t0), 'ms');

      this.auth = firebase.auth();

      // Guard against concurrent getIdToken calls (Firebase SDK race condition)
      let _tokenRefreshInProgress = false;

      // Listen for auth state changes
      console.log('[Auth] Registering onAuthStateChanged at', Math.round(performance.now() - _t0), 'ms');
      this.auth.onAuthStateChanged(async (user) => {
        console.log('[Auth] onAuthStateChanged fired at', Math.round(performance.now() - _t0), 'ms', user ? 'SIGNED IN' : 'SIGNED OUT');
        this.user = user;
        this._cacheUser(user);

        if (user) {
          // Get ID token — skip if another refresh is in progress
          if (!_tokenRefreshInProgress) {
            _tokenRefreshInProgress = true;
            try {
              const token = await user.getIdToken();
              window.apiClient?.setToken(token);
              this._cacheToken(token); // Cache for instant restore on next page load
              console.log('[Auth] Token set + cached at', Math.round(performance.now() - _t0), 'ms');
            } catch (e) {
              console.warn('[Auth] Token fetch in onAuthStateChanged failed:', e.message);
            } finally {
              _tokenRefreshInProgress = false;
            }
          }

          // Register/update user on backend with retry
          const registerUser = async (retries = 3) => {
            try {
              await window.apiClient?.register({
                email: user.email,
                displayName: user.displayName || user.email?.split('@')[0] || 'Player',
                avatarUrl: user.photoURL,
              });
              console.log('User registered on backend');
            } catch (error) {
              console.error('Failed to register user on backend:', error);
              if (retries > 0) {
                // Retry after a short delay
                await new Promise(resolve => setTimeout(resolve, 1000));
                return registerUser(retries - 1);
              }
            }
          };

          // Register in background (don't block auth state notification)
          registerUser();
        } else {
          window.apiClient?.clearToken();
        }

        // Notify listeners
        this.notifyListeners();
      });

      // Refresh token periodically (every 50 minutes)
      setInterval(async () => {
        if (this.user && !_tokenRefreshInProgress) {
          _tokenRefreshInProgress = true;
          try {
            const token = await this.user.getIdToken(true);
            window.apiClient?.setToken(token);
            this._cacheToken(token);
          } catch (e) {
            console.warn('[Auth] Periodic token refresh failed:', e.message);
          } finally {
            _tokenRefreshInProgress = false;
          }
        }
      }, 50 * 60 * 1000);

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Firebase Auth:', error);
      this.isInitialized = true;
    }
  }

  /**
   * Sign in with Google
   */
  async signInWithGoogle() {
    if (!this.auth) {
      console.warn('Auth not initialized');
      return null;
    }

    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await this.auth.signInWithPopup(provider);
      return result.user;
    } catch (error) {
      console.error('Google sign-in failed:', error);
      throw error;
    }
  }

  /**
   * Sign in with email and password
   */
  async signInWithEmail(email, password) {
    if (!this.auth) {
      console.warn('Auth not initialized');
      return null;
    }

    try {
      const result = await this.auth.signInWithEmailAndPassword(email, password);
      return result.user;
    } catch (error) {
      console.error('Email sign-in failed:', error);
      throw error;
    }
  }

  /**
   * Create account with email and password
   */
  async createAccount(email, password, displayName) {
    if (!this.auth) {
      console.warn('Auth not initialized');
      return null;
    }

    try {
      const result = await this.auth.createUserWithEmailAndPassword(email, password);

      // Update display name
      if (displayName) {
        await result.user.updateProfile({ displayName });
      }

      return result.user;
    } catch (error) {
      console.error('Account creation failed:', error);
      throw error;
    }
  }

  /**
   * Sign out
   */
  async signOut() {
    if (!this.auth) {
      console.warn('Auth not initialized');
      return;
    }

    try {
      this._cacheUser(null);
      await this.auth.signOut();
    } catch (error) {
      console.error('Sign-out failed:', error);
      throw error;
    }
  }

  /**
   * Check if user is signed in
   */
  isSignedIn() {
    return this.user !== null;
  }

  /**
   * Get current user
   */
  getUser() {
    return this.user;
  }

  /**
   * Get current user (alias for compatibility)
   */
  get currentUser() {
    return this.user;
  }

  /**
   * Get current user's ID token
   */
  async getIdToken() {
    if (!this.user) return null;
    return this.user.getIdToken();
  }

  /**
   * Add auth state change listener
   */
  onAuthStateChanged(callback) {
    this.listeners.push(callback);
    // Immediately call with current state
    // Cached users now have a valid token (cached alongside user), so they're usable
    if (this.user) {
      callback(this.user);
    } else {
      callback(null);
    }
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Notify all listeners of auth state change
   */
  notifyListeners() {
    this.listeners.forEach(listener => listener(this.user));
  }

  /**
   * Dynamically load Firebase SDK scripts
   */
  async _loadFirebaseSDK() {
    const loadScript = (src) => new Promise((resolve, reject) => {
      // Check if already loaded
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    try {
      // firebase-app must load first (others depend on it)
      await loadScript('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
      // auth and messaging can load in parallel
      await Promise.all([
        loadScript('https://www.gstatic.com/firebasejs/10.7.0/firebase-auth-compat.js'),
        loadScript('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js'),
      ]);
    } catch (e) {
      console.warn('Failed to load Firebase SDK:', e);
    }
  }
}

// ─── Auth Nudge ───
// Prompts guest players to sign in after a game round.
// Triggered automatically when apiClient.submitScore() is called without auth.
// Self-injects HTML/CSS on first show — no per-game markup needed.
const AuthNudge = (() => {
  const DISMISS_KEY = 'auth-nudge-dismissed';
  const DISMISS_HOURS = 1;
  const MAX_PER_SESSION = 5;
  let shown = 0;
  let injected = false;

  function shouldShow() {
    if (window.authManager?.currentUser) return false;
    if (shown >= MAX_PER_SESSION) return false;
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - parseInt(dismissed, 10) < DISMISS_HOURS * 3600000) return false;
    return true;
  }

  function inject() {
    if (injected) return;
    injected = true;

    const style = document.createElement('style');
    style.textContent = `
      .auth-nudge-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:9999;opacity:0;visibility:hidden;transition:opacity .3s,visibility .3s}
      .auth-nudge-overlay.visible{opacity:1;visibility:visible}
      .auth-nudge{background:#16213e;border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:2rem 1.75rem;max-width:360px;width:90%;text-align:center;transform:translateY(20px) scale(.95);transition:transform .3s;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#f0f0f5}
      .auth-nudge-overlay.visible .auth-nudge{transform:translateY(0) scale(1)}
      .auth-nudge-icon{font-size:2.5rem;margin-bottom:.75rem}
      .auth-nudge h3{font-size:1.25rem;font-weight:700;margin-bottom:.4rem}
      .auth-nudge p{color:#8888a8;font-size:.9rem;margin-bottom:1.25rem;line-height:1.5}
      .auth-nudge-benefits{display:flex;gap:1rem;justify-content:center;margin-bottom:1.25rem;flex-wrap:wrap}
      .auth-nudge-benefit{font-size:.78rem;color:#8888a8;display:flex;align-items:center;gap:.3rem}
      .auth-nudge-benefit span{font-size:1rem}
      .auth-nudge-google{display:flex;align-items:center;justify-content:center;gap:.6rem;width:100%;padding:.8rem 1rem;background:#fff;color:#333;border:none;border-radius:12px;font-size:.95rem;font-weight:600;cursor:pointer;transition:transform .2s,background .2s}
      .auth-nudge-google:hover{background:#f5f5f5;transform:scale(1.02)}
      .auth-nudge-google img{width:18px;height:18px}
      .auth-nudge-skip{margin-top:.75rem;background:none;border:none;color:#8888a8;font-size:.82rem;cursor:pointer;padding:.5rem;transition:color .2s}
      .auth-nudge-skip:hover{color:#f0f0f5}
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'auth-nudge-overlay';
    overlay.id = 'authNudgeOverlay';
    overlay.innerHTML = `
      <div class="auth-nudge">
        <div class="auth-nudge-icon">🏆</div>
        <h3>Nice game!</h3>
        <p>Sign in to save your score to the leaderboard and track your progress.</p>
        <div class="auth-nudge-benefits">
          <div class="auth-nudge-benefit"><span>📊</span> Leaderboards</div>
          <div class="auth-nudge-benefit"><span>💾</span> Cloud saves</div>
          <div class="auth-nudge-benefit"><span>🏅</span> Achievements</div>
        </div>
        <button class="auth-nudge-google" id="authNudgeSignIn">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google">
          Continue with Google
        </button>
        <button class="auth-nudge-skip" id="authNudgeSkip">Maybe later</button>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) dismiss(); });
    document.getElementById('authNudgeSignIn').addEventListener('click', async () => {
      try { await window.authManager.signInWithGoogle(); hide(); } catch (e) { console.error('Nudge sign-in failed:', e); }
    });
    document.getElementById('authNudgeSkip').addEventListener('click', dismiss);
  }

  function show() {
    if (!shouldShow()) return;
    inject();
    shown++;
    setTimeout(() => { document.getElementById('authNudgeOverlay').classList.add('visible'); }, 1200);
  }

  function hide() {
    const el = document.getElementById('authNudgeOverlay');
    if (el) el.classList.remove('visible');
  }

  function dismiss() {
    hide();
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  }

  return { show, hide, dismiss };
})();

// Export singleton instance
window.authManager = new AuthManager();
window.authNudge = AuthNudge;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.authManager.init();
  });
} else {
  window.authManager.init();
}
