import { Injectable, Logger } from '@nestjs/common';

export type PresenceStatus = 'online' | 'idle' | 'in-game' | 'offline';

interface PlayerPresence {
  uid: string;
  status: PresenceStatus;
  currentSessionId: string | null;
  lastSeen: Date;
}

/**
 * Tracks player online/offline/in-game status.
 * Purely in-memory — presence is ephemeral and doesn't need persistence.
 */
@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  private readonly presence = new Map<string, PlayerPresence>();

  setOnline(uid: string): void {
    this.presence.set(uid, {
      uid,
      status: 'online',
      currentSessionId: null,
      lastSeen: new Date(),
    });
  }

  setInGame(uid: string, sessionId: string): void {
    const existing = this.presence.get(uid);
    this.presence.set(uid, {
      uid,
      status: 'in-game',
      currentSessionId: sessionId,
      lastSeen: new Date(),
      ...existing && { uid: existing.uid },
    });
  }

  setOffline(uid: string): void {
    this.presence.delete(uid);
  }

  getStatus(uid: string): PlayerPresence | null {
    return this.presence.get(uid) ?? null;
  }

  /** Get presence for a list of UIDs (e.g., friends list) */
  getBulkStatus(uids: string[]): Record<string, PresenceStatus> {
    const result: Record<string, PresenceStatus> = {};
    for (const uid of uids) {
      const p = this.presence.get(uid);
      result[uid] = p?.status ?? 'offline';
    }
    return result;
  }

  getOnlineCount(): number {
    return this.presence.size;
  }
}
