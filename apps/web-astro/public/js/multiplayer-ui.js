/**
 * Multiplayer UI — Reusable lobby, matchmaking, results, and overlay components.
 * Follows the self-injecting HTML/CSS pattern used by AuthNudge in auth.js.
 *
 * Depends on:
 * - window.multiplayerClient (from multiplayer-client.js)
 */
(function () {
  'use strict';

  let lobbyContainer = null;
  let matchmakingOverlay = null;
  let resultsOverlay = null;
  let disconnectOverlay = null;

  // ─── Shared styles ────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('mp-ui-styles')) return;

    const style = document.createElement('style');
    style.id = 'mp-ui-styles';
    style.textContent = `
      .mp-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.7); display: flex; align-items: center;
        justify-content: center; z-index: 10000; backdrop-filter: blur(4px);
      }
      .mp-card {
        background: #1a1a2e; color: #eee; border-radius: 16px;
        padding: 32px; max-width: 420px; width: 90%; text-align: center;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5); font-family: system-ui, sans-serif;
      }
      .mp-card h2 { margin: 0 0 16px; font-size: 1.4em; }
      .mp-card h3 { margin: 0 0 8px; font-size: 1.1em; color: #aaa; }
      .mp-player-list { list-style: none; padding: 0; margin: 16px 0; }
      .mp-player-list li {
        display: flex; align-items: center; justify-content: space-between;
        padding: 10px 14px; margin: 6px 0; background: #16213e;
        border-radius: 10px; font-size: 0.95em;
      }
      .mp-player-list .mp-ready { color: #4ade80; }
      .mp-player-list .mp-host { color: #fbbf24; font-size: 0.8em; }
      .mp-btn {
        display: inline-block; padding: 12px 28px; border: none; border-radius: 10px;
        font-size: 1em; font-weight: 600; cursor: pointer; margin: 6px;
        transition: transform 0.1s, opacity 0.2s;
      }
      .mp-btn:hover { transform: scale(1.03); }
      .mp-btn:active { transform: scale(0.97); }
      .mp-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
      .mp-btn-primary { background: #6366f1; color: #fff; }
      .mp-btn-secondary { background: #374151; color: #eee; }
      .mp-btn-danger { background: #ef4444; color: #fff; }
      .mp-spinner {
        width: 48px; height: 48px; border: 4px solid #444;
        border-top: 4px solid #6366f1; border-radius: 50%;
        animation: mp-spin 0.8s linear infinite; margin: 20px auto;
      }
      @keyframes mp-spin { to { transform: rotate(360deg); } }
      .mp-code {
        font-family: monospace; font-size: 1.8em; letter-spacing: 0.2em;
        background: #16213e; padding: 12px 20px; border-radius: 10px;
        display: inline-block; margin: 12px 0; user-select: all;
      }
      .mp-results-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      .mp-results-table th, .mp-results-table td {
        padding: 8px 12px; text-align: left; border-bottom: 1px solid #333;
      }
      .mp-results-table .mp-winner { color: #4ade80; font-weight: 600; }
      .mp-toast {
        position: fixed; top: 20px; right: 20px; z-index: 10001;
        background: #1e293b; color: #eee; padding: 16px 20px;
        border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        font-family: system-ui, sans-serif; max-width: 340px;
        animation: mp-slide-in 0.3s ease-out;
      }
      @keyframes mp-slide-in { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      .mp-toast-actions { margin-top: 10px; }
    `;
    document.head.appendChild(style);
  }

  // ─── Lobby UI ─────────────────────────────────────────────────────

  function createLobbyUI(containerId, options = {}) {
    injectStyles();
    const container = document.getElementById(containerId);
    if (!container) return;
    lobbyContainer = container;

    const { sessionId, isHost, joinCode, gameName, onStart, onLeave, onInvite } = options;

    container.innerHTML = `
      <div class="mp-card" style="max-width:500px;">
        <h2>${gameName || 'Multiplayer Lobby'}</h2>
        ${joinCode ? `<div><h3>Join Code</h3><div class="mp-code">${joinCode}</div></div>` : ''}
        <h3>Players</h3>
        <ul class="mp-player-list" id="mp-lobby-players"></ul>
        <div id="mp-lobby-actions">
          ${isHost ? '<button class="mp-btn mp-btn-primary" id="mp-start-btn" disabled>Start Game</button>' : '<p style="color:#aaa">Waiting for host to start...</p>'}
          ${typeof onInvite === 'function' ? '<button class="mp-btn mp-btn-secondary" id="mp-invite-btn">Invite Friend</button>' : ''}
          <button class="mp-btn mp-btn-danger" id="mp-leave-btn">Leave</button>
        </div>
      </div>
    `;

    const startBtn = document.getElementById('mp-start-btn');
    const leaveBtn = document.getElementById('mp-leave-btn');
    const inviteBtn = document.getElementById('mp-invite-btn');

    if (startBtn && onStart) startBtn.addEventListener('click', () => onStart(sessionId));
    if (leaveBtn && onLeave) leaveBtn.addEventListener('click', () => onLeave(sessionId));
    if (inviteBtn && onInvite) inviteBtn.addEventListener('click', () => onInvite(sessionId));

    return {
      updatePlayers(players) {
        const list = document.getElementById('mp-lobby-players');
        if (!list) return;
        list.innerHTML = Object.entries(players)
          .filter(([, p]) => p.status !== 'left')
          .map(([uid, p]) => `
            <li>
              <span>${p.displayName || 'Player'}${p.isHost ? ' <span class="mp-host">(Host)</span>' : ''}</span>
              <span class="mp-ready">${p.status === 'connected' ? 'Connected' : 'Disconnected'}</span>
            </li>
          `).join('');

        if (startBtn) {
          const connectedCount = Object.values(players).filter(p => p.status === 'connected').length;
          startBtn.disabled = connectedCount < 2;
        }
      },
      destroy() {
        if (container) container.innerHTML = '';
        lobbyContainer = null;
      },
    };
  }

  // ─── Matchmaking Overlay ──────────────────────────────────────────

  function showMatchmaking(gameName, onCancel) {
    injectStyles();
    hideMatchmaking();

    matchmakingOverlay = document.createElement('div');
    matchmakingOverlay.className = 'mp-overlay';
    matchmakingOverlay.innerHTML = `
      <div class="mp-card">
        <h2>Finding Opponent</h2>
        <p style="color:#aaa">${gameName || 'Searching for a match...'}</p>
        <div class="mp-spinner"></div>
        <button class="mp-btn mp-btn-secondary" id="mp-cancel-match">Cancel</button>
      </div>
    `;
    document.body.appendChild(matchmakingOverlay);

    document.getElementById('mp-cancel-match')?.addEventListener('click', () => {
      hideMatchmaking();
      if (onCancel) onCancel();
    });
  }

  function hideMatchmaking() {
    if (matchmakingOverlay) {
      matchmakingOverlay.remove();
      matchmakingOverlay = null;
    }
  }

  // ─── Invitation Toast ─────────────────────────────────────────────

  function showInvitationToast(invitation, onAccept, onDecline) {
    injectStyles();

    const toast = document.createElement('div');
    toast.className = 'mp-toast';
    toast.innerHTML = `
      <strong>${invitation.fromDisplayName || 'A friend'}</strong> invited you to play!
      <div class="mp-toast-actions">
        <button class="mp-btn mp-btn-primary" style="padding:8px 16px;font-size:0.9em" id="mp-toast-accept">Join</button>
        <button class="mp-btn mp-btn-secondary" style="padding:8px 16px;font-size:0.9em" id="mp-toast-decline">Decline</button>
      </div>
    `;
    document.body.appendChild(toast);

    document.getElementById('mp-toast-accept')?.addEventListener('click', () => {
      toast.remove();
      if (onAccept) onAccept(invitation);
    });

    document.getElementById('mp-toast-decline')?.addEventListener('click', () => {
      toast.remove();
      if (onDecline) onDecline(invitation);
    });

    // Auto-dismiss after 30 seconds
    setTimeout(() => toast.remove(), 30000);
  }

  // ─── Results Screen ───────────────────────────────────────────────

  function showResults(results, options = {}) {
    injectStyles();
    hideResults();

    const players = Object.entries(results)
      .sort(([, a], [, b]) => a.rank - b.rank);

    resultsOverlay = document.createElement('div');
    resultsOverlay.className = 'mp-overlay';
    resultsOverlay.innerHTML = `
      <div class="mp-card">
        <h2>Game Over!</h2>
        <table class="mp-results-table">
          <thead><tr><th>#</th><th>Player</th><th>Score</th><th>Result</th></tr></thead>
          <tbody>
            ${players.map(([uid, p]) => `
              <tr class="${p.outcome === 'win' ? 'mp-winner' : ''}">
                <td>${p.rank}</td>
                <td>${p.displayName || uid.slice(0, 8)}</td>
                <td>${p.score}</td>
                <td>${p.outcome === 'win' ? 'Winner' : p.outcome === 'draw' ? 'Draw' : 'Lost'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="margin-top:16px">
          ${options.onPlayAgain ? '<button class="mp-btn mp-btn-primary" id="mp-play-again">Play Again</button>' : ''}
          <button class="mp-btn mp-btn-secondary" id="mp-results-close">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(resultsOverlay);

    document.getElementById('mp-play-again')?.addEventListener('click', () => {
      hideResults();
      if (options.onPlayAgain) options.onPlayAgain();
    });

    document.getElementById('mp-results-close')?.addEventListener('click', () => {
      hideResults();
      if (options.onClose) options.onClose();
    });
  }

  function hideResults() {
    if (resultsOverlay) {
      resultsOverlay.remove();
      resultsOverlay = null;
    }
  }

  // ─── Disconnect Overlay ───────────────────────────────────────────

  function showDisconnectOverlay() {
    injectStyles();
    hideDisconnectOverlay();

    disconnectOverlay = document.createElement('div');
    disconnectOverlay.className = 'mp-overlay';
    disconnectOverlay.innerHTML = `
      <div class="mp-card">
        <h2>Connection Lost</h2>
        <p style="color:#aaa">Attempting to reconnect...</p>
        <div class="mp-spinner"></div>
      </div>
    `;
    document.body.appendChild(disconnectOverlay);
  }

  function hideDisconnectOverlay() {
    if (disconnectOverlay) {
      disconnectOverlay.remove();
      disconnectOverlay = null;
    }
  }

  // ─── Public API ───────────────────────────────────────────────────

  window.multiplayerUI = {
    createLobbyUI,
    showMatchmaking,
    hideMatchmaking,
    showInvitationToast,
    showResults,
    hideResults,
    showDisconnectOverlay,
    hideDisconnectOverlay,
  };

  console.log('[MP-UI] Multiplayer UI loaded');
})();
