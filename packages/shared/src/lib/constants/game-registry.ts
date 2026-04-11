import { GameMode } from '../types/multiplayer.types.js';

/**
 * Single source of truth for all games in Weekly Arcade.
 * Used by the API catalog endpoint and consumed by all frontend pages.
 */

export interface MultiplayerConfig {
  enabled: boolean;
  minPlayers: number;
  maxPlayers: number;
  mode: GameMode;
  /** Seconds per turn for turn-based games */
  turnTimeoutSec?: number;
  /** Maximum session duration in minutes */
  sessionTimeoutMin?: number;
  spectatorAllowed: boolean;
}

export interface GameInfo {
  id: string;
  name: string;
  icon: string;
  description: string;
  genres: string[];
  /** Optional — omit for single-player-only games */
  multiplayer?: MultiplayerConfig;
}

export const GAME_REGISTRY: GameInfo[] = [
  { id: 'stack-tower',        name: 'Stack Tower',         icon: '🏗️', description: 'Timing arcade',         genres: ['arcade', 'casual'] },
  { id: 'voidbreak',          name: 'Voidbreak',           icon: '☄️', description: 'Asteroid roguelite',     genres: ['action', 'arcade'] },
  { id: 'wordle',             name: 'Wordle',              icon: '🔤', description: 'Word puzzle',            genres: ['puzzle'] },
  { id: 'snake',              name: 'Snake',               icon: '🐍', description: 'Classic arcade',         genres: ['arcade'] },
  { id: '2048',               name: '2048',                icon: '🔢', description: 'Number puzzle',          genres: ['puzzle', 'strategy'] },
  { id: 'chaos-kitchen',      name: 'Chaos Kitchen',       icon: '👨‍🍳', description: 'Cooking game',           genres: ['action', 'casual'] },
  { id: 'memory-match',       name: 'Memory Match',        icon: '🃏', description: 'Card matching',          genres: ['casual', 'puzzle'] },
  { id: 'lumble',             name: 'Lumble',              icon: '🫧', description: '3D platformer',          genres: ['3d', 'action'] },
  { id: 'fieldstone',         name: 'Fieldstone',          icon: '🏰', description: 'Kingdom builder',        genres: ['strategy', 'puzzle'] },
  { id: 'solitaire-roguelite',name: 'Solitaire Roguelite', icon: '🃏', description: 'Klondike with Jokers',   genres: ['card', 'puzzle'] },
  { id: 'coin-cascade',       name: 'Coin Cascade',        icon: '🪙', description: 'Physics coin pusher',    genres: ['arcade', 'casual'] },
  { id: 'tiny-tycoon',        name: 'Tiny Tycoon',         icon: '🧋', description: 'Boba shop simulator',    genres: ['simulation', 'casual'] },
  { id: 'cricket-blitz',    name: 'Cricket Blitz',       icon: '🏏', description: '3D IPL-style cricket',  genres: ['sports', '3d'] },
  { id: 'chess-3d',          name: 'Chess 3D',            icon: '♟️', description: '3D chess vs AI & friends', genres: ['strategy', 'board', '3d', 'multiplayer'],
    multiplayer: { enabled: true, minPlayers: 2, maxPlayers: 2, mode: 'turn-based', turnTimeoutSec: 120, sessionTimeoutMin: 90, spectatorAllowed: true } },
  { id: 'drift-legends',     name: 'Drift Legends',        icon: '🏎️', description: '3D kart racing with story mode & multiplayer', genres: ['racing', '3d', 'story', 'multiplayer'],
    multiplayer: { enabled: true, minPlayers: 2, maxPlayers: 2, mode: 'real-time', sessionTimeoutMin: 15, spectatorAllowed: false } },
  { id: 'chroma-sort',       name: 'Chroma Sort',          icon: '🎨', description: 'Daily color sorting puzzle', genres: ['puzzle', 'logic', 'daily'] },
];

/** Lookup a game by ID */
export function getGameInfo(gameId: string): GameInfo | undefined {
  return GAME_REGISTRY.find(g => g.id === gameId);
}
