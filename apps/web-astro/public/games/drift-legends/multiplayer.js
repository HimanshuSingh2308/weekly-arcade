'use strict';
/**
 * Drift Legends -- Multiplayer Module
 * Uses window.multiplayerClient + window.multiplayerUI for real-time 2-player racing.
 * Position sync at 15 Hz, client-side interpolation, dead reckoning.
 */
(function () {
  const V3 = BABYLON.Vector3;
  const GAME_ID = 'drift-legends';
  const SYNC_INTERVAL_MS = 67;       // ~15 Hz
  const DEAD_RECKONING_MS = 200;     // after this, extrapolate

  let currentSessionId = null;
  let myUid = null;
  let isHost = false;
  let opponentUid = null;
  let gameState = null;

  // Opponent interpolation state
  let opponentLastPos = null;
  let opponentTargetPos = null;
  let opponentLastUpdate = 0;
  let opponentSpeed = 0;
  let opponentRotY = 0;
  let opponentIsDrifting = false;

  // Position sync timer
  let syncInterval = null;

  // Callbacks
  let onOpponentUpdate = null;
  let onRaceStart = null;
  let onRaceEnd = null;
  let onDisconnect = null;
  let onReconnect = null;

  function init(callbacks) {
    onOpponentUpdate = callbacks.onOpponentUpdate || null;
    onRaceStart = callbacks.onRaceStart || null;
    onRaceEnd = callbacks.onRaceEnd || null;
    onDisconnect = callbacks.onDisconnect || null;
    onReconnect = callbacks.onReconnect || null;
  }

  function warmUp() {
    try {
      window.multiplayerClient?.warmUp();
    } catch (_) { /* ignore */ }
  }

  async function quickMatch(uid) {
    myUid = uid;
    try {
      // Leave current session if any
      if (currentSessionId) {
        try { await window.multiplayerClient?.leaveSession(currentSessionId); } catch(_) {}
        currentSessionId = null;
      }

      window.multiplayerUI?.showMatchmaking('Drift Legends', async () => {
        await window.multiplayerClient?.cancelMatchmaking();
      });

      // Register WS push callback for instant match notification
      window.multiplayerClient?.onMatchFound(async (sessionId) => {
        _stopPolling();
        window.multiplayerUI?.hideMatchmaking();
        currentSessionId = sessionId;
        isHost = false;
        // Register listeners BEFORE connect (chess-3d pattern — prevents race)
        _setupSocketListeners();
        await window.multiplayerClient?.connect(sessionId);
        window.multiplayerClient?.signalReady();
      });

      const result = await window.multiplayerClient?.findMatch(GAME_ID);
      if (result?.matchedSessionId) {
        window.multiplayerUI?.hideMatchmaking();
        currentSessionId = result.matchedSessionId;
        isHost = true;
        _setupSocketListeners();
        await window.multiplayerClient?.connect(result.matchedSessionId);
        window.multiplayerClient?.signalReady();
      } else {
        // No instant match — poll as fallback
        _pollForMatch();
      }
    } catch (err) {
      window.multiplayerUI?.hideMatchmaking();
      console.error('Matchmaking error:', err);
      var guiToast = window.DriftLegends._gui?.showToast;
      if (guiToast) {
        var msg = err.message || 'Unknown error';
        window.DriftLegends._gui.showToast('\u274c ' + msg);
      }
    }
  }

  async function createPrivateRoom(uid, trackId) {
    myUid = uid;
    try {
      const session = await window.multiplayerClient?.createSession(GAME_ID, {
        mode: 'private',
        maxPlayers: 2,
        gameConfig: { laps: 2, trackId: trackId || 'city-circuit' },
      });
      currentSessionId = session.sessionId;
      isHost = true;
      _setupSocketListeners();
      await window.multiplayerClient?.connect(session.sessionId);
      window.multiplayerClient?.signalReady();
      return session;
    } catch (err) {
      console.error('Create room error:', err);
      window.DriftLegends._gui?.showToast('\u274c Room creation failed: ' + (err.message || 'Unknown error'));
      return null;
    }
  }

  async function joinByCode(code) {
    try {
      const result = await window.multiplayerClient?.joinByCode(code);
      if (result?.sessionId) {
        currentSessionId = result.sessionId;
        isHost = false;
        _setupSocketListeners();
        await window.multiplayerClient?.connect(result.sessionId);
        window.multiplayerClient?.signalReady();
      }
    } catch (err) {
      console.error('Join by code error:', err);
      window.DriftLegends._gui?.showToast('\u274c Failed to join: ' + (err.message || 'Invalid code'));
    }
  }

  function _setupSocketListeners() {
    const client = window.multiplayerClient;
    if (!client) return;

    // Game state updates (includes initial state + move results)
    let raceStartFired = false;

    client.onGameState((data) => {
      gameState = data.state;

      // First game:state with players array = game initialized → start race
      if (!raceStartFired && data.state?.players && onRaceStart) {
        raceStartFired = true;
        onRaceStart(data.state);
      }

      // Handle opponent position from state updates
      if (data.state?.lastMove && data.state.lastMove.uid !== myUid) {
        _handleOpponentMove(data.state.lastMove);
      }
    });

    // Opponent joined — if we're host, start the game
    client.onPlayerJoined(async (player) => {
      if (player.uid !== myUid) {
        opponentUid = player.uid;
        console.log('[DL-MP] Opponent joined:', player.displayName || player.uid);
      }

      if (isHost) {
        try {
          // Check if game already started (quick-match auto-starts)
          const session = await window.multiplayerClient?.getSession(currentSessionId);
          if (session?.status === 'waiting') {
            await window.multiplayerClient?.startGame(currentSessionId);
          }
          window.multiplayerClient?.signalReady();
        } catch (e) {
          // Already started (quick-match) — just signal ready
          window.multiplayerClient?.signalReady();
        }
      }
    });

    // Game finished
    client.onGameFinished(({ results }) => {
      if (onRaceEnd) onRaceEnd(results);
    });

    // Disconnection
    client.onError(({ code }) => {
      if (code === 'DISCONNECTED' && onDisconnect) {
        onDisconnect();
      }
    });

    // Reconnection
    client.onReconnected(() => {
      if (onReconnect) onReconnect();
    });

    // Listen for raw position-update moves via the generic event handler
    client.on('game:state', (data) => {
      const state = data.state;
      if (!state?.moves) return;

      // Process any new position updates from the opponent
      const lastMove = state.moves?.[state.moves.length - 1];
      if (lastMove && lastMove.uid !== myUid && lastMove.moveType === 'position-update') {
        _handleOpponentMove(lastMove);
      }
    });
  }

  function _handleOpponentMove(move) {
    if (!move?.moveData) return;
    opponentUid = move.uid || opponentUid;

    if (move.moveType === 'position-update' || move.moveData.x !== undefined) {
      opponentLastPos = opponentTargetPos ? { ...opponentTargetPos } : null;
      opponentTargetPos = {
        x: move.moveData.x,
        z: move.moveData.z,
        rotY: move.moveData.rotY,
      };
      opponentSpeed = move.moveData.speed || 0;
      opponentRotY = move.moveData.rotY || 0;
      opponentIsDrifting = !!move.moveData.isDrifting;
      opponentLastUpdate = performance.now();

      if (onOpponentUpdate) {
        onOpponentUpdate({
          x: move.moveData.x,
          z: move.moveData.z,
          rotY: move.moveData.rotY,
          speed: opponentSpeed,
          isDrifting: opponentIsDrifting,
        });
      }
    }

    if (move.moveType === 'race-finish') {
      if (onRaceEnd) onRaceEnd(move.moveData);
    }
  }

  /** Start sending position updates */
  function startSync(getPositionFn) {
    stopSync();
    syncInterval = setInterval(() => {
      if (!currentSessionId || !window.multiplayerClient) return;
      const posData = getPositionFn();
      if (!posData) return;
      try {
        window.multiplayerClient.submitMove('position-update', {
          x: posData.x,
          z: posData.z,
          rotY: posData.rotY,
          speed: posData.speed,
          isDrifting: posData.isDrifting,
          checkpointIndex: posData.checkpointIndex || 0,
          driftScore: posData.driftScore || 0,
        });
      } catch (_) { /* ignore sync errors */ }
    }, SYNC_INTERVAL_MS);
  }

  function stopSync() {
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
    }
  }

  /** Get interpolated opponent position for rendering */
  function getOpponentPosition() {
    if (!opponentTargetPos) return null;
    const now = performance.now();
    const elapsed = now - opponentLastUpdate;

    if (elapsed > DEAD_RECKONING_MS && opponentLastPos) {
      // Dead reckoning: extrapolate forward
      const dir = new V3(
        Math.sin(opponentRotY),
        0,
        Math.cos(opponentRotY)
      );
      const extrapolate = opponentSpeed * (elapsed / 1000) * 0.3;
      return {
        x: opponentTargetPos.x + dir.x * extrapolate,
        z: opponentTargetPos.z + dir.z * extrapolate,
        rotY: opponentRotY,
        speed: opponentSpeed,
        isDrifting: opponentIsDrifting,
      };
    }

    if (opponentLastPos) {
      // Interpolate between last two known positions
      const alpha = Math.min(elapsed / SYNC_INTERVAL_MS, 1);
      return {
        x: opponentLastPos.x + (opponentTargetPos.x - opponentLastPos.x) * alpha,
        z: opponentLastPos.z + (opponentTargetPos.z - opponentLastPos.z) * alpha,
        rotY: _lerpAngle(opponentLastPos.rotY, opponentTargetPos.rotY, alpha),
        speed: opponentSpeed,
        isDrifting: opponentIsDrifting,
      };
    }

    return { ...opponentTargetPos, speed: opponentSpeed, isDrifting: opponentIsDrifting };
  }

  function _lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }

  async function sendLapComplete(lapTimeMs, lapNumber, checkpointSequence) {
    if (!currentSessionId || !window.multiplayerClient) return;
    try {
      window.multiplayerClient.submitMove('lap-complete', {
        lapTimeMs,
        lapNumber,
        checkpointSequence,
      });
    } catch (_) { /* ignore */ }
  }

  async function sendRaceFinish(totalTimeMs, finalDriftScore) {
    if (!currentSessionId || !window.multiplayerClient) return;
    try {
      window.multiplayerClient.submitMove('race-finish', {
        totalTimeMs,
        finalDriftScore,
      });
    } catch (_) { /* ignore */ }
  }

  async function startGame() {
    if (!currentSessionId || !window.multiplayerClient) return;
    try {
      await window.multiplayerClient.startGame(currentSessionId);
      window.multiplayerClient.signalReady();
    } catch (err) {
      console.error('Start game error:', err);
    }
  }

  function leaveSession() {
    stopSync();
    _stopPolling();
    if (currentSessionId && window.multiplayerClient) {
      try {
        window.multiplayerClient.leaveSession(currentSessionId);
      } catch (_) { /* ignore */ }
    }
    currentSessionId = null;
    isHost = false;
    opponentUid = null;
    gameState = null;
    opponentTargetPos = null;
    opponentLastPos = null;
  }

  let _pollTimer = null;

  function _pollForMatch() {
    _stopPolling();
    let attempts = 0;
    _pollTimer = setInterval(async () => {
      attempts++;
      if (attempts > 40) { // 40 * 3s = 2 min
        _stopPolling();
        window.multiplayerUI?.hideMatchmaking();
        window.DriftLegends._gui?.showToast('No opponents found. Try again later.');
        return;
      }
      try {
        const status = await window.multiplayerClient?.getMatchmakingStatus();
        if (status?.status === 'matched' && status.sessionId) {
          _stopPolling();
          window.multiplayerUI?.hideMatchmaking();
          currentSessionId = status.sessionId;
          isHost = false;
          _setupSocketListeners();
          await window.multiplayerClient?.connect(status.sessionId);
          window.multiplayerClient?.signalReady();
        }
      } catch (_) { /* retry */ }
    }, 3000);
  }

  function _stopPolling() {
    if (_pollTimer) {
      clearInterval(_pollTimer);
      _pollTimer = null;
    }
  }

  // Check for deep link join
  function checkDeepLink() {
    const params = new URLSearchParams(window.location.search);
    return params.get('join') || null;
  }

  const Multiplayer = {
    init,
    warmUp,
    quickMatch,
    createPrivateRoom,
    joinByCode,
    startSync,
    stopSync,
    getOpponentPosition,
    sendLapComplete,
    sendRaceFinish,
    startGame,
    leaveSession,
    checkDeepLink,
    getSessionId: () => currentSessionId,
    isInSession: () => !!currentSessionId,
    isHostPlayer: () => isHost,
  };

  window.DriftLegends = window.DriftLegends || {};
  window.DriftLegends.Multiplayer = Multiplayer;
})();
