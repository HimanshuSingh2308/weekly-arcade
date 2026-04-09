'use strict';
/**
 * Drift Legends -- Main Game Entry Point
 * Babylon.js Engine/Scene setup, game state machine, game loop, auth integration.
 */
(function () {
  // Add _gui placeholder before sealing (multiplayer module needs it for error toasts)
  if (window.DriftLegends) {
    window.DriftLegends._gui = null;
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
  let _mpFinishDriftScore = 0; // Saved at finish for MP result screen
  let playerSplineT = 0; // last known spline position (0-1), for windowed search
  var _lastSplineT = 0;  // previous frame's splineT, for lap crossing detection
  let wasDrifting = false;
  let wasBoosting = false;
  var _offRoadSoundCd = 0;
  // Checkpoint miss tracking
  var _cpMissTimer = 0;       // time since checkpoint miss detected
  var _cpMissWarning = false;  // warning shown
  var _cpResetActive = false;  // reset in progress
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

  // Fullscreen + orientation — different strategies for Android vs iOS
  var _isFullscreen = false;
  var _isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function _checkFullscreen() {
    _isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
  }
  document.addEventListener('fullscreenchange', _checkFullscreen);
  document.addEventListener('webkitfullscreenchange', _checkFullscreen);

  function _requestFullscreen() {
    if (_isFullscreen) return;
    if (!DL.Input.isMobile()) return;

    if (_isIOS) {
      // iOS: No Fullscreen API in Safari. In PWA standalone mode, already fullscreen.
      // In Safari: scroll to hide toolbar + set viewport-fit=cover for edge-to-edge.
      var vp = document.querySelector('meta[name="viewport"]');
      if (vp) vp.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
      window.scrollTo(0, 1);
      // Re-scroll after a tick (Safari sometimes resets scroll position)
      setTimeout(function() { window.scrollTo(0, 1); }, 100);
      // Mark as "fullscreen" if in PWA standalone mode
      if (window.navigator.standalone) _isFullscreen = true;
      return;
    } else {
      // Android/Chrome: Use standard Fullscreen API
      var el = document.documentElement;
      var rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (rfs) {
        rfs.call(el).then(function() {
          _isFullscreen = true;
          try { screen.orientation?.lock('landscape').catch(function() {}); } catch (_) {}
        }).catch(function() {});
      }
    }
  }
  canvas.addEventListener('pointerdown', _requestFullscreen);
  document.addEventListener('click', function() {
    if (!_isFullscreen && DL.Input.isMobile()) _requestFullscreen();
  });

  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 0); // transparent — shows HTML SVG skyline behind

  // Keep screen awake during gameplay
  var _wakeLock = null;
  async function _acquireWakeLock() {
    // Method 1: Screen Wake Lock API (Chrome/Android)
    if ('wakeLock' in navigator) {
      try { _wakeLock = await navigator.wakeLock.request('screen'); } catch(_) {}
    }
    // Method 2: Silent video trick for iOS (iOS won't sleep while video plays)
    if (_isIOS && !document.getElementById('dl-wake-video')) {
      var v = document.createElement('video');
      v.id = 'dl-wake-video';
      v.setAttribute('playsinline', '');
      v.setAttribute('muted', '');
      v.setAttribute('loop', '');
      v.style.cssText = 'position:fixed;top:-1px;left:-1px;width:1px;height:1px;opacity:0;pointer-events:none;';
      // Tiny silent mp4 (base64) — smallest valid video
      v.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAhtZGF0AAAA1m1vb3YAAABsbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAAAAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAACRdWR0YQAAAIltZXRhAAAAIWhkbHIAAAAAAAAAAG1kaXIAAAAAAAAAAAAAAAAAAAAAYWlscwAAABxhbG9jAAAADAAAAAwAAQABAAEAAABfaXByb3AAAABGaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAADmF2MUNGAAD/AAAAAAAAEGF1eEMAQ0H/AAAAAAAAAA==';
      document.body.appendChild(v);
      // Start on first user interaction
      canvas.addEventListener('touchstart', function() { try { v.play(); } catch(_) {} }, { once: true });
    }
  }
  function _releaseWakeLock() {
    if (_wakeLock) { try { _wakeLock.release(); } catch(_) {} _wakeLock = null; }
    var wv = document.getElementById('dl-wake-video');
    if (wv) { wv.pause(); wv.remove(); }
  }
  // Acquire on first interaction, release on visibility hidden
  canvas.addEventListener('pointerdown', function() { _acquireWakeLock(); }, { once: true });
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) _releaseWakeLock();
    else _acquireWakeLock();
  });

  // Performance optimizations
  scene.autoClear = true; // needed for transparent background (HTML skyline shows through)
  scene.autoClearDepthAndStencil = true;
  scene.blockMaterialDirtyMechanism = true;
  scene.skipPointerMovePicking = false; // MUST be false for GUI buttons to work

  const isLowEnd = navigator.hardwareConcurrency <= 2;
  // FXAA + Glow removed — caused diagonal line artifacts on transparent canvas overlay

  // ─── Modules ──────────────────────────────────────────────────────
  const gui = new DL.GUIManager(scene);
  DL._gui = gui; // expose for multiplayer error toasts
  chaseCamera = new DL.ChaseCamera(scene);
  scene.activeCamera = chaseCamera.camera;

  // CRITICAL: Force pointer picking ON after GUI creation
  // CreateFullscreenUI or other init may reset these to true
  scene.skipPointerMovePicking = false;
  scene.skipPointerDownPicking = false;
  scene.skipPointerUpPicking = false;

  // Initialize multiplayer with game callbacks
  var _isBotRace = false;
  var _botOpponentName = '';

  DL.Multiplayer.init({
    onRaceStart: function(mpState) {
      // Check if this is a bot match (no real opponent found)
      _isBotRace = !!(mpState?._botMatch);
      _botOpponentName = mpState?._botName || 'Opponent';

      isMultiplayerRace = !_isBotRace; // Bot races use SP AI, not MP sync
      selectedTrackId = mpState?.trackId || 'city-circuit';
      totalLaps = mpState?.totalLaps || 2;

      if (!_isBotRace) {
        // Real MP — save session for rejoin
        var sid = DL.Multiplayer.getSessionId();
        if (sid) localStorage.setItem(REJOIN_KEY, sid);
      }

      window.multiplayerUI?.hideMatchmaking();
      gui.hideMPJoining();
      gui.hideMPWaitingRoom();

      // Show opponent name in MP HUD
      if (_isBotRace) {
        gui.showMPHud(_botOpponentName);
      } else {
        var oppName = 'Opponent';
        gui.showMPHud(oppName);
        try {
          var sid = DL.Multiplayer.getSessionId();
          if (sid && window.multiplayerClient) {
            window.multiplayerClient.getSession(sid).then(function(session) {
              if (session?.players) {
                for (var uid in session.players) {
                  if (uid !== currentUser?.uid) {
                    oppName = session.players[uid].displayName || 'Opponent';
                    gui.showMPHud(oppName);
                    break;
                  }
                }
              }
            }).catch(function() {});
          }
        } catch (_) {}
      }

      _startLoading();
    },
    onOpponentUpdate: function(pos) {
      // Handled in render loop via DL.Multiplayer.getOpponentPosition()
      // Update opponent lap in HUD from game state
      var gs = DL.Multiplayer._gameState;
      if (gs?.laps && currentUser?.uid) {
        for (var uid in gs.laps) {
          if (uid !== currentUser.uid) {
            var oppLap = Math.min((gs.laps[uid] || 0) + 1, totalLaps);
            gui.updateMPOpponentLap(oppLap, totalLaps);
            break;
          }
        }
      }
    },
    onRaceEnd: function(results) {
      // Race ended — clear rejoin session
      localStorage.removeItem(REJOIN_KEY);

      // If we're not racing (e.g. rejoined after race ended), show result directly
      if (state !== STATE.RACING && state !== STATE.RACE_FINISH) {
        // Came from rejoin — show game over screen
        gui.hideMPJoining();
        var myResult = results?.[currentUser?.uid];
        var won = myResult?.outcome === 'win';
        var pos = myResult?.rank || (won ? 1 : 2);
        gui.showRaceResult({
          position: pos,
          stars: won ? 3 : 1,
          raceScore: 0,
          driftScore: 0,
          coins: 0,
          totalTimeMs: 0,
          unlockText: won ? 'Multiplayer Victory!' : 'Race finished while you were away.',
          goalResults: [],
          allGoalsPassed: won,
          storyComplete: false,
          totalStars: 0,
          totalCoins: 0,
          isMultiplayer: true,
          mpOutcome: myResult?.outcome || 'loss',
        });
        state = STATE.RESULT;
        isMultiplayerRace = false;
        return;
      }

      raceFinished = true;
      state = STATE.RACE_FINISH;
      DL.Audio.stopEngine();
      DL.Audio.stopBGM();
      DL.Multiplayer.stopSync();
      gui.hideMPWaiting();
      gui.hideMPHud();
      gui.hideMPDisconnect();

      var myResult = results?.[currentUser?.uid];
      var won = myResult?.outcome === 'win';
      var playerPosition = myResult?.rank || (won ? 1 : 2);
      var totalTimeMs = lapTimes.reduce(function(a, b) { return a + b; }, 0);
      var driftScore = _mpFinishDriftScore || (playerPhysics ? Math.round(playerPhysics.totalDriftScore) : 0);
      var mpStars = won ? 3 : (playerPosition <= 2 ? 2 : 1);
      var raceScore = DL.StoryMode.calculateRaceScore(playerPosition, driftScore, cleanLapsCount, totalLaps);
      var coins = DL.StoryMode.calculateCoins(mpStars);

      DL.Audio.play(won ? 'win' : 'lose');
      _announce(won ? 'Victory!' : 'Race finished. Position: ' + playerPosition);

      if (won && playerCar) {
        DL.Particles.createConfetti(scene, playerCar.position.add(new V3(0, 3, 0)));
      }

      setTimeout(function() {
        if (playerCar) chaseCamera.setResultView(playerCar.position);
        scene.meshes.forEach(function(m) { m.isPickable = false; });
        gui.showRaceResult({
          position: playerPosition,
          stars: mpStars,
          raceScore: raceScore,
          driftScore: driftScore,
          coins: coins,
          totalTimeMs: totalTimeMs,
          unlockText: won ? 'Multiplayer Victory!' : '',
          goalResults: [],
          allGoalsPassed: won,
          storyComplete: false,
          totalStars: 0,
          totalCoins: 0,
          isMultiplayer: true,
          mpOutcome: myResult?.outcome || 'loss',
        });
        state = STATE.RESULT;

        // Award coins to progress
        if (coins > 0 && progress) {
          progress.coins = (progress.coins || 0) + coins;
          _saveProgress();
        }
      }, 1500);
    },
    onDisconnect: function() {
      gui.showMPDisconnect();
    },
    onReconnect: function() {
      gui.hideMPDisconnect();
      gui.showToast?.('Reconnected!');
    },
  });
  DL.Multiplayer.warmUp();

  // ─── Auth Integration ─────────────────────────────────────────────
  let authAttempts = 0;
  var _rejoinChecked = false;
  const authCheck = setInterval(() => {
    authAttempts++;
    if (window.authManager?.isInitialized) {
      clearInterval(authCheck);
      window.authManager.onAuthStateChanged(user => {
        currentUser = user;
        // Check for rejoinable MP session once auth + token are ready
        if (user && !_rejoinChecked) {
          var _rejoinPoll = setInterval(function() {
            if (window.apiClient?.token) {
              clearInterval(_rejoinPoll);
              if (!_rejoinChecked) {
                _rejoinChecked = true;
                _checkRejoinableSession();
              }
            }
          }, 200);
          // Stop after 5s
          setTimeout(function() { clearInterval(_rejoinPoll); }, 5000);
        }
      });
    } else if (authAttempts > 100) {
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
        return !muted; // game-header auto-updates icon based on return value
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
  var _progressLoading = false;
  async function _loadProgress() {
    if (_progressLoading) return; // prevent duplicate calls
    _progressLoading = true;
    try {
      const local = DL.StoryMode.loadLocalProgress();
      let cloud = null;
      if (currentUser) {
        // Load cloud progress and server inventory in parallel (2 calls instead of sequential)
        var [cloudResult, serverInv] = await Promise.all([
          DL.StoryMode.loadCloudProgress().catch(function() { return null; }),
          DL.StoryMode.loadServerInventory().catch(function() { return null; }),
        ]);
        cloud = cloudResult;
        progress = DL.StoryMode.mergeProgress(local, cloud);
        if (serverInv) DL.StoryMode.mergeServerInventory(progress, serverInv);
      } else {
        progress = local;
      }
    DL.StoryMode.saveLocalProgress(progress);
    _updateMenuUI();
    } finally {
      _progressLoading = false;
    }
  }

  var _saveCloudTimer = null;
  async function _saveProgress() {
    DL.StoryMode.saveLocalProgress(progress);
    // Debounce cloud save — max once per 5 seconds to avoid 429 rate limit
    if (currentUser && !_saveCloudTimer) {
      _saveCloudTimer = setTimeout(async function() {
        _saveCloudTimer = null;
        try { await DL.StoryMode.saveCloudProgress(progress); } catch(_) {}
      }, 5000);
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
      try { window.authNudge?.show(true); } catch (_) {}
      return;
    }
    gui.show('MP_MENU');
    state = STATE.MP_MENU;
    // Fetch and display rating
    _loadMPRating();
  });

  async function _loadMPRating() {
    try {
      var data = await window.multiplayerClient?.getRating('drift-legends');
      if (data && gui._mpRatingText) {
        gui._mpRatingText.text = String(data.rating || 1000);
        gui._mpStatsText.text = 'W ' + (data.wins || 0) + '  L ' + (data.losses || 0) + '  GP ' + (data.gamesPlayed || 0);
      }
    } catch (_) {
      if (gui._mpRatingText) gui._mpRatingText.text = '1000';
      if (gui._mpStatsText) gui._mpStatsText.text = 'No matches yet';
    }
    // Load match history
    try {
      var history = await window.multiplayerClient?.getMatchHistory('drift-legends', 5);
      if (history && history.length > 0 && gui._mpHistoryText) {
        var lines = history.map(function(m) {
          var icon = m.outcome === 'win' ? 'W' : (m.outcome === 'loss' ? 'L' : 'D');
          var delta = m.ratingChange > 0 ? '+' + m.ratingChange : String(m.ratingChange || 0);
          var date = m.finishedAt ? new Date(m.finishedAt).toLocaleDateString() : '';
          return icon + '  vs ' + m.opponentName + '  ' + delta + '  ' + date;
        });
        gui._mpHistoryText.text = lines.join('\n');
      } else if (gui._mpHistoryText) {
        gui._mpHistoryText.text = 'No matches played yet';
      }
    } catch (_) {
      if (gui._mpHistoryText) gui._mpHistoryText.text = '';
    }
  }

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

  gui.onAction('selectCar', async (data) => {
    const status = DL.StoryMode.isCarUnlockable(progress, data.carId);
    if (status === 'locked') return;
    if (status === 'available') {
      var cost = data.carId === 'drift-racer' ? 200 : 300;
      // Try server purchase first if signed in
      if (currentUser && window.apiClient && window.apiClient.token) {
        gui.showToast('Purchasing...');
        var serverResult = await DL.StoryMode.purchaseCarFromServer(data.carId);
        if (serverResult && serverResult.success) {
          // Server purchase succeeded — update local progress to match
          progress.coins = serverResult.newBalance;
          if (progress.unlockedCars.indexOf(data.carId) === -1) {
            progress.unlockedCars.push(data.carId);
          }
          DL.Audio.play('unlock');
          gui.showToast('Unlocked ' + data.carId + '! (-' + serverResult.coinsSpent + ' coins)');
          _saveProgress();
          gui.updateCarSelectCards(progress, serverResult.newBalance);
        } else {
          // Server purchase failed — try local fallback
          var bought = DL.StoryMode.unlockCar(progress, data.carId);
          if (!bought) {
            gui.showToast('Not enough coins! Need ' + cost + ', have ' + (progress.coins || 0));
            return;
          }
          DL.Audio.play('unlock');
          gui.showToast('Unlocked ' + data.carId + '! (offline, -' + cost + ' coins)');
          _saveProgress();
          gui.updateCarSelectCards(progress);
        }
      } else {
        // Not signed in — local only
        var bought = DL.StoryMode.unlockCar(progress, data.carId);
        if (!bought) {
          gui.showToast('Not enough coins! Need ' + cost + ', have ' + (progress.coins || 0));
          return;
        }
        DL.Audio.play('unlock');
        gui.showToast('Unlocked ' + data.carId + '! (-' + cost + ' coins)');
        _saveProgress();
        gui.updateCarSelectCards(progress);
      }
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
    // Full cleanup — dispose race meshes + all remaining scene objects
    _cleanupRace();
    _disposeSceneMeshes();
    // Restore transparent background for HTML backgrounds
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
    scene.autoClear = true;
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
      _returnToMenu();
    }
  });

  gui.onAction('resultRetry', () => {
    // Re-enable mesh picking before rebuilding race
    scene.meshes.forEach(function(m) { m.isPickable = true; });
    _startLoading();
  });

  gui.onAction('resultMenu', () => {
    _returnToMenu();
  });

  gui.onAction('volumeChange', (val) => {
    DL.Audio.setVolume(val);
  });

  // Pause button (HUD touch button)
  gui.onAction('pauseClick', () => {
    if (isMultiplayerRace) return; // No pause in multiplayer
    if (state === STATE.RACING || state === STATE.COUNTDOWN || state === STATE.CINEMATIC_INTRO) {
      state = STATE.PAUSED;
      DL.Audio.stopEngine();
      scene.meshes.forEach(function(m) { m.isPickable = false; });
      gui.showPause();
    }
  });

  // Pause menu callbacks (single-player only — MP disables pause)
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
    _returnToMenu();
  });

  // Multiplayer callbacks
  gui.onAction('mpQuickMatch', () => {
    if (!currentUser) { try { window.authNudge?.show(true); } catch (_) {} return; }
    DL.Multiplayer.quickMatch(currentUser.uid);
  });

  gui.onAction('mpCreatePrivate', async () => {
    if (!currentUser) { try { window.authNudge?.show(true); } catch (_) {} return; }
    const mpTrack = selectedTrackId || 'city-circuit';
    const session = await DL.Multiplayer.createPrivateRoom(currentUser.uid, mpTrack);
    if (session) {
      gui.showMPWaitingRoom(session.joinCode || 'N/A');
    }
  });

  gui.onAction('mpCancelWaiting', () => {
    gui.hideMPWaitingRoom();
    DL.Multiplayer.leaveSession();
  });

  gui.onAction('mpJoinCode', () => {
    var code = prompt('Enter join code:');
    if (!code || !code.trim()) return;
    if (!currentUser) { try { window.authNudge?.show(true); } catch (_) {} return; }
    gui.showMPJoining('Joining room...');
    DL.Multiplayer.joinByCode(code.trim(), currentUser.uid);
  });

  gui.onAction('mpForfeit', () => {
    if (!isMultiplayerRace) return;
    _mpCleanup(true);
    _returnToMenu();
  });

  gui.onAction('mpRematch', () => {
    _mpCleanup(true);
    _returnToMenu();
    // Auto-trigger quick match again
    if (currentUser) {
      DL.Multiplayer.quickMatch(currentUser.uid);
    }
  });

  // ─── Race Loading & Setup ─────────────────────────────────────────
  function _startLoading() {
    // Hide header during gameplay for more screen real estate
    document.body.classList.add('dl-playing');
    try { window.gameHeader?.hide(); } catch(_) {}
    // Prime AudioContext NOW while still in user gesture (iOS requires this)
    DL.Audio.ensureContext();
    // Re-enable mesh picking (may have been disabled by result/pause overlay)
    scene.meshes.forEach(function(m) { m.isPickable = true; });
    const track = DL.TrackBuilder.TRACKS[selectedTrackId];
    gui.showLoading(track?.name || 'Track');
    state = STATE.LOADING;

    // Use setTimeout to let UI render before heavy work
    setTimeout(() => _buildRace(), 50);
  }

  function _disposeSceneMeshes() {
    // Dispose all scene meshes EXCEPT GUI internal layers
    var toDispose = scene.meshes.filter(function(m) {
      if (!m || m.isDisposed()) return false;
      // Skip Babylon.js GUI internal meshes
      var n = m.name || '';
      if (n.indexOf('ADT') !== -1 || n.indexOf('GUI') !== -1 || n.indexOf('gui') !== -1) return false;
      return true;
    });
    toDispose.forEach(function(m) { try { m.dispose(false, false); } catch(_) {} });
    // Dispose all lights
    scene.lights.slice().forEach(function(l) { try { l.dispose(); } catch(_) {} });
    // Reset fog
    scene.fogMode = BABYLON.Scene.FOGMODE_NONE;
    // Null out gui mesh references so they get rebuilt
    gui._menuCar = null;
    gui._garageCar = null;
    if (gui._garageEnv) { gui._garageEnv = null; }
    // Dispose leftover cameras (garage/menu) — keep only the chase camera
    scene.cameras.slice().forEach(function(cam) {
      if (cam !== chaseCamera.camera) {
        try { cam.dispose(); } catch(_) {}
      }
    });
    scene.activeCamera = chaseCamera.camera;
  }

  function _buildRace() {
    _cleanupRace();
    _disposeSceneMeshes();

    // Ensure chase camera is active (garage/menu cameras may have been disposed)
    scene.activeCamera = chaseCamera.camera;

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

    // MP: use server's totalLaps (set in onRaceStart). SP: use track's laps.
    if (!isMultiplayerRace) {
      totalLaps = trackData.trackDef.laps || 3;
    }

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

    // Dispose ALL menu/garage objects completely
    if (gui._menuCar) { gui._menuCar.dispose(false, true); gui._menuCar = null; }
    if (gui._garageCar) { gui._garageCar.dispose(false, true); gui._garageCar = null; }
    // Dispose entire garage environment (walls, floor, lights, props)
    if (gui._garageEnv) {
      gui._garageEnv.forEach(function(obj) { try { obj.dispose(); } catch(_) {} });
      gui._garageEnv = null;
    }
    // Disable menu lights
    if (gui._menuCarLight) { try { gui._menuCarLight.dispose(); } catch(_) {} gui._menuCarLight = null; }
    if (gui._menuCarFill) { try { gui._menuCarFill.dispose(); } catch(_) {} gui._menuCarFill = null; }
    if (gui._menuCarRim) { try { gui._menuCarRim.dispose(); } catch(_) {} gui._menuCarRim = null; }
    if (gui._menuCarHemi) { try { gui._menuCarHemi.dispose(); } catch(_) {} gui._menuCarHemi = null; }
    gui._garageHemi = null;
    gui._garageCam = null;
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
      // Start multiplayer position sync (pass function that returns position data)
      DL.Multiplayer.startSync(function() {
        if (!playerCar || !playerPhysics) return null;
        return {
          x: playerCar.position.x,
          z: playerCar.position.z,
          rotY: playerCar.rotation.y,
          speed: playerPhysics.speed,
          isDrifting: playerPhysics.isDrifting,
          checkpointIndex: playerCheckpoint,
          driftScore: Math.round(playerPhysics.totalDriftScore),
        };
      });
    }

    // Reset race state
    raceTime = 0;
    playerLap = 1;
    playerSplineT = 0;
    _lastSplineT = 0;
    playerCheckpoint = 0;
    _cpMissTimer = 0;
    _cpMissWarning = false;
    _cpResetActive = false;
    playerCheckpointSeq = [];
    cleanLapsCount = 0;
    lapStartTime = 0;
    lapTimes = [];
    raceFinished = false;
    wasDrifting = false;
    wasBoosting = false;
    playerPhysics.totalDriftScore = 0;

    // Dispose only known stray objects (garage car/cam) — don't sweep all meshes
    // (environment props like buildings, lamps etc. are NOT in trackData.meshes)
    // Kill any non-chase cameras
    scene.cameras.slice().forEach(function(cam) {
      if (cam !== chaseCamera.camera) try { cam.dispose(); } catch(_) {}
    });
    scene.activeCamera = chaseCamera.camera;
    gui._garageCar = null;
    gui._garageCam = null;
    gui._savedCamForGarage = null;

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
      gui.hud.goalReminder.isVisible = true;
      setTimeout(function() { if (gui.hud.goalReminder) gui.hud.goalReminder.isVisible = false; }, 5000);
    }
    scene.activeCamera = chaseCamera.camera; // ensure chase cam before cinematic
    chaseCamera.setTarget(playerCar);
    chaseCamera.startCinematicIntro(allCarMeshes, trackData, 5, function() {
      // Cinematic done → snap camera behind player → start countdown
      gui.hideTrackIntro();
      scene.activeCamera = chaseCamera.camera;
      chaseCamera.setTarget(playerCar);
      // Snap camera behind player — use simple rotation.y (just set it fresh)
      var startTangent = DL.TrackBuilder.getSplineTangent(trackData.splinePoints, 0);
      var carRotY = Math.atan2(startTangent.x, startTangent.z);
      playerCar.rotation.y = carRotY;
      playerCar.computeWorldMatrix(true); // force matrix update
      // Force player car back to start position (may have drifted if another object interfered)
      playerCar.position.copyFrom(trackData.startPosition);
      playerCar.position.y = 0;
      var camX = playerCar.position.x - Math.sin(carRotY) * 10;
      var camZ = playerCar.position.z - Math.cos(carRotY) * 10;
      chaseCamera.camera.position = new BABYLON.Vector3(camX, 4, camZ);
      chaseCamera.camera.setTarget(new BABYLON.Vector3(playerCar.position.x, 1, playerCar.position.z));
      countdownTimer = 0;
      countdownNumber = 3;
      gui.showCountdown(3);
      DL.Audio.play('countdown');
      DL.Audio.startEngine();
      gui.showTouchControls(DL.Input.isMobile());
      state = STATE.COUNTDOWN;
    });

    // Freeze static meshes for performance (buildings, ground, walls don't move)
    scene.blockMaterialDirtyMechanism = false;
    scene.render(); // force one render to compile materials
    scene.blockMaterialDirtyMechanism = true;

    state = STATE.CINEMATIC_INTRO;

    // Start BGM during cinematic (sets the mood before countdown)
    DL.Audio.startBGM(trackData.trackDef.environment);

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
    // Dispose tire marks
    DL.Particles.disposeTireMarks();
    gui.showTouchControls(false);
    DL.Audio.stopEngine();
    DL.Audio.stopBGM();
  }

  var REJOIN_KEY = 'dl-rejoin-session';

  function _mpCleanup(fullLeave) {
    var sid = DL.Multiplayer.getSessionId();
    gui.hideMPHud();
    gui.hideMPDisconnect();
    gui.hideMPWaiting();
    gui.hideMPWaitingRoom();
    gui.hideMPJoining();
    // Always stop polling + sync
    DL.Multiplayer.stopSync();
    if (fullLeave) {
      // User explicitly left — fully leave session + clear rejoin
      DL.Multiplayer.leaveSession();
      localStorage.removeItem(REJOIN_KEY);
    } else {
      // Navigating to menu during race — save session for rejoin
      try { window.multiplayerClient?.disconnect(); } catch(_) {}
      if (sid && isMultiplayerRace) {
        localStorage.setItem(REJOIN_KEY, sid);
      }
    }
    if (isMultiplayerRace) {
      isMultiplayerRace = false;
      opponentCar = null;
    }
  }

  // Save session for rejoin on page close/refresh
  window.addEventListener('beforeunload', function() {
    if (isMultiplayerRace && DL.Multiplayer.isInSession()) {
      localStorage.setItem(REJOIN_KEY, DL.Multiplayer.getSessionId());
      try { window.multiplayerClient?.disconnect(); } catch(_) {}
    }
  });

  // ─── Auto-Rejoin Check ───────────────────────────────────────────
  async function _checkRejoinableSession() {
    if (!currentUser || !window.multiplayerClient || !window.apiClient?.token) return;
    var savedSid = localStorage.getItem(REJOIN_KEY);
    if (!savedSid) return;

    try {
      var session = await window.multiplayerClient.getSession(savedSid);
      if (session && (session.status === 'playing' || session.status === 'starting')) {
        // Session still active — auto-rejoin
        gui.showMPJoining('Rejoining race...');
        isMultiplayerRace = true;
        selectedTrackId = session.gameConfig?.trackId || 'city-circuit';
        totalLaps = session.gameConfig?.laps || 2;

        // Restore opponent info
        if (session.players) {
          for (var uid in session.players) {
            if (uid !== currentUser.uid) {
              gui.showMPHud(session.players[uid].displayName || 'Opponent');
              break;
            }
          }
        }

        // Reconnect
        DL.Multiplayer._setSession(savedSid, currentUser.uid);
        try { window.multiplayerClient?.disconnect(); } catch(_) {}
        DL.Multiplayer._setupListeners();
        await window.multiplayerClient.connect(savedSid);
        window.multiplayerClient.signalReady();
        gui.hideMPJoining();
        // Race will start via onRaceStart callback from server state
      } else if (session && session.status === 'finished') {
        // Race already ended — show result screen
        localStorage.removeItem(REJOIN_KEY);
        gui.showMPJoining('Race ended...');
        var myResult = session.results?.[currentUser.uid];
        var won = myResult?.outcome === 'win';
        setTimeout(function() {
          gui.hideMPJoining();
          gui.showRaceResult({
            position: myResult?.rank || (won ? 1 : 2),
            stars: won ? 3 : 1,
            raceScore: 0,
            driftScore: 0,
            coins: 0,
            totalTimeMs: 0,
            unlockText: won ? 'Multiplayer Victory!' : 'Race finished while you were away.',
            goalResults: [],
            allGoalsPassed: won,
            storyComplete: false,
            totalStars: 0,
            totalCoins: 0,
            isMultiplayer: true,
            mpOutcome: myResult?.outcome || 'loss',
          });
          state = STATE.RESULT;
        }, 500);
      } else {
        localStorage.removeItem(REJOIN_KEY);
      }
    } catch (e) {
      console.error('[DL] Rejoin failed:', e);
      localStorage.removeItem(REJOIN_KEY);
      gui.hideMPJoining();
    }
  }

  function _returnToMenu() {
    // Show header again
    document.body.classList.remove('dl-playing');
    try { window.gameHeader?.show(); } catch(_) {}
    _mpCleanup(true);
    _cleanupRace();
    gui.hideTutorial();
    gui.hidePause();
    gui.hideMPWaiting();
    if (gui._pauseBtn) gui._pauseBtn.isVisible = true; // Restore for next SP race
    tutorialStep = -1;
    _disposeSceneMeshes();
    // Restore HTML skyline + transparent scene
    if (skylineBg) skylineBg.style.display = '';
    var mtnBg = document.getElementById('storyMtnBg');
    if (mtnBg) mtnBg.style.display = 'none';
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
    scene.autoClear = true;
    // Show menu
    gui.show('MENU');
    state = STATE.MENU;
    _updateMenuUI();
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

    // ESC/P = pause (only during racing states, disabled in MP)
    if (DL.Input.consumePause() && !isMultiplayerRace) {
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
        try {
          chaseCamera.updateCinematic(dt);
          aiRacers.forEach(function(ai) { DL.CarBuilder.updateWheels(ai.mesh, 5, dt); });
          DL.CarBuilder.updateWheels(playerCar, 0, dt);
        } catch (e) { console.error('[Cinematic loop]', e); }
        break;

      case STATE.COUNTDOWN:
        _updateCountdown(dt);
        // Hard-lock car at start + camera behind during countdown
        if (playerCar && chaseCamera.camera && trackData) {
          // Force car to stay at start position during countdown
          playerCar.position.x = trackData.startPosition.x;
          playerCar.position.y = 0;
          playerCar.position.z = trackData.startPosition.z;
          var cdRotY = playerCar.rotation.y;
          chaseCamera.camera.position = new BABYLON.Vector3(
            playerCar.position.x - Math.sin(cdRotY) * 10,
            4,
            playerCar.position.z - Math.cos(cdRotY) * 10
          );
          chaseCamera.camera.setTarget(new BABYLON.Vector3(playerCar.position.x, 1, playerCar.position.z));
        }
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
    // Set road elevation for bridge following
    if (trackData && trackData.splinePoints) {
      var closestPt = DL.TrackBuilder.getClosestPointOnTrack(trackData.splinePoints, playerCar.position);
      playerPhysics._roadY = closestPt.point.y;
    }

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
          playerPhysics.wallHitThisLap = true; // Mark dirty lap on opponent collision
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

      // Update spline position BEFORE checkpoint detection (lap crossing depends on it)
      _updatePlayerSplineT();
      // Checkpoint detection
      _updateCheckpoints();
    }

    // Wheel animation
    DL.CarBuilder.updateWheels(playerCar, playerPhysics.speed, dt);

    // Particle effects (suppressed if user prefers reduced motion)
    if (!prefersReducedMotion) {
      if (driftSmoke) driftSmoke.emitRate = playerPhysics.isDrifting ? 60 : (lateralForMarks > 15 ? 20 : 0);
      if (boostFlame) boostFlame.emitRate = playerPhysics.isBoosting ? 80 : 0;
      // Exhaust puffs — always when moving, more when accelerating
      if (exhaustSmoke) exhaustSmoke.emitRate = playerPhysics.speed > 3 ? (input.accelerate ? 15 : 5) : 0;
      // Tire marks — during drift OR hard cornering (lateral angle > 15°) OR braking at speed
      var lateralForMarks = playerPhysics.speed > 5 ? Math.abs(playerPhysics._getLateralAngle()) : 0;
      if ((playerPhysics.isDrifting || lateralForMarks > 15 || (input.brake && playerPhysics.speed > 15)) && playerPhysics.speed > 8) {
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
    if (isMultiplayerRace && opponentCar) {
      const oppPos = DL.Multiplayer.getOpponentPosition();
      if (oppPos) {
        opponentCar.position.x = oppPos.x;
        opponentCar.position.z = oppPos.z;
        opponentCar.position.y = 0;
        opponentCar.rotation.y = oppPos.rotY;
      }
      // Debug: log opponent position every 2s
      if (!window._dlOppDebugTimer) window._dlOppDebugTimer = 0;
      window._dlOppDebugTimer += dt;
      if (window._dlOppDebugTimer > 2) {
        window._dlOppDebugTimer = 0;
        console.log('[DL-MP] Opponent pos:', oppPos ? `x=${oppPos.x.toFixed(1)} z=${oppPos.z.toFixed(1)}` : 'NULL',
          'opponentCar:', opponentCar?.position?.x?.toFixed(1), opponentCar?.position?.z?.toFixed(1));
      }
    }

    // Race position
    const playerT = (playerLap - 1) + playerSplineT;
    var playerPos = 1;
    if (isMultiplayerRace) {
      // Compare using same granularity: lap + splineT for both players
      // Local player uses smooth splineT, opponent uses splineT computed from position
      var gs = window.DriftLegends?.Multiplayer?._gameState || null;
      var oppLap = 0;
      var oppSplineT = 0;
      if (gs && gs.laps && gs.positions && trackData?.splinePoints) {
        var oppUid = null;
        for (var k in gs.laps) { if (k !== currentUser?.uid) { oppUid = k; break; } }
        if (oppUid && gs.positions[oppUid]) {
          oppLap = (gs.laps[oppUid] || 0);
          // Compute opponent's splineT from their world position
          var oppWorldPos = new V3(gs.positions[oppUid].x, 0, gs.positions[oppUid].z);
          var oppClosest = DL.TrackBuilder.getClosestPointOnTrack(trackData.splinePoints, oppWorldPos);
          oppSplineT = oppClosest ? oppClosest.t : 0;
        }
      }
      var oppProgress = oppLap + oppSplineT;
      playerPos = playerT >= oppProgress ? 1 : 2;
    } else {
      var positions = DL.AIRacer.getRacePositions(playerT, aiRacers, playerLap, playerSplineT);
      playerPos = positions.findIndex(function(p) { return p.id === 'player'; }) + 1;
    }

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

  function _updatePlayerSplineT() {
    if (!trackData || !trackData.splinePoints) return;
    var sp = trackData.splinePoints;
    var searchWindow = 0.25;
    var bestDist = Infinity;
    var step = 1 / sp.length;
    var closestT = playerSplineT;
    var minI = Math.max(0, Math.floor((playerSplineT - searchWindow) * sp.length));
    var maxI = Math.min(sp.length - 1, Math.ceil((playerSplineT + searchWindow) * sp.length));
    // Wrap search near start/finish
    if (playerSplineT < searchWindow) maxI = Math.min(sp.length - 1, maxI + Math.ceil(searchWindow * sp.length));
    if (playerSplineT > 1 - searchWindow) minI = Math.max(0, minI - Math.ceil(searchWindow * sp.length));
    for (var si = minI; si <= maxI; si++) {
      var idx = ((si % sp.length) + sp.length) % sp.length;
      var d = BABYLON.Vector3.DistanceSquared(playerCar.position, sp[idx]);
      if (d < bestDist) { bestDist = d; closestT = idx * step; }
    }
    if (playerSplineT > 0.85 && closestT < 0.15) closestT += 1;
    if (playerSplineT < 0.15 && closestT > 0.85) closestT -= 1;
    playerSplineT = ((closestT % 1) + 1) % 1; // ensure 0-1
  }

  function _updateCheckpoints() {
    if (!trackData) return;
    const checkpoints = trackData.checkpointPositions;

    // Only check the NEXT expected checkpoint (sequential — no skipping)
    var nextCpIdx = playerCheckpoint;
    var cpHit = false;

    if (nextCpIdx < checkpoints.length) {
      var cp = checkpoints[nextCpIdx];
      var dist = V3.Distance(playerCar.position, cp.position);

      if (dist < trackData.trackDef.trackWidth * 1.5) {
        // ── CHECKPOINT HIT ──
        playerCheckpoint = nextCpIdx + 1;
        playerCheckpointSeq.push(nextCpIdx);
        cpHit = true;
        _cpMissTimer = 0;
        _cpMissWarning = false;
        _cpResetActive = false;
        gui.hideCheckpointWarning();
        DL.Audio.play('checkpoint');
        if (!prefersReducedMotion) chaseCamera.shake(0.08);

        // Visual: disappear instantly, reappear after 2s
        if (trackData._cpMeshes && trackData._cpMeshes[nextCpIdx]) {
          var cpMesh = trackData._cpMeshes[nextCpIdx];
          cpMesh.visibility = 0;
          var defMat = trackData._cpMatDefault;
          setTimeout(function() {
            if (cpMesh && !cpMesh.isDisposed()) {
              cpMesh.visibility = 1;
              if (defMat) cpMesh.material = defMat;
            }
          }, 2000);
        }
      } else {
        // ── CHECK FOR MISS: player's splineT is well past the checkpoint's t AND far away ──
        var cpT = trackData.trackDef.checkpoints[nextCpIdx];
        var pastCheckpoint = false;
        // Must be >15% past checkpoint on spline AND >3x track width away from checkpoint position
        if (Math.abs(cpT - playerSplineT) < 0.5) {
          var distToCp = V3.Distance(playerCar.position, cp.position);
          pastCheckpoint = playerSplineT > cpT + 0.15 && distToCp > trackData.trackDef.trackWidth * 3;
        }

        if (pastCheckpoint && !_cpMissWarning) {
          // ── CHECKPOINT MISSED — immediate feedback ──
          _cpMissWarning = true;
          _cpMissTimer = 0;
          gui.showCheckpointWarning('CHECKPOINT MISSED!');
          DL.Audio.play('collision'); // warning tone
        }

        if (_cpMissWarning) {
          var dt2 = scene.getEngine().getDeltaTime() / 1000;
          _cpMissTimer += dt2;

          if (_cpMissTimer >= 2 && !_cpResetActive) {
            // Show countdown
            var remaining = Math.max(1, Math.ceil(5 - _cpMissTimer));
            gui.showCheckpointWarning('CHECKPOINT MISSED!\nReset in ' + remaining + '...');
          }

          if (_cpMissTimer >= 5 && !_cpResetActive) {
            // ── RESET: spawn BEFORE the missed checkpoint so player can cross it ──
            _cpResetActive = true;
            gui.showCheckpointWarning('Resetting...');
            setTimeout(function() {
              if (!playerCar || !trackData) return;
              var missedT = trackData.trackDef.checkpoints[nextCpIdx];
              // Spawn slightly before the checkpoint (3% back on the spline)
              var resetT = Math.max(0, missedT - 0.03);
              var resetPos = DL.TrackBuilder.getSplinePoint(trackData.splinePoints, resetT);
              resetPos.y = 0.5;
              playerCar.position.copyFrom(resetPos);
              var tangent = DL.TrackBuilder.getSplineTangent(trackData.splinePoints, resetT);
              playerCar.rotation.y = Math.atan2(tangent.x, tangent.z);
              playerPhysics.velocity = BABYLON.Vector3.Zero();
              playerPhysics.speed = 0;
              playerSplineT = resetT;
              _lastSplineT = resetT; // prevent false lap detection from splineT jump
              // Snap camera to new position immediately
              if (chaseCamera && chaseCamera.camera) {
                var ry2 = playerCar.rotation.y;
                chaseCamera.camera.position.x = playerCar.position.x - Math.sin(ry2) * 8;
                chaseCamera.camera.position.y = playerCar.position.y + 3.5;
                chaseCamera.camera.position.z = playerCar.position.z - Math.cos(ry2) * 8;
                chaseCamera.camera.setTarget(playerCar.position.add(new BABYLON.Vector3(0, 1, 0)));
              }
              _cpMissTimer = 0;
              _cpMissWarning = false;
              _cpResetActive = false;
              gui.hideCheckpointWarning();
            }, 1000);
          }
        }
      }
    }

    // Check lap completion — all checkpoints passed + near start + minimum time
    if (playerCheckpoint >= checkpoints.length) {
      var lapElapsed = raceTime - lapStartTime;
      if (lapElapsed > 15) {
        // Method 1: spline wrap-around (splineT went from >0.85 to <0.15)
        var crossedFinish = (playerSplineT < 0.15 && _lastSplineT > 0.85);
        // Method 2: distance to start position (fallback)
        var distToStart = V3.Distance(playerCar.position, trackData.startPosition);
        var nearStart = distToStart < trackData.trackDef.trackWidth * 2.5;
        if (crossedFinish || nearStart) {
          _completeLap();
        }
      }
    }
    _lastSplineT = playerSplineT;
  }

  // Screen reader announcements
  function _announce(msg) {
    var el = document.getElementById('dl-announcer');
    if (el) { el.textContent = ''; requestAnimationFrame(function() { el.textContent = msg; }); }
  }

  function _formatTime(ms) {
    var totalSec = Math.floor(ms / 1000);
    var min = Math.floor(totalSec / 60);
    var sec = totalSec % 60;
    var frac = Math.floor((ms % 1000) / 10);
    return (min > 0 ? min + ':' : '') + (sec < 10 && min > 0 ? '0' : '') + sec + '.' + (frac < 10 ? '0' : '') + frac;
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

    // Multiplayer: send finish to server, show waiting view, wait for result
    if (isMultiplayerRace && !_isBotRace) {
      const totalTimeMs = lapTimes.reduce((a, b) => a + b, 0);
      const driftScoreTotal = playerPhysics ? playerPhysics.totalDriftScore : 0;
      _mpFinishDriftScore = Math.round(driftScoreTotal);
      DL.Multiplayer.stopSync();
      DL.Multiplayer.sendRaceFinish(totalTimeMs, driftScoreTotal);

      // Aerial camera looking down at the city
      if (playerCar && trackData) {
        var centerPos = trackData.startPosition || playerCar.position;
        chaseCamera.camera.position = new V3(centerPos.x, 40, centerPos.z - 20);
        chaseCamera.camera.setTarget(new V3(centerPos.x, 0, centerPos.z));
      }

      // Show waiting overlay
      gui.showMPWaiting(
        'Race Complete!',
        'Your time: ' + _formatTime(totalTimeMs),
        'Waiting for opponent to finish...'
      );
      DL.Audio.play('lap');
      _announce('Waiting for opponent to finish...');
      // onRaceEnd callback (from Multiplayer.init) will show the actual result
      return;
    }

    // Single player / story mode result — player finished, so use totalLaps as lap count
    const playerT = totalLaps + 1;
    const positions = DL.AIRacer.getRacePositions(playerT, aiRacers, totalLaps, 1.0);
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

      if (_isBotRace) {
        // Bot match — show MP-style result (REMATCH / MENU)
        gui.hideMPHud();
        gui.showRaceResult({
          position: playerPosition,
          stars: won ? 3 : (playerPosition <= 2 ? 2 : 1),
          raceScore,
          driftScore: Math.round(driftScoreTotal),
          coins,
          totalTimeMs,
          unlockText: won ? 'Victory vs ' + _botOpponentName + '!' : 'Defeated by ' + _botOpponentName,
          goalResults: [],
          allGoalsPassed: won,
          storyComplete: false,
          totalStars: 0,
          totalCoins: 0,
          isMultiplayer: true, // Shows REMATCH + MENU buttons
        });
        _isBotRace = false;
        state = STATE.RESULT;
      } else {
        // Normal SP/story result
        var totalStars = 0, totalRaces = 0;
        Object.values(progress.raceResults || {}).forEach(function(r) { totalStars += (r.bestStars || 0); if (r.completed) totalRaces++; });
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
          storyComplete: !!(progress.storyComplete && selectedChapter && selectedChapter.id === 5 && won),
          totalStars: totalStars,
          totalRaces: totalRaces,
          totalCoins: progress.coins || 0,
        });
        state = STATE.RESULT;
      }
    }, 1500);

    // Note: MP finish is handled in the early return above
  }

  async function _submitScore(totalTimeMs, driftScore, stars) {
    try {
      await window.apiClient.submitScore('drift-legends', {
        score: Math.round(totalTimeMs),
        timeMs: Math.round(totalTimeMs),
        metadata: {
          trackId: selectedTrackId,
          driftScore: Math.round(driftScore),
          chapter: selectedChapter?.id || 0,
          stars,
        },
      });
    } catch (err) {
      console.error('Score submit error:', err);
    }
  }

  var _unlockedAchievements = {}; // track which we've already shown
  function _checkAchievements(position, stars, driftScore, cleanLaps) {
    if (!currentUser || !window.apiClient) return;
    // Achievement names for display
    var ACHIEVEMENT_NAMES = {
      'dl-first-finish': '\ud83c\udfce\ufe0f Rubber on Road',
      'dl-first-win': '\ud83c\udfc6 Winner\'s Circle',
      'dl-chapter1-complete': '\ud83c\udf03 City Slicker',
      'dl-chapter3-complete': '\u2744\ufe0f Ice Cold',
      'dl-story-complete': '\ud83d\udc51 Drift Legend',
      'dl-all-three-stars': '\u2b50 Perfectionist',
      'dl-first-superboost': '\ud83d\udd25 Blue Flame',
      'dl-drift-master': '\ud83d\udca8 Slide King',
      'dl-clean-sweep': '\u2728 Smooth Operator',
      'dl-all-cars': '\ud83c\udfea Full Garage',
      'dl-night-racer': '\ud83c\udf19 Night Shift',
      'dl-all-tracks-cleared': '\ud83c\udf0d World Tour',
      'dl-rival-beaten-first': '\u2694\ufe0f Rival Slayer',
    };
    const unlock = (id) => {
      if (_unlockedAchievements[id]) return; // already shown this session
      _unlockedAchievements[id] = true;
      try {
        window.apiClient.unlockAchievement(id, 'drift-legends', {}).then(function(result) {
          // Only show toast if it was newly unlocked (not already earned)
          if (result && !result.alreadyUnlocked) {
            var name = ACHIEVEMENT_NAMES[id] || id;
            gui.showToast('\ud83c\udfc5 Achievement Unlocked: ' + name, 5000);
            DL.Audio.play('unlock');
          }
        }).catch(function() {});
      } catch (_) {}
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
    if (document.hidden) {
      // Suspend all audio when tab/app goes to background or phone sleeps
      DL.Audio.stopEngine();
      DL.Audio.pauseBGM();
      if (state === STATE.RACING || state === STATE.COUNTDOWN || state === STATE.CINEMATIC_INTRO) {
        state = STATE.PAUSED;
        scene.meshes.forEach(function(m) { m.isPickable = false; });
        gui.showPause();
      }
    } else {
      // Resume BGM when returning (engine resumes when unpausing)
      if (state !== STATE.PAUSED) {
        DL.Audio.resumeBGM();
      }
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
    // Show joining UI immediately
    gui.showMPJoining('Signing in...');
    var _joinAttempts = 0;
    const waitAuth = setInterval(() => {
      _joinAttempts++;
      // Wait for BOTH user auth AND api token to be ready
      if (currentUser && window.apiClient?.token) {
        clearInterval(waitAuth);
        gui.showMPJoining('Joining room ' + joinCode + '...');
        // Small delay to ensure token is fully propagated
        setTimeout(() => {
          DL.Multiplayer.joinByCode(joinCode, currentUser.uid);
        }, 300);
      } else if (_joinAttempts > 30) {
        // 15s timeout — show auth nudge if not signed in
        clearInterval(waitAuth);
        gui.hideMPJoining();
        if (!currentUser) {
          window.authNudge?.show(true);
        } else {
          gui.showToast('Could not connect. Please try again.', 3000);
        }
      }
    }, 500);
  }

  // Debug access removed for production — do not expose engine/scene
})();
