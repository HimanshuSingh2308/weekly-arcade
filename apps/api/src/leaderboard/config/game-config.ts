/**
 * Game-Specific Configuration for Score Validation
 *
 * Each game has specific limits based on its mechanics:
 * - maxScore: Maximum achievable score (theoretical limit)
 * - maxScorePerSecond: Maximum points per second (prevents instant high scores)
 * - minTimeMs: Minimum game duration in milliseconds
 * - maxLevel: Maximum level achievable (if applicable)
 * - maxGuessCount: Maximum guesses allowed (for word games)
 */

// Common metadata keys used by XP calculation (allowed for all games)
const COMMON_METADATA_KEYS = ['perfectGame', 'streakBonus'];

export interface GameValidationConfig {
  maxScore: number;
  maxScorePerSecond: number;
  minTimeMs: number;
  maxLevel?: number;
  maxGuessCount?: number;
  // Allowed metadata keys (in addition to COMMON_METADATA_KEYS). If undefined, only common keys allowed.
  allowedMetadataKeys?: string[];
  // Custom validation function for game-specific rules
  customValidation?: (dto: ScoreValidationInput) => ValidationResult;
}

export interface ScoreValidationInput {
  score: number;
  timeMs?: number;
  level?: number;
  guessCount?: number;
  metadata?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Game configurations with realistic limits based on game mechanics
 */
export const GAME_CONFIG: Record<string, GameValidationConfig> = {
  // Wordle: Max ~1600 points (perfect game with streak multiplier)
  wordle: {
    maxScore: 5000, // Allow some buffer for streak multipliers
    maxScorePerSecond: 500, // Can get points quickly on easy guesses
    minTimeMs: 3000, // Minimum 3 seconds to read and guess
    maxGuessCount: 6,
    allowedMetadataKeys: ['wordLength', 'hardMode', 'hintsUsed'],
    customValidation: (dto) => {
      if (dto.guessCount !== undefined && dto.guessCount > 6) {
        return { valid: false, reason: 'Wordle allows maximum 6 guesses' };
      }
      // Score should correlate with guesses (fewer guesses = higher score)
      if (dto.guessCount !== undefined && dto.score > 0) {
        const maxForGuesses = (7 - dto.guessCount) * 500 * 2; // With streak bonus
        if (dto.score > maxForGuesses) {
          return { valid: false, reason: 'Score too high for guess count' };
        }
      }
      return { valid: true };
    },
  },

  // Snake: Progressive scoring, can go very high with skill
  snake: {
    maxScore: 100000, // Very high scores possible with long games
    maxScorePerSecond: 50, // ~1 apple per second at most
    minTimeMs: 5000, // At least 5 seconds of gameplay
    allowedMetadataKeys: ['foodEaten', 'finalLength'],
    customValidation: (dto) => {
      // Score should be proportional to time (roughly)
      if (dto.timeMs && dto.score > 0) {
        const theoreticalMax = (dto.timeMs / 1000) * 100; // 100 points per second max
        if (dto.score > theoreticalMax) {
          return { valid: false, reason: 'Score growth rate too high for snake' };
        }
      }
      return { valid: true };
    },
  },

  // 2048: Exponential scoring, high scores take time
  '2048': {
    maxScore: 500000, // Very high scores possible
    maxScorePerSecond: 200, // Moves take time
    minTimeMs: 30000, // At least 30 seconds for a meaningful game
    allowedMetadataKeys: ['highestTile', 'moves', 'isMilestone'],
    customValidation: (dto) => {
      // High scores require many moves which take time
      if (dto.timeMs && dto.score > 10000) {
        const minTimeForScore = (dto.score / 200) * 1000; // At least 200 points/sec
        if (dto.timeMs < minTimeForScore) {
          return { valid: false, reason: 'Score achieved too quickly for 2048' };
        }
      }
      return { valid: true };
    },
  },

  // Stack Tower: Height-based, limited by physics
  'stack-tower': {
    maxScore: 50000,
    maxScorePerSecond: 100, // Quick stacking possible
    minTimeMs: 5000,
    maxLevel: 200, // Realistic tower height limit
    allowedMetadataKeys: ['blocksPlaced', 'perfectStacks', 'maxCombo', 'perfectRate'],
    customValidation: (dto) => {
      if (dto.level !== undefined && dto.level > 200) {
        return { valid: false, reason: 'Tower height exceeds maximum' };
      }
      // Score should correlate with level
      if (dto.level !== undefined && dto.score > dto.level * 500) {
        return { valid: false, reason: 'Score too high for tower height' };
      }
      return { valid: true };
    },
  },

  // Voidbreak: Arcade shooter, time-limited rounds
  voidbreak: {
    maxScore: 200000,
    maxScorePerSecond: 500, // Fast-paced game
    minTimeMs: 10000, // Minimum round duration
    maxLevel: 100,
    allowedMetadataKeys: ['wave', 'perfectWave', 'upgradesTaken', 'livesLost', 'perfectWaves', 'highestCombo', 'totalKills'],
    customValidation: (dto) => {
      // Score should scale with time and level
      if (dto.timeMs && dto.level) {
        const expectedMax = (dto.timeMs / 1000) * dto.level * 100;
        if (dto.score > expectedMax * 1.5) {
          return { valid: false, reason: 'Score exceeds expected maximum for level/time' };
        }
      }
      return { valid: true };
    },
  },

  // Fieldstone: Strategy game, slower paced — max ~11 waves
  fieldstone: {
    maxScore: 100000,
    maxScorePerSecond: 100,
    minTimeMs: 30000, // Strategy games take time
    maxLevel: 11, // wave 10 + victory
    allowedMetadataKeys: ['wave', 'deck'],
    customValidation: (dto) => {
      // Score should correlate with waves survived
      if (dto.level !== undefined && dto.score > dto.level * 10000) {
        return { valid: false, reason: 'Score too high for waves completed' };
      }
      // Validate deck is a known value
      const validDecks = ['farmer', 'mason', 'merchant'];
      if (dto.metadata?.deck && !validDecks.includes(dto.metadata.deck as string)) {
        return { valid: false, reason: 'Invalid deck selection' };
      }
      return { valid: true };
    },
  },

  // Chaos Kitchen: Time-pressure cooking game
  'chaos-kitchen': {
    maxScore: 50000,
    maxScorePerSecond: 200, // Fast serving possible
    minTimeMs: 60000, // 1 minute minimum
    maxLevel: 20,
    allowedMetadataKeys: ['ordersCompleted', 'chaosSurvived', 'multiplier', 'isLevelUp'],
    customValidation: (dto) => {
      // Score capped by round time
      if (dto.timeMs && dto.score > (dto.timeMs / 1000) * 300) {
        return { valid: false, reason: 'Score rate too high for chaos-kitchen' };
      }
      return { valid: true };
    },
  },

  // Memory Match: Pattern matching game
  // Max: hard mode 10 pairs × 500 (max combo) = 5000 theoretical max
  'memory-match': {
    maxScore: 6000, // 5000 theoretical + buffer
    maxScorePerSecond: 200,
    minTimeMs: 10000, // Minimum to complete a board
    allowedMetadataKeys: ['difficulty', 'mode', 'moves', 'time', 'maxCombo'],
    customValidation: (dto) => {
      // Perfect memory should still take some time
      if (dto.timeMs && dto.timeMs < 5000 && dto.score > 3000) {
        return { valid: false, reason: 'Score too high for completion time' };
      }
      // Validate difficulty-based max if provided
      if (dto.metadata?.difficulty) {
        const maxPairs: Record<string, number> = { easy: 6, medium: 8, hard: 10 };
        const pairs = maxPairs[dto.metadata.difficulty as string] || 10;
        const theoreticalMax = pairs * 500; // max combo multiplier is 5x
        if (dto.score > theoreticalMax * 1.2) {
          return { valid: false, reason: 'Score exceeds maximum for difficulty' };
        }
      }
      return { valid: true };
    },
  },

  // Lumble: Word puzzle game
  lumble: {
    maxScore: 10000,
    maxScorePerSecond: 300,
    minTimeMs: 5000,
    maxGuessCount: 10,
    allowedMetadataKeys: ['biome', 'sparksCollected', 'totalSparks', 'timeSeconds', 'completionPercent', 'bestChain', 'chainBonus', 'zoneClearBonus', 'bonusSparksCollected', 'isMilestone'],
  },

  // Solitaire Roguelite: Klondike with Joker multipliers
  'solitaire-roguelite': {
    maxScore: 200000, // Perfect clear + S7 (×3) + S8 (×2) + R3 (×1.5) stacking
    maxScorePerSecond: 100,
    minTimeMs: 30000, // At least 30 seconds for a real game
    maxLevel: 4, // foundationsCompleted 0-4
    allowedMetadataKeys: ['jokersTaken', 'perfectClear', 'cardsOnFoundation', 'undosUsed', 'timeBonus'],
    customValidation: (dto) => {
      if (dto.level !== undefined && dto.level > 4) {
        return { valid: false, reason: 'Foundations completed exceeds 4' };
      }
      return { valid: true };
    },
  },

  // Coin Cascade: Physics coin pusher with combos and prizes
  // Max score: 30 starting coins + bonus coins, best prizes (trophy 1000) × 5x combo = ~50k theoretical max
  'coin-cascade': {
    maxScore: 50000,
    maxScorePerSecond: 200, // Rapid cascades can score fast with combos
    minTimeMs: 15000, // Games take at least 15 seconds (30 coins × 0.5s cooldown)
    allowedMetadataKeys: ['coinsDropped', 'coinsCollected', 'maxCombo'],
    customValidation: (dto) => {
      if (dto.metadata) {
        const dropped = dto.metadata.coinsDropped as number;
        const collected = dto.metadata.coinsCollected as number;
        // Can't collect more than you drop plus initial platform coins (~22)
        if (dropped !== undefined && collected !== undefined && collected > dropped + 25) {
          return { valid: false, reason: 'Collected more coins than possible' };
        }
        // Min time based on drop rate (each drop has 500ms cooldown)
        if (dropped !== undefined && dto.timeMs && dto.timeMs < dropped * 300) {
          return { valid: false, reason: 'Coin drop rate too fast' };
        }
      }
      return { valid: true };
    },
  },
  // Tiny Tycoon: All stores submit under 'tiny-tycoon' with store ID in metadata
  // Limits use golden-lounge (most permissive): maxScore 300k, maxScorePerSecond 5000
  // Per-customer max: Math.min(rawCoins, 5000) + tipBonus + criticBonus ≈ 5500
  'tiny-tycoon': {
    maxScore: 300000,
    maxScorePerSecond: 5000,
    minTimeMs: 55000, // days are 60 seconds, allow 5s tolerance
    allowedMetadataKeys: ['store', 'customersServed', 'day', 'customersLost', 'peakCombo', 'upgradeLevels'],
    customValidation: (dto) => {
      if (dto.metadata) {
        const served = dto.metadata.customersServed as number;
        if (served !== undefined && served > 150) {
          return { valid: false, reason: 'Too many customers served' };
        }
        if (served !== undefined && served > 0 && dto.score / served > 6000) {
          return { valid: false, reason: 'Revenue per customer too high' };
        }
      }
      return { valid: true };
    },
  },

  // Cricket Blitz: 3D IPL-style cricket (bat 5 overs + bowl 5 overs)
  'cricket-blitz': {
    maxScore: 500,           // Max ~200 batting + ~150 bowling bonus + bonuses
    maxScorePerSecond: 5,    // Cricket is a slow-scoring game
    minTimeMs: 10000,        // At least 10 seconds (can lose 3 wickets fast)
    maxLevel: 10,            // Levels for progression
    allowedMetadataKeys: ['battingScore', 'battingWickets', 'battingFours', 'battingSixes', 'bowlingAIScore', 'bowlingAIWickets', 'team', 'result', 'matchMode'],
  },
};

/**
 * Default config for unknown games (strict limits)
 */
export const DEFAULT_GAME_CONFIG: GameValidationConfig = {
  maxScore: 10000,
  maxScorePerSecond: 50,
  minTimeMs: 5000,
};

/**
 * Get configuration for a specific game
 */
export function getGameConfig(gameId: string): GameValidationConfig {
  // Resolve store variants to parent config (e.g., 'tiny-tycoon-juice-junction' → 'tiny-tycoon')
  if (!(gameId in GAME_CONFIG) && gameId.startsWith('tiny-tycoon-')) {
    return GAME_CONFIG['tiny-tycoon'] || DEFAULT_GAME_CONFIG;
  }
  return GAME_CONFIG[gameId] || DEFAULT_GAME_CONFIG;
}

/**
 * Validate a score submission against game rules
 */
export function validateScore(
  gameId: string,
  dto: ScoreValidationInput
): ValidationResult {
  const config = getGameConfig(gameId);

  // Check maximum score
  if (dto.score > config.maxScore) {
    return {
      valid: false,
      reason: `Score ${dto.score} exceeds maximum ${config.maxScore} for ${gameId}`,
    };
  }

  // SECURITY: Require timeMs when minTimeMs is configured — prevents bypassing time validation
  if (config.minTimeMs > 0 && (dto.timeMs === undefined || dto.timeMs === null)) {
    return {
      valid: false,
      reason: `timeMs is required for ${gameId}`,
    };
  }

  // Check minimum time
  if (dto.timeMs !== undefined && dto.timeMs < config.minTimeMs) {
    return {
      valid: false,
      reason: `Game duration ${dto.timeMs}ms is below minimum ${config.minTimeMs}ms`,
    };
  }

  // Check score rate
  if (dto.timeMs !== undefined && dto.timeMs > 0) {
    const scorePerSecond = dto.score / (dto.timeMs / 1000);
    if (scorePerSecond > config.maxScorePerSecond) {
      return {
        valid: false,
        reason: `Score rate ${scorePerSecond.toFixed(1)}/s exceeds maximum ${config.maxScorePerSecond}/s`,
      };
    }
  }

  // Check max level (if applicable)
  if (config.maxLevel && dto.level !== undefined && dto.level > config.maxLevel) {
    return {
      valid: false,
      reason: `Level ${dto.level} exceeds maximum ${config.maxLevel}`,
    };
  }

  // Check max guesses (if applicable)
  if (config.maxGuessCount && dto.guessCount !== undefined && dto.guessCount > config.maxGuessCount) {
    return {
      valid: false,
      reason: `Guess count ${dto.guessCount} exceeds maximum ${config.maxGuessCount}`,
    };
  }

  // Validate metadata keys against per-game allowlist
  if (dto.metadata && typeof dto.metadata === 'object') {
    const gameKeys = config.allowedMetadataKeys ?? [];
    const allowedKeys = new Set([...COMMON_METADATA_KEYS, ...gameKeys]);
    const submittedKeys = Object.keys(dto.metadata);
    const disallowedKeys = submittedKeys.filter((k) => !allowedKeys.has(k));
    if (disallowedKeys.length > 0) {
      return {
        valid: false,
        reason: `Disallowed metadata keys for ${gameId}: ${disallowedKeys.join(', ')}`,
      };
    }
  }

  // Run custom validation (if defined)
  if (config.customValidation) {
    const customResult = config.customValidation(dto);
    if (!customResult.valid) {
      return customResult;
    }
  }

  return { valid: true };
}
