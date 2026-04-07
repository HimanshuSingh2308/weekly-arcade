import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { GameLogicRegistry } from './game-logic.registry';
import { MultiplayerGameLogic, GameResult, Session } from '@weekly-arcade/shared';

interface ActiveSession {
  sessionId: string;
  gameId: string;
  state: Record<string, unknown>;
  version: number;
  logic: MultiplayerGameLogic;
  players: Set<string>; // UIDs of connected players
  lastPersisted: number;
  pendingMoves: number;
  persistTimer: NodeJS.Timeout | null;
  evictionTimer: NodeJS.Timeout | null;
  /** Per-player last move timestamp for timing validation */
  lastMoveTime: Map<string, number>;
}

const PERSIST_INTERVAL_MS = 500;
const PERSIST_MOVE_THRESHOLD = 5;
const EVICTION_GRACE_MS = 5 * 60 * 1000; // 5 minutes
const MIN_MOVE_INTERVAL_TURN_MS = 200; // Turn-based games (chess)
const MIN_MOVE_INTERVAL_REALTIME_MS = 50; // Real-time games (racing) — 20Hz max

@Injectable()
export class GameStateManager {
  private readonly logger = new Logger(GameStateManager.name);
  private readonly sessions = new Map<string, ActiveSession>();

  constructor(
    private readonly firebase: FirebaseService,
    private readonly gameLogicRegistry: GameLogicRegistry,
  ) {}

  /** Check if a session is loaded in memory */
  isLoaded(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /** Get active session (or undefined) */
  getSession(sessionId: string): ActiveSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Load a session into memory from Firestore.
   * Called when the first player connects to a session.
   */
  async loadSession(sessionId: string): Promise<ActiveSession> {
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }

    // Read session doc
    const sessionDoc = await this.firebase.doc(`sessions/${sessionId}`).get();
    if (!sessionDoc.exists) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    const sessionData = sessionDoc.data() as Session;

    // Get game logic
    const logic = this.gameLogicRegistry.get(sessionData.gameId);
    if (!logic) {
      throw new Error(`No game logic registered for: ${sessionData.gameId}`);
    }

    // Try to load existing game state
    let state: Record<string, unknown> = {};
    let version = 0;
    const stateDoc = await this.firebase.doc(`sessions/${sessionId}/gameState/current`).get();
    if (stateDoc.exists) {
      const stateData = stateDoc.data()!;
      state = (stateData.state as Record<string, unknown>) || {};
      version = (stateData.version as number) || 0;
    }

    const active: ActiveSession = {
      sessionId,
      gameId: sessionData.gameId,
      state,
      version,
      logic,
      players: new Set(),
      lastPersisted: Date.now(),
      pendingMoves: 0,
      persistTimer: null,
      evictionTimer: null,
      lastMoveTime: new Map(),
    };

    this.sessions.set(sessionId, active);
    this.logger.log(`Session loaded into memory: ${sessionId} (game=${sessionData.gameId}, v=${version})`);
    return active;
  }

  /**
   * Initialize game state when the host starts the game.
   */
  async initializeGame(sessionId: string, playerUids: string[], config: Record<string, unknown>): Promise<Record<string, unknown>> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not loaded: ${sessionId}`);

    const initialState = session.logic.createInitialState(playerUids, config);
    session.state = initialState;
    session.version = 1;
    session.pendingMoves = 0;

    // Persist immediately
    await this.persistState(sessionId);
    return initialState;
  }

  /**
   * Validate and apply a move. Returns the new state or throws on invalid move.
   */
  applyMove(
    sessionId: string,
    uid: string,
    moveType: string,
    moveData: Record<string, unknown>,
  ): { state: Record<string, unknown>; version: number; gameResult: GameResult | null } {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not loaded: ${sessionId}`);

    // Level 2 anti-cheat: timing validation
    // Real-time games (getNextTurn returns null) allow faster moves
    const isRealtime = session.logic.getNextTurn(session.state) === null;
    const minInterval = isRealtime ? MIN_MOVE_INTERVAL_REALTIME_MS : MIN_MOVE_INTERVAL_TURN_MS;
    const now = Date.now();
    const lastMove = session.lastMoveTime.get(uid);
    if (lastMove && (now - lastMove) < minInterval) {
      throw new Error(`Move too fast: minimum ${minInterval}ms between moves`);
    }

    // Validate and apply via game logic (~1ms, in-memory)
    const newState = session.logic.applyMove(session.state, uid, moveType, moveData);

    // Update in-memory state
    session.state = newState;
    session.version++;
    session.pendingMoves++;
    session.lastMoveTime.set(uid, now);

    // Check game over
    const gameResult = session.logic.checkGameOver(newState);

    // Schedule batch persist
    this.schedulePersist(sessionId);

    // Record move to Firestore (async, fire-and-forget)
    this.recordMove(sessionId, uid, moveType, moveData, session.version).catch(err =>
      this.logger.error(`Failed to record move: ${err.message}`),
    );

    return { state: newState, version: session.version, gameResult };
  }

  /**
   * Get the next turn UID (null for real-time games).
   */
  getNextTurn(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    return session.logic.getNextTurn(session.state);
  }

  /** Mark a player as connected */
  addPlayer(sessionId: string, uid: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.players.add(uid);

    // Cancel eviction if players are back
    if (session.evictionTimer) {
      clearTimeout(session.evictionTimer);
      session.evictionTimer = null;
    }
  }

  /** Mark a player as disconnected */
  removePlayer(sessionId: string, uid: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.players.delete(uid);

    // If no players left, schedule eviction
    if (session.players.size === 0) {
      this.scheduleEviction(sessionId);
    }
  }

  /** Force persist and remove session from memory */
  async evictSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Final persist
    if (session.pendingMoves > 0) {
      await this.persistState(sessionId);
    }

    // Cleanup timers
    if (session.persistTimer) clearTimeout(session.persistTimer);
    if (session.evictionTimer) clearTimeout(session.evictionTimer);

    this.sessions.delete(sessionId);
    this.logger.log(`Session evicted from memory: ${sessionId}`);
  }

  /** Get count of active sessions in memory */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  // ─── Private helpers ─────────────────────────────────────────────────

  private schedulePersist(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Persist immediately if threshold reached
    if (session.pendingMoves >= PERSIST_MOVE_THRESHOLD) {
      this.persistState(sessionId).catch(err =>
        this.logger.error(`Persist failed: ${err.message}`),
      );
      return;
    }

    // Otherwise schedule for later
    if (!session.persistTimer) {
      session.persistTimer = setTimeout(() => {
        this.persistState(sessionId).catch(err =>
          this.logger.error(`Scheduled persist failed: ${err.message}`),
        );
      }, PERSIST_INTERVAL_MS);
    }
  }

  private async persistState(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Clear timer
    if (session.persistTimer) {
      clearTimeout(session.persistTimer);
      session.persistTimer = null;
    }

    await this.firebase.doc(`sessions/${sessionId}/gameState/current`).set({
      state: session.state,
      version: session.version,
      updatedAt: new Date(),
    }, { merge: true });

    session.lastPersisted = Date.now();
    session.pendingMoves = 0;
    this.logger.debug(`Persisted session ${sessionId} at v${session.version}`);
  }

  private async recordMove(
    sessionId: string,
    uid: string,
    moveType: string,
    moveData: Record<string, unknown>,
    turnNumber: number,
  ): Promise<void> {
    await this.firebase.collection(`sessions/${sessionId}/moves`).add({
      uid,
      turnNumber,
      moveType,
      moveData,
      timestamp: new Date(),
      validated: true,
    });
  }

  private scheduleEviction(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.logger.log(`Scheduling eviction for session ${sessionId} in ${EVICTION_GRACE_MS / 1000}s`);
    session.evictionTimer = setTimeout(() => {
      this.evictSession(sessionId).catch(err =>
        this.logger.error(`Eviction failed: ${err.message}`),
      );
    }, EVICTION_GRACE_MS);
  }
}
