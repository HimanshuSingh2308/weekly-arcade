# Post-Launch Plan: Chess 3D

**Created**: 2026-04-01
**Last Updated**: 2026-04-01
**Status**: IN_PROGRESS

---

## Funnel Assessment

1. **BROKEN** — No critical bugs remaining (all fixed in launch session)
2. **CONFUSING** — Multiplayer join flow needs polish (connection feedback improved but still fragile)
3. **UNFUN** — Easy→Medium AI gap too steep; Expert feels same as Hard
4. **MISSING** — Draw offer, time controls, move history on mobile, spectator view
5. **POLISH** — Captured pieces on table sides (done), capture effects (done), ambient music

---

## Patches

Ordered by improvement matrix score (highest first).

### Week 1 — Fix & Clarify

- [x] **#1 Fix board clipping on mobile** (Score: 35) — FOVMODE_HORIZONTAL_FIXED for portrait
  - Category: BROKEN
  - Files: game.js (camera setup)
  - Applied: 2026-04-01

- [x] **#2 Fix ELO system** (Score: 33) — Starting ELO 800, K=32, fix broken achievement
  - Category: BROKEN
  - Files: game.js, achievements.ts, game-config.ts
  - Applied: 2026-04-01

- [x] **#3 Fix multiplayer session cleanup** (Score: 32) — Auto-abandon on all disconnect
  - Category: BROKEN
  - Files: game.gateway.ts, game.js
  - Applied: 2026-04-01

- [x] **#4 Fix API client signature** (Score: 30) — multiplayer-client.js request() calls
  - Category: BROKEN
  - Files: multiplayer-client.js
  - Applied: 2026-04-01

- [x] **#5 Deploy Firestore indexes** (Score: 30) — Missing matchmaking indexes caused 500s
  - Category: BROKEN
  - Files: firestore.indexes.json
  - Applied: 2026-04-01

- [x] **#6 Server-side score submission** (Score: 29) — Prevent client-side MP score manipulation
  - Category: BROKEN
  - Files: internal.controller.ts, game.js
  - Applied: 2026-04-01

- [ ] **#7 Medium AI blundering** (Score: 28) — Add 20% chance of 2nd-best move to smooth Easy→Medium gap
  - Category: CONFUSING
  - Files: game.js (ChessAI._alphaBeta or findBestMove)

- [ ] **#8 Expert AI iterative deepening** (Score: 26) — Depth 6-7 with time limit, null-move pruning
  - Category: UNFUN
  - Files: game.js (ChessAI.findBestMove)

### Week 2 — Polish & Feel

- [x] **#9 Capture effects + tiered sounds** (Score: 27) — Gold ring for queen, expanding ripple
  - Category: POLISH
  - Files: game.js (SoundManager, showCaptureEffect)
  - Applied: 2026-04-01

- [x] **#10 3D captured pieces on table** (Score: 25) — Miniature pieces on board sides
  - Category: POLISH
  - Files: game.js (placeCapturedPieces3D)
  - Applied: 2026-04-01

- [x] **#11 Turn timers + game clock** (Score: 25) — Per-turn countdown, game elapsed time
  - Category: MISSING
  - Files: game.js, chess-3d.astro, styles.css
  - Applied: 2026-04-01

- [x] **#12 Timer pause on disconnect** (Score: 24) — Don't penalize connection issues
  - Category: CONFUSING
  - Files: game.js (mpPauseTimers/mpResumeTimers)
  - Applied: 2026-04-01

- [ ] **#13 Draw offer mechanism** (Score: 23) — Server-side draw-offer/draw-accept move types
  - Category: MISSING
  - Files: chess-3d.logic.ts, game.js, chess-3d.astro

- [ ] **#14 Mobile move history** (Score: 22) — Collapsible panel in dead space below board
  - Category: MISSING
  - Files: styles.css, chess-3d.astro, game.js

- [ ] **#15 Time control options** (Score: 21) — Rapid (10+0), Blitz (5+0), Correspondence (current)
  - Category: MISSING
  - Files: game-registry.ts, chess-3d.astro, game.js

### Week 3+ — Depth & Content

- [ ] **#16 AI Web Worker extraction** (Score: 20) — Move AI search off main thread for smooth 60fps
  - Category: UNFUN (Expert blocks UI for 3s)
  - Files: new chess-ai-worker.js, game.js

- [ ] **#17 Opening book expansion** (Score: 18) — 7→50 positions for better Expert variety
  - Category: UNFUN
  - Files: game.js (OPENING_BOOK)

- [ ] **#18 Spectator mode** (Score: 17) — Watch ongoing multiplayer games
  - Category: MISSING
  - Files: game.gateway.ts, game.js

- [ ] **#19 Puzzle mode** (Score: 16) — Daily chess puzzles (mate in N)
  - Category: MISSING
  - Files: new puzzle system

- [ ] **#20 Ambient background music** (Score: 15) — Low drone for strategy mood
  - Category: POLISH
  - Files: game.js (SoundManager + MusicLoop from sound-design skill)

- [ ] **#21 Analysis board** (Score: 14) — Post-game move review with engine evaluation
  - Category: MISSING
  - Files: new analysis UI

---

## Metrics Baseline

| Metric | Value at Launch | Target |
|--------|-----------------|--------|
| Starting ELO | 800 (Pawn tier) | Players reach Knight (1000) by session 10 |
| AI difficulties | 4 levels (Easy/Med/Hard/Expert) | Smooth progression, no dead zones |
| Achievements | 19 total, 0 multiplayer-broken | All earnable, no dry zones |
| Session timeout | 90 min | No force-terminated games |
| Matchmaking window | ±100→±300 (40s) | Quality matches within 60s |
| Turn timer | 2 min | No timeout complaints |
| Mobile board visibility | All 64 squares visible | No clipping on any device |

---

## Cut Candidates

| Element | Verdict | Notes |
|---------|---------|-------|
| Move history on desktop | KEEP | Valuable for serious players |
| ELO display in AI mode | KEEP | Motivates progression |
| "Play vs Friend" coming soon badge | CUT (done) | Feature is live now |
| Undo in multiplayer | CUT (done) | Not applicable, hidden |
| maxScorePerSecond validation | REVIEW | Meaningless for ELO-based scoring |

---

## Health Check Log

| Date | Signal | Action Taken |
|------|--------|-------------|
| 2026-04-01 | Initial launch | Full game built, 10-phase workflow completed |
| 2026-04-01 | Multiplayer integration | Server-side chess engine, WebSocket wiring, lobby/invite |
| 2026-04-01 | Balance audit | ELO rebalanced, achievements fixed, validation hardened |
| 2026-04-01 | Mobile QA | Board clipping fixed, HUD centered, timers added |
| 2026-04-01 | Post-launch plan | Created — 12/21 patches applied on launch day |
