import { GameMove, PlayerResult } from '../types/multiplayer.types.js';

/**
 * Result returned when a game ends.
 */
export interface GameResult {
  /** Per-player results keyed by UID */
  players: Record<string, PlayerResult>;
  /** Whether the game ended normally or was force-ended */
  reason: 'completed' | 'forfeit' | 'timeout' | 'disconnect';
}

/**
 * Interface that each multiplayer game must implement on the server side.
 *
 * The multiplayer infrastructure is game-agnostic — it calls these methods
 * without knowing anything about the specific game rules. Each future
 * multiplayer game registers an implementation of this interface.
 *
 * Game state is an opaque `Record<string, unknown>` that only the game
 * logic understands. The infra stores and broadcasts it without inspection.
 */
export interface MultiplayerGameLogic {
  /** Unique game identifier (must match game-registry.ts) */
  readonly gameId: string;

  /**
   * Create the initial game state for a new session.
   * Called once when the host starts the game.
   */
  createInitialState(
    players: string[],
    config: Record<string, unknown>,
  ): Record<string, unknown>;

  /**
   * Validate and apply a player's move.
   * Must throw an Error with a descriptive message if the move is invalid.
   * Returns the new game state if the move is valid.
   */
  applyMove(
    state: Record<string, unknown>,
    uid: string,
    moveType: string,
    moveData: Record<string, unknown>,
  ): Record<string, unknown>;

  /**
   * Check if the game is over.
   * Returns a GameResult if the game has ended, or null if it continues.
   */
  checkGameOver(state: Record<string, unknown>): GameResult | null;

  /**
   * Determine whose turn it is next.
   * Returns a player UID for turn-based games, or null for real-time/simultaneous.
   */
  getNextTurn(state: Record<string, unknown>): string | null;

  /**
   * (Optional, Level 2 anti-cheat)
   * Compute a suspicion score for a sequence of moves.
   * Returns 0.0 (no suspicion) to 1.0 (highly suspicious).
   * Games that don't need this can omit the method.
   */
  suspicionScore?(moves: GameMove[]): number;
}
