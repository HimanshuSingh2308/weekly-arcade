/**
 * Offline Sync Manager for Weekly Arcade
 * Handles offline queue and background sync for API calls
 */

const SYNC_QUEUE_KEY = 'weekly-arcade-sync-queue';

class SyncManager {
  constructor() {
    this.queue = this.loadQueue();
    this.isSyncing = false;
  }

  /**
   * Load queue from localStorage
   */
  loadQueue() {
    try {
      const stored = localStorage.getItem(SYNC_QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * Save queue to localStorage
   */
  saveQueue() {
    try {
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  /**
   * Add an item to the sync queue
   */
  enqueue(action) {
    this.queue.push({
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      ...action,
    });
    this.saveQueue();
    this.attemptSync();
  }

  /**
   * Remove an item from the queue
   */
  dequeue(id) {
    this.queue = this.queue.filter(item => item.id !== id);
    this.saveQueue();
  }

  /**
   * Attempt to sync all queued items
   */
  async attemptSync() {
    if (this.isSyncing || !navigator.onLine || !window.authManager?.isSignedIn()) {
      return;
    }

    this.isSyncing = true;

    try {
      const itemsToSync = [...this.queue];

      for (const item of itemsToSync) {
        try {
          await this.processItem(item);
          this.dequeue(item.id);
        } catch (error) {
          console.error(`Failed to sync item ${item.id}:`, error);
          // Keep item in queue for retry
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Process a single sync queue item
   */
  async processItem(item) {
    switch (item.type) {
      case 'SUBMIT_SCORE':
        await window.apiClient.submitScore(item.gameId, item.scoreData);
        break;

      case 'SAVE_GAME_STATE':
        await window.apiClient.saveGameState(item.gameId, item.stateData);
        break;

      case 'UNLOCK_ACHIEVEMENT':
        await window.apiClient.unlockAchievement(
          item.achievementId,
          item.gameId,
          item.metadata
        );
        break;

      default:
        console.warn(`Unknown sync item type: ${item.type}`);
    }
  }

  /**
   * Queue a score submission
   */
  queueScoreSubmit(gameId, scoreData) {
    // Try immediate submit if online
    if (navigator.onLine && window.authManager?.isSignedIn()) {
      window.apiClient.submitScore(gameId, scoreData).catch(() => {
        // If immediate fails, queue for later
        this.enqueue({
          type: 'SUBMIT_SCORE',
          gameId,
          scoreData,
        });
      });
    } else {
      this.enqueue({
        type: 'SUBMIT_SCORE',
        gameId,
        scoreData,
      });
    }
  }

  /**
   * Queue a game state save
   */
  queueGameStateSave(gameId, stateData) {
    // Try immediate save if online
    if (navigator.onLine && window.authManager?.isSignedIn()) {
      window.apiClient.saveGameState(gameId, stateData).catch(() => {
        // If immediate fails, queue for later
        this.enqueue({
          type: 'SAVE_GAME_STATE',
          gameId,
          stateData,
        });
      });
    } else {
      this.enqueue({
        type: 'SAVE_GAME_STATE',
        gameId,
        stateData,
      });
    }
  }

  /**
   * Queue an achievement unlock
   */
  queueAchievementUnlock(achievementId, gameId, metadata) {
    // Try immediate unlock if online
    if (navigator.onLine && window.authManager?.isSignedIn()) {
      window.apiClient.unlockAchievement(achievementId, gameId, metadata).catch(() => {
        // If immediate fails, queue for later
        this.enqueue({
          type: 'UNLOCK_ACHIEVEMENT',
          achievementId,
          gameId,
          metadata,
        });
      });
    } else {
      this.enqueue({
        type: 'UNLOCK_ACHIEVEMENT',
        achievementId,
        gameId,
        metadata,
      });
    }
  }

  /**
   * Get pending sync count
   */
  getPendingCount() {
    return this.queue.length;
  }
}

// Export singleton instance
window.syncManager = new SyncManager();

// Listen for online status changes
window.addEventListener('online', () => {
  console.log('Back online, attempting sync...');
  window.syncManager.attemptSync();
});

// Listen for auth state changes
window.authManager?.onAuthStateChanged((user) => {
  if (user) {
    window.syncManager.attemptSync();
  }
});
