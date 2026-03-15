/**
 * Scoring System Constants
 *
 * Formula:
 * BASE_SCORE = 1000
 * ATTEMPT_BONUS = (6 - attempts) * 100
 * HINT_PENALTY = hints * 150
 * LEVEL_MULTIPLIER = 1 + (level - 1) * 0.2
 * STREAK_MULTIPLIER = based on streak days
 *
 * FINAL_SCORE = max(100, BASE_SCORE + ATTEMPT_BONUS - HINT_PENALTY) * LEVEL_MULTIPLIER * STREAK_MULTIPLIER
 */

export const SCORING = {
  BASE_SCORE: 1000,
  ATTEMPT_BONUS_PER_SAVED: 100,
  HINT_PENALTY: 150,
  MIN_SCORE: 100,
  LEVEL_MULTIPLIER_INCREMENT: 0.2,
  XP_PER_SCORE_POINT: 0.1, // 1 XP per 10 score points
  XP_LOSS_BASE: 25,
  XP_FLAWLESS_BONUS: 100,
  XP_NO_HINTS_BONUS: 50,
  XP_PER_LEVEL: 500,
  DAILY_BONUS_MULTIPLIER: 2,
};

export const STREAK_MULTIPLIERS: Record<string, number> = {
  '1-2': 1.0,
  '3-6': 1.1,
  '7-13': 1.25,
  '14-29': 1.5,
  '30+': 2.0,
};

export function getStreakMultiplier(streak: number): number {
  if (streak >= 30) return 2.0;
  if (streak >= 14) return 1.5;
  if (streak >= 7) return 1.25;
  if (streak >= 3) return 1.1;
  return 1.0;
}

export function getLevelMultiplier(level: number): number {
  return 1 + (level - 1) * SCORING.LEVEL_MULTIPLIER_INCREMENT;
}

export interface ScoreCalculation {
  score: number;
  baseScore: number;
  attemptBonus: number;
  hintPenalty: number;
  levelMultiplier: number;
  streakMultiplier: number;
}

export function calculateScore(
  attempts: number,
  hintsUsed: number,
  level: number,
  streak: number
): ScoreCalculation {
  const baseScore = SCORING.BASE_SCORE;
  const attemptBonus = (6 - attempts) * SCORING.ATTEMPT_BONUS_PER_SAVED;
  const hintPenalty = hintsUsed * SCORING.HINT_PENALTY;
  const levelMultiplier = getLevelMultiplier(level);
  const streakMultiplier = getStreakMultiplier(streak);

  const rawScore = baseScore + attemptBonus - hintPenalty;
  const score = Math.round(
    Math.max(SCORING.MIN_SCORE, rawScore) * levelMultiplier * streakMultiplier
  );

  return {
    score,
    baseScore,
    attemptBonus,
    hintPenalty,
    levelMultiplier,
    streakMultiplier,
  };
}

export function calculateXP(
  score: number,
  won: boolean,
  attempts: number,
  hintsUsed: number,
  isFirstWinToday: boolean
): number {
  let xp = won
    ? Math.round(score * SCORING.XP_PER_SCORE_POINT)
    : SCORING.XP_LOSS_BASE;

  if (won) {
    if (attempts === 1) xp += SCORING.XP_FLAWLESS_BONUS;
    if (hintsUsed === 0) xp += SCORING.XP_NO_HINTS_BONUS;
    if (isFirstWinToday) xp *= SCORING.DAILY_BONUS_MULTIPLIER;
  }

  return xp;
}

export function calculatePlayerLevel(totalXP: number): number {
  return Math.floor(totalXP / SCORING.XP_PER_LEVEL) + 1;
}
