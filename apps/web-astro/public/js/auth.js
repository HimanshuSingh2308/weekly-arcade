/**
 * Firebase Authentication for Weekly Arcade
 * Uses Firebase Modular SDK for fast auth state detection (~1-3s vs ~25s compat).
 * Loaded as a regular script (not module) — dynamically imports Firebase ESM.
 */

const firebaseConfig = {
  apiKey: "AIzaSyAFA4KwOaQpa0A-v2auCulStCrOgScrz-g",
  authDomain: "loyal-curve-425715-h6.firebaseapp.com",
  projectId: "loyal-curve-425715-h6",
  storageBucket: "loyal-curve-425715-h6.firebasestorage.app",
  messagingSenderId: "5171085645",
  appId: "1:5171085645:web:b01fbc558d626f649e3704"
};

const FIREBASE_VERSION = '10.14.1';
const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

class AuthManager {
  constructor() {
    this.user = null;
    this.isInitialized = false;
    this.listeners = [];
    this._auth = null;
    this._app = null;
    this._cacheKey = 'wa-cached-user';
    this._modules = {}; // Stores imported Firebase modules

    // Restore cached user immediately (before Firebase loads)
    this._restoreCachedUser();
  }

  _restoreCachedUser() {
    try {
      const cached = localStorage.getItem(this._cacheKey);
      if (!cached) return;
      const data = JSON.parse(cached);
      if (data._ts && Date.now() - data._ts > 86400000) {
        localStorage.removeItem(this._cacheKey);
        return;
      }
      this.user = {
        uid: data.uid,
        email: data.email,
        displayName: data.displayName,
        photoURL: data.photoURL,
        _cached: true,
      };
    } catch (e) {
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
      }
    } catch (e) {}
  }

  async init() {
    if (this.isInitialized) return;
    const _t0 = performance.now();
    console.log('[Auth] init() started at', Math.round(_t0), 'ms');

    // Show cached user in UI immediately
    if (this.user && this.user._cached) {
      this.isInitialized = true;
      this.notifyListeners();
      console.log('[Auth] Cached user notified at', Math.round(performance.now() - _t0), 'ms');
    }

    try {
      // Dynamically import Firebase modular SDK
      const [appModule, authModule] = await Promise.all([
        import(/* webpackIgnore: true */ `${CDN}/firebase-app.js`),
        import(/* webpackIgnore: true */ `${CDN}/firebase-auth.js`),
      ]);
      console.log('[Auth] Modular SDK loaded at', Math.round(performance.now() - _t0), 'ms');

      this._modules = { ...appModule, ...authModule };

      // Initialize app
      const { initializeApp } = appModule;
      const { getAuth, onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword,
              createUserWithEmailAndPassword, updateProfile, signOut: fbSignOut,
              GoogleAuthProvider, getIdToken } = authModule;

      // Store for use in methods
      this._fbModules = { signInWithPopup, signInWithEmailAndPassword,
        createUserWithEmailAndPassword, updateProfile, fbSignOut,
        GoogleAuthProvider, getIdToken };

      this._app = initializeApp(firebaseConfig);
      this._auth = getAuth(this._app);
      console.log('[Auth] Firebase app + auth initialized at', Math.round(performance.now() - _t0), 'ms');

      // FAST PATH: Read token directly from IndexedDB (bypasses onAuthStateChanged delay)
      // Firebase stores the token in firebaseLocalStorageDb — we read it in ~50ms
      try {
        const idbToken = await this._readTokenFromIDB();
        if (idbToken) {
          window.apiClient?.setToken(idbToken);
          this.isInitialized = true;
          // Also set user from cache if available (for UI)
          if (this.user) this.notifyListeners();
          console.log('[Auth] IDB token set at', Math.round(performance.now() - _t0), 'ms — API ready!');
        }
      } catch (e) {
        console.warn('[Auth] IDB fast path failed:', e.message);
      }

      // Token refresh guard
      let _tokenRefreshInProgress = false;

      // onAuthStateChanged still needed: confirms user, refreshes expired tokens, handles sign-out
      console.log('[Auth] Registering onAuthStateChanged at', Math.round(performance.now() - _t0), 'ms');
      onAuthStateChanged(this._auth, async (user) => {
        console.log('[Auth] onAuthStateChanged fired at', Math.round(performance.now() - _t0), 'ms', user ? 'SIGNED IN' : 'SIGNED OUT');
        this.user = user;
        this._cacheUser(user);

        if (user) {
          if (!_tokenRefreshInProgress) {
            _tokenRefreshInProgress = true;
            try {
              const token = await getIdToken(user);
              window.apiClient?.setToken(token);
              console.log('[Auth] Token set at', Math.round(performance.now() - _t0), 'ms');
            } catch (e) {
              console.warn('[Auth] Token fetch failed:', e.message);
            } finally {
              _tokenRefreshInProgress = false;
            }
          }

          // Register user on backend (background, non-blocking)
          this._registerUser(user);
        } else {
          window.apiClient?.clearToken();
        }

        this.isInitialized = true;
        this.notifyListeners();
      });

      // Refresh token periodically (every 50 minutes)
      setInterval(async () => {
        if (this._auth?.currentUser && !_tokenRefreshInProgress) {
          _tokenRefreshInProgress = true;
          try {
            const token = await getIdToken(this._auth.currentUser, true);
            window.apiClient?.setToken(token);
          } catch (e) {
            console.warn('[Auth] Periodic token refresh failed:', e.message);
          } finally {
            _tokenRefreshInProgress = false;
          }
        }
      }, 50 * 60 * 1000);

    } catch (error) {
      console.error('[Auth] Failed to initialize:', error);
      this.isInitialized = true;
    }
  }

  async _registerUser(user) {
    const register = async (retries = 3) => {
      try {
        await window.apiClient?.register({
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0] || 'Player',
          avatarUrl: user.photoURL,
        });
      } catch (error) {
        if (retries > 0) {
          await new Promise(r => setTimeout(r, 1000));
          return register(retries - 1);
        }
      }
    };
    register();
  }

  async signInWithGoogle() {
    if (!this._auth || !this._fbModules) {
      console.warn('Auth not initialized');
      return null;
    }
    try {
      const { signInWithPopup, GoogleAuthProvider } = this._fbModules;
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(this._auth, provider);
      return result.user;
    } catch (error) {
      console.error('Google sign-in failed:', error);
      throw error;
    }
  }

  async signInWithEmail(email, password) {
    if (!this._auth || !this._fbModules) return null;
    try {
      const { signInWithEmailAndPassword } = this._fbModules;
      const result = await signInWithEmailAndPassword(this._auth, email, password);
      return result.user;
    } catch (error) {
      console.error('Email sign-in failed:', error);
      throw error;
    }
  }

  async createAccount(email, password, displayName) {
    if (!this._auth || !this._fbModules) return null;
    try {
      const { createUserWithEmailAndPassword, updateProfile } = this._fbModules;
      const result = await createUserWithEmailAndPassword(this._auth, email, password);
      if (displayName) {
        await updateProfile(result.user, { displayName });
      }
      return result.user;
    } catch (error) {
      console.error('Account creation failed:', error);
      throw error;
    }
  }

  async signOut() {
    if (!this._auth || !this._fbModules) return;
    try {
      const { fbSignOut } = this._fbModules;
      await fbSignOut(this._auth);
      this.user = null;
      this._cacheUser(null);
      window.apiClient?.clearToken();
      this.notifyListeners();
    } catch (error) {
      console.error('Sign-out failed:', error);
    }
  }

  get currentUser() {
    return this.user;
  }

  isSignedIn() {
    return !!this.user;
  }

  /**
   * Read Firebase auth token directly from IndexedDB (~50ms).
   * Firebase stores auth state in 'firebaseLocalStorageDb'.
   * This bypasses onAuthStateChanged which takes ~25s on web.
   */
  _readTokenFromIDB() {
    return new Promise((resolve, reject) => {
      try {
        const dbReq = indexedDB.open('firebaseLocalStorageDb');
        dbReq.onerror = () => reject(new Error('IDB open failed'));
        dbReq.onsuccess = (e) => {
          try {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('firebaseLocalStorage')) { resolve(null); return; }
            const tx = db.transaction('firebaseLocalStorage', 'readonly');
            const store = tx.objectStore('firebaseLocalStorage');
            const getAll = store.getAll();
            getAll.onsuccess = () => {
              const authEntry = getAll.result?.find(r => r.fbase_key?.includes('authUser'));
              if (authEntry?.value?.stsTokenManager?.accessToken) {
                const expiry = authEntry.value.stsTokenManager.expirationTime;
                if (expiry && Date.now() < expiry) {
                  resolve(authEntry.value.stsTokenManager.accessToken);
                } else {
                  resolve(null); // Expired
                }
              } else {
                resolve(null);
              }
            };
            getAll.onerror = () => resolve(null);
          } catch (e) { resolve(null); }
        };
      } catch (e) { reject(e); }
    });
  }

  onAuthStateChanged(callback) {
    this.listeners.push(callback);
    if (this.user) {
      callback(this.user);
    } else {
      callback(null);
    }
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notifyListeners() {
    this.listeners.forEach(listener => listener(this.user));
  }
}

// ─── Auth Nudge ───
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
      .auth-nudge p{font-size:.9rem;color:#999;margin-bottom:1.2rem;line-height:1.4}
      .auth-nudge-btn{display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;padding:.7rem;border-radius:12px;font-weight:600;font-size:.95rem;cursor:pointer;border:none;transition:transform .15s}
      .auth-nudge-btn:active{transform:scale(.97)}
      .auth-nudge-google{background:#fff;color:#222;margin-bottom:.5rem}
      .auth-nudge-dismiss{background:transparent;color:#888;font-size:.8rem;margin-top:.25rem;padding:.4rem;border:none;cursor:pointer}
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'auth-nudge-overlay';
    overlay.id = 'authNudgeOverlay';
    overlay.innerHTML = `
      <div class="auth-nudge">
        <div class="auth-nudge-icon">🏆</div>
        <h3>Save Your Progress</h3>
        <p>Sign in to save scores, track achievements, and compete on leaderboards.</p>
        <button class="auth-nudge-btn auth-nudge-google" id="authNudgeGoogle">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" width="20" height="20" style="flex-shrink:0;">
          Continue with Google
        </button>
        <button class="auth-nudge-dismiss" id="authNudgeDismiss">Not now</button>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('authNudgeGoogle').addEventListener('click', async () => {
      try {
        await window.authManager.signInWithGoogle();
        hide();
      } catch (e) {}
    });
    document.getElementById('authNudgeDismiss').addEventListener('click', dismiss);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) dismiss(); });
  }

  function show() {
    if (!shouldShow()) return;
    inject();
    shown++;
    document.getElementById('authNudgeOverlay')?.classList.add('visible');
  }

  function hide() {
    document.getElementById('authNudgeOverlay')?.classList.remove('visible');
  }

  function dismiss() {
    hide();
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  }

  return { show, hide, dismiss };
})();

// Export singleton
window.authManager = new AuthManager();
window.authNudge = AuthNudge;

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.authManager.init());
} else {
  window.authManager.init();
}
