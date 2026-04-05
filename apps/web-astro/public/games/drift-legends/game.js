'use strict';
/**
 * Drift Legends -- Main Game Entry Point
 * Babylon.js Engine/Scene setup, game state machine, game loop, auth integration.
 */
(function () {
  // Seal top-level namespace to prevent adding new properties (anti-tamper)
  // Note: don't deep-freeze — modules have mutable internal state (Input.keys, Physics.velocity, etc.)
  if (window.DriftLegends) {
    Object.seal(window.DriftLegends);
  }
  const DL = window.DriftLegends;
  const V3 = BABYLON.Vector3;

  // ─── Game State Machine ───────────────────────────────────────────
  const STATE = {
    INIT: 'INIT',
    MENU: 'MENU',
    STORY_SELECT: 'STORY_SELECT',
    CAR_SELECT: 'CAR_SELECT',
    PRE_RACE: 'PRE_RACE',
    LOADING: 'LOADING',
    CINEMATIC_INTRO: 'CINEMATIC_INTRO',
    COUNTDOWN: 'COUNTDOWN',
    RACING: 'RACING',
    RACE_FINISH: 'RACE_FINISH',
    RESULT: 'RESULT',
    MP_MENU: 'MP_MENU',
    SETTINGS: 'SETTINGS',
    PAUSED: 'PAUSED',
  };

  let state = STATE.INIT;
  let currentUser = null;
  let progress = null;

  // ─── Race State ───────────────────────────────────────────────────
  let selectedChapter = null;
  let selectedRaceIndex = 0;
  let selectedCarId = 'street-kart';
  let selectedTrackId = null;
  let isMultiplayerRace = false;

  // Active objects
  let playerCar = null;
  let playerPhysics = null;
  let trackData = null;
  let chaseCamera = null;
  let aiRacers = [];
  let opponentCar = null;

  // Particles
  let driftSmoke = null;
  let boostFlame = null;
  let sparksPS = null;
  let exhaustSmoke = null;

  // Race tracking
  let raceTime = 0;
  let playerLap = 1;
  let totalLaps = 3;
  let playerCheckpoint = 0;
  let playerCheckpointSeq = [];
  let cleanLapsCount = 0;
  let lapStartTime = 0;
  let lapTimes = [];
  let raceFinished = false;
  let wasDrifting = false;
  let wasBoosting = false;
  var _offRoadSoundCd = 0;
  let countdownTimer = 0;
  let countdownNumber = 3;

  // ─── Babylon.js Setup ─────────────────────────────────────────────
  const canvas = document.getElementById('renderCanvas');
  const skylineBg = document.getElementById('skylineBg');
  const engine = new BABYLON.Engine(canvas, true, {
    adaptToDeviceRatio: true,
    antialias: false,
    powerPreference: 'high-performance',
    premultipliedAlpha: false,
    alpha: true,
  });
  engine.setHardwareScalingLevel(1 / (window.devicePixelRatio > 2 ? 2 : window.devicePixelRatio));

  // Lock to landscape on mobile
  try { screen.orientation?.lock('landscape').catch(function() {}); } catch (_) {}

  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 0); // transparent — shows HTML SVG skyline behind

  // Performance optimizations
  scene.autoClear = true; // needed for transparent background (HTML skyline shows through)
  scene.autoClearDepthAndStencil = true;
  scene.blockMaterialDirtyMechanism = true;
  scene.skipPointerMovePicking = false; // MUST be false for GUI buttons to work

  const isLowEnd = navigator.hardwareConcurrency <= 2;
  if (!isLowEnd) {
    try {
      const pipeline = new BABYLON.DefaultRenderingPipeline('pipeline', true, scene);
      pipeline.fxaaEnabled = true;
    } catch (_) { /* FXAA not critical */ }
    // Glow layer — makes neon strips, headlights, taillights bloom
    try {
      const gl = new BABYLON.GlowLayer('glow', scene, { blurKernelSize: 32 });
      gl.intensity = 0.4;
    } catch (_) { /* Glow not critical */ }
  }

  // ─── Modules ──────────────────────────────────────────────────────
  const gui = new DL.GUIManager(scene);
  chaseCamera = new DL.ChaseCamera(scene);
  scene.activeCamera = chaseCamera.camera;

  // CRITICAL: Force pointer picking ON after GUI creation
  // CreateFullscreenUI or other init may reset these to true
  scene.skipPointerMovePicking = false;
  scene.skipPointerDownPicking = false;
  scene.skipPointerUpPicking = false;

  // Pre-warm multiplayer
  DL.Multiplayer.warmUp();

  // ─── Auth Integration ─────────────────────────────────────────────
  let authAttempts = 0;
  const authCheck = setInterval(() => {
    authAttempts++;
    if (window.authManager?.isInitialized) {
      clearInterval(authCheck);
      window.authManager.onAuthStateChanged(user => {
        currentUser = user;
        if (user) _loadProgress();
      });
    } else if (authAttempts > 100) {
      // Stop polling after 10 seconds — auth not available
      clearInterval(authCheck);
    }
  }, 100);

  // Header integration
  try {
    window.gameHeader?.init({
      title: 'Drift Legends',
      icon: '\ud83c\udfce\ufe0f',
      gameId: 'drift-legends',
      buttons: ['sound', 'leaderboard', 'auth'],
      onSound: () => {
        const muted = DL.Audio.toggle();
        return !muted;
      },
      onSignIn: async (user) => {
        currentUser = user;
        await _loadProgress();
      },
      onSignOut: () => {
        currentUser = null;
      },
    });
  } catch (_) { /* header not available */ }

  // ─── Progress Management ──────────────────────────────────────────
  async function _loadProgress() {
    const local = DL.StoryMode.loadLocalProgress();
    let cloud = null;
    if (currentUser) {
      cloud = await DL.StoryMode.loadCloudProgress();
    }
    progress = DL.StoryMode.mergeProgress(local, cloud);
    DL.StoryMode.saveLocalProgress(progress);
    _updateMenuUI();
  }

  async function _saveProgress() {
    DL.StoryMode.saveLocalProgress(progress);
    if (currentUser) {
      await DL.StoryMode.saveCloudProgress(progress);
    }
  }

  function _updateMenuUI() {
    if (!progress) return;
    gui.updateMenuCompletion(DL.StoryMode.getCompletionPercent(progress), progress);
  }

  // ─── GUI Callbacks ────────────────────────────────────────────────
  gui.onAction('click', () => DL.Audio.play('click'));

  gui.onAction('storyMode', () => {
    gui.updateChapterCards(DL.StoryMode.CHAPTERS, progress);
    gui.show('STORY_SELECT');
    state = STATE.STORY_SELECT;
  });

  gui.onAction('multiplayer', () => {
    if (!currentUser) {
      try { window.authNudge?.show(); } catch (_) {}
      return;
    }
    gui.show('MP_MENU');
    state = STATE.MP_MENU;
  });

  gui.onAction('settings', () => {
    gui.show('SETTINGS');
    state = STATE.SETTINGS;
  });

  gui.onAction('selectChapter', (data) => {
    const ch = DL.StoryMode.CHAPTERS[data.chapterIndex];
    if (!ch || !DL.StoryMode.isChapterUnlocked(progress, ch.id)) return;
    selectedChapter = ch;
    selectedRaceIndex = 0;
    // Find first incomplete race in chapter, or default to first
    for (let i = 0; i < ch.races.length; i++) {
      const r = progress.raceResults[ch.races[i]];
      if (!r || !r.completed) { selectedRaceIndex = i; break; }
    }
    gui.updateCarSelectCards(progress);
    gui.show('CAR_SELECT');
    state = STATE.CAR_SELECT;
  });

  gui.onAction('selectCar', (data) => {
    const status = DL.StoryMode.isCarUnlockable(progress, data.carId);
    if (status === 'locked') return;
    if (status === 'available') {
      const bought = DL.StoryMode.unlockCar(progress, data.carId);
      if (!bought) return;
      DL.Audio.play('unlock');
      _saveProgress();
      gui.updateCarSelectCards(progress);
    }
    selectedCarId = data.carId;
    isMultiplayerRace = false;
    selectedTrackId = selectedChapter.races[selectedRaceIndex];
    const track = DL.TrackBuilder.TRACKS[selectedTrackId];
    var goals = DL.StoryMode.getGoalsForRace(selectedChapter.id, selectedTrackId);
    gui.showPreRace(
      track?.name || selectedTrackId,
      selectedChapter.rival.name,
      selectedChapter.rival.preRaceLine,
      goals
    );
    state = STATE.PRE_RACE;
  });

  gui.onAction('startRace', () => {
    _startLoading();
  });

  gui.onAction('resultNext', () => {
    // Only advance if the current race was completed (won)
    var currentResult = progress?.raceResults?.[selectedTrackId];
    if (!currentResult || !currentResult.completed) {
      // Didn't win — retry the same race
      _startLoading();
      return;
    }
    // Advance to next race or chapter
    if (selectedChapter) {
      selectedRaceIndex++;
      if (selectedRaceIndex >= selectedChapter.races.length) {
        // Chapter complete -- check next chapter unlock
        const nextCh = DL.StoryMode.CHAPTERS.find(c => c.id === selectedChapter.id + 1);
        if (nextCh && DL.StoryMode.isChapterUnlocked(progress, nextCh.id)) {
          if (!progress.chaptersUnlocked.includes(nextCh.id)) {
            progress.chaptersUnlocked.push(nextCh.id);
            _saveProgress();
          }
        }
        gui.updateChapterCards(DL.StoryMode.CHAPTERS, progress);
        gui.show('STORY_SELECT');
        state = STATE.STORY_SELECT;
      } else {
        selectedTrackId = selectedChapter.races[selectedRaceIndex];
        const track = DL.TrackBuilder.TRACKS[selectedTrackId];
        var nextGoals = DL.StoryMode.getGoalsForRace(selectedChapter.id, selectedTrackId);
        gui.showPreRace(
          track?.name || selectedTrackId,
          selectedChapter.rival.name,
          selectedChapter.rival.preRaceLine,
          nextGoals
        );
        state = STATE.PRE_RACE;
      }
    } else {
      gui.show('MENU');
      state = STATE.MENU;
    }
  });

  gui.onAction('resultRetry', () => {
    // Re-enable mesh picking before rebuilding race
    scene.meshes.forEach(function(m) { m.isPickable = true; });
    _startLoading();
  });

  gui.onAction('resultMenu', () => {
    _cleanupRace();
    // Re-enable mesh picking for menu
    scene.meshes.forEach(function(m) { m.isPickable = true; });
    // Restore HTML skyline and transparent scene
    if (skylineBg) skylineBg.style.display = '';
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
    gui.show('MENU');
    state = STATE.MENU;
    _updateMenuUI();
  });

  gui.onAction('volumeChange', (val) => {
    DL.Audio.setVolume(val);
  });

  // Pause button (HUD touch button)
  gui.onAction('pauseClick', () => {
    if (state === STATE.RACING || state === STATE.COUNTDOWN || state === STATE.CINEMATIC_INTRO) {
      state = STATE.PAUSED;
      DL.Audio.stopEngine();
      scene.meshes.forEach(function(m) { m.isPickable = false; });
      gui.showPause();
    }
  });

  // Pause menu callbacks
  function _resumeFromPause() {
    gui.hidePause();
    scene.meshes.forEach(function(m) { m.isPickable = true; });
    DL.Audio.startEngine();
    DL.Audio.resumeBGM();
    state = STATE.RACING;
  }

  gui.onAction('pauseResume', () => { _resumeFromPause(); });

  gui.onAction('pauseRestart', () => {
    gui.hidePause();
    scene.meshes.forEach(function(m) { m.isPickable = true; });
    _startLoading();
  });

  gui.onAction('pauseQuit', () => {
    gui.hidePause();
    _cleanupRace();
    scene.meshes.forEach(function(m) { m.isPickable = true; });
    if (skylineBg) skylineBg.style.display = '';
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
    gui.show('MENU');
    state = STATE.MENU;
    _updateMenuUI();
  });

  // Multiplayer callbacks
  gui.onAction('mpQuickMatch', () => {
    if (!currentUser) { try { window.authNudge?.show(); } catch (_) {} return; }
    DL.Multiplayer.quickMatch(currentUser.uid);
  });

  gui.onAction('mpCreatePrivate', async () => {
    if (!currentUser) { try { window.authNudge?.show(); } catch (_) {} return; }
    const session = await DL.Multiplayer.createPrivateRoom(currentUser.uid);
    if (session) {
      gui.mpStatusText.text = 'Room code: ' + (session.joinCode || 'N/A');
    }
  });

  gui.onAction('mpJoinCode', () => {
    // For now, check deep link
    const code = DL.Multiplayer.checkDeepLink();
    if (code) DL.Multiplayer.joinByCode(code);
  });

  // ─── Race Loading & Setup ─────────────────────────────────────────
  function _startLoading() {
    // Re-enable mesh picking (may have been disabled by result/pause overlay)
    scene.meshes.forEach(function(m) { m.isPickable = true; });
    const track = DL.TrackBuilder.TRACKS[selectedTrackId];
    gui.showLoading(track?.name || 'Track');
    state = STATE.LOADING;

    // Use setTimeout to let UI render before heavy work
    setTimeout(() => _buildRace(), 50);
  }

  function _buildRace() {
    _cleanupRace();

    // Hide HTML skyline, make scene opaque for 3D racing
    if (skylineBg) skylineBg.style.display = 'none';
    var mtnBg = document.getElementById('storyMtnBg');
    if (mtnBg) mtnBg.style.display = 'none';
    scene.clearColor = new BABYLON.Color4(0.05, 0.05, 0.1, 1);
    scene.autoClear = true;

    // Build track
    trackData = DL.TrackBuilder.buildTrack(scene, selectedTrackId);
    if (!trackData) {
      gui.show('MENU');
      state = STATE.MENU;
      return;
    }

    totalLaps = trackData.trackDef.laps || 3;

    // Build player car
    playerCar = DL.CarBuilder.buildCar(scene, selectedCarId);
    const startPos = trackData.startPosition.clone();
    const startRot = trackData.startRotation;
    playerCar.position = startPos;
    playerCar.rotation.y = startRot;
    playerPhysics = new DL.Physics.ArcadeVehicle(playerCar, selectedCarId);

    // Camera — ensure chase camera is active (may be ArcRotateCamera from menu/garage)
    scene.activeCamera = chaseCamera.camera;
    chaseCamera.setTarget(playerCar);

    // Dispose ALL menu/garage preview objects
    if (gui._menuCar) { gui._menuCar.dispose(false, true); gui._menuCar = null; }
    if (gui._garageCar) { gui._garageCar.dispose(false, true); gui._garageCar = null; }
    // Disable menu lights
    if (gui._menuCarLight) gui._menuCarLight.setEnabled(false);
    if (gui._menuCarFill) gui._menuCarFill.setEnabled(false);
    if (gui._menuCarRim) gui._menuCarRim.setEnabled(false);
    if (gui._menuCarHemi) gui._menuCarHemi.setEnabled(false);
    // Disable garage lights
    if (gui._garageKeyLight) gui._garageKeyLight.setEnabled(false);
    if (gui._garageFillLight) gui._garageFillLight.setEnabled(false);
    if (gui._garageHemi) gui._garageHemi.setEnabled(false);
    // Force chase camera — remove any ArcRotateCamera from scene
    scene.activeCamera = chaseCamera.camera;

    // Particles
    driftSmoke = DL.Particles.createDriftSmoke(scene);
    driftSmoke.emitter = playerCar;
    boostFlame = DL.Particles.createBoostFlame(scene);
    boostFlame.emitter = playerCar;
    sparksPS = DL.Particles.createSparks(scene);
    exhaustSmoke = DL.Particles.createExhaustSmoke(scene);
    exhaustSmoke.emitter = playerCar;
    DL.Particles.createTireMarkPool(scene);

    // City ambient light motes (non-low-end only)
    if (trackData.trackDef.environment === 'city' && !isLowEnd) {
      DL.Particles.createCityAmbient(scene, trackData.startPosition);
    }

    // AI racers (story mode) or opponent car (multiplayer)
    if (!isMultiplayerRace && selectedChapter) {
      const rival = DL.AIRacer.createRivalRacer(scene, selectedChapter, trackData);
      const fillers = DL.AIRacer.createFillerRacers(scene, selectedChapter, trackData, 2);
      aiRacers = [rival, ...fillers];
      DL.AIRacer.positionAtStart(aiRacers, startPos, startRot, trackData.trackDef.trackWidth);
    } else if (isMultiplayerRace) {
      // Build opponent car for multiplayer
      opponentCar = DL.CarBuilder.buildAICar ? DL.CarBuilder.buildAICar(scene, 0) : DL.CarBuilder.buildCar(scene, 'street-kart');
      opponentCar.position = startPos.clone();
      opponentCar.position.x += trackData.trackDef.trackWidth * 0.8;
      opponentCar.rotation.y = startRot;
      // Start multiplayer position sync
      DL.Multiplayer.startSync(playerCar);
    }

    // Reset race state
    raceTime = 0;
    playerLap = 1;
    playerCheckpoint = 0;
    playerCheckpointSeq = [];
    cleanLapsCount = 0;
    lapStartTime = 0;
    lapTimes = [];
    raceFinished = false;
    wasDrifting = false;
    wasBoosting = false;
    playerPhysics.totalDriftScore = 0;

    // Gather all car meshes for cinematic intro
    var allCarMeshes = [playerCar];
    aiRacers.forEach(function(ai) { if (ai.mesh) allCarMeshes.push(ai.mesh); });
    if (isMultiplayerRace && opponentCar) allCarMeshes.push(opponentCar);

    // Start cinematic intro (camera sweeps over all cars, then locks to player)
    gui.hideAll();
    var introGoals = selectedChapter ? DL.StoryMode.getGoalsForRace(selectedChapter.id, selectedTrackId) : [];
    gui.showTrackIntro(selectedTrackId, selectedChapter ? selectedChapter.name : 'Race', introGoals);
    // Set HUD goal reminder
    if (gui.hud && gui.hud.goalReminder && introGoals && introGoals.length) {
      gui.hud.goalReminder.text = 'GOAL: ' + introGoals.map(function(g) { return g.label; }).join(' | ');
    }
    scene.activeCamera = chaseCamera.camera; // ensure chase cam before cinematic
    chaseCamera.setTarget(playerCar);
    chaseCamera.startCinematicIntro(allCarMeshes, trackData, 5, function() {
      // Cinematic done → snap camera behind player → start countdown
      gui.hideTrackIntro();
      scene.activeCamera = chaseCamera.camera;
      chaseCamera.setTarget(playerCar);
      // Force camera position behind car immediately
      chaseCamera.camera.position = playerCar.position.add(
        new BABYLON.Vector3(-Math.sin(playerCar.rotation.y) * 8, 3.5, -Math.cos(playerCar.rotation.y) * 8)
      );
      chaseCamera.camera.setTarget(playerCar.position.add(new BABYLON.Vector3(0, 1, 0)));
      countdownTimer = 0;
      countdownNumber = 3;
      gui.showCountdown(3);
      DL.Audio.play('countdown');
      DL.Audio.startEngine();
      DL.Audio.startBGM(trackData.trackDef.environment);
      gui.showTouchControls(DL.Input.isMobile());
      state = STATE.COUNTDOWN;
    });

    // Freeze static meshes for performance (buildings, ground, walls don't move)
    scene.blockMaterialDirtyMechanism = false;
    scene.render(); // force one render to compile materials
    scene.blockMaterialDirtyMechanism = true;

    state = STATE.CINEMATIC_INTRO;

    // Activate tutorial on first race if not completed
    if (!progress || !progress.tutorialComplete) {
      tutorialStep = 0;
      tutorialTimer = 0;
    } else {
      tutorialStep = -1;
    }
  }

  function _cleanupRace() {
    // Dispose existing meshes
    if (playerCar) { playerCar.dispose(false, true); playerCar = null; }
    if (opponentCar) { opponentCar.dispose(false, true); opponentCar = null; }
    aiRacers.forEach(r => { if (r.mesh) r.mesh.dispose(false, true); });
    aiRacers = [];
    if (trackData) {
      trackData.meshes.forEach(m => { if (m && !m.isDisposed()) m.dispose(); });
      trackData = null;
    }
    if (driftSmoke) { driftSmoke.dispose(); driftSmoke = null; }
    if (boostFlame) { boostFlame.dispose(); boostFlame = null; }
    if (sparksPS) { sparksPS.dispose(); sparksPS = null; }
    if (exhaustSmoke) { exhaustSmoke.dispose(); exhaustSmoke = null; }

    playerPhysics = null;
    gui.showTouchControls(false);
    DL.Audio.stopEngine();
    DL.Audio.stopBGM();
  }

  // ─── Tutorial System ──────────────────────────────────────────────
  var tutorialStep = -1; // -1 = inactive
  var tutorialTimer = 0;
  var TUTORIAL_STEPS = [
    { text: 'HOLD W OR TAP TO ACCELERATE', hint: 'Build up speed to start racing', trigger: 'start', delay: 1 },
    { text: 'STEER WITH A/D OR SWIPE', hint: 'Turn left and right to follow the road', trigger: 'speed10', delay: 0 },
    { text: 'HOLD SPACE FOR HANDBRAKE', hint: 'Slow down and slide into corners', trigger: 'speed20', delay: 3 },
    { text: 'DRIFT FILLS YOUR BOOST METER', hint: 'Hold handbrake + steer to build boost', trigger: 'drifting', delay: 0 },
    { text: 'RELEASE SPACE FOR BOOST!', hint: 'Let go of handbrake when meter is high', trigger: 'driftMeter30', delay: 0 },
    { text: 'HIT YELLOW PADS FOR NITRO', hint: 'Drive over the yellow strips on the track', trigger: 'checkpoint1', delay: 2 },
    { text: 'PASS THROUGH CHECKPOINT ARCHES', hint: 'Complete all checkpoints to finish a lap', trigger: 'checkpoint2', delay: 0 },
    { text: 'COMPLETE THE RACE TO ADVANCE', hint: 'Win 1st place and complete all goals', trigger: 'lap2', delay: 2 },
  ];

  function _checkTutorialTrigger() {
    if (tutorialStep < 0 || tutorialStep >= TUTORIAL_STEPS.length) return;
    var step = TUTORIAL_STEPS[tutorialStep];
    var triggered = false;
    switch (step.trigger) {
      case 'start': triggered = (raceTime > 0.5); break;
      case 'speed10': triggered = (playerPhysics && playerPhysics.speed > 10); break;
      case 'speed20': triggered = (playerPhysics && playerPhysics.speed > 20); break;
      case 'drifting': triggered = (playerPhysics && playerPhysics.isDrifting); break;
      case 'driftMeter30': triggered = (playerPhysics && playerPhysics.driftMeter > 0.3); break;
      case 'checkpoint1': triggered = (playerCheckpoint >= 1); break;
      case 'checkpoint2': triggered = (playerCheckpoint >= 2); break;
      case 'lap2': triggered = (playerLap >= 2); break;
      default: triggered = true;
    }
    if (triggered) {
      tutorialTimer += engine.getDeltaTime() / 1000;
      if (tutorialTimer > (step.delay || 0)) {
        gui.showTutorialStep(step.text, step.hint);
        // Auto-advance after 4 seconds
        setTimeout(function() {
          tutorialStep++;
          tutorialTimer = 0;
          if (tutorialStep >= TUTORIAL_STEPS.length) {
            gui.hideTutorial();
            if (progress) { progress.tutorialComplete = true; _saveProgress(); }
          }
        }, 4000);
      }
    }
  }

  gui.onAction('tutorialSkip', () => {
    tutorialStep = TUTORIAL_STEPS.length; // skip all
    gui.hideTutorial();
    if (progress) { progress.tutorialComplete = true; _saveProgress(); }
  });

  // ─── Game Loop ────────────────────────────────────────────────────
  scene.registerBeforeRender(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.05); // cap at 50ms to prevent physics explosions

    // Input
    DL.Input.update(dt);

    // Mute toggle
    if (DL.Input.consumeMute()) {
      DL.Audio.toggle();
    }

    // ESC/P = pause (only during racing states)
    if (DL.Input.consumePause()) {
      if (state === STATE.RACING || state === STATE.COUNTDOWN || state === STATE.CINEMATIC_INTRO) {
        state = STATE.PAUSED;
        DL.Audio.stopEngine();
        DL.Audio.pauseBGM();
        // Disable 3D mesh picking so pause buttons receive clicks
        scene.meshes.forEach(function(m) { m.isPickable = false; });
        gui.showPause();
        return; // skip frame
      } else if (state === STATE.PAUSED) {
        _resumeFromPause();
      }
    }

    // When paused — still render scene (for GUI) but skip game logic
    if (state === STATE.PAUSED) {
      // Allow scene to render so GUI buttons work, but skip game update
      return;
    }

    switch (state) {
      case STATE.CINEMATIC_INTRO:
        chaseCamera.updateCinematic(dt);
        // AI cars still animate during intro
        aiRacers.forEach(function(ai) {
          DL.CarBuilder.updateWheels(ai.mesh, 5, dt);
        });
        DL.CarBuilder.updateWheels(playerCar, 0, dt);
        break;

      case STATE.COUNTDOWN:
        _updateCountdown(dt);
        chaseCamera.update(dt, false);
        break;

      case STATE.RACING:
        _updateRacing(dt);
        if (tutorialStep >= 0) _checkTutorialTrigger();
        break;

      case STATE.MENU:
      case STATE.STORY_SELECT:
      case STATE.CAR_SELECT:
      case STATE.PRE_RACE:
      case STATE.RESULT:
      case STATE.MP_MENU:
      case STATE.SETTINGS:
        // Idle scene -- just rotate camera slowly if no car
        break;
    }
  });

  function _updateCountdown(dt) {
    countdownTimer += dt;
    const newNumber = 3 - Math.floor(countdownTimer);
    if (newNumber !== countdownNumber && newNumber >= 0) {
      countdownNumber = newNumber;
      gui.showCountdown(countdownNumber);
      DL.Audio.play(countdownNumber === 0 ? 'go' : 'countdown');
    }
    if (countdownTimer >= 4) {
      gui.hideAll();
      gui.show('RACE_HUD');
      // Force camera to chase mode
      scene.activeCamera = chaseCamera.camera;
      chaseCamera.setTarget(playerCar);
      state = STATE.RACING;
      lapStartTime = 0;
    }
  }

  function _updateRacing(dt) {
    if (raceFinished) return;
    raceTime += dt;

    const input = DL.Input.state;

    // Update player physics
    playerPhysics.update(dt, input, null);

    // Off-road detection — speed penalty instead of wall bounce
    if (trackData && trackData.splinePoints) {
      var onTrack = DL.TrackBuilder.isOnTrack(
        trackData.splinePoints,
        trackData.trackDef.trackWidth,
        playerCar.position
      );
      var onTrackWide = DL.TrackBuilder.isOnTrack(
        trackData.splinePoints,
        trackData.trackDef.trackWidth * 2,
        playerCar.position
      );
      if (!onTrack) {
        // Off-road: friction slowdown + rumble sound
        playerPhysics.velocity.scaleInPlace(0.96);
        playerPhysics.speed = playerPhysics.velocity.length();
        if (!_offRoadSoundCd) _offRoadSoundCd = 0;
        if (raceTime > _offRoadSoundCd) {
          DL.Audio.play('offroad');
          _offRoadSoundCd = raceTime + 0.5; // cooldown
        }
      }
      if (!onTrackWide) {
        // Way off track: counts as dirty lap (minor off-road is OK)
        playerPhysics.wallHitThisLap = true;
      }

      // Car-to-car collision detection (player vs AI racers)
      var CAR_COLLISION_RADIUS = 2.5;
      aiRacers.forEach(function(ai) {
        if (!ai.mesh) return;
        var dist = V3.Distance(playerCar.position, ai.mesh.position);
        if (dist < CAR_COLLISION_RADIUS && playerPhysics.collisionCooldown <= 0) {
          // Push both cars apart
          var pushDir = playerCar.position.subtract(ai.mesh.position).normalize();
          pushDir.y = 0;
          playerPhysics.velocity.addInPlace(pushDir.scale(8));
          playerPhysics.speed = playerPhysics.velocity.length();
          playerPhysics.collisionCooldown = 0.5;
          playerPhysics.wallHitThisLap = true;
          // Push AI away too
          ai.mesh.position.subtractInPlace(pushDir.scale(1.5));
          // Effects
          if (!prefersReducedMotion) chaseCamera.shake(0.15);
          DL.Audio.play('collision');
          DL.Particles.burstSparks(sparksPS, playerCar.position, 10);
        }
      });

      // Multiplayer opponent collision
      if (isMultiplayerRace && opponentCar) {
        var oppDist = V3.Distance(playerCar.position, opponentCar.position);
        if (oppDist < CAR_COLLISION_RADIUS && playerPhysics.collisionCooldown <= 0) {
          var oppPushDir = playerCar.position.subtract(opponentCar.position).normalize();
          oppPushDir.y = 0;
          playerPhysics.velocity.addInPlace(oppPushDir.scale(6));
          playerPhysics.speed = playerPhysics.velocity.length();
          playerPhysics.collisionCooldown = 0.5;
          if (!prefersReducedMotion) chaseCamera.shake(0.15);
          DL.Audio.play('collision');
          DL.Particles.burstSparks(sparksPS, playerCar.position, 10);
        }
      }

      // Nitro pad detection
      trackData.nitroPositions.forEach(np => {
        if (V3.Distance(playerCar.position, np.position) < 4) {
          if (playerPhysics.nitroPadTimer <= 0) {
            playerPhysics.applyNitroPad();
            DL.Audio.play('nitro');
          }
        }
      });

      // Checkpoint detection
      _updateCheckpoints();
    }

    // Wheel animation
    DL.CarBuilder.updateWheels(playerCar, playerPhysics.speed, dt);

    // Particle effects (suppressed if user prefers reduced motion)
    if (!prefersReducedMotion) {
      if (driftSmoke) driftSmoke.emitRate = playerPhysics.isDrifting ? 40 : 0;
      if (boostFlame) boostFlame.emitRate = playerPhysics.isBoosting ? 60 : 0;
      // Exhaust puffs when accelerating
      if (exhaustSmoke) exhaustSmoke.emitRate = (input.accelerate && playerPhysics.speed > 5) ? 8 : 0;
      // Tire marks on road when drifting
      if (playerPhysics.isDrifting && playerPhysics.speed > 10) {
        DL.Particles.placeTireMark(playerCar.position, playerCar.rotation.y);
      }
    }

    // Brake lights — make tail lights brighter when braking
    if (playerCar._brakeLights) {
      var braking = input.brake && playerPhysics.speed > 2;
      playerCar._brakeLights.forEach(function(bl) {
        bl.material.emissiveColor.r = braking ? 1.0 : 0.4;
      });
    }

    // Drift audio — only trigger on state transition, not every frame
    if (playerPhysics.isDrifting && !wasDrifting) {
      DL.Audio.play('handbrake');
      DL.Audio.play('drift');
    }
    wasDrifting = playerPhysics.isDrifting;

    // Boost trigger audio — only on state transition
    if (playerPhysics.isBoosting && !wasBoosting) DL.Audio.play('boost');
    wasBoosting = playerPhysics.isBoosting;

    // Engine audio
    DL.Audio.updateEngineSound(playerPhysics.speed, playerPhysics.config.topSpeed);

    // Camera
    chaseCamera.update(dt, playerPhysics.isBoosting);

    // AI racers
    aiRacers.forEach(ai => {
      ai.update(dt, trackData, playerCar.position, playerLap, raceTime);
      DL.CarBuilder.updateWheels(ai.mesh, ai.speed, dt);
    });

    // Multiplayer opponent rendering
    if (isMultiplayerRace) {
      const oppPos = DL.Multiplayer.getOpponentPosition();
      if (oppPos && opponentCar) {
        opponentCar.position.x = oppPos.x;
        opponentCar.position.z = oppPos.z;
        opponentCar.position.y = 0;
        opponentCar.rotation.y = oppPos.rotY;
      }
    }

    // Calculate race position
    // Calculate accurate position on track using closest spline point
    var closestT = 0;
    if (trackData && trackData.splinePoints) {
      var closest = DL.TrackBuilder.getClosestPointOnTrack(trackData.splinePoints, playerCar.position);
      closestT = closest.t;
    }
    const playerT = (playerLap - 1) + closestT;
    const positions = DL.AIRacer.getRacePositions(playerT, aiRacers);
    const playerPos = positions.findIndex(p => p.id === 'player') + 1;

    // Update HUD
    gui.updateHUD({
      position: playerPos,
      lap: playerLap,
      totalLaps,
      speed: playerPhysics.getDisplaySpeed(),
      driftMeter: playerPhysics.driftMeter,
      isDrifting: playerPhysics.isDrifting,
      driftScoreActive: Math.round(playerPhysics.driftScore),
      driftScoreTotal: Math.round(playerPhysics.totalDriftScore),
      driftCombo: playerPhysics.driftCombo,
      isBoosting: playerPhysics.isBoosting,
      raceTime,
    });
  }

  function _updateCheckpoints() {
    if (!trackData) return;
    const checkpoints = trackData.checkpointPositions;

    for (let i = playerCheckpoint; i < checkpoints.length; i++) {
      const cp = checkpoints[i];
      const dist = V3.Distance(playerCar.position, cp.position);
      if (dist < trackData.trackDef.trackWidth * 1.5) {
        playerCheckpoint = i + 1;
        playerCheckpointSeq.push(i);
        // Visual + audio feedback
        DL.Audio.play('checkpoint');
        if (!prefersReducedMotion) chaseCamera.shake(0.08);
        // Flash the checkpoint arch (briefly brighten then fade)
        if (trackData._cpMeshes && trackData._cpMeshes[i]) {
          var cpMesh = trackData._cpMeshes[i];
          cpMesh.visibility = 0.8;
          setTimeout(function() { if (cpMesh && !cpMesh.isDisposed()) cpMesh.visibility = 0; }, 300);
        }
        break;
      }
    }

    // Check lap completion (passed all checkpoints, near start, minimum lap time)
    if (playerCheckpoint >= checkpoints.length) {
      const distToStart = V3.Distance(playerCar.position, trackData.startPosition);
      const lapElapsed = raceTime - lapStartTime;
      // Minimum 20 seconds per lap to prevent exploit
      if (distToStart < trackData.trackDef.trackWidth * 2.5 && lapElapsed > 15) {
        _completeLap();
      }
    }
  }

  // Screen reader announcements
  function _announce(msg) {
    var el = document.getElementById('dl-announcer');
    if (el) { el.textContent = ''; requestAnimationFrame(function() { el.textContent = msg; }); }
  }

  function _completeLap() {
    const lapTimeMs = (raceTime - lapStartTime) * 1000;
    _announce('Lap ' + (playerLap + 1) + ' of ' + totalLaps);
    lapTimes.push(lapTimeMs);
    DL.Audio.play('lap');

    if (!playerPhysics.wallHitThisLap) cleanLapsCount++;
    playerPhysics.resetLapCollision();

    if (isMultiplayerRace) {
      DL.Multiplayer.sendLapComplete(lapTimeMs, playerLap, playerCheckpointSeq);
    }

    playerCheckpoint = 0;
    playerCheckpointSeq = [];
    lapStartTime = raceTime;
    playerLap++;

    if (playerLap > totalLaps) {
      _finishRace();
    }
  }

  function _finishRace() {
    raceFinished = true;
    state = STATE.RACE_FINISH;
    DL.Audio.stopEngine();
    DL.Audio.stopBGM();
    gui.hideTutorial();
    tutorialStep = -1;

    // Calculate results
    const playerT = totalLaps + 1;
    const positions = DL.AIRacer.getRacePositions(playerT, aiRacers);
    const playerPosition = positions.findIndex(p => p.id === 'player') + 1;
    const won = playerPosition === 1;

    DL.Audio.play(won ? 'win' : 'lose');
    _announce(won ? 'Victory! You finished 1st!' : 'Race finished. Position: ' + playerPosition);

    const driftScoreTotal = playerPhysics.totalDriftScore;
    const raceScore = DL.StoryMode.calculateRaceScore(playerPosition, driftScoreTotal, cleanLapsCount, totalLaps);
    const stars = DL.StoryMode.calculateStars(raceScore, selectedTrackId);
    const coins = DL.StoryMode.calculateCoins(stars);
    const totalTimeMs = lapTimes.reduce((a, b) => a + b, 0);

    // Confetti on win
    if (won) {
      DL.Particles.createConfetti(scene, playerCar.position.add(new V3(0, 3, 0)));
    }

    // Check race goals
    var goals = selectedChapter ? DL.StoryMode.getGoalsForRace(selectedChapter.id, selectedTrackId) : [];
    var goalResults = DL.StoryMode.checkGoals(goals, {
      position: playerPosition,
      stars: stars,
      driftScore: driftScoreTotal,
      cleanLaps: cleanLapsCount,
      totalLaps: totalLaps,
    });
    var allGoalsPassed = goalResults.every(function(g) { return g.passed; });

    // Update progress — only mark completed if ALL goals passed
    if (progress && selectedTrackId) {
      const existing = progress.raceResults[selectedTrackId] || {};
      progress.raceResults[selectedTrackId] = {
        bestStars: Math.max(existing.bestStars || 0, stars),
        bestTime: existing.bestTime ? Math.min(existing.bestTime, totalTimeMs) : totalTimeMs,
        completed: existing.completed || allGoalsPassed,
        attempts: (existing.attempts || 0) + 1,
      };
      progress.coins += coins;
      progress.totalDriftScore += driftScoreTotal;

      // Chapter completion bonus coins (granted on final race win)
      if (selectedChapter && selectedRaceIndex === selectedChapter.races.length - 1 && won) {
        var chapterBonus = selectedChapter.reward && selectedChapter.reward.coins ? selectedChapter.reward.coins : 0;
        if (chapterBonus > 0 && !progress.chapterBonusClaimed) progress.chapterBonusClaimed = {};
        if (chapterBonus > 0 && !progress.chapterBonusClaimed[selectedChapter.id]) {
          progress.coins += chapterBonus;
          progress.chapterBonusClaimed[selectedChapter.id] = true;
        }
      }

      // Check story completion
      if (selectedChapter && selectedChapter.id === 5 && selectedRaceIndex === 2 && won) {
        progress.storyComplete = true;
      }

      _saveProgress();
    }

    // Submit score to leaderboard (best time, negative so lower = better)
    if (won && currentUser && window.apiClient) {
      _submitScore(totalTimeMs, driftScoreTotal, stars);
    }

    // Check achievements
    _checkAchievements(playerPosition, stars, driftScoreTotal, cleanLapsCount);

    // Build unlock text
    let unlockText = '';
    if (selectedChapter && selectedRaceIndex === selectedChapter.races.length - 1 && won) {
      unlockText = selectedChapter.reward.unlockText || '';
      if (selectedChapter.reward.carUnlock) {
        unlockText += '\nNew car available: ' + selectedChapter.reward.carUnlock + '!';
      }
    }

    // Show result with delay for dramatic effect
    setTimeout(() => {
      chaseCamera.setResultView(playerCar.position);
      // Disable 3D mesh picking so GUI buttons receive clicks
      scene.meshes.forEach(function(m) { m.isPickable = false; });
      gui.showRaceResult({
        position: playerPosition,
        stars,
        raceScore,
        driftScore: Math.round(driftScoreTotal),
        coins,
        totalTimeMs,
        unlockText,
        goalResults: goalResults,
        allGoalsPassed: allGoalsPassed,
      });
      state = STATE.RESULT;
    }, 1500);

    // Multiplayer: send finish
    if (isMultiplayerRace) {
      DL.Multiplayer.sendRaceFinish(totalTimeMs, driftScoreTotal);
    }
  }

  async function _submitScore(totalTimeMs, driftScore, stars) {
    try {
      await window.apiClient.submitScore('drift-legends', {
        score: -totalTimeMs,
        timeMs: totalTimeMs,
        metadata: {
          trackId: selectedTrackId,
          position: 1,
          driftScore: Math.round(driftScore),
          chapter: selectedChapter?.id || 0,
          stars,
        },
      });
    } catch (err) {
      console.error('Score submit error:', err);
    }
  }

  function _checkAchievements(position, stars, driftScore, cleanLaps) {
    if (!currentUser || !window.apiClient) return;
    const unlock = (id) => {
      try { window.apiClient.unlockAchievement(id, 'drift-legends', {}); } catch (_) {}
    };

    // First finish
    unlock('dl-first-finish');

    // First win
    if (position === 1) unlock('dl-first-win');

    // Chapter completions
    if (selectedChapter) {
      if (selectedChapter.id === 1 && DL.StoryMode.isChapterComplete(progress, 1)) unlock('dl-chapter1-complete');
      if (selectedChapter.id === 3 && DL.StoryMode.isChapterComplete(progress, 3)) unlock('dl-chapter3-complete');
      if (progress.storyComplete) unlock('dl-story-complete');
    }

    // Super boost
    if (playerPhysics && playerPhysics.boostLevel === 2) unlock('dl-first-superboost');

    // Clean sweep
    if (cleanLaps === totalLaps) unlock('dl-clean-sweep');

    // Drift master
    if (progress.totalDriftScore >= 50000) unlock('dl-drift-master');

    // All cars
    if (progress.unlockedCars.length >= 3) unlock('dl-all-cars');

    // Night racer
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 6) unlock('dl-night-racer');

    // All tracks cleared
    const envsSeen = new Set();
    Object.keys(progress.raceResults).forEach(trackId => {
      const track = DL.TrackBuilder.TRACKS[trackId];
      if (track && progress.raceResults[trackId]?.completed) envsSeen.add(track.environment);
    });
    if (envsSeen.size >= 5) unlock('dl-all-tracks-cleared');

    // 3-star count check
    let threeStarCount = 0;
    Object.values(progress.raceResults).forEach(r => { if (r.bestStars === 3) threeStarCount++; });
    if (threeStarCount >= 10) unlock('dl-all-three-stars');

    // Rival beaten first try
    if (selectedChapter && selectedRaceIndex === selectedChapter.races.length - 1 && position === 1) {
      const raceResult = progress.raceResults[selectedTrackId];
      if (raceResult && raceResult.attempts === 1) unlock('dl-rival-beaten-first');
    }
  }

  // ─── Resize Handler ───────────────────────────────────────────────
  function resizeCanvas() {
    engine.resize();
  }
  window.addEventListener('resize', resizeCanvas);

  // Pause on tab blur
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === STATE.RACING) {
      // Auto-pause handled by Babylon engine automatically
    }
  });

  // Reduced motion — suppress camera shake, particles, boost FOV
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    chaseCamera.shakeIntensity = 0;
    chaseCamera.boostFOVIncrease = 0;
  }

  // ─── Start ────────────────────────────────────────────────────────
  progress = DL.StoryMode.loadLocalProgress();
  _updateMenuUI();
  gui.show('MENU');
  state = STATE.MENU;

  // Ensure pointer picking is enabled for GUI (Babylon.js may reset this)
  scene.skipPointerMovePicking = false;
  scene.skipPointerDownPicking = false;
  scene.skipPointerUpPicking = false;

  // Start render loop
  engine.runRenderLoop(() => scene.render());

  // Check deep link for multiplayer
  const joinCode = DL.Multiplayer.checkDeepLink();
  if (joinCode) {
    const waitAuth = setInterval(() => {
      if (currentUser) {
        clearInterval(waitAuth);
        DL.Multiplayer.joinByCode(joinCode);
      }
    }, 500);
  }

  // Debug access removed for production — do not expose engine/scene
})();
