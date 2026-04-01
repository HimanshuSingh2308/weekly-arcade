/**
 * Multiplayer Client — WebSocket + REST client for multiplayer games.
 * Lazy-loaded only by multiplayer games (not included in GameLayout).
 *
 * Depends on:
 * - socket.io client (loaded via CDN script tag)
 * - window.apiClient (from api-client.js)
 * - window.authManager (from auth.js)
 */
(function () {
  'use strict';

  const REALTIME_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://weekly-arcade.onrender.com';

  let socket = null;
  let currentSessionId = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 10;

  // Event callback storage
  const listeners = {
    'game:state': [],
    'game:move-rejected': [],
    'game:started': [],
    'game:finished': [],
    'session:player-joined': [],
    'session:player-left': [],
    'session:player-reconnected': [],
    'session:player-ready': [],
    'session:host-changed': [],
    'error': [],
  };

  // Client-side prediction state
  let predictedState = null;
  let lastServerVersion = 0;

  // ─── WebSocket Connection ──────────────────────────────────────────

  async function connect(sessionId) {
    if (socket && socket.connected) {
      console.warn('[MP] Already connected');
      return;
    }

    const token = window.apiClient?.token;
    if (!token) {
      throw new Error('Authentication required for multiplayer');
    }

    currentSessionId = sessionId;

    return new Promise((resolve, reject) => {
      socket = io(`${REALTIME_URL}/game`, {
        auth: { token },
        query: { sessionId },
        reconnection: true,
        reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
      });

      socket.on('connect', () => {
        console.log('[MP] Connected to realtime service');
        reconnectAttempts = 0;
        resolve();
      });

      socket.on('connect_error', (err) => {
        console.error('[MP] Connection error:', err.message);
        reconnectAttempts++;
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          reject(new Error('Failed to connect to multiplayer service'));
        }
      });

      socket.on('disconnect', (reason) => {
        console.log('[MP] Disconnected:', reason);
        _emit('error', { code: 'DISCONNECTED', message: reason });
      });

      // Register all event forwarders
      for (const event of Object.keys(listeners)) {
        socket.on(event, (data) => _emit(event, data));
      }

      // Track server state version
      socket.on('game:state', (data) => {
        lastServerVersion = data.version || 0;
        // If prediction was active, reconcile
        if (predictedState !== null) {
          predictedState = null; // Server state takes precedence
        }
      });
    });
  }

  function disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    currentSessionId = null;
    predictedState = null;
    lastServerVersion = 0;
    // Clear all listeners
    for (const key of Object.keys(listeners)) {
      listeners[key] = [];
    }
  }

  function isConnected() {
    return socket && socket.connected;
  }

  // ─── Game Actions (via WebSocket) ──────────────────────────────────

  function submitMove(moveType, moveData) {
    if (!socket || !socket.connected) {
      console.error('[MP] Not connected');
      return;
    }
    socket.emit('game:move', { moveType, moveData: moveData || {} });
  }

  function signalReady() {
    if (socket) socket.emit('game:ready', {});
  }

  function forfeit() {
    if (socket) socket.emit('game:forfeit', {});
  }

  // ─── Client-side Prediction (real-time games) ─────────────────────

  /**
   * Apply a move optimistically for instant feedback.
   * @param {string} moveType
   * @param {object} moveData
   * @param {function} predictor - (currentState, moveData) => predictedState
   * @returns {object} The predicted state (for immediate rendering)
   */
  function predictMove(moveType, moveData, predictor) {
    if (typeof predictor === 'function') {
      const currentState = predictedState || _getLastKnownState();
      predictedState = predictor(currentState, moveData);
    }
    submitMove(moveType, moveData);
    return predictedState;
  }

  function _getLastKnownState() {
    // Return the last state received from server
    // Games should track this themselves; this is a fallback
    return {};
  }

  // ─── Event Listeners ──────────────────────────────────────────────

  function _emit(event, data) {
    const cbs = listeners[event] || [];
    for (const cb of cbs) {
      try { cb(data); } catch (e) { console.error(`[MP] Listener error for ${event}:`, e); }
    }
  }

  function on(event, callback) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
  }

  function off(event, callback) {
    if (!listeners[event]) return;
    if (callback) {
      listeners[event] = listeners[event].filter(cb => cb !== callback);
    } else {
      listeners[event] = [];
    }
  }

  // Convenience methods
  function onGameState(cb) { on('game:state', cb); }
  function onPlayerJoined(cb) { on('session:player-joined', cb); }
  function onPlayerLeft(cb) { on('session:player-left', cb); }
  function onGameStarted(cb) { on('game:started', cb); }
  function onGameFinished(cb) { on('game:finished', cb); }
  function onMoveRejected(cb) { on('game:move-rejected', cb); }
  function onError(cb) { on('error', cb); }

  // ─── Session Management (via REST → apiClient) ────────────────────

  async function createSession(gameId, config) {
    return window.apiClient?.request('/multiplayer/sessions', {
      method: 'POST',
      body: JSON.stringify({
        gameId,
        mode: config?.mode || 'private',
        maxPlayers: config?.maxPlayers || 2,
        minPlayers: config?.minPlayers,
        gameConfig: config?.gameConfig,
        spectatorAllowed: config?.spectatorAllowed,
      }),
    });
  }

  async function joinSession(sessionId) {
    return window.apiClient?.request(`/multiplayer/sessions/${sessionId}/join`, { method: 'POST' });
  }

  async function joinByCode(code) {
    return window.apiClient?.request(`/multiplayer/sessions/join-code/${code}`, { method: 'POST' });
  }

  async function leaveSession(sessionId) {
    const sid = sessionId || currentSessionId;
    disconnect();
    return window.apiClient?.request(`/multiplayer/sessions/${sid}/leave`, { method: 'POST' });
  }

  async function startGame(sessionId) {
    return window.apiClient?.request(`/multiplayer/sessions/${sessionId || currentSessionId}/start`, { method: 'POST' });
  }

  async function getSession(sessionId) {
    return window.apiClient?.request(`/multiplayer/sessions/${sessionId || currentSessionId}`);
  }

  async function getActiveSessions() {
    return window.apiClient?.request('/multiplayer/sessions/active');
  }

  // ─── Matchmaking (via REST) ───────────────────────────────────────

  async function findMatch(gameId) {
    return window.apiClient?.request('/multiplayer/matchmaking/find', {
      method: 'POST',
      body: JSON.stringify({ gameId }),
    });
  }

  async function cancelMatchmaking() {
    return window.apiClient?.request('/multiplayer/matchmaking/cancel', { method: 'DELETE' });
  }

  async function getMatchmakingStatus() {
    return window.apiClient?.request('/multiplayer/matchmaking/status');
  }

  // ─── Invitations (via REST) ───────────────────────────────────────

  async function inviteFriend(sessionId, friendUid) {
    return window.apiClient?.request('/multiplayer/invitations', {
      method: 'POST',
      body: JSON.stringify({ sessionId, friendUid }),
    });
  }

  async function getInvitations() {
    return window.apiClient?.request('/multiplayer/invitations');
  }

  async function respondToInvitation(invitationId, accept) {
    return window.apiClient?.request(`/multiplayer/invitations/${invitationId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ action: accept ? 'accept' : 'decline' }),
    });
  }

  // ─── History & Stats (via REST) ───────────────────────────────────

  async function getMatchHistory() {
    return window.apiClient?.request('/multiplayer/history');
  }

  async function getMultiplayerStats() {
    return window.apiClient?.request('/multiplayer/stats');
  }

  // ─── Token Refresh ────────────────────────────────────────────────

  // Piggyback on authManager's token refresh
  if (window.authManager) {
    const originalRefresh = window.authManager._refreshToken;
    if (typeof originalRefresh === 'function') {
      window.authManager._refreshToken = async function () {
        const result = await originalRefresh.call(window.authManager);
        // Notify WebSocket of new token
        if (socket && socket.connected && window.apiClient?.token) {
          socket.emit('auth:refresh', { token: window.apiClient.token });
        }
        return result;
      };
    }
  }

  // ─── Pre-warm & Keep-alive ───────────────────────────────────────

  let warmSocket = null;
  let keepAliveTimer = null;

  /**
   * Pre-warm the WebSocket connection on page load.
   * Creates a lightweight connection to wake up the server (cold start)
   * and keeps it alive with periodic pings so the server stays warm.
   * The warm socket is disconnected and replaced when a real game connect() happens.
   */
  function warmUp() {
    if (warmSocket || (socket && socket.connected)) return;

    const token = window.apiClient?.token;
    if (!token) return; // Not signed in yet, skip

    warmSocket = io(`${REALTIME_URL}/game`, {
      auth: { token },
      query: { sessionId: '_warmup' },
      reconnection: false,
      timeout: 15000,
      transports: ['websocket'], // Skip polling, go straight to WS
    });

    warmSocket.on('connect', () => {
      console.log('[MP] Warm-up connection established');
      // Send periodic pings to keep the server process alive
      keepAliveTimer = setInterval(() => {
        if (warmSocket?.connected) {
          warmSocket.emit('ping');
        }
      }, 25000); // Every 25s (Render idles after 30s of inactivity)
    });

    warmSocket.on('connect_error', () => {
      // Silently fail — warm-up is best-effort
      _cleanupWarm();
    });

    warmSocket.on('disconnect', () => {
      _cleanupWarm();
    });
  }

  function _cleanupWarm() {
    if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
    if (warmSocket) { try { warmSocket.disconnect(); } catch (e) {} warmSocket = null; }
  }

  // Override connect to tear down warm socket first
  const _originalConnect = connect;
  connect = async function (sessionId) {
    _cleanupWarm(); // Close warm-up connection before real game connection
    return _originalConnect(sessionId);
  };

  // Auto-warm when auth is ready (non-blocking)
  const warmCheck = setInterval(() => {
    if (window.authManager?.isInitialized && window.apiClient?.token) {
      clearInterval(warmCheck);
      setTimeout(warmUp, 1000); // Slight delay to not compete with page load
    }
  }, 500);

  // ─── Public API ───────────────────────────────────────────────────

  window.multiplayerClient = {
    // Connection
    connect,
    disconnect,
    isConnected,
    warmUp,

    // Game actions (WebSocket)
    submitMove,
    signalReady,
    forfeit,
    predictMove,

    // Event listeners
    on,
    off,
    onGameState,
    onPlayerJoined,
    onPlayerLeft,
    onGameStarted,
    onGameFinished,
    onMoveRejected,
    onError,

    // Session management (REST)
    createSession,
    joinSession,
    joinByCode,
    leaveSession,
    startGame,
    getSession,
    getActiveSessions,

    // Matchmaking (REST)
    findMatch,
    cancelMatchmaking,
    getMatchmakingStatus,

    // Invitations (REST)
    inviteFriend,
    getInvitations,
    respondToInvitation,

    // History
    getMatchHistory,
    getMultiplayerStats,
  };

  console.log('[MP] Multiplayer client loaded');
})();
