/**
 * Single source of truth for all games in Weekly Arcade.
 * Used by the API catalog endpoint and consumed by all frontend pages.
 */

export interface GameInfo {
  id: string;
  name: string;
  icon: string;
  description: string;
  genres: string[];
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
  { id: 'tiny-tycoon-bean-brew',     name: 'TT: Bean & Brew',    icon: '☕', description: 'Coffee house',          genres: ['simulation', 'casual'] },
  { id: 'tiny-tycoon-juice-junction',name: 'TT: Juice Junction', icon: '🍊', description: 'Juice bar',             genres: ['simulation', 'casual'] },
  { id: 'tiny-tycoon-sweet-tooth',   name: 'TT: Sweet Tooth',    icon: '🧁', description: 'Bakery & desserts',     genres: ['simulation', 'casual'] },
  { id: 'tiny-tycoon-golden-lounge', name: 'TT: Golden Lounge',  icon: '🥂', description: 'Luxury cocktail bar',   genres: ['simulation', 'casual'] },
  { id: 'cricket-blitz',    name: 'Cricket Blitz',       icon: '🏏', description: '3D IPL-style cricket',  genres: ['sports', '3d'] },
];

/** Lookup a game by ID */
export function getGameInfo(gameId: string): GameInfo | undefined {
  return GAME_REGISTRY.find(g => g.id === gameId);
}
