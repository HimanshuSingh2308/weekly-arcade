/* ── Neon Beats — Full Rhythm Game ─────────────────────────── */
(() => {
  'use strict';

  // ── CONSTANTS ─────────────────────────────────────────────
  const GAME_ID = 'neon-beats';
  const LANES = 4;
  const LANE_KEYS = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
  const LANE_COLORS = ['#00ffff', '#ff00ff', '#ffff00', '#00ff88'];
  const LANE_GLOW   = ['#00ffff88', '#ff00ff88', '#ffff0088', '#00ff8888'];

  const TIMING = { perfect: 50, great: 100, good: 150 }; // ms half-windows
  const SCORE_BASE = { perfect: 100, great: 75, good: 50 };
  const COMBO_MULT = [
    { at: 0,  mult: 1 },
    { at: 10, mult: 2 },
    { at: 25, mult: 4 },
    { at: 50, mult: 8 },
  ];

  const HEALTH_MAX = 100;
  const HEALTH_START = 70;
  const HEALTH_PERFECT = 2;
  const HEALTH_MISS = -7;

  const BPM_START = 90;
  const BPM_MAX   = 160;
  const BPM_STEP  = 5;
  const BPM_INTERVAL_MS = 30000;

  const NOTE_SPEED_BASE = 200; // px/sec at 90 BPM — scales with BPM
  const HIT_ZONE_RATIO = 0.88; // fraction of canvas height
  const HIT_ZONE_HEIGHT = 40;
  const NOTE_HEIGHT = 28;
  const NOTE_RADIUS = 8;

  const NOTE_APPROACH_BEATS = 2; // notes appear 2 beats before hit zone

  // ── STATE ─────────────────────────────────────────────────
  let canvas, ctx, wrap;
  let canvasW = 0, canvasH = 0;
  let laneW = 0;
  let hitZoneY = 0;

  let state = 'menu'; // menu | countdown | playing | paused | gameover
  let score = 0;
  let bestScore = 0;
  let combo = 0;
  let maxCombo = 0;
  let health = HEALTH_START;
  let accuracy = 0;
  let totalNotes = 0;
  let hitNotes = 0;
  let perfectCount = 0;
  let greatCount = 0;
  let goodCount = 0;
  let missCount = 0;
  let gameStartTime = 0;
  let lastBpmRampTime = 0;
  let currentBpm = BPM_START;
  let maxBpmReached = BPM_START;
  let notes = []; // { lane, y, hitTime, hit, missed }
  let particles = []; // { x, y, vx, vy, alpha, color, size }
  let lastNoteTime = 0; // AudioContext time of last scheduled note
  let scheduledBeats = []; // { lane, hitTime (AudioContext seconds) }
  let animId = null;
  let lastFrameTime = 0;
  let countdownValue = 3;
  let countdownTimer = null;
  let mercyUntil = 0; // AudioContext time until which misses don't drain HP
  let pausedAtAudioTime = 0; // AudioContext time when paused
  let pausedAtPerfTime = 0; // performance.now() when paused

  // Settings
  let volumeMaster = 0.7;
  let volumeHit    = 0.5;
  let latencyOffsetMs = 0;

  // Auth
  let currentUser = null;
  const unlockedAchievements = new Set();

  // Reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── WEB AUDIO ─────────────────────────────────────────────
  let audioCtx = null;
  let audioUnlocked = false;

  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    audioUnlocked = true;
  }

  function playTone(freq, duration, type = 'sine', gainVal = 0.15, delay = 0) {
    if (!audioCtx || !audioUnlocked) return;
    try {
      const g = audioCtx.createGain();
      const osc = audioCtx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
      g.gain.setValueAtTime(gainVal * volumeMaster, audioCtx.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + duration);
      osc.connect(g);
      g.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + delay);
      osc.stop(audioCtx.currentTime + delay + duration + 0.01);
    } catch(e) {}
  }

  function playHit(quality) {
    if (!audioUnlocked) return;
    const freqs = { perfect: 880, great: 660, good: 440, miss: 110 };
    const durs  = { perfect: 0.12, great: 0.1, good: 0.09, miss: 0.08 };
    const gain  = volumeHit * volumeMaster;
    playTone(freqs[quality] || 440, durs[quality] || 0.1, 'sine', gain);
  }

  function playBeat(lane, audioTime) {
    // Synthwave kick/hat pattern per lane
    const laneFreqs = [55, 110, 220, 330]; // bass-leaning
    if (!audioCtx) return;
    try {
      const g = audioCtx.createGain();
      const osc = audioCtx.createOscillator();
      osc.type = lane % 2 === 0 ? 'sawtooth' : 'square';
      const f = laneFreqs[lane] || 110;
      osc.frequency.setValueAtTime(f * 2, audioTime);
      osc.frequency.exponentialRampToValueAtTime(f, audioTime + 0.05);
      g.gain.setValueAtTime(0.12 * volumeMaster, audioTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioTime + 0.15);
      osc.connect(g);
      g.connect(audioCtx.destination);
      osc.start(audioTime);
      osc.stop(audioTime + 0.2);
    } catch(e) {}
  }

  // ── BEAT SCHEDULING ───────────────────────────────────────
  const LOOKAHEAD_SEC = 0.3;
  const SCHEDULE_INTERVAL = 100; // ms

  let scheduleTimer = null;
  let nextBeatTime = 0;
  let beatCount = 0;

  function beatInterval() {
    return 60 / currentBpm;
  }

  function startScheduler() {
    if (!audioCtx) return;
    nextBeatTime = audioCtx.currentTime + 0.1;
    beatCount = 0;
    scheduleTimer = setInterval(scheduleTick, SCHEDULE_INTERVAL);
  }

  function stopScheduler() {
    if (scheduleTimer) { clearInterval(scheduleTimer); scheduleTimer = null; }
    scheduledBeats = [];
  }

  function scheduleTick() {
    if (!audioCtx || state !== 'playing') return;
    const lookAhead = audioCtx.currentTime + LOOKAHEAD_SEC;
    while (nextBeatTime < lookAhead) {
      scheduleOneBeat(nextBeatTime);
      nextBeatTime += beatInterval();
    }
  }

  function scheduleOneBeat(beatTime) {
    // Pick 1-2 random lanes per beat, no duplicates
    const elapsed = audioCtx ? (audioCtx.currentTime * 1000 - gameStartTime) / 1000 : 0;
    // Note density escalation: more multi-note beats as time progresses
    const multiProb = elapsed < 90 ? 0.15 : elapsed < 180 ? 0.3 : elapsed < 300 ? 0.45 : 0.55;
    const numNotes = Math.random() < multiProb ? 2 : 1;
    const lanePool = [0, 1, 2, 3];
    for (let i = 0; i < numNotes; i++) {
      const idx = Math.floor(Math.random() * lanePool.length);
      const lane = lanePool[idx];
      lanePool.splice(idx, 1); // prevent duplicate lane selection
      playBeat(lane, beatTime);
      scheduledBeats.push({ lane, hitTime: beatTime });
    }
    beatCount++;
  }

  // ── NOTE SPAWNING ─────────────────────────────────────────
  function spawnNotesFromSchedule() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const approachTime = NOTE_APPROACH_BEATS * beatInterval();
    const remaining = [];
    for (const beat of scheduledBeats) {
      const spawnAt = beat.hitTime - approachTime;
      if (now >= spawnAt) {
        spawnNote(beat.lane, beat.hitTime);
      } else {
        remaining.push(beat);
      }
    }
    scheduledBeats = remaining;
  }

  function spawnNote(lane, hitTime) {
    notes.push({
      lane,
      hitTime, // AudioContext seconds when note should be in hit zone
      hit: false,
      missed: false,
    });
  }

  function noteY(hitTime) {
    if (!audioCtx) return -100;
    const timeUntilHit = (hitTime - audioCtx.currentTime) - (latencyOffsetMs / 1000);
    const approachTime = NOTE_APPROACH_BEATS * beatInterval();
    // When timeUntilHit === approachTime, note is at top (y=0)
    // When timeUntilHit === 0, note is at hitZoneY
    const frac = 1 - timeUntilHit / approachTime;
    return frac * hitZoneY;
  }

  // ── COMBO LOGIC ───────────────────────────────────────────
  function getMultiplier() {
    let mult = 1;
    for (const tier of COMBO_MULT) {
      if (combo >= tier.at) mult = tier.mult;
    }
    return mult;
  }

  function addScore(quality) {
    const base = SCORE_BASE[quality] || 0;
    const mult = getMultiplier();
    const earned = base * mult;
    score += earned;
    return earned;
  }

  // ── HEALTH ────────────────────────────────────────────────
  function changeHealth(delta) {
    health = Math.max(0, Math.min(HEALTH_MAX, health + delta));
    updateHealthBar();
  }

  function updateHealthBar() {
    const bar = document.getElementById('nb-health-fill');
    if (!bar) return;
    const pct = (health / HEALTH_MAX) * 100;
    bar.style.width = pct + '%';
    bar.className = 'nb-health-bar' + (health < 30 ? ' danger' : '');
    const wrap = document.getElementById('nb-health-wrap');
    if (wrap) wrap.setAttribute('aria-valuenow', Math.round(health));
  }

  // ── INPUT HANDLING ────────────────────────────────────────
  function handleLaneTap(lane) {
    if (state !== 'playing') return;
    checkHit(lane);
  }

  function checkHit(lane) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime - (latencyOffsetMs / 1000);
    // Find closest unhit note in this lane
    let best = null;
    let bestDelta = Infinity;
    for (const note of notes) {
      if (note.lane !== lane || note.hit || note.missed) continue;
      const delta = Math.abs((note.hitTime - now) * 1000); // ms
      if (delta < bestDelta) {
        bestDelta = delta;
        best = note;
      }
    }

    if (!best || bestDelta > TIMING.good) {
      // Ghost tap — no penalty
      spawnFloater(lane, 'ghost', '');
      return;
    }

    best.hit = true;
    totalNotes++;
    hitNotes++;
    combo++;
    if (combo > maxCombo) maxCombo = combo;

    let quality;
    if (bestDelta <= TIMING.perfect) { quality = 'perfect'; perfectCount++; changeHealth(HEALTH_PERFECT); }
    else if (bestDelta <= TIMING.great) { quality = 'great'; greatCount++; }
    else { quality = 'good'; goodCount++; }

    const earned = addScore(quality);
    playHit(quality);
    spawnHitParticles(lane);
    spawnFloater(lane, quality, '+' + earned + (getMultiplier() > 1 ? ' x' + getMultiplier() : ''));
    updateHUD();
    checkAchievements();
  }

  // ── MISS DETECTION ────────────────────────────────────────
  function processMisses() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime - (latencyOffsetMs / 1000);
    const inMercy = audioCtx.currentTime < mercyUntil;
    for (const note of notes) {
      if (note.hit || note.missed) continue;
      const overdue = (now - note.hitTime) * 1000; // ms past hit time
      if (overdue > TIMING.good) {
        note.missed = true;
        totalNotes++;
        missCount++;
        combo = 0;
        // Mercy invincibility: misses within 800ms of last miss don't drain HP
        if (!inMercy) {
          changeHealth(HEALTH_MISS);
          mercyUntil = audioCtx.currentTime + 0.8; // 800ms mercy window
        }
        spawnFloater(note.lane, 'miss', 'MISS');
        playHit('miss');
        updateHUD();

        if (health <= 0) {
          endGame();
          return;
        }
      }
    }
  }

  // ── PARTICLES ─────────────────────────────────────────────
  function spawnHitParticles(lane) {
    if (prefersReducedMotion) return;
    const x = laneX(lane) + laneW / 2;
    const y = hitZoneY;
    const color = LANE_COLORS[lane];
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      particles.push({
        x, y,
        vx: Math.cos(angle) * (2 + Math.random() * 3),
        vy: Math.sin(angle) * (2 + Math.random() * 3) - 2,
        alpha: 1,
        color,
        size: 3 + Math.random() * 3,
      });
    }
  }

  function laneX(lane) {
    return lane * laneW;
  }

  // ── FLOATERS ──────────────────────────────────────────────
  function spawnFloater(lane, quality, text) {
    if (!text) return;
    const el = document.createElement('div');
    el.className = 'nb-floater ' + quality;
    el.textContent = text;
    const x = laneX(lane) + laneW / 2;
    const rect = canvas.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const scaleX = rect.width / canvasW;
    const scaleY = rect.height / canvasH;
    el.style.left = (rect.left - wrapRect.left + x * scaleX - 30) + 'px';
    el.style.top  = (rect.top - wrapRect.top + hitZoneY * scaleY - 60) + 'px';
    el.style.width = '60px';
    el.style.textAlign = 'center';
    wrap.appendChild(el);
    if (prefersReducedMotion) {
      setTimeout(() => el.remove(), 700);
    } else {
      el.addEventListener('animationend', () => el.remove());
    }
  }

  // ── HUD ───────────────────────────────────────────────────
  function updateHUD() {
    const el = id => document.getElementById(id);
    const sc = el('nb-score-val');
    const co = el('nb-combo-val');
    if (sc) sc.textContent = score.toLocaleString();
    if (co) {
      const m = getMultiplier();
      co.textContent = combo > 0 ? combo + ' combo' + (m > 1 ? ' x' + m : '') : '';
    }
    updateHealthBar();
  }

  // ── BPM RAMP ──────────────────────────────────────────────
  function maybeBumpBpm() {
    if (state !== 'playing' || !audioCtx) return;
    const now = audioCtx.currentTime * 1000;
    if (now - lastBpmRampTime >= BPM_INTERVAL_MS) {
      lastBpmRampTime = now;
      if (currentBpm < BPM_MAX) {
        currentBpm = Math.min(BPM_MAX, currentBpm + BPM_STEP);
        if (currentBpm > maxBpmReached) maxBpmReached = currentBpm;
        showBpmBanner(currentBpm);
      }
    }
  }

  let bpmBannerTimeout = null;
  function showBpmBanner(bpm) {
    let el = document.getElementById('nb-bpm-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'nb-bpm-banner';
      el.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#ff00ff22;border:1px solid #ff00ff66;border-radius:10px;padding:8px 20px;color:#ff00ff;font-weight:700;font-size:18px;pointer-events:none;z-index:60;transition:opacity 0.4s;';
      wrap.appendChild(el);
    }
    el.textContent = bpm + ' BPM';
    el.style.opacity = '1';
    clearTimeout(bpmBannerTimeout);
    bpmBannerTimeout = setTimeout(() => { el.style.opacity = '0'; }, 1500);
  }

  // ── DRAWING ───────────────────────────────────────────────
  function draw(dt) {
    ctx.clearRect(0, 0, canvasW, canvasH);

    // Background
    ctx.fillStyle = '#0a0010';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Lane dividers
    for (let i = 1; i < LANES; i++) {
      ctx.strokeStyle = '#ffffff0d';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(i * laneW, 0);
      ctx.lineTo(i * laneW, canvasH);
      ctx.stroke();
    }

    // Lane glow columns (subtle)
    for (let l = 0; l < LANES; l++) {
      const grd = ctx.createLinearGradient(laneX(l), 0, laneX(l) + laneW, 0);
      grd.addColorStop(0, 'transparent');
      grd.addColorStop(0.5, LANE_GLOW[l].replace('88', '11'));
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.fillRect(laneX(l), 0, laneW, canvasH);
    }

    // Hit zone line
    for (let l = 0; l < LANES; l++) {
      ctx.strokeStyle = LANE_COLORS[l] + '88';
      ctx.lineWidth = 2;
      ctx.shadowColor = LANE_COLORS[l];
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(laneX(l) + 4, hitZoneY);
      ctx.lineTo(laneX(l) + laneW - 4, hitZoneY);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Notes
    for (const note of notes) {
      if (note.hit) continue;
      const y = noteY(note.hitTime);
      if (y < -NOTE_HEIGHT || y > canvasH + NOTE_HEIGHT) continue;
      drawNote(note.lane, y, note.missed);
    }

    // Particles
    if (!prefersReducedMotion) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.alpha -= 0.04;
        if (p.alpha <= 0) { particles.splice(i, 1); continue; }
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
    }

    // Lane key labels (playing state)
    if (state === 'playing') {
      const keyLabels = ['D', 'F', 'J', 'K'];
      for (let l = 0; l < LANES; l++) {
        ctx.font = 'bold ' + Math.round(laneW * 0.3) + 'px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = LANE_COLORS[l] + '55';
        ctx.fillText(keyLabels[l], laneX(l) + laneW / 2, hitZoneY + HIT_ZONE_HEIGHT + 18);
      }
    }
  }

  function drawNote(lane, y, missed) {
    const x = laneX(lane) + 6;
    const w = laneW - 12;
    const h = NOTE_HEIGHT;
    const r = NOTE_RADIUS;
    const color = LANE_COLORS[lane];

    ctx.save();
    ctx.globalAlpha = missed ? 0.25 : 1;

    // Glow
    if (!missed && !prefersReducedMotion) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
    }

    // Rounded rect
    ctx.fillStyle = color + (missed ? '44' : 'cc');
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();

    // Inner highlight
    const grd = ctx.createLinearGradient(x, y, x, y + h);
    grd.addColorStop(0, '#ffffff44');
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ── GAME LOOP ─────────────────────────────────────────────
  function loop(ts) {
    if (state !== 'playing') return;
    const dt = Math.min((ts - lastFrameTime) / 1000, 0.05);
    lastFrameTime = ts;

    spawnNotesFromSchedule();
    processMisses();
    maybeBumpBpm();
    draw(dt);

    animId = requestAnimationFrame(loop);
  }

  function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused';
    pausedAtAudioTime = audioCtx ? audioCtx.currentTime : 0;
    pausedAtPerfTime = performance.now();
    stopScheduler();
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    if (audioCtx) audioCtx.suspend();
    showPauseOverlay(true);
  }

  function resumeGame() {
    if (state !== 'paused') return;
    state = 'playing';
    if (audioCtx) audioCtx.resume();
    // Adjust timing references for pause duration
    const pauseDurationMs = performance.now() - pausedAtPerfTime;
    gameStartTime += pauseDurationMs;
    lastBpmRampTime += pauseDurationMs;
    startScheduler();
    lastFrameTime = performance.now();
    animId = requestAnimationFrame(loop);
    showPauseOverlay(false);
  }

  function showPauseOverlay(show) {
    let overlay = document.getElementById('nb-pause-overlay');
    if (!overlay && show) {
      overlay = document.createElement('div');
      overlay.id = 'nb-pause-overlay';
      overlay.style.cssText = 'position:absolute;inset:0;background:rgba(10,0,16,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:100;';
      overlay.innerHTML = '<div style="color:#ff00ff;font-size:32px;font-weight:700;margin-bottom:16px">PAUSED</div><button class="nb-btn nb-btn-primary" id="nb-btn-resume">&#9654; Resume</button>';
      wrap.appendChild(overlay);
      document.getElementById('nb-btn-resume').addEventListener('click', resumeGame);
    }
    if (overlay) {
      overlay.style.display = show ? 'flex' : 'none';
      if (show) document.getElementById('nb-btn-resume')?.focus();
    }
  }

  // ── GAME FLOW ─────────────────────────────────────────────
  function showScreen(name) {
    document.querySelectorAll('.nb-screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('nb-screen-' + name);
    if (el) el.classList.add('active');
  }

  function startCountdown() {
    state = 'countdown';
    showScreen('countdown');
    countdownValue = 3;
    document.getElementById('nb-countdown-num').textContent = '3';
    ensureAudio();

    countdownTimer = setInterval(() => {
      countdownValue--;
      if (countdownValue <= 0) {
        clearInterval(countdownTimer);
        startPlaying();
      } else {
        document.getElementById('nb-countdown-num').textContent = countdownValue;
        playTone(440, 0.1, 'sine', 0.2);
      }
    }, 900);
    playTone(440, 0.1, 'sine', 0.2);
  }

  function startPlaying() {
    state = 'playing';
    score = 0; combo = 0; maxCombo = 0; health = HEALTH_START;
    totalNotes = 0; hitNotes = 0; perfectCount = 0; greatCount = 0;
    goodCount = 0; missCount = 0; accuracy = 0;
    currentBpm = BPM_START; maxBpmReached = BPM_START;
    notes = []; particles = []; scheduledBeats = [];
    mercyUntil = 0;
    gameStartTime = audioCtx ? audioCtx.currentTime * 1000 : performance.now();
    lastBpmRampTime = gameStartTime;

    showScreen('playing-overlay');
    document.getElementById('nb-hud').className = 'nb-hud visible';
    updateHUD();

    startScheduler();
    lastFrameTime = performance.now();
    animId = requestAnimationFrame(loop);
  }

  function endGame() {
    if (state === 'gameover') return;
    state = 'gameover';
    stopScheduler();
    if (animId) { cancelAnimationFrame(animId); animId = null; }

    accuracy = totalNotes > 0 ? Math.round((hitNotes / totalNotes) * 100) : 0;
    checkAchievements(true);

    if (score > bestScore) bestScore = score;
    try { localStorage.setItem('neon-beats-best', bestScore); } catch(e) {}

    // Draw final frame
    draw(0);

    // Populate game-over screen
    document.getElementById('nb-final-score').textContent = score.toLocaleString();
    document.getElementById('nb-final-best').textContent = bestScore.toLocaleString();
    document.getElementById('nb-final-accuracy').textContent = accuracy + '%';
    document.getElementById('nb-final-combo').textContent = maxCombo;
    document.getElementById('nb-hud').className = 'nb-hud';
    showScreen('gameover');

    submitScore();
  }

  function submitScore() {
    if (!window.apiClient) return;
    const timeMs = Math.round(audioCtx ? audioCtx.currentTime * 1000 - gameStartTime : 0);
    window.apiClient.submitScore(GAME_ID, {
      score,
      timeMs,
      metadata: {
        accuracy,
        maxCombo,
        totalNotes,
        perfectCount,
        greatCount,
        goodCount,
        missCount,
        maxBpm: maxBpmReached,
        finalMultiplier: getMultiplier(),
      },
    }).catch(() => {});
  }

  // ── ACHIEVEMENTS ──────────────────────────────────────────
  // Achievements checked during play (combo/score based)
  const ACHIEVEMENT_DEFS_LIVE = {
    nb_first_drop:    { check: () => perfectCount >= 1 },
    nb_in_the_zone:   { check: () => maxCombo >= 25 },
    nb_neon_streak:   { check: () => maxCombo >= 50 },
    nb_survivor:      { check: () => audioCtx && (audioCtx.currentTime * 1000 - gameStartTime) >= 180000 },
    nb_neon_god:      { check: () => score >= 50000 },
  };
  // Achievements checked at game over (need final stats)
  const ACHIEVEMENT_DEFS_END = {
    nb_accuracy_freak:{ check: () => accuracy >= 90 && totalNotes >= 50 },
  };

  function checkAchievements(endOfGame = false) {
    if (!window.apiClient) return;
    const defs = endOfGame
      ? { ...ACHIEVEMENT_DEFS_LIVE, ...ACHIEVEMENT_DEFS_END }
      : ACHIEVEMENT_DEFS_LIVE;
    const elapsed = audioCtx ? (audioCtx.currentTime * 1000 - gameStartTime) / 1000 : 0;
    for (const [id, def] of Object.entries(defs)) {
      if (unlockedAchievements.has(id)) continue;
      if (def.check()) {
        unlockedAchievements.add(id);
        window.apiClient.unlockAchievement(id, GAME_ID, {
          score, combo: maxCombo, timeSeconds: Math.round(elapsed),
        }).catch(() => {});
        showAchievementToast(id);
      }
    }
  }

  const ACHIEVEMENT_LABELS = {
    nb_first_drop:    { name: 'First Drop',       icon: '🎯' },
    nb_in_the_zone:   { name: 'In The Zone',      icon: '🔥' },
    nb_neon_streak:   { name: 'Neon Streak',       icon: '💜' },
    nb_accuracy_freak:{ name: 'Accuracy Freak',    icon: '🎯' },
    nb_survivor:      { name: 'Survivor',           icon: '⏱️' },
    nb_neon_god:      { name: 'Neon God',           icon: '👑' },
  };

  function showAchievementToast(id) {
    const def = ACHIEVEMENT_LABELS[id];
    if (!def) return;
    const toast = document.getElementById('nb-achievement-toast');
    if (!toast) return;
    toast.querySelector('.ach-icon').textContent = def.icon;
    toast.querySelector('.ach-title').textContent = def.name;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // ── RESIZE ────────────────────────────────────────────────
  function resize() {
    const maxW = Math.min(window.innerWidth, 480);
    const headerEl = document.querySelector('header');
    const headerH = headerEl ? headerEl.getBoundingClientRect().height : 0;
    const maxH = window.innerHeight - headerH;
    const aspect = 9 / 16; // portrait
    let w = maxW;
    let h = Math.round(w / aspect);
    if (h > maxH * 0.9) {
      h = Math.round(maxH * 0.9);
      w = Math.round(h * aspect);
    }
    canvasW = w;
    canvasH = h;
    canvas.width = canvasW;
    canvas.height = canvasH;
    laneW = Math.floor(canvasW / LANES);
    hitZoneY = Math.round(canvasH * HIT_ZONE_RATIO);
  }

  // ── SETTINGS PANEL ────────────────────────────────────────
  function initSettings() {
    const btn = document.getElementById('nb-settings-toggle');
    const panel = document.getElementById('nb-settings-panel');
    if (!btn || !panel) return;

    btn.addEventListener('click', e => {
      e.stopPropagation();
      const opening = !panel.classList.contains('open');
      panel.classList.toggle('open');
      if (opening && state === 'playing') pauseGame();
    });
    document.addEventListener('click', e => {
      if (!panel.contains(e.target) && e.target !== btn) panel.classList.remove('open');
    });

    const volM = document.getElementById('nb-vol-master');
    const volH = document.getElementById('nb-vol-hit');
    const latEl = document.getElementById('nb-latency');

    if (volM) {
      volM.value = volumeMaster;
      volM.addEventListener('input', () => { volumeMaster = parseFloat(volM.value); });
    }
    if (volH) {
      volH.value = volumeHit;
      volH.addEventListener('input', () => { volumeHit = parseFloat(volH.value); });
    }
    if (latEl) {
      latEl.value = latencyOffsetMs;
      latEl.addEventListener('input', () => { latencyOffsetMs = parseInt(latEl.value, 10) || 0; });
    }

    // Load saved prefs
    try {
      const saved = JSON.parse(localStorage.getItem('neon-beats-settings') || '{}');
      if (saved.volumeMaster !== undefined) { volumeMaster = saved.volumeMaster; if (volM) volM.value = volumeMaster; }
      if (saved.volumeHit !== undefined)    { volumeHit = saved.volumeHit;       if (volH) volH.value = volumeHit; }
      if (saved.latencyOffsetMs !== undefined) { latencyOffsetMs = saved.latencyOffsetMs; if (latEl) latEl.value = latencyOffsetMs; }
    } catch(e) {}

    // Save on change
    [volM, volH, latEl].forEach(el => {
      if (!el) return;
      el.addEventListener('change', () => {
        try { localStorage.setItem('neon-beats-settings', JSON.stringify({ volumeMaster, volumeHit, latencyOffsetMs })); } catch(e) {}
      });
    });
  }

  // ── BUILD DOM ─────────────────────────────────────────────
  function buildDOM() {
    const app = document.getElementById('neon-beats-app');
    if (!app) return false;

    app.setAttribute('role', 'main');
    app.innerHTML = `
<div id="nb-canvas-wrap">
  <canvas id="nb-canvas" role="img" aria-label="Neon Beats rhythm game"></canvas>

  <!-- HUD -->
  <div id="nb-hud" class="nb-hud" aria-live="polite" aria-atomic="true">
    <div>
      <div class="nb-hud-score" id="nb-score-val">0</div>
      <div class="nb-hud-label">Score</div>
    </div>
    <div class="nb-hud-combo" id="nb-combo-val"></div>
    <div class="nb-hud-health">
      <div class="nb-hud-label" style="text-align:right">Health</div>
      <div class="nb-health-bar-wrap" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${HEALTH_START}" aria-label="Health" id="nb-health-wrap"><div class="nb-health-bar" id="nb-health-fill" style="width:${(HEALTH_START/HEALTH_MAX)*100}%"></div></div>
    </div>
  </div>

  <!-- Settings -->
  <div id="nb-settings">
    <button class="nb-settings-btn" id="nb-settings-toggle" aria-label="Settings">&#9881;</button>
    <div id="nb-settings-panel">
      <label>Master Volume <input type="range" id="nb-vol-master" min="0" max="1" step="0.05"></label>
      <label>Hit Volume <input type="range" id="nb-vol-hit" min="0" max="1" step="0.05"></label>
      <label>Input Latency (ms) <input type="number" id="nb-latency" min="-200" max="200" step="5" value="0"></label>
    </div>
  </div>

  <!-- Screen: Menu -->
  <div id="nb-screen-menu" class="nb-screen active">
    <div class="nb-logo">Neon Beats</div>
    <div class="nb-sub">Tap to the beat. Chase the perfect.</div>
    <div class="nb-scores-row">
      <div class="nb-score-pill"><span class="val" id="nb-menu-best">0</span><span class="lbl">Best Score</span></div>
    </div>
    <button class="nb-btn nb-btn-primary" id="nb-btn-play">&#9654; Play</button>
    <div style="font-size:13px;color:#ffffff88;margin-top:8px">D &nbsp; F &nbsp; J &nbsp; K &nbsp; or tap lanes</div>
  </div>

  <!-- Screen: Countdown -->
  <div id="nb-screen-countdown" class="nb-screen">
    <div class="nb-countdown-num" id="nb-countdown-num">3</div>
  </div>

  <!-- Screen: Playing (transparent overlay for tap zones) -->
  <div id="nb-screen-playing-overlay" class="nb-screen" style="background:transparent;pointer-events:none;">
    <!-- Lane tap areas rendered over canvas -->
  </div>

  <!-- Screen: Game Over -->
  <div id="nb-screen-gameover" class="nb-screen" role="alert">
    <div class="nb-logo" style="font-size:clamp(24px,6vw,36px)">Game Over</div>
    <div class="nb-accuracy-badge" id="nb-final-accuracy">0%</div>
    <div class="nb-scores-row">
      <div class="nb-score-pill"><span class="val" id="nb-final-score">0</span><span class="lbl">Score</span></div>
      <div class="nb-score-pill"><span class="val" id="nb-final-best">0</span><span class="lbl">Best</span></div>
    </div>
    <div class="nb-scores-row" style="margin-top:-4px">
      <div class="nb-score-pill" style="min-width:80px"><span class="val" id="nb-final-combo" style="font-size:20px">0</span><span class="lbl">Max Combo</span></div>
    </div>
    <button class="nb-btn nb-btn-primary" id="nb-btn-retry">&#9654; Play Again</button>
    <button class="nb-btn nb-btn-secondary" id="nb-btn-menu">Menu</button>
  </div>
</div>

<!-- Achievement Toast -->
<div id="nb-achievement-toast">
  <span class="ach-icon">🏆</span>
  <div>
    <div class="ach-title">Achievement</div>
    <div style="font-size:12px;color:#ffffffaa">Unlocked!</div>
  </div>
</div>
`;
    return true;
  }

  // ── TOUCH LANE DETECTION ──────────────────────────────────
  function touchToLane(touchX) {
    const rect = canvas.getBoundingClientRect();
    const relX = touchX - rect.left;
    const scaleX = canvasW / rect.width;
    const canvasX = relX * scaleX;
    return Math.max(0, Math.min(LANES - 1, Math.floor(canvasX / laneW)));
  }

  // ── INIT ──────────────────────────────────────────────────
  function init() {
    if (!buildDOM()) return;

    canvas = document.getElementById('nb-canvas');
    ctx = canvas.getContext('2d');
    wrap = document.getElementById('nb-canvas-wrap');

    resize();
    window.addEventListener('resize', resize);

    // Load best score
    try { bestScore = parseInt(localStorage.getItem('neon-beats-best') || '0', 10); } catch(e) {}
    const menuBest = document.getElementById('nb-menu-best');
    if (menuBest) menuBest.textContent = bestScore.toLocaleString();

    // Auth
    if (window.authManager) {
      window.authManager.onAuthStateChanged(user => { currentUser = user; });
    }

    // Buttons
    document.getElementById('nb-btn-play')?.addEventListener('click', () => {
      ensureAudio();
      startCountdown();
    });
    document.getElementById('nb-btn-retry')?.addEventListener('click', () => {
      ensureAudio();
      startCountdown();
    });
    document.getElementById('nb-btn-menu')?.addEventListener('click', () => {
      state = 'menu';
      stopScheduler();
      if (animId) { cancelAnimationFrame(animId); animId = null; }
      document.getElementById('nb-hud').className = 'nb-hud';
      const menuBest = document.getElementById('nb-menu-best');
      if (menuBest) menuBest.textContent = bestScore.toLocaleString();
      showScreen('menu');
      draw(0);
    });

    // Keyboard
    document.addEventListener('keydown', e => {
      if (e.repeat) return;
      const idx = LANE_KEYS.indexOf(e.code);
      if (idx !== -1) {
        ensureAudio();
        handleLaneTap(idx);
      }
      // Space to start
      if (e.code === 'Space' && state === 'menu') {
        e.preventDefault();
        ensureAudio();
        startCountdown();
      }
      // Pause/Resume
      if ((e.code === 'Escape' || e.code === 'KeyP') && (state === 'playing' || state === 'paused')) {
        e.preventDefault();
        if (state === 'playing') pauseGame();
        else resumeGame();
      }
    });

    // Touch
    canvas.addEventListener('pointerdown', e => {
      ensureAudio();
      if (state === 'playing') {
        const lane = touchToLane(e.clientX);
        handleLaneTap(lane);
      } else if (state === 'menu') {
        startCountdown();
      }
    }, { passive: false });

    // Safari AudioContext unlock
    document.addEventListener('pointerdown', ensureAudio, { once: true, passive: true });

    initSettings();

    // Draw initial frame
    draw(0);
  }

  // ── ENTRY POINT ───────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
