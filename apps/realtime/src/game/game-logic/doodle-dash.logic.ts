import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { MultiplayerGameLogic, GameResult } from '@weekly-arcade/shared';
import { GameLogicRegistry } from '../game-logic.registry';

// ─── Types ──────────────────────────────────────────────────────────

type GameMode = 'classic' | 'speed-draw';
type RoundPhase =
  | 'idle'
  | 'word-choice'
  | 'drawing'
  | 'guessing'
  | 'sd-drawing'   // Speed Draw simultaneous drawing
  | 'sd-vote'      // Speed Draw voting after reveal
  | 'round-end';

interface DrawStroke {
  uid: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  width: number;
  tool: string;
}

interface PlayerState {
  uid: string;
  name: string;
  score: number;
  correctGuesses: number;
  starsReceived: number;
  hasGuessedThisRound: boolean;
  sdSubmitted: boolean;    // Speed Draw: submitted canvas
  votedFor: string | null; // Speed Draw: who they voted for
}

interface DoodleDashState {
  players: string[];
  playerStates: Record<string, PlayerState>;
  hostUid: string;                     // Only the host can start rounds
  mode: GameMode;
  phase: RoundPhase;
  round: number;
  totalRounds: number;
  currentDrawerUid: string | null;     // Classic: current drawer
  drawerIndex: number;                 // Classic: round-robin drawer index
  wordOptions: string[];               // 3 word choices presented to drawer
  currentWord: string | null;          // Word being drawn this round
  wordHint: string | null;             // Underscore mask shown to guessers
  hintRevealedCount: number;           // How many letters revealed so far
  strokeHistory: DrawStroke[];         // All strokes this round (for late joiners)
  roundStartedAt: number;              // Epoch ms when drawing phase started
  gameStartedAt: number;               // Epoch ms when game started
  roundEndReason: string | null;
  sdStarVotes: Record<string, number>; // Speed Draw: uid -> star count
  gameOver: boolean;
}

// ─── Word Bank ───────────────────────────────────────────────────────

const WORD_BANK: string[] = [
  // Animals
  'cat', 'dog', 'fish', 'bird', 'elephant', 'giraffe', 'penguin', 'dolphin',
  'octopus', 'butterfly', 'snake', 'turtle', 'lion', 'tiger', 'bear',
  // Food
  'pizza', 'hamburger', 'sushi', 'taco', 'apple', 'banana', 'watermelon',
  'ice cream', 'cake', 'donut', 'coffee', 'hotdog', 'sandwich', 'pasta',
  // Objects
  'house', 'car', 'bicycle', 'phone', 'laptop', 'umbrella', 'clock', 'camera',
  'guitar', 'piano', 'chair', 'table', 'lamp', 'book', 'pencil', 'key',
  'rocket', 'airplane', 'boat', 'train', 'helicopter',
  // Nature
  'sun', 'moon', 'star', 'cloud', 'rainbow', 'mountain', 'tree', 'flower',
  'beach', 'volcano', 'island', 'desert', 'forest', 'ocean',
  // Actions
  'swimming', 'dancing', 'sleeping', 'running', 'jumping', 'climbing',
  'cooking', 'painting', 'reading',
  // Places
  'castle', 'lighthouse', 'bridge', 'windmill', 'pyramid', 'igloo',
  'skyscraper', 'hospital', 'library', 'stadium',
  // Characters
  'pirate', 'astronaut', 'superhero', 'wizard', 'mermaid', 'dragon',
  'robot', 'ghost', 'vampire', 'ninja',
  // Misc
  'fireworks', 'treasure', 'compass', 'magnifying glass',
  'spaceship', 'submarine', 'hot air balloon', 'ferris wheel',
];

// ─── Constants ───────────────────────────────────────────────────────

const TURN_TIMEOUT_SEC         = 80;
const SPEED_DRAW_TIMEOUT_SEC   = 60;
const WORD_CHOICE_TIMEOUT_SEC  = 15;
const SCORE_GUESSER_MAX        = 500;
const SCORE_GUESSER_MIN        = 80;
const SCORE_DRAWER_PER_CORRECT = 50;
const XP_STAR_VOTE_RECEIVED    = 20;
const HINT_1_SEC               = 25;
const HINT_2_SEC               = 50;
const WORD_CHOICE_COUNT        = 3;
const DEFAULT_ROUNDS           = 6;
const SD_STAR_VOTES_PER_PLAYER = 1; // max votes per player in SD mode

// ─── Helpers ─────────────────────────────────────────────────────────

function pickWords(count: number): string[] {
  const arr = [...WORD_BANK];
  // Fisher-Yates shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

function buildHint(word: string, revealCount: number): string {
  const letters = word.split('');
  let revealed = 0;
  // Always reveal from both ends toward center for fairness
  const revealable = letters.map((_, i) => i).filter(i => letters[i] !== ' ');
  const toReveal = new Set<number>();

  // Pick positions: first from start, then from end alternating
  for (let i = 0; i < revealCount && i < revealable.length; i++) {
    if (i % 2 === 0) toReveal.add(revealable[i]);
    else toReveal.add(revealable[revealable.length - 1 - Math.floor(i / 2)]);
    revealed++;
    if (revealed >= revealCount) break;
  }

  return letters.map((ch, i) => {
    if (ch === ' ') return '  ';
    return toReveal.has(i) ? ch : '_';
  }).join(' ');
}

function calculateGuesserScore(elapsed: number, totalTime: number): number {
  const ratio = Math.max(0, 1 - elapsed / totalTime);
  return Math.round(SCORE_GUESSER_MIN + (SCORE_GUESSER_MAX - SCORE_GUESSER_MIN) * ratio);
}

function fuzzyMatch(guess: string, target: string): 'correct' | 'close' | 'wrong' {
  const g = guess.trim().toLowerCase();
  const t = target.trim().toLowerCase();
  if (g === t) return 'correct';

  // Close: 1 character off (Levenshtein distance = 1)
  if (levenshtein(g, t) === 1) return 'close';

  // Close: contains the full word as substring (useful for plural/suffix)
  if (g.length >= 3 && (g.includes(t) || t.includes(g))) return 'close';

  return 'wrong';
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ─── Logic Class ─────────────────────────────────────────────────────

@Injectable()
export class DoodleDashLogic implements MultiplayerGameLogic, OnModuleInit {
  private readonly logger = new Logger(DoodleDashLogic.name);
  readonly gameId = 'doodle-dash';

  constructor(private readonly registry: GameLogicRegistry) {}

  onModuleInit() {
    this.registry.register(this);
    this.logger.log('Doodle Dash game logic registered');
  }

  // ─── createInitialState ─────────────────────────────────────────

  createInitialState(
    players: string[],
    config: Record<string, unknown>,
  ): Record<string, unknown> {
    const mode: GameMode = (config.mode as GameMode) || 'classic';
    const totalRounds     = (config.rounds as number) || DEFAULT_ROUNDS;

    const playerStates: Record<string, PlayerState> = {};
    players.forEach((uid) => {
      playerStates[uid] = {
        uid,
        name: (config[`name_${uid}`] as string) || uid,
        score: 0,
        correctGuesses: 0,
        starsReceived: 0,
        hasGuessedThisRound: false,
        sdSubmitted: false,
        votedFor: null,
      };
    });

    const state: DoodleDashState = {
      players,
      playerStates,
      hostUid: players[0],
      mode,
      phase: 'idle',
      round: 0,
      totalRounds,
      currentDrawerUid: null,
      drawerIndex: 0,
      wordOptions: [],
      currentWord: null,
      wordHint: null,
      hintRevealedCount: 0,
      strokeHistory: [],
      roundStartedAt: 0,
      gameStartedAt: Date.now(),
      roundEndReason: null,
      sdStarVotes: {},
      gameOver: false,
    };

    return state as unknown as Record<string, unknown>;
  }

  // ─── applyMove ──────────────────────────────────────────────────

  applyMove(
    state: Record<string, unknown>,
    uid: string,
    moveType: string,
    moveData: Record<string, unknown>,
  ): Record<string, unknown> {
    const s = state as unknown as DoodleDashState;

    if (!s.players.includes(uid)) {
      throw new Error('Player not in this game');
    }

    switch (moveType) {
      case 'start-round':
        return this.handleStartRound(s, uid);
      case 'word-choice':
        return this.handleWordChoice(s, uid, moveData);
      case 'draw-stroke':
        return this.handleDrawStroke(s, uid, moveData);
      case 'guess':
        return this.handleGuess(s, uid, moveData);
      case 'star-vote':
        return this.handleStarVote(s, uid, moveData);
      default:
        throw new Error(`Unknown move type: ${moveType}`);
    }
  }

  // ─── Move Handlers ──────────────────────────────────────────────

  private handleStartRound(
    s: DoodleDashState,
    uid: string,
  ): Record<string, unknown> {
    if (uid !== s.hostUid) {
      throw new Error('Only the host can start a round');
    }
    if (s.gameOver) {
      throw new Error('Game is already over');
    }

    s.round++;

    if (s.round > s.totalRounds) {
      s.gameOver = true;
      s.phase    = 'round-end';
      return s as unknown as Record<string, unknown>;
    }

    // Reset per-round state
    s.strokeHistory     = [];
    s.currentWord       = null;
    s.wordHint          = null;
    s.hintRevealedCount = 0;
    s.roundEndReason    = null;

    // Reset player round state
    s.players.forEach((uid) => {
      if (s.playerStates[uid]) {
        s.playerStates[uid].hasGuessedThisRound = false;
        s.playerStates[uid].sdSubmitted         = false;
        s.playerStates[uid].votedFor            = null;
      }
    });
    s.sdStarVotes = {};

    if (s.mode === 'classic') {
      // Assign drawer (round-robin)
      s.drawerIndex       = (s.round - 1) % s.players.length;
      s.currentDrawerUid  = s.players[s.drawerIndex];
      s.phase             = 'word-choice';
      s.wordOptions       = pickWords(WORD_CHOICE_COUNT);
      s.roundStartedAt    = Date.now();
    } else {
      // Speed Draw: everyone draws simultaneously
      s.currentDrawerUid = null;
      s.phase            = 'sd-drawing';
      s.currentWord      = pickWords(1)[0];
      s.roundStartedAt   = Date.now();
    }

    return s as unknown as Record<string, unknown>;
  }

  private handleWordChoice(
    s: DoodleDashState,
    uid: string,
    moveData: Record<string, unknown>,
  ): Record<string, unknown> {
    if (s.mode !== 'classic') throw new Error('word-choice only valid in Classic mode');
    if (uid !== s.currentDrawerUid) throw new Error('Only the current drawer can choose a word');
    if (s.phase !== 'word-choice') throw new Error('Not in word-choice phase');

    const word = moveData.word as string;

    // Validate word is one of the offered options (or allow free-form fallback)
    if (word && !s.wordOptions.includes(word)) {
      this.logger.warn(`Drawer ${uid} picked word "${word}" not in options — using first option`);
      s.currentWord = s.wordOptions[0];
    } else if (word) {
      s.currentWord = word;
    } else {
      s.currentWord = s.wordOptions[0];
    }

    s.wordHint        = buildHint(s.currentWord, 0);
    s.phase           = 'drawing';
    s.roundStartedAt  = Date.now();

    return s as unknown as Record<string, unknown>;
  }

  private handleDrawStroke(
    s: DoodleDashState,
    uid: string,
    moveData: Record<string, unknown>,
  ): Record<string, unknown> {
    const tool = moveData.tool as string;

    // Speed Draw: handle canvas submission (only store flag, NOT image data — keep state small)
    if (tool === 'sd-submit') {
      if (s.mode !== 'speed-draw') return s as unknown as Record<string, unknown>;
      if (!s.playerStates[uid]) return s as unknown as Record<string, unknown>;
      s.playerStates[uid].sdSubmitted  = true;
      // Canvas data is relayed via moveData broadcast, NOT stored in game state
      return s as unknown as Record<string, unknown>;
    }

    // Classic: only drawer can emit strokes
    if (s.mode === 'classic') {
      if (uid !== s.currentDrawerUid) {
        throw new Error('Only the drawer can send strokes');
      }
      if (s.phase !== 'drawing') {
        // Silently ignore — may be a stale event
        return s as unknown as Record<string, unknown>;
      }
    } else {
      // Speed Draw: all players can draw in sd-drawing phase
      if (s.phase !== 'sd-drawing') {
        return s as unknown as Record<string, unknown>;
      }
    }

    // Handle undo: remove last 10 strokes from THIS player only
    if (tool === 'undo') {
      let removed = 0;
      for (let i = s.strokeHistory.length - 1; i >= 0 && removed < 10; i--) {
        if (s.strokeHistory[i].uid === uid) {
          s.strokeHistory.splice(i, 1);
          removed++;
        }
      }
      return s as unknown as Record<string, unknown>;
    }

    if (tool === 'clear') {
      // Remove all strokes from this player in classic mode
      s.strokeHistory = s.mode === 'classic' ? [] : s.strokeHistory;
      return s as unknown as Record<string, unknown>;
    }

    // Normal stroke: relay and store for late joiners
    const stroke: DrawStroke = {
      uid,
      x0:    (moveData.x0 as number) || 0,
      y0:    (moveData.y0 as number) || 0,
      x1:    (moveData.x1 as number) || 0,
      y1:    (moveData.y1 as number) || 0,
      color: (moveData.color as string) || '#000000',
      width: (moveData.width as number) || 3,
      tool:  tool || 'pen',
    };
    s.strokeHistory.push(stroke);

    // Cap history to last 2000 strokes to prevent memory bloat
    if (s.strokeHistory.length > 2000) {
      s.strokeHistory = s.strokeHistory.slice(-2000);
    }

    return s as unknown as Record<string, unknown>;
  }

  private handleGuess(
    s: DoodleDashState,
    uid: string,
    moveData: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!s.currentWord) {
      return s as unknown as Record<string, unknown>; // no word yet
    }

    // Drawer cannot guess their own word in classic
    if (s.mode === 'classic' && uid === s.currentDrawerUid) {
      return s as unknown as Record<string, unknown>;
    }

    const ps = s.playerStates[uid];
    if (!ps) return s as unknown as Record<string, unknown>;

    if (ps.hasGuessedThisRound) {
      return s as unknown as Record<string, unknown>; // already guessed correctly
    }

    const text = (moveData.text as string) || '';
    const result = fuzzyMatch(text, s.currentWord);

    if (result === 'correct') {
      ps.hasGuessedThisRound = true;
      ps.correctGuesses++;

      const elapsed = (Date.now() - s.roundStartedAt) / 1000;
      const totalTime = s.mode === 'classic' ? TURN_TIMEOUT_SEC : SPEED_DRAW_TIMEOUT_SEC;
      const score = calculateGuesserScore(elapsed, totalTime);

      ps.score += score;

      // Drawer also earns points per correct guesser in classic
      if (s.mode === 'classic' && s.currentDrawerUid) {
        const drawerPs = s.playerStates[s.currentDrawerUid];
        if (drawerPs) {
          drawerPs.score += SCORE_DRAWER_PER_CORRECT;
        }
      }

      // Attach result to move data so server can broadcast it
      (moveData as Record<string, unknown>).__result     = 'correct';
      (moveData as Record<string, unknown>).__score      = score;
      (moveData as Record<string, unknown>).__playerName = ps.name;
    } else if (result === 'close') {
      (moveData as Record<string, unknown>).__result     = 'close';
      (moveData as Record<string, unknown>).__playerName = ps.name;
    } else {
      (moveData as Record<string, unknown>).__result     = 'wrong';
      (moveData as Record<string, unknown>).__playerName = ps.name;
    }

    return s as unknown as Record<string, unknown>;
  }

  private handleStarVote(
    s: DoodleDashState,
    uid: string,
    moveData: Record<string, unknown>,
  ): Record<string, unknown> {
    if (s.mode !== 'speed-draw') throw new Error('star-vote only valid in Speed Draw mode');
    if (s.phase !== 'sd-vote') throw new Error('Not in voting phase');

    const ps = s.playerStates[uid];
    if (!ps) return s as unknown as Record<string, unknown>;

    if (ps.votedFor !== null) {
      return s as unknown as Record<string, unknown>; // already voted
    }

    const targetUid = moveData.targetUid as string;
    if (targetUid === uid) throw new Error('Cannot vote for yourself');
    if (!s.players.includes(targetUid)) throw new Error('Target player not in game');

    ps.votedFor = targetUid;
    s.sdStarVotes[targetUid] = (s.sdStarVotes[targetUid] || 0) + 1;

    // Award XP to voted player
    const targetPs = s.playerStates[targetUid];
    if (targetPs) {
      targetPs.score          += XP_STAR_VOTE_RECEIVED;
      targetPs.starsReceived  += 1;
    }

    (moveData as Record<string, unknown>).__stars = s.sdStarVotes[targetUid];

    return s as unknown as Record<string, unknown>;
  }

  // ─── checkGameOver ──────────────────────────────────────────────

  checkGameOver(state: Record<string, unknown>): GameResult | null {
    const s = state as unknown as DoodleDashState;

    if (!s.gameOver) return null;

    return this.buildResult(s);
  }

  // ─── getNextTurn ────────────────────────────────────────────────

  getNextTurn(state: Record<string, unknown>): string | null {
    const s = state as unknown as DoodleDashState;

    // Classic mode: the current drawer is the "active" player
    if (s.mode === 'classic' && s.currentDrawerUid) {
      return s.currentDrawerUid;
    }

    // Speed Draw: all players draw simultaneously — no designated "next turn"
    return null;
  }

  // ─── Result Builder ─────────────────────────────────────────────

  private buildResult(s: DoodleDashState): GameResult {
    // Sort players by score descending
    const ranked = [...s.players].sort((a, b) => {
      return (s.playerStates[b]?.score || 0) - (s.playerStates[a]?.score || 0);
    });

    const players: Record<
      string,
      { score: number; rank: number; outcome: 'win' | 'loss' | 'draw' }
    > = {};

    ranked.forEach((uid, index) => {
      const ps = s.playerStates[uid];
      players[uid] = {
        score:   ps?.score   || 0,
        rank:    index + 1,
        outcome: index === 0 ? 'win' : 'loss',
      };
    });

    // Handle draw (tied top score)
    if (ranked.length >= 2) {
      const topScore = players[ranked[0]].score;
      if (players[ranked[1]].score === topScore) {
        players[ranked[0]].outcome = 'draw';
        players[ranked[1]].outcome = 'draw';
      }
    }

    return { players, reason: 'completed' };
  }
}
