import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { MultiplayerGameLogic, GameResult } from '@weekly-arcade/shared';
import { GameLogicRegistry } from '../game-logic.registry';

// ─── Types ──────────────────────────────────────────────────────────
interface PlayerPosition {
  x: number;
  z: number;
  rotY: number;
  speed: number;
  driftScore: number;
  isDrifting: boolean;
  checkpointIndex: number;
  lapCheckpointSeq: number[];
}

interface DriftLegendsState {
  players: string[];
  trackId: string;
  startedAt: number;
  positions: Record<string, PlayerPosition>;
  laps: Record<string, number>;
  lapTimes: Record<string, number[]>;
  finished: Record<string, boolean>;
  finishedAt: Record<string, number>;
  finalRanks: Record<string, number> | null;
  totalLaps: number;
  checkpointCount: number;
}

// ─── Constants ──────────────────────────────────────────────────────
const TOTAL_LAPS_MP = 2;
const CHECKPOINT_COUNT = 5;

// Minimum lap times per track (ms) for anti-cheat
// Set low to avoid false positives — skilled players with boost can be very fast
const MIN_LAP_TIMES: Record<string, number> = {
  'city-circuit': 15000,
  'neon-alley': 18000,
  'blaze-showdown': 18000,
  'mesa-loop': 18000,
  'canyon-rush': 20000,
  'sandstorm-duel': 20000,
  'frozen-peaks': 22000,
  'glacier-gorge': 25000,
  'ice-crown': 25000,
  'jungle-run': 20000,
  'ruin-dash': 25000,
  'vipers-lair': 28000,
  'cloud-circuit': 20000,
  'grand-prix-qualify': 15000,
  'apex-final': 15000,
};

@Injectable()
export class DriftLegendsLogic implements MultiplayerGameLogic, OnModuleInit {
  private readonly logger = new Logger(DriftLegendsLogic.name);
  readonly gameId = 'drift-legends';

  constructor(private readonly registry: GameLogicRegistry) {}

  onModuleInit() {
    this.registry.register(this);
    this.logger.log('Drift Legends game logic registered');
  }

  createInitialState(
    players: string[],
    config: Record<string, unknown>,
  ): Record<string, unknown> {
    const trackId = (config.trackId as string) || 'city-circuit';
    const positions: Record<string, PlayerPosition> = {};
    const laps: Record<string, number> = {};
    const lapTimes: Record<string, number[]> = {};
    const finished: Record<string, boolean> = {};
    const finishedAt: Record<string, number> = {};

    players.forEach((uid) => {
      positions[uid] = {
        x: 0,
        z: 0,
        rotY: 0,
        speed: 0,
        driftScore: 0,
        isDrifting: false,
        checkpointIndex: 0,
        lapCheckpointSeq: [],
      };
      laps[uid] = 0;
      lapTimes[uid] = [];
      finished[uid] = false;
      finishedAt[uid] = 0;
    });

    const state: DriftLegendsState = {
      players,
      trackId,
      startedAt: Date.now(),
      positions,
      laps,
      lapTimes,
      finished,
      finishedAt,
      finalRanks: null,
      totalLaps: (config.laps as number) || TOTAL_LAPS_MP,
      checkpointCount: CHECKPOINT_COUNT,
    };

    return state as unknown as Record<string, unknown>;
  }

  applyMove(
    state: Record<string, unknown>,
    uid: string,
    moveType: string,
    moveData: Record<string, unknown>,
  ): Record<string, unknown> {
    const s = state as unknown as DriftLegendsState;

    if (!s.players.includes(uid)) {
      throw new Error('Player not in this game');
    }

    if (s.finished[uid]) {
      throw new Error('Player already finished');
    }

    switch (moveType) {
      case 'position-update':
        return this.handlePositionUpdate(s, uid, moveData);
      case 'lap-complete':
        return this.handleLapComplete(s, uid, moveData);
      case 'race-finish':
        return this.handleRaceFinish(s, uid, moveData);
      default:
        throw new Error(`Unknown move type: ${moveType}`);
    }
  }

  checkGameOver(state: Record<string, unknown>): GameResult | null {
    const s = state as unknown as DriftLegendsState;

    // Check if all players finished
    const allFinished = s.players.every((uid) => s.finished[uid]);
    if (!allFinished) {
      // Check if one player finished and 30s timeout elapsed
      const anyFinished = s.players.some((uid) => s.finished[uid]);
      if (anyFinished) {
        const firstFinishTime = Math.min(
          ...s.players
            .filter((uid) => s.finished[uid])
            .map((uid) => s.finishedAt[uid]),
        );
        if (Date.now() - firstFinishTime > 30000) {
          // Timeout: finisher wins, other loses
          return this.buildResult(s);
        }
      }
      return null;
    }

    return this.buildResult(s);
  }

  getNextTurn(_state: Record<string, unknown>): string | null {
    return null; // Real-time mode: all players move simultaneously
  }

  // ─── Move Handlers ────────────────────────────────────────────────

  private handlePositionUpdate(
    s: DriftLegendsState,
    uid: string,
    moveData: Record<string, unknown>,
  ): Record<string, unknown> {
    const checkpointIndex = moveData.checkpointIndex as number;
    const currentCheckpoint = s.positions[uid]?.checkpointIndex || 0;

    // Anti-cheat: checkpoint can only advance by +1 at a time
    if (
      checkpointIndex !== undefined &&
      checkpointIndex > currentCheckpoint + 1
    ) {
      this.logger.warn(
        `Suspicious checkpoint jump for ${uid}: ${currentCheckpoint} -> ${checkpointIndex}`,
      );
      // Reject the checkpoint advance, keep previous value
      moveData.checkpointIndex = currentCheckpoint;
    }
    {
      s.positions[uid] = {
        x: moveData.x as number,
        z: moveData.z as number,
        rotY: moveData.rotY as number,
        speed: moveData.speed as number,
        driftScore: (moveData.driftScore as number) || 0,
        isDrifting: !!(moveData.isDrifting),
        checkpointIndex:
          checkpointIndex !== undefined ? checkpointIndex : currentCheckpoint,
        lapCheckpointSeq: s.positions[uid]?.lapCheckpointSeq || [],
      };
    }

    return s as unknown as Record<string, unknown>;
  }

  private handleLapComplete(
    s: DriftLegendsState,
    uid: string,
    moveData: Record<string, unknown>,
  ): Record<string, unknown> {
    const lapTimeMs = moveData.lapTimeMs as number;
    const lapNumber = moveData.lapNumber as number;
    const checkpointSequence = moveData.checkpointSequence as number[];

    // Warn on checkpoint issues but don't reject (client may have timing quirks)
    if (!checkpointSequence || checkpointSequence.length < s.checkpointCount) {
      this.logger.warn(`Lap complete for ${uid}: only ${checkpointSequence?.length || 0}/${s.checkpointCount} checkpoints`);
    }

    // Accept any lap number >= current — client may send out of order if previous was rejected
    const expectedLap = (s.laps[uid] || 0) + 1;
    if (lapNumber < expectedLap) {
      this.logger.warn(`Duplicate lap ${lapNumber} for ${uid}, already at ${s.laps[uid]}`);
      return s as unknown as Record<string, unknown>; // Ignore duplicate, don't throw
    }

    // Validate minimum lap time (hard reject — anti-cheat)
    const minLapTime = MIN_LAP_TIMES[s.trackId] || 40000;
    if (lapTimeMs < minLapTime * 0.95) {
      throw new Error(`Lap time ${lapTimeMs}ms below minimum ${minLapTime * 0.95}ms`);
    }

    s.laps[uid] = (s.laps[uid] || 0) + 1;
    s.lapTimes[uid].push(lapTimeMs);

    // Reset checkpoint tracking for new lap
    if (s.positions[uid]) {
      s.positions[uid].checkpointIndex = 0;
      s.positions[uid].lapCheckpointSeq = [];
    }

    return s as unknown as Record<string, unknown>;
  }

  private handleRaceFinish(
    s: DriftLegendsState,
    uid: string,
    moveData: Record<string, unknown>,
  ): Record<string, unknown> {
    const totalTimeMs = moveData.totalTimeMs as number;

    // Validate total time against server clock — warn but accept (client tracks
    // raceTime from countdown end, server startedAt includes loading + countdown)
    const serverElapsed = Date.now() - s.startedAt;
    if (Math.abs(totalTimeMs - serverElapsed) > 60000) {
      this.logger.warn(`Suspicious finish time for ${uid}: client=${totalTimeMs}ms server=${serverElapsed}ms (>60s delta)`);
      throw new Error('Race finish time too far from server clock');
    }

    // Validate laps — allow if within 1 lap (race-finish may arrive before final lap-complete)
    const completedLaps = s.laps[uid] || 0;
    if (completedLaps < s.totalLaps - 1) {
      throw new Error(`Not enough laps completed: ${completedLaps}/${s.totalLaps}`);
    }
    // Auto-credit final lap if race-finish arrived before lap-complete
    if (completedLaps < s.totalLaps) {
      this.logger.log(`Auto-credited final lap for ${uid} (${completedLaps}/${s.totalLaps})`);
      s.laps[uid] = s.totalLaps;
    }

    s.finished[uid] = true;
    s.finishedAt[uid] = Date.now();

    return s as unknown as Record<string, unknown>;
  }

  // ─── Result Builder ───────────────────────────────────────────────

  private buildResult(s: DriftLegendsState): GameResult {
    // Rank by finish time (earlier = better). Unfinished players rank last.
    const ranked = [...s.players].sort((a, b) => {
      if (s.finished[a] && !s.finished[b]) return -1;
      if (!s.finished[a] && s.finished[b]) return 1;
      if (!s.finished[a] && !s.finished[b]) return 0;
      return s.finishedAt[a] - s.finishedAt[b];
    });

    const players: Record<
      string,
      { score: number; rank: number; outcome: 'win' | 'loss' | 'draw' }
    > = {};

    ranked.forEach((uid, index) => {
      const totalTime = s.lapTimes[uid]?.reduce(
        (sum: number, t: number) => sum + t,
        0,
      ) || 0;
      players[uid] = {
        score: totalTime > 0 ? -totalTime : 0, // negative time (lower is better)
        rank: index + 1,
        outcome: index === 0 ? 'win' : 'loss',
      };
    });

    return { players, reason: 'completed' };
  }
}
