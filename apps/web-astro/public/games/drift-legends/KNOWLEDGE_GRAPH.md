# Drift Legends — Code Knowledge Graph

> **Purpose**: B-tree index of modules, exports, dependencies, state, and data flow.
> Consult this BEFORE reading source files. Find the node you need, then read only that file.
>
> **Last updated**: 2026-04-04 (initial build, all 12 JS modules + astro + backend)

---

## Module Load Order (sequential, each reads prior via `window.DriftLegends`)

```
1. audio.js        → DL.Audio
2. input.js        → DL.Input
3. particles.js    → DL.Particles
4. physics.js      → DL.Physics
5. camera.js       → DL.ChaseCamera
6. car-builder.js  → DL.CarBuilder
7. track-builder.js→ DL.TrackBuilder
8. story-mode.js   → DL.StoryMode        (reads DL.TrackBuilder)
9. ai-racer.js     → DL.AIRacer          (reads DL.TrackBuilder, DL.CarBuilder)
10. gui-manager.js → DL.GUIManager       (reads DL.CarBuilder, DL.StoryMode, DL.TrackBuilder, DL.Input)
11. multiplayer.js → DL.Multiplayer       (reads window.multiplayerClient, window.multiplayerUI)
12. game.js        → ENTRY POINT          (reads ALL DL.* modules + window.authManager + window.apiClient + window.gameHeader)
```

---

## Dependency Graph (who calls who)

```
game.js ─────────┬─► DL.Audio          (play, toggle, setVolume, startEngine, stopEngine, updateEngineSound)
                 ├─► DL.Input           (update, state, consumeMute, isMobile)
                 ├─► DL.Particles       (createDriftSmoke, createBoostFlame, createSparks, burstSparks, createConfetti)
                 ├─► DL.Physics         (new ArcadeVehicle → .update, .applyWallBounce, .applyNitroPad)
                 ├─► DL.ChaseCamera     (new → .setTarget, .update, .shake, .startCinematicIntro, .setResultView)
                 ├─► DL.CarBuilder      (buildCar, updateWheels)
                 ├─► DL.TrackBuilder    (buildTrack, getWallNormal, TRACKS)
                 ├─► DL.StoryMode       (CHAPTERS, loadLocalProgress, loadCloudProgress, mergeProgress,
                 │                        saveLocalProgress, saveCloudProgress, isChapterUnlocked,
                 │                        isCarUnlockable, unlockCar, calculateRaceScore, calculateStars,
                 │                        calculateCoins, isChapterComplete, getCompletionPercent)
                 ├─► DL.AIRacer         (createRivalRacer, createFillerRacers, positionAtStart,
                 │                        getRacePositions, [instance].update)
                 ├─► DL.GUIManager      (new → show, hideAll, onAction, updateHUD, showLoading,
                 │                        showPreRace, showCountdown, showRaceResult, updateChapterCards,
                 │                        updateCarSelectCards, updateMenuCompletion, showTouchControls,
                 │                        showTrackIntro, hideTrackIntro, mpStatusText)
                 ├─► DL.Multiplayer     (warmUp, quickMatch, createPrivateRoom, joinByCode,
                 │                        checkDeepLink, startSync, getOpponentPosition,
                 │                        sendLapComplete, sendRaceFinish)
                 ├─► window.authManager (isInitialized, onAuthStateChanged)
                 ├─► window.apiClient   (submitScore, unlockAchievement)
                 └─► window.gameHeader  (init)

gui-manager.js ──┬─► DL.CarBuilder     (buildCar — 3D car preview in car select screen)
                 ├─► DL.StoryMode       (CHAPTERS, CARS, isCarUnlockable)
                 ├─► DL.TrackBuilder    (TRACKS — track names for pre-race)
                 └─► DL.Input           (setTouch — wire touch controls to input)

ai-racer.js ─────┬─► DL.TrackBuilder   (getSplinePoint, TRACKS — follow waypoints)
                 └─► DL.CarBuilder      (buildRivalCar, buildAICar)

story-mode.js ───┬─► DL.TrackBuilder   (TRACKS — star thresholds per track)
                 └─► window.apiClient   (saveGameState, getGameState — cloud progress)
```

---

## Module API Reference

### DL.Audio (audio.js, 182 lines)
| Export | Signature | Notes |
|--------|-----------|-------|
| play | (soundId: string) → void | IDs: click, countdown, go, drift, boost, nitro, collision, lap, win, lose, unlock |
| toggle | () → boolean | Returns new muted state |
| setVolume | (val: number) → void | 0-1 |
| startEngine | () → void | Starts looping engine oscillator |
| stopEngine | () → void | Stops engine oscillator |
| updateEngineSound | (speed, topSpeed) → void | Pitch-shifts engine by speed ratio |
| **State**: ctx, masterGain, engineOsc, muted (localStorage `dl-muted`), volume |

### DL.Input (input.js, 123 lines)
| Export | Signature | Notes |
|--------|-----------|-------|
| update | (dt) → void | Polls keys, ramps analog steer |
| state | object | {accelerate, brake, steerLeft, steerRight, drift, pause, mute, steer(-1..1)} |
| consumeMute | () → boolean | One-shot mute key check |
| isMobile | () → boolean | Touch detection |
| setTouch | (field, value) → void | Called by GUI touch controls |
| **Keys**: WASD/Arrows=steer+accel, Space=drift, M=mute |

### DL.Particles (particles.js, 118 lines)
| Export | Signature | Notes |
|--------|-----------|-------|
| createDriftSmoke | (scene) → ParticleSystem | Attach to car, control via .emitRate |
| createBoostFlame | (scene) → ParticleSystem | Blue-orange flame |
| createSparks | (scene) → ParticleSystem | For wall collisions |
| burstSparks | (ps, position, count) → void | One-shot burst |
| createConfetti | (scene, position) → void | Win celebration, auto-disposes |

### DL.Physics (physics.js, 257 lines)
| Export | Signature | Notes |
|--------|-----------|-------|
| ArcadeVehicle | class | Constructor(mesh, carId) |
| getPhysicsConfig | (carId) → config | Derived from CAR_CONFIGS stats |
| CAR_CONFIGS | object | {street-kart, drift-racer, sand-runner} → {speed, handling, drift} |
| **ArcadeVehicle instance** | |
| .update | (dt, input, trackData) → void | Core physics step |
| .applyWallBounce | (wallNormal) → void | Reflect velocity off wall |
| .applyNitroPad | () → void | Instant boost from track pad |
| .getDisplaySpeed | () → number | Speed in "km/h" for HUD |
| .resetLapCollision | () → void | Reset wallHitThisLap flag |
| **State**: velocity, speed, isDrifting, driftMeter(0-1), isBoosting, boostLevel, totalDriftScore, collisionCooldown, wallHitThisLap, nitroPadTimer |

### DL.ChaseCamera (camera.js, 203 lines)
| Export | Signature | Notes |
|--------|-----------|-------|
| (class) | Constructor(scene) | Creates FreeCamera |
| setTarget | (mesh) → void | |
| update | (dt, isBoosting) → void | Smooth follow + FOV widen on boost |
| shake | (intensity) → void | Screen shake on collision |
| startCinematicIntro | (carMeshes, trackData, durationSec, onComplete) → void | Pre-race camera sweep |
| updateCinematic | (dt) → void | Called during CINEMATIC_INTRO state |
| setResultView | (position) → void | Orbit camera for result screen |
| **Params**: offsetDistance=8, offsetHeight=3.5, baseFov=0.9, boostFov=1.05 |

### DL.CarBuilder (car-builder.js, 424 lines)
| Export | Signature | Notes |
|--------|-----------|-------|
| buildCar | (scene, carId, colorOverride?) → TransformNode | Procedural PBR car mesh |
| buildRivalCar | (scene, rivalName, carId?) → TransformNode | Color from RIVAL_COLORS |
| buildAICar | (scene, index) → TransformNode | Gray/teal/purple filler cars |
| updateWheels | (carRoot, speed, dt) → void | Spin wheel cylinders |
| CAR_COLORS | object | {street-kart, drift-racer, sand-runner, ai-gray, ai-teal, ai-purple} |
| RIVAL_COLORS | object | {blaze, sandstorm, glacier, viper, apex} |
| **Car types**: street-kart (balanced), drift-racer (low+wide, big spoiler), sand-runner (high+chunky, bull bar) |
| **Internal**: Shared cached materials (_wheelMat, _chromeMat) |

### DL.TrackBuilder (track-builder.js, 660 lines)
| Export | Signature | Notes |
|--------|-----------|-------|
| buildTrack | (scene, trackId) → TrackData | Builds spline road + env meshes |
| getWallNormal | (splinePoints, trackWidth, carPos) → Vector3? | Wall collision detection |
| getSplinePoint | (splinePoints, t) → Vector3 | Position on track at t(0-1) |
| TRACKS | object | 15 track definitions (5 env x 3 races) |
| **TrackData returned**: {meshes[], startPosition, startRotation, splinePoints[], checkpointPositions[], nitroPositions[], trackDef} |
| **Environments**: city (neon buildings), desert (mesa+cacti), ice (frozen+crystals), jungle (trees+vines), sky (floating platforms) |
| **Track IDs**: city-circuit, neon-alley, blaze-showdown, mesa-loop, canyon-rush, sandstorm-duel, frost-ring, glacier-pass, glacier-showdown, vine-twist, canopy-sprint, viper-showdown, cloud-highway, stratosphere-loop, apex-finale |

### DL.StoryMode (story-mode.js, 293 lines)
| Export | Signature | Notes |
|--------|-----------|-------|
| CHAPTERS | array[5] | {id, name, theme, rival, races[], reward, aiSpeedMultiplier, aiDriftFrequency, rubberBandCap} |
| CARS | array[3] | {id, name, unlockChapter, cost} |
| loadLocalProgress | () → progress | From localStorage `dl-progress` |
| saveLocalProgress | (progress) → void | |
| loadCloudProgress | () → progress? | Via apiClient.getGameState |
| saveCloudProgress | (progress) → void | Via apiClient.saveGameState |
| mergeProgress | (local, cloud) → progress | Higher-wins merge |
| isChapterUnlocked | (progress, chapterId) → boolean | |
| isChapterComplete | (progress, chapterId) → boolean | All races completed |
| isCarUnlockable | (progress, carId) → 'owned'/'available'/'locked' | |
| unlockCar | (progress, carId) → boolean | Deducts coins |
| calculateRaceScore | (position, driftScore, cleanLaps, totalLaps) → number | |
| calculateStars | (raceScore, trackId) → 1/2/3 | Uses TRACKS[trackId].starThresholds |
| calculateCoins | (stars) → number | |
| getCompletionPercent | (progress) → number | |
| **Progress shape**: {coins, unlockedCars[], chaptersUnlocked[], raceResults:{[trackId]:{bestStars,bestTime,completed,attempts}}, totalDriftScore, storyComplete, chapterBonusClaimed:{}} |
| **Chapters**: 1-Street Rookie (city/Blaze), 2-Desert Dash (desert/Sandstorm), 3-Frozen Peak (ice/Glacier), 4-Jungle Fury (jungle/Viper), 5-Sky Championship (sky/Apex) |

### DL.AIRacer (ai-racer.js, 257 lines)
| Export | Signature | Notes |
|--------|-----------|-------|
| createRivalRacer | (scene, chapter, trackData) → AIRacer | Named rival with personality |
| createFillerRacers | (scene, chapter, trackData, count) → AIRacer[] | Background racers |
| positionAtStart | (racers[], startPos, startRot, trackWidth) → void | Grid placement |
| getRacePositions | (playerT, racers[]) → {id,t}[] | Sorted positions for HUD |
| **AIRacer instance**: .update(dt, trackData, playerPos, playerLap, raceTime), .mesh, .speed, .lap |
| **Personalities**: aggressive, technical, defensive, dirty, champion, filler |
| **Rubber banding**: AI speeds up/slows down based on distance to player |

### DL.GUIManager (gui-manager.js, 1209 lines) — LARGEST MODULE
| Export | Signature | Notes |
|--------|-----------|-------|
| (class) | Constructor(scene) | Creates AdvancedDynamicTexture |
| show | (screenName) → void | MENU, STORY_SELECT, CAR_SELECT, PRE_RACE, RACE_HUD, RESULT, MP_MENU, SETTINGS, LOADING |
| hideAll | () → void | |
| onAction | (name, callback) → void | Register GUI callbacks |
| updateHUD | ({position, lap, totalLaps, speed, driftMeter, isBoosting, raceTime}) → void | Per-frame |
| showLoading | (trackName) → void | |
| showPreRace | (trackName, rivalName, rivalLine) → void | |
| showCountdown | (number) → void | 3, 2, 1, GO |
| showRaceResult | ({position, stars, raceScore, coins, totalTimeMs, unlockText}) → void | |
| updateChapterCards | (chapters, progress) → void | Story select screen |
| updateCarSelectCards | (progress) → void | Car select screen |
| updateMenuCompletion | (percent) → void | Main menu progress bar |
| showTouchControls | (visible) → void | Mobile virtual controls |
| showTrackIntro | (trackId, chapterName) → void | Track name overlay during cinematic |
| hideTrackIntro | () → void | |
| mpStatusText | GUI.TextBlock | Direct access for multiplayer status |
| **Action names**: click, storyMode, multiplayer, settings, selectChapter({chapterIndex}), selectCar({carId}), startRace, resultNext, resultRetry, resultMenu, volumeChange(val), mpQuickMatch, mpCreatePrivate, mpJoinCode |
| **Design tokens**: COLORS object (bg, accent, text, chapter colors ch1-ch5, gold/silver/bronze) |

### DL.Multiplayer (multiplayer.js, 336 lines)
| Export | Signature | Notes |
|--------|-----------|-------|
| warmUp | () → void | Pre-connect socket |
| quickMatch | (uid) → void | Join matchmaking queue |
| createPrivateRoom | (uid) → session? | Returns {joinCode} |
| joinByCode | (code) → void | Join private room |
| checkDeepLink | () → string? | Check URL for ?join=CODE |
| startSync | (playerCar) → void | Begin 15Hz position sync |
| getOpponentPosition | () → {x,z,rotY}? | Interpolated opponent pos |
| sendLapComplete | (lapTimeMs, lap, checkpointSeq) → void | |
| sendRaceFinish | (totalTimeMs, driftScore) → void | |
| **Deps**: window.multiplayerClient (shared WebSocket module), window.multiplayerUI |
| **Sync**: 15Hz (67ms), dead reckoning after 200ms, client-side interpolation |

---

## game.js State Machine

```
INIT → MENU ─┬─► STORY_SELECT → CAR_SELECT → PRE_RACE → LOADING → CINEMATIC_INTRO → COUNTDOWN → RACING → RACE_FINISH → RESULT ─┬─► (next race)
              │                                                                                                                    ├─► STORY_SELECT
              ├─► MP_MENU (requires auth)                                                                                          └─► MENU
              └─► SETTINGS
```

### Key game.js Variables (mutable state)
| Variable | Type | Set by | Read by |
|----------|------|--------|---------|
| state | STATE enum | state machine transitions | game loop switch |
| currentUser | object/null | authManager callback | score submit, achievement, MP |
| progress | StoryProgress | _loadProgress, _finishRace | chapter/car unlocks, UI |
| selectedChapter | Chapter | gui selectChapter action | race setup, AI config |
| selectedCarId | string | gui selectCar action | car build |
| selectedTrackId | string | derived from chapter.races[index] | track build |
| isMultiplayerRace | boolean | MP flow | race setup, sync, collision |
| playerCar | TransformNode | _buildRace | physics, camera, particles, collision |
| playerPhysics | ArcadeVehicle | _buildRace | game loop, finish, achievements |
| trackData | TrackData | _buildRace | wall collision, checkpoints, nitro |
| aiRacers | AIRacer[] | _buildRace | game loop, positions |
| raceTime | number | game loop increment | HUD, lap timing |
| playerLap / totalLaps | number | checkpoint system | HUD, finish check |
| playerCheckpoint | number | _updateCheckpoints | lap completion |

---

## Backend Files

### drift-legends.logic.ts (apps/realtime/src/game/game-logic/, 304 lines)
| Implements | MultiplayerGameLogic interface |
|------------|-------------------------------|
| initState | (players, config) → DriftLegendsState |
| validateMove | (state, playerId, move) → boolean |
| applyMove | (state, playerId, move) → DriftLegendsState |
| checkGameEnd | (state) → GameResult? |
| **Move types**: position_update, lap_complete, race_finish |
| **Anti-cheat**: MIN_LAP_TIMES per track, checkpoint sequence validation |
| **State**: players[], trackId, positions{}, laps{}, lapTimes{}, finished{}, finishedAt{}, finalRanks |
| **MP config**: 2 laps (vs 3 in story), 5 checkpoints |

### game-config.ts (apps/api/src/leaderboard/config/) — MODIFIED
| Added | drift-legends score validation |
|-------|-------------------------------|
| Score: negative totalTimeMs (lower=better) |
| Required metadata: trackId, position, driftScore, chapter, stars |

### game-registry.ts (packages/shared/) — MODIFIED
| Added | drift-legends entry with multiplayer config |

### achievements.ts (packages/shared/) — MODIFIED
| Added | dl-first-finish, dl-first-win, dl-chapter1-complete, dl-chapter3-complete, dl-story-complete, dl-first-superboost, dl-clean-sweep, dl-drift-master, dl-all-cars, dl-night-racer, dl-all-tracks-cleared, dl-all-three-stars, dl-rival-beaten-first |

### game.module.ts (apps/realtime/src/game/) — MODIFIED
| Added | DriftLegendsLogic import + registration |

---

## Data Constants (change these to tune gameplay)

| What | Where | Key |
|------|-------|-----|
| Car stats (speed/handling/drift) | physics.js:10-14 | CAR_CONFIGS |
| Physics tuning (accel, friction, boost) | physics.js:16-32 | getPhysicsConfig() |
| Track layouts (control points, width) | track-builder.js:14-160 | TRACKS |
| Star thresholds per track | track-builder.js (per track def) | starThresholds |
| Chapter difficulty (AI speed, rubber band) | story-mode.js (per chapter) | aiSpeedMultiplier, rubberBandCap |
| AI personalities (ram/block chance) | ai-racer.js:19-26 | PERSONALITIES |
| Coin rewards per star | story-mode.js | calculateCoins() |
| Car unlock costs | story-mode.js | CARS |
| Chapter unlock rewards | story-mode.js | CHAPTERS[].reward |
| Minimum lap times (anti-cheat) | drift-legends.logic.ts:34 | MIN_LAP_TIMES |
| MP laps count | drift-legends.logic.ts:30 | TOTAL_LAPS_MP |
| Position sync rate | multiplayer.js:10 | SYNC_INTERVAL_MS (67ms = 15Hz) |
| GUI colors/tokens | gui-manager.js:12-34 | COLORS |
| Achievement IDs | game.js:770-820 + achievements.ts | dl-* |

---

## GUI Button Click Requirements (CRITICAL)

For Babylon.js GUI buttons to work:
1. `scene.skipPointerMovePicking` must be `false`
2. Touch controls container must be HIDDEN when showing overlays (pause/result)
3. Overlay panels need `zIndex >= 50` to be above touch controls
4. Result buttons on `this.ui` root need `zIndex = 60`
5. 3D meshes should be `isPickable = false` during overlay screens
6. TextBlocks need `isHitTestVisible = false` to not block button clicks
7. Decorative Rectangles need `isHitTestVisible = false`

## Common Change Scenarios

| Task | Files to read | Files to modify |
|------|---------------|-----------------|
| Tune car handling/speed | physics.js (CAR_CONFIGS, getPhysicsConfig) | physics.js |
| Add new track | track-builder.js (TRACKS, env builder) | track-builder.js, story-mode.js (chapter.races) |
| Add new car | car-builder.js (build fn), physics.js (CAR_CONFIGS), story-mode.js (CARS) | car-builder.js, physics.js, story-mode.js |
| Change AI behavior | ai-racer.js (PERSONALITIES, update method) | ai-racer.js |
| UI layout/colors | gui-manager.js (COLORS, screen builders) | gui-manager.js |
| Add achievement | game.js (_checkAchievements), achievements.ts | game.js, achievements.ts |
| Fix collision | game.js (_updateRacing — wall/car collision), physics.js (applyWallBounce) | game.js, physics.js |
| Fix multiplayer sync | multiplayer.js (startSync, getOpponentPosition) | multiplayer.js |
| Multiplayer anti-cheat | drift-legends.logic.ts (validateMove) | drift-legends.logic.ts |
| Score submission | game.js (_submitScore), game-config.ts | game.js, game-config.ts |
| Add new chapter | story-mode.js (CHAPTERS), track-builder.js (new tracks+env), ai-racer.js (rival personality) | story-mode.js, track-builder.js, ai-racer.js |
| Fix camera | camera.js | camera.js |
| Fix audio | audio.js | audio.js |
| Fix touch controls | input.js (setTouch), gui-manager.js (touch control builder) | input.js, gui-manager.js |
| Add particle effect | particles.js | particles.js, game.js (wire it) |
| Change race flow | game.js (state machine, _buildRace, _finishRace) | game.js |
| Update Astro page/SEO | drift-legends.astro, drift-legends.json | drift-legends.astro, drift-legends.json |
