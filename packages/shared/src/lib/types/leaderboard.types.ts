export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'allTime';

export interface LeaderboardEntry {
  odId: string;
  odName: string;
  odAvatarUrl: string | null;
  score: number;
  rank: number;
  level?: number;
  updatedAt: Date;
}

export interface ScoreRecord {
  odId: string;
  odName: string;
  odAvatarUrl: string | null;
  gameId: string;
  score: number;
  guessCount?: number | null;
  level?: number | null;
  timeMs?: number | null;
  metadata?: Record<string, any> | null;
  createdAt: Date;
}

export interface Leaderboard {
  gameId: string;
  period: LeaderboardPeriod;
  dateKey: string;
  entries: LeaderboardEntry[];
  updatedAt: Date;
}

export interface SubmitScoreDto {
  score: number;
  guessCount?: number;
  level?: number;
  timeMs?: number;
  wordHash?: string;
  metadata?: Record<string, any>;
}

export interface UserRank {
  rank: number;
  score: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  userRank?: UserRank;
  period: LeaderboardPeriod;
  dateKey: string;
}
