export interface GameState {
  gameId: string;
  updatedAt: Date;
  level: number;
  currentStreak: number;
  maxStreak: number;
  lastPlayedDate: string;
  stats: GameStats;
  personalBests: Record<string, number>;
  currentGame: CurrentGame | null;
}

export interface GameStats {
  played: number;
  won: number;
  winPercentage: number;
  guessDistribution: number[];
}

export interface CurrentGame {
  targetWordHash: string;
  guesses: string[];
  hintsUsed: number;
  startedAt: Date;
}

export interface SaveGameStateDto {
  level: number;
  currentStreak: number;
  maxStreak: number;
  lastPlayedDate: string;
  stats: GameStats;
  personalBests?: Record<string, number>;
  currentGame?: CurrentGame | null;
}

export interface SyncGameStateDto {
  localState: SaveGameStateDto;
  localUpdatedAt: string;
}

export interface SyncResult {
  state: GameState;
  source: 'local' | 'cloud' | 'merged';
  conflictResolved: boolean;
}
