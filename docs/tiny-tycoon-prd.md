# Tiny Tycoon - Product Requirements Document

## 1. Game Overview

| Field | Value |
|-------|-------|
| **Name** | Tiny Tycoon |
| **Slug** | `tiny-tycoon` |
| **Genre** | Idle / Time-Management Simulator |
| **Theme** | Cozy boba tea shop |
| **One-line pitch** | Run a boba tea shop in 60-second "days" -- tap to serve customers, earn coins, upgrade your shop, and chase the highest single-day revenue on the leaderboard. |
| **Platform** | Mobile-first browser game (touch + mouse) |
| **File** | `apps/web/src/games/tiny-tycoon/index.html` (single HTML file) |

---

## 2. Core Loop

```
                     +------------------+
                     |   TITLE SCREEN   |
                     |  "Start Day" btn |
                     +--------+---------+
                              |
                              v
                 +------------+------------+
                 |     DAY BEGINS (60s)    |
                 |  Customers arrive from  |
                 |  the right, queue up    |
                 +------------+------------+
                              |
               +--------------+--------------+
               |                             |
               v                             v
     +---------+---------+        +----------+---------+
     | Player taps a     |        | Customer patience  |
     | customer to serve |        | runs out -> leaves |
     | -> earns coins    |        | angry (penalty)    |
     +---------+---------+        +----------+---------+
               |                             |
               +-------------+---------------+
                             |
                             v
                  +----------+----------+
                  |   TIMER HITS 0:00   |
                  |   Day End Summary   |
                  +----------+----------+
                             |
                             v
                  +----------+----------+
                  |   UPGRADE SHOP      |
                  |   Spend coins on    |
                  |   improvements      |
                  +----------+----------+
                             |
                             v
                  +----------+----------+
                  |  "Start Next Day"   |
                  |  or view Leaderboard|
                  +---------------------+
                             |
                             v
                    (loop back to DAY)
```

**Step-by-step:**

1. Player presses "Start Day" from the title or upgrade screen.
2. A 60-second countdown timer begins. Customers spawn from the right edge and walk left to the counter queue.
3. Each customer has a visible drink order (emoji icon) and a patience bar above their head.
4. Player taps/clicks a customer at the counter to begin serving them.
5. A serving progress bar fills over the serving duration (based on order type and upgrades).
6. Once served, the customer drops coins (animated coin pop), and walks off-screen to the left.
7. If a customer's patience bar empties before being served, they leave angrily (walk back right) -- no coins earned, and a -5 coin penalty is applied to the day's revenue (floor at 0).
8. When the timer reaches 0, no new customers spawn. Any customer mid-serve completes. All others leave.
9. Day End Summary screen shows: coins earned, customers served, customers lost, best combo, and whether this was a new personal best.
10. Player enters the Upgrade Shop to spend cumulative coins (across all days) on permanent upgrades.
11. Player can start the next day or view the leaderboard.

---

## 3. Controls

| Input | Action |
|-------|--------|
| **Tap / Left-click** on a queued customer | Begin serving that customer (must be at the counter, i.e., first in queue) |
| **Tap / Left-click** on an auto-serve slot | Assign next customer to that auto-serve station (if unlocked) |
| **Tap / Left-click** buttons | Navigate menus, purchase upgrades, start day |
| **Long press / hover** on upgrade | Show tooltip with detailed description |

**Interaction rules:**
- Only the customer at the front of the queue (at the counter) can be tapped to serve manually.
- If a customer is already being served, tapping them again does nothing.
- If auto-serve stations are unlocked, they automatically pull from the queue -- no tap needed unless the player wants to manually prioritize.
- All interactions use a single tap/click. No drag, swipe, or multi-touch required.

---

## 4. Visual Design

### Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Cream Background | `#FFF8F0` | Main background |
| Warm Taupe | `#D4A574` | Counter, furniture, wood tones |
| Soft Pink | `#F2B5B5` | Accent highlights, buttons |
| Boba Brown | `#5C3D2E` | Dark accents, text, boba pearls |
| Matcha Green | `#7DB87D` | Success states, money, go |
| Taro Purple | `#9B7DB8` | Premium items, rare customers |
| Sky Blue | `#87CEEB` | Timer bar, patience bar background |
| Coral Red | `#E8736A` | Warnings, angry customers, low patience |
| Golden Coin | `#F5C542` | Coins, revenue, score |
| Off-White | `#FEFEFE` | Card backgrounds, modals |

### Art Style

- **Side-view** of the boba shop, like a cross-section dollhouse view.
- All elements are **CSS-drawn** -- no images or sprites.
- Characters are simple rounded rectangles with circular heads (think "blocky chibi").
- Customer body = 24x32px `div` with `border-radius: 6px`. Head = 20x20px circle on top.
- Different customer types get different body colors (CSS classes).
- Drink orders shown as emoji floating above customers: `🧋`, `🍵`, `☕`, `🥤`, `🍓`, `🫧`.
- Counter is a long horizontal rectangle at ~60% from top of game area.
- Background has a simple wall (top half, slightly darker cream) and floor (bottom half, warm wood tone `#C4A882`).
- Coins are small golden circles with a `$` or `🪙`.
- Patience bar: thin bar above each customer's head, starts green (`#7DB87D`), transitions to yellow (`#F5C542`) at 50%, red (`#E8736A`) at 25%.

### Layout (Mobile-First)

```
+----------------------------------+
| [<] Tiny Tycoon    [Day 5]  [?] |  <- Header (44px)
+----------------------------------+
| 💰 342 coins    ⏱ 0:47   🔥x3  |  <- HUD bar (36px)
+----------------------------------+
|                                  |
|   ~~~~ SHOP BACKGROUND ~~~~     |
|                                  |
|  [Auto-1]  [Auto-2]             |  <- Auto-serve stations (if unlocked)
|                                  |
|  ========= COUNTER =========    |
|                                  |
|  [Serve] <- C1  C2  C3  C4 ->   |  <- Customer queue
|                                  |
+----------------------------------+
```

- Game area fills remaining viewport height below header and HUD.
- Minimum supported width: 320px.
- Maximum game area width: 480px (centered on wider screens).
- All elements scale proportionally using `vw` / `vh` / `min()` units.

---

## 5. Scoring System

### Coins Per Customer

| Drink Type | Base Coins | Serve Time (ms) | Unlock |
|-----------|-----------|-----------------|--------|
| Basic Tea `🍵` | 5 | 800 | Default |
| Boba Milk Tea `🧋` | 10 | 1200 | Default |
| Iced Coffee `☕` | 8 | 1000 | Default |
| Fruit Smoothie `🥤` | 15 | 1500 | Round 3+ |
| Strawberry Special `🍓` | 20 | 2000 | Round 5+ |
| Sparkling Boba `🫧` | 30 | 2500 | Round 8+ |

### Combo System

Serving consecutive customers without any leaving angry builds a **combo streak**.

- Combo multiplier = `1.0 + (streak * 0.1)`, capped at `3.0x` (streak of 20).
- Each served customer's coins = `floor(baseCoinValue * comboMultiplier)`.
- If a customer leaves angry, the streak resets to 0.

### Speed Bonus

If a customer is served while their patience bar is above 75%, they leave a **tip**:
- Patience > 75%: `+2` bonus coins.
- Patience > 90%: `+5` bonus coins.

### Day Revenue Calculation

```
dayRevenue = SUM(each served customer's coins including combo and tip)
           - (angryCustomers * 5)
dayRevenue = max(dayRevenue, 0)  // Floor at zero
```

### Score for Leaderboard

```
leaderboardScore = allTimeBestDayRevenue
```

The score submitted is the single best `dayRevenue` across all rounds played in the current session (and across sessions via localStorage).

### Cumulative Wallet

```
wallet += dayRevenue  // After each day, revenue is added to the persistent wallet
```

The wallet is used for purchasing upgrades and persists via localStorage. The wallet is NOT the leaderboard score.

---

## 6. Difficulty Progression

### Customer Spawn Rate

| Day | Spawn Interval (ms) | Max Queue Length |
|-----|---------------------|------------------|
| 1 | 3000 | 4 |
| 2 | 2700 | 4 |
| 3 | 2400 | 5 |
| 4 | 2200 | 5 |
| 5 | 2000 | 6 |
| 6-7 | 1800 | 6 |
| 8-9 | 1600 | 7 |
| 10+ | 1400 | 8 |
| 15+ | 1200 | 8 |
| 20+ | 1000 | 8 |

Spawn interval has slight randomness: `interval * (0.8 + Math.random() * 0.4)`.

### Customer Patience

| Day | Base Patience (ms) |
|-----|--------------------|
| 1-2 | 12000 |
| 3-4 | 10000 |
| 5-6 | 8000 |
| 7-9 | 7000 |
| 10-14 | 6000 |
| 15-19 | 5000 |
| 20+ | 4000 |

Individual customer patience = `basePatience * (0.9 + Math.random() * 0.2)`.

### Order Complexity

- Days 1-2: Only Basic Tea and Boba Milk Tea.
- Days 3-4: Iced Coffee added to the pool.
- Days 5-7: Fruit Smoothie added.
- Days 8-9: Strawberry Special added.
- Day 10+: Sparkling Boba added.

Order selection uses weighted random:
- Cheaper drinks have higher weight in early rounds.
- By day 10+, distribution is roughly uniform across all unlocked types.

### Rush Events

Starting from Day 5, there is a 30% chance per day of a "Rush Hour" event:
- At a random point between 15s-45s into the day, spawn rate doubles for 10 seconds.
- A visual indicator ("RUSH HOUR!" banner) appears during the rush.

---

## 7. Game States

### State Machine

```
TITLE -> PLAYING -> DAY_END -> UPGRADE_SHOP -> PLAYING (loop)
                                            -> TITLE (quit)
PLAYING -> PAUSED -> PLAYING
                  -> TITLE (quit)
```

### States

| State | Description | Transitions |
|-------|-------------|-------------|
| `TITLE` | Title screen with logo, "Start Day" button, best score, settings icon. If returning player (localStorage), show "Continue" (goes to UPGRADE_SHOP) and "New Game" (resets all progress). | -> `PLAYING` (Start Day) or -> `UPGRADE_SHOP` (Continue) |
| `PLAYING` | Active gameplay. Timer counting down, customers spawning, player serving. | -> `PAUSED` (pause button / tab blur) -> `DAY_END` (timer reaches 0) |
| `PAUSED` | Overlay dims the screen. Shows "Resume", "Quit to Menu". Timer and all animations freeze. Auto-pauses on `visibilitychange` (tab blur). | -> `PLAYING` (Resume) -> `TITLE` (Quit) |
| `DAY_END` | Summary overlay: day revenue, customers served, customers lost, combo peak, new best indicator. "Continue" button. Score submitted to leaderboard if new personal best. | -> `UPGRADE_SHOP` (Continue) |
| `UPGRADE_SHOP` | Full-screen shop UI. Shows wallet balance, list of upgrades with costs/levels, "Start Next Day" button, "Leaderboard" link. | -> `PLAYING` (Start Next Day) -> `TITLE` (Back) |

### Transitions

- All state transitions use a 300ms CSS fade (`opacity` transition).
- `PLAYING` -> `DAY_END`: 1-second delay after timer hits 0 to let final animations play.
- `DAY_END` -> `UPGRADE_SHOP`: Button press, no auto-transition.

---

## 8. UI Layout

### Header Bar (44px fixed)

```
+--------------------------------------------------+
| [< Back]     Tiny Tycoon         [Day #]  [⚙/❓] |
+--------------------------------------------------+
```

- `[< Back]`: Link to `/` (Weekly Arcade home). Same style as other games: `background: var(--bg-card); border-radius: 8px;`.
- Title: centered, `font-size: 1.1rem`, `font-weight: 700`.
- Day counter: right side, shows current day number.
- Settings/help icon: gear or question mark, opens a small modal with instructions.

### HUD Bar (36px fixed, below header)

```
+--------------------------------------------------+
|  💰 1,342     ⏱ 0:47     🔥 x3 combo            |
+--------------------------------------------------+
```

- Coins earned this day (left).
- Timer countdown in `M:SS` format (center).
- Current combo streak multiplier (right). Pulses when multiplier increases.
- Background: semi-transparent dark overlay (`rgba(92, 61, 46, 0.85)`).
- Text: white, `font-size: 0.9rem`, monospace for timer.

### Game Area (remaining viewport)

Divided into vertical zones:

| Zone | Position | Content |
|------|----------|---------|
| Shop Background | Top 40% | Wall with shelves, menu board, decorative elements (all CSS) |
| Auto-Serve Stations | ~40-50% | 0-3 horizontal slots for auto-serve machines (when unlocked) |
| Counter | 50% line | Horizontal bar spanning 80% width, `background: #D4A574`, `height: 8px`, `border-radius: 4px` |
| Queue Area | Bottom 50% | Customers line up from left (counter) to right (entrance). Served customers exit left. |

### Customer Visual

```
     [patience bar]     <- 30x4px bar, color-coded
        (O)             <- 20x20px circle head
       [  ]             <- 24x32px rounded rect body
        ||              <- 2 small rects for legs
     🧋 (floating)      <- emoji order icon, offset above-right of head
```

- Tap target area: 48x64px (larger than visual, for mobile friendliness).
- Currently-being-served customer has a pulsing glow border.
- Angry customer turns red (`filter: hue-rotate`) and has a 😤 emoji replace their order icon.

### Day End Overlay

```
+-------------------------------+
|        ☀️ Day 5 Complete!      |
|                               |
|   Revenue:    💰 487          |
|   Served:     🧋 23           |
|   Lost:       😤 3            |
|   Best Combo: 🔥 x2.1        |
|                               |
|   ⭐ NEW PERSONAL BEST! ⭐    |  <- Only if new best
|                               |
|       [ Continue ]            |
+-------------------------------+
```

### Upgrade Shop Screen

```
+-------------------------------+
|   💰 Wallet: 2,340 coins      |
+-------------------------------+
|                               |
|  ☕ Speed Boost     Lv 3/10   |
|  Serve 15% faster             |
|  [Buy - 150 coins]            |
|                               |
|  🤖 Auto-Serve #1   Lv 0/1   |
|  Auto-serves basic drinks     |
|  [Buy - 500 coins]            |
|                               |
|  ... (scrollable list)        |
|                               |
+-------------------------------+
|  [Start Day 6]  [Leaderboard] |
+-------------------------------+
```

---

## 9. Sound Design

All sounds generated via **Web Audio API** at runtime. No audio files.

| Sound | Trigger | Description |
|-------|---------|-------------|
| `sfx_tap` | Player taps a customer to serve | Short click/pop: 800Hz sine, 50ms decay |
| `sfx_serve_complete` | Customer finishes being served | Upward arpeggio: 3 quick notes (C5, E5, G5), 40ms each, triangle wave |
| `sfx_coin` | Coins drop from served customer | Metallic ting: 2000Hz sine, fast attack, 150ms decay, slight vibrato |
| `sfx_combo_up` | Combo multiplier increases | Rising whoosh: white noise filtered through bandpass, sweep from 400Hz to 1200Hz over 200ms |
| `sfx_angry` | Customer leaves angry | Low buzzer: 150Hz sawtooth, 200ms, slight pitch drop |
| `sfx_rush_hour` | Rush hour event starts | Alert chime: two-tone (A4, E5), 100ms each, square wave |
| `sfx_day_start` | Day begins | Bell: 1000Hz sine with 500ms decay, slight reverb (delay node feedback) |
| `sfx_day_end` | Timer reaches zero | Descending three-note: (G4, E4, C4), 100ms each, triangle wave |
| `sfx_upgrade` | Player purchases an upgrade | Cash register "ka-ching": noise burst + 1500Hz sine ping, 200ms |
| `sfx_new_best` | New personal best achieved | Fanfare: ascending 5-note major scale (C5-G5), 80ms each, triangle wave, slight reverb |
| `bgm_loop` | During gameplay (optional, can be toggled) | Gentle lo-fi beat: kick (60Hz sine 50ms) + hihat (noise 20ms) in a simple 4-beat pattern at 90 BPM, very quiet (`gain: 0.08`) |

All sounds respect a master volume setting (stored in localStorage). Default: `0.5`. Mute toggle available.

---

## 10. Achievements

| ID | Name | Description | Unlock Condition | XP |
|----|------|-------------|------------------|-----|
| `tt_first_day` | Open for Business | Complete your first day | Finish day 1 | 10 |
| `tt_hundred_club` | Hundred Club | Earn 100+ coins in a single day | `dayRevenue >= 100` | 25 |
| `tt_five_hundred` | High Roller | Earn 500+ coins in a single day | `dayRevenue >= 500` | 50 |
| `tt_thousand` | Boba Billionaire | Earn 1,000+ coins in a single day | `dayRevenue >= 1000` | 100 |
| `tt_perfect_day` | Perfect Day | Complete a day with zero angry customers | `angryCustomers === 0 && customersServed >= 10` | 50 |
| `tt_combo_5` | Streak Starter | Reach a 5x combo streak | `comboStreak >= 5` | 25 |
| `tt_combo_15` | Combo King | Reach a 15x combo streak | `comboStreak >= 15` | 75 |
| `tt_speed_demon` | Speed Demon | Serve 30+ customers in a single day | `customersServed >= 30` | 50 |
| `tt_upgrade_first` | Investor | Purchase your first upgrade | Any upgrade purchased | 10 |
| `tt_max_upgrade` | Fully Loaded | Max out any single upgrade | Any upgrade reaches max level | 75 |
| `tt_day_10` | Veteran Barista | Reach Day 10 | `currentDay >= 10` | 50 |
| `tt_rush_survivor` | Rush Survivor | Serve every customer during a Rush Hour event without losing any | All rush-hour customers served, none angry | 100 |

**Implementation:**

```javascript
// Check after each day ends
function checkAchievements(dayStats) {
  const checks = {
    'tt_first_day': () => dayStats.dayNumber >= 1,
    'tt_hundred_club': () => dayStats.dayRevenue >= 100,
    // ... etc
  };

  for (const [id, condition] of Object.entries(checks)) {
    if (!unlockedAchievements.has(id) && condition()) {
      unlockAchievement(id);
    }
  }
}

function unlockAchievement(id) {
  unlockedAchievements.add(id);
  localStorage.setItem('tt_achievements', JSON.stringify([...unlockedAchievements]));

  // Show toast notification in-game
  showAchievementToast(id);

  // Submit to backend
  if (window.apiClient && currentUser) {
    window.apiClient.unlockAchievement(id, 'tiny-tycoon', {
      metadata: { day: currentDay }
    });
  }
}
```

---

## 11. Leaderboard Integration

### Score Submission

Submit the player's best single-day revenue whenever a new personal best is achieved at the end of a day.

```javascript
async function submitScore(dayRevenue) {
  // Only submit if new personal best
  const bestScore = parseInt(localStorage.getItem('tt_best_score') || '0');
  if (dayRevenue <= bestScore) return;

  // Save new best locally
  localStorage.setItem('tt_best_score', dayRevenue.toString());

  // Submit to leaderboard
  if (!window.apiClient || !currentUser) {
    console.log('Cannot submit score: user not signed in');
    return;
  }

  try {
    await window.apiClient.submitScore('tiny-tycoon', {
      score: dayRevenue,
      level: currentDay,
      metadata: {
        day: currentDay,
        customersServed: dayStats.customersServed,
        customersLost: dayStats.customersLost,
        peakCombo: dayStats.peakComboStreak,
        upgradeLevels: getUpgradeSummary()
      }
    });
    console.log('Score submitted:', dayRevenue);
  } catch (err) {
    console.error('Score submission failed:', err);
  }
}
```

### Payload Format

```json
{
  "score": 847,
  "level": 12,
  "metadata": {
    "day": 12,
    "customersServed": 28,
    "customersLost": 2,
    "peakCombo": 14,
    "upgradeLevels": {
      "speed_boost": 5,
      "auto_serve_1": 1,
      "patience_plus": 3,
      "premium_menu": 2,
      "tip_jar": 4,
      "queue_expand": 1,
      "combo_keeper": 2,
      "auto_serve_2": 0,
      "vip_lounge": 0,
      "auto_serve_3": 0
    }
  }
}
```

### Leaderboard Retrieval

```javascript
// Fetch and display
const leaderboard = await window.apiClient.getLeaderboard('tiny-tycoon', 'weekly');
```

### Auth Integration

```javascript
let currentUser = null;

const authCheckInterval = setInterval(() => {
  if (window.authManager?.isInitialized) {
    clearInterval(authCheckInterval);
    window.authManager.onAuthStateChanged(user => {
      currentUser = user;
      updateSignInUI(user);
    });
  }
}, 100);
```

---

## 12. Technical Constraints

| Constraint | Detail |
|------------|--------|
| **Single file** | Entire game in one `index.html` file at `apps/web/src/games/tiny-tycoon/index.html`. All CSS in `<style>`, all JS in `<script>`. |
| **No dependencies** | Vanilla HTML/CSS/JS only. No frameworks, libraries, build tools, or external assets. |
| **No images** | All visuals are CSS-drawn (`div`, `border-radius`, `background`, `box-shadow`, gradients) or emoji. |
| **No audio files** | All sound effects generated via Web Audio API. |
| **60fps target** | Use `requestAnimationFrame` for the game loop. Minimize DOM mutations per frame. Batch position updates. Use `transform: translateX()` for movement (GPU-accelerated). |
| **Mobile-first** | Touch targets minimum 44x44px. Viewport meta: `width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover`. Test at 375x667 (iPhone SE) as minimum. |
| **Responsive** | Game area max-width 480px, centered. Scales to larger screens without breaking. |
| **localStorage** | Persist: wallet, upgrade levels, best score, current day, achievements, settings (volume, mute). Keys prefixed with `tt_` (e.g., `tt_wallet`, `tt_upgrades`). |
| **Safe area** | Respect `env(safe-area-inset-*)` for notched devices. |
| **No scroll** | `overflow: hidden` on `html` and `body`. `touch-action: manipulation` on game area to prevent double-tap zoom. |
| **Performance** | Max 8 customers on screen simultaneously. Simple CSS shapes only. No `filter` or `blur` on animated elements during gameplay. Use `will-change: transform` on customer elements. |
| **Browser support** | Modern evergreen browsers (Chrome, Safari, Firefox, Edge). ES2020+ is fine. |
| **Game loop** | `requestAnimationFrame`-based with delta time. All timers and movement based on `deltaTime`, not fixed intervals, to handle frame drops gracefully. |

### localStorage Keys

| Key | Type | Description |
|-----|------|-------------|
| `tt_wallet` | `number` | Cumulative coins available for spending |
| `tt_best_score` | `number` | Best single-day revenue (leaderboard score) |
| `tt_current_day` | `number` | Current day number |
| `tt_upgrades` | `JSON string` | Object mapping upgrade IDs to current levels |
| `tt_achievements` | `JSON string` | Array of unlocked achievement IDs |
| `tt_volume` | `number` | Master volume 0.0-1.0 |
| `tt_muted` | `boolean` | Whether sound is muted |

---

## 13. Upgrade System

All upgrades are purchased between rounds using cumulative wallet coins. Upgrades persist across days via localStorage.

### Upgrade List

| ID | Name | Icon | Description | Max Level | Cost Formula | Effect Per Level |
|----|------|------|-------------|-----------|-------------|-----------------|
| `speed_boost` | Speed Boost | ⚡ | Reduce serve time | 10 | `80 + (level * 40)` | -5% serve time per level (compounding). At max: serve time is ~60% of base. Formula: `serveTime * 0.95^level` |
| `patience_plus` | Patience Plus | 😊 | Customers wait longer | 8 | `100 + (level * 50)` | +10% patience duration per level. Formula: `basePatience * (1 + level * 0.10)` |
| `tip_jar` | Tip Jar | 🫙 | Higher speed bonus tips | 8 | `60 + (level * 30)` | +1 coin to speed bonus per level. At Lv8: 75% patience = +10 coins, 90% patience = +13 coins |
| `premium_menu` | Premium Menu | 📋 | Unlock pricier drinks earlier and boost their value | 5 | `150 + (level * 100)` | Lv1: +2 coins to all drinks. Lv2: +4 coins. Lv3: +6 coins. Lv4: +8 coins. Lv5: +10 coins. Also unlocks next drink tier 1 day earlier per level. |
| `queue_expand` | Bigger Queue | 📏 | Increase max queue capacity | 3 | `200 + (level * 150)` | +2 max queue slots per level |
| `combo_keeper` | Combo Keeper | 🛡️ | Forgive angry customers for combo | 3 | `250 + (level * 200)` | Lv1: First angry customer per day doesn't break combo. Lv2: First 2. Lv3: First 3. |
| `auto_serve_1` | Auto-Serve Station #1 | 🤖 | Automatically serves the simplest available order | 1 | `500` | Auto-serves one customer at a time. Serve speed = 150% of manual speed (slower). Only handles drinks worth <= 10 base coins. |
| `auto_serve_2` | Auto-Serve Station #2 | 🤖 | Second auto-serve station | 1 | `1500` | Same as Auto-Serve #1 but handles drinks up to 20 base coins. Requires `auto_serve_1`. |
| `auto_serve_3` | Auto-Serve Station #3 | 🤖 | Third auto-serve station | 1 | `4000` | Handles all drink types. Serve speed = 125% of manual (only slightly slower). Requires `auto_serve_2`. |
| `vip_lounge` | VIP Lounge | 👑 | Chance for VIP customers worth 2x coins | 3 | `300 + (level * 250)` | Lv1: 10% chance per customer is VIP. Lv2: 15%. Lv3: 20%. VIP customers have a golden glow and pay 2x base coins. |

### Cost Table (for quick reference)

| Upgrade | Lv1 | Lv2 | Lv3 | Lv4 | Lv5 | Lv6 | Lv7 | Lv8 | Lv9 | Lv10 |
|---------|-----|-----|-----|-----|-----|-----|-----|-----|-----|------|
| Speed Boost | 120 | 160 | 200 | 240 | 280 | 320 | 360 | 400 | 440 | 480 |
| Patience Plus | 150 | 200 | 250 | 300 | 350 | 400 | 450 | 500 | -- | -- |
| Tip Jar | 90 | 120 | 150 | 180 | 210 | 240 | 270 | 300 | -- | -- |
| Premium Menu | 250 | 350 | 450 | 550 | 650 | -- | -- | -- | -- | -- |
| Queue Expand | 350 | 500 | 650 | -- | -- | -- | -- | -- | -- | -- |
| Combo Keeper | 450 | 650 | 850 | -- | -- | -- | -- | -- | -- | -- |
| Auto-Serve #1 | 500 | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Auto-Serve #2 | 1500 | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| Auto-Serve #3 | 4000 | -- | -- | -- | -- | -- | -- | -- | -- | -- |
| VIP Lounge | 550 | 800 | 1050 | -- | -- | -- | -- | -- | -- | -- |

### Upgrade Purchase Logic

```javascript
function purchaseUpgrade(upgradeId) {
  const upgrade = UPGRADES[upgradeId];
  const currentLevel = upgradeLevels[upgradeId] || 0;

  if (currentLevel >= upgrade.maxLevel) return false;

  // Check prerequisites
  if (upgrade.requires && !upgradeLevels[upgrade.requires]) return false;

  const cost = upgrade.costFormula(currentLevel);
  if (wallet < cost) return false;

  wallet -= cost;
  upgradeLevels[upgradeId] = currentLevel + 1;

  // Persist
  localStorage.setItem('tt_wallet', wallet.toString());
  localStorage.setItem('tt_upgrades', JSON.stringify(upgradeLevels));

  return true;
}
```

---

## 14. Customer Types

### Base Customer Types

All customers share the same visual structure but differ in body color, order, and patience modifier.

| Type | Body Color | Patience Modifier | Order Pool | Spawn Weight (Day 1) | Spawn Weight (Day 10+) |
|------|-----------|-------------------|------------|----------------------|------------------------|
| Regular | `#8B9DC3` (soft blue) | 1.0x | Basic Tea, Boba Milk Tea | 60% | 25% |
| Student | `#FFB347` (orange) | 1.2x (more patient) | Basic Tea, Iced Coffee | 30% | 15% |
| Business | `#708090` (slate) | 0.7x (impatient) | Iced Coffee, Boba Milk Tea | 10% | 20% |
| Foodie | `#DDA0DD` (plum) | 0.9x | Fruit Smoothie, Strawberry Special | 0% | 25% |
| Influencer | `#FF69B4` (pink) | 0.6x (very impatient) | Strawberry Special, Sparkling Boba | 0% | 10% |
| VIP | `#FFD700` (gold) | 1.0x | Any (random) | 0% (see VIP Lounge upgrade) | 0% (upgrade-gated) |

### Customer Behaviors

**Arrival:**
- Customers spawn at the right edge of the game area.
- They walk left at 60px/second toward the queue.
- They stop at the end of the queue line, spaced 50px apart.
- If the queue is full (max capacity reached), no new customers spawn until a slot opens.

**Waiting:**
- Patience bar ticks down continuously based on their patience value.
- Patience bar is visible above each customer.
- At 50% patience, customer's body subtly pulses (CSS animation, `scale(1.02)` oscillation).
- At 25% patience, body color shifts toward red (`mix-blend-mode` or direct color interpolation), and a small `😤` appears.

**Being Served:**
- The customer at the front of the queue moves to the "serving position" (slightly left of counter center).
- A circular progress indicator appears around them (CSS `conic-gradient`).
- The serving progress fills over `serveTime` milliseconds.
- Player can only manually serve the front-of-queue customer (or auto-serve pulls from the front).

**Served (Happy):**
- Progress completes. Coin animation plays (3-5 small gold circles float upward from customer, 300ms duration).
- Customer smiles (`😊` replaces their head expression).
- Customer walks left and off-screen at 120px/second.
- Combo counter increments.

**Angry (Lost):**
- Patience hits 0.
- Customer turns red (CSS transition, 200ms).
- `😤` emoji appears.
- Customer walks RIGHT (back to entrance) and off-screen at 100px/second.
- Combo resets (unless Combo Keeper absorbs it).
- -5 coin penalty.

### VIP Customer (Special)

- Only spawns when VIP Lounge upgrade is purchased.
- Has a golden shimmer effect (CSS `box-shadow: 0 0 10px #FFD700` pulsing animation).
- Pays 2x the base coin value of their order.
- Same patience as base customer type.
- Crown emoji `👑` floats above them in addition to their order emoji.

### Queue Management Rules

1. Customers queue in strict FIFO order from left (counter) to right (entrance).
2. Only the front customer (leftmost, at the counter) can be manually served.
3. When a customer is served or leaves, all customers behind them shift left 50px (animated, 200ms, eased).
4. Auto-serve stations pull from the front of the queue independently of manual serving. If the player and an auto-serve target the same customer, manual takes priority.
5. Multiple customers can be in "being served" state simultaneously (1 manual + up to 3 auto-serve), each occupying their own serving slot above the counter.

---

## Appendix: Game Save/Load

### Save (called after each day and each upgrade purchase)

```javascript
function saveGame() {
  localStorage.setItem('tt_wallet', wallet.toString());
  localStorage.setItem('tt_best_score', bestScore.toString());
  localStorage.setItem('tt_current_day', currentDay.toString());
  localStorage.setItem('tt_upgrades', JSON.stringify(upgradeLevels));
  localStorage.setItem('tt_achievements', JSON.stringify([...unlockedAchievements]));
}
```

### Load (called on page load)

```javascript
function loadGame() {
  wallet = parseInt(localStorage.getItem('tt_wallet') || '0');
  bestScore = parseInt(localStorage.getItem('tt_best_score') || '0');
  currentDay = parseInt(localStorage.getItem('tt_current_day') || '1');
  upgradeLevels = JSON.parse(localStorage.getItem('tt_upgrades') || '{}');
  unlockedAchievements = new Set(JSON.parse(localStorage.getItem('tt_achievements') || '[]'));
  masterVolume = parseFloat(localStorage.getItem('tt_volume') || '0.5');
  isMuted = localStorage.getItem('tt_muted') === 'true';
}
```

### Reset (New Game)

```javascript
function resetGame() {
  ['tt_wallet', 'tt_best_score', 'tt_current_day', 'tt_upgrades', 'tt_achievements'].forEach(k => localStorage.removeItem(k));
  loadGame(); // Reload defaults
}
```

---

## Appendix: Estimated Coin Economy

To validate upgrade pricing is balanced:

| Day | Est. Customers | Est. Revenue (no upgrades) | Cumulative Wallet |
|-----|---------------|---------------------------|-------------------|
| 1 | 15 | ~100 | 100 |
| 2 | 17 | ~130 | 230 |
| 3 | 19 | ~170 | 400 |
| 5 | 22 | ~250 | 900 |
| 8 | 26 | ~400 | 1,900 |
| 10 | 30 | ~550 | 3,000 |
| 15 | 35 | ~800 | 6,500 |
| 20 | 40 | ~1,200 | 12,000 |

**Key milestones:**
- Day 2-3: Can afford Speed Boost Lv1-2, Tip Jar Lv1.
- Day 4-5: Can afford Auto-Serve #1.
- Day 7-8: Can afford Premium Menu, Patience Plus, Queue Expand.
- Day 10-12: Can afford Auto-Serve #2, VIP Lounge.
- Day 15+: Can afford Auto-Serve #3, max out key upgrades.

This ensures players feel steady progression without any single upgrade being trivially cheap or impossibly expensive.
