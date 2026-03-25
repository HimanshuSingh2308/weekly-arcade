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
  }

  /**
   * Initialize Firebase Auth
   */
  async init() {
    if (this.isInitialized) return;

    try {
      // Dynamically load Firebase SDK if not already present
      if (typeof firebase === 'undefined') {
        await this._loadFirebaseSDK();
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

      this.auth = firebase.auth();

      // Listen for auth state changes
      this.auth.onAuthStateChanged(async (user) => {
        this.user = user;

        if (user) {
          // Get ID token and set it on the API client
          const token = await user.getIdToken();
          window.apiClient?.setToken(token);

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
        if (this.user) {
          const token = await this.user.getIdToken(true);
          window.apiClient?.setToken(token);
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
    callback(this.user);
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
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    try {
      await loadScript('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
      await loadScript('https://www.gstatic.com/firebasejs/10.7.0/firebase-auth-compat.js');
    } catch (e) {
      console.warn('Failed to load Firebase SDK:', e);
    }
  }
}

// Export singleton instance
window.authManager = new AuthManager();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.authManager.init();
  });
} else {
  window.authManager.init();
}
