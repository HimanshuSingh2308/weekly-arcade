/**
 * API Client for Weekly Arcade Backend
 * Handles all API communication with the NestJS backend
 */

const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:8080/api'
  : 'https://weekly-arcade-api-5171085645.us-central1.run.app/api';

class ApiClient {
  constructor() {
    this.token = null;
    this._cache = new Map(); // key -> { data, expiry }
  }

  /**
   * Set the auth token for API calls
   */
  setToken(token) {
    this.token = token;
  }

  /**
   * Clear the auth token
   */
  clearToken() {
    this.token = null;
  }

  /**
   * Make an authenticated API request
   */
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    } else if (options.method && options.method !== 'GET') {
      console.warn(`[ApiClient] No auth token set for ${options.method} ${endpoint}`);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        console.error(`[ApiClient] Request failed: ${options.method || 'GET'} ${endpoint}`, { status: response.status, error });
        throw new Error(error.message || `API Error: ${response.status}`);
      }

      // Handle empty responses
      if (response.status === 204) {
        return null;
      }

      const text = await response.text();
      if (!text || text === 'null') return null;
      return JSON.parse(text);
    } catch (error) {
      console.error(`[ApiClient] Request exception: ${endpoint}`, error);
      throw error;
    }
  }

  // Auth endpoints
  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async getMe() {
    return this.request('/auth/me');
  }

  async deleteAccount() {
    return this.request('/auth/account', {
      method: 'DELETE',
    });
  }

  // User endpoints
  async getProfile() {
    return this.request('/users/profile');
  }

  async updateProfile(data) {
    return this.request('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateSettings(settings) {
    return this.request('/users/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async getFriends() {
    return this.request('/users/friends');
  }

  async addFriend(friendUid) {
    return this.request('/users/friends', {
      method: 'POST',
      body: JSON.stringify({ friendUid }),
    });
  }

  async removeFriend(friendUid) {
    return this.request(`/users/friends/${friendUid}`, {
      method: 'DELETE',
    });
  }

  // Game Catalog (public, no auth needed)
  async getGameCatalog() {
    const cacheKey = 'game-catalog';
    const cached = this._cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) return cached.data;

    const data = await this.request('/games/catalog');
    this._cache.set(cacheKey, { data, expiry: Date.now() + 3600000 }); // 1 hour
    return data;
  }

  // Game State endpoints
  async getGameState(gameId) {
    return this.request(`/games/${gameId}/state`);
  }

  async saveGameState(gameId, state) {
    return this.request(`/games/${gameId}/state`, {
      method: 'PUT',
      body: JSON.stringify(state),
    });
  }

  async getAllGameStates() {
    return this.request('/games/states');
  }

  // Leaderboard endpoints
  /**
   * Submit a score to the leaderboard
   * @param {string} gameId - Game identifier (e.g., 'wordle', 'snake', '2048', 'chaos-kitchen')
   * @param {Object} scoreData - Score data object
   * @param {number} scoreData.score - The score value (required)
   * @param {number} [scoreData.level] - Current level (optional)
   * @param {number} [scoreData.guessCount] - Number of guesses/attempts (optional)
   * @param {number} [scoreData.timeMs] - Time in milliseconds (optional)
   * @param {Object} [scoreData.metadata] - Additional game-specific data (optional)
   */
  async submitScore(gameId, scoreData) {
    if (typeof scoreData !== 'object' || typeof scoreData.score !== 'number') {
      console.error('[ApiClient] submitScore: scoreData must be an object with a score property');
      throw new Error('Invalid scoreData format');
    }

    // Nudge guest players to sign in when they try to submit a score
    if (!this.token && window.authNudge) {
      window.authNudge.show();
    }

    console.log(`[ApiClient] Submitting score for ${gameId}:`, { score: scoreData.score, hasToken: !!this.token });
    const result = await this.request(`/leaderboard/${gameId}/submit`, {
      method: 'POST',
      body: JSON.stringify(scoreData),
    });
    console.log(`[ApiClient] Score submitted for ${gameId}:`, result);
    // Invalidate leaderboard cache for this game so fresh data loads
    for (const key of this._cache.keys()) {
      if (key.startsWith(`lb:${gameId}:`)) this._cache.delete(key);
    }
    return result;
  }

  async getLeaderboard(gameId, period = 'daily', limit = 50) {
    const cacheKey = `lb:${gameId}:${period}:${limit}`;
    const cached = this._cache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }
    const data = await this.request(`/leaderboard/${gameId}/${period}?limit=${limit}`);
    this._cache.set(cacheKey, { data, expiry: Date.now() + 60000 }); // 60s TTL
    return data;
  }

  async getFriendsLeaderboard(gameId, period = 'daily') {
    return this.request(`/leaderboard/${gameId}/${period}/friends`);
  }

  async getMyRank(gameId, period = 'daily') {
    return this.request(`/leaderboard/${gameId}/${period}/rank`);
  }

  // Achievements endpoints
  async getAllAchievements() {
    return this.request('/achievements');
  }

  async getMyAchievements() {
    return this.request('/achievements/me');
  }

  async getAchievementProgress() {
    return this.request('/achievements/progress');
  }

  async unlockAchievement(achievementId, gameId = null, metadata = null) {
    return this.request('/achievements/unlock', {
      method: 'POST',
      body: JSON.stringify({
        achievementId,
        gameId,
        metadata,
      }),
    });
  }

  // ============ CUSTOMIZATION ENDPOINTS ============

  /**
   * Get item catalog for a game
   * @param {string} gameId - Game identifier (e.g., 'voidbreak')
   * @returns {Promise<{items: Array, gameId: string}>}
   */
  async getCatalog(gameId) {
    return this.request(`/customizations/catalog/${gameId}`);
  }

  /**
   * Get user's inventory (coins + owned items)
   * @returns {Promise<{coins: number, totalCoinsEarned: number, items: Array, ownedItemIds: string[]}>}
   */
  async getInventory() {
    return this.request('/customizations/inventory');
  }

  /**
   * Get equipped items for a game
   * @param {string} gameId - Game identifier
   * @returns {Promise<{gameId: string, equipped: Object}>}
   */
  async getEquipped(gameId) {
    return this.request(`/customizations/equipped/${gameId}`);
  }

  /**
   * Purchase item with coins
   * @param {string} itemId - Item to purchase
   * @returns {Promise<{success: boolean, item: Object, coinsSpent: number, newBalance: number, transactionId: string}>}
   */
  async purchaseItem(itemId) {
    return this.request('/customizations/purchase', {
      method: 'POST',
      body: JSON.stringify({ itemId }),
    });
  }

  /**
   * Equip an owned item
   * @param {string} gameId - Game identifier
   * @param {string} itemType - Type: 'ship', 'trail', 'bullet', 'hud', 'class'
   * @param {string|null} itemId - Item to equip, or null to unequip
   * @returns {Promise<{success: boolean, equipped: Object}>}
   */
  async equipItem(gameId, itemType, itemId) {
    return this.request('/customizations/equip', {
      method: 'POST',
      body: JSON.stringify({ gameId, itemType, itemId }),
    });
  }

  /**
   * Add coins (called after game events)
   * @param {number} amount - Coins to add
   * @param {string} type - Transaction type: 'game_reward', 'achievement', etc.
   * @param {string} gameId - Game that awarded coins
   * @param {string} description - Description of why coins were earned
   * @param {Object} [metadata] - Additional metadata
   * @returns {Promise<{success: boolean, coinsAdded: number, newBalance: number, transactionId: string}>}
   */
  /**
   * @deprecated Coins are now awarded server-side during score submission.
   * This method is a no-op kept for backward compatibility.
   */
  async addCoins(amount, type, gameId, description, metadata = {}) {
    console.warn('[ApiClient] addCoins() is deprecated — coins are awarded server-side during score submission');
    return { success: true, coinsAdded: 0, newBalance: 0, transactionId: 'deprecated' };
  }

  /**
   * Get coin balance
   * @returns {Promise<{coins: number, totalCoinsEarned: number}>}
   */
  async getCoinBalance() {
    return this.request('/customizations/coins/balance');
  }

  /**
   * Get coin transaction history
   * @param {number} [limit=50] - Max transactions to return
   * @returns {Promise<{transactions: Array, totalCount: number}>}
   */
  async getCoinHistory(limit = 50) {
    return this.request(`/customizations/coins/history?limit=${limit}`);
  }

  // ─── Notifications ───

  async getNotificationConfig() {
    return this.request('/notifications/config');
  }

  async registerPushToken(token, deviceInfo) {
    return this.request('/notifications/token', {
      method: 'POST',
      body: JSON.stringify({ token, deviceInfo }),
    });
  }

  async removePushToken(token) {
    return this.request('/notifications/token', {
      method: 'DELETE',
      body: JSON.stringify({ token }),
    });
  }

  async getNotificationStatus() {
    return this.request('/notifications/status');
  }
}

// Export singleton instance
window.apiClient = new ApiClient();
