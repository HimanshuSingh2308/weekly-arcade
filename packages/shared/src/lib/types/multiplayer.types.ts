// ─── Session ────────────────────────────────────────────────────────────────

export type SessionStatus = 'waiting' | 'starting' | 'playing' | 'finished' | 'abandoned';
export type SessionMode = 'quick-match' | 'private';
export type PlayerStatus = 'connected' | 'disconnected' | 'left';
export type GameOutcome = 'win' | 'loss' | 'draw';
export type GameMode = 'turn-based' | 'real-time';

export interface SessionPlayer {
  displayName: string;
  avatarUrl: string | null;
  joinedAt: Date;
  status: PlayerStatus;
  lastHeartbeat: Date;
  isHost: boolean;
}

export interface SessionFlags {
  ipConflict: boolean;
  suspiciousPlayers: string[];
  reviewRequired: boolean;
}

export interface PlayerResult {
  score: number;
  rank: number;
  outcome: GameOutcome;
}

export interface Session {
  sessionId: string;
  gameId: string;
  hostUid: string;
  status: SessionStatus;
  mode: SessionMode;
  joinCode: string | null;

  players: Record<string, SessionPlayer>;
  playerCount: number;
  maxPlayers: number;
  minPlayers: number;

  currentTurnUid: string | null;
  turnNumber: number;
  turnDeadline: Date | null;

  gameConfig: Record<string, unknown>;

  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  lastActivityAt: Date;

  results: Record<string, PlayerResult> | null;

  spectatorCount: number;
  spectatorAllowed: boolean;

  flags: SessionFlags;
}

// ─── Game State (per-session) ───────────────────────────────────────────────

export interface MultiplayerGameState {
  state: Record<string, unknown>;
  version: number;
  lastMoveId: string;
  updatedAt: Date;
}

// ─── Moves ──────────────────────────────────────────────────────────────────

export interface GameMove {
  moveId?: string;
  uid: string;
  turnNumber: number;
  moveType: string;
  moveData: Record<string, unknown>;
  timestamp: Date;
  validated: boolean;
}

// ─── Matchmaking ────────────────────────────────────────────────────────────

export type MatchmakingStatus = 'waiting' | 'matched' | 'expired';

export interface MatchmakingEntry {
  uid: string;
  gameId: string;
  skillRating: number;
  ratingWindowMin: number;
  ratingWindowMax: number;
  status: MatchmakingStatus;
  matchedSessionId: string | null;
  joinedAt: Date;
}

// ─── Invitations ────────────────────────────────────────────────────────────

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export interface Invitation {
  invitationId?: string;
  sessionId: string;
  fromUid: string;
  fromDisplayName: string;
  toUid: string;
  gameId: string;
  status: InvitationStatus;
  createdAt: Date;
  expiresAt: Date;
}

// ─── Match Results ──────────────────────────────────────────────────────────

export interface MatchPlayerResult {
  displayName: string;
  score: number;
  rank: number;
  outcome: GameOutcome;
  ratingBefore: number;
  ratingAfter: number;
  ratingChange: number;
}

export interface MatchResult {
  gameId: string;
  sessionId: string;
  players: Record<string, MatchPlayerResult>;
  durationSec: number;
  totalTurns: number;
  finishedAt: Date;
}

// ─── User Multiplayer Extensions ────────────────────────────────────────────

export interface MultiplayerStats {
  played: number;
  won: number;
  lost: number;
  drawn: number;
  winStreak: number;
  bestWinStreak: number;
}

export interface AntiCheatProfile {
  flags: string[];
  flagCount: number;
  lastFlaggedAt: Date | null;
  accountCreatedAt: Date;
  restricted: boolean;
}

// ─── WebSocket Events ───────────────────────────────────────────────────────

export interface WsGameStatePayload {
  state: Record<string, unknown>;
  version: number;
  turnUid: string | null;
}

export interface WsMovePayload {
  moveType: string;
  moveData: Record<string, unknown>;
}

export interface WsMoveRejectedPayload {
  reason: string;
}

export interface WsGameFinishedPayload {
  results: Record<string, PlayerResult>;
}

export interface WsPlayerEventPayload {
  uid: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface WsErrorPayload {
  code: string;
  message: string;
}
