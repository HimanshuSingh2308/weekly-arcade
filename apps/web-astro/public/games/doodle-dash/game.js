'use strict';
/**
 * Doodle Dash - Game Client
 *
 * Architecture:
 *  - Multiplayer via window.multiplayerClient (Socket.IO + REST, loaded before this script)
 *  - window.apiClient for score submission
 *  - window.authManager for current user info
 *  - Canvas 2D drawing with Pointer Events API (mouse + touch unified)
 *  - Stroke format: { x0, y0, x1, y1, color, width, tool } - delta events, NOT pixel data
 *  - Flood-fill for bucket tool (client-side only, then serialized as fill move)
 */
(function () {
  // ─── Constants ──────────────────────────────────────────────────
  var GAME_ID       = 'doodle-dash';
  var CANVAS_W      = 800;   // logical canvas size
  var CANVAS_H      = 600;
  var TURN_TIMEOUT  = 80;    // seconds - Classic mode drawing time
  var SD_TIMEOUT    = 60;    // seconds - Speed Draw mode
  var WORD_CHOICE_T = 15;    // seconds to pick a word
  var HINT_1_SEC    = 25;    // reveal 1st letter after N seconds elapsed
  var HINT_2_SEC    = 50;    // reveal 2nd letter after N seconds elapsed
  var MAX_UNDO      = 20;
  var REVEAL_VOTE_T = 20;    // seconds to vote after Speed Draw reveal
  var NEXT_ROUND_T  = 5;     // countdown before next round
  var EMIT_RATE_HZ  = 20;    // max stroke emit frequency
  var EMIT_INTERVAL = Math.floor(1000 / EMIT_RATE_HZ);

  // Color palette (extendable with unlocks)
  var PALETTE = [
    '#000000', '#ffffff', '#808080', '#c0c0c0',
    '#ff0000', '#ff6600', '#ff9900', '#ffcc00',
    '#ffff00', '#99cc00', '#00cc00', '#009966',
    '#0099ff', '#0033ff', '#6600cc', '#cc00cc',
    '#ff99cc', '#ff6699', '#cc6633', '#663300',
  ];

  // ─── State ──────────────────────────────────────────────────────
  var gameMode       = 'classic';   // 'classic' | 'speed-draw'
  var roomCode       = null;
  var currentSessionId = null;
  var isHost         = false;
  var myUid          = null;
  var myName         = 'Guest';
  var players        = [];          // { uid, name, score, guessed, isDrawer }
  var gameState      = 'lobby';     // lobby | room | playing | reveal | result | gameover
  var currentRound   = 0;
  var totalRounds    = 6;
  var timerValue     = 80;
  var timerInterval  = null;
  var currentDrawer  = null;        // uid of current drawer (Classic)
  var amIDrawing     = false;
  var wordForDrawer  = null;        // full word (only if I am drawing or round ends)
  var wordHint       = '';          // underscore-masked hint shown to guessers
  var hintRevealed   = [false, false];
  var myScore        = 0;
  var sessionScores  = {};          // uid -> cumulative score
  var roundScores    = {};          // uid -> score delta this round

  // Canvas state
  var canvas         = null;
  var ctx            = null;
  var currentTool    = 'pen';
  var currentColor   = '#000000';
  var currentSize    = 3;
  var isPointerDown  = false;
  var lastX          = 0;
  var lastY          = 0;
  var strokeHistory  = [];          // array of stroke arrays for undo
  var currentStroke  = [];          // strokes in current segment (for undo grouping)
  var lastEmitTime   = 0;
  var pendingStroke  = null;        // queued stroke for rate limiting

  // Speed draw state
  var sdCanvases     = {};          // uid -> offscreen canvas data URL after reveal
  var myVotedFor     = null;        // uid I voted for
  var revealTimer    = null;

  // Timing
  var gameStartedAt  = 0;           // epoch ms when first round started (for score timeMs)

  // ─── Audio (Web Audio API) ──────────────────────────────────────
  var audioCtx = null;
  var audioUnlocked = false;

  function initAudio() {
    if (audioCtx) return;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  }

  function unlockAudio() {
    if (audioUnlocked) return;
    if (!audioCtx) initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    audioUnlocked = true;
  }

  function playTone(freq, duration, type) {
    if (!audioCtx) initAudio();
    if (!audioCtx) return;
    unlockAudio();
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (duration || 0.2));
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + (duration || 0.2));
  }

  function sfxCorrectGuess() { playTone(880, 0.15, 'sine'); setTimeout(function () { playTone(1100, 0.2, 'sine'); }, 100); }
  function sfxWrongGuess() { playTone(200, 0.15, 'square'); }
  function sfxTimerWarning() { playTone(440, 0.1, 'square'); }
  function sfxRoundEnd() { playTone(660, 0.1, 'sine'); setTimeout(function () { playTone(880, 0.1, 'sine'); }, 80); setTimeout(function () { playTone(1100, 0.2, 'sine'); }, 160); }

  // ─── DOM refs ───────────────────────────────────────────────────
  function $id(id) { return document.getElementById(id); }

  var elLobby         = $id('ddLobby');
  var elRoomLobby     = $id('ddRoomLobby');
  var elGame          = $id('ddGame');
  var elReveal        = $id('ddReveal');
  var elRoundResult   = $id('ddRoundResult');
  var elGameOver      = $id('ddGameOver');
  var elLoadingScreen = $id('ddLoadingScreen');
  var elNotifs        = $id('ddNotifs');

  // ─── Helpers ────────────────────────────────────────────────────
  // Track intervals for cleanup on screen transition
  var _revealCountInterval = null;
  var _nextRoundCountInterval = null;

  function showScreen(name) {
    var screens = [elLobby, elRoomLobby, elGame, elReveal, elRoundResult, elGameOver, elLoadingScreen];
    screens.forEach(function (el) { if (el) el.style.display = 'none'; });
    // Clear stale intervals on screen transition
    if (_revealCountInterval) { clearInterval(_revealCountInterval); _revealCountInterval = null; }
    if (_nextRoundCountInterval) { clearInterval(_nextRoundCountInterval); _nextRoundCountInterval = null; }
    var target = {
      lobby:      elLobby,
      room:       elRoomLobby,
      playing:    elGame,
      reveal:     elReveal,
      result:     elRoundResult,
      gameover:   elGameOver,
      loading:    elLoadingScreen,
    }[name];
    if (target) target.style.display = 'flex';
    gameState = name;
  }

  function showNotif(msg, duration) {
    var el = document.createElement('div');
    el.className = 'dd-notif';
    el.textContent = msg;
    elNotifs.appendChild(el);
    setTimeout(function () { el.remove(); }, duration || 2500);
  }

  var PLAYER_COLORS = ['#f5a623','#4ecdc4','#ff6b6b','#a78bfa','#34d399','#f472b6','#60a5fa','#fbbf24','#fb923c','#c084fc'];

  function showRoomLobby() {
    var codeEl = $id('roomCodeDisplay');
    if (codeEl) codeEl.textContent = roomCode || '------';
    var modeEl = $id('roomModeLabel');
    if (modeEl) modeEl.textContent = (gameMode === 'speed-draw' ? '⚡ Speed Draw' : '🎨 Classic');
    var startBtn = $id('btnStartGame');
    if (startBtn) startBtn.style.display = isHost ? 'inline-block' : 'none';
    var waitMsg = $id('waitingMsg');
    if (waitMsg) {
      waitMsg.textContent = isHost
        ? 'Press "Start Game" when everyone is in!'
        : 'Waiting for host to start the game...';
    }

    // Fetch existing players from session (joiner won't get player-joined events for players already in)
    if (window.multiplayerClient && currentSessionId) {
      window.multiplayerClient.getSession(currentSessionId).then(function (session) {
        if (!session || !session.players) return;
        Object.keys(session.players).forEach(function (uid) {
          var p = session.players[uid];
          if (p.status === 'left') return;
          if (players.find(function (existing) { return existing.uid === uid; })) return;
          players.push({
            uid: uid,
            name: p.displayName || uid,
            score: 0,
            guessed: false,
            isHost: uid === session.hostUid,
          });
        });
        renderRoomPlayers();
      }).catch(function () {});
    }

    renderRoomPlayers();
    showScreen('room');
  }

  var loadingTimeout = null;

  function setLoadingMsg(msg) {
    // Auto-cancel after 15s if still on loading screen
    if (loadingTimeout) clearTimeout(loadingTimeout);
    loadingTimeout = setTimeout(function () {
      if (gameState === 'loading') {
        showNotif('Connection timed out. Try again.', 4000);
        if (window.multiplayerClient) window.multiplayerClient.disconnect();
        currentSessionId = null;
        showScreen('lobby');
      }
    }, 15000);
    var el = $id('loadingMsg');
    if (el) el.textContent = msg;
    showScreen('loading');
  }

  function getUserInfo() {
    if (window.authManager && typeof window.authManager.getUser === 'function') {
      var user = window.authManager.getUser();
      if (user) {
        myUid  = user.uid;
        myName = user.displayName || user.email || 'Player';
        return;
      }
    }
    // Guest
    if (!myUid) {
      myUid  = 'guest-' + Math.random().toString(36).slice(2, 8);
      myName = 'Guest' + Math.floor(Math.random() * 9000 + 1000);
    }
  }

  function getPlayerName(uid) {
    var p = players.find(function (p) { return p.uid === uid; });
    return p ? p.name : uid;
  }

  // ─── Canvas Setup ───────────────────────────────────────────────
  var canvasInitialized = false;

  function initCanvas() {
    canvas = $id('ddCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width  = CANVAS_W;
    canvas.height = CANVAS_H;
    clearCanvas();
    if (!canvasInitialized) {
      buildColorPalette();
      bindDrawingTools();
      bindCanvasPointerEvents();
      canvasInitialized = true;
    }
  }

  function clearCanvas() {
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  function buildColorPalette() {
    var palette = $id('colorPalette');
    if (!palette) return;
    palette.innerHTML = '';
    PALETTE.forEach(function (hex) {
      var sw = document.createElement('div');
      sw.className = 'dd-color-swatch' + (hex === currentColor ? ' active' : '');
      sw.style.background = hex;
      sw.style.border = hex === '#ffffff' ? '2px solid #ccc' : '2px solid transparent';
      sw.setAttribute('data-color', hex);
      sw.addEventListener('click', function () {
        setColor(hex);
      });
      palette.appendChild(sw);
    });
  }

  function setColor(hex) {
    currentColor = hex;
    if (currentTool === 'eraser') setTool('pen');
    document.querySelectorAll('.dd-color-swatch').forEach(function (sw) {
      sw.classList.toggle('active', sw.getAttribute('data-color') === hex);
    });
  }

  function setTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.dd-tool-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tool') === tool);
    });
  }

  function bindDrawingTools() {
    // Tool buttons
    document.querySelectorAll('.dd-tool-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tool = btn.getAttribute('data-tool');
        if (tool === 'undo') { doUndo(); return; }
        if (tool === 'clear') { doClear(); return; }
        setTool(tool);
      });
    });

    // Brush size buttons
    document.querySelectorAll('.dd-size-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentSize = parseInt(btn.getAttribute('data-size'), 10);
        document.querySelectorAll('.dd-size-btn').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
      });
    });
  }

  // ─── Drawing (Pointer Events API) ───────────────────────────────
  function getCanvasPos(e) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = CANVAS_W / rect.width;
    var scaleY = CANVAS_H / rect.height;
    var clientX = e.clientX;
    var clientY = e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top)  * scaleY,
    };
  }

  function bindCanvasPointerEvents() {
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup',   onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', function (e) {
      if (isPointerDown) onPointerUp(e);
    });
    // Prevent scrolling while drawing
    canvas.addEventListener('touchstart', function (e) { if (amIDrawing) e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchmove',  function (e) { if (amIDrawing) e.preventDefault(); }, { passive: false });
  }

  function onPointerDown(e) {
    if (!amIDrawing) return;
    if (e.button !== undefined && e.button !== 0) return;
    canvas.setPointerCapture(e.pointerId);
    isPointerDown = true;
    var pos = getCanvasPos(e);
    lastX = pos.x;
    lastY = pos.y;
    currentStroke = [];

    if (currentTool === 'fill') {
      doFill(Math.round(pos.x), Math.round(pos.y), currentColor);
      // Record fill in stroke history for undo
      strokeHistory.push([{ x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y, color: currentColor, width: 0, tool: 'fill' }]);
      if (strokeHistory.length > MAX_UNDO) strokeHistory.shift();
      isPointerDown = false;
      return;
    }
    // Start a new dot
    drawSegment(lastX, lastY, lastX, lastY, currentTool === 'eraser' ? '#ffffff' : currentColor, currentSize, currentTool);
  }

  // Stroke batching: collect segments and flush as one message
  var strokeBatch = [];
  var batchTimer = null;
  var BATCH_INTERVAL = 100; // ms — flush every 100ms

  function flushStrokeBatch() {
    if (strokeBatch.length === 0) return;
    if (!window.multiplayerClient) return;
    window.multiplayerClient.submitMove('draw-stroke-batch', { strokes: strokeBatch });
    strokeBatch = [];
  }

  function queueStroke(x0, y0, x1, y1, color, width, tool) {
    strokeBatch.push({
      x0: Math.round(x0), y0: Math.round(y0),
      x1: Math.round(x1), y1: Math.round(y1),
      color: color, width: width, tool: tool,
    });
    if (!batchTimer) {
      batchTimer = setTimeout(function () {
        batchTimer = null;
        flushStrokeBatch();
      }, BATCH_INTERVAL);
    }
  }

  function onPointerMove(e) {
    if (!amIDrawing || !isPointerDown) return;
    var pos = getCanvasPos(e);
    var x1 = pos.x;
    var y1 = pos.y;
    drawSegment(lastX, lastY, x1, y1, currentTool === 'eraser' ? '#ffffff' : currentColor, currentSize, currentTool);
    queueStroke(lastX, lastY, x1, y1, currentTool === 'eraser' ? '#ffffff' : currentColor, currentSize, currentTool);
    lastX = x1;
    lastY = y1;
  }

  function onPointerUp(e) {
    if (!isPointerDown) return;
    isPointerDown = false;
    // Flush any remaining batched strokes immediately
    if (batchTimer) { clearTimeout(batchTimer); batchTimer = null; }
    flushStrokeBatch();
    // Save stroke group for undo
    if (currentStroke.length > 0) {
      strokeHistory.push(currentStroke.slice());
      if (strokeHistory.length > MAX_UNDO) strokeHistory.shift();
      currentStroke = [];
    }
  }

  function drawSegment(x0, y0, x1, y1, color, width, tool) {
    if (!ctx) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle   = color;
    ctx.lineWidth   = width;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle   = '#ffffff';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    // Draw a circle at start for dots
    ctx.beginPath();
    ctx.arc(x0, y0, width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Record for undo
    currentStroke.push({ x0: x0, y0: y0, x1: x1, y1: y1, color: color, width: width, tool: tool });
  }

  function emitStroke(x0, y0, x1, y1, color, width, tool) {
    if (!window.multiplayerClient) return;
    window.multiplayerClient.submitMove('draw-stroke', {
      x0: Math.round(x0), y0: Math.round(y0),
      x1: Math.round(x1), y1: Math.round(y1),
      color: color, width: width, tool: tool,
    });
  }

  // ─── Flood Fill ─────────────────────────────────────────────────
  function hexToRgba(hex) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b, 255];
  }

  function colorMatch(data, idx, target) {
    return data[idx]     === target[0] &&
           data[idx + 1] === target[1] &&
           data[idx + 2] === target[2] &&
           data[idx + 3] === target[3];
  }

  function doFill(startX, startY, fillColorHex) {
    doFillRender(startX, startY, fillColorHex);
    // Emit fill as a special move
    if (window.multiplayerClient) {
      window.multiplayerClient.submitMove('draw-stroke', {
        tool: 'fill', x0: startX, y0: startY, x1: startX, y1: startY,
        color: fillColorHex, width: 0,
      });
    }
  }

  function doUndo() {
    if (!amIDrawing) return;
    if (strokeHistory.length === 0) return;
    strokeHistory.pop();
    // Redraw from scratch
    redrawFromHistory();
    // Broadcast undo
    if (window.multiplayerClient) {
      window.multiplayerClient.submitMove('draw-stroke', { tool: 'undo', x0: 0, y0: 0, x1: 0, y1: 0, color: '', width: 0 });
    }
  }

  function doClear() {
    if (!amIDrawing) return;
    strokeHistory = [];
    clearCanvas();
    if (window.multiplayerClient) {
      window.multiplayerClient.submitMove('draw-stroke', { tool: 'clear', x0: 0, y0: 0, x1: 0, y1: 0, color: '', width: 0 });
    }
  }

  function redrawFromHistory() {
    clearCanvas();
    strokeHistory.forEach(function (group) {
      group.forEach(function (seg) {
        if (seg.tool === 'fill') {
          doFillLocal(Math.round(seg.x0), Math.round(seg.y0), seg.color);
        } else {
          drawSegment(seg.x0, seg.y0, seg.x1, seg.y1, seg.color, seg.width, seg.tool);
        }
      });
    });
  }

  // Local fill (no network emit) for redo/replay
  function doFillLocal(startX, startY, fillColorHex) {
    doFillRender(startX, startY, fillColorHex);
    currentStroke = [];
  }

  // Pure canvas fill without network emit - scanline algorithm for performance
  function doFillRender(startX, startY, fillColorHex) {
    if (!ctx) return;
    var imgData   = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    var data      = imgData.data;
    var fillColor = hexToRgba(fillColorHex);
    var idx       = (startY * CANVAS_W + startX) * 4;
    var targetColor = [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
    if (colorMatch(data, idx, fillColor)) return;
    var stack = [[startX, startY]];
    while (stack.length > 0) {
      var pt = stack.pop();
      var x = pt[0]; var y = pt[1];
      if (y < 0 || y >= CANVAS_H) continue;
      // Scan left
      var x1 = x;
      while (x1 >= 0 && colorMatch(data, (y * CANVAS_W + x1) * 4, targetColor)) x1--;
      x1++;
      // Scan right and fill
      var spanAbove = false; var spanBelow = false;
      while (x1 < CANVAS_W && colorMatch(data, (y * CANVAS_W + x1) * 4, targetColor)) {
        var i4 = (y * CANVAS_W + x1) * 4;
        data[i4] = fillColor[0]; data[i4 + 1] = fillColor[1];
        data[i4 + 2] = fillColor[2]; data[i4 + 3] = fillColor[3];
        if (!spanAbove && y > 0 && colorMatch(data, ((y - 1) * CANVAS_W + x1) * 4, targetColor)) {
          stack.push([x1, y - 1]); spanAbove = true;
        } else if (spanAbove && y > 0 && !colorMatch(data, ((y - 1) * CANVAS_W + x1) * 4, targetColor)) {
          spanAbove = false;
        }
        if (!spanBelow && y < CANVAS_H - 1 && colorMatch(data, ((y + 1) * CANVAS_W + x1) * 4, targetColor)) {
          stack.push([x1, y + 1]); spanBelow = true;
        } else if (spanBelow && y < CANVAS_H - 1 && !colorMatch(data, ((y + 1) * CANVAS_W + x1) * 4, targetColor)) {
          spanBelow = false;
        }
        x1++;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // ─── Apply incoming strokes (from server broadcast) ─────────────
  var remoteStrokeBuffer = []; // flat list of remote strokes for undo replay

  function applyRemoteStroke(data) {
    if (!ctx) return;
    var tool = data.tool;
    if (tool === 'undo') {
      // Remote undo: server sends updated stroke history - replay it
      if (data.__strokeHistory) {
        replayStrokes(data.__strokeHistory);
      }
      return;
    }
    if (tool === 'clear') {
      clearCanvas();
      remoteStrokeBuffer = [];
      return;
    }
    if (tool === 'fill') {
      doFillLocal(Math.round(data.x0), Math.round(data.y0), data.color);
      remoteStrokeBuffer.push({ tool: 'fill', x0: data.x0, y0: data.y0, color: data.color });
      return;
    }
    drawSegment(data.x0, data.y0, data.x1, data.y1, data.color, data.width, tool);
    remoteStrokeBuffer.push(data);
  }

  // Replay full stroke history (late-join)
  function replayStrokes(strokes) {
    clearCanvas();
    strokeHistory = [];
    strokes.forEach(function (seg) { applyRemoteStroke(seg); });
  }

  // ─── Timer ──────────────────────────────────────────────────────
  function startTimer(seconds, onTick, onExpire) {
    stopTimer();
    timerValue = seconds;
    updateTimerUI(timerValue);
    timerInterval = setInterval(function () {
      timerValue--;
      updateTimerUI(timerValue);
      if (onTick) onTick(timerValue);
      if (timerValue <= 0) {
        stopTimer();
        if (onExpire) onExpire();
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  function updateTimerUI(val) {
    var el = $id('gameTimer');
    if (!el) return;
    el.textContent = val;
    el.classList.toggle('warning', val <= 10);
    if (val <= 5 && val > 0) sfxTimerWarning();
  }

  // ─── Score & Players UI ─────────────────────────────────────────
  function renderScores() {
    var list = $id('scoresList');
    if (!list) return;
    var sorted = players.slice().sort(function (a, b) {
      return (sessionScores[b.uid] || 0) - (sessionScores[a.uid] || 0);
    });
    list.innerHTML = sorted.map(function (p, i) {
      var me = p.uid === myUid;
      var guessed = p.guessed;
      var isDrawer = p.uid === currentDrawer;
      return '<div class="dd-score-row' + (me ? ' is-me' : '') + (guessed ? ' guessed' : '') + '">' +
        '<span class="dd-score-rank">' + (i + 1) + '</span>' +
        '<span class="dd-score-name">' + escapeHtml(p.name) + (isDrawer ? '<span class="dd-drawer-badge">Drawing</span>' : '') + '</span>' +
        '<span class="dd-score-pts">' + (sessionScores[p.uid] || 0) + '</span>' +
        '</div>';
    }).join('');
  }

  function renderRoomPlayers() {
    var list = $id('playersList');
    if (!list) return;
    list.innerHTML = players.map(function (p, i) {
      var isMe = p.uid === myUid;
      var cls = 'dd-player-chip' + (p.isHost ? ' is-host' : '') + (isMe ? ' is-me' : '');
      var color = PLAYER_COLORS[i % PLAYER_COLORS.length];
      var initial = (p.name || '?').charAt(0).toUpperCase();
      var role = p.isHost ? '<span class="player-role">HOST</span>' : '';
      var youTag = isMe ? ' (you)' : '';
      return '<div class="' + cls + '">' +
        '<span class="avatar" style="background:' + color + '">' + initial + '</span>' +
        '<span class="player-info"><span class="player-name">' + escapeHtml(p.name) + youTag + '</span>' + role + '</span>' +
        '<span class="ready-dot" title="Connected"></span>' +
        '</div>';
    }).join('');
    var countEl = $id('playerCountLabel');
    if (countEl) countEl.textContent = players.length;
    var slotsEl = $id('emptySlotsMsg');
    if (slotsEl) {
      var remaining = 30 - players.length;
      slotsEl.textContent = remaining > 0 ? remaining + ' slot' + (remaining !== 1 ? 's' : '') + ' available' : 'Room is full!';
    }
  }

  // ─── Chat / Guess System ────────────────────────────────────────
  function getPlayerColor(name) {
    if (!name) return PLAYER_COLORS[0];
    var hash = 0;
    for (var i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i);
    return PLAYER_COLORS[Math.abs(hash) % PLAYER_COLORS.length];
  }

  function addChatMessage(senderName, msg, type) {
    var messages = $id('chatMessages');
    if (!messages) return;
    var div = document.createElement('div');
    div.className = 'dd-chat-msg' + (type ? ' ' + type : '');
    if (type === 'system') {
      div.innerHTML = escapeHtml(msg);
    } else {
      var color = getPlayerColor(senderName);
      div.innerHTML = '<span class="msg-sender" style="color:' + color + '">' + escapeHtml(senderName) + ':</span> ' + escapeHtml(msg);
    }
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function submitGuess() {
    var input = $id('chatInput');
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;
    input.value = '';

    // Don't send guesses if I'm the drawer
    if (amIDrawing) {
      addChatMessage(myName, text, '');
      return;
    }

    if (window.multiplayerClient) {
      window.multiplayerClient.submitMove('guess', { text: text });
    }
    addChatMessage(myName, text, '');
  }

  // ─── Word display (hint masking) ────────────────────────────────
  function updateWordDisplay(word, revealed) {
    // word: actual string (for drawer) or null (for guesser uses hint)
    var display = $id('wordDisplay');
    if (!display) return;
    if (word) {
      // Drawer sees full word
      display.textContent = word;
      return;
    }
    // Guesser sees hint - underscore mask with revealed positions
    display.textContent = wordHint || '_ _ _ _ _';
  }

  function buildHint(word, revealIndices) {
    var letters = word.split('');
    return letters.map(function (ch, i) {
      if (ch === ' ') return '  ';
      if (revealIndices && revealIndices.indexOf(i) >= 0) return ch;
      return '_';
    }).join(' ');
  }

  // ─── Phase: Word Choice (Classic) ───────────────────────────────
  var wordChoiceCountdown = null;

  function showWordChoice(words) {
    var overlay  = $id('canvasOverlay');
    var title    = $id('overlayTitle');
    var choices  = $id('wordChoices');
    var subtext  = $id('overlaySubtext');
    if (!overlay) return;
    title.textContent   = 'Choose a word to draw!';
    choices.innerHTML   = '';

    // Live countdown
    var remaining = WORD_CHOICE_T;
    subtext.textContent = remaining + 's to choose...';
    if (wordChoiceCountdown) clearInterval(wordChoiceCountdown);
    wordChoiceCountdown = setInterval(function () {
      remaining--;
      if (remaining <= 0) {
        clearInterval(wordChoiceCountdown);
        wordChoiceCountdown = null;
        subtext.textContent = 'Auto-picking...';
      } else {
        subtext.textContent = remaining + 's to choose...';
        if (remaining <= 5) subtext.style.color = '#ff4444';
      }
    }, 1000);

    words.forEach(function (word) {
      var btn = document.createElement('button');
      btn.className = 'dd-word-choice-btn';
      btn.textContent = word;
      btn.addEventListener('click', function () {
        if (wordChoiceCountdown) { clearInterval(wordChoiceCountdown); wordChoiceCountdown = null; }
        if (window.multiplayerClient) {
          window.multiplayerClient.submitMove('word-choice', { word: word });
        }
        hideOverlay();
      });
      choices.appendChild(btn);
    });
    overlay.classList.add('visible');

    // Auto-pick on timeout (cancellable)
    wordChoiceTimer = setTimeout(function () {
      wordChoiceTimer = null;
      if (wordChoiceCountdown) { clearInterval(wordChoiceCountdown); wordChoiceCountdown = null; }
      if (overlay.classList.contains('visible')) {
        var first = words[0];
        if (window.multiplayerClient) {
          window.multiplayerClient.submitMove('word-choice', { word: first });
        }
        hideOverlay();
      }
    }, WORD_CHOICE_T * 1000);
  }

  var wordChoiceTimer = null;

  function hideOverlay() {
    if (wordChoiceTimer) { clearTimeout(wordChoiceTimer); wordChoiceTimer = null; }
    if (wordChoiceCountdown) { clearInterval(wordChoiceCountdown); wordChoiceCountdown = null; }
    var overlay = $id('canvasOverlay');
    if (overlay) overlay.classList.remove('visible');
    var subtext = $id('overlaySubtext');
    if (subtext) subtext.style.color = '';
  }

  function showWaitingOverlay(msg) {
    var overlay  = $id('canvasOverlay');
    var title    = $id('overlayTitle');
    var choices  = $id('wordChoices');
    var subtext  = $id('overlaySubtext');
    if (!overlay) return;
    title.textContent   = msg || 'Waiting...';
    choices.innerHTML   = '';
    subtext.textContent = '';
    overlay.classList.add('visible');
  }

  // ─── Phase: Speed Draw ──────────────────────────────────────────
  function startSpeedDrawPhase(word) {
    amIDrawing = true;
    wordForDrawer = word;
    var display = $id('wordDisplay');
    if (display) display.textContent = word;
    var toolbar = $id('drawToolbar');
    if (toolbar) toolbar.classList.remove('hidden');
    hideOverlay();

    // Lock all other players' canvases (blur)
    // This is handled locally - canvas is always accessible to the drawer
    clearCanvas();
    strokeHistory = [];
    startTimer(SD_TIMEOUT, function (remaining) {
      // Hints not applicable in Speed Draw
    }, function () {
      // Time's up - canvas locked, send state to server
      amIDrawing = false;
      var toolbar = $id('drawToolbar');
      if (toolbar) toolbar.classList.add('hidden');
      // Export canvas as data URL at reduced size for network efficiency
      // Scale down to 400x300 to cap payload at ~15-20KB per player
      var exportCanvas = document.createElement('canvas');
      exportCanvas.width = 400; exportCanvas.height = 300;
      var exportCtx = exportCanvas.getContext('2d');
      exportCtx.drawImage(canvas, 0, 0, 400, 300);
      var dataUrl = exportCanvas.toDataURL('image/jpeg', 0.4);
      if (window.multiplayerClient) {
        window.multiplayerClient.submitMove('draw-stroke', { tool: 'sd-submit', x0: 0, y0: 0, x1: 0, y1: 0, color: dataUrl, width: 0 });
      }
      showWaitingOverlay('Waiting for other players...');
    });
  }

  // ─── Phase: Classic Drawing ──────────────────────────────────────
  function startClassicDrawingPhase(word) {
    amIDrawing = true;
    wordForDrawer = word;
    var display = $id('wordDisplay');
    if (display) {
      display.textContent = 'Draw: ' + word;
      display.style.color = '#4ecdc4';
    }
    var toolbar = $id('drawToolbar');
    if (toolbar) toolbar.classList.remove('hidden');
    var chatInput = $id('chatInput');
    if (chatInput) chatInput.disabled = true; // drawer can't type guesses
    hideOverlay();
    clearCanvas();
    strokeHistory = [];

    startTimer(TURN_TIMEOUT, function (remaining) {
      var elapsed = TURN_TIMEOUT - remaining;
      if (elapsed >= HINT_1_SEC && !hintRevealed[0]) {
        hintRevealed[0] = true;
        if (window.multiplayerClient) {
          window.multiplayerClient.submitMove('reveal-hint', {});
        }
      }
      if (elapsed >= HINT_2_SEC && !hintRevealed[1]) {
        hintRevealed[1] = true;
        if (window.multiplayerClient) {
          window.multiplayerClient.submitMove('reveal-hint', {});
        }
      }
    }, function () {
      // Time expired — tell server to end the round
      amIDrawing = false;
      var toolbar = $id('drawToolbar');
      if (toolbar) toolbar.classList.add('hidden');
      if (window.multiplayerClient) {
        window.multiplayerClient.submitMove('end-round', {});
      }
    });
  }

  function startClassicGuessingPhase(hintText, drawerName) {
    amIDrawing = false;
    var toolbar = $id('drawToolbar');
    if (toolbar) toolbar.classList.add('hidden');
    var chatInput = $id('chatInput');
    if (chatInput) chatInput.disabled = false;
    var display = $id('wordDisplay');
    if (display) display.style.color = '';
    wordHint = hintText;
    updateWordDisplay(null, null);
    clearCanvas();
    strokeHistory = [];
    showWaitingOverlay(drawerName + ' is drawing...');
    // Overlay will be hidden as strokes arrive
  }

  // ─── Speed Draw Reveal ──────────────────────────────────────────
  function showRevealScreen(canvasDataMap, word) {
    stopTimer();
    showScreen('reveal');
    var revealWord = $id('revealWordLabel');
    if (revealWord) revealWord.textContent = 'The word was: "' + word + '"';

    var grid = $id('revealGrid');
    if (!grid) return;
    grid.innerHTML = '';
    myVotedFor = null;

    Object.keys(canvasDataMap).forEach(function (uid) {
      var dataUrl  = canvasDataMap[uid];
      var name     = getPlayerName(uid);
      var isMe     = uid === myUid;

      var card = document.createElement('div');
      card.className = 'dd-reveal-card';
      card.setAttribute('data-uid', uid);

      var wrap = document.createElement('div');
      wrap.className = 'reveal-canvas-wrap';
      var img = document.createElement('img');
      img.src = dataUrl;
      img.style.width  = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      wrap.appendChild(img);

      var footer = document.createElement('div');
      footer.className = 'reveal-footer';
      var playerLabel = document.createElement('span');
      playerLabel.className = 'reveal-player';
      playerLabel.textContent = name + (isMe ? ' (you)' : '');
      footer.appendChild(playerLabel);

      if (!isMe) {
        var starBtn = document.createElement('button');
        starBtn.className = 'dd-star-btn';
        starBtn.textContent = '⭐ Vote';
        starBtn.setAttribute('data-vote-uid', uid);
        starBtn.addEventListener('click', function () {
          submitStarVote(uid);
        });
        footer.appendChild(starBtn);
      }

      card.appendChild(wrap);
      card.appendChild(footer);
      grid.appendChild(card);
    });

    // Countdown to next round
    var countdown = REVEAL_VOTE_T;
    var countEl = $id('revealCountdown');
    if (countEl) countEl.textContent = 'Next round in ' + countdown + 's';
    _revealCountInterval = setInterval(function () {
      countdown--;
      if (countEl) countEl.textContent = 'Next round in ' + countdown + 's';
      if (countdown <= 0) { clearInterval(_revealCountInterval); _revealCountInterval = null; }
    }, 1000);
  }

  function submitStarVote(targetUid) {
    if (myVotedFor) return; // already voted
    myVotedFor = targetUid;

    // Visual feedback
    document.querySelectorAll('.dd-star-btn').forEach(function (btn) {
      btn.disabled = true;
      if (btn.getAttribute('data-vote-uid') === targetUid) {
        btn.classList.add('voted');
        btn.textContent = '⭐ Voted!';
        btn.classList.add('dd-star-pop');
      }
    });

    if (window.multiplayerClient) {
      window.multiplayerClient.submitMove('star-vote', { targetUid: targetUid });
    }
  }

  // ─── Round Result ───────────────────────────────────────────────
  function showRoundResult(data) {
    stopTimer();
    showScreen('result');

    var title = $id('roundResultTitle');
    if (title) title.textContent = data.roundNum ? 'Round ' + data.roundNum + ' Complete!' : 'Round Complete!';

    var wordEl = $id('roundResultWord');
    if (wordEl && data.word) wordEl.textContent = 'The word was: "' + data.word + '"';

    var scoresEl = $id('roundResultScores');
    if (scoresEl) {
      var sorted = players.slice().sort(function (a, b) {
        return (sessionScores[b.uid] || 0) - (sessionScores[a.uid] || 0);
      });
      scoresEl.innerHTML = sorted.map(function (p, i) {
        var delta = roundScores[p.uid] || 0;
        var isWinner = i === 0;
        return '<div class="dd-result-row' + (isWinner ? ' winner' : '') + '">' +
          '<span>' + (i + 1) + '. ' + escapeHtml(p.name) + '</span>' +
          '<span>' +
          (delta > 0 ? '<span class="dd-result-delta">+' + delta + '</span> ' : '') +
          '<strong>' + (sessionScores[p.uid] || 0) + '</strong>' +
          '</span>' +
          '</div>';
      }).join('');
    }

    // Auto advance — host kicks off next round after countdown
    var countdown = NEXT_ROUND_T;
    var nextEl = $id('nextRoundCountdown');
    if (nextEl) nextEl.textContent = 'Next round in ' + countdown + 's...';
    _nextRoundCountInterval = setInterval(function () {
      countdown--;
      if (nextEl) nextEl.textContent = 'Next round in ' + countdown + 's...';
      if (countdown <= 0) {
        clearInterval(_nextRoundCountInterval);
        _nextRoundCountInterval = null;
        if (isHost && window.multiplayerClient) {
          window.multiplayerClient.submitMove('start-round', { ready: true });
        }
      }
    }, 1000);
  }

  // ─── Game Over ──────────────────────────────────────────────────
  function showGameOver(data) {
    stopTimer();
    showScreen('gameover');

    // Find winner
    var winner = players.slice().sort(function (a, b) {
      return (sessionScores[b.uid] || 0) - (sessionScores[a.uid] || 0);
    })[0];
    var isWinner = winner && winner.uid === myUid;

    var title  = $id('gameoverSub');
    if (title) {
      if (isWinner) {
        title.textContent = 'You won! Final Scores:';
      } else if (winner) {
        title.textContent = winner.name + ' wins! Final Scores:';
      } else {
        title.textContent = 'Final Scores:';
      }
    }

    var scoresEl = $id('gameoverScores');
    if (scoresEl) {
      var sorted = players.slice().sort(function (a, b) {
        return (sessionScores[b.uid] || 0) - (sessionScores[a.uid] || 0);
      });
      scoresEl.innerHTML = sorted.map(function (p, i) {
        return '<div class="dd-result-row' + (i === 0 ? ' winner' : '') + '">' +
          '<span>' + (i + 1) + '. ' + escapeHtml(p.name) + '</span>' +
          '<strong>' + (sessionScores[p.uid] || 0) + '</strong>' +
          '</div>';
      }).join('');
    }

    // XP bar animation
    var xpEarned = (data && data.xpEarned != null) ? data.xpEarned : 0;
    var xpLabel  = $id('xpLabel');
    if (xpLabel) xpLabel.textContent = '+' + xpEarned + ' XP earned';
    setTimeout(function () {
      var xpBar = $id('xpBar');
      if (xpBar) xpBar.style.width = Math.min(100, (xpEarned / 5)) + '%';
    }, 400);

    // Submit score - use server-authoritative score from sessionScores, not local myScore
    var serverScore = (myUid && sessionScores[myUid]) ? sessionScores[myUid] : myScore;
    if (window.apiClient && typeof window.apiClient.submitScore === 'function') {
      window.apiClient.submitScore(GAME_ID, {
        score: serverScore,
        timeMs: Date.now() - gameStartedAt,
        metadata: {
          mode: gameMode,
          roundsPlayed: currentRound,
          correctGuesses: data ? (data.correctGuesses || 0) : 0,
          starsReceived: data ? (data.starsReceived || 0) : 0,
        },
      }).catch(function () {});
    }
  }

  // ─── Multiplayer Event Handlers ─────────────────────────────────
  function bindMultiplayerEvents() {
    if (!window.multiplayerClient) {
      console.warn('[DoodleDash] multiplayerClient not available');
      return;
    }
    var mc = window.multiplayerClient;

    // Player joined the session via WebSocket
    mc.onPlayerJoined(function (data) {
      var newPlayer = { uid: data.uid, name: data.displayName || data.uid, score: 0, guessed: false };
      // Avoid duplicates
      if (!players.find(function (p) { return p.uid === data.uid; })) {
        players.push(newPlayer);
      }
      if (sessionScores[data.uid] === undefined) sessionScores[data.uid] = 0;
      renderRoomPlayers();
      if (gameState === 'playing') renderScores();
      showNotif(newPlayer.name + ' joined', 2000);
    });

    // Player left
    mc.onPlayerLeft(function (data) {
      players = players.filter(function (p) { return p.uid !== data.uid; });
      renderRoomPlayers();
      if (gameState === 'playing') renderScores();
    });

    // Player reconnected
    mc.on('session:player-reconnected', function (data) {
      showNotif((data.displayName || 'Player') + ' reconnected', 2000);
    });

    // ── Direct stroke events (lightweight, not via game:state) ────
    mc.on('game:stroke', function (data) {
      if (!amIDrawing && data.uid !== myUid) {
        hideOverlay();
        applyRemoteStroke(data);
      }
    });

    mc.on('game:stroke-batch', function (data) {
      if (!amIDrawing && data.uid !== myUid && data.strokes) {
        hideOverlay();
        for (var i = 0; i < data.strokes.length; i++) {
          applyRemoteStroke(data.strokes[i]);
        }
      }
    });

    // ── State-driven event handler ─────────────────────────────────
    // The server broadcasts game:state with the full DoodleDash state.
    // We track the previous phase/round and derive UI events from transitions.
    var _prevPhase = null;
    var _prevRound = 0;
    var _prevHint  = null;
    var _appliedStrokes = 0;
    var _gameOverShown = false;

    mc.onGameState(function (data) {
      if (!data || !data.state) return;
      var s = data.state;
      var phase = s.phase;
      var round = s.round || 0;

      // ── Game initialized but idle: host auto-kicks off first round ──
      if (phase === 'idle' && round === 0 && isHost && _prevPhase !== 'idle') {
        window.multiplayerClient.submitMove('start-round', { ready: true });
        _prevPhase = phase;
        _prevRound = round;
        return; // Wait for the next game:state with word-choice/sd-drawing
      }

      // ── Round start: new round detected ──
      if (round > _prevRound && (phase === 'word-choice' || phase === 'sd-drawing')) {
        currentRound = round;
        totalRounds  = s.totalRounds || totalRounds;
        roundScores  = {};
        if (currentRound === 1) gameStartedAt = Date.now();

        var roundEl = $id('roundNum');
        if (roundEl) roundEl.textContent = currentRound;
        var totalEl = $id('roundTotal');
        if (totalEl) totalEl.textContent = totalRounds;

        hintRevealed = [false, false];
        _appliedStrokes = 0;
        showScreen('playing');
        initCanvas();

        if (s.mode === 'speed-draw') {
          var word = s.currentWord;
          if (!word) { showWaitingOverlay('Starting Speed Draw...'); }
          else { startSpeedDrawPhase(word); }
        } else {
          currentDrawer = s.currentDrawerUid;
          var drawerName = getPlayerName(currentDrawer);
          if (currentDrawer === myUid) {
            showWordChoice(s.wordOptions || ['cat', 'house', 'tree']);
          } else {
            var hint = s.wordHint || '_ _ _ _ _';
            startClassicGuessingPhase(hint, drawerName);
          }
        }
        renderScores();
      }

      // ── Drawing started: phase changed to 'drawing' (Classic: drawer chose word) ──
      if (phase === 'drawing' && _prevPhase === 'word-choice') {
        currentDrawer = s.currentDrawerUid;
        wordHint = s.wordHint || '_ _ _ _ _';

        if (currentDrawer === myUid) {
          // I'm the drawer — enable drawing tools
          startClassicDrawingPhase(s.currentWord || '???');
        } else {
          // I'm guessing
          hideOverlay();
          startTimer(TURN_TIMEOUT, null, null);
          updateWordDisplay(null, null);
          addChatMessage('', '🎨 ' + getPlayerName(currentDrawer) + ' is now drawing!', 'system drawing');
        }
        renderScores();
      }

      // Strokes are delivered via lightweight game:stroke events (not game:state).
      // But on reconnect/late-join, replay strokeHistory from the full state.
      if (s.strokeHistory && s.strokeHistory.length > 0 && !amIDrawing && _appliedStrokes === 0) {
        replayStrokes(s.strokeHistory);
        _appliedStrokes = s.strokeHistory.length;
      }

      // ── Hint reveal (guessers only — drawer keeps seeing the full word) ──
      if (s.wordHint && s.wordHint !== _prevHint && phase === 'drawing') {
        wordHint = s.wordHint;
        if (!amIDrawing) {
          updateWordDisplay(null, null);
        }
        addChatMessage('', '💡 Hint: ' + s.wordHint, 'system hint');
      }

      // ── Guess results: check playerStates for new correct guesses ──
      if (s.playerStates) {
        Object.keys(s.playerStates).forEach(function (uid) {
          var ps = s.playerStates[uid];
          var p = players.find(function (pl) { return pl.uid === uid; });
          if (p && ps.hasGuessedThisRound && !p.guessed) {
            p.guessed = true;
            var delta = ps.score - (sessionScores[uid] || 0);
            if (delta > 0) {
              sessionScores[uid] = ps.score;
              roundScores[uid]   = (roundScores[uid] || 0) + delta;
              if (uid === myUid) {
                myScore += delta;
                showNotif('Correct! +' + delta + ' points!');
                var chatInput = $id('chatInput');
                if (chatInput) chatInput.disabled = true;
              }
              sfxCorrectGuess();
              addChatMessage('', '✅ ' + (getPlayerName(uid) || ps.name || uid) + ' guessed correctly! (+' + delta + ')', 'system correct');
            }
          }
        });
        renderScores();
      }

      // ── Speed Draw reveal ──
      if (phase === 'sd-vote' && _prevPhase === 'sd-drawing') {
        stopTimer();
        showRevealScreen({}, s.currentWord || '');
      }

      // ── Star votes ──
      if (s.sdStarVotes && phase === 'sd-vote') {
        Object.keys(s.sdStarVotes).forEach(function (uid) {
          var stars = s.sdStarVotes[uid];
          var card = document.querySelector('.dd-reveal-card[data-uid="' + uid + '"]');
          if (!card) return;
          var existing = card.querySelector('.dd-star-count');
          if (existing) { existing.textContent = stars + ' ⭐'; }
          else {
            var footer = card.querySelector('.reveal-footer');
            if (footer) {
              var span = document.createElement('span');
              span.className = 'dd-star-count';
              span.textContent = stars + ' ⭐';
              footer.appendChild(span);
            }
          }
        });
      }

      // ── Game over (server set gameOver=true on start-round after final round) ──
      if (s.gameOver && !_gameOverShown) {
        _gameOverShown = true;
        // Sync final scores
        if (s.playerStates) {
          Object.keys(s.playerStates).forEach(function (uid) {
            sessionScores[uid] = s.playerStates[uid].score;
          });
        }
        showGameOver({ scores: sessionScores, playerStates: s.playerStates });
      }

      // ── Round end (not game over) ──
      if (phase === 'round-end' && _prevPhase !== 'round-end' && !s.gameOver) {
        stopTimer();
        if (s.playerStates) {
          Object.keys(s.playerStates).forEach(function (uid) {
            sessionScores[uid] = s.playerStates[uid].score;
          });
        }
        players.forEach(function (p) { p.guessed = false; });
        showRoundResult({
          word: s.currentWord,
          roundNum: s.round,
          scores: sessionScores,
          nextRound: true,
        });
      }

      _prevPhase = phase;
      _prevRound = round;
      _prevHint  = s.wordHint;
    });

    mc.onError(function (data) {
      showNotif(data.message || 'Something went wrong', 4000);
      if (gameState === 'loading') showScreen('lobby');
    });

    mc.on('reconnected', function () {
      showNotif('Reconnected!', 2000);
      // Reset stroke counter so next game:state replays all strokes
      _appliedStrokes = 0;
    });
  }

  // ─── Lobby Actions ──────────────────────────────────────────────
  function bindLobbyActions() {
    // Mode selection
    document.querySelectorAll('.dd-mode-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        gameMode = btn.getAttribute('data-mode');
        document.querySelectorAll('.dd-mode-btn').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
      });
    });

    // Quick Play (public room)
    var btnPublic = $id('btnCreatePublic');
    if (btnPublic) btnPublic.addEventListener('click', function () {
      if (!window.multiplayerClient) { showNotif('Multiplayer client not loaded', 3000); return; }
      if (!window.authManager || !window.apiClient?.token) {
        if (window.authNudge) window.authNudge.show({ force: true, icon: '✏️', title: 'Sign in to draw with friends', desc: 'Create rooms, save your XP, earn achievements, and climb the leaderboard.' }); return;
      }
      setLoadingMsg('Finding a room...');
      window.multiplayerClient.createSession(GAME_ID, {
        mode: 'quick-match',
        maxPlayers: 30,
        minPlayers: 2,
        spectatorAllowed: true,
        gameConfig: { mode: gameMode, playerName: myName },
      }).then(function (session) {
        if (session && session.sessionId) {
          currentSessionId = session.sessionId;
          roomCode = session.joinCode || session.sessionId.slice(0, 6).toUpperCase();
          isHost = true;
          return window.multiplayerClient.connect(session.sessionId);
        }
      }).then(function () {
        showRoomLobby();
      }).catch(function (err) {
        showNotif('Failed to create room: ' + (err.message || 'Unknown error'), 4000);
        showScreen('lobby');
      });
    });

    // Create Private Room
    var btnPrivate = $id('btnCreatePrivate');
    if (btnPrivate) btnPrivate.addEventListener('click', function () {
      if (!window.multiplayerClient) { showNotif('Multiplayer client not loaded', 3000); return; }
      if (!window.authManager || !window.apiClient?.token) {
        if (window.authNudge) window.authNudge.show({ force: true, icon: '✏️', title: 'Sign in to draw with friends', desc: 'Create rooms, save your XP, earn achievements, and climb the leaderboard.' }); return;
      }
      setLoadingMsg('Creating room...');
      window.multiplayerClient.createSession(GAME_ID, {
        mode: 'private',
        maxPlayers: 30,
        minPlayers: 2,
        spectatorAllowed: true,
        gameConfig: { mode: gameMode, playerName: myName },
      }).then(function (session) {
        if (session && session.sessionId) {
          currentSessionId = session.sessionId;
          roomCode = session.joinCode || session.sessionId.slice(0, 6).toUpperCase();
          isHost = true;
          return window.multiplayerClient.connect(session.sessionId);
        }
      }).then(function () {
        showRoomLobby();
      }).catch(function (err) {
        showNotif('Failed to create room: ' + (err.message || 'Unknown error'), 4000);
        showScreen('lobby');
      });
    });

    // Join Room
    var btnJoin = $id('btnJoinRoom');
    if (btnJoin) btnJoin.addEventListener('click', function () {
      var code = ($id('joinCodeInput').value || '').trim().toUpperCase();
      if (code.length < 4) { showNotif('Enter a valid room code', 2500); return; }
      if (!window.multiplayerClient) { showNotif('Multiplayer client not loaded', 3000); return; }
      if (!window.authManager || !window.apiClient?.token) {
        if (window.authNudge) window.authNudge.show({ force: true, icon: '✏️', title: 'Sign in to draw with friends', desc: 'Create rooms, save your XP, earn achievements, and climb the leaderboard.' }); return;
      }
      setLoadingMsg('Joining room...');
      window.multiplayerClient.joinByCode(code).then(function (session) {
        if (session && session.sessionId) {
          currentSessionId = session.sessionId;
          roomCode = code;
          isHost = false;
          return window.multiplayerClient.connect(session.sessionId);
        }
      }).then(function () {
        showRoomLobby();
      }).catch(function (err) {
        showNotif('Failed to join room: ' + (err.message || 'Invalid code'), 4000);
        showScreen('lobby');
      });
    });

    // Enter key on join input
    var joinInput = $id('joinCodeInput');
    if (joinInput) joinInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') btnJoin && btnJoin.click();
    });

    // Start Game (host only)
    var btnStart = $id('btnStartGame');
    if (btnStart) btnStart.addEventListener('click', function () {
      if (!window.multiplayerClient) return;
      btnStart.disabled = true;
      btnStart.textContent = 'Starting...';

      // REST: set session to 'starting', then tell realtime server to initialize the game
      window.multiplayerClient.startGame(currentSessionId).then(function () {
        window.multiplayerClient.hostStart();
      }).catch(function (err) {
        showNotif('Failed to start: ' + (err.message || 'Try again'), 3000);
        btnStart.disabled = false;
        btnStart.textContent = 'Start Game';
      });
    });

    // Leave Room
    var btnLeave = $id('btnLeaveRoom');
    if (btnLeave) btnLeave.addEventListener('click', function () {
      if (window.multiplayerClient && currentSessionId) {
        window.multiplayerClient.leaveSession(currentSessionId);
      }
      currentSessionId = null;
      showScreen('lobby');
    });

    // Room code copy (both code display and copy button)
    function copyRoomCode() {
      if (roomCode && navigator.clipboard) {
        navigator.clipboard.writeText(roomCode).then(function () {
          showNotif('Room code copied!', 1500);
          var btn = $id('btnCopyCode');
          if (btn) { btn.textContent = '✅'; setTimeout(function () { btn.textContent = '📋'; }, 1500); }
        });
      }
    }
    var codeDisplay = $id('roomCodeDisplay');
    if (codeDisplay) codeDisplay.addEventListener('click', copyRoomCode);
    var btnCopy = $id('btnCopyCode');
    if (btnCopy) btnCopy.addEventListener('click', copyRoomCode);

    // Game over buttons
    var btnPlayAgain = $id('btnPlayAgain');
    if (btnPlayAgain) btnPlayAgain.addEventListener('click', function () {
      if (window.multiplayerClient && isHost) {
        window.multiplayerClient.submitMove('start-round', { ready: true });
      } else {
        showScreen('room');
      }
    });

    var btnBackLobby = $id('btnBackLobby');
    if (btnBackLobby) btnBackLobby.addEventListener('click', function () {
      if (window.multiplayerClient && currentSessionId) window.multiplayerClient.leaveSession(currentSessionId);
      currentSessionId = null;
      // Reset state
      players = [];
      sessionScores = {};
      roundScores   = {};
      currentRound  = 0;
      myScore       = 0;
      showScreen('lobby');
    });

    // Cancel loading
    var btnCancel = $id('btnCancelLoading');
    if (btnCancel) btnCancel.addEventListener('click', function () {
      if (window.multiplayerClient) {
        window.multiplayerClient.disconnect();
      }
      if (currentSessionId) {
        window.multiplayerClient.leaveSession(currentSessionId).catch(function () {});
      }
      currentSessionId = null;
      showScreen('lobby');
    });

    // Chat
    var chatInput = $id('chatInput');
    if (chatInput) {
      chatInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') submitGuess();
      });
    }
    var chatSend = $id('chatSend');
    if (chatSend) chatSend.addEventListener('click', submitGuess);
  }

  // ─── HTML escape helper ─────────────────────────────────────────
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ─── Init ────────────────────────────────────────────────────────
  function init() {
    getUserInfo();

    // Auth integration - poll until authManager is ready
    var authCheck = setInterval(function () {
      if (window.authManager && window.authManager.isInitialized) {
        clearInterval(authCheck);
        window.authManager.onAuthStateChanged(function (user) {
          if (user) {
            myUid = user.uid;
            myName = user.displayName || user.email || 'Player';
          } else {
            getUserInfo(); // fallback to guest
          }
        });
      }
    }, 100);

    // Initialize global game header (sound, leaderboard, auth buttons)
    if (window.gameHeader) {
      window.gameHeader.init({
        title: 'Doodle Dash',
        icon: '✏️',
        gameId: GAME_ID,
        buttons: ['sound', 'leaderboard', 'auth'],
        onSound: function () { return true; },
        onSignIn: function (user) {
          myUid = user.uid;
          myName = user.displayName || user.email || 'Player';
        },
        onSignOut: function () {
          getUserInfo(); // reset to guest
        },
      });
    }

    bindLobbyActions();
    bindMultiplayerEvents();
    showScreen('lobby');

    // Unlock audio on first user interaction
    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('touchstart', unlockAudio, { once: true });

    // Warm-up canvas (it might not exist yet - init when entering playing screen)
    if ($id('ddCanvas')) initCanvas();
  }

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
