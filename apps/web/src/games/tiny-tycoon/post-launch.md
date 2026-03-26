# Post-Launch Plan: Tiny Tycoon

**Created**: 2026-03-26
**Last Updated**: 2026-03-26 (All Week 1+2 patches applied)
**Status**: IN_PROGRESS

---

## Funnel Assessment

### BROKEN
- `timeMs` hardcoded to ~60000 (server-side time validation bypassed)
- Global state exposed on `window` (console exploits possible)
- `metadata.streakBonus` unbounded (unlimited XP via client)

### CONFUSING
- 7 upgrades hidden initially — players may not know more exist
- VIP Lounge mechanics not explained (waiter NPCs, auto-serve interaction)
- Rush Hour appears suddenly with no warning (30% random, no countdown)

### UNFUN
- Combo reset on ANY angry customer (harsh with 0.6x patience Influencers)
- Day 15-20 patience drops to 4-5s (may feel impossible without upgrades)
- No visual payoff for maxing all upgrades (end-game feels flat)

### MISSING
- Daily challenge / streak system (return reason)
- Stats page (total served, best combo, etc.)
- Shop visual evolution with upgrades

### POLISH
- Customer walking animation
- Coin particle trail to wallet on earn
- "New personal best!" celebration

---

## Patches

Ordered by improvement matrix score (highest first).

### Week 1 — Fix & Clarify

- [x] **#3 Soften combo reset** (Score: 31) — Angry customer reduces combo by 50% (floor) instead of reset to 0. Combo Keeper still forgives entirely.
  - Category: UNFUN
  - Files: `apps/web/src/games/tiny-tycoon/index.html` (search `combo = 0`)
  - Applied: 2026-03-26

- [x] **#6 "New personal best!" celebration** (Score: 29) — Show banner + confetti when beating high score on day end
  - Category: POLISH (quick win)
  - Files: `apps/web/src/games/tiny-tycoon/index.html` (day end handler)
  - Applied: 2026-03-26

- [x] **#1 Fix timeMs hardcoding** (Score: 28) — Already fixed: uses `Date.now() - dayStartTime` (commit e214078)
  - Category: BROKEN
  - Files: `apps/web/src/games/tiny-tycoon/index.html` (search `timeMs`)
  - Applied: pre-existing (verified 2026-03-26)

- [x] **#5 Add stats page** (Score: 26) — Show total served, best combo, total coins earned, days played in a stats overlay
  - Category: MISSING
  - Files: `apps/web/src/games/tiny-tycoon/index.html` (new state or overlay)
  - Applied: 2026-03-26

- [x] **#4 Rush Hour countdown** (Score: 25) — 3-second "RUSH INCOMING!" warning before Rush Hour starts
  - Category: CONFUSING
  - Files: `apps/web/src/games/tiny-tycoon/index.html` (search `rushHour`)
  - Applied: 2026-03-26

- [x] **#2 Cap streakBonus in metadata** (Score: 24) — N/A: no `streakBonus` field exists in code (stale audit finding)
  - Category: BROKEN
  - Files: N/A
  - Applied: N/A (verified 2026-03-26)

### Week 2 — Polish & Feel

- [x] **#9 Shop visual evolution** (Score: 24) — Day milestones (5/10/20) now contribute to shop level, so shop progresses visually even without upgrades
  - Category: MISSING
  - Files: `apps/web/src/games/tiny-tycoon/index.html` (getShopLevel)
  - Applied: 2026-03-26

- [x] **#7 Coin particle trail** (Score: 23) — Coin flies from customer to HUD wallet with scale-down animation, wallet pulses on arrival
  - Category: POLISH
  - Files: `apps/web/src/games/tiny-tycoon/index.html` (spawnCoinTrailToWallet)
  - Applied: 2026-03-26

- [x] **#10 Daily challenge system** (Score: 23) — 7 rotating challenges (deterministic by day), bonus coins on completion, shown in day-end modal
  - Category: MISSING
  - Files: `apps/web/src/games/tiny-tycoon/index.html` (DAILY_CHALLENGES, startDay, endDay, showDayEnd)
  - Applied: 2026-03-26

- [x] **#8 VIP tutorial tooltip** (Score: 22) — Tutorial overlay on first VIP customer explaining lounge + waiter + 2x coins, auto-dismisses in 4s
  - Category: CONFUSING
  - Files: `apps/web/src/games/tiny-tycoon/index.html` (createCustomer, showVipTutorial)
  - Applied: 2026-03-26

### Week 3+ — Depth & Content

- [ ] **Global state cleanup** — Wrap in proper IIFE, remove window exposure of game functions
  - Category: BROKEN (security)
  - Files: `apps/web/src/games/tiny-tycoon/index.html` (script structure)
  - Applied:

- [ ] **Customer walking animation** — Customers walk in from right instead of appearing
  - Category: POLISH
  - Files: `apps/web/src/games/tiny-tycoon/index.html` (customer spawn)
  - Applied:

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
| Influencer type (0.6x patience) | Keep but monitor | Re-evaluate after combo softening |
| 7 hidden upgrades at start | Keep | Discovery is part of the fun |
| Auto-Serve #3 (4000 coins) | Keep | Aspirational end-game target |

---

## Health Check Log

| Date | Signal | Action Taken |
|------|--------|-------------|
| 2026-03-26 | Initial analysis | Plan created, 12 patches identified |
| 2026-03-26 | Patch #3 applied | Combo reset softened: halve instead of zero. Combo lost flash only shows when combo fully depleted. |
| 2026-03-26 | Patch #6 applied | Full-screen "NEW PERSONAL BEST!" banner with scale animation + score display, auto-dismisses after 2.5s |
| 2026-03-26 | Patch #1 verified | timeMs already fixed in prior commit (e214078), marked as pre-existing |
| 2026-03-26 | Patch #5 applied | Stats page: cumulative tracking (served, lost, coins, combo, days) + stats overlay + title screen button |
