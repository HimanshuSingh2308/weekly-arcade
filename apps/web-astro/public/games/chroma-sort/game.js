/**
 * Chroma Sort — Complete Game Logic
 * A color ball sorting puzzle game for Weekly Arcade.
 * Pure vanilla JS, CSS/DOM rendering, Web Audio API audio.
 */
(function () {
  'use strict';

  // ============================================
  // CONSTANTS
  // ============================================

  const GAME_ID = 'chroma-sort';
  const BALLS_PER_TUBE = 4;
  const LS_KEY = 'chromaSort';

  const COLORS = [
    { name: 'violet',    hex: '#8B5CF6', emoji: '\uD83D\uDFE3', marker: '\u25CF' },
    { name: 'ocean',     hex: '#3B82F6', emoji: '\uD83D\uDD35', marker: '\u25CB' },
    { name: 'jade',      hex: '#10B981', emoji: '\uD83D\uDFE2', marker: '\u2605' },
    { name: 'amber',     hex: '#F59E0B', emoji: '\uD83D\uDFE1', marker: '\u25C6' },
    { name: 'coral',     hex: '#EF4444', emoji: '\uD83D\uDD34', marker: '\u25B2' },
    { name: 'tangerine', hex: '#F97316', emoji: '\uD83D\uDFE0', marker: '\u25A0' },
    { name: 'rose',      hex: '#EC4899', emoji: '\uD83E\uDEF7', marker: '\u2736' },
    { name: 'slate',     hex: '#64748B', emoji: '\u26AB',        marker: '\u2666' },
    { name: 'teal',      hex: '#14B8A6', emoji: '\uD83E\uDEF5', marker: '\u2663' },
    { name: 'crimson',   hex: '#DC2626', emoji: '\uD83D\uDFE5', marker: '\u2660' },
  ];

  const DIFFICULTY = {
    easy:   { colors: 4,  tubes: 6,  empty: 2, timePar: 120 },
    medium: { colors: 6,  tubes: 8,  empty: 2, timePar: 300 },
    hard:   { colors: 8,  tubes: 11, empty: 2, timePar: 720 },
  };

  const ENDLESS_TIERS = [
    { minLevel: 1,   maxLevel: 3,   colors: 3,  tubes: 5,  empty: 2 },
    { minLevel: 4,   maxLevel: 7,   colors: 4,  tubes: 6,  empty: 2 },
    { minLevel: 8,   maxLevel: 14,  colors: 4,  tubes: 6,  empty: 2 },
    { minLevel: 15,  maxLevel: 30,  colors: 5,  tubes: 7,  empty: 2 },
    { minLevel: 31,  maxLevel: 49,  colors: 6,  tubes: 8,  empty: 2 },
    { minLevel: 50,  maxLevel: 60,  colors: 7,  tubes: 9,  empty: 2 },
    { minLevel: 61,  maxLevel: 100, colors: 8,  tubes: 10, empty: 2 },
    { minLevel: 101, maxLevel: 9999, colors: 9, tubes: 11, empty: 2 },
  ];

  const PAR_MOVES = { 3: 12, 4: 25, 5: 35, 6: 45, 7: 60, 8: 80, 9: 100, 10: 120 };

  const TIPS = [
    'Stack-transfer: same-color balls on top move together in one move.',
    'Press Undo anytime \u2014 it\'s always free.',
    'Stuck? Use a Hint to see the next best move.',
    'Try to keep at least one empty tube free at all times.',
    'Complete 5 levels without power-ups to earn an Extra Tube!',
    'Work bottom-up: get bottom balls to their final tubes first.',
  ];

  // ============================================
  // SEEDED PRNG (Mulberry32)
  // ============================================

  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function getDailySeed(dateStr, difficulty) {
    var cleaned = dateStr.replace(/-/g, '');
    var diffIndex = { easy: 1, medium: 2, hard: 3 }[difficulty] || 1;
    return parseInt(cleaned, 10) * 10 + diffIndex;
  }

  function getTodayStr() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  // ============================================
  // PUZZLE GENERATOR
  // ============================================

  function generatePuzzle(colorCount, tubeCount, emptyCount, rng) {
    // Start with solved state
    var tubes = [];
    for (var c = 0; c < colorCount; c++) {
      var tube = [];
      for (var b = 0; b < BALLS_PER_TUBE; b++) {
        tube.push(COLORS[c].name);
      }
      tubes.push(tube);
    }
    // Add empty tubes (use tubeCount - colorCount to match config, fallback to emptyCount)
    var actualEmpty = tubeCount > colorCount ? tubeCount - colorCount : emptyCount;
    for (var e = 0; e < actualEmpty; e++) {
      tubes.push([]);
    }

    // Apply reverse moves to scramble
    var moves = colorCount * BALLS_PER_TUBE * 3;
    for (var i = 0; i < moves; i++) {
      var nonEmpty = [];
      for (var ti = 0; ti < tubes.length; ti++) {
        if (tubes[ti].length > 0) nonEmpty.push(ti);
      }
      if (nonEmpty.length === 0) break;

      var srcIdx = nonEmpty[Math.floor(rng() * nonEmpty.length)];
      var validDests = [];
      for (var di = 0; di < tubes.length; di++) {
        if (di === srcIdx) continue;
        if (tubes[di].length < BALLS_PER_TUBE) {
          validDests.push(di);
        }
      }
      if (validDests.length === 0) continue;

      var destIdx = validDests[Math.floor(rng() * validDests.length)];
      var ball = tubes[srcIdx].pop();
      tubes[destIdx].push(ball);
    }

    // Ensure puzzle is not already solved
    if (isSolved(tubes)) {
      // Swap a ball to break it
      if (tubes[0].length > 0 && tubes[1].length > 0) {
        var a = tubes[0].pop();
        var b = tubes[1].pop();
        tubes[0].push(b);
        tubes[1].push(a);
      }
    }

    return tubes;
  }

  function isSolved(tubes) {
    for (var i = 0; i < tubes.length; i++) {
      var t = tubes[i];
      if (t.length === 0) continue;
      if (t.length !== BALLS_PER_TUBE) return false;
      var c = t[0];
      for (var j = 1; j < t.length; j++) {
        if (t[j] !== c) return false;
      }
    }
    // Ensure at least one tube is full
    var hasFull = false;
    for (var i = 0; i < tubes.length; i++) {
      if (tubes[i].length === BALLS_PER_TUBE) hasFull = true;
    }
    return hasFull;
  }

  function isTubeComplete(tube) {
    if (tube.length !== BALLS_PER_TUBE) return false;
    var c = tube[0];
    for (var i = 1; i < tube.length; i++) {
      if (tube[i] !== c) return false;
    }
    return true;
  }

  // ============================================
  // HINT SOLVER (BFS — limited depth)
  // ============================================

  function findBestMove(tubes) {
    // Simple greedy: find a move that places a ball on matching color, or moves to empty as fallback
    var bestMatch = null;
    var bestEmpty = null;

    for (var src = 0; src < tubes.length; src++) {
      if (tubes[src].length === 0) continue;
      var topBall = tubes[src][tubes[src].length - 1];

      // Count how many same-color balls are on top of src
      var stackCount = 1;
      for (var k = tubes[src].length - 2; k >= 0; k--) {
        if (tubes[src][k] === topBall) stackCount++;
        else break;
      }

      for (var dest = 0; dest < tubes.length; dest++) {
        if (dest === src) continue;
        if (tubes[dest].length + stackCount > BALLS_PER_TUBE) continue;

        if (tubes[dest].length === 0) {
          // Don't suggest moving to empty if source is all same color (pointless)
          if (tubes[src].length === stackCount) continue;
          if (!bestEmpty) bestEmpty = { src: src, dest: dest };
        } else if (tubes[dest][tubes[dest].length - 1] === topBall) {
          // Prefer moves that complete more of a tube
          if (!bestMatch) bestMatch = { src: src, dest: dest };
        }
      }
    }

    return bestMatch || bestEmpty;
  }

  // ============================================
  // AUDIO ENGINE (Web Audio API)
  // ============================================

  var audio = {
    ctx: null,
    masterGain: null,
    enabled: true,
    volume: 0.3,

    init: function () {
      if (this.ctx) return;
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = this.volume;
        // iOS requires explicit resume after user gesture
        if (this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
      } catch (e) { /* no audio support */ }
    },

    setVolume: function (v) {
      this.volume = Math.max(0, Math.min(1, v));
      if (this.masterGain) {
        this.masterGain.gain.value = this.enabled ? this.volume : 0;
      }
    },

    // Play a tone at a specific time offset using AudioContext scheduling
    // (no setTimeout — precise timing, works in background tabs)
    playTone: function (freq, duration, type, gain, startOffset) {
      if (!this.ctx || !this.enabled || !this.masterGain) return;
      type = type || 'sine';
      gain = gain !== undefined ? gain : 0.3;
      startOffset = startOffset || 0;
      try {
        var now = this.ctx.currentTime + startOffset;
        var osc = this.ctx.createOscillator();
        var g = this.ctx.createGain();
        osc.connect(g);
        g.connect(this.masterGain);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        // ADSR: quick attack (5ms), sustain, exponential release
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(gain * 1.2, now + 0.005); // attack peak
        g.gain.linearRampToValueAtTime(gain, now + 0.015);        // settle to sustain
        g.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.start(now);
        osc.stop(now + duration + 0.05);
      } catch (e) { /* ignore */ }
    },

    // Play a frequency ramp (single tone that slides)
    playRamp: function (freqStart, freqEnd, duration, type, gain, startOffset) {
      if (!this.ctx || !this.enabled || !this.masterGain) return;
      type = type || 'sine';
      gain = gain !== undefined ? gain : 0.3;
      startOffset = startOffset || 0;
      try {
        var now = this.ctx.currentTime + startOffset;
        var osc = this.ctx.createOscillator();
        var g = this.ctx.createGain();
        osc.connect(g);
        g.connect(this.masterGain);
        osc.type = type;
        osc.frequency.setValueAtTime(freqStart, now);
        osc.frequency.linearRampToValueAtTime(freqEnd, now + duration * 0.7);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(gain, now + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.start(now);
        osc.stop(now + duration + 0.05);
      } catch (e) { /* ignore */ }
    },

    // --- Sound Events ---

    pickup: function () {
      this.playTone(880, 0.08, 'sine', 0.25);
    },

    place: function () {
      // Two-tone thud: 660Hz → 440Hz with ADSR peak for satisfying feel
      this.playTone(660, 0.07, 'sine', 0.3, 0);
      this.playTone(440, 0.09, 'sine', 0.2, 0.03);
    },

    invalid: function () {
      this.playTone(200, 0.12, 'square', 0.12);
    },

    stackTransfer: function (count) {
      // Descending cascade — one tone per ball, AudioContext-scheduled
      var freqs = [660, 550, 440, 370];
      var n = Math.min(count, 4);
      for (var i = 0; i < n; i++) {
        this.playTone(freqs[i], 0.07, 'sine', 0.25, i * 0.04);
      }
    },

    tubeComplete: function () {
      // C-E-G arpeggio — celebratory
      var notes = [523, 659, 784];
      for (var i = 0; i < notes.length; i++) {
        this.playTone(notes[i], 0.3, 'sine', 0.3, i * 0.05);
      }
    },

    win: function () {
      // C-E-G-C fanfare — longer, louder, with rising gain
      var notes = [523, 659, 784, 1047];
      for (var i = 0; i < notes.length; i++) {
        this.playTone(notes[i], 0.5, 'sine', 0.25 + i * 0.05, i * 0.12);
      }
    },

    undo: function () {
      // Falling two-tone — reverse of place
      this.playTone(440, 0.06, 'sine', 0.2, 0);
      this.playTone(330, 0.08, 'sine', 0.15, 0.04);
    },

    hint: function () {
      // Two-note chime — more distinctive than single tone
      this.playTone(1047, 0.15, 'sine', 0.15, 0);
      this.playTone(1319, 0.2, 'sine', 0.12, 0.08);
    },
  };

  // ============================================
  // LOCAL STORAGE
  // ============================================

  function loadLocal() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function saveLocal(data) {
    try {
      var existing = loadLocal();
      Object.assign(existing, data);
      localStorage.setItem(LS_KEY, JSON.stringify(existing));
    } catch (e) { /* ignore */ }
  }

  // ============================================
  // STATE
  // ============================================

  var state = {
    screen: 'home', // home | puzzle | win
    mode: null,     // 'daily' | 'endless'
    difficulty: null,
    dailyDate: getTodayStr(),
    tubes: [],
    selectedTube: null,
    moveCount: 0,
    undoCount: 0,
    hintsUsed: 0,
    extraTubeUsed: false,
    startTime: null,
    elapsed: 0,
    solved: false,
    history: [],
    // Persistent
    streak: 0,
    longestStreak: 0,
    endlessLevel: 1,
    totalStars: 0,
    dailyCompleted: {},
    hintsRemaining: 3,
    hintsLastRefresh: null,
    extraTubesAvailable: 0,
    noHintStreak: 0,
    tutorialComplete: false,
    tutorialStep: 0,
    colorBlindMode: false,
    shareCount: 0,
  };

  var timerInterval = null;
  var hintTimeout = null;
  var currentUser = null;

  // ============================================
  // APP ROOT
  // ============================================

  var app = document.getElementById('chroma-sort-app');

  function initState() {
    var saved = loadLocal();
    state.streak = saved.streak || 0;
    state.longestStreak = saved.longestStreak || 0;
    state.endlessLevel = saved.endlessLevel || 1;
    state.totalStars = saved.totalStars || 0;
    state.dailyCompleted = saved.dailyCompleted || {};
    state.hintsRemaining = saved.hintsRemaining !== undefined ? saved.hintsRemaining : 3;
    state.hintsLastRefresh = saved.hintsLastRefresh || null;
    state.extraTubesAvailable = saved.extraTubesAvailable || 0;
    state.noHintStreak = saved.noHintStreak || 0;
    state.tutorialComplete = saved.tutorialComplete || false;
    state.colorBlindMode = saved.colorBlindMode || false;
    state.shareCount = saved.shareCount || 0;
    audio.enabled = saved.soundEnabled !== undefined ? saved.soundEnabled : true;

    // Refresh daily hints
    var today = getTodayStr();
    if (state.hintsLastRefresh !== today) {
      state.hintsRemaining = 3;
      state.hintsLastRefresh = today;
      saveLocal({ hintsRemaining: 3, hintsLastRefresh: today });
    }

    // Clean old daily completed (keep only last 7 days)
    var keys = Object.keys(state.dailyCompleted);
    if (keys.length > 7) {
      keys.sort();
      var toDelete = keys.slice(0, keys.length - 7);
      toDelete.forEach(function (k) { delete state.dailyCompleted[k]; });
    }

    // Update streak
    updateStreak();
  }

  function updateStreak() {
    var today = getTodayStr();
    var todayData = state.dailyCompleted[today];
    if (!todayData) return;

    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    var ys = yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0');
    var yData = state.dailyCompleted[ys];

    // If today is completed but streak wasn't set yet
    if (todayData.easy || todayData.medium || todayData.hard) {
      if (state.streak === 0 || (!yData || (!yData.easy && !yData.medium && !yData.hard))) {
        // Check if it's a continuation (yesterday was completed)
        if (yData && (yData.easy || yData.medium || yData.hard)) {
          // streak already incremented
        } else {
          state.streak = Math.max(state.streak, 1);
        }
      }
    }
  }

  // ============================================
  // RENDER: HOME SCREEN
  // ============================================

  function renderHome() {
    hideTutorialOverlay();
    state.screen = 'home';
    state.selectedTube = null;
    clearInterval(timerInterval);
    clearTimeout(hintTimeout);

    var today = getTodayStr();
    var todayData = state.dailyCompleted[today] || {};
    var dateDisplay = formatDate(today);

    var html = '<div class="cs-home">';
    html += '<div class="cs-home-title">\uD83C\uDFA8 Chroma Sort</div>';
    html += '<div class="cs-home-subtitle">Sort the chaos. Own the day.</div>';

    // Daily Challenge Card
    html += '<div class="cs-daily-card">';
    html += '<div class="cs-daily-card-header">';
    html += '<span class="cs-daily-date">' + dateDisplay + '</span>';
    if (state.streak > 0) {
      html += '<span class="cs-streak-badge">\uD83D\uDD25 ' + state.streak + ' day streak</span>';
    }
    html += '</div>';
    html += '<div class="cs-diff-buttons">';
    ['easy', 'medium', 'hard'].forEach(function (diff) {
      var completed = todayData[diff];
      var cls = completed ? ' completed' : '';
      var d = DIFFICULTY[diff];
      html += '<button class="cs-diff-btn' + cls + '" data-action="daily" data-diff="' + diff + '" role="button">';
      html += '<span>' + diff.charAt(0).toUpperCase() + diff.slice(1) + '</span>';
      html += '<span class="cs-diff-label">' + d.colors + ' colors</span>';
      if (!completed) html += '<span class="cs-diff-play">\u25B6 Play</span>';
      html += '</button>';
    });
    html += '</div>';
    html += '</div>';

    // Endless Mode Card
    html += '<button class="cs-endless-card" data-action="endless" role="button">';
    html += '<div class="cs-endless-info">';
    html += '<div class="cs-endless-title">Endless Mode</div>';
    html += '<div class="cs-endless-level">' + (state.endlessLevel > 1 ? 'Continue: Level ' + state.endlessLevel : 'Start from Level 1') + ' \u2022 ' + state.totalStars + ' \u2B50</div>';
    html += '</div>';
    html += '<span class="cs-endless-arrow">\u203A</span>';
    html += '</button>';

    // Settings Row
    html += '<div class="cs-settings-row">';
    html += '<button class="cs-settings-btn' + (state.colorBlindMode ? ' active' : '') + '" data-action="toggle-cb">\u2B55 Color Blind</button>';
    html += '<button class="cs-settings-btn' + (audio.enabled ? ' active' : '') + '" data-action="toggle-sound">\uD83D\uDD0A Sound</button>';
    html += '</div>';

    html += '</div>';
    app.innerHTML = html;
    bindHomeEvents();
  }

  function formatDate(dateStr) {
    var parts = dateStr.split('-');
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[parseInt(parts[1], 10) - 1] + ' ' + parseInt(parts[2], 10) + ', ' + parts[0];
  }

  function bindHomeEvents() {
    app.querySelectorAll('[data-action="daily"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        audio.init();
        startDaily(btn.getAttribute('data-diff'));
      });
    });

    app.querySelector('[data-action="endless"]').addEventListener('click', function () {
      audio.init();
      startEndless(state.endlessLevel);
    });

    var cbBtn = app.querySelector('[data-action="toggle-cb"]');
    if (cbBtn) {
      cbBtn.addEventListener('click', function () {
        state.colorBlindMode = !state.colorBlindMode;
        saveLocal({ colorBlindMode: state.colorBlindMode });
        renderHome();
      });
    }

    var sndBtn = app.querySelector('[data-action="toggle-sound"]');
    if (sndBtn) {
      sndBtn.addEventListener('click', function () {
        audio.init();
        audio.enabled = !audio.enabled;
        saveLocal({ soundEnabled: audio.enabled });
        renderHome();
      });
    }
  }

  // ============================================
  // START GAME MODES
  // ============================================

  function startDaily(difficulty) {
    var today = getTodayStr();
    var d = DIFFICULTY[difficulty];
    var seed = getDailySeed(today, difficulty);
    var rng = mulberry32(seed);

    state.mode = 'daily';
    state.difficulty = difficulty;
    state.dailyDate = today;
    state.tubes = generatePuzzle(d.colors, d.tubes, d.empty, rng);
    state.selectedTube = null;
    state.moveCount = 0;
    state.undoCount = 0;
    state.hintsUsed = 0;
    state.extraTubeUsed = false;
    state.startTime = null;
    state.elapsed = 0;
    state.solved = false;
    state.history = [];
    state.tutorialStep = 0;

    renderPuzzle();
  }

  function startEndless(level) {
    var tier = getEndlessTier(level);
    var seed = level * 1000 + 42;
    // Every 10th level is a breather (one tier lower)
    var effectiveTier = tier;
    if (level >= 10 && level % 10 === 0) {
      effectiveTier = getEndlessTier(Math.max(1, level - 15));
    }
    var rng = mulberry32(seed);

    state.mode = 'endless';
    state.difficulty = null;
    state.tubes = generatePuzzle(effectiveTier.colors, effectiveTier.tubes, effectiveTier.empty, rng);
    state.selectedTube = null;
    state.moveCount = 0;
    state.undoCount = 0;
    state.hintsUsed = 0;
    state.extraTubeUsed = false;
    state.startTime = null;
    state.elapsed = 0;
    state.solved = false;
    state.history = [];
    state.tutorialStep = 0;

    renderPuzzle();
  }

  function getEndlessTier(level) {
    for (var i = ENDLESS_TIERS.length - 1; i >= 0; i--) {
      if (level >= ENDLESS_TIERS[i].minLevel) return ENDLESS_TIERS[i];
    }
    return ENDLESS_TIERS[0];
  }

  // ============================================
  // RENDER: PUZZLE SCREEN
  // ============================================

  function renderPuzzle() {
    state.screen = 'puzzle';
    clearInterval(timerInterval);

    var modeLabel = '';
    if (state.mode === 'daily') {
      modeLabel = 'Daily \u2022 ' + state.difficulty.charAt(0).toUpperCase() + state.difficulty.slice(1);
    } else {
      modeLabel = 'Level ' + state.endlessLevel;
    }

    var html = '<div class="cs-puzzle">';

    // Top bar
    html += '<div class="cs-top-bar">';
    html += '<div class="cs-top-left">';
    html += '<button class="cs-back-btn" data-action="back" aria-label="Back to menu">\u2190</button>';
    html += '<span class="cs-mode-label">' + modeLabel + '</span>';
    html += '</div>';
    html += '<div class="cs-top-right">';
    if (state.mode === 'daily') {
      html += '<span class="cs-timer" id="cs-timer" aria-live="off" aria-label="Timer">0:00</span>';
    }
    html += '<span class="cs-move-count" id="cs-moves" aria-live="polite" aria-label="Move count">0 moves</span>';
    html += '</div>';
    html += '</div>';

    // Tube grid
    html += '<div class="cs-tube-grid" id="cs-tube-grid">';
    html += renderTubes();
    html += '</div>';

    // Action bar
    html += '<div class="cs-action-bar">';
    html += '<button class="cs-action-btn" data-action="undo" id="cs-undo-btn" aria-label="Undo last move" disabled>';
    html += '\u21A9';
    html += '<span class="cs-action-label">Undo</span>';
    html += '</button>';

    html += '<button class="cs-action-btn" data-action="hint" id="cs-hint-btn" aria-label="Get a hint">';
    html += '\uD83D\uDCA1';
    html += '<span class="cs-action-label">Hint</span>';
    html += '<span class="cs-action-badge" id="cs-hints-left">' + state.hintsRemaining + ' left</span>';
    html += '</button>';

    html += '<button class="cs-action-btn" data-action="extra-tube" id="cs-extra-btn" aria-label="Add extra tube"' + (state.extraTubesAvailable <= 0 || state.extraTubeUsed ? ' disabled' : '') + '>';
    html += '\uD83E\uDDEA';
    html += '<span class="cs-action-label">Extra Tube</span>';
    html += '<span class="cs-action-badge">' + state.extraTubesAvailable + '</span>';
    html += '</button>';

    html += '<button class="cs-action-btn" data-action="restart" aria-label="Restart puzzle">';
    html += '\uD83D\uDD04';
    html += '<span class="cs-action-label">Restart</span>';
    html += '</button>';
    html += '</div>';

    // Tutorial tip (for new players in early endless levels)
    if (state.mode === 'endless' && !state.tutorialComplete && state.endlessLevel <= 3) {
      var tipIdx = Math.min(state.endlessLevel - 1, TIPS.length - 1);
      html += '<div class="cs-tip-bar">' + TIPS[tipIdx] + '</div>';
    }

    html += '</div>';
    app.innerHTML = html;

    if (state.colorBlindMode) {
      app.classList.add('color-blind-mode');
    } else {
      app.classList.remove('color-blind-mode');
    }

    bindPuzzleEvents();
    startTimer();

    // Show tutorial overlay for first-ever puzzle
    if (!state.tutorialComplete && state.mode === 'endless' && state.endlessLevel === 1 && state.moveCount === 0) {
      showTutorialStep(0);
    }
  }

  function renderTubes() {
    var html = '';
    for (var i = 0; i < state.tubes.length; i++) {
      var tube = state.tubes[i];
      var isSelected = state.selectedTube === i;
      var isComplete = isTubeComplete(tube);
      var cls = 'cs-tube';
      if (isSelected) cls += ' selected';
      if (isComplete) cls += ' complete';

      html += '<div class="' + cls + '" data-tube="' + i + '" role="button" tabindex="0"';
      html += ' aria-label="Tube ' + (i + 1) + (tube.length === 0 ? ', empty' : ', ' + tube.length + ' balls') + '"';
      if (isSelected) html += ' aria-selected="true"';
      html += '>';

      for (var j = 0; j < tube.length; j++) {
        var color = tube[j];
        var isTop = j === tube.length - 1;
        var ballCls = 'cs-ball';
        if (isSelected && isTop) ballCls += ' lifted';
        var colorData = COLORS.find(function (c) { return c.name === color; });
        var marker = colorData ? colorData.marker : '';

        html += '<div class="' + ballCls + '" data-color="' + color + '">';
        html += '<span class="cs-cb-marker">' + marker + '</span>';
        html += '</div>';
      }

      html += '</div>';
    }
    return html;
  }

  function updateTubeGrid() {
    var grid = document.getElementById('cs-tube-grid');
    if (grid) {
      grid.innerHTML = renderTubes();
      bindTubeClicks();
    }
  }

  function bindPuzzleEvents() {
    bindTubeClicks();

    var backBtn = app.querySelector('[data-action="back"]');
    if (backBtn) backBtn.addEventListener('click', function () { renderHome(); });

    var undoBtn = document.getElementById('cs-undo-btn');
    if (undoBtn) undoBtn.addEventListener('click', function () { doUndo(); });

    var hintBtn = document.getElementById('cs-hint-btn');
    if (hintBtn) hintBtn.addEventListener('click', function () { doHint(); });

    var extraBtn = document.getElementById('cs-extra-btn');
    if (extraBtn) extraBtn.addEventListener('click', function () { doExtraTube(); });

    var restartBtn = app.querySelector('[data-action="restart"]');
    if (restartBtn) restartBtn.addEventListener('click', function () {
      if (state.mode === 'daily') {
        startDaily(state.difficulty);
      } else {
        startEndless(state.endlessLevel);
      }
    });

    // Keyboard shortcuts
    document.removeEventListener('keydown', handleKeyDown);
    document.addEventListener('keydown', handleKeyDown);
  }

  function bindTubeClicks() {
    app.querySelectorAll('.cs-tube').forEach(function (el) {
      el.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        audio.init();
        var idx = parseInt(el.getAttribute('data-tube'), 10);
        handleTubeClick(idx);
      });
      // Keyboard: Enter/Space activates tube (WCAG 2.1.1)
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          audio.init();
          var idx = parseInt(el.getAttribute('data-tube'), 10);
          handleTubeClick(idx);
        }
      });
    });
  }

  function handleKeyDown(e) {
    if (state.screen !== 'puzzle') return;

    if (e.key === 'z' || e.key === 'Z') {
      e.preventDefault();
      doUndo();
    } else if (e.key === 'h' || e.key === 'H') {
      e.preventDefault();
      doHint();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      renderHome();
    }
  }

  // ============================================
  // GAME LOGIC
  // ============================================

  function handleTubeClick(tubeIndex) {
    if (state.solved) return;

    // Start timer on first interaction
    if (!state.startTime) {
      state.startTime = Date.now();
    }

    // Clear hint highlights
    clearHintHighlights();

    if (state.selectedTube === null) {
      // SELECT
      if (state.tubes[tubeIndex].length === 0) return;
      state.selectedTube = tubeIndex;
      audio.pickup();
      updateTubeGrid();

      // Tutorial: advance step
      if (!state.tutorialComplete && state.tutorialStep === 0) {
        showTutorialStep(1);
      }
    } else if (state.selectedTube === tubeIndex) {
      // DESELECT
      state.selectedTube = null;
      updateTubeGrid();
    } else {
      // ATTEMPT MOVE
      attemptMove(state.selectedTube, tubeIndex);
    }
  }

  function attemptMove(srcIdx, destIdx) {
    var src = state.tubes[srcIdx];
    var dest = state.tubes[destIdx];

    if (src.length === 0) {
      state.selectedTube = null;
      updateTubeGrid();
      return;
    }

    var topColor = src[src.length - 1];

    // Count same-color stack on top
    var stackCount = 1;
    for (var k = src.length - 2; k >= 0; k--) {
      if (src[k] === topColor) stackCount++;
      else break;
    }

    // Check validity
    var canPlace = false;
    if (dest.length === 0) {
      canPlace = true;
    } else if (dest[dest.length - 1] === topColor) {
      canPlace = true;
    }

    // Check capacity
    var transferCount = Math.min(stackCount, BALLS_PER_TUBE - dest.length);
    if (!canPlace || transferCount <= 0) {
      // Invalid move
      audio.invalid();
      var tubeEl = app.querySelectorAll('.cs-tube')[destIdx];
      if (tubeEl) {
        tubeEl.classList.add('invalid-shake');
        setTimeout(function () { tubeEl.classList.remove('invalid-shake'); }, 200);
      }
      state.selectedTube = null;
      updateTubeGrid();
      return;
    }

    // Additional check: if dest is not empty, all transferred must match
    if (dest.length > 0 && dest[dest.length - 1] !== topColor) {
      audio.invalid();
      state.selectedTube = null;
      updateTubeGrid();
      return;
    }

    // Save history for undo
    state.history.push(cloneTubes(state.tubes));

    // Execute move
    var movedBalls = [];
    for (var m = 0; m < transferCount; m++) {
      movedBalls.push(src.pop());
    }
    for (var m = movedBalls.length - 1; m >= 0; m--) {
      dest.push(movedBalls[m]);
    }

    state.moveCount++;
    state.selectedTube = null;

    // Audio
    if (transferCount > 1) {
      audio.stackTransfer(transferCount);
    } else {
      audio.place();
    }

    updateTubeGrid();
    updateMoveDisplay();
    updateUndoButton();

    // Check for newly completed tube
    if (isTubeComplete(dest)) {
      audio.tubeComplete();
    }

    // Check win
    if (isSolved(state.tubes)) {
      onWin();
    }

    // Tutorial: mark complete after a few moves
    if (!state.tutorialComplete && state.moveCount >= 2) {
      state.tutorialComplete = true;
      saveLocal({ tutorialComplete: true });
      hideTutorialOverlay();
    }
  }

  function cloneTubes(tubes) {
    return tubes.map(function (t) { return t.slice(); });
  }

  function doUndo() {
    if (state.history.length === 0 || state.solved) return;
    state.tubes = state.history.pop();
    state.moveCount = Math.max(0, state.moveCount - 1);
    state.undoCount++;
    state.selectedTube = null;
    audio.undo();
    updateTubeGrid();
    updateMoveDisplay();
    updateUndoButton();
  }

  function doHint() {
    if (state.hintsRemaining <= 0 || state.solved) {
      showToast('No hints remaining. Refreshes daily!');
      return;
    }

    var move = findBestMove(state.tubes);
    if (!move) {
      showToast('No helpful move found. Try undoing!');
      return;
    }

    state.hintsRemaining--;
    state.hintsUsed++;
    saveLocal({ hintsRemaining: state.hintsRemaining });
    audio.hint();

    // Update hint badge
    var badge = document.getElementById('cs-hints-left');
    if (badge) badge.textContent = state.hintsRemaining + ' left';

    // Highlight tubes
    var tubes = app.querySelectorAll('.cs-tube');
    if (tubes[move.src]) tubes[move.src].classList.add('hint-source');
    if (tubes[move.dest]) tubes[move.dest].classList.add('hint-dest');

    clearTimeout(hintTimeout);
    hintTimeout = setTimeout(clearHintHighlights, 2500);
  }

  function clearHintHighlights() {
    app.querySelectorAll('.hint-source, .hint-dest').forEach(function (el) {
      el.classList.remove('hint-source', 'hint-dest');
    });
  }

  function doExtraTube() {
    if (state.extraTubesAvailable <= 0 || state.extraTubeUsed || state.solved) return;
    state.extraTubeUsed = true;
    state.extraTubesAvailable--;
    state.tubes.push([]);
    saveLocal({ extraTubesAvailable: state.extraTubesAvailable });
    audio.hint();
    updateTubeGrid();

    var extraBtn = document.getElementById('cs-extra-btn');
    if (extraBtn) extraBtn.disabled = true;
  }

  function updateMoveDisplay() {
    var el = document.getElementById('cs-moves');
    if (el) el.textContent = state.moveCount + ' move' + (state.moveCount !== 1 ? 's' : '');
  }

  function updateUndoButton() {
    var btn = document.getElementById('cs-undo-btn');
    if (btn) btn.disabled = state.history.length === 0;
  }

  // ============================================
  // TIMER
  // ============================================

  function startTimer() {
    clearInterval(timerInterval);
    if (state.mode !== 'daily') return;

    timerInterval = setInterval(function () {
      if (!state.startTime || state.solved) return;
      state.elapsed = Date.now() - state.startTime;
      var el = document.getElementById('cs-timer');
      if (el) el.textContent = formatTime(state.elapsed);
    }, 200);
  }

  function formatTime(ms) {
    var totalSec = Math.floor(ms / 1000);
    var min = Math.floor(totalSec / 60);
    var sec = totalSec % 60;
    return min + ':' + String(sec).padStart(2, '0');
  }

  // ============================================
  // WIN
  // ============================================

  function onWin() {
    state.solved = true;
    state.elapsed = state.startTime ? Date.now() - state.startTime : 0;
    clearInterval(timerInterval);

    audio.win();
    spawnConfetti();

    if (state.mode === 'daily') {
      onDailyWin();
    } else {
      onEndlessWin();
    }
  }

  function onDailyWin() {
    var score = calculateDailyScore();
    var today = getTodayStr();

    // Update daily completion
    if (!state.dailyCompleted[today]) state.dailyCompleted[today] = {};
    state.dailyCompleted[today][state.difficulty] = score;

    // Update streak
    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    var ys = yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0');
    var yData = state.dailyCompleted[ys];

    if (yData && (yData.easy || yData.medium || yData.hard)) {
      state.streak++;
    } else {
      state.streak = 1;
    }
    state.longestStreak = Math.max(state.longestStreak, state.streak);

    saveLocal({
      dailyCompleted: state.dailyCompleted,
      streak: state.streak,
      longestStreak: state.longestStreak,
    });

    // Submit score and sync cloud state
    submitDailyScore(score);
    saveCloudState();

    // Check achievements
    checkAchievements(score);

    // Show win screen
    setTimeout(function () { renderWinScreen(score); }, 600);
  }

  function onEndlessWin() {
    // Calculate stars
    var tier = getEndlessTier(state.endlessLevel);
    var par = PAR_MOVES[tier.colors] || 80;
    var stars = 1;
    if (state.moveCount <= par * 1.5 && !state.extraTubeUsed) stars = 2;
    if (state.moveCount <= par && state.hintsUsed === 0 && !state.extraTubeUsed) stars = 3;

    state.totalStars += stars;
    state.endlessLevel++;

    // Track no-hint streak for Extra Tube earning
    if (state.hintsUsed === 0 && !state.extraTubeUsed) {
      state.noHintStreak++;
      if (state.noHintStreak >= 5) {
        state.extraTubesAvailable = Math.min(state.extraTubesAvailable + 1, 3);
        state.noHintStreak = 0;
        if (state.extraTubesAvailable < 3) showToast('Earned an Extra Tube power-up!');
      }
    } else {
      state.noHintStreak = 0;
    }

    saveLocal({
      endlessLevel: state.endlessLevel,
      totalStars: state.totalStars,
      noHintStreak: state.noHintStreak,
      extraTubesAvailable: state.extraTubesAvailable,
    });

    // Check achievements
    checkEndlessAchievements();

    // Submit endless level to leaderboard
    try {
      if (currentUser && window.apiClient) {
        window.apiClient.submitScore(GAME_ID, {
          score: state.endlessLevel,
          level: state.endlessLevel,
          metadata: {
            mode: 'endless',
            totalStars: state.totalStars,
          },
        });
      }
    } catch (e) {
      console.warn('Endless score submission failed:', e);
    }

    // Cloud save
    saveCloudState();

    // Show win screen
    setTimeout(function () { renderEndlessWinScreen(stars); }, 600);
  }

  // ============================================
  // SCORING
  // ============================================

  function calculateDailyScore() {
    var d = DIFFICULTY[state.difficulty];
    var timeSeconds = Math.floor(state.elapsed / 1000);

    var BASE = 10000;
    var movePenalty = state.moveCount * 40;
    var timeBonus = Math.max(0, (d.timePar - timeSeconds) * 20);
    var undoMod = Math.max(0.3, 1.0 - state.undoCount * 0.03);
    var hintPenalty = state.hintsUsed * 300;
    var extraPenalty = state.extraTubeUsed ? 2000 : 0;

    var capped = Math.min(BASE - movePenalty + timeBonus - hintPenalty - extraPenalty, 10000);
    var raw = capped * undoMod;
    return Math.max(100, Math.round(raw));
  }

  // ============================================
  // SCORE SUBMISSION & CLOUD
  // ============================================

  function submitDailyScore(score) {
    var d = DIFFICULTY[state.difficulty];
    var levelTier = { easy: 1, medium: 2, hard: 3 }[state.difficulty];
    var perfectSolve = state.hintsUsed === 0 && state.undoCount === 0 && !state.extraTubeUsed;

    var shareEmoji = buildShareEmoji();

    try {
      if (currentUser && window.apiClient) {
        window.apiClient.submitScore(GAME_ID, {
          score: score,
          timeMs: Math.round(state.elapsed),
          level: levelTier,
          guessCount: state.moveCount,
          metadata: {
            mode: 'daily',
            dailyDate: state.dailyDate,
            difficulty: state.difficulty,
            colorCount: d.colors,
            tubeCount: d.tubes,
            hintsUsed: state.hintsUsed,
            undosUsed: state.undoCount,
            extraTubesUsed: state.extraTubeUsed ? 1 : 0,
            perfectSolve: perfectSolve,
            shareEmoji: shareEmoji,
          },
        });
      }
    } catch (e) {
      console.warn('Score submission failed:', e);
    }
  }

  function saveCloudState() {
    try {
      if (currentUser && window.apiClient) {
        // Map game state to API's SaveGameStateDto shape
        window.apiClient.saveGameState(GAME_ID, {
          currentLevel: Math.max(1, state.endlessLevel),
          currentStreak: Math.max(0, state.streak),
          bestStreak: Math.max(0, state.longestStreak),
          gamesPlayed: Math.max(0, Object.keys(state.dailyCompleted).length),
          gamesWon: Math.max(0, Object.keys(state.dailyCompleted).length),
          additionalData: {
            endlessLevel: state.endlessLevel,
            totalStars: state.totalStars,
            streak: state.streak,
            longestStreak: state.longestStreak,
            dailyCompleted: state.dailyCompleted,
            extraTubesAvailable: state.extraTubesAvailable,
            noHintStreak: state.noHintStreak,
          },
        });
      }
    } catch (e) { /* ignore */ }
  }

  function loadCloudState() {
    try {
      if (currentUser && window.apiClient) {
        window.apiClient.getGameState(GAME_ID).then(function (raw) {
          if (!raw) return;
          // Game-specific data is inside additionalData
          var cloud = (raw.additionalData || raw);
          // Merge: prefer higher values
          if (cloud.endlessLevel > state.endlessLevel) {
            state.endlessLevel = cloud.endlessLevel;
          }
          if (cloud.totalStars > state.totalStars) {
            state.totalStars = cloud.totalStars;
          }
          if (cloud.streak > state.streak) {
            state.streak = cloud.streak;
          }
          if (cloud.longestStreak > state.longestStreak) {
            state.longestStreak = cloud.longestStreak;
          }
          if (cloud.extraTubesAvailable > state.extraTubesAvailable) {
            state.extraTubesAvailable = cloud.extraTubesAvailable;
          }
          // Merge daily completed
          if (cloud.dailyCompleted) {
            Object.keys(cloud.dailyCompleted).forEach(function (date) {
              if (!state.dailyCompleted[date]) {
                state.dailyCompleted[date] = cloud.dailyCompleted[date];
              } else {
                var local = state.dailyCompleted[date];
                var remote = cloud.dailyCompleted[date];
                ['easy', 'medium', 'hard'].forEach(function (d) {
                  if (remote[d] && (!local[d] || remote[d] > local[d])) {
                    local[d] = remote[d];
                  }
                });
              }
            });
          }

          saveLocal({
            endlessLevel: state.endlessLevel,
            totalStars: state.totalStars,
            streak: state.streak,
            longestStreak: state.longestStreak,
            dailyCompleted: state.dailyCompleted,
            extraTubesAvailable: state.extraTubesAvailable,
          });

          // Re-render if on home
          if (state.screen === 'home') renderHome();
        });
      }
    } catch (e) { /* ignore */ }
  }

  // ============================================
  // ACHIEVEMENTS
  // ============================================

  function checkAchievements(score) {
    var unlock = function (id) {
      try {
        if (currentUser && window.apiClient) {
          window.apiClient.unlockAchievement(id, GAME_ID);
        }
      } catch (e) { /* ignore */ }
    };

    // First solve
    unlock('cs-first-solve');

    // Perfect daily
    if (state.hintsUsed === 0 && state.undoCount === 0 && !state.extraTubeUsed) {
      unlock('cs-perfect-daily');
    }

    // Hard first
    if (state.difficulty === 'hard') {
      unlock('cs-hard-first');
    }

    // No undo easy
    if (state.difficulty === 'easy' && state.undoCount === 0) {
      unlock('cs-no-undo-easy');
    }

    // Speed demon (medium under 3 min)
    if (state.difficulty === 'medium' && state.elapsed < 180000) {
      unlock('cs-speed-demon');
    }

    // Streak achievements
    if (state.streak >= 3) unlock('cs-daily-streak-3');
    if (state.streak >= 7) unlock('cs-daily-streak-7');
    if (state.streak >= 30) unlock('cs-daily-streak-30');
  }

  function checkEndlessAchievements() {
    var unlock = function (id) {
      try {
        if (currentUser && window.apiClient) {
          window.apiClient.unlockAchievement(id, GAME_ID);
        }
      } catch (e) { /* ignore */ }
    };

    unlock('cs-first-solve');
    if (state.endlessLevel >= 25) unlock('cs-endless-25');
    if (state.endlessLevel >= 50) unlock('cs-endless-50');
    if (state.endlessLevel >= 100) unlock('cs-endless-100');
  }

  // ============================================
  // SHARE
  // ============================================

  function buildShareEmoji() {
    // Performance-based grid (spoiler-free, like Wordle)
    // Show colored squares for sorted tubes, black for empty
    var d = DIFFICULTY[state.difficulty];
    var squares = [];
    for (var i = 0; i < d.colors; i++) {
      var c = COLORS[i];
      squares.push(c ? c.emoji : '\uD83D\uDFE3');
    }
    return squares.join('');
  }

  function buildShareText(score) {
    var d = state.difficulty.charAt(0).toUpperCase() + state.difficulty.slice(1);
    var dateStr = formatDate(state.dailyDate);
    var time = formatTime(state.elapsed);
    var diffConfig = DIFFICULTY[state.difficulty];
    var perfect = state.hintsUsed === 0 && state.undoCount === 0 && !state.extraTubeUsed;

    var text = '\uD83C\uDF61 Chroma Sort \u2014 ' + d + '\n';
    text += '\uD83D\uDCC5 ' + dateStr + '\n\n';

    // Performance bar — filled squares for efficiency
    var parMoves = { easy: 25, medium: 45, hard: 80 }[state.difficulty] || 45;
    var efficiency = Math.min(1, parMoves / Math.max(state.moveCount, 1));
    var barLen = diffConfig.colors;
    var filled = Math.max(1, Math.round(efficiency * barLen));
    var bar = '';
    for (var i = 0; i < barLen; i++) {
      if (i < filled) {
        bar += COLORS[i].emoji;
      } else {
        bar += '\u2B1B';
      }
    }
    text += bar + '\n\n';

    // Stats line
    text += '\uD83D\uDCCA ' + state.moveCount + ' moves \u2022 ' + time;
    if (perfect) text += ' \u2022 \uD83D\uDC8E Perfect';
    text += '\n';
    text += '\u2B50 ' + score.toLocaleString() + ' pts\n\n';

    text += 'weeklyarcade.com/games/chroma-sort';

    return text;
  }

  function copyShare(score) {
    var text = buildShareText(score);

    function onShared() {
      state.shareCount++;
      saveLocal({ shareCount: state.shareCount });
      if (state.shareCount >= 5) {
        try {
          if (currentUser && window.apiClient) {
            window.apiClient.unlockAchievement('cs-share-5', GAME_ID);
          }
        } catch (e) { /* ignore */ }
      }
    }

    // Prefer native share sheet (mobile), fallback to clipboard
    if (navigator.share) {
      navigator.share({ text: text }).then(function () {
        onShared();
      }).catch(function () { /* user cancelled */ });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () {
        showToast('Result copied to clipboard!');
        onShared();
      });
    } else {
      showToast('Could not share');
    }
  }

  // ============================================
  // RENDER: WIN SCREEN
  // ============================================

  function renderWinScreen(score) {
    state.screen = 'win';
    var d = state.difficulty.charAt(0).toUpperCase() + state.difficulty.slice(1);
    var time = formatTime(state.elapsed);
    var perfectSolve = state.hintsUsed === 0 && state.undoCount === 0 && !state.extraTubeUsed;

    var html = '<div class="cs-win-overlay" id="cs-win-overlay">';
    html += '<div class="cs-win-card">';
    html += '<div class="cs-win-title">' + (perfectSolve ? '\u2728 Perfect Sort!' : '\uD83C\uDF89 Puzzle Solved!') + '</div>';

    // Score with count-up animation
    html += '<div class="cs-win-score" id="cs-win-score-num">0</div>';
    html += '<div class="cs-win-score-label">points</div>';

    // Stats
    html += '<div class="cs-win-stats">';
    html += '<div class="cs-win-stat"><div class="cs-win-stat-value">' + state.moveCount + '</div><div class="cs-win-stat-label">Moves</div></div>';
    html += '<div class="cs-win-stat"><div class="cs-win-stat-value">' + time + '</div><div class="cs-win-stat-label">Time</div></div>';
    html += '<div class="cs-win-stat"><div class="cs-win-stat-value">' + state.undoCount + '</div><div class="cs-win-stat-label">Undos</div></div>';
    html += '</div>';

    // Share preview
    html += '<div class="cs-win-share-preview">' + escapeHtml(buildShareText(score)) + '</div>';

    // Buttons
    html += '<div class="cs-win-buttons">';
    html += '<button class="cs-btn cs-btn-accent" data-action="share">\uD83D\uDCE4 Share</button>';
    html += '<button class="cs-btn cs-btn-secondary" data-action="home">Home</button>';
    html += '</div>';

    html += '</div>';
    html += '</div>';

    app.innerHTML += html;

    // Animate score count-up
    animateScore(0, score, 1200);

    // Bind win screen buttons
    var overlay = document.getElementById('cs-win-overlay');
    overlay.querySelector('[data-action="share"]').addEventListener('click', function () {
      copyShare(score);
    });
    overlay.querySelector('[data-action="home"]').addEventListener('click', function () {
      renderHome();
    });
  }

  function renderEndlessWinScreen(stars) {
    state.screen = 'win';
    var starStr = '';
    for (var i = 0; i < 3; i++) {
      starStr += i < stars ? '\u2B50' : '\u2606';
    }

    var html = '<div class="cs-win-overlay" id="cs-win-overlay">';
    html += '<div class="cs-win-card">';
    html += '<div class="cs-win-title">\uD83C\uDF89 Level ' + (state.endlessLevel - 1) + ' Complete!</div>';
    html += '<div class="cs-win-stars">' + starStr + '</div>';

    html += '<div class="cs-win-stats">';
    html += '<div class="cs-win-stat"><div class="cs-win-stat-value">' + state.moveCount + '</div><div class="cs-win-stat-label">Moves</div></div>';
    html += '<div class="cs-win-stat"><div class="cs-win-stat-value">' + state.totalStars + '</div><div class="cs-win-stat-label">Total Stars</div></div>';
    html += '</div>';

    html += '<div class="cs-win-buttons">';
    html += '<button class="cs-btn cs-btn-primary" data-action="next">Next Level \u203A</button>';
    html += '<button class="cs-btn cs-btn-secondary" data-action="home">Home</button>';
    html += '</div>';

    html += '</div>';
    html += '</div>';

    app.innerHTML += html;

    var overlay = document.getElementById('cs-win-overlay');
    overlay.querySelector('[data-action="next"]').addEventListener('click', function () {
      startEndless(state.endlessLevel);
    });
    overlay.querySelector('[data-action="home"]').addEventListener('click', function () {
      renderHome();
    });
  }

  function animateScore(from, to, duration) {
    var el = document.getElementById('cs-win-score-num');
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = to.toLocaleString();
      return;
    }
    var start = performance.now();

    function step(now) {
      var progress = Math.min(1, (now - start) / duration);
      var eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      var current = Math.round(from + (to - from) * eased);
      el.textContent = current.toLocaleString();
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ============================================
  // TUTORIAL
  // ============================================

  function showTutorialStep(step) {
    hideTutorialOverlay();
    state.tutorialStep = step;

    var messages = [
      'Tap a tube to pick up the top ball.',
      'Now tap another tube to place it. Same color or empty!',
    ];

    if (step >= messages.length) return;

    var overlay = document.createElement('div');
    overlay.className = 'cs-tutorial-overlay';
    overlay.id = 'cs-tutorial-overlay';

    var bubble = document.createElement('div');
    bubble.className = 'cs-tutorial-bubble';
    bubble.textContent = messages[step];

    // Position bubble above tube grid
    bubble.style.top = '120px';
    bubble.style.left = '50%';
    bubble.style.transform = 'translateX(-50%)';

    overlay.appendChild(bubble);
    document.body.appendChild(overlay);
  }

  function hideTutorialOverlay() {
    var el = document.getElementById('cs-tutorial-overlay');
    if (el) el.remove();
  }

  // ============================================
  // CONFETTI
  // ============================================

  function spawnConfetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var container = document.createElement('div');
    container.className = 'cs-confetti-container';
    document.body.appendChild(container);

    var colors = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#F97316', '#EC4899'];

    for (var i = 0; i < 40; i++) {
      var piece = document.createElement('div');
      piece.className = 'cs-confetti';
      piece.style.left = Math.random() * 100 + '%';
      piece.style.top = '-10px';
      piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = Math.random() * 0.6 + 's';
      piece.style.animationDuration = (1 + Math.random() * 1) + 's';
      piece.style.width = (6 + Math.random() * 6) + 'px';
      piece.style.height = (6 + Math.random() * 6) + 'px';
      container.appendChild(piece);
    }

    setTimeout(function () { container.remove(); }, 2500);
  }

  // ============================================
  // TOAST
  // ============================================

  function showToast(msg) {
    var existing = document.querySelector('.cs-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'cs-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(function () {
      toast.classList.add('out');
      setTimeout(function () { toast.remove(); }, 250);
    }, 2000);
  }

  // ============================================
  // UTILS
  // ============================================

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ============================================
  // AUTH INTEGRATION
  // ============================================

  function initAuth() {
    var checkInterval = setInterval(function () {
      if (window.authManager && window.authManager.isInitialized) {
        clearInterval(checkInterval);
        window.authManager.onAuthStateChanged(function (user) {
          currentUser = user;
          if (user) {
            loadCloudState();
            // Sync guest scores
            // Cloud state loaded on sign-in
          }
        });
      }
    }, 100);

    // Safety timeout: stop checking after 10s
    setTimeout(function () { clearInterval(checkInterval); }, 10000);
  }

  // ============================================
  // GAME HEADER INTEGRATION
  // ============================================

  function initHeader() {
    var checkInterval = setInterval(function () {
      if (window.gameHeader) {
        clearInterval(checkInterval);
        window.gameHeader.init({
          title: 'Chroma Sort',
          icon: '\uD83C\uDFA8',
          gameId: GAME_ID,
          buttons: ['sound', 'leaderboard', 'auth'],
          onSound: function () {
            audio.init();
            audio.enabled = !audio.enabled;
            saveLocal({ soundEnabled: audio.enabled });
            return audio.enabled;
          },
          onSignIn: function (user) {
            currentUser = user;
            loadCloudState();
            // Cloud state loaded on sign-in
          },
          onSignOut: function () {
            currentUser = null;
          },
        });
      }
    }, 100);
    setTimeout(function () { clearInterval(checkInterval); }, 10000);
  }

  // ============================================
  // INIT
  // ============================================

  function init() {
    initState();
    initAuth();
    initHeader();

    // Mobile UX: prevent context menu on long-press (tubes, balls)
    app.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // Mobile UX: prevent pull-to-refresh during gameplay
    app.addEventListener('touchmove', function (e) {
      if (state.screen === 'puzzle') e.preventDefault();
    }, { passive: false });

    // Always start at home screen per PRD flow
    // Tutorial triggers when user taps Endless Mode for the first time
    renderHome();
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
