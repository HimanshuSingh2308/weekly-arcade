import { Injectable, Logger } from '@nestjs/common';

interface RoomClient {
  uid: string;
  socketId: string;
  isSpectator: boolean;
  isReady: boolean;
  connectedAt: Date;
}

interface Room {
  sessionId: string;
  clients: Map<string, RoomClient>; // keyed by socketId
}

/**
 * Tracks Socket.IO room membership, ready states, and spectators.
 * Works alongside GameStateManager which handles game state.
 */
@Injectable()
export class GameRoomManager {
  private readonly logger = new Logger(GameRoomManager.name);
  private readonly rooms = new Map<string, Room>();

  addClient(sessionId: string, uid: string, socketId: string, isSpectator: boolean): void {
    if (!this.rooms.has(sessionId)) {
      this.rooms.set(sessionId, { sessionId, clients: new Map() });
    }

    const room = this.rooms.get(sessionId)!;
    room.clients.set(socketId, {
      uid,
      socketId,
      isSpectator,
      isReady: false,
      connectedAt: new Date(),
    });
  }

  removeClient(sessionId: string, socketId: string): void {
    const room = this.rooms.get(sessionId);
    if (!room) return;

    room.clients.delete(socketId);

    // Clean up empty rooms
    if (room.clients.size === 0) {
      this.rooms.delete(sessionId);
    }
  }

  isSpectator(sessionId: string, socketId: string): boolean {
    return this.rooms.get(sessionId)?.clients.get(socketId)?.isSpectator ?? false;
  }

  markReady(sessionId: string, uid: string): void {
    const room = this.rooms.get(sessionId);
    if (!room) return;

    for (const client of room.clients.values()) {
      if (client.uid === uid && !client.isSpectator) {
        client.isReady = true;
      }
    }
  }

  /** Get UIDs of all non-spectator players who are ready */
  getReadyPlayers(sessionId: string): string[] {
    const room = this.rooms.get(sessionId);
    if (!room) return [];

    const ready = new Set<string>();
    for (const client of room.clients.values()) {
      if (!client.isSpectator && client.isReady) {
        ready.add(client.uid);
      }
    }
    return Array.from(ready);
  }

  /** Get UIDs of all non-spectator connected players */
  getConnectedPlayers(sessionId: string): string[] {
    const room = this.rooms.get(sessionId);
    if (!room) return [];

    const players = new Set<string>();
    for (const client of room.clients.values()) {
      if (!client.isSpectator) {
        players.add(client.uid);
      }
    }
    return Array.from(players);
  }

  /** Get count of spectators */
  getSpectatorCount(sessionId: string): number {
    const room = this.rooms.get(sessionId);
    if (!room) return 0;

    let count = 0;
    for (const client of room.clients.values()) {
      if (client.isSpectator) count++;
    }
    return count;
  }

  /** Get total connected client count for a room */
  getClientCount(sessionId: string): number {
    return this.rooms.get(sessionId)?.clients.size ?? 0;
  }

  /** Get total rooms count */
  getRoomCount(): number {
    return this.rooms.size;
  }

  /** Get all active session IDs */
  getSessionIds(): string[] {
    return Array.from(this.rooms.keys());
  }
}
