export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
  category: AchievementCategory;
  requirement: AchievementRequirement;
}

export type AchievementCategory =
  | 'gameplay'
  | 'streak'
  | 'level'
  | 'speed'
  | 'skill'
  | 'voidbreak'
  | 'stack-tower'
  | 'tiny-tycoon'
  | 'cricket-blitz';

export interface AchievementRequirement {
  type: 'first_game' | 'attempts' | 'streak' | 'level' | 'time' | 'hints' | 'wins' | 'wave' | 'score' | 'combo' | 'special' | 'first_boundary' | 'first_six' | 'sixes';
  value?: number;
  gameId?: string;
}

export interface UserAchievement {
  achievementId: string;
  userId: string;
  gameId: string;
  unlockedAt: Date;
  context: AchievementContext;
}

export interface AchievementContext {
  level?: number;
  streak?: number;
  score?: number;
  attempts?: number;
  timeSeconds?: number;
}

export interface UnlockAchievementDto {
  achievementId: string;
  gameId: string;
  context: AchievementContext;
}

export interface AchievementUnlockResult {
  achievement: Achievement;
  xpAwarded: number;
  newTotalXP: number;
  leveledUp: boolean;
  newPlayerLevel?: number;
}
