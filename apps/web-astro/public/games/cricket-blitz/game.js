(() => {
  'use strict';

  // ============================================
  // CONSTANTS
  // ============================================

  const TEAMS = {
    'mumbai-mavericks':    { name: 'Mumbai Mavericks',    city: 'Mumbai',    primary: '#004BA0', secondary: '#FFD700', accent: '#FFFFFF' },
    'chennai-cobras':      { name: 'Chennai Cobras',       city: 'Chennai',   primary: '#FFD700', secondary: '#1A1A6B', accent: '#FF6B00' },
    'bangalore-blazers':   { name: 'Bangalore Blazers',    city: 'Bangalore', primary: '#E8000D', secondary: '#000000', accent: '#FFD700' },
    'kolkata-knights':     { name: 'Kolkata Knights',      city: 'Kolkata',   primary: '#3B0051', secondary: '#FFD700', accent: '#FFFFFF' },
    'delhi-dynamos':       { name: 'Delhi Dynamos',        city: 'Delhi',     primary: '#0044AA', secondary: '#E8000D', accent: '#FFFFFF' },
    'hyderabad-hawks':     { name: 'Hyderabad Hawks',      city: 'Hyderabad', primary: '#FF6B00', secondary: '#000000', accent: '#FFFFFF' }
  };

  const TEAM_IDS = Object.keys(TEAMS);

  const TARGETS = [40, 55, 75, 100, 130];
  function getTarget(level) {
    if (level <= 5) return TARGETS[level - 1];
    return 130 + (level - 5) * 20;
  }

  const ACHIEVEMENTS = {
    'cb-first-four':       { name: 'Boundary Finder',     desc: 'Hit your first four',                       xp: 10 },
    'cb-first-six':        { name: 'Into the Stands',     desc: 'Hit your first six',                        xp: 25 },
    'cb-six-sixes':        { name: 'Six Machine',         desc: 'Hit 6 sixes in a single innings',           xp: 75 },
    'cb-fifty':            { name: 'Half Century',        desc: 'Score 50 runs in an innings',               xp: 50 },
    'cb-century':          { name: 'Centurion',           desc: 'Score 100 runs in an innings',              xp: 100 },
    'cb-no-wicket':        { name: 'Unbeatable',          desc: 'Complete innings without losing a wicket',  xp: 100 },
    'cb-perfect-over':     { name: 'Perfect Over',        desc: 'Score off every ball in an over',           xp: 50 },
    'cb-target-crushed':   { name: 'Target Crushed',      desc: 'Beat target with 10+ balls remaining',     xp: 75 },
    'cb-level-3':          { name: 'Rising Star',         desc: 'Reach level 3',                             xp: 50 },
    'cb-level-5':          { name: 'Cricket Legend',       desc: 'Reach level 5',                             xp: 100 },
    'cb-high-score-200':   { name: 'Double Century Club', desc: 'Achieve a final score of 200+',            xp: 150 },
    'cb-all-teams':        { name: 'Franchise Collector', desc: 'Play a game with each of the 6 teams',     xp: 50 }
  };

  const COMMENTARY = {
    dot: [
      "Dot ball. Good bowling, tight line.",
      "Nothing doing there. Pressure building.",
      "Beaten! The bowler is on top here.",
      "Left alone outside off. Smart batting."
    ],
    single: [
      "Pushed into the gap for a quick single.",
      "Turned to the leg side. Easy run.",
      "Dabbed to third man. Good running!"
    ],
    two: [
      "Driven through the gap! They come back for two.",
      "Worked to the deep. Two runs, good running."
    ],
    three: [
      "Placed into the gap! Excellent running, they get three!",
      "Deep in the outfield, the throw comes in... THREE!"
    ],
    four: [
      "FOUR! Crashing through the covers!",
      "That's a boundary! Sweetly timed!",
      "FOUR runs! What a shot, racing away!",
      "Pierced the field! FOUR to the boundary!"
    ],
    six: [
      "SIX! That's gone all the way into the stands!",
      "HUGE! That's out of the stadium!",
      "SIX! What a hit! The crowd erupts!",
      "MASSIVE! That ball has disappeared into the night sky!",
      "SIX! Effortless power from the batsman!"
    ],
    wicket: [
      "OUT! That's the end of the batsman!",
      "GONE! The bowler strikes!",
      "Wicket! A crucial breakthrough!",
      "OUT! That's a big moment in this innings!"
    ],
    overEnd: [
      "End of a good over. The pressure is on.",
      "That over flew by! Plenty of action.",
      "A decisive over! Things are heating up.",
      "The crowd applauds as the over comes to an end."
    ]
  };

  const BOWLER_FIRST = ['Ajay','Vikram','Rahul','Suresh','Deepak','Amit','Ravi','Karan','Arun','Pradeep','Naveen','Sanjay'];
  const BOWLER_LAST = ['Kumar','Singh','Patel','Sharma','Yadav','Reddy','Chauhan','Verma','Mishra','Joshi','Nair','Das'];

  // Outcome probability tables [0, 1, 2, 3, 4, 6, OUT]
  const PROB_PERFECT = {
    straight: [0, 0, 5, 5, 30, 55, 5],
    pull:     [0, 0, 5, 5, 25, 55, 10],
    cut:      [0, 0, 10, 10, 55, 15, 10],
    defense:  [0, 70, 25, 5, 0, 0, 0]
  };
  const PROB_GOOD = {
    straight: [10, 15, 20, 10, 25, 10, 10],
    pull:     [10, 15, 20, 10, 20, 10, 15],
    cut:      [10, 15, 25, 10, 25, 5, 10],
    defense:  [30, 55, 10, 3, 0, 0, 2]
  };
  const PROB_MISTIMED = {
    straight: [25, 20, 10, 0, 5, 0, 40],
    pull:     [20, 15, 10, 0, 5, 0, 50],
    cut:      [25, 20, 10, 0, 5, 0, 40],
    defense:  [60, 25, 5, 0, 0, 0, 10]
  };

  const DELIVERY_COUNTER = {
    bouncer: 'pull',
    yorker: 'defense',
    inswing: 'cut',
    outswing: 'pull',
    straight: null,
    slower: null
  };

  // ============================================
  // STATE
  // ============================================

  const state = {
    phase: 'TITLE',
    level: 1,
    target: 40,
    runs: 0,
    wickets: 0,
    ballsInOver: 0,
    oversCompleted: 0,
    totalBallsFaced: 0,
    fours: 0,
    sixes: 0,
    bestOverRuns: 0,
    currentOverRuns: 0,
    currentOverResults: [],
    consecutiveScoringBalls: 0,
    currentOverScoringBalls: 0,

    ballActive: false,
    ballProgress: 0,
    ballStartTime: 0,
    ballDeliveryType: 'straight',
    ballSpeed: 1200,
    ballSwingDir: 0,
    ballIsOnStumps: false,
    ballLateBreak: false,

    shotDirection: 'straight',
    swingTriggered: false,
    swingTime: 0,
    batAngle: -30,
    batAnimating: false,
    batAnimStart: 0,
    batAnimDuration: 200,
    batAnimType: 'straight',

    bowlerRunUp: 0,
    bowlerArmAngle: 0,
    bowlerAnimating: false,

    postBallActive: false,
    postBallType: null,
    postBallTime: 0,
    postBallX: 0,
    postBallY: 0,
    postBallVx: 0,
    postBallVy: 0,
    postBallSize: 0,

    // Stump scatter
    stumpScatter: null,

    particles: [],
    floatingTexts: [],

    selectedTeam: null,
    opponentTeam: null,

    gameStartTime: 0,
    lastFrameTime: 0,
    paused: false,

    soundEnabled: true,
    audioInitialized: false,

    timingPerfect: 50,
    timingGood: 120,

    nextBallDelay: 0,
    waitingForNext: false,
    autoOverTimer: 0,

    bowlerName: '',
    bowlerType: 'pacer',

    newBatsmanAnim: false,
    newBatsmanTime: 0,

    teamsPlayed: [],
    achievementsUnlocked: new Set(),

    // Powerplay: first 2 overs
    isPowerplay: true,

    // Crowd wave after six
    crowdWaveActive: false,
    crowdWaveStart: 0,

    // Tension (within 15 runs of target)
    tensionActive: false
  };

  // ============================================
  // DOM REFS
  // ============================================

  const $ = (id) => document.getElementById(id);
  const bgCanvas = $('bgCanvas');
  const fgCanvas = $('fgCanvas');
  const bgCtx = bgCanvas.getContext('2d');
  const fgCtx = fgCanvas.getContext('2d');
  const gameContainer = $('gameContainer');
  const gameWrap = $('gameWrap');

  // HUD
  const hudTop = $('hudTop');
  const hudBottom = $('hudBottom');
  const hudOvers = $('hudOvers');
  const hudTarget = $('hudTarget');
  const hudWickets = $('hudWickets');
  const hudRuns = $('hudRuns');
  const hudRR = $('hudRR');
  const hudFours = $('hudFours');
  const hudSixes = $('hudSixes');
  const shotIndicator = $('shotIndicator');
  const shotArrow = $('shotArrow');
  const shotLabel = $('shotLabel');

  // Overlays
  const titleOverlay = $('titleOverlay');
  const overOverlay = $('overOverlay');
  const overModal = $('overModal');
  const levelOverlay = $('levelOverlay');
  const levelModal = $('levelModal');
  const gameOverOverlay = $('gameOverOverlay');
  const gameOverModal = $('gameOverModal');
  const bowlerIntro = $('bowlerIntro');
  const achievementToast = $('achievementToast');
  const srAnnounce = $('srAnnounce');
  const touchZones = $('touchZones');

  // ============================================
  // CANVAS SIZING
  // ============================================

  let W = 0, H = 0, DPR = 1;
  let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let isTouchDevice = false;

  // Crowd dot data (drawn to bg canvas)
  let crowdDots = [];
  let bgDirty = true;

  function resizeCanvas() {
    DPR = window.devicePixelRatio || 1;
    const cw = gameContainer.clientWidth;
    const ch = gameContainer.clientHeight;
    W = cw;
    H = ch;

    bgCanvas.width = cw * DPR;
    bgCanvas.height = ch * DPR;
    bgCanvas.style.width = cw + 'px';
    bgCanvas.style.height = ch + 'px';
    bgCtx.setTransform(DPR, 0, 0, DPR, 0, 0);

    fgCanvas.width = cw * DPR;
    fgCanvas.height = ch * DPR;
    fgCanvas.style.width = cw + 'px';
    fgCanvas.style.height = ch + 'px';
    fgCtx.setTransform(DPR, 0, 0, DPR, 0, 0);

    initCrowdDots();
    bgDirty = true;
  }

  // ============================================
  // AUDIO
  // ============================================

  let audioCtx = null;
  let masterGain = null;

  function initAudio() {
    if (state.audioInitialized) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = state.soundEnabled ? 0.3 : 0;
      masterGain.connect(audioCtx.destination);
      state.audioInitialized = true;
    } catch (e) { /* audio unavailable */ }
  }

  function resumeAudio() {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function createNoise(duration, filterFreq, filterQ, volume, filterType) {
    if (!audioCtx) return;
    const sr = audioCtx.sampleRate;
    const len = sr * duration;
    const buf = audioCtx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = filterType || 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = filterQ || 1;
    const gain = audioCtx.createGain();
    gain.gain.value = volume;
    gain.gain.setTargetAtTime(0, audioCtx.currentTime + duration * 0.3, duration * 0.3);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    src.start();
    src.stop(audioCtx.currentTime + duration);
  }

  function playTone(freq, type, duration, volume, detune) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    if (detune) osc.detune.value = detune;
    const gain = audioCtx.createGain();
    gain.gain.value = volume || 0.05;
    gain.gain.setTargetAtTime(0, audioCtx.currentTime + duration * 0.6, duration * 0.3);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }

  function playBatCrack(power) {
    if (!audioCtx || !state.soundEnabled) return;
    // power: 0=dot, 1=single, 2=two/three, 3=four, 4=six
    const durations = [0.03, 0.04, 0.05, 0.06, 0.08];
    const freqs =     [2000, 1900, 1800, 1500, 1200];
    const volumes =   [0.06, 0.08, 0.1, 0.14, 0.18];
    const thumpFreqs = [0, 100, 100, 80, 60];
    const thumpDur =   [0, 0.02, 0.02, 0.03, 0.05];

    const d = durations[power] || 0.03;
    createNoise(d, freqs[power] || 2000, 5, volumes[power] || 0.06, 'bandpass');
    if (thumpFreqs[power]) {
      playTone(thumpFreqs[power], 'sine', thumpDur[power], volumes[power] * 0.6);
    }
    if (power >= 3) {
      // Reverb-like delay
      const delay = audioCtx.createDelay();
      delay.delayTime.value = power === 4 ? 0.08 : 0.05;
      const fb = audioCtx.createGain();
      fb.gain.value = power === 4 ? 0.3 : 0.2;
      createNoise(d * 0.5, freqs[power], 3, volumes[power] * 0.3, 'bandpass');
    }
  }

  function playDeliveryWhoosh() {
    if (!audioCtx || !state.soundEnabled) return;
    createNoise(0.1, 3000, 1, 0.05, 'highpass');
  }

  function playStumpsHit() {
    if (!audioCtx || !state.soundEnabled) return;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => createNoise(0.04, 800, 2, 0.12, 'bandpass'), i * 15);
    }
    // Descending dramatic tone
    if (audioCtx) {
      const osc = audioCtx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 400;
      osc.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.3);
      const g = audioCtx.createGain();
      g.gain.value = 0.08;
      g.gain.setTargetAtTime(0, audioCtx.currentTime + 0.15, 0.1);
      osc.connect(g);
      g.connect(masterGain);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    }
  }

  function playCrowdReaction(type) {
    if (!audioCtx || !state.soundEnabled) return;
    const baseFreqs = [180, 220, 260, 310];
    let gainVal, pitchShift, dur, noiseGain;
    switch (type) {
      case 'cheer':  gainVal = 0.06; pitchShift = 50;  dur = 1.5; noiseGain = 0.04; break;
      case 'roar':   gainVal = 0.09; pitchShift = 100; dur = 2.0; noiseGain = 0.06; break;
      case 'groan':  gainVal = 0.05; pitchShift = -80; dur = 1.2; noiseGain = 0.02; break;
      default:       return;
    }
    baseFreqs.forEach(f => {
      playTone(f + pitchShift, 'sine', dur, gainVal);
    });
    if (type === 'roar') playTone(440, 'sine', dur, 0.04);
    createNoise(dur, 2000, 0.5, noiseGain, 'bandpass');
  }

  function playCrowdClap() {
    if (!audioCtx || !state.soundEnabled) return;
    for (let i = 0; i < 10; i++) {
      setTimeout(() => createNoise(0.01, 4000, 2, 0.04, 'bandpass'), i * 50);
    }
  }

  function playBoundaryJingle(isSix) {
    if (!audioCtx || !state.soundEnabled) return;
    const notes = isSix ? [523, 659, 784, 1047, 1319] : [523, 659, 784];
    const dur = isSix ? 0.06 : 0.08;
    const gap = isSix ? 0.055 : 0.09;
    const type = 'square';
    const vol = isSix ? 0.06 : 0.04;
    notes.forEach((n, i) => {
      setTimeout(() => {
        playTone(n, type, i === notes.length - 1 && isSix ? 0.2 : dur, vol);
        if (isSix) playTone(n / 2, 'triangle', dur, vol * 0.5);
      }, i * gap * 1000);
    });
  }

  function playUISound(type) {
    if (!audioCtx || !state.soundEnabled) return;
    switch (type) {
      case 'select':
        playTone(660, 'sine', 0.05, 0.04);
        break;
      case 'confirm':
        playTone(660, 'sine', 0.04, 0.05);
        setTimeout(() => playTone(880, 'sine', 0.04, 0.05), 50);
        break;
      case 'overComplete':
        [262, 330, 392, 523].forEach((n, i) => {
          setTimeout(() => playTone(n, 'sine', 0.1, 0.04), i * 110);
        });
        break;
      case 'levelComplete':
        [262, 330, 392, 523].forEach((n, i) => {
          setTimeout(() => playTone(n, 'triangle', i === 3 ? 0.3 : 0.1, 0.06), i * 110);
        });
        setTimeout(() => {
          playTone(659, 'triangle', 0.5, 0.06);
          playTone(784, 'triangle', 0.5, 0.06);
        }, 550);
        break;
      case 'gameOver':
        [392, 330, 262, 196].forEach((n, i) => {
          setTimeout(() => playTone(n, 'sine', 0.15, 0.04), i * 160);
        });
        break;
    }
  }

  // ============================================
  // CROWD DOTS (BG)
  // ============================================

  function initCrowdDots() {
    crowdDots = [];
    const crowdTop = H * 0.05;
    const crowdBottom = H * 0.3;
    const count = Math.min(600, Math.floor(W * (crowdBottom - crowdTop) / 20));
    for (let i = 0; i < count; i++) {
      crowdDots.push({
        x: Math.random() * W,
        y: crowdTop + Math.random() * (crowdBottom - crowdTop),
        r: 1.5 + Math.random() * 1.5,
        color: randomCrowdColor()
      });
    }
  }

  function randomCrowdColor() {
    const team = state.selectedTeam ? TEAMS[state.selectedTeam] : null;
    const r = Math.random();
    if (team && r < 0.4) return team.primary;
    if (team && r < 0.55) return team.secondary;
    const bright = ['#FF4444','#44FF44','#4444FF','#FFFF44','#FF44FF','#44FFFF','#FFFFFF','#FFD700','#FF6B00'];
    return bright[Math.floor(Math.random() * bright.length)];
  }

  // ============================================
  // BACKGROUND RENDERING
  // ============================================

  function drawBackground() {
    const ctx = bgCtx;
    ctx.clearRect(0, 0, W, H);

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.35);
    skyGrad.addColorStop(0, '#1a0a3e');
    skyGrad.addColorStop(1, '#3d1a6e');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H * 0.35);

    // Outfield gradient
    const fieldGrad = ctx.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.35, W * 0.8);
    fieldGrad.addColorStop(0, '#3a8a28');
    fieldGrad.addColorStop(1, '#1d5a10');
    ctx.fillStyle = fieldGrad;
    ctx.fillRect(0, H * 0.28, W, H * 0.72);

    // Boundary circle (dashed)
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5;
    ctx.ellipse(W / 2, H * 0.35, W * 0.46, H * 0.28, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Pitch perspective
    const vpX = W / 2;
    const vpY = H * 0.35;
    const pitchBottomW = W * 0.12;
    const pitchTopW = W * 0.025;
    const pitchBottom = H * 0.88;
    const pitchTop = vpY + H * 0.02;

    ctx.fillStyle = '#c8a96e';
    ctx.beginPath();
    ctx.moveTo(vpX - pitchTopW, pitchTop);
    ctx.lineTo(vpX + pitchTopW, pitchTop);
    ctx.lineTo(vpX + pitchBottomW, pitchBottom);
    ctx.lineTo(vpX - pitchBottomW, pitchBottom);
    ctx.closePath();
    ctx.fill();

    // Pitch texture (subtle dots)
    ctx.fillStyle = 'rgba(160,120,60,0.3)';
    for (let i = 0; i < 80; i++) {
      const t = Math.random();
      const py = pitchTop + t * (pitchBottom - pitchTop);
      const halfW = pitchTopW + t * (pitchBottomW - pitchTopW);
      const px = vpX + (Math.random() * 2 - 1) * halfW;
      ctx.fillRect(px, py, 1.5, 1.5);
    }

    // Crease lines
    drawCreaseLine(ctx, vpX, pitchTop, pitchBottom, pitchTopW, pitchBottomW, 0.12); // bowler crease
    drawCreaseLine(ctx, vpX, pitchTop, pitchBottom, pitchTopW, pitchBottomW, 0.88); // batsman crease

    // Bowler-end stumps (small)
    drawStumps(ctx, vpX, pitchTop + (pitchBottom - pitchTop) * 0.1, 1, 6);

    // Crowd dots
    crowdDots.forEach(d => {
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Floodlights
    drawFloodlight(ctx, W * 0.05, H * 0.02);
    drawFloodlight(ctx, W * 0.95, H * 0.02);
    drawFloodlight(ctx, W * 0.1, H * 0.15);
    drawFloodlight(ctx, W * 0.9, H * 0.15);

    bgDirty = false;
  }

  function drawCreaseLine(ctx, vpX, pitchTop, pitchBottom, pitchTopW, pitchBottomW, t) {
    const y = pitchTop + t * (pitchBottom - pitchTop);
    const halfW = pitchTopW + t * (pitchBottomW - pitchTopW);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = t > 0.5 ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(vpX - halfW * 1.3, y);
    ctx.lineTo(vpX + halfW * 1.3, y);
    ctx.stroke();
  }

  function drawStumps(ctx, x, y, scale, height) {
    const gap = 3 * scale;
    ctx.strokeStyle = '#d4a574';
    ctx.lineWidth = Math.max(1, 2 * scale);
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * gap, y);
      ctx.lineTo(x + i * gap, y - height);
      ctx.stroke();
    }
    // Bails
    ctx.strokeStyle = '#e8c888';
    ctx.lineWidth = Math.max(0.5, 1.5 * scale);
    ctx.beginPath();
    ctx.moveTo(x - gap, y - height);
    ctx.lineTo(x, y - height - 1 * scale);
    ctx.lineTo(x + gap, y - height);
    ctx.stroke();
  }

  function drawFloodlight(ctx, x, y) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y + H * 0.3, H * 0.4);
    grad.addColorStop(0, 'rgba(255,255,240,0.04)');
    grad.addColorStop(1, 'rgba(255,255,240,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - W * 0.15, y, W * 0.3, H * 0.5);
    // Light box
    ctx.fillStyle = 'rgba(255,255,220,0.3)';
    ctx.fillRect(x - 4, y, 8, 5);
  }

  // ============================================
  // FOREGROUND RENDERING
  // ============================================

  function drawForeground(dt) {
    const ctx = fgCtx;
    ctx.clearRect(0, 0, W, H);

    if (state.phase !== 'PLAYING') return;

    const vpX = W / 2;
    const vpY = H * 0.35;
    const pitchBottomW = W * 0.12;
    const pitchTopW = W * 0.025;
    const pitchBottom = H * 0.88;
    const pitchTop = vpY + H * 0.02;

    // Sweet spot indicator (subtle glow on batting crease)
    if (state.ballActive && state.ballProgress > 0.5) {
      const creaseY = pitchTop + 0.88 * (pitchBottom - pitchTop);
      const halfW = pitchTopW + 0.88 * (pitchBottomW - pitchTopW);
      const pulse = 0.3 + 0.2 * Math.sin(Date.now() * 0.008);
      ctx.strokeStyle = `rgba(255,215,0,${pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(vpX - halfW * 1.3, creaseY);
      ctx.lineTo(vpX + halfW * 1.3, creaseY);
      ctx.stroke();
    }

    // Batsman stumps
    if (!state.stumpScatter) {
      drawStumps(ctx, vpX, pitchBottom - (pitchBottom - pitchTop) * 0.02, 2.5, 25);
    }

    // Draw batsman
    drawBatsman(ctx, vpX, pitchBottom);

    // Draw bowler
    drawBowler(ctx, vpX, vpY, pitchTop);

    // Draw ball
    if (state.ballActive) {
      drawBall(ctx, vpX, vpY, pitchTop, pitchBottom, pitchTopW, pitchBottomW);
    }

    // Post-ball animation
    if (state.postBallActive) {
      drawPostBall(ctx, dt);
    }

    // Stump scatter
    if (state.stumpScatter) {
      drawStumpScatter(ctx, dt);
    }

    // Particles
    updateAndDrawParticles(ctx, dt);

    // Floating texts
    updateAndDrawFloatingTexts(ctx, dt);

    // Animate crowd dots (shift a few per frame)
    if (!reducedMotion && state.phase === 'PLAYING') {
      const count = Math.min(8, crowdDots.length);
      for (let i = 0; i < count; i++) {
        const idx = Math.floor(Math.random() * crowdDots.length);
        crowdDots[idx].color = randomCrowdColor();
      }

      // Crowd wave after six: sequential color shift left to right
      if (state.crowdWaveActive) {
        const waveElapsed = (Date.now() - state.crowdWaveStart) / 1000;
        if (waveElapsed > 2) {
          state.crowdWaveActive = false;
        } else {
          const wavePos = waveElapsed * W * 0.8; // wave sweeps across screen
          const waveWidth = W * 0.15;
          const team = state.selectedTeam ? TEAMS[state.selectedTeam] : null;
          const waveColor = team ? team.secondary : '#FFD700';
          crowdDots.forEach(d => {
            if (Math.abs(d.x - wavePos) < waveWidth) {
              d.color = waveColor;
            }
          });
          bgDirty = true;
        }
      }

      // Tension: crowd gets more animated (more color shifts)
      if (state.tensionActive) {
        const extra = Math.min(15, crowdDots.length);
        for (let i = 0; i < extra; i++) {
          const idx = Math.floor(Math.random() * crowdDots.length);
          crowdDots[idx].color = randomCrowdColor();
        }
        bgDirty = true;
      }
    }
  }

  function drawBatsman(ctx, vpX, pitchBottom) {
    const bx = vpX;
    const by = pitchBottom + 2;
    const team = state.selectedTeam ? TEAMS[state.selectedTeam] : { primary: '#004BA0', secondary: '#FFD700' };

    // New batsman walk-in
    let xOff = 0;
    if (state.newBatsmanAnim) {
      const elapsed = Date.now() - state.newBatsmanTime;
      const t = Math.min(1, elapsed / 800);
      xOff = (1 - t) * W * 0.3;
      if (t >= 1) state.newBatsmanAnim = false;
    }

    ctx.save();
    ctx.translate(bx + xOff, by);

    // Legs (white pads)
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(-10, -8, 7, 18);
    ctx.fillRect(3, -8, 7, 18);

    // Body (jersey)
    ctx.fillStyle = team.primary;
    ctx.beginPath();
    ctx.roundRect(-15, -55, 30, 50, 5);
    ctx.fill();

    // V-stripe on jersey
    ctx.strokeStyle = team.secondary;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-10, -55);
    ctx.lineTo(0, -35);
    ctx.lineTo(10, -55);
    ctx.stroke();

    // Helmet
    ctx.fillStyle = team.primary;
    ctx.beginPath();
    ctx.arc(0, -62, 10, 0, Math.PI * 2);
    ctx.fill();
    // Face guard
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-5, -58);
    ctx.lineTo(-5, -52);
    ctx.moveTo(0, -58);
    ctx.lineTo(0, -52);
    ctx.moveTo(5, -58);
    ctx.lineTo(5, -52);
    ctx.stroke();

    // Bat
    ctx.save();
    ctx.translate(14, -45); // shoulder pivot

    let angle = state.batAngle * Math.PI / 180;
    if (state.batAnimating) {
      const elapsed = Date.now() - state.batAnimStart;
      const t = Math.min(1, elapsed / state.batAnimDuration);
      const eased = 1 - Math.pow(1 - t, 3);
      switch (state.batAnimType) {
        case 'straight':
          angle = (-30 + eased * 180) * Math.PI / 180;
          break;
        case 'pull':
          angle = (-30 + eased * 160) * Math.PI / 180;
          break;
        case 'cut':
          angle = (-30 + eased * 170) * Math.PI / 180;
          break;
        case 'defense':
          angle = (-30 + eased * 60) * Math.PI / 180;
          break;
      }
      if (t >= 1) {
        state.batAnimating = false;
        state.batAngle = -30;
      }
    }

    ctx.rotate(angle);
    // Bat handle
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(-2, 0, 4, 14);
    // Bat blade
    ctx.fillStyle = '#d4a574';
    ctx.fillRect(-4, 14, 8, 22);
    // Bat edge highlight
    ctx.fillStyle = '#e8c888';
    ctx.fillRect(-4, 14, 2, 22);

    ctx.restore(); // bat transform
    ctx.restore(); // batsman transform
  }

  function drawBowler(ctx, vpX, vpY, pitchTop) {
    const bowlerY = pitchTop + (vpY - pitchTop) * 0.3;
    let scale = 0.5;

    // Run-up: bowler grows slightly
    if (state.bowlerAnimating) {
      scale += state.bowlerRunUp * 0.15;
    }

    ctx.save();
    ctx.translate(vpX, bowlerY);
    ctx.scale(scale, scale);

    // Body
    ctx.fillStyle = state.opponentTeam ? TEAMS[state.opponentTeam].primary : '#666';
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#dba67a';
    ctx.beginPath();
    ctx.arc(0, -20, 6, 0, Math.PI * 2);
    ctx.fill();

    // Bowling arm
    if (state.bowlerAnimating) {
      const armAngle = state.bowlerArmAngle * Math.PI / 180;
      ctx.strokeStyle = '#dba67a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(Math.cos(armAngle) * 18, -10 + Math.sin(armAngle) * 18);
      ctx.stroke();
      // Ball in hand (before release)
      if (state.bowlerArmAngle < 90) {
        ctx.fillStyle = '#cc0000';
        ctx.beginPath();
        ctx.arc(Math.cos(armAngle) * 20, -10 + Math.sin(armAngle) * 20, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Legs
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(-5, 12, 4, 10);
    ctx.fillRect(1, 12, 4, 10);

    ctx.restore();
  }

  function drawBall(ctx, vpX, vpY, pitchTop, pitchBottom, pitchTopW, pitchBottomW) {
    const t = state.ballProgress;
    // Ball position along pitch in perspective
    const baseY = pitchTop + t * (pitchBottom - pitchTop);

    // Lateral movement for swing
    let lateralOff = 0;
    const swingVisible = state.ballLateBreak ? (t > 0.6 ? (t - 0.6) / 0.4 : 0) : (t > 0.4 ? (t - 0.4) / 0.6 : 0);
    if (state.ballDeliveryType === 'inswing') {
      lateralOff = swingVisible * W * 0.04 * -1;
    } else if (state.ballDeliveryType === 'outswing') {
      lateralOff = swingVisible * W * 0.04;
    }

    // Bouncer: ball rises after 60%
    let yOff = 0;
    if (state.ballDeliveryType === 'bouncer' && t > 0.6) {
      const bt = (t - 0.6) / 0.4;
      yOff = -bt * H * 0.08;
    }

    // Yorker: ball stays very low
    if (state.ballDeliveryType === 'yorker') {
      yOff = t * 3;
    }

    // Ball size grows with perspective
    const ballSize = 3 + t * 8;
    const bx = vpX + lateralOff + state.ballSwingDir * swingVisible * W * 0.01;
    const by = baseY + yOff;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(bx, baseY + 2, ballSize * 0.8, ballSize * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ball
    ctx.fillStyle = '#cc0000';
    ctx.beginPath();
    ctx.arc(bx, by, ballSize, 0, Math.PI * 2);
    ctx.fill();

    // Seam
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(bx - ballSize * 0.7, by);
    ctx.lineTo(bx + ballSize * 0.7, by);
    ctx.stroke();
  }

  function drawPostBall(ctx, dt) {
    const elapsed = Date.now() - state.postBallTime;
    const t = Math.min(1, elapsed / 1200);

    switch (state.postBallType) {
      case 'four': {
        // Ball races along ground to boundary
        const angle = state.postBallVx;
        const dist = t * W * 0.5;
        const bx = state.postBallX + Math.cos(angle) * dist;
        const by = state.postBallY - dist * 0.6;
        const size = Math.max(1, state.postBallSize * (1 - t * 0.7));
        ctx.fillStyle = '#cc0000';
        ctx.beginPath();
        ctx.arc(bx, by, size, 0, Math.PI * 2);
        ctx.fill();
        // Trail
        if (!reducedMotion) {
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(state.postBallX, state.postBallY);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
        if (t >= 1) state.postBallActive = false;
        break;
      }
      case 'six': {
        // Ball arcs up into crowd
        const bx = state.postBallX + t * state.postBallVx * 80;
        const arcY = state.postBallY - t * H * 0.5 + t * t * H * 0.1;
        const size = Math.max(1, state.postBallSize * (1 - t * 0.8));
        ctx.fillStyle = '#cc0000';
        ctx.beginPath();
        ctx.arc(bx, arcY, size, 0, Math.PI * 2);
        ctx.fill();
        // Trail dots
        if (!reducedMotion) {
          for (let i = 0; i < 5; i++) {
            const tt = Math.max(0, t - i * 0.04);
            const tx = state.postBallX + tt * state.postBallVx * 80;
            const ty = state.postBallY - tt * H * 0.5 + tt * tt * H * 0.1;
            ctx.fillStyle = `rgba(255,255,255,${0.3 - i * 0.05})`;
            ctx.beginPath();
            ctx.arc(tx, ty, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        if (t >= 1) state.postBallActive = false;
        break;
      }
      case 'wicket': {
        // Ball continues to stumps (already handled by stumpScatter)
        if (t >= 0.3) state.postBallActive = false;
        break;
      }
      case 'caught': {
        // Ball arcs up, fielder intercepts
        const bx = state.postBallX + t * state.postBallVx * 60;
        const arcY = state.postBallY - Math.sin(t * Math.PI) * H * 0.15;
        const size = Math.max(1, state.postBallSize * (1 - t * 0.5));
        ctx.fillStyle = '#cc0000';
        ctx.beginPath();
        ctx.arc(bx, arcY, size, 0, Math.PI * 2);
        ctx.fill();
        // Fielder dot moves to intercept
        if (t > 0.5) {
          ctx.fillStyle = state.opponentTeam ? TEAMS[state.opponentTeam].primary : '#666';
          ctx.beginPath();
          ctx.arc(bx, arcY + 5, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        if (t >= 1) state.postBallActive = false;
        break;
      }
      default: {
        // Dot / single / runs - ball rolls short
        const bx = state.postBallX + t * state.postBallVx * 30;
        const by = state.postBallY - t * 40;
        const size = Math.max(1, state.postBallSize * (1 - t));
        ctx.fillStyle = '#cc0000';
        ctx.beginPath();
        ctx.arc(bx, by, size, 0, Math.PI * 2);
        ctx.fill();
        if (t >= 1) state.postBallActive = false;
        break;
      }
    }
  }

  function drawStumpScatter(ctx, dt) {
    if (!state.stumpScatter) return;
    const ss = state.stumpScatter;
    const elapsed = Date.now() - ss.startTime;
    const t = elapsed / 1000;
    if (t > 1.5) {
      state.stumpScatter = null;
      return;
    }
    if (reducedMotion) {
      // Simple fade
      ctx.globalAlpha = Math.max(0, 1 - t);
      drawStumps(ctx, ss.x, ss.y, 2.5, 25);
      ctx.globalAlpha = 1;
      return;
    }
    ss.pieces.forEach(p => {
      ctx.save();
      ctx.translate(ss.x + p.vx * t * 60, ss.y + p.vy * t * 60 + 200 * t * t);
      ctx.rotate(p.rot * t * 4);
      ctx.fillStyle = '#d4a574';
      ctx.fillRect(-1.5, -12, 3, 24);
      ctx.restore();
    });
    // Bails fly up
    ss.bails.forEach(b => {
      const bx = ss.x + b.vx * t * 80;
      const by = ss.y - 25 + b.vy * t * 80 - 150 * t + 300 * t * t;
      ctx.fillStyle = '#e8c888';
      ctx.fillRect(bx - 3, by - 1, 6, 2);
    });
  }

  // ============================================
  // PARTICLES & FLOATING TEXT
  // ============================================

  const MAX_PARTICLES = 150;

  function spawnParticles(x, y, count, colors, speed, life) {
    if (reducedMotion) return;
    for (let i = 0; i < count && state.particles.length < MAX_PARTICLES; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.5 + Math.random() * 0.5);
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - speed * 0.5,
        life: life || 1,
        maxLife: life || 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 3
      });
    }
  }

  function updateAndDrawParticles(ctx, dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt; // gravity
      p.life -= dt;
      if (p.life <= 0) {
        state.particles[i] = state.particles[state.particles.length - 1];
        state.particles.pop();
        i--;
        continue;
      }
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function triggerCrowdWave() {
    state.crowdWaveActive = true;
    state.crowdWaveStart = Date.now();
    bgDirty = true;
  }

  function spawnFloatingText(text, x, y, color, size) {
    state.floatingTexts.push({
      text, x, y, color,
      size: size || 24,
      life: 1.0,
      maxLife: 1.0
    });
  }

  function updateAndDrawFloatingTexts(ctx, dt) {
    for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
      const ft = state.floatingTexts[i];
      ft.y -= 40 * dt;
      ft.life -= dt;
      if (ft.life <= 0) {
        state.floatingTexts[i] = state.floatingTexts[state.floatingTexts.length - 1];
        state.floatingTexts.pop();
        i--;
        continue;
      }
      const alpha = ft.life / ft.maxLife;
      const scale = reducedMotion ? 1 : (1 + (1 - alpha) * 0.3);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${ft.size * scale}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = ft.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  // ============================================
  // DIFFICULTY & DELIVERY GENERATION
  // ============================================

  function getDifficultyParams() {
    const lv = state.level;
    const ov = state.oversCompleted;
    // Base ball speed
    let baseSpeed = Math.max(550, 1200 - (lv - 1) * 80 - ov * 30);
    // Timing windows
    let perfect = Math.max(30, 60 - (lv - 1) * 4 - ov * 1);
    let good = Math.max(75, 140 - (lv - 1) * 8 - ov * 3);

    return { baseSpeed, perfect, good };
  }

  function generateBowlerForOver() {
    const fi = Math.floor(Math.random() * BOWLER_FIRST.length);
    const li = Math.floor(Math.random() * BOWLER_LAST.length);
    state.bowlerName = BOWLER_FIRST[fi].charAt(0) + '. ' + BOWLER_LAST[li];

    const r = Math.random();
    const lv = state.level;
    const ov = state.oversCompleted;
    if (lv >= 2 && ov >= 2 && r < 0.25) {
      state.bowlerType = 'spinner';
    } else if (r < 0.55) {
      state.bowlerType = 'pacer';
    } else {
      state.bowlerType = 'swing';
    }
  }

  function generateDelivery() {
    const lv = state.level;
    const ov = state.oversCompleted;
    const diff = getDifficultyParams();

    let speed = diff.baseSpeed;
    state.timingPerfect = diff.perfect;
    state.timingGood = diff.good;

    // Bowler type modifiers
    if (state.bowlerType === 'pacer') speed *= 0.9;
    if (state.bowlerType === 'spinner') {
      speed *= 1.3;
      // Timing window shifts later for spinner
      state.timingGood += 20;
    }

    // Pick delivery type
    const types = [];
    const addType = (type, weight) => { for (let i = 0; i < weight; i++) types.push(type); };

    const straightW = Math.max(15, 70 - (lv - 1) * 10 - ov * 4);
    const inswingW = Math.min(25, 5 + (lv - 1) * 4 + ov * 2);
    const outswingW = Math.min(25, 3 + (lv - 1) * 4 + ov * 2);
    const bouncerW = lv >= 2 ? Math.min(20, (lv - 1) * 3 + ov * 2) : 0;
    const yorkerW = lv >= 2 && ov >= 3 ? Math.min(20, (lv - 1) * 3 + ov) : 0;
    const slowerW = Math.min(20, lv * 3 + ov);
    const mysteryW = lv >= 3 ? Math.min(15, 3 + (lv - 3) * 2) : 0;

    addType('straight', straightW);
    addType('inswing', state.bowlerType === 'swing' ? inswingW + 10 : inswingW);
    addType('outswing', state.bowlerType === 'swing' ? outswingW + 10 : outswingW);
    addType('bouncer', state.bowlerType === 'pacer' ? bouncerW + 5 : bouncerW);
    addType('yorker', state.bowlerType === 'pacer' ? yorkerW + 5 : yorkerW);
    addType('slower', slowerW);

    let deliveryType = types[Math.floor(Math.random() * types.length)];

    // Mystery ball
    if (mysteryW > 0 && Math.random() * 100 < mysteryW) {
      state.ballLateBreak = true;
      const allTypes = ['straight','inswing','outswing','bouncer','yorker'];
      deliveryType = allTypes[Math.floor(Math.random() * allTypes.length)];
    } else {
      state.ballLateBreak = false;
    }

    // Store display type before remapping for physics
    state.ballDeliveryType = deliveryType;

    if (deliveryType === 'slower') {
      speed *= 1.4; // longer travel time = slower ball
      // Physics uses straight path but display/identity stays 'slower'
    }
    state.ballSpeed = speed;
    state.ballIsOnStumps = Math.random() < 0.4;
    state.ballSwingDir = (Math.random() - 0.5) * 2;
  }

  // ============================================
  // OUTCOME RESOLUTION
  // ============================================

  function resolveOutcome(timingMs) {
    const dir = state.shotDirection;
    let probs;

    if (timingMs < 0) {
      // Missed (no swing)
      if (state.ballIsOnStumps) return { runs: -1, type: 'bowled' };
      return { runs: 0, type: 'dot' };
    }

    // Check timing quality
    let quality;
    if (timingMs <= state.timingPerfect) quality = 'perfect';
    else if (timingMs <= state.timingGood) quality = 'good';
    else if (timingMs <= 200) quality = 'mistimed';
    else {
      // Too late
      if (state.ballIsOnStumps) return { runs: -1, type: 'bowled' };
      return { runs: 0, type: 'dot' };
    }

    // Counter-shot bonus
    const counterShot = DELIVERY_COUNTER[state.ballDeliveryType];
    if (counterShot && counterShot === dir) {
      if (quality === 'mistimed') quality = 'good';
      else if (quality === 'good') quality = 'perfect';
    }

    switch (quality) {
      case 'perfect': probs = PROB_PERFECT[dir]; break;
      case 'good':    probs = PROB_GOOD[dir]; break;
      case 'mistimed': probs = PROB_MISTIMED[dir]; break;
    }

    // Roll outcome
    const roll = Math.random() * 100;
    let cum = 0;
    const outcomes = [0, 1, 2, 3, 4, 6, -1]; // -1 = OUT
    for (let i = 0; i < probs.length; i++) {
      cum += probs[i];
      if (roll < cum) {
        const runs = outcomes[i];
        if (runs === -1) {
          const outType = dir === 'defense' ? 'bowled' : (Math.random() < 0.5 ? 'caught' : 'bowled');
          return { runs: -1, type: outType };
        }
        let type = 'dot';
        if (runs === 1) type = 'single';
        else if (runs === 2) type = 'two';
        else if (runs === 3) type = 'three';
        else if (runs === 4) type = 'four';
        else if (runs === 6) type = 'six';
        return { runs, type };
      }
    }
    return { runs: 0, type: 'dot' };
  }

  // ============================================
  // BALL DELIVERY SEQUENCE
  // ============================================

  let deliveryPhase = 'idle'; // idle, runup, inflight, resolved, postDelay
  let deliveryTimer = 0;

  function startDelivery() {
    generateDelivery();
    deliveryPhase = 'runup';
    deliveryTimer = 0;
    state.bowlerAnimating = true;
    state.bowlerRunUp = 0;
    state.bowlerArmAngle = -90;
    state.swingTriggered = false;
    state.ballActive = false;
    state.ballProgress = 0;
    state.postBallActive = false;
    state.stumpScatter = null;
    state.batAngle = -30;
    state.batAnimating = false;
  }

  function updateDelivery(dt) {
    if (state.phase !== 'PLAYING') return;
    if (state.paused) return;

    switch (deliveryPhase) {
      case 'idle':
        // Wait between balls
        if (state.waitingForNext) {
          state.nextBallDelay -= dt * 1000;
          if (state.nextBallDelay <= 0) {
            state.waitingForNext = false;
            if (state.ballsInOver >= 6) {
              endOver();
            } else {
              startDelivery();
            }
          }
        }
        break;

      case 'runup':
        deliveryTimer += dt * 1000;
        state.bowlerRunUp = Math.min(1, deliveryTimer / 600);
        state.bowlerArmAngle = -90 + state.bowlerRunUp * 180;
        if (deliveryTimer >= 400) {
          // Release ball
          deliveryPhase = 'inflight';
          deliveryTimer = 0;
          state.ballActive = true;
          state.ballProgress = 0;
          state.bowlerAnimating = false;
          playDeliveryWhoosh();
        }
        break;

      case 'inflight':
        if (deliveryPhase !== 'inflight') break; // guard against re-entry after resolve
        deliveryTimer += dt * 1000;
        state.ballProgress = Math.min(1, deliveryTimer / state.ballSpeed);

        // Check if player has swung
        if (state.swingTriggered && !state.batAnimating) {
          // Resolve immediately on swing
          deliveryPhase = 'resolved';
          const idealTime = state.ballSpeed * 0.85;
          const timingMs = Math.abs(state.swingTime - idealTime);
          const outcome = resolveOutcome(timingMs);
          handleOutcome(outcome);
          deliveryTimer = 0;
          break;
        }

        // Ball reached batsman
        if (state.ballProgress >= 1) {
          // Player didn't swing
          deliveryPhase = 'resolved';
          const outcome = resolveOutcome(-1);
          handleOutcome(outcome);
          deliveryTimer = 0;
        }
        break;

      case 'resolved':
        deliveryTimer += dt * 1000;
        if (deliveryTimer >= 800) {
          deliveryPhase = 'idle';
          state.ballActive = false;
          // Check game end conditions
          if (state.wickets >= 3) {
            endGame();
          } else if (state.runs >= state.target) {
            completeLevelTarget();
          } else {
            state.waitingForNext = true;
            state.nextBallDelay = 400;
          }
        }
        break;
    }
  }

  function handleOutcome(outcome) {
    state.ballActive = false;
    state.totalBallsFaced++;
    state.ballsInOver++;

    const vpX = W / 2;
    const pitchBottom = H * 0.88;

    if (outcome.runs === -1) {
      // WICKET
      state.wickets++;
      state.currentOverResults.push({ runs: 0, isWicket: true, isFour: false, isSix: false });
      state.consecutiveScoringBalls = 0;

      // Animations
      if (outcome.type === 'bowled') {
        playStumpsHit();
        triggerStumpScatter(vpX, pitchBottom);
        state.postBallActive = true;
        state.postBallType = 'wicket';
        state.postBallTime = Date.now();
      } else {
        playBatCrack(0);
        state.postBallActive = true;
        state.postBallType = 'caught';
        state.postBallTime = Date.now();
        state.postBallX = vpX;
        state.postBallY = pitchBottom - 40;
        state.postBallVx = (Math.random() - 0.5) * 3;
        state.postBallSize = 6;
      }

      playCrowdReaction('groan');
      spawnFloatingText('OUT!', vpX, pitchBottom - 60, '#E8000D', 32);

      // Wicket flash
      if (!reducedMotion) gameWrap.classList.add('cb-wicket-flash');
      setTimeout(() => gameWrap.classList.remove('cb-wicket-flash'), 500);

      vibrate([100]);
      announceScore(`Out! ${outcome.type}. ${state.runs} for ${state.wickets}.`);

      // New batsman animation
      if (state.wickets < 3) {
        state.newBatsmanAnim = true;
        state.newBatsmanTime = Date.now() + 400;
      }

      updateHUD();
      return;
    }

    // Runs scored -- apply powerplay multiplier
    let runs = outcome.runs;
    const rawRuns = runs;
    if (state.isPowerplay && runs > 0) {
      runs = Math.round(runs * 1.5);
    }
    state.runs += runs;
    state.currentOverRuns += runs;
    state.currentOverResults.push({ runs, rawRuns, isWicket: false, isFour: rawRuns === 4, isSix: rawRuns === 6 });

    if (runs > 0) {
      state.consecutiveScoringBalls++;
      state.currentOverScoringBalls++;
    } else {
      state.consecutiveScoringBalls = 0;
    }

    // Ball power for bat crack (use rawRuns for sound quality mapping)
    let power = 0;
    if (rawRuns === 1) power = 1;
    else if (rawRuns <= 3) power = 2;
    else if (rawRuns === 4) power = 3;
    else if (rawRuns === 6) power = 4;

    // Bat swing animation
    state.batAnimating = true;
    state.batAnimStart = Date.now();
    state.batAnimType = state.shotDirection;
    state.batAnimDuration = state.shotDirection === 'defense' ? 120 : 200;

    playBatCrack(power);

    // Post-ball visual
    state.postBallActive = true;
    state.postBallTime = Date.now();
    state.postBallX = vpX;
    state.postBallY = pitchBottom - 40;
    state.postBallSize = 8;

    if (rawRuns === 4) {
      state.fours++;
      state.postBallType = 'four';
      state.postBallVx = (Math.random() - 0.5) * 2 - 0.3;
      const fourLabel = state.isPowerplay ? 'FOUR! (x1.5)' : 'FOUR!';
      spawnFloatingText(fourLabel, vpX, pitchBottom - 80, '#FFD700', 32);
      spawnParticles(vpX, pitchBottom - 60, 25, ['#FFD700', '#FFA500', '#FFFFFF'], 120, 0.8);
      playCrowdReaction('cheer');
      playBoundaryJingle(false);
      vibrate([30]);
      checkAchievement('cb-first-four');
    } else if (rawRuns === 6) {
      state.sixes++;
      state.postBallType = 'six';
      state.postBallVx = (Math.random() - 0.5) * 2;
      const sixLabel = state.isPowerplay ? 'SIX! (x1.5)' : 'SIX!';
      spawnFloatingText(sixLabel, vpX, pitchBottom - 80, '#FF00FF', 38);
      spawnParticles(vpX, pitchBottom - 60, 40, ['#FF00FF', '#FFD700', '#00FFFF', '#FF4444', '#44FF44'], 150, 1.2);
      playCrowdReaction('roar');
      playBoundaryJingle(true);
      vibrate([30, 15, 50]);
      checkAchievement('cb-first-six');
      // Trigger crowd wave
      triggerCrowdWave();
    } else if (runs === 0) {
      state.postBallType = 'default';
      state.postBallVx = (Math.random() - 0.5);
      spawnFloatingText('DOT', vpX, pitchBottom - 60, 'rgba(255,255,255,0.6)', 20);
    } else {
      state.postBallType = 'default';
      state.postBallVx = (Math.random() - 0.5) * 1.5;
      spawnFloatingText(runs.toString(), vpX, pitchBottom - 60, '#FFFFFF', 24);
    }

    // Milestone checks
    if (state.runs >= 50 && state.runs - runs < 50) {
      spawnFloatingText('FIFTY!', vpX, pitchBottom - 120, '#FFD700', 36);
      spawnParticles(vpX, pitchBottom - 100, 50, ['#FFD700'], 100, 1.5);
      checkAchievement('cb-fifty');
    }
    if (state.runs >= 100 && state.runs - runs < 100) {
      spawnFloatingText('CENTURY!', vpX, pitchBottom - 120, '#FFD700', 40);
      spawnParticles(vpX, pitchBottom - 100, 80, ['#FFD700', '#FF00FF', '#00FFFF'], 150, 2);
      checkAchievement('cb-century');
    }

    // Perfect over check
    if (state.currentOverScoringBalls >= 6 && state.ballsInOver === 6) {
      checkAchievement('cb-perfect-over');
    }

    const announceText = runs === 0 ? 'Dot ball.' : `${runs} run${runs > 1 ? 's' : ''}.`;
    announceScore(`${announceText} Total: ${state.runs} for ${state.wickets}.`);

    // Animate score
    hudRuns.classList.add('cb-score-pop');
    setTimeout(() => hudRuns.classList.remove('cb-score-pop'), 300);

    updateHUD();
  }

  function triggerStumpScatter(x, y) {
    state.stumpScatter = {
      x, y: y - (y - H * 0.37) * 0.02,
      startTime: Date.now(),
      pieces: [
        { vx: -1.5, vy: -2, rot: Math.random() * 2 - 1 },
        { vx: 0, vy: -3, rot: Math.random() * 2 - 1 },
        { vx: 1.5, vy: -2, rot: Math.random() * 2 - 1 }
      ],
      bails: [
        { vx: -2, vy: -4 },
        { vx: 2, vy: -3.5 }
      ]
    };
  }

  // ============================================
  // OVER / LEVEL / GAME END
  // ============================================

  function endOver() {
    // Track best over
    if (state.currentOverRuns > state.bestOverRuns) {
      state.bestOverRuns = state.currentOverRuns;
    }

    state.oversCompleted++;
    playCrowdClap();
    playUISound('overComplete');

    if (state.oversCompleted >= 5) {
      // Innings over
      if (state.runs >= state.target) {
        completeLevelTarget();
      } else {
        endGame();
      }
      return;
    }

    // Show between-overs screen
    showBetweenOvers();
  }

  function showBetweenOvers() {
    state.phase = 'BETWEEN_OVERS';
    gameWrap.classList.remove('cb-playing');

    const ballsHtml = state.currentOverResults.map(r => {
      if (r.isWicket) return '<div class="cb-ball-dot wicket">W</div>';
      if (r.isSix) return '<div class="cb-ball-dot six">6</div>';
      if (r.isFour) return '<div class="cb-ball-dot four">4</div>';
      if (r.runs === 0) return '<div class="cb-ball-dot dot">&middot;</div>';
      return `<div class="cb-ball-dot runs">${r.runs}</div>`;
    }).join('');

    const rr = state.totalBallsFaced > 0 ? (state.runs / (state.totalBallsFaced / 6)).toFixed(2) : '0.00';
    const ballsRemaining = (5 - state.oversCompleted) * 6;
    const rrr = ballsRemaining > 0 ? ((state.target - state.runs) / (ballsRemaining / 6)).toFixed(2) : '-';

    const commentary = pickRandom(COMMENTARY.overEnd);

    // Generate next bowler ahead of time so we can show them
    generateBowlerForOver();

    const rrAhead = parseFloat(rr) <= parseFloat(rrr);

    overModal.innerHTML = `
      <h2>End of Over ${state.oversCompleted}</h2>
      <div class="cb-over-summary">${ballsHtml}</div>
      <div class="cb-stat-row"><span>Runs this over</span><span>${state.currentOverRuns}</span></div>
      <div class="cb-stat-row"><span>Score</span><span>${state.runs}/${state.wickets}</span></div>
      <div class="cb-rate-compare">
        <div class="cb-rate-item">
          <span class="label">Run Rate</span>
          <span class="value ${rrAhead ? 'behind' : 'ahead'}">${rr}</span>
        </div>
        <div class="cb-rate-item">
          <span class="label">Required RR</span>
          <span class="value">${rrr}</span>
        </div>
      </div>
      <p class="cb-commentary">"${commentary}"</p>
      <div class="cb-over-bowler">Next: ${state.bowlerName}</div>
      <div class="cb-over-bowler-type">${state.bowlerType}</div>
      <button class="cb-btn" onclick="window._cbNextOver()">NEXT OVER &rarr;</button>
      <p class="cb-countdown" id="overCountdown">Auto-continuing in 5s</p>
    `;

    overOverlay.classList.add('cb-visible');

    // Auto-continue
    state.autoOverTimer = 5;
    clearInterval(window._cbAutoOverInt);
    const countdownEl = overModal.querySelector('#overCountdown');
    window._cbAutoOverInt = setInterval(() => {
      state.autoOverTimer--;
      if (countdownEl) countdownEl.textContent = `Auto-continuing in ${state.autoOverTimer}s`;
      if (state.autoOverTimer <= 0) {
        clearInterval(window._cbAutoOverInt);
        window._cbNextOver();
      }
    }, 1000);
  }

  function startNextOver() {
    clearInterval(window._cbAutoOverInt);
    overOverlay.classList.remove('cb-visible');

    state.phase = 'PLAYING';
    state.ballsInOver = 0;
    state.currentOverRuns = 0;
    state.currentOverResults = [];
    state.consecutiveScoringBalls = 0;
    state.currentOverScoringBalls = 0;
    gameWrap.classList.add('cb-playing');

    // Bowler already generated in showBetweenOvers
    showBowlerIntro();

    setTimeout(() => startDelivery(), 1200);
  }

  function completeLevelTarget() {
    state.phase = 'LEVEL_COMPLETE';
    gameWrap.classList.remove('cb-playing');

    const ballsRemaining = Math.max(0, 30 - state.totalBallsFaced);

    // Check achievements
    if (ballsRemaining >= 10) checkAchievement('cb-target-crushed');
    if (state.level >= 3) checkAchievement('cb-level-3');
    if (state.level >= 5) checkAchievement('cb-level-5');
    if (state.wickets === 0 && state.totalBallsFaced >= 6) checkAchievement('cb-no-wicket');

    playUISound('levelComplete');
    spawnConfetti();

    levelModal.innerHTML = `
      <div class="cb-level-heading">TARGET BEATEN!</div>
      <div class="cb-level-sub">Level ${state.level} Complete</div>
      <div class="cb-stat-row"><span>Runs Scored</span><span>${state.runs}</span></div>
      <div class="cb-stat-row"><span>Balls Remaining</span><span>${ballsRemaining}</span></div>
      <div class="cb-stat-row"><span>Wickets Lost</span><span>${state.wickets}</span></div>
      <div class="cb-btn-row">
        <button class="cb-btn" onclick="window._cbNextLevel()">Next Level</button>
      </div>
    `;
    levelOverlay.classList.add('cb-visible');
  }

  function startNextLevel() {
    levelOverlay.classList.remove('cb-visible');
    state.level++;
    state.target = getTarget(state.level);
    state.runs = 0;
    state.wickets = 0;
    state.totalBallsFaced = 0;
    state.ballsInOver = 0;
    state.oversCompleted = 0;
    state.fours = 0;
    state.sixes = 0;
    state.bestOverRuns = 0;
    state.currentOverRuns = 0;
    state.currentOverResults = [];
    state.consecutiveScoringBalls = 0;
    state.currentOverScoringBalls = 0;
    state.isPowerplay = true;
    state.tensionActive = false;
    state.crowdWaveActive = false;

    state.phase = 'PLAYING';
    gameWrap.classList.add('cb-playing');
    updateHUD();

    generateBowlerForOver();
    showBowlerIntro();
    setTimeout(() => startDelivery(), 1200);
  }

  function endGame() {
    state.phase = 'GAME_OVER';
    gameWrap.classList.remove('cb-playing');

    const totalRuns = state.runs;
    const boundaryBonus = state.fours * 2 + state.sixes * 4;
    const wicketPenalty = state.wickets * 10;
    const didBeat = totalRuns >= state.target;
    const ballsRemaining = Math.max(0, 30 - state.totalBallsFaced);
    const targetBonus = didBeat ? 25 : 0;
    const ballBonus = didBeat ? ballsRemaining * 3 : 0;
    const finalScore = Math.max(0, totalRuns + boundaryBonus - wicketPenalty + targetBonus + ballBonus);

    // Track best
    const sr = state.totalBallsFaced > 0 ? ((totalRuns / state.totalBallsFaced) * 100).toFixed(1) : '0.0';

    // Achievement checks
    if (state.wickets === 0 && state.totalBallsFaced === 30) checkAchievement('cb-no-wicket');
    if (state.sixes >= 6) checkAchievement('cb-six-sixes');
    if (finalScore >= 200) checkAchievement('cb-high-score-200');

    // Save best score
    try {
      const prev = parseInt(localStorage.getItem('cricket-blitz-high-score')) || 0;
      if (finalScore > prev) localStorage.setItem('cricket-blitz-high-score', finalScore);
      const bestLv = parseInt(localStorage.getItem('cricket-blitz-best-level')) || 0;
      if (state.level > bestLv) localStorage.setItem('cricket-blitz-best-level', state.level);
    } catch (e) {}

    if (didBeat) {
      playUISound('levelComplete');
      spawnConfetti();
    } else {
      playUISound('gameOver');
    }

    // Score submission
    submitScore(finalScore, totalRuns, sr, didBeat);

    const heading = didBeat ? 'What an innings!' : 'Innings Over';
    const subText = didBeat ? 'Incredible batting performance!' : 'So close! Better luck next time.';

    // Star rating: 1 star = played, 2 = beat target, 3 = beat with balls remaining
    let stars = 1;
    if (didBeat) stars = 2;
    if (didBeat && ballsRemaining >= 6) stars = 3;
    const starHtml = Array.from({ length: 3 }, (_, i) =>
      `<span class="${i < stars ? 'star-filled' : 'star-empty'}">\u2605</span>`
    ).join('');

    gameOverModal.innerHTML = `
      <h2>${heading}</h2>
      <p style="color:var(--cb-text-dim);margin:0 0 4px;">${subText}</p>
      <div class="cb-star-rating">${starHtml}</div>
      <div class="cb-final-score" id="finalScoreDisplay">0</div>
      <div class="cb-stats-grid">
        <div class="stat-item"><span class="stat-value">${totalRuns}</span><span class="stat-label">Runs</span></div>
        <div class="stat-item"><span class="stat-value">${state.totalBallsFaced}</span><span class="stat-label">Balls</span></div>
        <div class="stat-item"><span class="stat-value">${state.fours}</span><span class="stat-label">Fours</span></div>
        <div class="stat-item"><span class="stat-value">${state.sixes}</span><span class="stat-label">Sixes</span></div>
        <div class="stat-item"><span class="stat-value">${sr}</span><span class="stat-label">SR</span></div>
        <div class="stat-item"><span class="stat-value">${state.wickets}</span><span class="stat-label">Wickets</span></div>
      </div>
      <div class="cb-score-breakdown">
        <div class="cb-stat-row"><span>Runs Scored</span><span>${totalRuns}</span></div>
        <div class="cb-stat-row"><span>Boundary Bonus</span><span>+${boundaryBonus}</span></div>
        <div class="cb-stat-row"><span>Wicket Penalty</span><span>-${wicketPenalty}</span></div>
        ${didBeat ? `<div class="cb-stat-row"><span>Target Bonus</span><span>+${targetBonus}</span></div>` : ''}
        ${didBeat ? `<div class="cb-stat-row"><span>Balls Remaining</span><span>+${ballBonus}</span></div>` : ''}
        <div class="cb-stat-row cb-score-total"><span>Total Score</span><span>${finalScore}</span></div>
      </div>
      <div class="cb-btn-row">
        <button class="cb-btn" onclick="window._cbPlayAgain()">PLAY AGAIN</button>
        <button class="cb-share-btn" onclick="window._cbShare()">&#128279; Share Score</button>
      </div>
    `;

    gameOverOverlay.classList.add('cb-visible');

    // Animated score count-up
    animateScoreCountUp(finalScore);
  }

  function animateScoreCountUp(target) {
    const el = $('finalScoreDisplay');
    if (!el) return;
    let current = 0;
    const duration = 1500;
    const start = Date.now();
    function tick() {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      current = Math.round(eased * target);
      el.textContent = current;
      if (t < 1) requestAnimationFrame(tick);
    }
    tick();
  }

  async function submitScore(finalScore, totalRuns, sr, didBeat) {
    try {
      if (window.apiClient && currentUser) {
        await window.apiClient.submitScore('cricket-blitz', {
          score: finalScore,
          level: state.level,
          timeMs: Date.now() - state.gameStartTime,
          metadata: {
            runsScored: totalRuns,
            ballsFaced: state.totalBallsFaced,
            fours: state.fours,
            sixes: state.sixes,
            wicketsLost: state.wickets,
            strikeRate: sr,
            highestOver: state.bestOverRuns,
            team: state.selectedTeam,
            targetBeaten: didBeat
          }
        });
      }
    } catch (e) {
      console.warn('Score submission failed:', e);
    }
  }

  function spawnConfetti() {
    if (reducedMotion) return;
    const team = state.selectedTeam ? TEAMS[state.selectedTeam] : null;
    const colors = team
      ? [team.primary, team.secondary, team.accent, '#FFD700', '#FF00FF']
      : ['#FFD700', '#FF00FF', '#00FFFF', '#FF4444', '#44FF44'];
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * W;
      const y = -20 - Math.random() * 60;
      state.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 100,
        vy: Math.random() * 80 + 40,
        life: 2 + Math.random(),
        maxLife: 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.random() * 4
      });
    }
  }

  // ============================================
  // HUD UPDATE
  // ============================================

  function updateHUD() {
    hudOvers.textContent = `${state.oversCompleted}.${state.ballsInOver}/5`;
    hudTarget.textContent = state.target;
    hudRuns.textContent = state.runs;
    hudFours.textContent = state.fours;
    hudSixes.textContent = state.sixes;

    const rr = state.totalBallsFaced > 0 ? (state.runs / (state.totalBallsFaced / 6)).toFixed(2) : '0.00';
    hudRR.textContent = rr;

    // Wickets
    const icons = hudWickets.querySelectorAll('.cb-wicket-icon');
    icons.forEach((icon, i) => {
      icon.classList.toggle('active', i >= state.wickets);
    });

    // Shot indicator (desktop)
    const arrows = { straight: '\u2191', pull: '\u2190', cut: '\u2192', defense: '\u2193' };
    const labels = { straight: 'Drive', pull: 'Pull', cut: 'Cut', defense: 'Block' };
    shotArrow.textContent = arrows[state.shotDirection] || '\u2191';
    shotLabel.textContent = labels[state.shotDirection] || 'Drive';

    // Pitch shot overlay (mobile)
    const pitchShotIcon = $('pitchShotIcon');
    const pitchShotName = $('pitchShotName');
    if (pitchShotIcon) pitchShotIcon.textContent = arrows[state.shotDirection] || '\u2191';
    if (pitchShotName) pitchShotName.textContent = (labels[state.shotDirection] || 'Drive').toUpperCase();

    // Powerplay badge
    state.isPowerplay = state.oversCompleted < 2;
    const ppBadge = $('powerplayBadge');
    if (ppBadge) ppBadge.classList.toggle('show', state.isPowerplay && state.phase === 'PLAYING');

    // Tension check (within 15 runs of target)
    const tensionEdge = $('tensionEdge');
    const runsNeeded = state.target - state.runs;
    state.tensionActive = runsNeeded > 0 && runsNeeded <= 15 && state.phase === 'PLAYING';
    if (tensionEdge) tensionEdge.classList.toggle('active', state.tensionActive);
  }

  function showBowlerIntro() {
    bowlerIntro.textContent = `Bowling: ${state.bowlerName} (${state.bowlerType})`;
    bowlerIntro.classList.add('show');
    setTimeout(() => bowlerIntro.classList.remove('show'), 1500);
  }

  function announceScore(text) {
    if (srAnnounce) srAnnounce.textContent = text;
  }

  // ============================================
  // ACHIEVEMENTS
  // ============================================

  function checkAchievement(id) {
    if (state.achievementsUnlocked.has(id)) return;
    if (!ACHIEVEMENTS[id]) return;
    state.achievementsUnlocked.add(id);

    const ach = ACHIEVEMENTS[id];
    showAchievementToast(ach.name, ach.desc);

    try {
      if (window.apiClient) {
        window.apiClient.unlockAchievement(id, 'cricket-blitz');
      }
    } catch (e) {}
  }

  function checkTeamsAchievement() {
    try {
      let teams = JSON.parse(localStorage.getItem('cricket-blitz-teams-played') || '[]');
      if (!teams.includes(state.selectedTeam)) {
        teams.push(state.selectedTeam);
        localStorage.setItem('cricket-blitz-teams-played', JSON.stringify(teams));
      }
      state.teamsPlayed = teams;
      if (teams.length >= 6) checkAchievement('cb-all-teams');
    } catch (e) {}
  }

  function showAchievementToast(name, desc) {
    achievementToast.innerHTML = `<strong>${name}</strong><br>${desc}`;
    achievementToast.classList.add('show');
    setTimeout(() => achievementToast.classList.remove('show'), 3000);
  }

  // ============================================
  // VIBRATION
  // ============================================

  function vibrate(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) {}
  }

  // ============================================
  // TEAM SELECT & GAME START
  // ============================================

  function buildTeamGrid() {
    const grid = $('teamGrid');
    grid.innerHTML = '';
    TEAM_IDS.forEach(id => {
      const team = TEAMS[id];
      const card = document.createElement('div');
      card.className = 'cb-team-card';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', team.name);
      card.style.background = `linear-gradient(160deg, ${team.primary} 0%, ${darkenColor(team.primary, 0.3)} 100%)`;
      card.dataset.team = id;

      // Jersey (shirt shape via CSS)
      const jersey = document.createElement('div');
      jersey.className = 'cb-team-jersey';
      jersey.style.setProperty('--jersey-stripe', team.secondary);
      // Build the shirt body via the ::before pseudo (set bg via inline)
      jersey.style.background = 'transparent';
      const jerseyInner = document.createElement('div');
      jerseyInner.style.cssText = `
        width: 100%; height: 100%;
        clip-path: polygon(15% 0%, 85% 0%, 100% 15%, 100% 100%, 0% 100%, 0% 15%);
        background: linear-gradient(180deg, ${team.primary} 0%, ${darkenColor(team.primary, 0.15)} 100%);
        border-radius: 0 0 4px 4px;
        position: relative;
      `;
      // V stripe as child
      const vStripe = document.createElement('div');
      vStripe.style.cssText = `
        position: absolute; top: 0; left: 50%;
        width: 0; height: 0;
        border-left: 10px solid transparent;
        border-right: 10px solid transparent;
        border-top: 16px solid ${team.secondary};
        transform: translateX(-50%);
      `;
      jerseyInner.appendChild(vStripe);
      jersey.appendChild(jerseyInner);

      // Team mascot name (e.g. "Mavericks")
      const name = document.createElement('div');
      name.className = 'cb-team-name';
      name.style.color = luminance(team.primary) > 0.55 ? '#000' : '#fff';
      name.textContent = team.name.split(' ')[1] || team.name;

      // City name
      const city = document.createElement('div');
      city.className = 'cb-team-city';
      city.textContent = team.city;

      card.appendChild(jersey);
      card.appendChild(name);
      card.appendChild(city);
      grid.appendChild(card);

      card.addEventListener('click', () => selectTeam(id));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectTeam(id);
        }
      });
    });
  }

  function selectTeam(id) {
    state.selectedTeam = id;
    playUISound('select');

    const team = TEAMS[id];

    // Update selection UI
    document.querySelectorAll('.cb-team-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.team === id);
    });

    const playBtn = $('playBtn');
    playBtn.disabled = false;
    playBtn.style.background = `linear-gradient(135deg, ${team.primary}, ${darkenColor(team.primary, 0.2)})`;
    playBtn.style.color = luminance(team.primary) > 0.55 ? '#000' : '#fff';
    playBtn.style.setProperty('--cb-team-primary', team.primary);
    document.documentElement.style.setProperty('--cb-team-primary', team.primary);
    document.documentElement.style.setProperty('--cb-team-secondary', team.secondary);
  }

  function startGame() {
    if (!state.selectedTeam) return;
    initAudio();
    resumeAudio();
    playUISound('confirm');

    // Pick opponent
    const others = TEAM_IDS.filter(id => id !== state.selectedTeam);
    state.opponentTeam = others[Math.floor(Math.random() * others.length)];

    // Track team played
    checkTeamsAchievement();

    // Reset state
    state.level = 1;
    state.target = getTarget(1);
    state.runs = 0;
    state.wickets = 0;
    state.totalBallsFaced = 0;
    state.ballsInOver = 0;
    state.oversCompleted = 0;
    state.fours = 0;
    state.sixes = 0;
    state.bestOverRuns = 0;
    state.currentOverRuns = 0;
    state.currentOverResults = [];
    state.consecutiveScoringBalls = 0;
    state.shotDirection = 'straight';
    state.particles = [];
    state.floatingTexts = [];
    state.postBallActive = false;
    state.stumpScatter = null;
    state.achievementsUnlocked = new Set();
    state.gameStartTime = Date.now();
    state.lastFrameTime = 0;
    state.newBatsmanAnim = false;
    state.batAnimating = false;
    state.bowlerAnimating = false;
    state.isPowerplay = true;
    state.crowdWaveActive = false;
    state.tensionActive = false;
    deliveryPhase = 'idle';
    deliveryTimer = 0;

    // Clear tension edge
    const tensionEdge = $('tensionEdge');
    if (tensionEdge) tensionEdge.classList.remove('active');

    titleOverlay.classList.remove('cb-visible');
    state.phase = 'PLAYING';
    gameWrap.classList.add('cb-playing');

    // Reinit crowd with team colors
    initCrowdDots();
    bgDirty = true;

    updateHUD();
    generateBowlerForOver();
    showBowlerIntro();
    setTimeout(() => startDelivery(), 1200);
  }

  function resetToTitle() {
    state.phase = 'TITLE';
    gameWrap.classList.remove('cb-playing');
    gameOverOverlay.classList.remove('cb-visible');
    levelOverlay.classList.remove('cb-visible');
    overOverlay.classList.remove('cb-visible');
    titleOverlay.classList.add('cb-visible');
    deliveryPhase = 'idle';
    state.ballActive = false;
    state.postBallActive = false;
    state.particles = [];
    state.floatingTexts = [];
    state.tensionActive = false;
    state.crowdWaveActive = false;
    const tensionEdge = $('tensionEdge');
    if (tensionEdge) tensionEdge.classList.remove('active');
    const ppBadge = $('powerplayBadge');
    if (ppBadge) ppBadge.classList.remove('show');

    // Show best score
    try {
      const best = localStorage.getItem('cricket-blitz-high-score');
      const bestLv = localStorage.getItem('cricket-blitz-best-level');
      const el = $('titleBest');
      if (best && el) el.textContent = `Best: ${best} pts (Lv.${bestLv || 1})`;
    } catch (e) {}
  }

  // ============================================
  // INPUT HANDLING
  // ============================================

  function handleSwing(direction) {
    if (state.phase !== 'PLAYING') return;
    if (deliveryPhase !== 'inflight') return;
    if (state.swingTriggered) return;

    initAudio();
    resumeAudio();

    if (direction) state.shotDirection = direction;
    state.swingTriggered = true;
    state.swingTime = deliveryTimer;
  }

  function setShotDirection(dir) {
    if (state.phase !== 'PLAYING') return;
    state.shotDirection = dir;
    updateHUD();
  }

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (state.phase === 'TITLE') {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!state.selectedTeam) {
          const sr = $('srAnnounce');
          if (sr) sr.textContent = 'Please select a team first.';
          return;
        }
        startGame();
      }
      return;
    }

    if (state.phase === 'BETWEEN_OVERS') {
      if (e.key === 'Enter') {
        e.preventDefault();
        window._cbNextOver();
      }
      return;
    }

    if (state.phase === 'LEVEL_COMPLETE') {
      if (e.key === 'Enter') {
        e.preventDefault();
        window._cbNextLevel();
      }
      return;
    }

    if (state.phase === 'GAME_OVER') {
      if (e.key === 'Enter') {
        e.preventDefault();
        window._cbPlayAgain();
      }
      return;
    }

    if (state.phase !== 'PLAYING') return;

    switch (e.key) {
      case ' ':
        e.preventDefault();
        handleSwing();
        break;
      case 'ArrowUp': case 'w': case 'W':
        e.preventDefault();
        setShotDirection('straight');
        break;
      case 'ArrowLeft': case 'a': case 'A':
        e.preventDefault();
        setShotDirection('pull');
        break;
      case 'ArrowRight': case 'd': case 'D':
        e.preventDefault();
        setShotDirection('cut');
        break;
      case 'ArrowDown': case 's': case 'S':
        e.preventDefault();
        setShotDirection('defense');
        break;
    }
  });

  // Touch zones
  function handleTouchZone(e) {
    e.preventDefault();
    if (state.phase !== 'PLAYING') return;
    const zone = e.currentTarget;
    const dir = zone.dataset.shot;
    handleSwing(dir);
  }

  document.querySelectorAll('.cb-touch-zone').forEach(zone => {
    zone.addEventListener('touchstart', handleTouchZone, { passive: false });
    zone.addEventListener('mousedown', (e) => {
      if (isTouchDevice) return;
      e.preventDefault();
      const dir = zone.dataset.shot;
      handleSwing(dir);
    });
  });

  // Detect touch device
  window.addEventListener('touchstart', () => {
    isTouchDevice = true;
  }, { once: true });

  // Canvas tap fallback (for mobile)
  fgCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    initAudio();
    resumeAudio();
  }, { passive: false });

  // ============================================
  // GAME LOOP
  // ============================================

  let animFrameId = null;

  function gameLoop(timestamp) {
    animFrameId = requestAnimationFrame(gameLoop);

    if (state.paused) return;

    const dt = state.lastFrameTime ? Math.min(0.05, (timestamp - state.lastFrameTime) / 1000) : 0.016;
    state.lastFrameTime = timestamp;

    if (bgDirty) drawBackground();
    updateDelivery(dt);
    drawForeground(dt);
  }

  // Visibility change (pause when tab hidden)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      state.paused = true;
    } else {
      state.paused = false;
      state.lastFrameTime = 0;
    }
  });

  // ============================================
  // HEADER INTEGRATION
  // ============================================

  let currentUser = null;
  let cloudState = null;

  function initHeader() {
    if (!window.gameHeader) return;
    window.gameHeader.init({
      title: 'Cricket Blitz',
      icon: '🏏',
      gameId: 'cricket-blitz',
      buttons: ['sound', 'leaderboard', 'auth'],
      onSound: () => {
        state.soundEnabled = !state.soundEnabled;
        if (masterGain) masterGain.gain.value = state.soundEnabled ? 0.3 : 0;
        try { localStorage.setItem('cricket-blitz-sound', state.soundEnabled); } catch (e) {}
      },
      onSignIn: async (user) => {
        currentUser = user;
        try {
          if (window.apiClient) {
            cloudState = await window.apiClient.loadState('cricket-blitz');
            await window.apiClient.syncGuestScores('cricket-blitz');
          }
        } catch (e) {}
      },
      onSignOut: () => { currentUser = null; cloudState = null; }
    });
  }

  // ============================================
  // UTILITY
  // ============================================

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function luminance(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  function darkenColor(hex, amount) {
    const r = Math.max(0, Math.round(parseInt(hex.slice(1, 3), 16) * (1 - amount)));
    const g = Math.max(0, Math.round(parseInt(hex.slice(3, 5), 16) * (1 - amount)));
    const b = Math.max(0, Math.round(parseInt(hex.slice(5, 7), 16) * (1 - amount)));
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
  }

  // ============================================
  // WINDOW API (for onclick handlers)
  // ============================================

  window._cbNextOver = function() {
    if (state.phase !== 'BETWEEN_OVERS') return;
    startNextOver();
  };

  window._cbNextLevel = function() {
    if (state.phase !== 'LEVEL_COMPLETE') return;
    startNextLevel();
  };

  window._cbPlayAgain = function() {
    resetToTitle();
  };

  window._cbShare = function() {
    try {
      const best = localStorage.getItem('cricket-blitz-high-score') || '0';
      const text = `I scored ${best} in Cricket Blitz! Can you beat it? Play at ${location.origin}/games/cricket-blitz/`;
      if (navigator.share) {
        navigator.share({ text });
      } else {
        navigator.clipboard.writeText(text);
        showAchievementToast('Copied!', 'Score shared to clipboard');
      }
    } catch (e) {}
  };

  window._cbInitHeader = initHeader;

  // ============================================
  // INIT
  // ============================================

  function init() {
    // Load sound preference
    try {
      const s = localStorage.getItem('cricket-blitz-sound');
      if (s === 'false') state.soundEnabled = false;
    } catch (e) {}

    // Resize
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // ResizeObserver for game container
    if (window.ResizeObserver) {
      new ResizeObserver(() => resizeCanvas()).observe(gameContainer);
    }

    // Build team select
    buildTeamGrid();

    // Show best score
    try {
      const best = localStorage.getItem('cricket-blitz-high-score');
      const bestLv = localStorage.getItem('cricket-blitz-best-level');
      const el = $('titleBest');
      if (best && el) el.textContent = `Best: ${best} pts (Lv.${bestLv || 1})`;
    } catch (e) {}

    // How to play toggle
    const htpBtn = $('howToPlayBtn');
    const htpPanel = $('howToPlay');
    if (htpBtn && htpPanel) {
      htpBtn.addEventListener('click', () => {
        htpPanel.classList.toggle('expanded');
        htpBtn.textContent = htpPanel.classList.contains('expanded') ? 'Hide Instructions' : 'How to Play';
      });
    }

    // Play button
    const playBtn = $('playBtn');
    if (playBtn) {
      playBtn.addEventListener('click', () => startGame());
    }

    // Init header
    if (window.gameHeader) {
      initHeader();
    } else {
      // Wait for header script to load
      const check = setInterval(() => {
        if (window.gameHeader) {
          clearInterval(check);
          initHeader();
        }
      }, 100);
      // Stop checking after 5s
      setTimeout(() => clearInterval(check), 5000);
    }

    // Draw initial background
    bgDirty = true;
    drawBackground();

    // Start game loop
    animFrameId = requestAnimationFrame(gameLoop);
  }

  // Run init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
