import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { NotificationType } from '@weekly-arcade/shared';
import * as crypto from 'crypto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly tokensCollection = 'push-tokens';
  private readonly logsCollection = 'notification-logs';
  private readonly usersCollection = 'users';

  private readonly MAX_PER_DAY = 10;
  private readonly MAX_PER_WEEK = 10;
  private readonly BATCH_SIZE = 500;

  // In-memory cache for frequency cap checks (avoids 2 Firestore queries per notification)
  // Stores uid → { capped: boolean, expiry: timestamp }
  private readonly capCache = new Map<string, { capped: boolean; expiry: number }>();
  private readonly CAP_CACHE_TTL_MS = 60_000; // 60 seconds

  constructor(private readonly firebaseService: FirebaseService) {}

  async registerToken(uid: string, token: string, deviceInfo?: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex').slice(0, 8);
    const docId = `${uid}_${tokenHash}`;

    await this.firebaseService.doc(`${this.tokensCollection}/${docId}`).set({
      uid,
      token,
      deviceInfo: deviceInfo || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.logger.log(`Registered push token for user ${uid}`);
  }

  async removeToken(uid: string, token: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex').slice(0, 8);
    const docId = `${uid}_${tokenHash}`;

    await this.firebaseService.doc(`${this.tokensCollection}/${docId}`).delete();
    this.logger.log(`Removed push token for user ${uid}`);
  }

  async getUserTokens(uid: string): Promise<string[]> {
    const snapshot = await this.firebaseService
      .collection(this.tokensCollection)
      .where('uid', '==', uid)
      .get();

    return snapshot.docs.map((doc) => doc.data().token as string);
  }

  async getTokenCount(uid: string): Promise<number> {
    const snapshot = await this.firebaseService
      .collection(this.tokensCollection)
      .where('uid', '==', uid)
      .get();

    return snapshot.size;
  }

  async sendToUser(
    uid: string,
    title: string,
    body: string,
    type: NotificationType,
    data?: Record<string, string>
  ): Promise<boolean> {
    // Check user has notifications enabled
    const userDoc = await this.firebaseService.doc(`${this.usersCollection}/${uid}`).get();
    if (!userDoc.exists) return false;

    const user = userDoc.data();
    if (!user?.settings?.notificationsEnabled) return false;

    // Check frequency cap
    const withinCap = await this.checkFrequencyCap(uid);
    if (!withinCap) {
      this.logger.debug(`Frequency cap reached for user ${uid}, skipping notification`);
      return false;
    }

    const tokens = await this.getUserTokens(uid);
    if (tokens.length === 0) return false;

    const messaging = this.firebaseService.messaging;
    const staleTokens: string[] = [];

    // Send to all user devices
    const results = await Promise.allSettled(
      tokens.map((token) =>
        messaging.send({
          token,
          notification: { title, body },
          data: {
            ...data,
            type,
            sound: '/sounds/notification.wav',
          },
          webpush: {
            notification: {
              icon: '/icons/icon-192.png',
              badge: '/icons/icon-192.png',
              tag: type,
            },
          },
        })
      )
    );

    // Clean up stale tokens
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'rejected') {
        const errorCode = (result.reason as { code?: string })?.code;
        const errorMsg = (result.reason as { message?: string })?.message;
        this.logger.warn(`FCM send failed for user ${uid}: code=${errorCode}, message=${errorMsg}`);
        if (
          errorCode === 'messaging/registration-token-not-registered' ||
          errorCode === 'messaging/invalid-registration-token'
        ) {
          staleTokens.push(tokens[i]);
        }
      }
    }

    if (staleTokens.length > 0) {
      await Promise.all(staleTokens.map((token) => this.removeToken(uid, token)));
      this.logger.warn(`Cleaned up ${staleTokens.length} stale tokens for user ${uid}`);
    }

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    if (successCount > 0) {
      await this.logNotification(uid, type, title, body);
    }

    return successCount > 0;
  }

  async sendToAllOptedIn(
    title: string,
    body: string,
    type: NotificationType,
    data?: Record<string, string>
  ): Promise<{ sent: number; failed: number }> {
    // Get all users with notifications enabled
    const usersSnapshot = await this.firebaseService
      .collection(this.usersCollection)
      .where('settings.notificationsEnabled', '==', true)
      .get();

    const uids = usersSnapshot.docs.map((doc) => doc.id);
    this.logger.log(`Sending "${type}" notification to ${uids.length} opted-in users`);

    let sent = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < uids.length; i += this.BATCH_SIZE) {
      const batch = uids.slice(i, i + this.BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((uid) => this.sendToUser(uid, title, body, type, data))
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          sent++;
        } else {
          failed++;
        }
      }
    }

    this.logger.log(`Broadcast "${type}" complete: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  }

  async checkFrequencyCap(uid: string): Promise<boolean> {
    // Check in-memory cache first (avoids 2 Firestore queries)
    const cached = this.capCache.get(uid);
    if (cached && Date.now() < cached.expiry) {
      return !cached.capped;
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Check daily cap
    const dailySnapshot = await this.firebaseService
      .collection(this.logsCollection)
      .where('uid', '==', uid)
      .where('sentAt', '>=', oneDayAgo)
      .get();

    if (dailySnapshot.size >= this.MAX_PER_DAY) {
      this.capCache.set(uid, { capped: true, expiry: Date.now() + this.CAP_CACHE_TTL_MS });
      return false;
    }

    // Check weekly cap
    const weeklySnapshot = await this.firebaseService
      .collection(this.logsCollection)
      .where('uid', '==', uid)
      .where('sentAt', '>=', oneWeekAgo)
      .get();

    const capped = weeklySnapshot.size >= this.MAX_PER_WEEK;
    this.capCache.set(uid, { capped, expiry: Date.now() + this.CAP_CACHE_TTL_MS });
    return !capped;
  }

  async logNotification(
    uid: string,
    type: NotificationType,
    title: string,
    body: string
  ): Promise<void> {
    await this.firebaseService.collection(this.logsCollection).add({
      uid,
      type,
      sentAt: new Date(),
      title,
      body,
    });
  }

  /**
   * Get all users who played yesterday but not today (streak at risk)
   */
  async getUsersWithStreakAtRisk(): Promise<
    Array<{ uid: string; displayName: string; currentPlayStreak: number }>
  > {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const snapshot = await this.firebaseService
      .collection(this.usersCollection)
      .where('settings.notificationsEnabled', '==', true)
      .where('lastPlayedDate', '==', yesterday)
      .get();

    return snapshot.docs
      .filter((doc) => {
        const data = doc.data();
        return data.lastPlayedDate !== today && (data.currentPlayStreak || 0) >= 2;
      })
      .map((doc) => {
        const data = doc.data();
        return {
          uid: doc.id,
          displayName: data.displayName || 'Player',
          currentPlayStreak: data.currentPlayStreak || 0,
        };
      });
  }

  /**
   * Get all users with streak milestones hit today
   */
  async getUsersWithStreakMilestones(): Promise<
    Array<{ uid: string; displayName: string; currentPlayStreak: number }>
  > {
    const today = new Date().toISOString().split('T')[0];
    const milestones = [3, 7, 14, 30, 50, 100];

    const snapshot = await this.firebaseService
      .collection(this.usersCollection)
      .where('settings.notificationsEnabled', '==', true)
      .where('lastPlayedDate', '==', today)
      .get();

    return snapshot.docs
      .filter((doc) => {
        const data = doc.data();
        return milestones.includes(data.currentPlayStreak || 0);
      })
      .map((doc) => {
        const data = doc.data();
        return {
          uid: doc.id,
          displayName: data.displayName || 'Player',
          currentPlayStreak: data.currentPlayStreak || 0,
        };
      });
  }
}
