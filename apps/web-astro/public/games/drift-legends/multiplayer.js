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
  let lobby = null;

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
      // Clean up any stale sessions before matchmaking (prevents 409 "max sessions" error)
      try {
        if (currentSessionId) {
          await window.multiplayerClient?.leaveSession(currentSessionId);
          currentSessionId = null;
        }
        // Also try to leave any sessions via the API
        var mySessions = await window.apiClient?.request('GET', '/multiplayer/sessions/mine');
        if (mySessions && Array.isArray(mySessions)) {
          for (var s = 0; s < mySessions.length; s++) {
            try { await window.multiplayerClient?.leaveSession(mySessions[s].id); } catch(_) {}
          }
        }
      } catch (_) { /* cleanup is best-effort */ }

      window.multiplayerUI?.showMatchmaking('Drift Legends', async () => {
        await window.multiplayerClient?.cancelMatchmaking();
      });

      const result = await window.multiplayerClient?.findMatch(GAME_ID);
      if (result?.matchedSessionId) {
        try {
          await joinSession(result.matchedSessionId);
          window.multiplayerUI?.hideMatchmaking();
        } catch (joinErr) {
          // Session was stale — leave it and retry once
          console.warn('Matched session stale, retrying...', joinErr);
          try { await window.multiplayerClient?.leaveSession(result.matchedSessionId); } catch(_) {}
          const retry = await window.multiplayerClient?.findMatch(GAME_ID);
          if (retry?.matchedSessionId) {
            await joinSession(retry.matchedSessionId);
            window.multiplayerUI?.hideMatchmaking();
          } else {
            _pollForMatch();
          }
        }
      } else {
        _pollForMatch();
      }
    } catch (err) {
      window.multiplayerUI?.hideMatchmaking();
      console.error('Matchmaking error:', err);
    }
  }

  async function createPrivateRoom(uid) {
    myUid = uid;
    try {
      const session = await window.multiplayerClient?.createSession(GAME_ID, {
        mode: 'private',
        maxPlayers: 2,
        gameConfig: { laps: 2 },
      });
      currentSessionId = session.sessionId;
      isHost = true;
      _setupSocketListeners();
      return session;
    } catch (err) {
      console.error('Create room error:', err);
      return null;
    }
  }

  async function joinSession(sessionId) {
    currentSessionId = sessionId;
    await window.multiplayerClient?.joinSession(sessionId);
    _setupSocketListeners();
  }

  async function joinByCode(code) {
    try {
      const result = await window.multiplayerClient?.joinByCode(code);
      if (result?.sessionId) {
        await joinSession(result.sessionId);
      }
    } catch (err) {
      console.error('Join by code error:', err);
    }
  }

  function _setupSocketListeners() {
    const client = window.multiplayerClient;
    if (!client) return;

    client.onStateUpdate((state) => {
      gameState = state;
      // Check if both players are in and game is starting
      if (state.status === 'racing' && onRaceStart) {
        onRaceStart(state);
      }
    });

    client.onMoveReceived((move) => {
      if (move.uid === myUid) return;
      opponentUid = move.uid;

      if (move.moveType === 'position-update') {
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
    });

    client.onGameOver((result) => {
      if (onRaceEnd) onRaceEnd(result);
    });

    client.onDisconnect(() => {
      if (onDisconnect) onDisconnect();
    });

    client.onReconnect(() => {
      if (onReconnect) onReconnect();
    });
  }

  /** Start sending position updates */
  function startSync(getPositionFn) {
    stopSync();
    syncInterval = setInterval(() => {
      if (!currentSessionId || !window.multiplayerClient) return;
      const posData = getPositionFn();
      if (!posData) return;
      try {
        window.multiplayerClient.submitMove(currentSessionId, 'position-update', {
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
      await window.multiplayerClient.submitMove(currentSessionId, 'lap-complete', {
        lapTimeMs,
        lapNumber,
        checkpointSequence,
      });
    } catch (_) { /* ignore */ }
  }

  async function sendRaceFinish(totalTimeMs, finalDriftScore) {
    if (!currentSessionId || !window.multiplayerClient) return;
    try {
      await window.multiplayerClient.submitMove(currentSessionId, 'race-finish', {
        totalTimeMs,
        finalDriftScore,
      });
    } catch (_) { /* ignore */ }
  }

  async function startGame() {
    if (!currentSessionId || !window.multiplayerClient) return;
    try {
      await window.multiplayerClient.startGame(currentSessionId);
    } catch (err) {
      console.error('Start game error:', err);
    }
  }

  function leaveSession() {
    stopSync();
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

  async function _pollForMatch() {
    // Simple polling pattern for matchmaking
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      if (attempts > 30) {
        clearInterval(poll);
        window.multiplayerUI?.hideMatchmaking();
        return;
      }
      try {
        const result = await window.multiplayerClient?.checkMatchStatus();
        if (result?.matchedSessionId) {
          clearInterval(poll);
          window.multiplayerUI?.hideMatchmaking();
          await joinSession(result.matchedSessionId);
        }
      } catch (_) { /* retry */ }
    }, 2000);
  }

  // Check for deep link join
  function checkDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('join');
    return code || null;
  }

  const Multiplayer = {
    init,
    warmUp,
    quickMatch,
    createPrivateRoom,
    joinSession,
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
