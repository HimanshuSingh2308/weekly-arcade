import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { GameState } from '@weekly-arcade/shared';
import { SaveGameStateDto } from './dto';

// Helper to remove undefined values (Firestore doesn't accept undefined)
function removeUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  ) as T;
}

// Convert Firestore Timestamps to ISO strings for JSON serialization
function serializeDates<T extends object>(obj: T): T {
  const result = { ...obj } as Record<string, unknown>;
  for (const [key, value] of Object.entries(result)) {
    if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      result[key] = (value as { toDate: () => Date }).toDate().toISOString();
    } else if (value instanceof Date) {
      result[key] = value.toISOString();
    }
  }
  return result as T;
}

@Injectable()
export class GameStateService {
  private readonly logger = new Logger(GameStateService.name);
  private readonly usersCollection = 'users';
  private readonly gameStatesSubcollection = 'gameStates';

  constructor(private readonly firebaseService: FirebaseService) {}

  private getGameStateRef(uid: string, gameId: string) {
    return this.firebaseService.doc(
      `${this.usersCollection}/${uid}/${this.gameStatesSubcollection}/${gameId}`
    );
  }

  async getGameState(uid: string, gameId: string): Promise<GameState | null> {
    const doc = await this.getGameStateRef(uid, gameId).get();

    if (!doc.exists) {
      return null;
    }

    return serializeDates(doc.data() as GameState);
  }

  async saveGameState(
    uid: string,
    gameId: string,
    saveDto: SaveGameStateDto
  ): Promise<GameState> {
    const ref = this.getGameStateRef(uid, gameId);
    const existingDoc = await ref.get();
    const now = new Date();

    const gameState: GameState = removeUndefined({
      gameId,
      currentLevel: saveDto.currentLevel ?? 1,
      currentStreak: saveDto.currentStreak ?? 0,
      bestStreak: Math.max(
        saveDto.bestStreak ?? 0,
        saveDto.currentStreak ?? 0,
        existingDoc.exists ? (existingDoc.data() as GameState).bestStreak : 0
      ),
      gamesPlayed: saveDto.gamesPlayed ?? 0,
      gamesWon: saveDto.gamesWon ?? 0,
      guessDistribution: saveDto.guessDistribution || {},
      lastPlayedDate: saveDto.lastPlayedDate || now.toISOString().split('T')[0],
      currentGameProgress: saveDto.currentGameProgress ?? null,
      additionalData: saveDto.additionalData ?? null,
      updatedAt: now,
    });

    if (!existingDoc.exists) {
      await ref.set(removeUndefined({
        ...gameState,
        createdAt: now,
      }));
    } else {
      await ref.update(removeUndefined(gameState));
    }

    this.logger.log(`Saved game state for user ${uid}, game ${gameId}`);
    return gameState;
  }

  async getAllGameStates(uid: string): Promise<GameState[]> {
    const snapshot = await this.firebaseService
      .collection(`${this.usersCollection}/${uid}/${this.gameStatesSubcollection}`)
      .get();

    return snapshot.docs.map((doc) => serializeDates(doc.data() as GameState));
  }

  async deleteGameState(uid: string, gameId: string): Promise<void> {
    const ref = this.getGameStateRef(uid, gameId);
    const doc = await ref.get();

    if (!doc.exists) {
      throw new NotFoundException('Game state not found');
    }

    await ref.delete();
    this.logger.log(`Deleted game state for user ${uid}, game ${gameId}`);
  }

  async syncGameState(
    uid: string,
    gameId: string,
    clientState: SaveGameStateDto,
    clientLastUpdated: Date
  ): Promise<{ state: GameState; conflict: boolean }> {
    const serverState = await this.getGameState(uid, gameId);

    // No server state - just save client state
    if (!serverState) {
      const saved = await this.saveGameState(uid, gameId, clientState);
      return { state: saved, conflict: false };
    }

    // Compare timestamps to detect conflicts
    const serverUpdatedAt = serverState.updatedAt instanceof Date
      ? serverState.updatedAt
      : new Date(serverState.updatedAt as unknown as string);

    if (clientLastUpdated > serverUpdatedAt) {
      // Client is newer - save client state
      const saved = await this.saveGameState(uid, gameId, clientState);
      return { state: saved, conflict: false };
    }

    // Server is newer - return server state (conflict)
    return { state: serverState, conflict: true };
  }
}
