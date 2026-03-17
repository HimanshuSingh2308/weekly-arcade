---
name: add-new-game
description: >
  Use this skill whenever you need to add a new game to the Weekly Arcade project.
  Triggers include: "add this game to the project", "integrate this game", "implement
  this PRD", "add new game this week", "register the game", "update landing page for
  new game", "add to leaderboard". This skill handles ALL integration steps: creating
  the game HTML file, updating the landing page (card + hero badge + JSON-LD + SEO),
  registering in the leaderboard, updating the sitemap, and ensuring score submission
  uses the correct apiClient pattern. Always use this skill before writing any game
  code so the integration checklist is complete.
---

# Add New Game to Weekly Arcade

This skill handles the full integration of a new game into the Weekly Arcade NX monorepo.
It covers every file that must change, the exact patterns to follow, and the order to do it.

**Always read this skill before touching any file.**

---

## Project Structure (memorise this)

```
apps/web/src/
  index.html                  ← Landing page (5 changes needed)
  sitemap.xml                 ← SEO sitemap (1 entry to add)
  leaderboard/index.html      ← Leaderboard page (1 array entry)
  games/
    <game-slug>/
      index.html              ← The game itself (create this)
  js/
    api-client.js             ← Shared API client (do NOT modify)
    auth.js                   ← Auth (do NOT modify)
packages/shared/src/
  lib/types/leaderboard.types.ts   ← SubmitScoreDto, LeaderboardEntry
  lib/constants/scoring.ts         ← SCORING constants, calculateScore()
```

---

## Phase 1: Extract from PRD

Read the PRD and extract these values before touching any file:

```
GAME_NAME      = e.g. "Fieldstone"
GAME_SLUG      = kebab-case e.g. "fieldstone"  (URL path, gameId for API)
GAME_EMOJI     = e.g. "🏰"
GAME_DESC      = one-line description for the card e.g. "Drop tiles, harvest rows, build a kingdom!"
GAME_TAGS      = 2–3 tags e.g. ["Strategy", "Roguelite", "Puzzle"]
GAME_GENRE     = for JSON-LD schema e.g. ["Strategy", "Puzzle", "Roguelite"]
GAME_THEME_COLOR = hex color e.g. "#2d5016"
GAME_KEYWORDS  = SEO keywords string
GAME_OG_DESC   = Open Graph description (≤ 150 chars)
```

Score payload fields (from the PRD's Scoring section):
```
SCORE_FIELDS = which of these apply: score (required), level, timeMs, guessCount, metadata
```

---

## Phase 2: Create the game file

**Path:** `apps/web/src/games/<GAME_SLUG>/index.html`

This is a single self-contained HTML file. It must follow this exact structure:

### 2.1 Required HTML head

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GAME_NAME | Weekly Arcade - TAGLINE</title>
  <meta name="description" content="FULL_DESCRIPTION. No download required.">
  <meta name="keywords" content="GAME_KEYWORDS, browser game, free game, no download">
  <link rel="canonical" href="https://weekly-arcade.web.app/games/GAME_SLUG/">
  <meta property="og:title" content="GAME_NAME | Weekly Arcade">
  <meta property="og:description" content="OG_DESC">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://weekly-arcade.web.app/games/GAME_SLUG/">
  <meta property="og:image" content="https://weekly-arcade.web.app/og-image.png">
  <meta property="og:site_name" content="Weekly Arcade">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="GAME_NAME | Weekly Arcade">
  <meta name="twitter:description" content="OG_DESC">
  <meta name="twitter:image" content="https://weekly-arcade.web.app/og-image.png">
  <meta name="theme-color" content="GAME_THEME_COLOR">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    "name": "GAME_NAME",
    "url": "https://weekly-arcade.web.app/games/GAME_SLUG/",
    "description": "FULL_DESCRIPTION",
    "genre": GAME_GENRE_JSON_ARRAY,
    "playMode": "SinglePlayer",
    "applicationCategory": "Game",
    "operatingSystem": "Web Browser",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Weekly Arcade", "item": "https://weekly-arcade.web.app/" },
        { "@type": "ListItem", "position": 2, "name": "GAME_NAME", "item": "https://weekly-arcade.web.app/games/GAME_SLUG/" }
      ]
    }
  }
  </script>
</head>
```

### 2.2 Required script includes (bottom of body, before closing </body>)

```html
  <script src="../../js/api-client.js"></script>
  <script src="../../js/auth.js"></script>
```

### 2.3 Required score submission pattern

Every game MUST submit scores using this exact pattern. Copy it verbatim and
fill in GAME_SLUG and the relevant score fields from the PRD:

```javascript
async function submitScoreToCloud(scoreValue, additionalData = {}) {
  if (!currentUser || !window.apiClient) return;
  try {
    const scoreData = {
      score: scoreValue,
      // Include only fields relevant to this game (from SubmitScoreDto):
      // level: currentLevel,       // optional
      // timeMs: elapsedMs,         // optional
      // guessCount: attempts,      // optional
      // metadata: { wave, cards }  // optional, game-specific extras
      ...additionalData,
    };
    const result = await window.apiClient.submitScore('GAME_SLUG', scoreData);
    console.log('[GAME_NAME] Score submitted:', result);
  } catch (err) {
    console.error('[GAME_NAME] Score submit failed:', err);
  }
}
```

### 2.4 Required auth integration

```javascript
let currentUser = null;

// Listen for auth state (set by auth.js)
window.addEventListener('authStateChanged', (e) => {
  currentUser = e.detail.user;
  // Update UI if needed (show username, enable features)
});
```

### 2.5 Required "More Games" link (in game HTML body)

Every game must have a back link so players can return:

```html
<a href="../../" style="...">← All Games</a>
```

---

## Phase 3: Update `apps/web/src/index.html` — 5 changes

### 3.1 Update deploy date comment (line 1 of file)

Find:
```html
<!-- Deploy: YYYY-MM-DD -->
```
Replace with today's date:
```html
<!-- Deploy: 2026-03-17 -->
```

### 3.2 Update hero badge — "New Game This Week"

Find the `<span class="badge">` inside `<section class="hero">`:
```html
<span class="badge">🎉 New Game This Week: PREVIOUS_GAME</span>
```
Replace with:
```html
<span class="badge">🎉 New Game This Week: GAME_NAME</span>
```

### 3.3 Remove NEW tag from all previous games

Find every `<span class="tag new">NEW</span>` in the games grid and remove it.
Use `expected_replacements` to match how many games currently have the NEW tag.

### 3.4 Add the new game card (at the END of the games-grid div)

Place this block right before the closing `</div>` of `.games-grid`:

```html
      <!-- GAME_NAME — THIS WEEK'S GAME -->
      <a href="/games/GAME_SLUG/" class="game-card">
        <div class="game-thumb">GAME_EMOJI</div>
        <div class="game-info">
          <div class="game-title">GAME_NAME</div>
          <div class="game-desc">GAME_DESC</div>
          <div class="game-tags">
            <span class="tag new">NEW</span>
            TAG_SPANS
          </div>
        </div>
      </a>
```

Where TAG_SPANS = `<span class="tag">Tag1</span><span class="tag">Tag2</span>` etc.

### 3.5 Add JSON-LD entry to the ItemList

Find the closing of the last ListItem before `]` in the ItemList schema:
```json
      }
    ]
  }
```
Replace with (incrementing position by 1):
```json
      },
      {
        "@type": "ListItem",
        "position": NEXT_POSITION,
        "item": {
          "@type": "VideoGame",
          "name": "GAME_NAME",
          "url": "https://weekly-arcade.web.app/games/GAME_SLUG/",
          "description": "GAME_DESC",
          "genre": GAME_GENRE_JSON_ARRAY,
          "playMode": "SinglePlayer",
          "applicationCategory": "Game",
          "operatingSystem": "Web Browser",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
        }
      }
    ]
  }
```

To find NEXT_POSITION: count existing `"position":` entries in the ItemList and add 1.

---

## Phase 4: Update `apps/web/src/leaderboard/index.html`

Find the GAMES array (search for `{ id: 'wordle'`):

```javascript
      { id: 'LAST_GAME_ID', name: 'Last Game', icon: '...', description: '...' }
```

Add a new entry after the last one:

```javascript
      { id: 'LAST_GAME_ID', name: 'Last Game', icon: '...', description: '...' },
      { id: 'GAME_SLUG', name: 'GAME_NAME', icon: 'GAME_EMOJI', description: 'GAME_SHORT_DESC' }
```

`GAME_SHORT_DESC` = 2–4 word description (e.g. `'Tetris strategy roguelite'`)

---

## Phase 5: Update `apps/web/src/sitemap.xml`

Add a new `<url>` entry after the last game entry:

```xml
  <url>
    <loc>https://weekly-arcade.web.app/games/GAME_SLUG/</loc>
    <lastmod>TODAY_DATE</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
```

Priority `0.9` for the newest game (bump other game entries from 0.9 to 0.8 if any exist at 0.9).

---

## Phase 6: Update homepage SEO meta tags

In `apps/web/src/index.html`, update the homepage description and keywords to
mention the new game. Find the existing `<meta name="description">` and
`<meta name="keywords">` and add GAME_NAME naturally:

```html
<meta name="description" content="Play free browser games with new releases every week.
No downloads required. Wordle, Snake, 2048, GAME_NAME and more. Optional sign-in for leaderboards.">
<meta name="keywords" content="free browser games, online games, GAME_SLUG, GAME_KEYWORDS, wordle, snake game, arcade games, puzzle games">
```

---

## Execution Order (always follow this)

1. Read and understand the PRD → extract all GAME_* variables
2. Create `apps/web/src/games/<GAME_SLUG>/index.html` (full game)
3. Edit `apps/web/src/index.html`:
   a. Update deploy date
   b. Update hero badge
   c. Remove NEW tags from old games
   d. Add new game card with NEW tag
   e. Add JSON-LD ItemList entry
   f. Update meta description + keywords
4. Edit `apps/web/src/leaderboard/index.html` → add to GAMES array
5. Edit `apps/web/src/sitemap.xml` → add URL entry

---

## Quality Checklist

Before finishing, verify:

- [ ] Game file exists at `apps/web/src/games/<GAME_SLUG>/index.html`
- [ ] Game file includes `../../js/api-client.js` and `../../js/auth.js`
- [ ] `submitScoreToCloud` calls `window.apiClient.submitScore('GAME_SLUG', {...})`
- [ ] gameId in submitScore exactly matches the GAME_SLUG (kebab-case)
- [ ] Hero badge updated to new game name
- [ ] NEW tag removed from all previous games
- [ ] New game card has `<span class="tag new">NEW</span>`
- [ ] JSON-LD ItemList has new entry with correct position number
- [ ] Homepage meta description and keywords updated
- [ ] Leaderboard GAMES array has new entry
- [ ] Sitemap has new `<url>` entry
- [ ] Deploy date updated in index.html comment
- [ ] Game has a "← All Games" back link

---

## Common Mistakes to Avoid

**Wrong gameId:** The string passed to `apiClient.submitScore('GAME_SLUG', ...)` must be
exactly the kebab-case slug used everywhere else. A mismatch means scores go to a
different leaderboard or fail silently.

**Forgetting the hero badge:** The `🎉 New Game This Week` badge in the hero section is
how players discover the new release. Always update it.

**Leaving NEW on old games:** Only the current week's game should have the `new` CSS class.
Strip it from all previous cards when adding the new one.

**Missing auth.js:** The auth.js script sets `currentUser` and dispatches `authStateChanged`.
Without it, `window.apiClient.setToken()` is never called and score submissions silently fail.

**Wrong path to shared scripts:** From `games/<slug>/index.html`, the correct relative
path is `../../js/api-client.js` (two levels up). One level up (`../js/`) will 404.
