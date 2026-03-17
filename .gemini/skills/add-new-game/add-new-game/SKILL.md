---
name: add-new-game
description: >
  Use this skill whenever you need to add a new game to the Weekly Arcade project.
  Triggers include: "add this game to the project", "integrate this game", "implement
  this PRD", "add new game this week", "register the game", "update landing page for
  new game", "add to leaderboard". This skill handles ALL integration steps: creating
  the game HTML file, updating the landing page (card + hero badge + JSON-LD + SEO),
  registering in the leaderboard, updating the sitemap, and ensuring score submission,
  sounds, animations, and achievements use the correct project patterns.
  Always use this skill before writing any game code.
---

# Add New Game to Weekly Arcade

This skill handles the full integration of a new game into the Weekly Arcade NX monorepo.
It covers every file that must change, the exact patterns to follow, and the order to do it.

**Always read this entire skill before touching any file.**

---

## Project Structure

```
apps/web/src/
  index.html                   ← Landing page (6 changes needed)
  sitemap.xml                  ← SEO sitemap (1 entry to add)
  leaderboard/index.html       ← Leaderboard page GAMES array (1 entry)
  games/
    <game-slug>/
      index.html               ← The entire game (create this)
  js/
    api-client.js              ← Shared API client (DO NOT MODIFY)
    auth.js                    ← Auth manager (DO NOT MODIFY)
packages/shared/src/
  lib/types/leaderboard.types.ts   ← SubmitScoreDto shape
  lib/constants/scoring.ts         ← SCORING constants, helpers
```

---

## Phase 1: Extract from PRD

Before touching any file, extract these values from the PRD:

```
GAME_NAME        e.g. "Fieldstone"
GAME_SLUG        kebab-case, used as gameId in API calls  e.g. "fieldstone"
GAME_EMOJI       e.g. "🏰"
GAME_DESC        one-line card description  e.g. "Drop tiles, harvest rows, build a kingdom!"
GAME_TAGS        2–3 tag strings  e.g. ["Strategy", "Roguelite", "Puzzle"]
GAME_GENRE       for JSON-LD  e.g. ["Strategy", "Puzzle", "Roguelite"]
GAME_THEME_COLOR hex  e.g. "#2d5016"
GAME_KEYWORDS    SEO comma-separated keywords
GAME_OG_DESC     ≤150 char Open Graph description
GAME_STORAGE_KEY localStorage key  e.g. "fieldstone-player"

Score payload fields from PRD Scoring section:
  SCORE_FIELDS   which of: score (always), level, timeMs, guessCount, metadata{}

Achievements from PRD (5–10 is ideal):
  e.g. { id: 'first_run', name: 'First Run', desc: '...', icon: '🎯', xp: 100 }
```

---

## Phase 2: Create the game file

**Path:** `apps/web/src/games/<GAME_SLUG>/index.html`

Single self-contained HTML file. Follow all sections below exactly.

---

### 2.1 Head — SEO, OG, structured data

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GAME_NAME | Weekly Arcade - SHORT_TAGLINE</title>
  <meta name="description" content="FULL_DESCRIPTION. No download required.">
  <meta name="keywords" content="GAME_KEYWORDS, browser game, free game, no download">
  <link rel="canonical" href="https://weekly-arcade.web.app/games/GAME_SLUG/">
  <meta property="og:title" content="GAME_NAME | Weekly Arcade">
  <meta property="og:description" content="GAME_OG_DESC">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://weekly-arcade.web.app/games/GAME_SLUG/">
  <meta property="og:image" content="https://weekly-arcade.web.app/og-image.png">
  <meta property="og:site_name" content="Weekly Arcade">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="GAME_NAME | Weekly Arcade">
  <meta name="twitter:description" content="GAME_OG_DESC">
  <meta name="twitter:image" content="https://weekly-arcade.web.app/og-image.png">
  <meta name="theme-color" content="GAME_THEME_COLOR">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    "name": "GAME_NAME",
    "url": "https://weekly-arcade.web.app/games/GAME_SLUG/",
    "description": "FULL_DESCRIPTION",
    "genre": GAME_GENRE_ARRAY,
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

---

### 2.2 Required CSS — Achievements, Toast, Confetti, Level-Up, Shake

Copy this block into the game's `<style>` section. These are the exact patterns
used by wordle and chaos-kitchen. Customise colours to match the game's theme.

```css
/* ── Achievement Toast ── */
.achievement-toast {
  position: fixed; top: 20px; right: -320px;
  background: linear-gradient(135deg, #b59f3b, #8b7a2e);
  padding: 1rem 1.5rem; border-radius: 12px;
  display: flex; align-items: center; gap: 1rem;
  z-index: 2000; box-shadow: 0 4px 20px rgba(0,0,0,0.4);
  transition: right 0.35s ease; max-width: 300px;
}
.achievement-toast.show { right: 20px; }
.achievement-icon { font-size: 2rem; }
.achievement-info { color: #fff; }
.achievement-name { font-weight: 700; font-size: 1rem; }
.achievement-desc { font-size: 0.8rem; opacity: 0.9; }

/* ── Confetti ── */
.confetti-container {
  position: fixed; inset: 0;
  pointer-events: none; z-index: 1500; overflow: hidden;
}
.confetti {
  position: absolute; width: 10px; height: 10px; top: -10px;
  animation: confettiFall 3s ease-out forwards;
}
@keyframes confettiFall {
  0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
}

/* ── Level-Up Burst ── */
.levelup-container {
  position: fixed; inset: 0; pointer-events: none;
  z-index: 1600; display: flex; align-items: center; justify-content: center;
}
.levelup-particle {
  position: absolute; width: 8px; height: 8px; border-radius: 50%;
  animation: levelupBurst 1s ease-out var(--delay, 0s) forwards;
}
@keyframes levelupBurst {
  0%   { transform: rotate(var(--angle,0deg)) translateX(0); opacity: 1; }
  100% { transform: rotate(var(--angle,0deg)) translateX(150px); opacity: 0; }
}

/* ── Score Pop ── */
.score-pop {
  position: fixed; pointer-events: none; z-index: 1400;
  font-size: 1.4rem; font-weight: 900; color: #ffd700;
  text-shadow: 0 2px 8px rgba(0,0,0,0.6);
  animation: scorePop 1.2s ease-out forwards;
}
@keyframes scorePop {
  0%   { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(-80px); opacity: 0; }
}

/* ── Shake ── */
.shake { animation: shake 0.5s; }
@keyframes shake {
  0%,100% { transform: translateX(0); }
  20%,60% { transform: translateX(-6px); }
  40%,80% { transform: translateX(6px); }
}

/* ── Pulse (streak badge etc.) ── */
.pulse { animation: pulse 0.4s ease-out; }
@keyframes pulse {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.25); }
  100% { transform: scale(1); }
}
```

---

### 2.3 Sound System — Web Audio API (no external files)

Copy this block verbatim. It uses the same oscillator approach as chaos-kitchen.
Add or remove cases as needed for the game. Keep `try/catch` — audio can fail silently.

```javascript
// ── SOUND ──────────────────────────────────────────────────
function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.08;

    switch (type) {
      case 'move':
        osc.frequency.value = 440;
        osc.start(); osc.stop(ctx.currentTime + 0.05);
        break;
      case 'place':
        osc.frequency.value = 520;
        osc.start(); osc.stop(ctx.currentTime + 0.08);
        break;
      case 'score':
        osc.frequency.value = 660;
        osc.start();
        setTimeout(() => osc.frequency.value = 880, 60);
        osc.stop(ctx.currentTime + 0.18);
        break;
      case 'levelup':
        osc.type = 'triangle';
        osc.frequency.value = 523;
        osc.start();
        setTimeout(() => osc.frequency.value = 659, 80);
        setTimeout(() => osc.frequency.value = 784, 160);
        osc.stop(ctx.currentTime + 0.5);
        break;
      case 'achievement':
        osc.type = 'sine';
        osc.frequency.value = 880;
        osc.start();
        setTimeout(() => osc.frequency.value = 1100, 100);
        osc.stop(ctx.currentTime + 0.35);
        break;
      case 'fail':
        osc.type = 'sawtooth';
        osc.frequency.value = 200;
        osc.start(); osc.stop(ctx.currentTime + 0.3);
        break;
      case 'win':
        osc.type = 'sine';
        osc.frequency.value = 523;
        osc.start();
        setTimeout(() => osc.frequency.value = 784, 100);
        setTimeout(() => osc.frequency.value = 1047, 220);
        osc.stop(ctx.currentTime + 0.6);
        break;
    }
  } catch (e) { /* audio unavailable */ }
}
```

**When to call each sound:**
- `move` — any cursor/selection movement
- `place` — placing/confirming an item
- `score` — points awarded (combine with score pop animation)
- `levelup` — XP level up
- `achievement` — achievement unlocked
- `fail` — wrong move, death, game over
- `win` — run complete / round won

Add game-specific cases (e.g. `'harvest'`, `'attack'`) following the same pattern.

---

### 2.4 Achievement System

Define achievements from the PRD. Use this exact shape — it matches the
`ACHIEVEMENTS` object pattern from wordle that `showAchievementToast` expects.

```javascript
// ── ACHIEVEMENTS ───────────────────────────────────────────
// Shape must be: { name, desc, icon, xp }
// IDs are kebab-case strings stored in localStorage
const ACHIEVEMENTS = {
  'first_game':    { name: 'First Steps',   desc: 'Complete your first game',    icon: '🎯', xp: 100 },
  'no_damage':     { name: 'Untouchable',   desc: 'Win without taking damage',   icon: '🛡️', xp: 300 },
  'speed_run':     { name: 'Speed Demon',   desc: 'Complete in under 3 minutes', icon: '⚡', xp: 300 },
  'high_score':    { name: 'Top Scorer',    desc: 'Score over 10,000 points',    icon: '🌟', xp: 500 },
  'streak_3':      { name: 'On a Roll',     desc: '3 wins in a row',             icon: '🔥', xp: 200 },
  'max_level':     { name: 'Grand Master',  desc: 'Reach max level',             icon: '👑', xp: 1000 },
  // Add game-specific achievements from the PRD here
};

// Returns array of newly unlocked achievement IDs
function checkAchievements(gameData) {
  const playerData = JSON.parse(
    localStorage.getItem('GAME_STORAGE_KEY') ||
    '{"xp":0,"level":1,"achievements":[]}'
  );
  const newOnes = [];

  // Always check first_game
  if (!playerData.achievements.includes('first_game')) {
    newOnes.push('first_game');
  }

  // Add game-specific checks using gameData fields:
  // if (gameData.won && gameData.score > 10000 && !playerData.achievements.includes('high_score'))
  //   newOnes.push('high_score');

  if (newOnes.length > 0) {
    let bonusXP = 0;
    newOnes.forEach(id => bonusXP += ACHIEVEMENTS[id]?.xp ?? 0);
    playerData.achievements = [...playerData.achievements, ...newOnes];
    playerData.xp += bonusXP;
    localStorage.setItem('GAME_STORAGE_KEY', JSON.stringify(playerData));
  }
  return newOnes;
}
```

---

### 2.5 Visual Feedback Functions

Copy these verbatim. They are the exact implementations from wordle.

```javascript
// ── VISUAL FEEDBACK ────────────────────────────────────────
let activeToasts = 0;

function showAchievementToast(achievement) {
  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.innerHTML = `
    <span class="achievement-icon">${achievement.icon}</span>
    <div class="achievement-info">
      <div class="achievement-name">${achievement.name}</div>
      <div class="achievement-desc">${achievement.desc}</div>
    </div>`;
  toast.style.top = (20 + activeToasts * 90) + 'px';
  activeToasts++;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    activeToasts = Math.max(0, activeToasts - 1);
    setTimeout(() => toast.remove(), 350);
  }, 3500);
}

function showConfetti() {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);
  const colors = ['#538d4e','#b59f3b','#e94560','#6b5b95','#ffd700','#60a5fa'];
  for (let i = 0; i < 80; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.cssText = `
      left:${Math.random()*100}%;
      background:${colors[i % colors.length]};
      animation-delay:${Math.random()*2}s;
      animation-duration:${2 + Math.random()*2}s;
      border-radius:${Math.random() > 0.5 ? '50%' : '0'};
    `;
    container.appendChild(el);
  }
  setTimeout(() => container.remove(), 5000);
}

function showScorePop(points, x, y) {
  const el = document.createElement('div');
  el.className = 'score-pop';
  el.textContent = `+${points}`;
  el.style.cssText = `left:${x}px; top:${y}px;`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

function showLevelUpEffect() {
  const container = document.createElement('div');
  container.className = 'levelup-container';
  document.body.appendChild(container);
  const colors = ['#ffd700','#ff6b35','#4ade80','#60a5fa','#f472b6'];
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'levelup-particle';
    p.style.cssText = `
      --angle:${(i / 40) * 360}deg;
      --delay:${(i % 5) * 0.05}s;
      background:${colors[i % colors.length]};
    `;
    container.appendChild(p);
  }
  setTimeout(() => container.remove(), 1500);
}

// Call after checking achievements — staggers toasts so they don't stack instantly
function showNewAchievements(newIds) {
  newIds.forEach((id, i) => {
    const ach = ACHIEVEMENTS[id];
    if (ach) setTimeout(() => {
      showAchievementToast(ach);
      playSound('achievement');
    }, i * 900);
  });
}
```

---

### 2.6 XP & Level Progression

```javascript
// ── XP & LEVELS ────────────────────────────────────────────
const XP_PER_LEVEL = 500; // matches packages/shared SCORING.XP_PER_LEVEL

function addXP(amount) {
  const data = JSON.parse(
    localStorage.getItem('GAME_STORAGE_KEY') ||
    '{"xp":0,"level":1,"achievements":[]}'
  );
  const prevLevel = Math.floor(data.xp / XP_PER_LEVEL) + 1;
  data.xp += amount;
  const newLevel = Math.floor(data.xp / XP_PER_LEVEL) + 1;
  localStorage.setItem('GAME_STORAGE_KEY', JSON.stringify(data));

  if (newLevel > prevLevel) {
    showAchievementToast({ name: `Level ${newLevel}!`, icon: '⬆️', desc: 'Player level up!' });
    showLevelUpEffect();
    playSound('levelup');
  }
  return { xp: data.xp, playerLevel: newLevel, leveledUp: newLevel > prevLevel };
}
```

---

### 2.7 Score submission — exact API pattern

```javascript
// ── SCORE SUBMISSION ───────────────────────────────────────
async function submitScoreToCloud(scoreValue, extras = {}) {
  if (!currentUser || !window.apiClient) return;
  try {
    const result = await window.apiClient.submitScore('GAME_SLUG', {
      score: scoreValue,
      // include only fields relevant to this game (see SubmitScoreDto):
      // level: currentLevel,
      // timeMs: elapsedMs,
      // guessCount: attempts,
      // metadata: { wave: 5, deck: 'merchant' },
      ...extras,
    });
    console.log('[GAME_NAME] Score submitted:', result);
  } catch (err) {
    console.error('[GAME_NAME] Score submit failed:', err);
  }
}
```

**gameId rule:** The string `'GAME_SLUG'` must exactly match the slug used in
the GAMES array and sitemap. One mismatch = scores go to a ghost leaderboard.

---

### 2.8 Auth integration

```javascript
// ── AUTH ───────────────────────────────────────────────────
let currentUser = null;

window.addEventListener('authStateChanged', (e) => {
  currentUser = e.detail?.user ?? null;
  // Update UI here: show username, enable leaderboard features, etc.
});
```

---

### 2.9 Game-over / round-end sequence

Call these functions in the correct order when a session ends:

```javascript
function onGameEnd(won, scoreValue, extras = {}) {
  // 1. Sound
  playSound(won ? 'win' : 'fail');

  // 2. Confetti on win
  if (won) showConfetti();

  // 3. Check achievements — returns new IDs
  const newAchievements = checkAchievements({
    won,
    score: scoreValue,
    // pass whatever fields your checkAchievements uses
  });

  // 4. Add XP
  const xpEarned = won ? Math.round(scoreValue / 10) : 25;
  addXP(xpEarned);

  // 5. Show achievement toasts (staggered)
  showNewAchievements(newAchievements);

  // 6. Submit score to cloud
  submitScoreToCloud(scoreValue, extras);

  // 7. Show game-over UI (your own modal/overlay)
  showGameOverModal(won, scoreValue);
}
```

---

### 2.10 Required script includes (bottom of `<body>`, before `</body>`)

```html
  <script src="../../js/api-client.js"></script>
  <script src="../../js/auth.js"></script>
```

**Critical:** path is `../../js/` — two levels up from `games/<slug>/`. One level
up (`../js/`) will 404.

---

### 2.11 Required back link (anywhere in `<body>`)

```html
<a href="../../">← All Games</a>
```

---

## Phase 3: Update `apps/web/src/index.html` — 6 changes

### 3.1 Deploy date comment (line 1)
```html
<!-- Deploy: 2026-MM-DD -->   ← today's date
```

### 3.2 Hero badge
Find `<span class="badge">` inside `<section class="hero">`:
```html
<span class="badge">🎉 New Game This Week: PREVIOUS_GAME_NAME</span>
```
Replace with:
```html
<span class="badge">🎉 New Game This Week: GAME_NAME</span>
```

### 3.3 Strip NEW from all previous game cards
Find every `<span class="tag new">NEW</span>` in the `.games-grid` and delete it.
Use `expected_replacements` set to the count of currently-NEW games.

### 3.4 Add new game card at end of `.games-grid`
```html
      <!-- GAME_NAME — THIS WEEK -->
      <a href="/games/GAME_SLUG/" class="game-card">
        <div class="game-thumb">GAME_EMOJI</div>
        <div class="game-info">
          <div class="game-title">GAME_NAME</div>
          <div class="game-desc">GAME_DESC</div>
          <div class="game-tags">
            <span class="tag new">NEW</span>
            <span class="tag">TAG_1</span>
            <span class="tag">TAG_2</span>
          </div>
        </div>
      </a>
```

### 3.5 JSON-LD ItemList entry
Append before the closing `]` of the ItemList. Increment position by 1.
```json
      },
      {
        "@type": "ListItem",
        "position": NEXT_NUMBER,
        "item": {
          "@type": "VideoGame",
          "name": "GAME_NAME",
          "url": "https://weekly-arcade.web.app/games/GAME_SLUG/",
          "description": "GAME_DESC",
          "genre": GAME_GENRE_ARRAY,
          "playMode": "SinglePlayer",
          "applicationCategory": "Game",
          "operatingSystem": "Web Browser",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
        }
      }
```

### 3.6 Update homepage SEO meta
```html
<meta name="description" content="Play free browser games every week. No downloads.
Wordle, Snake, 2048, GAME_NAME and more. Sign in optional for leaderboards.">
<meta name="keywords" content="free browser games, GAME_SLUG, GAME_KEYWORDS,
wordle, snake game, arcade games, puzzle games">
```

---

## Phase 4: Update `apps/web/src/leaderboard/index.html`

Find the `GAMES` array (search for `{ id: 'wordle'`). Add entry at the end:

```javascript
      { id: 'GAME_SLUG', name: 'GAME_NAME', icon: 'GAME_EMOJI', description: 'SHORT_2_4_WORD_DESC' }
```

---

## Phase 5: Update `apps/web/src/sitemap.xml`

Add after the last `<url>` game block:

```xml
  <url>
    <loc>https://weekly-arcade.web.app/games/GAME_SLUG/</loc>
    <lastmod>TODAY_DATE</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
```

Bump all other game entries from `0.9` → `0.8` if any currently sit at `0.9`.

---

## Execution Order

1. Extract all `GAME_*` variables from the PRD
2. Create `apps/web/src/games/GAME_SLUG/index.html` (full game)
3. Edit `apps/web/src/index.html` — all 6 changes
4. Edit `apps/web/src/leaderboard/index.html` — GAMES array
5. Edit `apps/web/src/sitemap.xml` — URL entry

---

## Quality Checklist

- [ ] Game file at correct path `games/<GAME_SLUG>/index.html`
- [ ] `../../js/api-client.js` and `../../js/auth.js` included (two levels up)
- [ ] `submitScoreToCloud` calls `window.apiClient.submitScore('GAME_SLUG', {...})`
- [ ] gameId in submit exactly matches GAME_SLUG (no typos, right case)
- [ ] `ACHIEVEMENTS` object defined with `{ name, desc, icon, xp }` shape
- [ ] `checkAchievements()` called in `onGameEnd()`
- [ ] `showNewAchievements()` called after `checkAchievements()`
- [ ] `playSound()` called for all key game events (move, score, win, fail)
- [ ] `showConfetti()` called on win
- [ ] `showScorePop()` called when points are awarded during gameplay
- [ ] `addXP()` called in `onGameEnd()`
- [ ] `authStateChanged` listener sets `currentUser`
- [ ] "← All Games" back link present
- [ ] Hero badge updated to GAME_NAME
- [ ] NEW tag removed from all previous game cards
- [ ] New game card has `<span class="tag new">NEW</span>`
- [ ] JSON-LD ItemList updated with correct position number
- [ ] Homepage meta description and keywords mention GAME_NAME
- [ ] Leaderboard GAMES array has new entry
- [ ] Sitemap has new `<url>` entry with `priority 0.9`
- [ ] Deploy date comment updated

---

## Common Mistakes

**Wrong gameId** — The string in `submitScore('GAME_SLUG', ...)` must match the leaderboard
GAMES array `id` exactly. Any mismatch sends scores to a ghost board.

**Wrong script path** — From `games/<slug>/index.html` use `../../js/`. Using `../js/`
causes a 404 and the entire auth + score system silently stops working.

**Missing auth.js** — Without `auth.js`, `authStateChanged` never fires, `currentUser`
stays null, and all score submissions silently skip.

**Hero badge not updated** — Players discover new games through the hero section.
Always update `🎉 New Game This Week: GAME_NAME`.

**NEW tag left on old games** — Only the current week's game gets the `new` CSS class.
Strip it from every previous card when adding the new one.

**Achievement toast queue** — `activeToasts` tracks vertical stacking. It is a module-level
`let` variable, not scoped inside a function. Declare it at the top of the script block.

**Audio on mobile** — Web Audio API requires a user gesture to start. Never call
`playSound()` on page load. Only call it inside event handlers (click, keydown, touch).
