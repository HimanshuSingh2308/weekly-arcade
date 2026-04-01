# Post-Launch Plan: Chess 3D

**Created**: 2026-04-01
**Last Updated**: 2026-04-01 (Fresh analysis v2)
**Status**: IN_PROGRESS

---

## Funnel Assessment

1. **BROKEN** — All critical bugs fixed. No known blockers.
2. **CONFUSING** — Medium AI gap smoothed (blundering). Mobile board visible. Move animation added.
3. **UNFUN** — Expert AI still feels same as Hard (1 ply difference). No draw offer.
4. **MISSING** — Time controls, spectator mode, puzzle mode, analysis board.
5. **POLISH** — Ambient music, board themes, piece skins.

---

## Completed Patches (15 applied)

- [x] #1 Fix board clipping on mobile (FOVMODE_HORIZONTAL_FIXED) — 2026-04-01
- [x] #2 Fix ELO system (800 start, K=32, achievements) — 2026-04-01
- [x] #3 Fix multiplayer session cleanup (auto-abandon) — 2026-04-01
- [x] #4 Fix API client signature — 2026-04-01
- [x] #5 Deploy Firestore indexes — 2026-04-01
- [x] #6 Server-side score submission — 2026-04-01
- [x] #7 Medium AI blundering (20% 2nd-best) — 2026-04-01
- [x] #8 Capture effects + tiered sounds — 2026-04-01
- [x] #9 3D captured pieces on table — 2026-04-01
- [x] #10 Turn timers + game clock — 2026-04-01
- [x] #11 Timer pause on disconnect — 2026-04-01
- [x] #12 Mobile move history drawer — 2026-04-01
- [x] #13 Babylon.js move animation for multiplayer — 2026-04-01
- [x] #14 Matchmaking 300-point rating window — 2026-04-01
- [x] #15 Mobile gameplay UX (HUD centered, board zoom, safe areas) — 2026-04-01

---

## Pending Patches (ordered by improvement matrix score)

### Week 2 — Core Improvements

- [ ] **#16 Expert AI iterative deepening** (Score: 28) — Depth 6-7 with time limit + null-move pruning
  - Impact: 3 | Fun: 4 | Effort: 3 | Risk: 4
  - Category: UNFUN (Expert feels same as Hard)
  - Files: game.js (ChessAI.findBestMove, _alphaBeta)
  - Prerequisite: #17 (Web Worker) for Expert not to freeze UI at depth 6+

- [ ] **#17 AI Web Worker extraction** (Score: 27) — Move AI search off main thread
  - Impact: 4 | Fun: 3 | Effort: 3 | Risk: 4
  - Category: UNFUN (Expert blocks UI for 3s)
  - Files: new chess-ai-worker.js, game.js

- [ ] **#18 Draw offer mechanism** (Score: 25) — Server-side draw-offer/draw-accept
  - Impact: 4 | Fun: 3 | Effort: 3 | Risk: 4
  - Category: MISSING
  - Files: chess-3d.logic.ts, game.js, chess-3d.astro

- [ ] **#19 Time control options** (Score: 23) — Rapid (10+0), Blitz (5+0), Correspondence (current)
  - Impact: 3 | Fun: 4 | Effort: 2 | Risk: 4
  - Category: MISSING
  - Files: game-registry.ts, chess-3d.astro, game.js, multiplayer lobby UI

### Week 3 — Content & Depth

- [ ] **#20 Opening book expansion** (Score: 20) — 7→50 positions for Expert variety
  - Impact: 2 | Fun: 3 | Effort: 5 | Risk: 5
  - Category: UNFUN
  - Files: game.js (OPENING_BOOK)

- [ ] **#21 Ambient background music** (Score: 19) — Low strategy drone from sound-design skill
  - Impact: 4 | Fun: 3 | Effort: 4 | Risk: 5
  - Category: POLISH
  - Files: game.js (SoundManager + MusicLoop)

- [ ] **#22 Board themes** (Score: 18) — Classic wood, marble, dark mode, tournament green
  - Impact: 4 | Fun: 2 | Effort: 3 | Risk: 5
  - Category: POLISH
  - Files: game.js (board materials), settings in localStorage

- [ ] **#23 Near-miss tease on game over** (Score: 18) — "2 moves from checkmate!" / "1 win from achievement"
  - Impact: 3 | Fun: 3 | Effort: 4 | Risk: 5
  - Category: POLISH (retention)
  - Files: game.js (endGame)

### Month 2+ — Features

- [ ] **#24 Daily chess puzzle** (Score: 17) — Mate-in-N, new each day
  - Impact: 3 | Fun: 4 | Effort: 1 | Risk: 4
  - Category: MISSING (retention)
  - Files: new puzzle system, chess-3d.astro

- [ ] **#25 Spectator mode** (Score: 16) — Watch ongoing multiplayer games
  - Impact: 2 | Fun: 3 | Effort: 2 | Risk: 4
  - Category: MISSING
  - Files: game.gateway.ts, game.js

- [ ] **#26 Analysis board** (Score: 14) — Post-game move review with engine evaluation
  - Impact: 2 | Fun: 3 | Effort: 1 | Risk: 4
  - Category: MISSING
  - Files: new analysis UI

- [ ] **#27 Piece skins** (Score: 13) — Unlock different 3D piece sets via achievements
  - Impact: 2 | Fun: 2 | Effort: 2 | Risk: 5
  - Category: POLISH (progression)
  - Files: game.js (piece masters), new mesh factories

---

## Metrics Baseline

| Metric | Value at Launch | Target (Week 2) |
|--------|-----------------|-----------------|
| Starting ELO | 800 (Pawn) | Players reach Knight (1000) by session 10 |
| AI difficulties | 4 levels, Medium blunders 20% | Smooth curve, no dead zones |
| Achievements | 19 total, all earnable | 1 unlock per 5 sessions avg |
| Session timeout | 90 min | No force-terminated games |
| Matchmaking window | ±100→±300 (40s cap) | Quality matches within 60s |
| Mobile board | Full 64 squares visible | No clipping on any device |
| Move animation | Arc + bounce + sound in MP | Clear visual feedback every move |
| Multiplayer score | Server-submitted | No client manipulation |

---

## Cut Candidates

| Element | Verdict | Notes |
|---------|---------|-------|
| maxScorePerSecond validation | CUT or DOCUMENT | Meaningless for ELO scoring |
| Easy AI warning tooltip | ADD | Warn about -39 ELO risk on loss |
| Move history on desktop side panel | KEEP | Valuable for serious players |
| Undo in multiplayer | CUT (done) | Not applicable |

---

## Retention Stack Assessment

| Layer | Status | Notes |
|-------|--------|-------|
| Core loop fun | GOOD | 3D board, smooth AI, satisfying captures |
| Daily challenge | MISSING | #24 would add this |
| Streak rewards | PARTIAL | Play streak exists but no chess-specific streak |
| Progression unlock | GOOD | ELO tiers (Pawn→Grandmaster) + 19 achievements |
| Social leaderboard | GOOD | Multiplayer ELO leaderboard |

**Biggest retention gap**: No daily reason to return. Daily puzzles (#24) would be the highest-ROI addition for D7/D30 retention.

---

## Health Check Log

| Date | Signal | Action Taken |
|------|--------|-------------|
| 2026-04-01 | Launch day | Full game built + 10-phase workflow |
| 2026-04-01 | Multiplayer integration | Server engine, WebSocket, lobby/invite |
| 2026-04-01 | Balance audit | ELO 800 start, K=32, 19 achievements, rating window |
| 2026-04-01 | Mobile QA | Board clipping fixed, HUD centered, safe areas |
| 2026-04-01 | Move animation | Babylon.js arc + bounce for MP moves |
| 2026-04-01 | Fresh analysis v2 | 15/27 patches applied, 12 remaining |
