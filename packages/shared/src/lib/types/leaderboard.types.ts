export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly' | 'all-time';

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
  rank: number;
  level: number;
  metadata: ScoreMetadata;
  submittedAt: Date;
}

export interface ScoreMetadata {
  attempts: number;
  hintsUsed: number;
  timeSeconds: number;
  streakMultiplier: number;
}

export interface Leaderboard {
  gameId: string;
  period: LeaderboardPeriod;
  dateKey: string;
  entries: LeaderboardEntry[];
  createdAt: Date;
  expiresAt: Date | null;
}

export interface SubmitScoreDto {
  score: number;
  level: number;
  attempts: number;
  hintsUsed: number;
  timeSeconds: number;
  streakMultiplier: number;
  dailyWordHash?: string;
}

export interface UserRank {
  rank: number;
  totalPlayers: number;
  percentile: number;
  score: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  userRank?: UserRank;
  period: LeaderboardPeriod;
  dateKey: string;
}
