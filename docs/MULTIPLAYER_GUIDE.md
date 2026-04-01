# Multiplayer Integration Guide

How to add multiplayer support to a new game in Weekly Arcade.

## Architecture

```
Browser                          Backend
┌──────────┐   WebSocket    ┌──────────────┐
│  Game JS  │◄────────────►│  Realtime     │  (apps/realtime/, port 3001)
│           │               │  Socket.IO    │  — moves, state sync, presence
│           │   REST HTTP   ├──────────────┤
│           │◄────────────►│  API          │  (apps/api/, port 8080)
└──────────┘               │  NestJS       │  — sessions, matchmaking, invitations
                            └──────┬───────┘
                                   │
                            ┌──────▼───────┐
                            │  Firestore   │  (shared DB)
                            └──────────────┘
```

**Move flow:** Client emits `game:move` via WebSocket → Realtime validates via your `GameLogic.applyMove()` (~1ms in-memory) → broadcasts new state to all players → async persists to Firestore.

**Session flow:** Client creates session via REST → gets `sessionId` → connects WebSocket with `sessionId` → joins Socket.IO room → plays game.

---

## Step-by-Step: Adding a Multiplayer Game

### Step 1: Define Game in Registry

**File:** `packages/shared/src/lib/constants/game-registry.ts`

Add your game with a `multiplayer` config:

```typescript
{
  id: 'my-game',
  name: 'My Game',
  icon: '🎮',
  description: 'A multiplayer game',
  genres: ['strategy', 'multiplayer'],
  multiplayer: {
    enabled: true,
    minPlayers: 2,
    maxPlayers: 4,          // Supports 2-4 players
    mode: 'turn-based',     // 'turn-based' | 'real-time'
    turnTimeoutSec: 30,     // Auto-skip turn after 30s (turn-based only)
    sessionTimeoutMin: 30,  // Max game duration
    spectatorAllowed: true,
  },
}
```

**`mode` determines behavior:**
- `'turn-based'`: Server tracks `currentTurnUid`. Only the active player can submit moves. Turns auto-skip on timeout.
- `'real-time'`: All players can submit moves simultaneously. `getNextTurn()` returns `null`.

### Step 2: Implement Server-Side Game Logic

**Create:** `apps/realtime/src/game/game-logic/my-game.logic.ts`

Every multiplayer game must implement the `MultiplayerGameLogic` interface:

```typescript
import { MultiplayerGameLogic, GameResult } from '@weekly-arcade/shared';

export class MyGameLogic implements MultiplayerGameLogic {
  readonly gameId = 'my-game'; // Must match game-registry.ts id

  /**
   * Called once when the host starts the game.
   * Create and return the initial board/game state.
   *
   * @param players - Array of UIDs in the game (e.g., ['uid1', 'uid2'])
   * @param config  - Game config set by the host when creating the session
   */
  createInitialState(
    players: string[],
    config: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      board: this.createBoard(config),
      scores: Object.fromEntries(players.map(uid => [uid, 0])),
      currentPlayerIndex: 0,
      players,            // Ordered list, used for turn rotation
      moveCount: 0,
    };
  }

  /**
   * Validate and apply a move. This is the core game logic.
   *
   * RULES:
   * - MUST throw an Error if the move is invalid (wrong turn, illegal move, etc.)
   * - MUST return the NEW state (don't mutate the input state)
   * - Keep it fast (<10ms) — this runs in-memory on every move
   *
   * @param state    - Current game state
   * @param uid      - UID of the player making the move
   * @param moveType - String identifier for the type of move (e.g., 'place-piece', 'flip-card')
   * @param moveData - Move payload from the client
   */
  applyMove(
    state: Record<string, unknown>,
    uid: string,
    moveType: string,
    moveData: Record<string, unknown>,
  ): Record<string, unknown> {
    const players = state.players as string[];
    const currentPlayerIndex = state.currentPlayerIndex as number;

    // Validate it's this player's turn
    if (players[currentPlayerIndex] !== uid) {
      throw new Error('Not your turn');
    }

    // Validate the move
    if (moveType === 'place-piece') {
      const { row, col } = moveData as { row: number; col: number };
      const board = state.board as string[][];

      if (board[row]?.[col] !== '') {
        throw new Error('Cell already occupied');
      }

      // Apply the move — return NEW state
      const newBoard = board.map(r => [...r]);
      newBoard[row][col] = uid;

      return {
        ...state,
        board: newBoard,
        currentPlayerIndex: (currentPlayerIndex + 1) % players.length,
        moveCount: (state.moveCount as number) + 1,
      };
    }

    throw new Error(`Unknown move type: ${moveType}`);
  }

  /**
   * Check if the game is over after each move.
   *
   * Return null if the game continues.
   * Return a GameResult if the game has ended.
   */
  checkGameOver(state: Record<string, unknown>): GameResult | null {
    const winner = this.findWinner(state);
    if (!winner && !this.isBoardFull(state)) {
      return null; // Game continues
    }

    const players = state.players as string[];
    const resultPlayers: Record<string, { score: number; rank: number; outcome: 'win' | 'loss' | 'draw' }> = {};

    if (winner) {
      // Someone won
      players.forEach((uid, i) => {
        resultPlayers[uid] = {
          score: (state.scores as Record<string, number>)[uid] || 0,
          rank: uid === winner ? 1 : 2,
          outcome: uid === winner ? 'win' : 'loss',
        };
      });
    } else {
      // Draw
      players.forEach(uid => {
        resultPlayers[uid] = {
          score: (state.scores as Record<string, number>)[uid] || 0,
          rank: 1,
          outcome: 'draw',
        };
      });
    }

    return { players: resultPlayers, reason: 'completed' };
  }

  /**
   * Determine whose turn it is next.
   *
   * - Turn-based games: return the UID of the next player
   * - Real-time games: return null (all players can move)
   */
  getNextTurn(state: Record<string, unknown>): string | null {
    const players = state.players as string[];
    const currentPlayerIndex = state.currentPlayerIndex as number;
    return players[currentPlayerIndex];
  }

  /**
   * (Optional) Anti-cheat suspicion scoring.
   * Return 0.0 (no suspicion) to 1.0 (highly suspicious).
   * Only implement if your game has detectable cheat patterns.
   */
  // suspicionScore(moves: GameMove[]): number {
  //   return 0;
  // }

  // --- Private helpers ---

  private createBoard(config: Record<string, unknown>): string[][] {
    const size = (config.boardSize as number) || 3;
    return Array.from({ length: size }, () => Array(size).fill(''));
  }

  private findWinner(state: Record<string, unknown>): string | null {
    // Your win detection logic
    return null;
  }

  private isBoardFull(state: Record<string, unknown>): boolean {
    // Your board full check
    return false;
  }
}
```

### Step 3: Register Game Logic

**File:** `apps/realtime/src/game/game.module.ts`

Register your game logic so the realtime service knows how to handle it:

```typescript
import { Module, OnModuleInit } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GameStateManager } from './game-state.manager';
import { GameRoomManager } from './game-room.manager';
import { GameLogicRegistry } from './game-logic.registry';
import { MyGameLogic } from './game-logic/my-game.logic';

@Module({
  providers: [GameGateway, GameStateManager, GameRoomManager, GameLogicRegistry],
  exports: [GameLogicRegistry, GameStateManager, GameRoomManager],
})
export class GameModule implements OnModuleInit {
  constructor(private readonly registry: GameLogicRegistry) {}

  onModuleInit() {
    // Register all multiplayer game logic implementations
    this.registry.register(new MyGameLogic());
    // this.registry.register(new ChessLogic());
    // this.registry.register(new AnotherGameLogic());
  }
}
```

### Step 4: Create Game Data JSON

**File:** `apps/web-astro/src/data/games/my-game.json`

```json
{
  "id": "my-game",
  "name": "My Game",
  "icon": "🎮",
  "title": "My Game | Weekly Arcade - Free Multiplayer Game",
  "description": "Play My Game free online against friends!",
  "keywords": "multiplayer game, strategy, free game, browser game",
  "url": "/games/my-game/",
  "themeColor": "#6366f1",
  "accentColor": "#6366f1",
  "genres": ["Strategy", "Multiplayer"],
  "ratingValue": "4.5",
  "ratingCount": "100"
}
```

### Step 5: Create Astro Page

**File:** `apps/web-astro/src/pages/games/my-game.astro`

```astro
---
import GameLayout from '../../layouts/GameLayout.astro';
import gameData from '../../data/games/my-game.json';
---

<GameLayout
  title={gameData.title}
  gameName={gameData.name}
  gameId={gameData.id}
  icon={gameData.icon}
  description={gameData.description}
  keywords={gameData.keywords}
  url={gameData.url}
  themeColor={gameData.themeColor}
  accentColor={gameData.accentColor}
  genres={gameData.genres}
  ratingValue={gameData.ratingValue}
  ratingCount={gameData.ratingCount}
>
  <!-- Multiplayer dependencies (not loaded by single-player games) -->
  <Fragment slot="head">
    <script is:inline src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
    <script is:inline src="/js/multiplayer-client.js"></script>
    <script is:inline src="/js/multiplayer-ui.js"></script>
  </Fragment>

  <!-- Main Menu -->
  <div id="menuScreen">
    <h1>My Game</h1>
    <button id="quickMatchBtn">Quick Match</button>
    <button id="createPrivateBtn">Create Private Game</button>
    <button id="joinCodeBtn">Join by Code</button>
  </div>

  <!-- Lobby (shown after creating/joining) -->
  <div id="lobbyScreen" style="display:none"></div>

  <!-- Game Board (shown during play) -->
  <div id="gameScreen" style="display:none">
    <!-- Your game UI here -->
    <div id="turnIndicator"></div>
    <div id="gameBoard"></div>
  </div>

  <!-- Game JS -->
  <script is:inline src="/games/my-game/game.js"></script>
</GameLayout>
```

### Step 6: Create Game JavaScript

**File:** `apps/web-astro/public/games/my-game/game.js`

This is the complete frontend integration pattern:

```javascript
(function () {
  'use strict';

  // ─── State ──────────────────────────────────────────────────────
  let currentSessionId = null;
  let myUid = null;
  let isHost = false;
  let lobby = null;  // multiplayerUI lobby instance
  let gameState = null;

  // ─── DOM refs ───────────────────────────────────────────────────
  const menuScreen = document.getElementById('menuScreen');
  const lobbyScreen = document.getElementById('lobbyScreen');
  const gameScreen = document.getElementById('gameScreen');

  // ─── Auth ───────────────────────────────────────────────────────
  // Wait for auth to be ready (same pattern as all Weekly Arcade games)
  const authCheck = setInterval(() => {
    if (window.authManager?.isInitialized) {
      clearInterval(authCheck);
      window.authManager.onAuthStateChanged(user => {
        myUid = user?.uid || null;
      });
    }
  }, 100);

  // ─── Menu Handlers ──────────────────────────────────────────────

  document.getElementById('quickMatchBtn')?.addEventListener('click', async () => {
    if (!myUid) { window.authNudge?.show(); return; }

    window.multiplayerUI.showMatchmaking('My Game', async () => {
      await window.multiplayerClient.cancelMatchmaking();
    });

    try {
      const result = await window.multiplayerClient.findMatch('my-game');
      if (result.matchedSessionId) {
        window.multiplayerUI.hideMatchmaking();
        await joinAndShowLobby(result.matchedSessionId);
      } else {
        // Poll for match (or set up a polling interval)
        pollForMatch();
      }
    } catch (err) {
      window.multiplayerUI.hideMatchmaking();
      console.error('Matchmaking error:', err);
    }
  });

  document.getElementById('createPrivateBtn')?.addEventListener('click', async () => {
    if (!myUid) { window.authNudge?.show(); return; }

    try {
      const session = await window.multiplayerClient.createSession('my-game', {
        mode: 'private',
        maxPlayers: 2,
        gameConfig: { boardSize: 3 }, // Game-specific config
      });
      currentSessionId = session.sessionId;
      isHost = true;
      showLobby(session);
    } catch (err) {
      console.error('Create session error:', err);
    }
  });

  document.getElementById('joinCodeBtn')?.addEventListener('click', async () => {
    if (!myUid) { window.authNudge?.show(); return; }

    const code = prompt('Enter join code:');
    if (!code) return;

    try {
      const session = await window.multiplayerClient.joinByCode(code);
      currentSessionId = session.sessionId;
      isHost = false;
      await joinAndShowLobby(session.sessionId);
    } catch (err) {
      alert('Invalid or expired code');
    }
  });

  // Check for deep link: /games/my-game/?session=XYZ or ?join=CODE
  const params = new URLSearchParams(window.location.search);
  if (params.get('session')) {
    const waitForAuth = setInterval(async () => {
      if (myUid) {
        clearInterval(waitForAuth);
        await joinAndShowLobby(params.get('session'));
      }
    }, 200);
  } else if (params.get('join')) {
    const waitForAuth = setInterval(async () => {
      if (myUid) {
        clearInterval(waitForAuth);
        try {
          const session = await window.multiplayerClient.joinByCode(params.get('join'));
          await joinAndShowLobby(session.sessionId);
        } catch { alert('Invalid or expired code'); }
      }
    }, 200);
  }

  // ─── Lobby ──────────────────────────────────────────────────────

  function showLobby(session) {
    menuScreen.style.display = 'none';
    lobbyScreen.style.display = 'block';

    lobby = window.multiplayerUI.createLobbyUI('lobbyScreen', {
      sessionId: session.sessionId,
      isHost,
      joinCode: session.joinCode,
      gameName: 'My Game',
      onStart: async (sid) => {
        await window.multiplayerClient.startGame(sid);
      },
      onLeave: async (sid) => {
        await window.multiplayerClient.leaveSession(sid);
        lobby?.destroy();
        lobbyScreen.style.display = 'none';
        menuScreen.style.display = 'block';
      },
      onInvite: (sid) => {
        // Show friend picker or copy join code
        const code = session.joinCode;
        if (code) {
          navigator.clipboard?.writeText(code);
          alert(`Join code copied: ${code}`);
        }
      },
    });

    // Update lobby with current players
    lobby.updatePlayers(session.players);
  }

  async function joinAndShowLobby(sessionId) {
    try {
      const session = await window.multiplayerClient.getSession(sessionId);
      currentSessionId = sessionId;
      isHost = session.hostUid === myUid;

      // Connect WebSocket FIRST, then show lobby
      await window.multiplayerClient.connect(sessionId);
      registerWebSocketListeners();
      showLobby(session);
    } catch (err) {
      console.error('Join error:', err);
    }
  }

  // ─── WebSocket Event Handlers ───────────────────────────────────

  function registerWebSocketListeners() {
    // New player joined the lobby
    window.multiplayerClient.onPlayerJoined(async (player) => {
      const session = await window.multiplayerClient.getSession(currentSessionId);
      lobby?.updatePlayers(session.players);
    });

    // Player left
    window.multiplayerClient.onPlayerLeft(async ({ uid, reason }) => {
      const session = await window.multiplayerClient.getSession(currentSessionId);
      lobby?.updatePlayers(session.players);
    });

    // Game started — transition from lobby to game
    window.multiplayerClient.onGameState((data) => {
      gameState = data.state;
      if (lobbyScreen.style.display !== 'none') {
        // First state = game just started
        lobbyScreen.style.display = 'none';
        gameScreen.style.display = 'block';
        lobby?.destroy();
      }
      renderGame(data.state, data.turnUid);
    });

    // Game over
    window.multiplayerClient.onGameFinished(({ results }) => {
      window.multiplayerUI.showResults(results, {
        onPlayAgain: () => {
          gameScreen.style.display = 'none';
          menuScreen.style.display = 'block';
          window.multiplayerClient.disconnect();
        },
        onClose: () => {
          gameScreen.style.display = 'none';
          menuScreen.style.display = 'block';
          window.multiplayerClient.disconnect();
        },
      });
    });

    // Move rejected — show error to player
    window.multiplayerClient.onMoveRejected(({ reason }) => {
      console.warn('Move rejected:', reason);
      // Optionally show a toast or shake animation
    });

    // Connection lost
    window.multiplayerClient.onError(({ code }) => {
      if (code === 'DISCONNECTED') {
        window.multiplayerUI.showDisconnectOverlay();
      }
    });

    // Socket.IO auto-reconnects; when game:state arrives again, hide overlay
    window.multiplayerClient.on('game:state', () => {
      window.multiplayerUI.hideDisconnectOverlay();
    });
  }

  // ─── Game Rendering & Interaction ───────────────────────────────

  function renderGame(state, turnUid) {
    // 1. Render the board from the authoritative server state
    const board = state.board;
    const boardEl = document.getElementById('gameBoard');
    // ... render board HTML ...

    // 2. Show whose turn it is
    const turnEl = document.getElementById('turnIndicator');
    if (turnUid === myUid) {
      turnEl.textContent = 'Your turn!';
      enableInput();
    } else {
      turnEl.textContent = `Waiting for opponent...`;
      disableInput();
    }
  }

  // When the player makes a move — send to server, DON'T update local state
  function onCellClick(row, col) {
    window.multiplayerClient.submitMove('place-piece', { row, col });

    // The server will validate, apply, and broadcast the new state.
    // The game:state event will trigger renderGame() with the updated board.
    // Do NOT update the board locally — let the server be the source of truth.
  }

  function enableInput() { /* enable click handlers */ }
  function disableInput() { /* disable click handlers */ }

  // ─── Matchmaking Polling ────────────────────────────────────────

  let matchPollTimer = null;

  function pollForMatch() {
    matchPollTimer = setInterval(async () => {
      try {
        const status = await window.multiplayerClient.getMatchmakingStatus();
        if (status?.status === 'matched' && status.sessionId) {
          clearInterval(matchPollTimer);
          window.multiplayerUI.hideMatchmaking();
          await joinAndShowLobby(status.sessionId);
        }
      } catch { /* ignore polling errors */ }
    }, 2000);
  }
})();
```

### Step 7: Add Score Validation Config (Optional)

If your multiplayer game also submits individual scores to the leaderboard:

**File:** `apps/api/src/leaderboard/config/game-config.ts`

Add a validation entry for your game.

### Step 8: Bump Cache Version

**File:** `apps/web-astro/public/sw.js`

```javascript
const CACHE_VERSION = 28; // Increment on every frontend change
```

---

## Frontend API Reference

### `window.multiplayerClient`

**Connection:**
| Method | Description |
|--------|-------------|
| `connect(sessionId)` | Open WebSocket to realtime service. Returns a Promise. |
| `disconnect()` | Close WebSocket and clean up all listeners. |
| `isConnected()` | Returns `true` if WebSocket is connected. |

**Game Actions (WebSocket):**
| Method | Description |
|--------|-------------|
| `submitMove(moveType, moveData)` | Send a move to the server. |
| `signalReady()` | Signal ready in the lobby. |
| `forfeit()` | Forfeit the current game. |
| `predictMove(moveType, moveData, predictor)` | Client-side prediction for real-time games. |

**Event Listeners (WebSocket):**
| Method | Callback Payload | Description |
|--------|-----------------|-------------|
| `onGameState(cb)` | `{ state, version, turnUid }` | Authoritative game state update. |
| `onPlayerJoined(cb)` | `{ uid, displayName, avatarUrl }` | New player joined. |
| `onPlayerLeft(cb)` | `{ uid, reason }` | Player left or disconnected. |
| `onGameStarted(cb)` | `{ initialState }` | Game has begun. |
| `onGameFinished(cb)` | `{ results }` | Game over with per-player results. |
| `onMoveRejected(cb)` | `{ reason }` | Your move was invalid. |
| `onError(cb)` | `{ code, message }` | Error (e.g., `DISCONNECTED`). |

**Session Management (REST):**
| Method | Description |
|--------|-------------|
| `createSession(gameId, config)` | Create a new session. Config: `{ mode, maxPlayers, minPlayers, gameConfig, spectatorAllowed }` |
| `joinSession(sessionId)` | Join an existing session. |
| `joinByCode(code)` | Join by 6-character invite code. |
| `leaveSession(sessionId)` | Leave and disconnect. |
| `startGame(sessionId)` | Start the game (host only). |
| `getSession(sessionId)` | Get current session details. |
| `getActiveSessions()` | Get all your active sessions. |

**Matchmaking (REST):**
| Method | Description |
|--------|-------------|
| `findMatch(gameId)` | Enter matchmaking queue. Returns `{ queueEntryId, matchedSessionId? }`. |
| `cancelMatchmaking()` | Leave the queue. |
| `getMatchmakingStatus()` | Check if matched. Returns `{ status, sessionId? }`. |

**Invitations (REST):**
| Method | Description |
|--------|-------------|
| `inviteFriend(sessionId, friendUid)` | Send game invite to a friend. |
| `getInvitations()` | Get pending received invitations. |
| `respondToInvitation(invitationId, accept)` | Accept (`true`) or decline (`false`). |

### `window.multiplayerUI`

| Method | Description |
|--------|-------------|
| `createLobbyUI(containerId, options)` | Render lobby in a container. Options: `{ sessionId, isHost, joinCode, gameName, onStart, onLeave, onInvite }`. Returns `{ updatePlayers(players), destroy() }`. |
| `showMatchmaking(gameName, onCancel)` | Show "Finding opponent..." overlay. |
| `hideMatchmaking()` | Hide matchmaking overlay. |
| `showInvitationToast(invitation, onAccept, onDecline)` | Show invitation notification. |
| `showResults(results, { onPlayAgain, onClose })` | Show game results overlay. |
| `showDisconnectOverlay()` | Show "Reconnecting..." overlay. |
| `hideDisconnectOverlay()` | Hide disconnect overlay. |

---

## GameLogic Interface Reference

```typescript
interface MultiplayerGameLogic {
  readonly gameId: string;

  createInitialState(players: string[], config: Record<string, unknown>): Record<string, unknown>;

  applyMove(
    state: Record<string, unknown>,
    uid: string,
    moveType: string,
    moveData: Record<string, unknown>,
  ): Record<string, unknown>;

  checkGameOver(state: Record<string, unknown>): GameResult | null;

  getNextTurn(state: Record<string, unknown>): string | null;

  suspicionScore?(moves: GameMove[]): number; // Optional anti-cheat
}

interface GameResult {
  players: Record<string, { score: number; rank: number; outcome: 'win' | 'loss' | 'draw' }>;
  reason: 'completed' | 'forfeit' | 'timeout' | 'disconnect';
}
```

**Rules for `applyMove()`:**
1. **Throw on invalid moves** — the gateway catches the error and sends `game:move-rejected` to the client
2. **Return a new state object** — don't mutate the input
3. **Keep it fast** — this runs on every move in-memory. Target <10ms.
4. **Validate everything server-side** — never trust the client. Check turn order, move legality, bounds, etc.
5. **State is opaque to the infra** — your state object can have any shape. The multiplayer infra stores and broadcasts it without inspecting it.

---

## Real-Time Games (Non-Turn-Based)

For real-time games where all players act simultaneously:

**Server-side changes:**
- `getNextTurn()` returns `null`
- `applyMove()` does NOT check turn order — validates move legality only
- Multiple players can submit moves concurrently

**Client-side changes:**
Use `predictMove()` for instant feedback:

```javascript
function onPlayerAction(action) {
  // Apply locally for instant visual feedback
  const predicted = window.multiplayerClient.predictMove(
    action.type,
    action.data,
    (currentState, moveData) => {
      // Return what you THINK the new state will look like
      return applyMoveLocally(currentState, moveData);
    },
  );
  renderGame(predicted); // Instant update

  // When the server's authoritative state arrives via game:state,
  // it overwrites the prediction. If prediction was wrong, UI snaps.
}
```

---

## Session Config Options

When calling `createSession()`:

```javascript
{
  mode: 'private',        // 'private' (join code) or 'quick-match'
  maxPlayers: 4,          // 2-20
  minPlayers: 2,          // Minimum to start (default 2)
  spectatorAllowed: true, // Allow spectators to watch
  gameConfig: {           // Passed to your GameLogic.createInitialState()
    boardSize: 8,
    difficulty: 'hard',
    timeLimit: 300,
    // ...any game-specific settings
  },
}
```

---

## Configurable Defaults

All defaults are in `apps/api/src/multiplayer/config/multiplayer-defaults.ts`:

| Constant | Value | Description |
|----------|-------|-------------|
| `LOBBY_IDLE_TIMEOUT_MS` | 5 min | Auto-abandon idle lobbies |
| `TURN_TIMEOUT_SEC` | 30s | Auto-skip turn (override per game via `MultiplayerConfig.turnTimeoutSec`) |
| `SESSION_MAX_DURATION_MIN` | 30 min | Force-end long games |
| `RECONNECT_WINDOW_MS` | 2 min | Time to reconnect before removal |
| `DEFAULT_RATING` | 1000 | Starting ELO |
| `ELO_K_FACTOR` | 32 | Rating sensitivity |
| `MAX_CONCURRENT_SESSIONS` | 3 | Per-user limit |
| `MAX_PENDING_INVITATIONS` | 10 | Per-user outbound limit |
| `INVITATION_TTL_MIN` | 5 min | Invitation expiry |

---

## File Checklist

When adding a new multiplayer game, you need to create/modify these files:

### Create
- [ ] `apps/realtime/src/game/game-logic/{game-id}.logic.ts` — Server-side game logic
- [ ] `apps/web-astro/src/data/games/{game-id}.json` — Game metadata
- [ ] `apps/web-astro/src/pages/games/{game-id}.astro` — Astro page with MP script tags
- [ ] `apps/web-astro/public/games/{game-id}/game.js` — Frontend game logic + MP integration

### Modify
- [ ] `apps/realtime/src/game/game.module.ts` — Register game logic in `onModuleInit()`
- [ ] `packages/shared/src/lib/constants/game-registry.ts` — Add game with `multiplayer` config
- [ ] `apps/web-astro/public/sw.js` — Bump `CACHE_VERSION`
- [ ] `apps/api/src/leaderboard/config/game-config.ts` — (Optional) Score validation

---

## Testing Locally

1. **Start the API:** `npx nx run api:serve`
2. **Start the Realtime service:** `npx nx run realtime:serve`
3. **Start the Astro frontend:** `npx nx run web-astro:dev`
4. **Open two browser tabs** to your game page
5. **Tab 1:** Create a private session, copy the join code
6. **Tab 2:** Join with the code
7. **Tab 1:** Start the game
8. **Both tabs:** Play moves and verify state syncs

For WebSocket debugging, open browser DevTools → Network → WS tab to inspect Socket.IO frames.

---

## Known Issues & Solutions (Lessons from Chess 3D)

These issues were discovered during the Chess 3D multiplayer integration. New games should follow these patterns to avoid them.

### 1. API Client Signature Mismatch

**Problem:** `multiplayer-client.js` called `apiClient.request('POST', '/path', body)` but `apiClient.request` expects `request(endpoint, options)`. Resulted in `Cannot GET /apiPOST`.

**Fix:** Always use `request('/path', { method: 'POST', body: JSON.stringify(data) })`.

### 2. Firestore Composite Indexes

**Problem:** All compound Firestore queries need composite indexes deployed to the **production** project. The dev Firebase project and production project may differ.

**Fix:** Add indexes to `firestore.indexes.json` and deploy with:
```bash
firebase deploy --only firestore:indexes --project=loyal-curve-425715-h6
```

**Required indexes for multiplayer:**
- `matchmakingQueue`: uid + status
- `matchmakingQueue`: uid + joinedAt (desc)
- `matchmakingQueue`: gameId + status + ratingWindowMin
- `invitations`: toUid + status + createdAt (desc)
- `invitations`: fromUid + toUid + sessionId + status
- `invitations`: fromUid + status
- `sessions`: joinCode + status

### 3. Session Expiry on Serverless

**Problem:** `@Cron` decorators don't run when Cloud Run scales to zero. Stale sessions pile up, blocking users from creating new ones (MAX_CONCURRENT_SESSIONS = 3).

**Fix:** Lazy cleanup in `getActiveSessionsForUser()` — checks `lastActivityAt` on every session query and marks stale ones as abandoned inline. Don't rely solely on cron for cleanup.

### 4. Matchmaking Cron Doesn't Re-Match

**Problem:** The matchmaking cron only widened rating windows but never re-attempted matching. Two players in the queue would never be matched by the cron.

**Fix:** After widening windows, call `tryMatchPlayer()` for each waiting entry.

### 5. Game Start Flow

**Problem:** API's `/start` endpoint only updates Firestore status. The Realtime server never called `createInitialState()` or broadcast `game:state`. Games showed "started" in API but the board never appeared.

**Fix:** `tryStartGame()` in the gateway checks if all players are connected + ready, then calls `stateManager.initializeGame()` and broadcasts `game:state`. Called on both `game:ready` and `handleConnection` (auto-ready on connect).

### 6. Babylon.js Captures Pointer Events Over Overlays

**Problem:** Babylon's `ArcRotateCamera.attachControl()` captures all pointer events at the document level. Lobby buttons and overlays on top of the canvas were unclickable.

**Fix:** `showOverlay()` calls `camera.detachControl()`. `hideOverlay()` calls `camera.attachControl()` only when no overlays remain open.

### 7. WebSocket Pre-Warming for Cold Starts

**Problem:** Render free tier idles after 30s. First WebSocket connection takes 30-60s (cold start). Users see "Connection Lost" while waiting.

**Fix:** `multiplayer-client.js` auto-connects a lightweight warm-up socket on page load. Sends pings every 25s to keep the server alive. Warm socket is torn down before real game connection.

### 8. Disconnect Overlay Never Hides

**Problem:** `multiplayerUI.showDisconnectOverlay()` was shown on disconnect but never hidden on reconnect.

**Fix:** Added `'reconnected'` event to multiplayer-client. Socket.IO's `connect` event fires on reconnect — detect it and emit `'reconnected'`. Game listens and hides the overlay.

### 9. Deep Link Join

**Problem:** Share links (`?join=CODE`) opened the game on the title screen instead of auto-joining.

**Fix:** `initGame()` checks `URLSearchParams` for `?join=CODE` or `?session=ID`. Waits for auth, then auto-joins. Cleans URL after joining.

### 10. iOS Safe Areas

**Problem:** HUD elements (player bars, buttons) were hidden behind the notch on iOS.

**Fix:** Use `env(safe-area-inset-*, 0px)` CSS variables on all edge-positioned elements. `viewport-fit=cover` is set in BaseLayout.

### 11. Session Limit UX

**Problem:** 409 "Maximum 3 concurrent sessions" with no indication of when a slot would free up.

**Fix:** On 409, fetch active sessions, find earliest expiry, show live countdown timer: "Expires in 2m 34s". When it hits 0, show "Ready now! Try again." in green.
