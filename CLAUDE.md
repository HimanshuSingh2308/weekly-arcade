<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

# Weekly Arcade Project Guidelines

## Project Structure

- `apps/web/` - Frontend (vanilla JS, served via Firebase Hosting)
- `apps/api/` - Backend (NestJS on Cloud Run)
- `packages/shared/` - Shared types and constants

## API Client Usage

The frontend uses `window.apiClient` (from `/js/api-client.js`) for all backend communication.

### Authentication Required

All write operations require the user to be signed in. Always check auth state before API calls:

```javascript
// Add auth state tracking to your game
let currentUser = null;

// Initialize auth when ready
const authCheckInterval = setInterval(() => {
  if (window.authManager?.isInitialized) {
    clearInterval(authCheckInterval);
    window.authManager.onAuthStateChanged(user => {
      currentUser = user;
    });
  }
}, 100);

// Check before submitting
if (!currentUser || !window.apiClient) {
  console.log('User not signed in');
  return;
}
```

### Score Submission (Leaderboard)

**IMPORTANT:** The API validates score submissions strictly. Only these fields are allowed:

```javascript
await window.apiClient.submitScore('game-id', {
  score: number,           // REQUIRED - the score value
  guessCount?: number,     // Optional - number of attempts
  level?: number,          // Optional - current level
  timeMs?: number,         // Optional - time in milliseconds
  wordHash?: string,       // Optional - for word games validation
  metadata?: {             // Optional - ANY extra data goes here
    wave: number,
    deck: string,
    // ... any custom fields
  }
});
```

**Common Mistakes:**
- DO NOT add custom fields at the top level (e.g., `wave`, `deck`)
- ALL custom/game-specific data must go inside `metadata`
- Score must be a number, not an object

**Correct Example (Fieldstone):**
```javascript
await window.apiClient.submitScore('fieldstone', {
  score: gameState.score,
  metadata: {
    wave: gameState.wave,
    deck: gameState.selectedDeck
  }
});
```

**Correct Example (Wordle):**
```javascript
await window.apiClient.submitScore('wordle', {
  score: scoreData.score,
  level: wordLength - MIN_LENGTH + 1,
  guessCount: scoreData.attempts,
  timeMs: scoreData.timeMs || 0,
  metadata: {
    wordLength: wordLength,
    hardMode: hardMode
  }
});
```

### Other API Endpoints

```javascript
// Get leaderboard
await window.apiClient.getLeaderboard('game-id', 'daily'); // 'daily', 'weekly', 'monthly'

// Save game state
await window.apiClient.saveGameState('game-id', stateObject);

// Load game state
const state = await window.apiClient.getGameState('game-id');

// Unlock achievement
await window.apiClient.unlockAchievement('achievement-id', 'game-id', { metadata });
```

## Adding a New Game

### Files to Create
1. **Game file**: `apps/web/src/games/{game-slug}/index.html` — Complete self-contained game (HTML + inline CSS + inline JS)
2. **SVG thumbnail**: `apps/web/src/images/thumbnails/{game-slug}.svg` — Used on homepage game cards

### Files to Modify
3. **Homepage**: `apps/web/src/index.html`
   - Add game card to games grid (position 0 for newest game, with `<span class="tag new">NEW</span>`)
   - Add to hero badge: `🎮 New Game This Week: {Game Name}`
   - Add to ItemList structured data (schema.org)
   - Remove NEW tag from previous newest game
4. **Leaderboard**: `apps/web/src/leaderboard/index.html` — Add to GAMES array (position 0)
5. **Service worker**: `apps/web/src/sw.js` — Add game paths to ASSETS cache list, bump `CACHE_VERSION`
6. **Achievements**: `packages/shared/src/lib/constants/achievements.ts` — Register game achievements
7. **Achievement types**: `packages/shared/src/lib/types/achievement.types.ts` — Add `'{game-slug}'` to AchievementCategory union
8. **Server game config**: `apps/api/src/leaderboard/config/game-config.ts` — Add server-side score validation entry

### Game HTML Template Pattern
Each game file follows this structure:
- SEO meta tags (title, description, OG, Twitter, canonical)
- Structured data (VideoGame + BreadcrumbList JSON-LD)
- PWA tags (manifest, theme-color, apple-touch-icon)
- Inline CSS (all styles)
- Game UI (header, canvas, HUD, menus, game over screen)
- Inline JS (all game logic)

### Required Integrations
- **Auth**: `window.authManager.onAuthStateChanged(user => { ... })`
- **Score**: `window.apiClient.submitScore('{game-slug}', { score, level, timeMs, metadata: {...} })`
- **Achievements**: `window.apiClient.unlockAchievement('{achievement-id}', '{game-slug}')`
- **Cloud save**: `window.apiClient.saveGameState('{game-slug}', state)` / `getGameState('{game-slug}')`
- **localStorage**: Personal best at `{game-slug}-best`, settings at `{game-slug}-{setting}`

### Naming Conventions
- Game slug: kebab-case (`bir-glider`, `stack-tower`)
- Achievement IDs: `{slug-prefix}_{achievement_name}` (`bir_first_flight`, `bir_legend`)
- localStorage keys: `{game-slug}-{key}` (`bir-glider-best`, `bir-glider-muted`)

### DO NOT Modify
- `apps/web/src/js/api-client.js` — Shared API client
- `apps/web/src/js/auth.js` — Shared auth manager
- Other games' files

## Deployment

- Frontend: Auto-deploys to Firebase Hosting on push to main
- Backend: Auto-deploys to Cloud Run on push to main
