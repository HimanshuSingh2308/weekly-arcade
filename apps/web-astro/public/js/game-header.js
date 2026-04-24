/**
 * Game Header — shared, scalable header component for all games.
 *
 * Usage:
 *   const header = window.gameHeader.init({
 *     title: 'Snake',
 *     icon: '🐍',              // optional emoji icon before title
 *     gameId: 'snake',          // for leaderboard deep link + auth
 *     buttons: ['sound', 'leaderboard', 'auth'],
 *     onSound: () => toggleSound(),
 *     // Auth is handled automatically via gameCloud.initAuth
 *     onSignIn: (user) => { ... },
 *     onSignOut: () => { ... },
 *   });
 *
 * The header auto-injects CSS, renders HTML, and wires auth.
 * Games just need: <header id="gameHeader"></header>
 * No per-game header CSS or auth polling needed.
 */

(function () {
  let injected = false;

  const CSS = `
    .gh {
      position: relative;
      background: var(--bg-secondary, #1a1a2e);
      border-bottom: 1px solid var(--border, rgba(255,255,255,0.06));
      padding: 0.55rem 0.75rem;
      padding-top: max(0.55rem, env(safe-area-inset-top), var(--safe-area-top, 0px));
      padding-left: max(0.75rem, env(safe-area-inset-left));
      padding-right: max(0.75rem, env(safe-area-inset-right));
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 40;
    }
    .gh-back {
      color: var(--text-secondary, #888);
      text-decoration: none;
      font-size: 1.3rem;
      min-width: 44px;
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s;
      flex-shrink: 0;
    }
    .gh-back:hover { color: var(--accent, #e94560); }

    .gh-title {
      font-size: 1.05rem;
      font-weight: 700;
      margin: 0;
      color: #f0f0f5;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      flex: 1;
      min-width: 0;
      margin-left: 0.25rem;
    }
    .gh-title span:last-child {
      overflow: hidden;
      text-overflow: ellipsis;
    }

    @media (min-width: 600px) {
      .gh-title {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        flex: none;
        margin-left: 0;
        pointer-events: none;
      }
    }

    .gh-right {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      flex-shrink: 0;
    }

    .gh-btn {
      background: none;
      border: 1px solid var(--border, rgba(255,255,255,0.1));
      color: var(--text-primary, #eee);
      width: 34px;
      height: 34px;
      border-radius: 8px;
      font-size: 0.85rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color 0.2s, opacity 0.2s;
      position: relative;
      padding: 0;
      flex-shrink: 0;
    }
    .gh-btn:hover { border-color: var(--accent, #e94560); }
    .gh-btn.muted, .gh-btn:disabled { opacity: 0.4; }

    .gh-btn-badge {
      position: absolute;
      top: -3px;
      right: -3px;
      background: var(--accent, #e94560);
      color: #fff;
      font-size: 0.5rem;
      font-weight: 700;
      padding: 0.05rem 0.25rem;
      border-radius: 4px;
      line-height: 1.2;
    }

    .gh-auth {
      background: var(--accent, #e94560);
      color: #fff;
      border: none;
      padding: 0.3rem 0.75rem;
      border-radius: 10px;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      min-height: 34px;
      display: flex;
      align-items: center;
      transition: opacity 0.2s;
      flex-shrink: 0;
    }
    .gh-auth:hover { opacity: 0.85; }

    /* Avatar style when signed in */
    .gh-avatar {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      border: 2px solid var(--accent, #e94560);
      cursor: pointer;
      object-fit: cover;
      flex-shrink: 0;
    }
    .gh-avatar-initial {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: var(--accent, #e94560);
      color: #fff;
      font-weight: 700;
      font-size: 0.8rem;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
    }
  `;

  function injectCSS() {
    if (injected) return;
    injected = true;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  /**
   * @param {Object} opts
   * @param {string} opts.title - Game name
   * @param {string} [opts.icon] - Emoji icon before title
   * @param {string} opts.gameId - For leaderboard link
   * @param {string[]} [opts.buttons] - ['sound','leaderboard','auth','hint','help','menu','undo']
   * @param {Function} [opts.onSound] - Sound toggle callback
   * @param {Function} [opts.onHint] - Hint callback
   * @param {Function} [opts.onHelp] - Help callback
   * @param {Function} [opts.onMenu] - Menu callback
   * @param {Function} [opts.onUndo] - Undo callback
   * @param {string} [opts.soundBtnId] - Custom ID for sound button
   * @param {string} [opts.hintBtnId] - Custom ID for hint button
   * @param {string} [opts.undoBtnId] - Custom ID for undo button
   * @param {string} [opts.authBtnId] - Custom ID for auth button
   * @param {string} [opts.containerId] - ID of container element (default: 'gameHeader')
   * @param {number} [opts.hintCount] - Initial hint count badge
   */
  function init(opts = {}) {
    injectCSS();

    const container = document.getElementById(opts.containerId || 'gameHeader');
    if (!container) {
      console.warn('[gameHeader] No container found');
      return;
    }

    const buttons = opts.buttons || ['sound', 'leaderboard', 'auth'];
    const authBtnId = opts.authBtnId || 'authBtn';
    const soundBtnId = opts.soundBtnId || 'ghSoundBtn';
    const hintBtnId = opts.hintBtnId || 'ghHintBtn';
    const undoBtnId = opts.undoBtnId || 'ghUndoBtn';

    let rightHTML = '';

    buttons.forEach(btn => {
      switch (btn) {
        case 'hint':
          rightHTML += `<button class="gh-btn" id="${hintBtnId}" title="Hint">💡${opts.hintCount !== undefined ? `<span class="gh-btn-badge" id="ghHintCount">${opts.hintCount}</span>` : ''}</button>`;
          break;
        case 'undo':
          rightHTML += `<button class="gh-btn" id="${undoBtnId}" title="Undo" style="display:none;">↩</button>`;
          break;
        case 'sound':
          rightHTML += `<button class="gh-btn" id="${soundBtnId}" title="Sound">🔊</button>`;
          break;
        case 'leaderboard':
          rightHTML += `<button class="gh-btn" title="Leaderboard" onclick="window.location.href='/leaderboard/?game=${opts.gameId}'">🏆</button>`;
          break;
        case 'help':
          rightHTML += `<button class="gh-btn" title="How to Play">❓</button>`;
          break;
        case 'menu':
          rightHTML += `<button class="gh-btn" title="Menu">☰</button>`;
          break;
        case 'auth':
          rightHTML += `<button class="${'gh-auth'}" id="${authBtnId}">Sign In</button>`;
          break;
      }
    });

    container.className = 'gh';
    container.innerHTML = `
      <a href="/" class="gh-back">←</a>
      <h1 class="gh-title">${opts.icon ? `<span>${opts.icon}</span>` : ''}<span>${opts.title}</span></h1>
      <div class="gh-right">${rightHTML}</div>
    `;

    // Wire up button callbacks
    if (opts.onSound) {
      const soundEl = document.getElementById(soundBtnId);
      if (soundEl) soundEl.addEventListener('click', () => {
        const result = opts.onSound();
        // Auto-update icon: onSound may return true (unmuted) / false (muted)
        // If undefined (most games), toggle based on current icon state
        let isMuted;
        if (result === true) {
          isMuted = false;
        } else if (result === false) {
          isMuted = true;
        } else {
          // No return value — toggle based on current icon
          isMuted = !soundEl.classList.contains('muted');
        }
        soundEl.textContent = isMuted ? '\ud83d\udd07' : '\ud83d\udd0a';
        soundEl.classList.toggle('muted', isMuted);
      });
    }
    if (opts.onHint) {
      const hintEl = document.getElementById(hintBtnId);
      if (hintEl) hintEl.addEventListener('click', opts.onHint);
    }
    if (opts.onHelp) {
      const helpEl = container.querySelector('[title="How to Play"]');
      if (helpEl) helpEl.addEventListener('click', opts.onHelp);
    }
    if (opts.onMenu) {
      const menuEl = container.querySelector('[title="Menu"]');
      if (menuEl) menuEl.addEventListener('click', opts.onMenu);
    }
    if (opts.onUndo) {
      const undoEl = document.getElementById(undoBtnId);
      if (undoEl) undoEl.addEventListener('click', opts.onUndo);
    }

    // ── Auto-wire auth via gameCloud ──
    // If auth button is present and gameCloud exists, automatically init auth.
    // Games can still pass onSignIn/onSignOut for game-specific logic.
    if (buttons.includes('auth') && window.gameCloud) {
      window.gameCloud.initAuth({
        authBtnId: authBtnId,
        onSignIn: (user) => { if (opts.onSignIn) opts.onSignIn(user); },
        onSignOut: () => { if (opts.onSignOut) opts.onSignOut(); },
      });
    }

    return {
      setSoundMuted: (muted) => {
        const el = document.getElementById(soundBtnId);
        if (el) { el.textContent = muted ? '🔇' : '🔊'; el.classList.toggle('muted', muted); }
      },
      setHintCount: (n) => {
        const el = document.getElementById('ghHintCount');
        if (el) el.textContent = n;
        const btn = document.getElementById(hintBtnId);
        if (btn) btn.disabled = n <= 0;
      },
      showUndo: (show, count) => {
        const el = document.getElementById(undoBtnId);
        if (el) { el.style.display = show ? 'flex' : 'none'; if (count !== undefined) el.textContent = `↩${count}`; }
      },
      getAuthBtn: () => document.getElementById(authBtnId),
    };
  }

  // ── iOS Audio Unlock (global, one-time) ──
  // iOS Safari suspends AudioContext until first user gesture.
  // This creates + plays a silent buffer on the first touch/click to unlock it.
  function unlockIOSAudio() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      // Close this throwaway context — individual games create their own
      setTimeout(() => { try { ctx.close(); } catch(e){} }, 100);
    } catch (e) {}
    document.removeEventListener('touchstart', unlockIOSAudio);
    document.removeEventListener('click', unlockIOSAudio);
  }
  document.addEventListener('touchstart', unlockIOSAudio, { once: true, passive: true });
  document.addEventListener('click', unlockIOSAudio, { once: true });

  function hide() {
    var el = document.getElementById('gameHeader');
    if (el) el.style.display = 'none';
  }

  function show() {
    var el = document.getElementById('gameHeader');
    if (el) el.style.display = '';
  }

  window.gameHeader = { init, hide, show };
})();
