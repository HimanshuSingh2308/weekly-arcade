/** Default multiplayer configuration values */
export const MULTIPLAYER_DEFAULTS = {
  /** Session timeouts */
  LOBBY_IDLE_TIMEOUT_MS: 5 * 60 * 1000,         // 5 minutes
  TURN_TIMEOUT_SEC: 30,
  SESSION_MAX_DURATION_MIN: 30,
  RECONNECT_WINDOW_MS: 2 * 60 * 1000,           // 2 minutes
  DISCONNECT_DETECTION_MS: 45 * 1000,            // 45 seconds
  FINISHED_CLEANUP_HOURS: 24,

  /** Matchmaking — tuned for small player base, widens fast */
  INITIAL_RATING_WINDOW: 200,
  RATING_WINDOW_STEP: 200,
  RATING_WINDOW_MAX: 9999, // Effectively no cap — match anyone after 30s
  MATCHMAKING_WIDEN_INTERVAL_SEC: 10,
  MATCHMAKING_ANYONE_AFTER_SEC: 30, // Match anyone after 30s (small player base)
  MATCHMAKING_EXPIRE_SEC: 120, // 2 min queue before expiry
  MATCHMAKING_SCAN_INTERVAL_SEC: 5,
  DEFAULT_RATING: 1000,
  RATING_FLOOR: 100,
  ELO_K_FACTOR: 32, // Matches chess-3d client K-factor for provisional players

  /** Limits */
  MAX_CONCURRENT_SESSIONS: 3,
  MAX_PENDING_INVITATIONS: 10,
  INVITATION_TTL_MIN: 5,
  JOIN_CODE_LENGTH: 6,

  /** Anti-cheat */
  ACCOUNT_AGE_GATE_HOURS: 1,
  AFK_TURNS_THRESHOLD: 3,
  AFK_REALTIME_SEC: 30,
  SUSPICION_SCAN_INTERVAL_HOURS: 6,
  WIN_TRADE_CHECK_GAMES: 10,
  ABNORMAL_WIN_STREAK: 15,
  LOSS_RATE_FLAG_THRESHOLD: 0.8,
  LOSS_RATE_MIN_GAMES: 20,
} as const;
