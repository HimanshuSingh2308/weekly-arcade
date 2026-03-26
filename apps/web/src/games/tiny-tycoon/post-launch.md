# Post-Launch Plan: Tiny Tycoon

**Created**: 2026-03-26
**Last Updated**: 2026-03-26 (Round 2: All 9 patches applied)
**Status**: ALL_APPLIED

---

## Funnel Assessment (Round 2)

### BROKEN
- Spacebar serving (line 4340) doesn't call `triggerBaristaServe()` or `playSound('tap')` — keyboard players get no barista animation or tap sound
- `playSound('achievement')` called on daily challenge completion (line 3775) but no `'achievement'` case in sound switch — silent failure

### CONFUSING
- No keyboard hint in tutorial — desktop players may never discover spacebar serving
- No achievements gallery — players can't review which achievements they've unlocked

### UNFUN
- Day 20+ patience drops to 4000ms; Influencer (0.6x) = 2400ms effective — near-impossible to serve manually
- Only 7 daily challenges cycling — repetitive after a week of play

### MISSING
- No achievements gallery/viewer (only toast notification on unlock)
- No ambient background music loop (shop atmosphere is quiet)
- No score sharing capability

### POLISH
- End-game feels flat after maxing all upgrades — no prestige or milestone reward

---

## Patches (Round 2)

Ordered by improvement matrix score (highest first).

### Week 1 — Fix & Clarify

- [x] **#1 Late-game patience floor** (Score: 29) — Raised Day 15 from 5000ms to 5500ms and Day 20 from 4000ms to 5000ms. Influencer effective patience now ~3000ms instead of ~2400ms
  - Category: UNFUN
  - Files: `apps/web/src/games/tiny-tycoon/index.html` (PATIENCE_TABLE)
  - Applied: 2026-03-26

- [x] **#2 Achievements gallery** (Score: 28) — 2-column grid overlay showing all 12 achievements with locked/unlocked state, XP values, and summary. Accessible from title screen via new button
  - Category: MISSING
  - Files: `apps/web/src/games/tiny-tycoon/index.html` (showAchievements, achievementsOverlay, ach-grid CSS)
  - Applied: 2026-03-26

- [x] **#3 Expand daily challenges to 14** (Score: 26) — Added 7 new challenges with varied targets + new 'lte' comparison type for "lose at most N" challenges
  - Category: UNFUN
  - Files: `apps/web/src/games/tiny-tycoon/index.html` (DAILY_CHALLENGES, endDay comparison logic)
  - Applied: 2026-03-26

- [x] **#4 Fix spacebar missing barista + sound** (Score: 23) — Added `triggerBaristaServe()` and `playSound('tap')` to keyboard spacebar handler
  - Category: BROKEN
  - Files: `apps/web/src/games/tiny-tycoon/index.html` (keydown handler)
  - Applied: 2026-03-26

- [x] **#5 Fix missing 'achievement' sound** (Score: 22) — Added 'achievement' case: 3-note ascending sine chime (E5, G5, B5)
  - Category: BROKEN
  - Files: `apps/web/src/games/tiny-tycoon/index.html` (playSound switch)
  - Applied: 2026-03-26

### Week 2 — Polish & Feel

- [x] **#6 Ambient background music loop** (Score: 25) — Soft C major 7 pad with detuned chorus oscillators + LFO filter sweep. Starts on day start, stops on pause/end/quit, respects mute toggle
  - Category: MISSING
  - Files: `apps/web/src/games/tiny-tycoon/index.html` (startBgm, stopBgm, updateBgmVolume, lifecycle hooks)
  - Applied: 2026-03-26

- [x] **#7 Score sharing button** (Score: 23) — Share button on day-end modal using Web Share API with clipboard fallback. Shows "Copied!" confirmation
  - Category: MISSING
  - Files: `apps/web/src/games/tiny-tycoon/index.html` (shareScore, showDayEnd)
  - Applied: 2026-03-26

### Week 3+ — Depth & Content

- [x] **#8 End-game prestige system** (Score: 24) — Glowing "Prestige" button in shop when all upgrades maxed. Resets upgrades/wallet/day, keeps achievements/stats/best score. +5% permanent coin bonus per level. New "New Beginnings" achievement (150 XP). Prestige badge in shop wallet + stats page
  - Category: POLISH
  - Files: `apps/web/src/games/tiny-tycoon/index.html` (prestige state, save/load, allUpgradesMaxed, showPrestigeConfirm, doPrestige, completeServe multiplier, shop UI, stats, CSS)
  - Applied: 2026-03-26

- [x] **#9 Keyboard hint in tutorial** (Score: 18) — Shows "or press SPACEBAR" below tap instruction on non-touch devices (detected via ontouchstart/maxTouchPoints)
  - Category: CONFUSING
  - Files: `apps/web/src/games/tiny-tycoon/index.html` (showTutorial)
  - Applied: 2026-03-26

---

## Metrics Baseline

| Metric | Value at Analysis | Target |
|--------|-------------------|--------|
| Avg highest day reached | TBD (check leaderboard `level` field) | Day 10+ for 50% of players |
| Score distribution | TBD | Wide spread (10x+ between median and top) |
| Combo peak distribution | TBD (`metadata.peakCombo`) | 50% of players reaching 10+ |
| Dominant upgrade | TBD (`metadata.upgradeLevels`) | No single upgrade >70% first buy |
| Return rate | TBD (same userId, multiple days) | >20% week-over-week return |

---

## Cut Candidates

| Element | Verdict | Notes |
|---------|---------|-------|
| Influencer type (0.6x patience) | Keep but cap via patience floor | Re-evaluate if Day 20+ still feels impossible after #1 |
| 7 hidden upgrades at start | Keep | Discovery is part of the fun |
| Auto-Serve #3 (4000 coins) | Keep | Aspirational end-game target |
| VIP tutorial auto-dismiss | Monitor | 4s may be too short for some players |

---

## Health Check Log

| Date | Signal | Action Taken |
|------|--------|-------------|
| 2026-03-26 | Initial analysis | Plan created, 12 patches identified |
| 2026-03-26 | All Round 1 patches applied | 12/12 complete: combo softening, new best banner, stats page, rush countdown, coin trail, daily challenges, VIP tutorial, shop evolution, customer animations, global state cleanup |
| 2026-03-26 | Round 2 fresh analysis | 9 new patches identified: patience floor, achievements gallery, expanded challenges, bug fixes, ambient music, sharing, prestige, keyboard hint |
| 2026-03-26 | Round 2 patches #1-#7 applied | Patience floor raised, achievements gallery added, 14 daily challenges, spacebar bug fixed, achievement sound added, ambient BGM, share button |
| 2026-03-26 | Round 2 patches #8-#9 applied | End-game prestige system with achievement + keyboard hint in tutorial. All 9 Round 2 patches complete |
