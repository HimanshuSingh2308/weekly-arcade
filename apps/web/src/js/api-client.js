/**
 * API Client for Weekly Arcade Backend
 * Handles all API communication with the NestJS backend
 */

const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'
  : 'https://us-central1-loyal-curve-425715-h6.cloudfunctions.net/api/api';

class ApiClient {
  constructor() {
    this.token = null;
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
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || `API Error: ${response.status}`);
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return null;
      }

      return response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
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
  async submitScore(gameId, scoreData) {
    return this.request(`/leaderboard/${gameId}/submit`, {
      method: 'POST',
      body: JSON.stringify(scoreData),
    });
  }

  async getLeaderboard(gameId, period = 'daily', limit = 50) {
    return this.request(`/leaderboard/${gameId}/${period}?limit=${limit}`);
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
}

// Export singleton instance
window.apiClient = new ApiClient();
