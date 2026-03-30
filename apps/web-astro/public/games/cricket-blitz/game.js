import * as THREE from 'three';

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

  const TEAM_ABBR = {
    'mumbai-mavericks': 'MUM',
    'chennai-cobras': 'CHE',
    'bangalore-blazers': 'BLR',
    'kolkata-knights': 'KOL',
    'delhi-dynamos': 'DEL',
    'hyderabad-hawks': 'HYD'
  };

  const TARGETS = [40, 55, 75, 100, 130];
  function getTarget(level) {
    if (level <= 5) return TARGETS[level - 1];
    return 130 + (level - 5) * 20;
  }

  const ACHIEVEMENTS = {
    'cb_first_four':       { name: 'Boundary Finder',     desc: 'Hit your first four',                       xp: 10 },
    'cb_first_six':        { name: 'Into the Stands',     desc: 'Hit your first six',                        xp: 25 },
    'cb_six_sixes':        { name: 'Six Machine',         desc: 'Hit 6 sixes in a single innings',           xp: 75 },
    'cb_fifty':            { name: 'Half Century',        desc: 'Score 50 runs in an innings',               xp: 50 },
    'cb_century':          { name: 'Centurion',           desc: 'Score 100 runs in an innings',              xp: 100 },
    'cb_no_wicket':        { name: 'Unbeatable',          desc: 'Complete innings without losing a wicket',  xp: 100 },
    'cb_perfect_over':     { name: 'Perfect Over',        desc: 'Score off every ball in an over',           xp: 50 },
    'cb_target_crushed':   { name: 'Target Crushed',      desc: 'Beat target with 10+ balls remaining',     xp: 75 },
    'cb_level_3':          { name: 'Rising Star',         desc: 'Reach level 3',                             xp: 50 },
    'cb_level_5':          { name: 'Cricket Legend',       desc: 'Reach level 5',                             xp: 100 },
    'cb_high_score_200':   { name: 'Double Century Club', desc: 'Achieve a final score of 200+',            xp: 150 },
    'cb_all_teams':        { name: 'Franchise Collector', desc: 'Play a game with each of the 6 teams',     xp: 50 },
    'cb_first_wicket':     { name: 'Wicket Taker',       desc: 'Take your first wicket while bowling',    xp: 15 },
    'cb_five_wickets':     { name: 'Five-For',           desc: 'Take 5 wickets in a bowling innings',     xp: 100 },
    'cb_full_match_win':   { name: 'Match Winner',       desc: 'Win a complete match (bat + bowl)',        xp: 75 },
    'cb_clean_sweep':      { name: 'Clean Sweep',        desc: 'Win by 30+ runs margin',                  xp: 100 },
    'cb_yorker_master':    { name: 'Yorker Master',      desc: 'Take 3 wickets with yorkers',             xp: 75 },
    'cb_death_over_six':   { name: 'Death Over Hero',    desc: 'Hit a six in the death over',             xp: 50 },
    'cb_in_the_zone':      { name: 'In The Zone',        desc: 'Reach 90+ confidence',                    xp: 75 },
    'cb_drs_hero':         { name: 'DRS Hero',           desc: 'Successfully overturn an LBW with DRS',  xp: 75 },
    'cb_run_out':          { name: 'Direct Hit',         desc: 'Get a run-out while bowling',            xp: 50 }
  };

  // Patch #19: Bat skins
  const BAT_SKINS = [
    { id: 'default', name: 'Classic', color: '#D4A87C', unlock: null },
    { id: 'golden', name: 'Golden', color: '#FFD700', unlock: 'cb_fifty' },
    { id: 'red', name: 'Red Devil', color: '#CC0000', unlock: 'cb_century' },
    { id: 'diamond', name: 'Diamond', color: '#00FFFF', unlock: 'cb_high_score_200' }
  ];

  function getUnlockedAchievements() {
    try {
      return JSON.parse(localStorage.getItem('cricket-blitz-achievements') || '[]');
    } catch (e) { return []; }
  }

  function saveAchievementToStorage(id) {
    try {
      const achs = getUnlockedAchievements();
      if (!achs.includes(id)) {
        achs.push(id);
        localStorage.setItem('cricket-blitz-achievements', JSON.stringify(achs));
      }
    } catch (e) {}
  }

  function getAvailableBatSkins() {
    const unlocked = getUnlockedAchievements();
    return BAT_SKINS.filter(s => !s.unlock || unlocked.includes(s.unlock));
  }

  function loadSelectedBatSkin() {
    try {
      const saved = localStorage.getItem('cricket-blitz-bat-skin');
      if (saved) {
        const skin = BAT_SKINS.find(s => s.id === saved);
        if (skin) {
          const available = getAvailableBatSkins();
          if (available.find(s => s.id === saved)) return skin.color;
        }
      }
    } catch (e) {}
    return '#D4A87C';
  }

  // Patch #18: Daily challenges
  const DAILY_CHALLENGES = [
    { id: 0, text: 'Score 50+ runs', check: (s) => s.battingScore >= 50 },
    { id: 1, text: 'Hit 4 sixes in one match', check: (s) => s.battingSixes >= 4 },
    { id: 2, text: 'Win without losing a wicket', check: (s) => s.battingWickets === 0 && s.bowlingAIScore < s.battingScore + 1 },
    { id: 3, text: 'Take 5 wickets while bowling', check: (s) => s.bowlingAIWickets >= 5 },
    { id: 4, text: 'Achieve a 5x combo streak', check: (s) => s._maxCombo >= 5 },
    { id: 5, text: 'Win by 20+ run margin', check: (s) => (s.battingScore - s.bowlingAIScore) >= 20 && s.bowlingAIScore < s.battingScore + 1 },
    { id: 6, text: 'Hit 8 boundaries (4s + 6s) in a match', check: (s) => (s.battingFours + s.battingSixes) >= 8 }
  ];

  function getTodaysChallenge() {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    return DAILY_CHALLENGES[dayOfYear % DAILY_CHALLENGES.length];
  }

  function getTodayDateStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function isDailyChallengeCompleted() {
    try {
      return localStorage.getItem('cricket-blitz-daily-' + getTodayDateStr()) === 'done';
    } catch (e) { return false; }
  }

  function completeDailyChallenge() {
    try {
      localStorage.setItem('cricket-blitz-daily-' + getTodayDateStr(), 'done');
    } catch (e) {}
  }

  // Patch #23: Login streak
  function loadLoginStreak() {
    try {
      const raw = localStorage.getItem('cricket-blitz-streak');
      if (raw) {
        const data = JSON.parse(raw);
        const today = getTodayDateStr();
        if (data.lastDate === today) {
          return data;
        }
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
        if (data.lastDate === yStr) {
          const newData = { count: data.count + 1, lastDate: today };
          localStorage.setItem('cricket-blitz-streak', JSON.stringify(newData));
          return newData;
        }
      }
      const newData = { count: 1, lastDate: getTodayDateStr() };
      localStorage.setItem('cricket-blitz-streak', JSON.stringify(newData));
      return newData;
    } catch (e) {
      return { count: 1, lastDate: getTodayDateStr() };
    }
  }

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

  // Extended commentary pools for new features
  COMMENTARY.wide = ["Wide ball! Easy runs for the batting side.", "That's a wide, poor line from the bowler."];
  COMMENTARY.noBall = ["NO BALL! Free hit coming up!", "Overstepped! That's a no-ball."];
  COMMENTARY.freeHit = ["FREE HIT! The batsman can swing freely!", "Free hit delivery - nothing to lose!"];
  COMMENTARY.lbw = ["LBW! Plumb in front of the stumps!", "That's out LBW! The umpire raises the finger."];
  COMMENTARY.superOver = ["SUPER OVER! This is incredible!", "We're going to a Super Over! The crowd is on its feet!"];
  COMMENTARY.caught_behind = ["Edge and taken! The keeper does the job!", "Thin edge, and the keeper pouches it!", "What a catch behind the stumps!"];
  COMMENTARY.stumped = ["Stumped! Quick work by the keeper!", "Out of his crease and stumped!", "Lightning reflexes from the keeper — STUMPED!"];
  COMMENTARY.runout = ["Direct hit! Run out!", "What a throw from the deep! He's gone!", "Run out! Brilliant fielding!", "Sharp throw and the bails are off — RUN OUT!"];
  COMMENTARY.pitch_crack = ["The pitch is starting to break up!", "Cracks appearing on the surface — this could get tricky for the batsmen.", "Variable bounce now — the pitch is deteriorating."];

  // Bowling commentary (AI batsman perspective)
  const BOWLING_COMMENTARY = {
    dot: [
      "Beaten! Superb delivery.",
      "Dot ball. That's tight bowling!",
      "Defended cautiously. No run.",
      "Left alone outside off stump."
    ],
    single: [
      "Pushed for a quick single.",
      "Tapped to the leg side, one run.",
      "Nudged to mid-wicket, easy single."
    ],
    two: [
      "Driven through the gap for two!",
      "Worked to the deep, they run two."
    ],
    four: [
      "FOUR! Hammered through the covers!",
      "Boundary! Too short and punished!",
      "FOUR! Racing to the rope!",
      "Cut away for FOUR! Expensive delivery."
    ],
    six: [
      "SIX! Launched into the stands!",
      "HUGE SIX! That's gone miles!",
      "SIX! Dispatched with disdain!",
      "MASSIVE! The AI batsman is on top!"
    ],
    wicket: [
      "OUT! What a delivery!",
      "GONE! Brilliant bowling!",
      "Wicket! A crucial breakthrough!",
      "OUT! The batsman has to walk!"
    ],
    runout: [
      "Direct hit from the field! Run out!",
      "Great throw, run out! The AI batsman is short of the crease!",
      "RUN OUT! Superb fielding effort!"
    ]
  };

  // AI batsman outcome tables: [dot, 1, 2, 4, 6, WICKET]
  const AI_PROB_PERFECT = [40, 25, 15, 5, 0, 15];
  const AI_PROB_GOOD    = [25, 25, 20, 15, 5, 10];
  const AI_PROB_BAD     = [5, 10, 15, 30, 25, 15];

  const DELIVERY_TYPES = ['straight', 'inswing', 'outswing', 'bouncer', 'yorker', 'slower'];
  const DELIVERY_LABELS = {
    straight: 'Straight',
    inswing: 'Inswing',
    outswing: 'Outswing',
    bouncer: 'Bouncer',
    yorker: 'Yorker',
    slower: 'Slower Ball'
  };
  const DELIVERY_KEYS_NUM = { '1': 'straight', '2': 'inswing', '3': 'outswing', '4': 'bouncer', '5': 'yorker', '6': 'slower' };
  const DELIVERY_KEYS_QWERTY = { 'q': 'straight', 'w': 'inswing', 'e': 'outswing', 'a': 'bouncer', 's': 'yorker', 'd': 'slower' };

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
    tensionActive: false,

    // ---- Bowling innings state ----
    matchPhase: 'batting',        // 'batting' | 'bowling'
    battingScore: 0,
    battingWickets: 0,
    battingFours: 0,
    battingSixes: 0,
    bowlingAIScore: 0,
    bowlingAIWickets: 0,
    bowlingOversCompleted: 0,
    bowlingBallsInOver: 0,
    bowlingTotalBalls: 0,
    bowlingCurrentOverRuns: 0,
    bowlingCurrentOverResults: [],
    selectedDelivery: 'straight',
    selectedLine: 'middle',       // 'off', 'middle', 'leg'
    meterActive: false,
    meterPosition: 0,             // 0-1, oscillates
    meterStopped: false,
    meterDirection: 1,
    deliveryTypeHistory: [],      // track types for repetition penalty
    bowlingDeliveryPhase: 'selecting', // 'selecting' | 'meter' | 'bowling' | 'result'
    bowlingResultTimer: 0,
    yorkerWickets: 0,
    bowlingWides: 0,
    bowlingNoBalls: 0,
    bowlingExtras: 0,
    battingExtras: 0,
    freeHitNext: false,
    bowlingDeliveryRepeatCount: {},  // track per-over delivery type counts
    tossResult: null,     // 'won' | 'lost'
    tossChoice: null,     // 'bat' | 'bowl'
    battingFirst: true,   // true = player bats first (default)
    superOver: false,
    superOverPhase: null, // 'batting' | 'bowling' | null
    superOverPlayerScore: 0,
    superOverAIScore: 0,
    superOverBalls: 0,
    superOverWickets: 0,
    superOverAIWickets: 0,
    superOverBowlingBalls: 0,
    bowlingBestOverRuns: 0,
    lastTwoDeliveryFast: false,

    // Combo streak
    comboStreak: 0,
    _maxCombo: 0,

    // Camera shake
    cameraShakeTime: 0,
    cameraShakeIntensity: 0,

    // Gesture controls
    gestureDirection: null,
    gestureConfirmed: false,

    // Ball approach sound
    ballApproachActive: false,

    // Daily challenge
    dailyChallengeCompleted: false,
    dailyChallengeId: 0,

    // Login streak
    loginStreak: { count: 0, lastDate: '' },

    // Bat skin
    selectedBatSkin: '#D4A87C',

    // Visual overhaul state
    crowdJumpTime: 0,
    crowdFlashTimer: 0,
    batCelebration: false,
    batCelebrationTimer: 0,

    // Phase 1 Realism Features
    keeperCatchAnim: false,
    keeperCatchAnimStart: 0,
    confidence: 50,
    bowlerConsecutiveSameType: 0,
    lastDeliveryType: null,
    wagonWheelShots: [],
    overRunHistory: [],
    matchPhaseLabel: 'POWERPLAY',
    matchPhaseColor: '#FFD700',

    // Phase 2 Realism Features
    drsAvailable: true,
    pendingLBW: false,
    pendingOutcome: null,
    drsTimeout: null,
    pitchDeteriorated: false,
    pitchCracks: [],
    timeoutAvailable: true,
    timeoutUsed: false
  };

  // ============================================
  // DOM REFS
  // ============================================

  const $ = (id) => document.getElementById(id);
  const gameContainer = $('gameContainer');
  const gameWrap = $('gameWrap');

  // HUD -- TV scoreboard refs
  const scoreboardBat = $('scoreboardBat');
  const scoreboardBowl = $('scoreboardBowl');
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

  // Bowling UI refs (may be null until DOM ready)
  let bowlingPanel, bowlingMeter, bowlingMeterFill, bowlingMeterIndicator;
  let bowlingLineIndicators;
  let inningsBreakOverlay, inningsBreakModal;
  let matchResultOverlay, matchResultModal;

  // ============================================
  // THREE.JS SCENE SETUP
  // ============================================

  let renderer, scene, camera;
  let W = 0, H = 0;
  let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let isTouchDevice = false;

  // Scene object references
  let ground, pitchStrip, boundaryRope;
  let creaseLineBatsman, creaseLineBowler;
  let batsmanGroup, bowlerGroup, ballMesh, ballShadow, ballSeam;
  let batsmanBody, batsmanHelmet, batsmanVisor, batsmanLegL, batsmanLegR, batGroup, batHandle, batBlade, batHighlight;
  let bowlerBody, bowlerHead, bowlerLegL, bowlerLegR, bowlerArm, bowlerBallInHand;
  let stumpsGroup, stumpMeshes = [], bailMeshes = [];
  let stumpsGroupFar, stumpMeshesFar = [], bailMeshesFar = [];
  let crowdMesh, floodlightGroups = [];
  let sweetSpotLine;
  let standsMesh;

  // AI batsman (far end, for bowling view)
  let aiBatsmanGroup, aiBatsmanBody, aiBatsmanHelmet, aiBatGroup;
  // Bowling view bowler (player's bowler, near camera)
  let playerBowlerGroup, playerBowlerBody, playerBowlerArm, playerBowlerBallInHand;
  // Bowling ball (travels away from camera)
  let bowlingBallMesh, bowlingBallSeam, bowlingBallShadow;

  // Keeper references (for catch-behind animation)
  let keeperGroupRef, keeperGloveL, keeperGloveR;

  // Scatter physics for stumps
  let scatterStumps = [];
  let scatterBails = [];

  // Visual overhaul: dust particles, ball trail, batsman shadow, floodlight cones
  let dustParticles = null;
  let dustVelocities = [];
  let ballTrailPool = [];
  let ballTrailIndex = 0;
  let ballTrailFrame = 0;
  let batsmanShadow = null;

  // Ball tracking system — records path, draws post-delivery line
  let ballTrackingPositions = []; // array of Vector3 recorded during flight
  let ballTrackingLine = null; // THREE.Line mesh
  let ballTrackingTimer = 0; // fade timer
  let crowdOriginalY = null;

  // Post-ball 3D object
  let postBallMesh;

  // Particle pool (3D)
  const MAX_PARTICLES = 150;
  let particlePool = [];
  let particleMeshes = [];

  // Camera animation state
  let cameraTarget = new THREE.Vector3(0, 0.5, 12);
  let cameraPos = new THREE.Vector3(0, 6, -8);
  let cameraShake = { active: false, start: 0, duration: 400, intensity: 0.08 };

  function initThreeScene() {
    // Renderer
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x87CEEB, 1);

    const container = $('threeContainer');
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'Cricket Blitz 3D game field. Use keyboard controls to play.');
    renderer.domElement.setAttribute('role', 'application');
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x87CEEB, 0.003);

    // Sky dome
    (function buildSkyDome() {
      const skyGeo = new THREE.SphereGeometry(200, 32, 32);
      // Custom shader for gradient sky
      const skyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {},
        vertexShader: `
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPos.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vWorldPosition;
          void main() {
            float height = normalize(vWorldPosition).y;
            // Below horizon: green treeline
            vec3 belowHorizon = vec3(0.227, 0.541, 0.180);
            // Horizon: hazy blue-white
            vec3 horizon = vec3(0.722, 0.831, 0.890);
            // Middle: sky blue
            vec3 midSky = vec3(0.529, 0.808, 0.922);
            // Top: bright blue
            vec3 topSky = vec3(0.290, 0.624, 0.851);

            vec3 color;
            if (height < 0.0) {
              color = belowHorizon;
            } else if (height < 0.08) {
              float t = height / 0.08;
              color = mix(horizon, midSky, t);
            } else if (height < 0.3) {
              float t = (height - 0.08) / 0.22;
              color = mix(midSky, topSky, t);
            } else {
              color = topSky;
            }
            gl_FragColor = vec4(color, 1.0);
          }
        `
      });
      const skyDome = new THREE.Mesh(skyGeo, skyMat);
      skyDomeMesh = skyDome;
      scene.add(skyDome);

      // Sun disc
      const sunGeo = new THREE.SphereGeometry(3, 16, 16);
      const sunMat = new THREE.MeshBasicMaterial({ color: 0xFFF8E0, transparent: true, opacity: 0.8 });
      const sunMesh = new THREE.Mesh(sunGeo, sunMat);
      sunMesh.position.set(50, 40, -30);
      scene.add(sunMesh);

      // Lens flare glow plane near sun
      const flareGeo = new THREE.PlaneGeometry(12, 12);
      const flareMat = new THREE.MeshBasicMaterial({ color: 0xFFF8E0, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false });
      const flareMesh = new THREE.Mesh(flareGeo, flareMat);
      flareMesh.position.copy(sunMesh.position);
      scene.add(flareMesh);
      // Make flare always face camera in render loop via onBeforeRender
      flareMesh.onBeforeRender = function(renderer, scene, camera) {
        flareMesh.quaternion.copy(camera.quaternion);
      };
    })();

    // Camera
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
    camera.position.set(0, 4, -5);
    camera.lookAt(0, 0.8, 12);

    // Lighting — daytime sunlight
    const ambient = new THREE.AmbientLight(0x8EC8E8, 0.6);
    ambientLight = ambient;
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xFFF5E0, 1.0);
    dirLight.position.set(20, 30, -10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.far = 100;
    dirLight.shadow.camera.left = -40;
    dirLight.shadow.camera.right = 40;
    dirLight.shadow.camera.top = 40;
    dirLight.shadow.camera.bottom = -40;
    dirLightRef = dirLight;
    scene.add(dirLight);

    // Build stadium
    buildGround();
    buildPitch();
    buildBoundary();
    buildStands();
    buildFloodlights();
    buildCrowd();
    buildSightScreen();
    buildScoreboard3D();
    buildPitchDust();

    // Build players
    buildBatsman();
    buildBowler();
    buildBall();
    buildStumps();
    buildSweetSpot();
    buildFielders();
    buildUmpiresAndKeeper();
    buildSweetSpotRing();

    // Patch #21: Advertising boards along boundary
    buildAdBoards();

    // Visual overhaul additions
    buildDustParticles();
    buildBallTrail();
    buildBatsmanShadow();
    buildFloodlightCones();

    // Post-ball mesh
    const pbGeo = new THREE.SphereGeometry(0.22, 12, 8);
    const pbMat = new THREE.MeshPhongMaterial({ color: 0xcc0000 });
    postBallMesh = new THREE.Mesh(pbGeo, pbMat);
    postBallMesh.visible = false;
    scene.add(postBallMesh);

    // Particle meshes pool
    const pGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.visible = false;
      scene.add(pMesh);
      particleMeshes.push(pMesh);
    }

    handleResize();
  }

  function handleResize() {
    W = gameContainer.clientWidth;
    H = gameContainer.clientHeight;
    if (!renderer) return;
    renderer.setSize(W, H);
    camera.aspect = W / H;

    // Landscape: widen FOV for better pitch view, Portrait: narrower for focus
    const isLandscape = W > H;
    camera.fov = isLandscape ? 50 : 60;
    camera.updateProjectionMatrix();

    // Toggle landscape class on game wrap for CSS HUD adjustments
    gameWrap.classList.toggle('cb-landscape', isLandscape);
  }

  // ---- Ground ----
  function buildGround() {
    // Base dark green ground
    const baseGeo = new THREE.CircleGeometry(85, 64);
    const baseMat = new THREE.MeshLambertMaterial({ color: 0x2d8a1e });
    ground = new THREE.Mesh(baseGeo, baseMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Mowed stripes on outfield (NOT on pitch — stripes run perpendicular to pitch)
    for (let i = -8; i <= 8; i++) {
      if (i % 2 === 0) continue;
      const stripeGeo = new THREE.PlaneGeometry(170, 8);
      const stripeMat = new THREE.MeshLambertMaterial({
        color: 0x45b535,
        transparent: true,
        opacity: 0.25
      });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.rotation.z = Math.PI / 2; // perpendicular to pitch
      stripe.position.set(i * 8, 0.005, 11);
      scene.add(stripe);
    }

    // Boundary rope (thick tube along circle)
    const curve = new THREE.EllipseCurve(0, 11, 78, 78, 0, Math.PI * 2);
    const points = curve.getPoints(128).map(function(p) { return new THREE.Vector3(p.x, 0.1, p.y); });
    const ropePath = new THREE.CatmullRomCurve3(points, true);
    const ropeGeo = new THREE.TubeGeometry(ropePath, 128, 0.3, 6);
    const ropeMat = new THREE.MeshBasicMaterial({ color: 0xCC0000 });
    const rope = new THREE.Mesh(ropeGeo, ropeMat);
    scene.add(rope);

    // 30-yard circle
    const innerCurve = new THREE.EllipseCurve(0, 11, 30, 30, 0, Math.PI * 2);
    const innerPts = innerCurve.getPoints(64).map(function(p) { return new THREE.Vector3(p.x, 0.02, p.y); });
    const innerPath = new THREE.CatmullRomCurve3(innerPts, true);
    const innerGeo = new THREE.TubeGeometry(innerPath, 64, 0.05, 3);
    const innerMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.3 });
    scene.add(new THREE.Mesh(innerGeo, innerMat));
  }

  // ---- Pitch Strip ----
  function buildPitch() {
    const geo = new THREE.PlaneGeometry(3.5, 22);
    const mat = new THREE.MeshLambertMaterial({ color: 0xB07040 });
    pitchStrip = new THREE.Mesh(geo, mat);
    pitchStrip.rotation.x = -Math.PI / 2;
    pitchStrip.position.set(0, 0.01, 11);
    scene.add(pitchStrip);

    // Pitch texture dots — dense worn clay look with varied colors
    const dotColors = [0x8a5530, 0x6a4020, 0x8a5530, 0x6a4020, 0x7a4828];
    for (let i = 0; i < 120; i++) {
      const dotGeo = new THREE.PlaneGeometry(0.05 + Math.random() * 0.04, 0.05 + Math.random() * 0.04);
      const dotMat = new THREE.MeshBasicMaterial({ color: dotColors[i % dotColors.length], transparent: true, opacity: 0.25 + Math.random() * 0.15 });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(
        (Math.random() - 0.5) * 3.2,
        0.015,
        11 + (Math.random() - 0.5) * 20
      );
      scene.add(dot);
    }

    // Return crease lines (short perpendicular lines at each end)
    const rcGeo = new THREE.BoxGeometry(0.06, 0.02, 1.2);
    const rcMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    // Batsman end return creases
    const rcBatL = new THREE.Mesh(rcGeo, rcMat);
    rcBatL.position.set(-0.6, 0.02, 1.0);
    scene.add(rcBatL);
    const rcBatR = new THREE.Mesh(rcGeo, rcMat);
    rcBatR.position.set(0.6, 0.02, 1.0);
    scene.add(rcBatR);
    // Bowler end return creases
    const rcBowlL = new THREE.Mesh(rcGeo, rcMat);
    rcBowlL.position.set(-0.6, 0.02, 21.0);
    scene.add(rcBowlL);
    const rcBowlR = new THREE.Mesh(rcGeo, rcMat);
    rcBowlR.position.set(0.6, 0.02, 21.0);
    scene.add(rcBowlR);

    // Crease box markings at batsman's end (rectangular outline around stumps)
    const cBoxMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
    // Front line (popping crease is already buildCreaseLine at z=1.5)
    // Back line of the box
    const cBoxBack = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.02, 0.05), cBoxMat);
    cBoxBack.position.set(0, 0.02, 0.3);
    scene.add(cBoxBack);
    // Left side of box
    const cBoxLeft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 1.25), cBoxMat);
    cBoxLeft.position.set(-0.7, 0.02, 0.9);
    scene.add(cBoxLeft);
    // Right side of box
    const cBoxRight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 1.25), cBoxMat);
    cBoxRight.position.set(0.7, 0.02, 0.9);
    scene.add(cBoxRight);
    // Front of box (connects to popping crease area)
    const cBoxFront = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.02, 0.05), cBoxMat);
    cBoxFront.position.set(0, 0.02, 1.5);
    scene.add(cBoxFront);

    // Worn patches where bowlers land (z = 16-19 area)
    const wornGeo = new THREE.CircleGeometry(0.12, 8);
    const wornMat = new THREE.MeshLambertMaterial({ color: 0x7a4828, transparent: true, opacity: 0.2 });
    const wornPositions = [
      { x: 0.2, z: 16.5 }, { x: -0.3, z: 17.2 },
      { x: 0.1, z: 18.0 }, { x: -0.15, z: 17.8 }
    ];
    wornPositions.forEach(function(pos) {
      const patch = new THREE.Mesh(wornGeo, wornMat);
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(pos.x, 0.015, pos.z);
      scene.add(patch);
    });
  }

  // ---- Crease Lines ----
  function buildCreaseLine(z, width) {
    const geo = new THREE.BoxGeometry(width, 0.02, 0.06);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
    const line = new THREE.Mesh(geo, mat);
    line.position.set(0, 0.02, z);
    scene.add(line);
    return line;
  }

  // ---- Boundary Rope (now rendered as tube in buildGround; keep ref for code compat) ----
  function buildBoundary() {
    // Boundary rope is now built inside buildGround() as a 3D tube.
    // Create a hidden placeholder so boundaryRope ref doesn't break.
    const geo = new THREE.RingGeometry(78, 79, 64);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, side: THREE.DoubleSide });
    boundaryRope = new THREE.Mesh(geo, mat);
    boundaryRope.rotation.x = -Math.PI / 2;
    boundaryRope.position.y = 0.02;
    scene.add(boundaryRope);
  }

  // ---- Stands / Crowd Wall ----
  function buildStands() {
    // 4 tiers of stepped stands going up
    const tierColors = [0x3a3a5e, 0x444468, 0x4e4e72, 0x58587c];
    const innerRadius = 82;

    for (var tier = 0; tier < 4; tier++) {
      var r = innerRadius + tier * 3;
      var h = 3;
      var y = tier * 3 + 1.5;

      // Each tier is a ring
      var tGeo = new THREE.CylinderGeometry(r + 2, r, h, 64, 1, true);
      var tMat = new THREE.MeshLambertMaterial({
        color: tierColors[tier],
        side: THREE.BackSide
      });
      var tMesh = new THREE.Mesh(tGeo, tMat);
      tMesh.position.set(0, y, 11);
      scene.add(tMesh);

      if (tier === 0) standsMesh = tMesh; // keep ref

      // Seat rows on top of each tier
      var seatCount = 40;
      for (var s = 0; s < seatCount; s++) {
        var angle = (s / seatCount) * Math.PI * 2;
        var seatX = Math.sin(angle) * (r + 1);
        var seatZ = Math.cos(angle) * (r + 1) + 11;
        var seatY = y + h / 2;

        var seatGeo = new THREE.BoxGeometry(1.5, 0.5, 1);
        var isHomeSection = (s % 8) < 5;
        var seatColor = isHomeSection ?
          (state.selectedTeam ? TEAMS[state.selectedTeam].primary : '#004BA0') :
          (state.opponentTeam ? TEAMS[state.opponentTeam].primary : '#CC0000');
        var seatMat = new THREE.MeshLambertMaterial({
          color: new THREE.Color(seatColor).multiplyScalar(0.6)
        });
        var seat = new THREE.Mesh(seatGeo, seatMat);
        seat.position.set(seatX, seatY, seatZ);
        seat.rotation.y = angle + Math.PI;
        scene.add(seat);
      }
    }

    // Roof canopy over top tier
    var roofGeo = new THREE.RingGeometry(innerRadius + 8, innerRadius + 16, 64);
    var roofMat = new THREE.MeshLambertMaterial({
      color: 0x666688,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    var roof = new THREE.Mesh(roofGeo, roofMat);
    roof.rotation.x = -Math.PI / 2.2;
    roof.position.set(0, 14, 11);
    scene.add(roof);
  }

  // ---- Crowd (colored dots as sprites on the stands) ----
  function buildCrowd() {
    const count = 1500;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 80 + Math.random() * 2; // tighter packing (80-82 vs fixed 81)
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = 1 + Math.random() * 10;
      positions[i * 3 + 2] = 11 + Math.sin(angle) * r;

      const color = new THREE.Color(randomCrowdColor());
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.6,
      vertexColors: true,
      sizeAttenuation: true
    });

    crowdMesh = new THREE.Points(geo, mat);
    scene.add(crowdMesh);

    // Store original Y positions for jump animation
    crowdOriginalY = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      crowdOriginalY[i] = positions[i * 3 + 1];
    }
  }

  function updateCrowdColors() {
    if (!crowdMesh) return;
    const colors = crowdMesh.geometry.getAttribute('color');
    // Patch #17: More energetic crowd during bowling
    // Feature 6: Scale crowd swaps by match pressure
    const pressureNow = getMatchPressure();
    const pressureSwapBonus = Math.floor(pressureNow / 10);
    const baseCrowdSwaps = (state.matchPhase === 'bowling' ? 16 : 8) + pressureSwapBonus;
    const count = Math.min(baseCrowdSwaps, colors.count);
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * colors.count);
      const c = new THREE.Color(randomCrowdColor());
      colors.setXYZ(idx, c.r, c.g, c.b);
    }

    if (state.crowdWaveActive) {
      const waveElapsed = (Date.now() - state.crowdWaveStart) / 1000;
      if (waveElapsed > 2) {
        state.crowdWaveActive = false;
      } else {
        const positions = crowdMesh.geometry.getAttribute('position');
        const waveAngle = waveElapsed * Math.PI;
        const team = state.selectedTeam ? TEAMS[state.selectedTeam] : null;
        const waveColor = new THREE.Color(team ? team.secondary : '#FFD700');
        for (let i = 0; i < colors.count; i++) {
          const x = positions.getX(i);
          const z = positions.getZ(i) - 11;
          const angle = Math.atan2(z, x);
          if (Math.abs(angle - waveAngle) < 0.3) {
            colors.setXYZ(i, waveColor.r, waveColor.g, waveColor.b);
          }
        }
      }
    }

    if (state.tensionActive) {
      const extra = Math.min(15, colors.count);
      for (let i = 0; i < extra; i++) {
        const idx = Math.floor(Math.random() * colors.count);
        const c = new THREE.Color(randomCrowdColor());
        colors.setXYZ(idx, c.r, c.g, c.b);
      }
    }

    // Camera flash effect: every 2 seconds, flash 1-2 random dots white
    state.crowdFlashTimer += 16; // approx frame ms
    if (state.crowdFlashTimer > 2000) {
      state.crowdFlashTimer = 0;
      const flashCount = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < flashCount; i++) {
        const idx = Math.floor(Math.random() * colors.count);
        colors.setXYZ(idx, 1, 1, 1); // flash white
      }
    }

    // Crowd jump on boundaries (4 or 6)
    if (state.crowdJumpTime > 0 && crowdOriginalY) {
      const positions = crowdMesh.geometry.getAttribute('position');
      const jumpT = state.crowdJumpTime;
      for (let i = 0; i < positions.count; i++) {
        const phase = i * 0.01; // slight offset per dot
        const jumpY = Math.sin((jumpT + phase) * Math.PI * 4) * 0.3;
        positions.setY(i, crowdOriginalY[i] + Math.max(0, jumpY));
      }
      positions.needsUpdate = true;
      state.crowdJumpTime -= 0.016;
      if (state.crowdJumpTime <= 0) {
        state.crowdJumpTime = 0;
        // Reset Y positions
        for (let i = 0; i < positions.count; i++) {
          positions.setY(i, crowdOriginalY[i]);
        }
        positions.needsUpdate = true;
      }
    }

    colors.needsUpdate = true;
  }

  function randomCrowdColor() {
    const team = state.selectedTeam ? TEAMS[state.selectedTeam] : null;
    const r = Math.random();
    if (team && r < 0.4) return team.primary;
    if (team && r < 0.55) return team.secondary;
    const bright = ['#FF4444','#44FF44','#4444FF','#FFFF44','#FF44FF','#44FFFF','#FFFFFF','#FFD700','#FF6B00'];
    return bright[Math.floor(Math.random() * bright.length)];
  }

  // ---- Floodlights ----
  function buildFloodlights() {
    const positions = [
      [-40, 0, -20],
      [40, 0, -20],
      [-40, 0, 42],
      [40, 0, 42]
    ];
    positions.forEach(pos => {
      const group = new THREE.Group();
      // Tower pole
      const poleGeo = new THREE.BoxGeometry(0.3, 20, 0.3);
      const poleMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 10;
      group.add(pole);

      // Light box
      const boxGeo = new THREE.BoxGeometry(1.5, 0.5, 1.5);
      const boxMat = new THREE.MeshBasicMaterial({ color: 0xffffe0, transparent: true, opacity: 0.8 });
      const box = new THREE.Mesh(boxGeo, boxMat);
      box.position.y = 20.5;
      group.add(box);

      // Spot light
      const spot = new THREE.SpotLight(0xfff5e0, 0.3, 100, Math.PI / 6, 0.5, 1);
      spot.position.set(0, 20.5, 0);
      spot.target.position.set(0, 0, 11);
      group.add(spot);
      group.add(spot.target);

      group.position.set(pos[0], pos[1], pos[2]);
      scene.add(group);
      floodlightGroups.push(group);
    });
  }

  // ---- Dust Particles in Floodlight Beams ----
  function buildDustParticles() {
    const count = 50;
    const positions = new Float32Array(count * 3);
    dustVelocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = 5 + Math.random() * 10;
      positions[i * 3 + 2] = 11 + (Math.random() - 0.5) * 60;
      dustVelocities.push({
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.05,
        vz: (Math.random() - 0.5) * 0.2
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.08,
      transparent: true,
      opacity: 0.3,
      sizeAttenuation: true
    });
    dustParticles = new THREE.Points(geo, mat);
    scene.add(dustParticles);
  }

  function updateDustParticles(dt) {
    if (!dustParticles) return;
    const positions = dustParticles.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const v = dustVelocities[i];
      let x = positions.getX(i) + v.vx * dt * 10;
      let y = positions.getY(i) + v.vy * dt * 10;
      let z = positions.getZ(i) + v.vz * dt * 10;
      // Wrap around if too far
      if (x > 40) x = -40;
      if (x < -40) x = 40;
      if (z > 41) z = -19;
      if (z < -19) z = 41;
      if (y > 15) y = 5;
      if (y < 5) y = 15;
      positions.setXYZ(i, x, y, z);
    }
    positions.needsUpdate = true;
  }

  // ---- Ball Trail ----
  function buildBallTrail() {
    const trailGeo = new THREE.SphereGeometry(0.05, 6, 4);
    for (let i = 0; i < 20; i++) {
      const trailMat = new THREE.MeshBasicMaterial({
        color: 0xcc0000,
        transparent: true,
        opacity: 0
      });
      const mesh = new THREE.Mesh(trailGeo, trailMat);
      mesh.visible = false;
      mesh.userData.life = 0;
      mesh.userData.maxLife = 0.5;
      scene.add(mesh);
      ballTrailPool.push(mesh);
    }
  }

  function updateBallTrail(dt) {
    // Spawn trail spheres during ball flight
    if (state.ballActive && state.phase === 'BATTING') {
      ballTrailFrame++;
      if (ballTrailFrame % 3 === 0 && ballMesh.visible) {
        const trail = ballTrailPool[ballTrailIndex % 20];
        trail.position.copy(ballMesh.position);
        trail.visible = true;
        trail.scale.setScalar(1);
        trail.userData.life = 0.5;
        // Gold trail on six potential (lofted shots)
        if (state.shotDirection === 'straight') {
          trail.material.color.setHex(0xFFD700);
          trail.material.opacity = 0.7;
        } else {
          trail.material.color.setHex(0xcc0000);
          trail.material.opacity = 0.4;
        }
        trail.userData.maxLife = 0.5;
        ballTrailIndex++;
      }
    } else {
      ballTrailFrame = 0;
    }

    // Update existing trail spheres
    for (let i = 0; i < ballTrailPool.length; i++) {
      const trail = ballTrailPool[i];
      if (trail.userData.life > 0) {
        trail.userData.life -= dt;
        const t = Math.max(0, trail.userData.life / trail.userData.maxLife);
        trail.material.opacity = t * 0.4;
        trail.scale.setScalar(t);
        if (trail.userData.life <= 0) {
          trail.visible = false;
        }
      }
    }
  }

  // ---- Ball Tracking Line (post-delivery path visualization) ----
  function showBallTrackingLine(outcome) {
    clearBallTrackingLine();
    if (ballTrackingPositions.length < 3) { ballTrackingPositions = []; return; }

    // Determine line color based on outcome
    let color = 0xFFFFFF; // default white
    if (outcome.runs === -1) {
      // Wicket — red line
      color = outcome.type === 'lbw' ? 0xFF4444 : 0xFF0000;
    } else if (outcome.runs >= 4) {
      color = 0xFFD700; // boundary — gold
    } else if (outcome.runs === 0) {
      color = 0x888888; // dot — grey
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(ballTrackingPositions);
    const material = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.8,
      linewidth: 2
    });
    ballTrackingLine = new THREE.Line(geometry, material);
    scene.add(ballTrackingLine);

    // Add pitch point (where ball bounced) — bright dot at ~60% of path
    const bounceIdx = Math.floor(ballTrackingPositions.length * 0.6);
    if (bounceIdx < ballTrackingPositions.length) {
      const bouncePos = ballTrackingPositions[bounceIdx];
      const dotGeo = new THREE.CircleGeometry(0.1, 8);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0x00DDFF, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(bouncePos.x, 0.02, bouncePos.z);
      dot.userData.isTrackingDot = true;
      scene.add(dot);
    }

    // Impact point (where ball reached batsman) — last position
    const impactPos = ballTrackingPositions[ballTrackingPositions.length - 1];
    const impGeo = new THREE.CircleGeometry(0.08, 8);
    const impColor = outcome.runs === -1 ? 0xFF0000 : 0x00FF00;
    const impMat = new THREE.MeshBasicMaterial({ color: impColor, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    const impDot = new THREE.Mesh(impGeo, impMat);
    impDot.rotation.x = -Math.PI / 2;
    impDot.position.set(impactPos.x, 0.02, impactPos.z);
    impDot.userData.isTrackingDot = true;
    scene.add(impDot);

    // Auto-clear after 1.5 seconds
    ballTrackingTimer = 1.5;
    ballTrackingPositions = [];
  }

  function clearBallTrackingLine() {
    if (ballTrackingLine) {
      scene.remove(ballTrackingLine);
      ballTrackingLine.geometry.dispose();
      ballTrackingLine.material.dispose();
      ballTrackingLine = null;
    }
    // Remove tracking dots
    const toRemove = [];
    scene.children.forEach(c => { if (c.userData && c.userData.isTrackingDot) toRemove.push(c); });
    toRemove.forEach(c => scene.remove(c));
    ballTrackingTimer = 0;
  }

  function updateBallTracking(dt) {
    if (ballTrackingTimer > 0) {
      ballTrackingTimer -= dt;
      // Fade out the line
      if (ballTrackingLine && ballTrackingLine.material) {
        ballTrackingLine.material.opacity = Math.max(0, ballTrackingTimer / 1.5) * 0.8;
      }
      if (ballTrackingTimer <= 0) {
        clearBallTrackingLine();
      }
    }
  }

  // ---- Batsman Ground Shadow ----
  function buildBatsmanShadow() {
    const geo = new THREE.CircleGeometry(0.4, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.3
    });
    batsmanShadow = new THREE.Mesh(geo, mat);
    batsmanShadow.rotation.x = -Math.PI / 2;
    batsmanShadow.position.set(0, 0.01, 0.2);
    scene.add(batsmanShadow);
  }

  function updateBatsmanShadow() {
    if (batsmanShadow && batsmanGroup) {
      batsmanShadow.position.x = batsmanGroup.position.x;
      batsmanShadow.position.z = batsmanGroup.position.z;
    }
  }

  // ---- Floodlight Beam Cones ----
  function buildFloodlightCones() {
    const floodPositions = [
      [-40, 0, -20],
      [40, 0, -20],
      [-40, 0, 42],
      [40, 0, 42]
    ];
    floodPositions.forEach(pos => {
      const coneGeo = new THREE.ConeGeometry(15, 30, 8);
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0xfff5e0,
        transparent: true,
        opacity: 0.03
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      // Position cone at top of floodlight, pointing downward
      cone.position.set(pos[0], 20.5 - 15, pos[2]);
      cone.rotation.x = Math.PI; // flip upside down (pointing down)
      scene.add(cone);
    });
  }

  // ---- Sweet Spot ----
  function buildSweetSpot() {
    const geo = new THREE.BoxGeometry(4, 0.02, 0.08);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00DDFF, transparent: true, opacity: 0 });
    sweetSpotLine = new THREE.Mesh(geo, mat);
    sweetSpotLine.position.set(0, 0.03, 1.5);
    scene.add(sweetSpotLine);
  }

  // ---- Sweet Spot Ring (pulsing timing guide) ----
  // Patch #17: Sky/lighting refs for environment variety
  let skyDomeMesh, ambientLight, dirLightRef;

  function setTwilightEnvironment() {
    if (skyDomeMesh) {
      skyDomeMesh.material = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {},
        vertexShader: `
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPos.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vWorldPosition;
          void main() {
            float height = normalize(vWorldPosition).y;
            vec3 horizon = vec3(0.6, 0.2, 0.05);
            vec3 warmGlow = vec3(0.8, 0.35, 0.1);
            vec3 midSky = vec3(0.3, 0.1, 0.25);
            vec3 topSky = vec3(0.08, 0.05, 0.18);
            vec3 color;
            if (height < 0.0) { color = horizon; }
            else if (height < 0.1) { color = mix(horizon, warmGlow, height / 0.1); }
            else if (height < 0.25) { color = mix(warmGlow, midSky, (height - 0.1) / 0.15); }
            else { color = mix(midSky, topSky, clamp((height - 0.25) / 0.5, 0.0, 1.0)); }
            gl_FragColor = vec4(color, 1.0);
          }
        `
      });
    }
    if (dirLightRef) {
      dirLightRef.color.set(0xffaa55);
      dirLightRef.intensity = 0.8;
    }
    if (ambientLight) {
      ambientLight.color.set(0x605040);
      ambientLight.intensity = 0.6;
    }
    if (scene && scene.fog) {
      scene.fog = new THREE.FogExp2(0x1a0a0e, 0.005);
    }
  }

  function setNightEnvironment() {
    if (skyDomeMesh) {
      skyDomeMesh.material = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {},
        vertexShader: `
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPos.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vWorldPosition;
          void main() {
            float height = normalize(vWorldPosition).y;
            vec3 horizon = vec3(0.05, 0.12, 0.04);
            vec3 warmGlow = vec3(0.14, 0.10, 0.04);
            vec3 midSky = vec3(0.04, 0.086, 0.157);
            vec3 topSky = vec3(0.02, 0.05, 0.1);
            vec3 color;
            if (height < 0.0) { color = horizon; }
            else if (height < 0.08) { color = mix(horizon, warmGlow, height / 0.08); }
            else if (height < 0.2) { color = mix(warmGlow, midSky, (height - 0.08) / 0.12); }
            else { color = mix(midSky, topSky, clamp((height - 0.2) / 0.6, 0.0, 1.0)); }
            gl_FragColor = vec4(color, 1.0);
          }
        `
      });
    }
    if (dirLightRef) {
      dirLightRef.color.set(0xfff5e0);
      dirLightRef.intensity = 0.7;
    }
    if (ambientLight) {
      ambientLight.color.set(0x404060);
      ambientLight.intensity = 0.5;
    }
    if (scene && scene.fog) {
      scene.fog = new THREE.FogExp2(0x0a1628, 0.006);
    }
  }

  function setDayEnvironment() {
    if (skyDomeMesh) {
      skyDomeMesh.material = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {},
        vertexShader: `
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPos.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vWorldPosition;
          void main() {
            float height = normalize(vWorldPosition).y;
            vec3 belowHorizon = vec3(0.227, 0.541, 0.180);
            vec3 horizon = vec3(0.722, 0.831, 0.890);
            vec3 midSky = vec3(0.529, 0.808, 0.922);
            vec3 topSky = vec3(0.290, 0.624, 0.851);
            vec3 color;
            if (height < 0.0) { color = belowHorizon; }
            else if (height < 0.08) { color = mix(horizon, midSky, height / 0.08); }
            else if (height < 0.3) { color = mix(midSky, topSky, (height - 0.08) / 0.22); }
            else { color = topSky; }
            gl_FragColor = vec4(color, 1.0);
          }
        `
      });
    }
    if (dirLightRef) {
      dirLightRef.color.set(0xFFF5E0);
      dirLightRef.intensity = 1.0;
      dirLightRef.position.set(20, 30, -10);
    }
    if (ambientLight) {
      ambientLight.color.set(0x8EC8E8);
      ambientLight.intensity = 0.6;
    }
    if (scene && scene.fog) {
      scene.fog = new THREE.FogExp2(0x87CEEB, 0.003);
    }
  }

  let sweetSpotRing;
  function buildSweetSpotRing() {
    const geo = new THREE.CircleGeometry(0.3, 32);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00DDFF, transparent: true, opacity: 0, side: THREE.DoubleSide });
    sweetSpotRing = new THREE.Mesh(geo, mat);
    sweetSpotRing.rotation.x = -Math.PI / 2;
    sweetSpotRing.position.set(0, 0.03, 1.0);
    scene.add(sweetSpotRing);
  }

  // ---- Patch #21: Advertising Boards ----
  function createAdBoardTexture(text, bgColor, textColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 256, 64);
    // Border
    ctx.strokeStyle = textColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 254, 62);
    // Text
    ctx.fillStyle = textColor;
    ctx.font = 'bold 18px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  function buildAdBoards() {
    const boardGeo = new THREE.BoxGeometry(8, 2.5, 0.2);
    const brandTexts = [
      { text: 'WEEKLY ARCADE', bg: '#1a0a3e', fg: '#FFD700' },
      { text: 'CRICKET BLITZ', bg: '#FFD700', fg: '#1a0a3e' },
      { text: 'WEEKLY ARCADE', bg: '#CC0000', fg: '#FFFFFF' },
      { text: 'PLAY FREE', bg: '#004BA0', fg: '#FFFFFF' },
      { text: 'WEEKLY ARCADE', bg: '#1a0a3e', fg: '#FFD700' },
      { text: 'CRICKET BLITZ', bg: '#FF6B00', fg: '#FFFFFF' },
      { text: 'WEEKLY ARCADE', bg: '#FFFFFF', fg: '#1a0a3e' },
      { text: '13+ GAMES', bg: '#3B0051', fg: '#FFD700' },
      { text: 'WEEKLY ARCADE', bg: '#1a0a3e', fg: '#FFD700' },
      { text: 'CRICKET BLITZ', bg: '#E8000D', fg: '#FFFFFF' },
      { text: 'WEEKLY ARCADE', bg: '#2d8a1e', fg: '#FFFFFF' },
      { text: 'NO DOWNLOAD', bg: '#004BA0', fg: '#FFD700' },
    ];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const brand = brandTexts[i];
      const texture = createAdBoardTexture(brand.text, brand.bg, brand.fg);
      const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
      const board = new THREE.Mesh(boardGeo, mat);
      board.position.set(Math.sin(angle) * 79, 1.25, Math.cos(angle) * 79 + 11);
      board.rotation.y = angle + Math.PI;
      scene.add(board);
    }
  }

  // ---- Sight Screen (white screen behind bowler's end) ----
  function buildSightScreen() {
    // Branded sight screen instead of plain white
    const sCanvas = document.createElement('canvas');
    sCanvas.width = 256; sCanvas.height = 192;
    const sCtx = sCanvas.getContext('2d');
    sCtx.fillStyle = '#1a0a3e';
    sCtx.fillRect(0, 0, 256, 192);
    sCtx.strokeStyle = '#FFD700'; sCtx.lineWidth = 3;
    sCtx.strokeRect(4, 4, 248, 184);
    sCtx.fillStyle = '#FFD700';
    sCtx.font = 'bold 22px -apple-system, sans-serif';
    sCtx.textAlign = 'center';
    sCtx.fillText('WEEKLY', 128, 70);
    sCtx.fillText('ARCADE', 128, 100);
    sCtx.fillStyle = 'rgba(255,255,255,0.4)';
    sCtx.font = '14px sans-serif';
    sCtx.fillText('🏏 CRICKET BLITZ', 128, 140);
    const sTexture = new THREE.CanvasTexture(sCanvas);
    const screenGeo = new THREE.BoxGeometry(5, 4, 0.3);
    const screenMat = new THREE.MeshBasicMaterial({ map: sTexture });
    const sightScreen = new THREE.Mesh(screenGeo, screenMat);
    sightScreen.position.set(0, 3, 75);
    scene.add(sightScreen);
  }

  // ---- 3D Scoreboard Structure ----
  function buildScoreboard3D() {
    // Create TV screen with Weekly Arcade branding
    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 512;
    screenCanvas.height = 256;
    const sCtx = screenCanvas.getContext('2d');
    // Dark gradient background
    const grad = sCtx.createLinearGradient(0, 0, 512, 256);
    grad.addColorStop(0, '#0a0520');
    grad.addColorStop(1, '#1a0a3e');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 512, 256);
    // Border
    sCtx.strokeStyle = '#FFD700';
    sCtx.lineWidth = 4;
    sCtx.strokeRect(4, 4, 504, 248);
    // Title
    sCtx.fillStyle = '#FFD700';
    sCtx.font = 'bold 36px -apple-system, sans-serif';
    sCtx.textAlign = 'center';
    sCtx.fillText('WEEKLY ARCADE', 256, 80);
    // Subtitle
    sCtx.fillStyle = '#FFFFFF';
    sCtx.font = 'bold 24px -apple-system, sans-serif';
    sCtx.fillText('CRICKET BLITZ', 256, 120);
    // URL
    sCtx.fillStyle = 'rgba(255,255,255,0.5)';
    sCtx.font = '16px -apple-system, sans-serif';
    sCtx.fillText('weeklyarcade.games', 256, 160);
    // Cricket emoji
    sCtx.font = '48px sans-serif';
    sCtx.fillText('🏏', 256, 220);

    const screenTexture = new THREE.CanvasTexture(screenCanvas);
    const boardGeo = new THREE.BoxGeometry(12, 6, 0.5);
    const boardMat = new THREE.MeshBasicMaterial({ map: screenTexture });
    const scoreboard3D = new THREE.Mesh(boardGeo, boardMat);
    scoreboard3D.position.set(30, 8, 60);
    scoreboard3D.rotation.y = -0.3;
    scene.add(scoreboard3D);
    // Gold border frame
    const borderGeo = new THREE.BoxGeometry(12.4, 6.4, 0.3);
    const borderMat = new THREE.MeshBasicMaterial({ color: 0xFFD700 });
    const border = new THREE.Mesh(borderGeo, borderMat);
    border.position.copy(scoreboard3D.position);
    border.position.z += 0.2;
    border.rotation.y = scoreboard3D.rotation.y;
    scene.add(border);
  }

  // ---- Ground Dust Particles (near pitch) ----
  let pitchDustParticles = null;
  let pitchDustVelocities = [];
  function buildPitchDust() {
    const count = 30;
    const positions = new Float32Array(count * 3);
    pitchDustVelocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = 0.1 + Math.random() * 0.4;
      positions[i * 3 + 2] = 11 + (Math.random() - 0.5) * 20;
      pitchDustVelocities.push({
        vx: (Math.random() - 0.5) * 0.1,
        vy: (Math.random() - 0.5) * 0.02,
        vz: (Math.random() - 0.5) * 0.1
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xC4A87C,
      size: 0.03,
      transparent: true,
      opacity: 0.2,
      sizeAttenuation: true
    });
    pitchDustParticles = new THREE.Points(geo, mat);
    scene.add(pitchDustParticles);
  }

  function updatePitchDust(dt) {
    if (!pitchDustParticles) return;
    const positions = pitchDustParticles.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const v = pitchDustVelocities[i];
      let x = positions.getX(i) + v.vx * dt * 10;
      let y = positions.getY(i) + v.vy * dt * 10;
      let z = positions.getZ(i) + v.vz * dt * 10;
      if (Math.abs(x) > 10) x = (Math.random() - 0.5) * 10;
      if (y > 0.5) y = 0.1;
      if (y < 0.1) y = 0.5;
      if (Math.abs(z - 11) > 10) z = 11 + (Math.random() - 0.5) * 10;
      positions.setXYZ(i, x, y, z);
    }
    positions.needsUpdate = true;
  }

  // ---- Fielders ----
  const FIELDER_POSITIONS = [
    { x: -15, z: 10 },   // mid-wicket
    { x: 15, z: 10 },    // cover
    { x: -25, z: 5 },    // square leg
    { x: 25, z: 5 },     // point
    { x: 0, z: 30 },     // long-on
    { x: -20, z: 25 }    // deep mid-wicket
  ];
  let fielderMeshes = [];

  function buildFielders() {
    const skinColor = 0xdba67a;
    FIELDER_POSITIONS.forEach(pos => {
      const group = new THREE.Group();

      // Body (cricket whites torso)
      const bodyGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 6);
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.6;
      group.add(body);

      // Head
      const headGeo = new THREE.SphereGeometry(0.1, 8, 6);
      const headMat = new THREE.MeshLambertMaterial({ color: skinColor });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 1.0;
      group.add(head);

      // Legs
      const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.3, 4);
      const legMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });
      const legL = new THREE.Mesh(legGeo, legMat);
      legL.position.set(-0.06, 0.15, 0);
      group.add(legL);
      const legR = new THREE.Mesh(legGeo, legMat);
      legR.position.set(0.06, 0.15, 0);
      group.add(legR);

      group.position.set(pos.x, 0, pos.z);
      scene.add(group);
      fielderMeshes.push(group);
    });
  }

  // ---- Umpires + Wicketkeeper ----
  function buildUmpiresAndKeeper() {
    const skinColor = 0xdba67a;

    // Helper to build a simple figure
    function buildFigure(shirtColor, hatColor, position, rotationY) {
      const group = new THREE.Group();

      // Legs
      const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.35, 4);
      const legMat = new THREE.MeshLambertMaterial({ color: 0x222222 }); // dark trousers
      const legL = new THREE.Mesh(legGeo, legMat);
      legL.position.set(-0.06, 0.18, 0);
      group.add(legL);
      const legR = new THREE.Mesh(legGeo, legMat);
      legR.position.set(0.06, 0.18, 0);
      group.add(legR);

      // Body
      const bodyGeo = new THREE.CylinderGeometry(0.14, 0.12, 0.5, 6);
      const bodyMat = new THREE.MeshLambertMaterial({ color: shirtColor });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.6;
      group.add(body);

      // Arms
      const armGeo = new THREE.CylinderGeometry(0.035, 0.03, 0.35, 4);
      const armMat = new THREE.MeshLambertMaterial({ color: shirtColor });
      const armL = new THREE.Mesh(armGeo, armMat);
      armL.position.set(-0.18, 0.55, 0);
      armL.rotation.z = 0.15;
      group.add(armL);
      const armR = new THREE.Mesh(armGeo, armMat);
      armR.position.set(0.18, 0.55, 0);
      armR.rotation.z = -0.15;
      group.add(armR);

      // Head
      const headGeo = new THREE.SphereGeometry(0.1, 8, 6);
      const headMat = new THREE.MeshLambertMaterial({ color: skinColor });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 0.95;
      group.add(head);

      // Wide-brim sun hat (IPL umpire style)
      const brimGeo = new THREE.CylinderGeometry(0.18, 0.2, 0.03, 12);
      const brimMat = new THREE.MeshLambertMaterial({ color: hatColor });
      const brim = new THREE.Mesh(brimGeo, brimMat);
      brim.position.y = 1.03;
      group.add(brim);
      const crownGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.08, 8);
      const crownMat = new THREE.MeshLambertMaterial({ color: hatColor });
      const crown = new THREE.Mesh(crownGeo, crownMat);
      crown.position.y = 1.08;
      group.add(crown);

      group.position.copy(position);
      if (rotationY) group.rotation.y = rotationY;
      scene.add(group);
      return group;
    }

    // Bowler's end umpire — IPL style: navy blue shirt, navy hat, black trousers
    buildFigure(
      0x1a1a6b,   // navy blue polo shirt (IPL umpire)
      0x1a1a4e,   // navy wide-brim hat
      new THREE.Vector3(1.5, 0, 20.5),  // behind bowler's stumps, offset right
      Math.PI     // facing toward batsman
    );

    // Square leg umpire — IPL style: navy blue shirt, navy hat
    buildFigure(
      0x1a1a6b,   // navy blue polo shirt
      0x1a1a4e,   // navy wide-brim hat
      new THREE.Vector3(-6, 0, 1.5),    // square leg, near batsman's end
      Math.PI / 2 // facing the pitch sideways
    );

    // Wicketkeeper — crouches behind batsman's stumps
    const keeperGroup = new THREE.Group();

    // Keeper legs (crouched — shorter, bent)
    const kLegGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.25, 4);
    const kLegMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }); // white pads
    const kLegL = new THREE.Mesh(kLegGeo, kLegMat);
    kLegL.position.set(-0.07, 0.12, 0);
    kLegL.rotation.x = 0.4; // bent forward (crouching)
    keeperGroup.add(kLegL);
    const kLegR = new THREE.Mesh(kLegGeo, kLegMat);
    kLegR.position.set(0.07, 0.12, 0);
    kLegR.rotation.x = 0.4;
    keeperGroup.add(kLegR);

    // Keeper body (crouched — lower, leaned forward)
    const kBodyGeo = new THREE.CylinderGeometry(0.13, 0.11, 0.4, 6);
    const kBodyMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }); // whites
    const kBody = new THREE.Mesh(kBodyGeo, kBodyMat);
    kBody.position.y = 0.4;
    kBody.rotation.x = 0.3; // leaning forward
    keeperGroup.add(kBody);

    // Keeper gloves (big, positioned in front)
    const gloveGeo = new THREE.SphereGeometry(0.07, 6, 4);
    const gloveMat = new THREE.MeshLambertMaterial({ color: 0xFFD700 }); // yellow gloves
    const gloveL = new THREE.Mesh(gloveGeo, gloveMat);
    gloveL.position.set(-0.15, 0.35, -0.2);
    keeperGroup.add(gloveL);
    const gloveR = new THREE.Mesh(gloveGeo, gloveMat);
    gloveR.position.set(0.15, 0.35, -0.2);
    keeperGroup.add(gloveR);

    // Keeper helmet
    const kHelmetGeo = new THREE.SphereGeometry(0.12, 8, 6);
    const kHelmetMat = new THREE.MeshLambertMaterial({ color: 0x333366 }); // dark blue helmet
    const kHelmet = new THREE.Mesh(kHelmetGeo, kHelmetMat);
    kHelmet.position.y = 0.65;
    kHelmet.scale.set(1, 0.85, 1);
    keeperGroup.add(kHelmet);

    // Position keeper behind batsman's stumps
    keeperGroup.position.set(0, 0, -0.3); // behind the stumps (lower z = closer to camera)
    keeperGroup.rotation.y = Math.PI; // facing toward bowler
    scene.add(keeperGroup);

    // Store references for keeper catch animation
    keeperGroupRef = keeperGroup;
    keeperGloveL = gloveL;
    keeperGloveR = gloveR;
  }

  // Bowling fielder positions (around AI batsman's end, visible from bowling camera)
  const BOWLING_FIELDER_POSITIONS = [
    { x: -12, z: 5 },    // mid-wicket (near batsman)
    { x: 12, z: 5 },     // cover
    { x: -20, z: -5 },   // square leg (behind batsman from bowling view)
    { x: 20, z: -5 },    // point
    { x: -8, z: 12 },    // mid-on
    { x: 8, z: 12 }      // mid-off
  ];

  function updateFielderColors() {
    if (!fielderMeshes.length) return;
    const isBowling = state.phase === 'BOWLING' || state.matchPhase === 'bowling';
    const fieldingTeamId = isBowling ? state.selectedTeam : state.opponentTeam;
    const fieldingTeam = fieldingTeamId ? TEAMS[fieldingTeamId] : null;
    const color = new THREE.Color(fieldingTeam ? fieldingTeam.primary : '#666666');
    fielderMeshes.forEach(function(group, i) {
      if (group.children && group.children[0]) {
        group.children[0].material.color.copy(color);
      }
    });
  }

  function repositionFielders(isBowling) {
    if (!fielderMeshes.length) return;
    const positions = isBowling ? BOWLING_FIELDER_POSITIONS : FIELDER_POSITIONS;
    fielderMeshes.forEach(function(group, i) {
      if (i < positions.length) {
        group.position.set(positions[i].x, 0, positions[i].z);
        group.visible = true;
      }
    });
  }

  // ---- Batsman ----
  function buildBatsman() {
    batsmanGroup = new THREE.Group();
    batsmanGroup.position.set(0, 0, 1.8);

    const teamColor = 0x004BA0;
    const skinColor = 0xD2A87C;
    const flat = { flatShading: true };

    // --- Shoes ---
    const shoeGeo = new THREE.BoxGeometry(0.1, 0.04, 0.14);
    const shoeMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0, ...flat });
    const soleGeo = new THREE.BoxGeometry(0.1, 0.015, 0.14);
    const soleMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    const shoeL = new THREE.Mesh(shoeGeo, shoeMat);
    shoeL.position.set(-0.12, 0.03, -0.13);
    const soleL = new THREE.Mesh(soleGeo, soleMat);
    soleL.position.y = -0.02;
    shoeL.add(soleL);
    batsmanGroup.add(shoeL);
    const shoeR = new THREE.Mesh(shoeGeo, shoeMat);
    shoeR.position.set(0.12, 0.03, 0.08);
    const soleR = new THREE.Mesh(soleGeo, soleMat);
    soleR.position.y = -0.02;
    shoeR.add(soleR);
    batsmanGroup.add(shoeR);

    // --- Legs with Pads ---
    // Left leg (front foot, forward)
    const thighGeoL = new THREE.CylinderGeometry(0.07, 0.06, 0.3, 8);
    const thighMatL = new THREE.MeshLambertMaterial({ color: teamColor, ...flat });
    batsmanLegL = new THREE.Group();
    batsmanLegL.position.set(-0.12, 0.45, -0.15);
    const thighL = new THREE.Mesh(thighGeoL, thighMatL);
    thighL.position.y = 0;
    batsmanLegL.add(thighL);
    // Pad
    const padGeo = new THREE.BoxGeometry(0.12, 0.3, 0.08);
    const padMat = new THREE.MeshLambertMaterial({ color: 0xf5f5f0, ...flat });
    const padL = new THREE.Mesh(padGeo, padMat);
    padL.position.set(0, -0.2, 0.01);
    batsmanLegL.add(padL);
    // Pad ridge (raised center detail)
    const padRidgeGeo = new THREE.BoxGeometry(0.04, 0.28, 0.02);
    const padRidgeMat = new THREE.MeshLambertMaterial({ color: 0xeeeee0 });
    const padRidgeL = new THREE.Mesh(padRidgeGeo, padRidgeMat);
    padRidgeL.position.set(0, -0.2, 0.04);
    batsmanLegL.add(padRidgeL);
    batsmanLegL.rotation.x = THREE.MathUtils.degToRad(12);
    batsmanGroup.add(batsmanLegL);

    // Right leg (back foot)
    batsmanLegR = new THREE.Group();
    batsmanLegR.position.set(0.12, 0.45, 0.1);
    const thighR = new THREE.Mesh(thighGeoL.clone(), thighMatL.clone());
    batsmanLegR.add(thighR);
    const padR = new THREE.Mesh(padGeo.clone(), padMat.clone());
    padR.position.set(0, -0.2, 0.01);
    batsmanLegR.add(padR);
    const padRidgeR = new THREE.Mesh(padRidgeGeo.clone(), padRidgeMat.clone());
    padRidgeR.position.set(0, -0.2, 0.04);
    batsmanLegR.add(padRidgeR);
    batsmanLegR.rotation.x = THREE.MathUtils.degToRad(-10);
    batsmanGroup.add(batsmanLegR);

    // --- Torso (LatheGeometry for organic shape) ---
    const torsoPoints = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.18, 0),
      new THREE.Vector2(0.2, 0.15),
      new THREE.Vector2(0.22, 0.3),
      new THREE.Vector2(0.2, 0.4),
      new THREE.Vector2(0.15, 0.45),
      new THREE.Vector2(0, 0.45),
    ];
    const torsoGeo = new THREE.LatheGeometry(torsoPoints, 12);
    const bodyMat = new THREE.MeshLambertMaterial({ color: teamColor, ...flat });
    batsmanBody = new THREE.Mesh(torsoGeo, bodyMat);
    batsmanBody.position.y = 0.6;
    batsmanBody.rotation.x = THREE.MathUtils.degToRad(10);
    batsmanBody.castShadow = true;
    batsmanGroup.add(batsmanBody);

    // Team stripe across chest
    const stripeGeo = new THREE.BoxGeometry(0.44, 0.06, 0.44);
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.set(0, 0.88, -0.02);
    stripe.rotation.x = THREE.MathUtils.degToRad(10);
    batsmanGroup.add(stripe);

    // --- Left Arm (resting at side, slight bend) ---
    const upperArmGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.25, 8);
    const sleeveMatL = new THREE.MeshLambertMaterial({ color: teamColor, ...flat });
    const forearmGeo = new THREE.CylinderGeometry(0.04, 0.035, 0.22, 8);
    const forearmMat = new THREE.MeshLambertMaterial({ color: skinColor, ...flat });
    const gloveGeo = new THREE.SphereGeometry(0.04, 8, 6);
    const gloveMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });

    const shoulderL = new THREE.Group();
    shoulderL.position.set(-0.22, 0.98, -0.02);
    shoulderL.rotation.z = THREE.MathUtils.degToRad(18);
    shoulderL.rotation.x = THREE.MathUtils.degToRad(10);
    const upperArmL = new THREE.Mesh(upperArmGeo, sleeveMatL);
    upperArmL.position.y = -0.12;
    shoulderL.add(upperArmL);
    const elbowL = new THREE.Group();
    elbowL.position.set(0, -0.25, 0);
    elbowL.rotation.x = THREE.MathUtils.degToRad(-25);
    const forearmL = new THREE.Mesh(forearmGeo, forearmMat);
    forearmL.position.y = -0.11;
    elbowL.add(forearmL);
    const gloveL = new THREE.Mesh(gloveGeo, gloveMat);
    gloveL.position.y = -0.22;
    elbowL.add(gloveL);
    shoulderL.add(elbowL);
    batsmanGroup.add(shoulderL);

    // --- Right Arm (bat arm, drawn back in ready position) ---
    const sleeveMatR = new THREE.MeshLambertMaterial({ color: teamColor, ...flat });
    const shoulderR = new THREE.Group();
    shoulderR.position.set(0.22, 0.98, -0.02);
    shoulderR.rotation.z = THREE.MathUtils.degToRad(-20);
    shoulderR.rotation.x = THREE.MathUtils.degToRad(25);
    const upperArmR = new THREE.Mesh(upperArmGeo.clone(), sleeveMatR);
    upperArmR.position.y = -0.12;
    shoulderR.add(upperArmR);
    const elbowR = new THREE.Group();
    elbowR.position.set(0, -0.25, 0);
    elbowR.rotation.x = THREE.MathUtils.degToRad(-30);
    const forearmR = new THREE.Mesh(forearmGeo.clone(), forearmMat.clone());
    forearmR.position.y = -0.11;
    elbowR.add(forearmR);
    const gloveR = new THREE.Mesh(gloveGeo.clone(), gloveMat.clone());
    gloveR.position.y = -0.22;
    elbowR.add(gloveR);
    shoulderR.add(elbowR);
    batsmanGroup.add(shoulderR);

    // --- Neck ---
    const neckGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.08, 8);
    const neckMat = new THREE.MeshLambertMaterial({ color: skinColor });
    const neck = new THREE.Mesh(neckGeo, neckMat);
    neck.position.y = 1.1;
    batsmanGroup.add(neck);

    // --- Helmet ---
    const helmGeo = new THREE.SphereGeometry(0.2, 12, 8);
    const helmMat = new THREE.MeshLambertMaterial({ color: teamColor, ...flat });
    batsmanHelmet = new THREE.Mesh(helmGeo, helmMat);
    batsmanHelmet.position.y = 1.28;
    batsmanHelmet.scale.set(1, 0.85, 1);
    batsmanGroup.add(batsmanHelmet);

    // Visor
    const visorGeo = new THREE.BoxGeometry(0.35, 0.04, 0.15);
    const visorMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    batsmanVisor = new THREE.Mesh(visorGeo, visorMat);
    batsmanVisor.position.set(0, 1.2, -0.16);
    batsmanGroup.add(batsmanVisor);

    // Face guard (3 vertical bars)
    const guardBarGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.12, 4);
    const guardBarMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    for (let i = -1; i <= 1; i++) {
      const bar = new THREE.Mesh(guardBarGeo, guardBarMat);
      bar.position.set(i * 0.05, 1.14, -0.2);
      batsmanGroup.add(bar);
    }

    // --- Bat (ExtrudeGeometry for proper blade shape) ---
    batGroup = new THREE.Group();
    batGroup.position.set(0.3, 1.2, 0);

    // Bat handle (rubber grip)
    const handleGeo = new THREE.CylinderGeometry(0.015, 0.018, 0.25, 8);
    const handleMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
    batHandle = new THREE.Mesh(handleGeo, handleMat);
    batHandle.position.y = -0.12;
    batGroup.add(batHandle);

    // Bat blade (ExtrudeGeometry for proper cricket bat shape)
    const batShape = new THREE.Shape();
    batShape.moveTo(-0.04, 0);
    batShape.lineTo(-0.06, 0.3);
    batShape.lineTo(-0.06, 0.4);
    batShape.lineTo(-0.02, 0.45);
    batShape.lineTo(0.02, 0.45);
    batShape.lineTo(0.06, 0.4);
    batShape.lineTo(0.06, 0.3);
    batShape.lineTo(0.04, 0);
    batShape.closePath();
    const batExtrudeSettings = { depth: 0.03, bevelEnabled: false };
    const bladeGeo = new THREE.ExtrudeGeometry(batShape, batExtrudeSettings);
    const bladeMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(state.selectedBatSkin), ...flat });
    batBlade = new THREE.Mesh(bladeGeo, bladeMat);
    batBlade.position.set(0, -0.7, -0.015);
    batBlade.rotation.x = Math.PI;
    batGroup.add(batBlade);

    // Blade highlight (lighter face strip)
    const highlightShape = new THREE.Shape();
    highlightShape.moveTo(-0.02, 0.05);
    highlightShape.lineTo(-0.03, 0.3);
    highlightShape.lineTo(-0.03, 0.38);
    highlightShape.lineTo(0.03, 0.38);
    highlightShape.lineTo(0.03, 0.3);
    highlightShape.lineTo(0.02, 0.05);
    highlightShape.closePath();
    const highlightGeo = new THREE.ExtrudeGeometry(highlightShape, { depth: 0.005, bevelEnabled: false });
    const highlightMat = new THREE.MeshLambertMaterial({ color: 0xe8c888 });
    batHighlight = new THREE.Mesh(highlightGeo, highlightMat);
    batHighlight.position.set(0, -0.7, -0.02);
    batHighlight.rotation.x = Math.PI;
    batGroup.add(batHighlight);

    // Default bat angle (batting stance)
    batGroup.rotation.z = THREE.MathUtils.degToRad(-30);

    batsmanGroup.add(batGroup);
    scene.add(batsmanGroup);
  }

  // ---- Bowler ----
  function buildBowler() {
    bowlerGroup = new THREE.Group();
    bowlerGroup.position.set(0, 0, 20);

    const skinColor = 0xD2A87C;
    const oppColor = 0x666666;
    const flat = { flatShading: true };

    // --- Shoes ---
    const shoeGeo = new THREE.BoxGeometry(0.09, 0.04, 0.13);
    const shoeMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0, ...flat });
    const soleGeo = new THREE.BoxGeometry(0.09, 0.015, 0.13);
    const soleMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    const shoeL = new THREE.Mesh(shoeGeo, shoeMat);
    shoeL.position.set(-0.1, 0.03, -0.28);
    const soleL = new THREE.Mesh(soleGeo, soleMat);
    soleL.position.y = -0.02;
    shoeL.add(soleL);
    bowlerGroup.add(shoeL);
    const shoeR = new THREE.Mesh(shoeGeo.clone(), shoeMat.clone());
    shoeR.position.set(0.1, 0.03, 0.22);
    const soleR = new THREE.Mesh(soleGeo.clone(), soleMat.clone());
    soleR.position.y = -0.02;
    shoeR.add(soleR);
    bowlerGroup.add(shoeR);

    // --- Legs (running delivery stride) ---
    const thighGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.28, 8);
    const thighMat = new THREE.MeshLambertMaterial({ color: oppColor, ...flat });
    const padGeo = new THREE.BoxGeometry(0.1, 0.26, 0.07);
    const padMat = new THREE.MeshLambertMaterial({ color: 0xf5f5f0, ...flat });

    // Front leg (extended far forward)
    bowlerLegL = new THREE.Group();
    bowlerLegL.position.set(-0.1, 0.42, -0.15);
    const bThighL = new THREE.Mesh(thighGeo, thighMat);
    bowlerLegL.add(bThighL);
    const bPadL = new THREE.Mesh(padGeo, padMat);
    bPadL.position.set(0, -0.18, 0.01);
    bowlerLegL.add(bPadL);
    bowlerLegL.rotation.x = THREE.MathUtils.degToRad(25);
    bowlerGroup.add(bowlerLegL);

    // Back leg (extended far back, pushing off)
    bowlerLegR = new THREE.Group();
    bowlerLegR.position.set(0.1, 0.42, 0.12);
    const bThighR = new THREE.Mesh(thighGeo.clone(), thighMat.clone());
    bowlerLegR.add(bThighR);
    const bPadR = new THREE.Mesh(padGeo.clone(), padMat.clone());
    bPadR.position.set(0, -0.18, 0.01);
    bowlerLegR.add(bPadR);
    bowlerLegR.rotation.x = THREE.MathUtils.degToRad(-20);
    bowlerGroup.add(bowlerLegR);

    // --- Torso (LatheGeometry, leaning forward more for delivery stride) ---
    const torsoPoints = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.16, 0),
      new THREE.Vector2(0.18, 0.12),
      new THREE.Vector2(0.2, 0.28),
      new THREE.Vector2(0.18, 0.38),
      new THREE.Vector2(0.13, 0.42),
      new THREE.Vector2(0, 0.42),
    ];
    const torsoGeo = new THREE.LatheGeometry(torsoPoints, 12);
    const bodyMat = new THREE.MeshLambertMaterial({ color: oppColor, ...flat });
    bowlerBody = new THREE.Mesh(torsoGeo, bodyMat);
    bowlerBody.position.y = 0.55;
    bowlerBody.rotation.x = THREE.MathUtils.degToRad(15);
    bowlerBody.castShadow = true;
    bowlerGroup.add(bowlerBody);

    // Team stripe
    const stripeGeo = new THREE.BoxGeometry(0.4, 0.05, 0.4);
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.set(0, 0.82, -0.04);
    stripe.rotation.x = THREE.MathUtils.degToRad(15);
    bowlerGroup.add(stripe);

    // --- Non-bowling arm (left, extended forward for balance) ---
    const upperArmGeo = new THREE.CylinderGeometry(0.045, 0.035, 0.23, 8);
    const forearmGeo = new THREE.CylinderGeometry(0.035, 0.03, 0.2, 8);
    const forearmMat = new THREE.MeshLambertMaterial({ color: skinColor, ...flat });

    const shoulderL = new THREE.Group();
    shoulderL.position.set(-0.2, 0.92, -0.04);
    shoulderL.rotation.z = THREE.MathUtils.degToRad(25);
    shoulderL.rotation.x = THREE.MathUtils.degToRad(-40);
    const bUpperArmL = new THREE.Mesh(upperArmGeo, new THREE.MeshLambertMaterial({ color: oppColor, ...flat }));
    bUpperArmL.position.y = -0.11;
    shoulderL.add(bUpperArmL);
    const bElbowL = new THREE.Group();
    bElbowL.position.set(0, -0.23, 0);
    bElbowL.rotation.x = THREE.MathUtils.degToRad(-15);
    const bForearmL = new THREE.Mesh(forearmGeo, forearmMat);
    bForearmL.position.y = -0.1;
    bElbowL.add(bForearmL);
    const bHandL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshLambertMaterial({ color: skinColor }));
    bHandL.position.y = -0.2;
    bElbowL.add(bHandL);
    shoulderL.add(bElbowL);
    bowlerGroup.add(shoulderL);

    // --- Neck ---
    const neckGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.07, 8);
    const neckMat = new THREE.MeshLambertMaterial({ color: skinColor });
    const neck = new THREE.Mesh(neckGeo, neckMat);
    neck.position.y = 1.01;
    bowlerGroup.add(neck);

    // --- Head + Helmet (opponent team color) ---
    const helmGeo = new THREE.SphereGeometry(0.18, 12, 8);
    const helmMat = new THREE.MeshLambertMaterial({ color: oppColor, ...flat });
    bowlerHead = new THREE.Mesh(helmGeo, helmMat);
    bowlerHead.position.y = 1.16;
    bowlerHead.scale.set(1, 0.85, 1);
    bowlerGroup.add(bowlerHead);

    // Bowler visor
    const bVisorGeo = new THREE.BoxGeometry(0.3, 0.035, 0.13);
    const bVisorMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const bVisor = new THREE.Mesh(bVisorGeo, bVisorMat);
    bVisor.position.set(0, 1.09, -0.14);
    bowlerGroup.add(bVisor);

    // Face guard bars
    const guardGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.1, 4);
    const guardMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    for (let i = -1; i <= 1; i++) {
      const bar = new THREE.Mesh(guardGeo, guardMat);
      bar.position.set(i * 0.045, 1.04, -0.18);
      bowlerGroup.add(bar);
    }

    // Slight upward head tilt
    bowlerHead.rotation.x = THREE.MathUtils.degToRad(-8);

    // --- Bowling arm (right, raised high for delivery) ---
    const bowlArmGeo = new THREE.CylinderGeometry(0.04, 0.03, 0.5, 8);
    const bowlArmMat = new THREE.MeshLambertMaterial({ color: skinColor, ...flat });
    bowlerArm = new THREE.Mesh(bowlArmGeo, bowlArmMat);
    bowlerArm.position.set(0.2, 1.05, 0);
    bowlerArm.rotation.z = THREE.MathUtils.degToRad(-30);
    bowlerArm.visible = false;
    bowlerGroup.add(bowlerArm);

    // Ball in hand
    const bhGeo = new THREE.SphereGeometry(0.08, 8, 6);
    const bhMat = new THREE.MeshLambertMaterial({ color: 0xcc0000 });
    bowlerBallInHand = new THREE.Mesh(bhGeo, bhMat);
    bowlerBallInHand.visible = false;
    bowlerGroup.add(bowlerBallInHand);

    scene.add(bowlerGroup);
  }

  // ---- Ball ----
  let ballGlowLight;
  function buildBall() {
    const geo = new THREE.SphereGeometry(0.22, 16, 12);
    const mat = new THREE.MeshPhongMaterial({ color: 0xcc0000, shininess: 80, emissive: 0x440000, emissiveIntensity: 0.2 });
    ballMesh = new THREE.Mesh(geo, mat);
    ballMesh.visible = false;
    scene.add(ballMesh);

    // Glow light attached to ball
    ballGlowLight = new THREE.PointLight(0xFF4444, 0.5, 3);
    ballGlowLight.visible = false;
    scene.add(ballGlowLight);

    // Seam (torus) — slightly larger to match ball
    const seamGeo = new THREE.TorusGeometry(0.20, 0.018, 4, 16);
    const seamMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    ballSeam = new THREE.Mesh(seamGeo, seamMat);
    ballSeam.visible = false;
    scene.add(ballSeam);

    // Shadow on ground
    const shadowGeo = new THREE.CircleGeometry(0.28, 12);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
    ballShadow = new THREE.Mesh(shadowGeo, shadowMat);
    ballShadow.rotation.x = -Math.PI / 2;
    ballShadow.position.y = 0.01;
    ballShadow.visible = false;
    scene.add(ballShadow);
  }

  // ---- Stumps (batsman end) ----
  function buildStumps() {
    stumpsGroup = new THREE.Group();
    // Stumps at crease — batsman stands in front (higher z = toward bowler)
    stumpsGroup.position.set(0, 0, 0.8);

    const teamColor = state.selectedTeam ? TEAMS[state.selectedTeam].secondary : '#0000AA';
    const stumpGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.0, 8);
    const stumpMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(teamColor) });

    // White stripe geometry for mid-height ring on each stump
    const stripeGeo = new THREE.CylinderGeometry(0.048, 0.048, 0.08, 8);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });

    for (let i = -1; i <= 1; i++) {
      const stump = new THREE.Mesh(stumpGeo, stumpMat.clone());
      stump.position.set(i * 0.1, 0.5, 0);
      // White stripe
      const stripe = new THREE.Mesh(stripeGeo, stripeMat.clone());
      stripe.position.y = 0.0; // mid-height of stump
      stump.add(stripe);
      stumpsGroup.add(stump);
      stumpMeshes.push(stump);
    }

    // Glowing gold bails
    const bailGeo = new THREE.BoxGeometry(0.22, 0.03, 0.03);
    const bailMat = new THREE.MeshLambertMaterial({ color: 0xFFD700, emissive: 0xFFD700, emissiveIntensity: 0.3 });

    const bail1 = new THREE.Mesh(bailGeo, bailMat.clone());
    bail1.position.set(-0.05, 1.02, 0);
    stumpsGroup.add(bail1);
    bailMeshes.push(bail1);

    const bail2 = new THREE.Mesh(bailGeo, bailMat.clone());
    bail2.position.set(0.05, 1.02, 0);
    stumpsGroup.add(bail2);
    bailMeshes.push(bail2);

    scene.add(stumpsGroup);

    // Crease lines
    creaseLineBatsman = buildCreaseLine(1.5, 4);
    creaseLineBowler = buildCreaseLine(19.5, 2.5);

    // Bowler-end stumps (far end) — same style, proportionally same
    stumpsGroupFar = new THREE.Group();
    stumpsGroupFar.position.set(0, 0, 20);

    const stumpGeoFar = new THREE.CylinderGeometry(0.045, 0.045, 1.0, 8);
    for (let i = -1; i <= 1; i++) {
      const stump = new THREE.Mesh(stumpGeoFar, stumpMat.clone());
      stump.position.set(i * 0.1, 0.5, 0);
      const stripe = new THREE.Mesh(stripeGeo, stripeMat.clone());
      stripe.position.y = 0.0;
      stump.add(stripe);
      stumpsGroupFar.add(stump);
      stumpMeshesFar.push(stump);
    }
    const bailFar1 = new THREE.Mesh(bailGeo, bailMat.clone());
    bailFar1.position.set(-0.05, 1.02, 0);
    stumpsGroupFar.add(bailFar1);
    bailMeshesFar.push(bailFar1);

    const bailFar2 = new THREE.Mesh(bailGeo, bailMat.clone());
    bailFar2.position.set(0.05, 1.02, 0);
    stumpsGroupFar.add(bailFar2);
    bailMeshesFar.push(bailFar2);

    scene.add(stumpsGroupFar);
  }

  // ============================================
  // THREE.JS UPDATE (per frame)
  // ============================================

  function updateThreeScene(dt) {
    // Always update atmospheric effects
    if (!reducedMotion) {
      updateDustParticles(dt);
      updatePitchDust(dt);
    }

    if (state.phase === 'BOWLING') {
      updateBowlingScene(dt);
      updateParticles3D(dt);
      updateCamera(dt);
      updateBatsmanShadow();
      return;
    }

    if (state.phase !== 'BATTING' && state.phase !== 'TITLE') {
      // Still render but nothing to animate
      updateParticles3D(dt);
      updateCamera(dt);
      return;
    }

    if (state.phase === 'TITLE') {
      updateCamera(dt);
      return;
    }

    // Update team colors on batsman
    updateTeamColors();

    // Sweet spot indicator (line)
    if (state.ballActive && state.ballProgress > 0.5) {
      const pulse = 0.3 + 0.2 * Math.sin(Date.now() * 0.008);
      sweetSpotLine.material.opacity = pulse;
    } else {
      sweetSpotLine.material.opacity = 0;
    }

    // Sweet spot ring (pulsing timing guide during last 30% of flight)
    if (sweetSpotRing) {
      if (state.ballActive && state.ballProgress > 0.7) {
        const pulse = 0.3 + 0.3 * Math.sin(Date.now() * 0.012);
        sweetSpotRing.material.opacity = pulse;
        const scale = 1 + 0.2 * Math.sin(Date.now() * 0.008);
        sweetSpotRing.scale.set(scale, scale, scale);
      } else {
        sweetSpotRing.material.opacity = 0;
      }
    }

    // Show/hide stumps based on scatter state
    stumpsGroup.visible = !state.stumpScatter && !state.stumpsScattered;

    // Update batsman animation
    updateBatsmanAnim(dt);

    // Update bowler animation
    updateBowlerAnim(dt);

    // Update ball position
    if (state.ballActive) {
      updateBallPosition();
    } else {
      ballMesh.visible = false;
      ballSeam.visible = false;
      ballShadow.visible = false;
      if (ballGlowLight) ballGlowLight.visible = false;
    }

    // Post-ball animation
    if (state.postBallActive) {
      updatePostBall(dt);
    } else {
      postBallMesh.visible = false;
    }

    // Stump scatter
    if (state.stumpScatter) {
      updateStumpScatter(dt);
    }

    // Particles
    updateParticles3D(dt);

    // Floating texts (stay as DOM overlays)
    updateFloatingTexts(dt);

    // Crowd
    if (!reducedMotion) {
      updateCrowdColors();
    }

    // Ball trail + tracking line
    if (!reducedMotion) {
      updateBallTrail(dt);
    }
    updateBallTracking(dt);

    // Batsman shadow
    updateBatsmanShadow();

    // Feature 1: Keeper catch animation — gloves come together
    if (state.keeperCatchAnim && keeperGloveL && keeperGloveR) {
      const elapsed = (Date.now() - state.keeperCatchAnimStart) / 1000;
      if (elapsed < 0.8) {
        const t = Math.min(1, elapsed / 0.3); // gloves close in 0.3s
        keeperGloveL.position.x = -0.15 + t * 0.1;  // move inward
        keeperGloveR.position.x = 0.15 - t * 0.1;   // move inward
      } else {
        // Reset
        state.keeperCatchAnim = false;
        keeperGloveL.position.x = -0.15;
        keeperGloveR.position.x = 0.15;
      }
    }

    // Feature 3: Confidence glow on batsman
    if (batsmanBody && batsmanBody.material) {
      if (state.confidence > 75) {
        if (!batsmanBody.material.emissive) batsmanBody.material.emissive = new THREE.Color(0x000000);
        batsmanBody.material.emissive.setHex(0x332200);
        batsmanBody.material.emissiveIntensity = 0.3;
      } else {
        if (batsmanBody.material.emissiveIntensity) batsmanBody.material.emissiveIntensity = 0;
      }
    }

    // Batsman idle animation (when ball not in flight)
    if (!state.ballActive && !state.batAnimating && !reducedMotion) {
      // Subtle breathing sway
      batsmanGroup.position.y = Math.sin(Date.now() * 0.002) * 0.02;
      // Bat taps ground gently
      if (!state.batCelebration) {
        const idleBatAngle = -30 + Math.sin(Date.now() * 0.003) * 2;
        batGroup.rotation.z = THREE.MathUtils.degToRad(idleBatAngle);
      }
    } else if (state.ballActive || state.batAnimating) {
      batsmanGroup.position.y = 0;
    }

    // Bat celebration on boundary
    if (state.batCelebration && !reducedMotion) {
      state.batCelebrationTimer -= dt;
      if (state.batCelebrationTimer > 0) {
        // Raise bat upward (vertical)
        batGroup.rotation.z = THREE.MathUtils.degToRad(-90);
        batGroup.rotation.y = 0;
      } else {
        state.batCelebration = false;
        batGroup.rotation.z = THREE.MathUtils.degToRad(-30);
        batGroup.rotation.y = 0;
      }
    }

    // Camera
    updateCamera(dt);
  }

  let _lastTeamKey = null;
  function updateTeamColors() {
    if (state.selectedTeam === _lastTeamKey) return;
    _lastTeamKey = state.selectedTeam;

    const team = state.selectedTeam ? TEAMS[state.selectedTeam] : { primary: '#004BA0', secondary: '#FFD700' };
    const primaryColor = new THREE.Color(team.primary);

    batsmanBody.material.color.copy(primaryColor);
    batsmanHelmet.material.color.copy(primaryColor);

    if (state.opponentTeam) {
      const oppTeam = TEAMS[state.opponentTeam];
      bowlerBody.material.color.set(oppTeam.primary);
    }
    updateFielderColors();
  }

  function updateBatsmanAnim(dt) {
    // New batsman walk-in
    if (state.newBatsmanAnim) {
      const elapsed = Date.now() - state.newBatsmanTime;
      const t = Math.min(1, elapsed / 800);
      batsmanGroup.position.x = (1 - t) * 4;
      if (t >= 1) {
        state.newBatsmanAnim = false;
        batsmanGroup.position.x = 0;
      }
    }

    // Bat swing animation
    if (state.batAnimating) {
      const elapsed = Date.now() - state.batAnimStart;
      const t = Math.min(1, elapsed / state.batAnimDuration);
      const eased = 1 - Math.pow(1 - t, 3);

      let angle;
      switch (state.batAnimType) {
        case 'straight':
          angle = -30 + eased * 180;
          batGroup.rotation.z = THREE.MathUtils.degToRad(angle);
          batGroup.rotation.y = 0;
          break;
        case 'pull':
          angle = -30 + eased * 160;
          batGroup.rotation.z = THREE.MathUtils.degToRad(angle * 0.5);
          batGroup.rotation.y = THREE.MathUtils.degToRad(-eased * 90);
          break;
        case 'cut':
          angle = -30 + eased * 170;
          batGroup.rotation.z = THREE.MathUtils.degToRad(angle * 0.5);
          batGroup.rotation.y = THREE.MathUtils.degToRad(eased * 90);
          break;
        case 'defense':
          angle = -30 + eased * 60;
          batGroup.rotation.z = THREE.MathUtils.degToRad(angle);
          batGroup.rotation.y = 0;
          break;
      }

      if (t >= 1) {
        state.batAnimating = false;
        state.batAngle = -30;
        // Don't reset bat angle if celebration is active
        if (!state.batCelebration) {
          batGroup.rotation.z = THREE.MathUtils.degToRad(-30);
          batGroup.rotation.y = 0;
        }
      }
    }
  }

  function updateBowlerAnim(dt) {
    if (!state.bowlerAnimating) {
      bowlerArm.visible = false;
      bowlerBallInHand.visible = false;
      bowlerGroup.position.z = 20;
      return;
    }

    // Run-up: bowler moves toward batsman
    const runT = state.bowlerRunUp;
    bowlerGroup.position.z = 20 - runT * 2;

    // Arm windmill
    bowlerArm.visible = true;
    const armAngle = THREE.MathUtils.degToRad(state.bowlerArmAngle);
    bowlerArm.position.set(
      0.2 + Math.cos(armAngle) * 0.2,
      1.0 + Math.sin(armAngle) * 0.2,
      0
    );
    bowlerArm.rotation.z = armAngle;

    // Ball in hand before release
    if (state.bowlerArmAngle < 90) {
      bowlerBallInHand.visible = true;
      bowlerBallInHand.position.set(
        0.2 + Math.cos(armAngle) * 0.35,
        1.0 + Math.sin(armAngle) * 0.35,
        0
      );
    } else {
      bowlerBallInHand.visible = false;
    }
  }

  function updateBallPosition() {
    const t = state.ballProgress;

    // Ball travels from bowler end (z=20) to batsman end (z=0.5)
    const startZ = 20;
    const endZ = 0.5;
    const baseZ = startZ + t * (endZ - startZ);

    // Lateral movement for swing
    let lateralX = 0;
    const swingVisible = state.ballLateBreak ? (t > 0.6 ? (t - 0.6) / 0.4 : 0) : (t > 0.4 ? (t - 0.4) / 0.6 : 0);
    if (state.ballDeliveryType === 'inswing') {
      lateralX = swingVisible * 1.5;
    } else if (state.ballDeliveryType === 'outswing') {
      lateralX = -swingVisible * 1.5;
    }

    // Bouncer: ball rises after 60%
    let yOff = 0.4; // base height
    if (state.ballDeliveryType === 'bouncer' && t > 0.6) {
      const bt = (t - 0.6) / 0.4;
      yOff += bt * 1.2;
    }

    // Yorker: ball stays very low
    if (state.ballDeliveryType === 'yorker') {
      yOff = 0.4 - t * 0.3;
    }

    // Normal ball bounces: slight parabolic arc
    if (state.ballDeliveryType !== 'bouncer' && state.ballDeliveryType !== 'yorker') {
      // Ball bounces roughly in middle of pitch
      if (t < 0.5) {
        yOff = 0.4 + (0.5 - Math.abs(t - 0.25)) * 0.8;
      } else {
        yOff = 0.4 + (1 - t) * 0.3;
      }
    }

    const bx = lateralX + state.ballSwingDir * swingVisible * 0.3;
    const by = Math.max(0.15, yOff);
    const bz = baseZ;

    ballMesh.visible = true;
    ballMesh.position.set(bx, by, bz);

    // Record ball position for post-delivery tracking line
    if (ballTrackingPositions.length === 0 || ballTrackingPositions.length < 60) {
      ballTrackingPositions.push(new THREE.Vector3(bx, Math.max(0.05, by * 0.3), bz)); // project onto near-ground level
    }

    ballSeam.visible = true;
    ballSeam.position.copy(ballMesh.position);
    // Patch #20: Enhanced ball rotation/seam animation
    const spinMultiplier = (state.ballDeliveryType === 'inswing' || state.ballDeliveryType === 'outswing') ? 25 : 15;
    const dtEst = 0.016; // approx frame dt
    ballSeam.rotation.x += dtEst * spinMultiplier;
    ballMesh.rotation.z += dtEst * 8;

    ballShadow.visible = true;
    ballShadow.position.set(bx, 0.01, bz);
    const shadowScale = 0.5 + by * 0.3;
    ballShadow.scale.set(shadowScale, shadowScale, 1);

    // Sync ball glow light
    if (ballGlowLight) {
      ballGlowLight.visible = true;
      ballGlowLight.position.copy(ballMesh.position);
    }
  }

  function updatePostBall(dt) {
    const elapsed = Date.now() - state.postBallTime;
    const t = Math.min(1, elapsed / 1200);

    postBallMesh.visible = true;

    switch (state.postBallType) {
      case 'four': {
        // Ball rolls toward boundary
        const angle = state.postBallVx * 0.5;
        const dist = t * 40;
        postBallMesh.position.set(
          Math.sin(angle) * dist,
          0.15,
          0.5 + dist
        );
        postBallMesh.scale.setScalar(Math.max(0.3, 1 - t * 0.7));
        if (t >= 1) state.postBallActive = false;
        break;
      }
      case 'six': {
        // Ball arcs up into the stands
        const x = state.postBallVx * t * 5;
        const y = 0.5 + t * 15 - t * t * 8;
        const z = 0.5 + t * 30;
        postBallMesh.position.set(x, Math.max(0.15, y), z);
        postBallMesh.scale.setScalar(Math.max(0.2, 1 - t * 0.8));
        if (t >= 1) state.postBallActive = false;
        break;
      }
      case 'wicket': {
        postBallMesh.visible = false;
        if (t >= 0.3) state.postBallActive = false;
        break;
      }
      case 'caught': {
        // Ball arcs up, fielder intercepts
        const x = state.postBallVx * t * 4;
        const y = 0.5 + Math.sin(t * Math.PI) * 3;
        const z = 0.5 + t * 15;
        postBallMesh.position.set(x, Math.max(0.15, y), z);
        postBallMesh.scale.setScalar(Math.max(0.3, 1 - t * 0.5));
        if (t >= 1) state.postBallActive = false;
        break;
      }
      default: {
        // Dot / single / runs
        const x = state.postBallVx * t * 2;
        const z = 0.5 + t * 5;
        postBallMesh.position.set(x, 0.15, z);
        postBallMesh.scale.setScalar(Math.max(0.2, 1 - t));
        if (t >= 1) state.postBallActive = false;
        break;
      }
    }
  }

  function updateStumpScatter(dt) {
    if (!state.stumpScatter) return;
    const ss = state.stumpScatter;
    const elapsed = Date.now() - ss.startTime;
    const t = elapsed / 1000;

    if (t > 1.5) {
      // Keep stumps broken on ground — don't restore until next delivery
      state.stumpScatter = null;
      state.stumpsScattered = true; // flag keeps original stumps hidden
      // Leave scatter meshes in scene (stumps on ground)
      return;
    }

    // On first frame, create scatter meshes
    if (scatterStumps.length === 0) {
      const teamColor = state.selectedTeam ? TEAMS[state.selectedTeam].secondary : '#0000AA';
      const stumpGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.0, 8);
      const stumpMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(teamColor) });
      ss.pieces.forEach(p => {
        const mesh = new THREE.Mesh(stumpGeo, stumpMat);
        mesh.position.copy(stumpsGroup.position);
        mesh.position.y = 0.5;
        mesh.userData = { vx: p.vx, vy: p.vy, rot: p.rot };
        scene.add(mesh);
        scatterStumps.push(mesh);
      });

      const bailGeo = new THREE.BoxGeometry(0.22, 0.03, 0.03);
      const bailMat = new THREE.MeshLambertMaterial({ color: 0xFFD700, emissive: 0xFFD700, emissiveIntensity: 0.3 });
      ss.bails.forEach(b => {
        const mesh = new THREE.Mesh(bailGeo, bailMat);
        mesh.position.copy(stumpsGroup.position);
        mesh.position.y = 1.02;
        mesh.userData = { vx: b.vx, vy: b.vy };
        scene.add(mesh);
        scatterBails.push(mesh);
      });
    }

    // Animate scatter
    const gravity = 9.8;
    scatterStumps.forEach(mesh => {
      const d = mesh.userData;
      mesh.position.x = stumpsGroup.position.x + d.vx * t * 1.5;
      mesh.position.y = 0.5 + d.vy * t * 1.5 - 0.5 * gravity * t * t;
      mesh.position.z = stumpsGroup.position.z - t * 0.5;
      mesh.rotation.x = d.rot * t * 6;
      mesh.rotation.z = d.rot * t * 4;
      if (mesh.position.y < 0) mesh.position.y = 0;
    });

    scatterBails.forEach(mesh => {
      const d = mesh.userData;
      mesh.position.x = stumpsGroup.position.x + d.vx * t * 2;
      mesh.position.y = 1.02 + 3 * t - 0.5 * gravity * t * t;
      mesh.position.z = stumpsGroup.position.z - t * 1;
      mesh.rotation.x = t * 10;
      mesh.rotation.z = t * 8;
      if (mesh.position.y < 0) mesh.position.y = 0;
    });
  }

  // ---- 3D Particles ----
  function spawnParticles(x, y, count, colors, speed, life) {
    if (reducedMotion) return;

    // Convert 2D screen coordinates to approximate 3D position
    // x,y are still passed as screen coords from the game logic
    // We'll spawn particles at the ball's last position or center of pitch
    const worldX = 0;
    const worldY = 1.5;
    const worldZ = 2;

    for (let i = 0; i < count && state.particles.length < MAX_PARTICLES; i++) {
      const angle = Math.random() * Math.PI * 2;
      const elev = Math.random() * Math.PI - Math.PI / 2;
      const spd = speed * 0.015 * (0.5 + Math.random() * 0.5);
      state.particles.push({
        x: worldX,
        y: worldY,
        z: worldZ,
        vx: Math.cos(angle) * Math.cos(elev) * spd,
        vy: Math.sin(elev) * spd + spd * 0.5,
        vz: Math.sin(angle) * Math.cos(elev) * spd,
        life: life || 1,
        maxLife: life || 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 0.05 + Math.random() * 0.08
      });
    }
  }

  function updateParticles3D(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 3 * dt; // gravity
      p.life -= dt;
      if (p.life <= 0 || p.y < 0) {
        state.particles.splice(i, 1);
        continue;
      }
    }

    // Update particle meshes
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const mesh = particleMeshes[i];
      if (i < state.particles.length) {
        const p = state.particles[i];
        mesh.visible = true;
        mesh.position.set(p.x, p.y, p.z);
        const s = p.size;
        mesh.scale.set(s / 0.05, s / 0.05, s / 0.05);
        mesh.material.color.set(p.color);
        mesh.material.opacity = p.life / p.maxLife;
      } else {
        mesh.visible = false;
      }
    }
  }

  function triggerCrowdWave() {
    state.crowdWaveActive = true;
    state.crowdWaveStart = Date.now();
  }

  // ---- Floating Texts (DOM-based, not 3D) ----
  function spawnFloatingText(text, x, y, color, size) {
    state.floatingTexts.push({
      text, x, y, color,
      size: size || 24,
      life: 1.0,
      maxLife: 1.0
    });
  }

  function updateFloatingTexts(dt) {
    // These are rendered as DOM overlays in the astro file already
    // We just manage their lifecycle here
    for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
      const ft = state.floatingTexts[i];
      ft.y -= 40 * dt;
      ft.life -= dt;
      if (ft.life <= 0) {
        state.floatingTexts.splice(i, 1);
      }
    }
  }

  // ---- Camera ----
  function updateCamera(dt) {
    let targetCamPos, targetLookAt;

    if (state.phase === 'BOWLING' || state.phase === 'INNINGS_BREAK') {
      // Bowling view: wide TV broadcast angle from bowler end
      targetCamPos = new THREE.Vector3(0, 6, 24);
      targetLookAt = new THREE.Vector3(0, 0.5, 5);
    } else {
      // Default camera position: lower, closer behind batsman (stumps prominent)
      targetCamPos = new THREE.Vector3(0, 4, -5);
      targetLookAt = new THREE.Vector3(0, 0.8, 12);
    }

    // Camera effects based on game events
    if (state.postBallActive) {
      if (state.postBallType === 'six') {
        if (state.phase === 'BOWLING') {
          // Six toward camera in bowling view
          targetCamPos.y += 1;
        } else {
          targetCamPos.y += 1.5;
          targetLookAt.y += 2;
        }
      } else if (state.postBallType === 'four') {
        if (state.phase !== 'BOWLING') {
          targetCamPos.z += 0.5;
        }
      }
    }

    // Lerp camera
    camera.position.lerp(targetCamPos, 0.05);

    // Camera shake (supports different intensities per event)
    if (cameraShake.active) {
      const shakeElapsed = Date.now() - cameraShake.start;
      if (shakeElapsed > cameraShake.duration) {
        cameraShake.active = false;
      } else {
        const shakeT = 1 - shakeElapsed / cameraShake.duration;
        camera.position.x += (Math.random() - 0.5) * cameraShake.intensity * shakeT;
        camera.position.y += (Math.random() - 0.5) * cameraShake.intensity * shakeT;
      }
    }

    camera.lookAt(targetLookAt);
  }

  let _shadowPerfChecked = false;
  function renderThreeScene() {
    if (renderer && scene && camera) {
      // Performance check: disable shadows if first frame is too slow
      if (!_shadowPerfChecked && renderer.shadowMap.enabled) {
        const t0 = performance.now();
        renderer.render(scene, camera);
        const elapsed = performance.now() - t0;
        _shadowPerfChecked = true;
        if (elapsed > 20) {
          renderer.shadowMap.enabled = false;
          if (ground) ground.receiveShadow = false;
          if (batsmanBody) batsmanBody.castShadow = false;
          if (bowlerBody) bowlerBody.castShadow = false;
        }
        return;
      }
      renderer.render(scene, camera);
    }
  }

  // Render floating texts as DOM overlays (drawn each frame)
  const floatingTextContainer = document.createElement('div');
  floatingTextContainer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:5;overflow:hidden;';

  function renderFloatingTexts() {
    // Clear previous
    floatingTextContainer.innerHTML = '';
    state.floatingTexts.forEach(ft => {
      const div = document.createElement('div');
      const alpha = ft.life / ft.maxLife;
      const scale = reducedMotion ? 1 : (1 + (1 - alpha) * 0.3);
      div.style.cssText = `
        position: absolute;
        left: 50%;
        top: ${ft.y / H * 100}%;
        transform: translateX(-50%) scale(${scale});
        font-size: ${ft.size}px;
        font-weight: 900;
        color: ${ft.color};
        opacity: ${alpha};
        text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        pointer-events: none;
        white-space: nowrap;
      `;
      div.textContent = ft.text;
      floatingTextContainer.appendChild(div);
    });
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
      masterGain.gain.value = state.soundEnabled ? 0.5 : 0;
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
    // Feature 6: Scale crowd volume by match pressure
    const pressure = getMatchPressure();
    const pressureScale = 1 + pressure / 100;
    gainVal *= pressureScale;
    noiseGain *= pressureScale;
    baseFreqs.forEach(f => {
      playTone(f + pitchShift, 'sine', dur, gainVal);
    });
    if (type === 'roar') playTone(440, 'sine', dur, 0.04 * pressureScale);
    createNoise(dur, 2000, 0.5, noiseGain, 'bandpass');
  }

  function playCrowdClap() {
    if (!audioCtx || !state.soundEnabled) return;
    for (let i = 0; i < 10; i++) {
      setTimeout(() => createNoise(0.01, 4000, 2, 0.04, 'bandpass'), i * 50);
    }
  }

  // Patch #22: Near-miss "phew" sound
  function playNearMissSound() {
    if (!audioCtx || !state.soundEnabled) return;
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(200, audioCtx.currentTime + 0.1);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
    gain.gain.setTargetAtTime(0, audioCtx.currentTime + 0.06, 0.03);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
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

  // Ball approach rising whoosh
  let ballApproachOsc = null;
  let ballApproachGain = null;
  function playBallApproach(durationMs) {
    if (!audioCtx || !state.soundEnabled) return;
    try {
      const dur = (durationMs || 1200) / 1000;
      ballApproachOsc = audioCtx.createOscillator();
      ballApproachOsc.type = 'sine';
      ballApproachOsc.frequency.setValueAtTime(200, audioCtx.currentTime);
      ballApproachOsc.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + dur);
      ballApproachGain = audioCtx.createGain();
      ballApproachGain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      ballApproachGain.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + dur);
      ballApproachOsc.connect(ballApproachGain);
      ballApproachGain.connect(masterGain);
      ballApproachOsc.start();
      ballApproachOsc.stop(audioCtx.currentTime + dur + 0.1);
      state.ballApproachActive = true;
    } catch (e) {}
  }
  function stopBallApproach() {
    if (ballApproachGain) {
      try { ballApproachGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.02); } catch (e) {}
    }
    state.ballApproachActive = false;
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
  // DIFFICULTY & DELIVERY GENERATION
  // ============================================

  // Feature 2: Three-phase match structure
  function getMatchPhaseForOver(overNum) {
    if (overNum < 2) return { label: 'POWERPLAY', color: '#FFD700', multiplier: 1.5 };
    if (overNum < 4) return { label: 'MIDDLE OVERS', color: '#4CAF50', multiplier: 1.0 };
    return { label: 'DEATH OVER', color: '#F44336', multiplier: 1.0 };
  }

  // Feature 6: Situational crowd intensity
  function getMatchPressure() {
    const ballsLeft = (5 - state.oversCompleted) * 6 - state.ballsInOver;
    const runsNeeded = state.target ? state.target - state.runs : 0;
    const rrRequired = ballsLeft > 0 ? (runsNeeded / (ballsLeft / 6)) : 0;

    let pressure = 0;
    if (state.matchPhase === 'batting_chase') {
      if (rrRequired > 12) pressure = 90;
      else if (rrRequired > 9) pressure = 70;
      else if (rrRequired > 6) pressure = 50;
      else pressure = 30;
    }
    if (state.oversCompleted >= 4) pressure += 20;
    if (state.wickets >= 2) pressure += 15;

    return Math.min(100, pressure);
  }

  // Feature 7: Wagon wheel SVG
  function drawWagonWheel() {
    const shots = state.wagonWheelShots;
    if (shots.length === 0) return '';

    let svg = '<svg viewBox="0 0 120 120" width="120" height="120" style="margin:8px auto;display:block;">';
    svg += '<circle cx="60" cy="60" r="55" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>';
    svg += '<circle cx="60" cy="60" r="30" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>';

    const dirMap = {
      straight: { dx: 0, dy: -1 },
      pull: { dx: -0.8, dy: -0.6 },
      cut: { dx: 0.8, dy: -0.6 },
      defense: { dx: 0, dy: -0.3 }
    };

    shots.forEach(function(s) {
      const d = dirMap[s.direction] || dirMap.straight;
      const len = Math.min(50, (s.runs / 6) * 50 + 5);
      const color = s.runs >= 6 ? '#9C27B0' : s.runs >= 4 ? '#FFD700' : s.runs > 0 ? '#FFFFFF' : '#666';
      const ex = 60 + d.dx * len;
      const ey = 60 + d.dy * len;
      svg += '<line x1="60" y1="65" x2="' + ex + '" y2="' + ey + '" stroke="' + color + '" stroke-width="1.5" opacity="0.7"/>';
    });

    svg += '<circle cx="60" cy="65" r="3" fill="#FFD700"/>';
    svg += '</svg>';
    return '<div style="text-align:center;"><span style="font-size:0.6rem;color:rgba(255,255,255,0.4);">WAGON WHEEL</span>' + svg + '</div>';
  }

  // Feature 8: Manhattan chart
  function drawManhattan() {
    // Worm Chart — scoring comparison between both innings
    const currentOvers = state.overRunHistory;
    const firstInningsOvers = state.firstInningsOverHistory || [];

    if (currentOvers.length === 0 && firstInningsOvers.length === 0) return '';

    // Build cumulative totals for each innings
    const buildCumulative = function(overs) {
      const cum = [0];
      let total = 0;
      overs.forEach(function(r) { total += r; cum.push(total); });
      return cum;
    };

    const cum1 = buildCumulative(firstInningsOvers); // first innings (blue/team A)
    const cum2 = buildCumulative(currentOvers); // current innings (orange/team B)

    const maxOvers = 5;
    const maxRuns = Math.max(
      cum1.length > 0 ? cum1[cum1.length - 1] : 0,
      cum2.length > 0 ? cum2[cum2.length - 1] : 0,
      10
    );

    const W = 260, H = 120;
    const padL = 30, padR = 20, padT = 12, padB = 20;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const xScale = function(ov) { return padL + (ov / maxOvers) * chartW; };
    const yScale = function(runs) { return padT + chartH - (runs / maxRuns) * chartH; };

    // Build SVG
    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" style="display:block;margin:4px auto;">';

    // Background
    svg += '<rect x="' + padL + '" y="' + padT + '" width="' + chartW + '" height="' + chartH + '" fill="rgba(255,255,255,0.03)" rx="2"/>';

    // Grid lines
    for (var g = 0; g <= 4; g++) {
      var gy = padT + (g / 4) * chartH;
      svg += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" stroke="rgba(255,255,255,0.06)" stroke-width="0.5"/>';
      var label = Math.round(maxRuns * (1 - g / 4));
      svg += '<text x="' + (padL - 4) + '" y="' + (gy + 3) + '" text-anchor="end" font-size="6" fill="rgba(255,255,255,0.3)">' + label + '</text>';
    }

    // Over labels on x-axis
    for (var o = 0; o <= maxOvers; o++) {
      svg += '<text x="' + xScale(o) + '" y="' + (H - 2) + '" text-anchor="middle" font-size="6" fill="rgba(255,255,255,0.3)">' + o + '</text>';
    }

    // Determine who batted first and who's batting now
    var isSecondInnings = firstInningsOvers.length > 0;
    var playerTeamColor = state.selectedTeam ? TEAMS[state.selectedTeam].primary : '#4A9FFF';
    var oppTeamColor = state.opponentTeam ? TEAMS[state.opponentTeam].primary : '#FF6B35';

    // Figure out which color goes to which line
    var firstBattingTeamColor, currentBattingTeamColor;
    var firstBattingName, currentBattingName;

    if (state.battingFirst) {
      // You batted first (or are batting first now)
      firstBattingTeamColor = playerTeamColor;
      firstBattingName = TEAM_ABBR[state.selectedTeam] || 'YOU';
      currentBattingTeamColor = isSecondInnings ? oppTeamColor : playerTeamColor;
      currentBattingName = isSecondInnings ? (TEAM_ABBR[state.opponentTeam] || 'AI') : (TEAM_ABBR[state.selectedTeam] || 'YOU');
    } else {
      // AI batted first (you bowled first)
      firstBattingTeamColor = oppTeamColor;
      firstBattingName = TEAM_ABBR[state.opponentTeam] || 'AI';
      currentBattingTeamColor = isSecondInnings ? playerTeamColor : oppTeamColor;
      currentBattingName = isSecondInnings ? (TEAM_ABBR[state.selectedTeam] || 'YOU') : (TEAM_ABBR[state.opponentTeam] || 'AI');
    }

    // Draw first innings line (if exists)
    if (cum1.length > 1) {
      var path1 = 'M';
      cum1.forEach(function(r, i) {
        path1 += (i > 0 ? 'L' : '') + xScale(i).toFixed(1) + ',' + yScale(r).toFixed(1);
      });
      svg += '<path d="' + path1 + '" fill="none" stroke="' + firstBattingTeamColor + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>';
      cum1.forEach(function(r, i) {
        if (i > 0) svg += '<circle cx="' + xScale(i).toFixed(1) + '" cy="' + yScale(r).toFixed(1) + '" r="3" fill="' + firstBattingTeamColor + '"/>';
      });
      var lastCum1 = cum1[cum1.length - 1];
      svg += '<text x="' + (xScale(cum1.length - 1) + 6) + '" y="' + (yScale(lastCum1) + 3) + '" font-size="7" font-weight="bold" fill="' + firstBattingTeamColor + '">' + lastCum1 + '</text>';
    }

    // Draw current innings line
    if (cum2.length > 1) {
      var path2 = 'M';
      cum2.forEach(function(r, i) {
        path2 += (i > 0 ? 'L' : '') + xScale(i).toFixed(1) + ',' + yScale(r).toFixed(1);
      });
      svg += '<path d="' + path2 + '" fill="none" stroke="' + currentBattingTeamColor + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
      cum2.forEach(function(r, i) {
        if (i > 0) svg += '<circle cx="' + xScale(i).toFixed(1) + '" cy="' + yScale(r).toFixed(1) + '" r="3" fill="' + currentBattingTeamColor + '"/>';
      });
      var lastCum2 = cum2[cum2.length - 1];
      svg += '<text x="' + (xScale(cum2.length - 1) + 6) + '" y="' + (yScale(lastCum2) + 3) + '" font-size="7" font-weight="bold" fill="' + currentBattingTeamColor + '">' + lastCum2 + '</text>';
    }

    svg += '</svg>';

    // Legend — show correct team names with their colors
    var legend = '<div style="display:flex;justify-content:center;gap:16px;font-size:0.65rem;margin-top:4px;">';
    if (isSecondInnings && cum1.length > 1) {
      legend += '<span style="color:' + firstBattingTeamColor + ';font-weight:700;">■ ' + firstBattingName + ' (1st: ' + cum1[cum1.length - 1] + ')</span>';
    }
    legend += '<span style="color:' + currentBattingTeamColor + ';font-weight:700;">■ ' + currentBattingName;
    if (cum2.length > 1) legend += (isSecondInnings ? ' (2nd: ' : ' (') + cum2[cum2.length - 1] + ')';
    legend += '</span>';
    legend += '</div>';

    var title = isSecondInnings ? 'SCORING COMPARISON' : 'INNINGS PROGRESS';
    return '<div style="text-align:center;"><span style="font-size:0.6rem;color:rgba(255,255,255,0.4);letter-spacing:0.1em;">' + title + '</span></div>' + svg + legend;
  }

  function getDifficultyParams() {
    const lv = state.level;
    const ov = state.oversCompleted;
    let baseSpeed = Math.max(550, 1200 - (lv - 1) * 80 - ov * 30);
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

    if (state.bowlerType === 'pacer') speed *= 0.9;
    if (state.bowlerType === 'spinner') {
      speed *= 1.3;
      state.timingGood += 20;
    }

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

    if (mysteryW > 0 && Math.random() * 100 < mysteryW) {
      state.ballLateBreak = true;
      const allTypes = ['straight','inswing','outswing','bouncer','yorker'];
      deliveryType = allTypes[Math.floor(Math.random() * allTypes.length)];
    } else {
      state.ballLateBreak = false;
    }

    state.ballDeliveryType = deliveryType;

    if (deliveryType === 'slower') {
      speed *= 1.4;
    }

    // Feature 2: Death over adjustments (over 5 = index 4)
    if (state.oversCompleted >= 4) {
      speed *= 0.85; // faster ball
      state.timingPerfect = Math.max(20, state.timingPerfect - 10);
      state.timingGood = Math.max(60, state.timingGood - 10);
    }

    // Feature 11: Pitch deterioration — bouncers have 10% chance of extra bounce
    if (state.pitchDeteriorated && deliveryType === 'bouncer' && Math.random() < 0.10) {
      state.timingPerfect = Math.max(15, state.timingPerfect - 15);
      state.timingGood = Math.max(55, state.timingGood - 15);
    }

    // Feature 4: Track bowler consecutive same type
    if (state.lastDeliveryType === deliveryType) {
      state.bowlerConsecutiveSameType++;
    } else {
      state.bowlerConsecutiveSameType = 0;
    }
    state.lastDeliveryType = deliveryType;
    // Feature 4: Show commentary hint when bowler repeats 3+
    if (state.bowlerConsecutiveSameType >= 3) {
      const el = document.getElementById('ballCommentary');
      if (el) {
        el.textContent = "The batsman is onto this delivery pattern!";
        el.classList.add('show');
        clearTimeout(el._timer);
        el._timer = setTimeout(() => el.classList.remove('show'), 2000);
      }
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
      // Feature 5: Stumping against spinners when ball is missed
      if (state.bowlerType === 'spinner' && Math.random() < 0.25) {
        return { runs: -1, type: 'stumped' };
      }
      if (state.ballIsOnStumps) return { runs: -1, type: 'bowled' };
      return { runs: 0, type: 'dot' };
    }

    // Feature 3: Confidence-adjusted timing thresholds
    const confidenceBonus = (state.confidence - 50) * 0.15;
    const adjustedPerfect = state.timingPerfect + confidenceBonus;
    const adjustedGood = state.timingGood + confidenceBonus;

    let quality;
    if (timingMs <= adjustedPerfect) quality = 'perfect';
    else if (timingMs <= adjustedGood) quality = 'good';
    else if (timingMs <= 200) quality = 'mistimed';
    else {
      // Feature 5: Stumping against spinners when swing is too late
      if (state.bowlerType === 'spinner' && Math.random() < 0.25) {
        return { runs: -1, type: 'stumped' };
      }
      if (state.ballIsOnStumps) return { runs: -1, type: 'bowled' };
      return { runs: 0, type: 'dot' };
    }

    const counterShot = DELIVERY_COUNTER[state.ballDeliveryType];
    if (counterShot && counterShot === dir) {
      if (quality === 'mistimed') quality = 'good';
      else if (quality === 'good') quality = 'perfect';
    }

    // Feature 4: Bowler variation pressure — 3+ same delivery shifts quality up
    if (state.bowlerConsecutiveSameType >= 3) {
      if (quality === 'good') quality = 'perfect';
      else if (quality === 'mistimed') quality = 'good';
    }

    switch (quality) {
      case 'perfect': probs = PROB_PERFECT[dir]; break;
      case 'good':    probs = PROB_GOOD[dir]; break;
      case 'mistimed': probs = PROB_MISTIMED[dir]; break;
    }

    // Feature 11: Pitch deterioration — spinners get +10% wicket on mistimed
    if (state.pitchDeteriorated && state.bowlerType === 'spinner' && quality === 'mistimed') {
      probs = [...probs];
      probs[6] = Math.min(80, probs[6] + 10); // +10% wicket
      probs[0] = Math.max(0, probs[0] - 10);
    }

    const roll = Math.random() * 100;
    let cum = 0;
    const outcomes = [0, 1, 2, 3, 4, 6, -1];
    for (let i = 0; i < probs.length; i++) {
      cum += probs[i];
      if (roll < cum) {
        const runs = outcomes[i];
        if (runs === -1) {
          let outType;
          if (dir === 'defense') {
            outType = 'bowled';
          } else {
            const outRoll = Math.random();
            if (outRoll < 0.5) outType = 'caught';
            else outType = 'bowled';
          }
          // LBW chance: 40% of bowled dismissals when ball is on stumps and shot is mistimed
          if (outType === 'bowled' && state.ballIsOnStumps && quality === 'mistimed' && Math.random() < 0.4) {
            outType = 'lbw';
          }
          // Feature 1: Caught behind — 30% of caught dismissals when not a bouncer
          if (outType === 'caught' && state.ballDeliveryType !== 'bouncer' && Math.random() < 0.3) {
            outType = 'caught_behind';
          }
          return { runs: -1, type: outType, _quality: quality };
        }
        let type = 'dot';
        if (runs === 1) type = 'single';
        else if (runs === 2) type = 'two';
        else if (runs === 3) type = 'three';
        else if (runs === 4) type = 'four';
        else if (runs === 6) type = 'six';
        return { runs, type, _quality: quality };
      }
    }
    return { runs: 0, type: 'dot', _quality: quality };
  }

  // ============================================
  // BALL DELIVERY SEQUENCE
  // ============================================

  let deliveryPhase = 'idle';
  let deliveryTimer = 0;

  // Ball tint by delivery type — subtle visual cue
  const DELIVERY_COLORS = {
    straight: 0xcc0000,  // standard red
    inswing: 0xcc2200,   // slightly orange tint
    outswing: 0xaa0022,  // slightly magenta tint
    bouncer: 0xdd0000,   // brighter red
    yorker: 0x990000,    // darker red
    slower: 0xcc4400,    // noticeable orange
  };

  function startDelivery() {
    generateDelivery();

    // Clear previous ball tracking line
    clearBallTrackingLine();
    ballTrackingPositions = [];

    // Tint ball based on delivery type
    const dType = state.ballDeliveryType === 'slower' ? 'slower' : state.ballDeliveryType;
    if (ballMesh && DELIVERY_COLORS[dType]) {
      ballMesh.material.color.setHex(DELIVERY_COLORS[dType]);
    }

    // Restore stumps if they were scattered from previous wicket
    if (state.stumpsScattered) {
      state.stumpsScattered = false;
      scatterStumps.forEach(s => scene.remove(s));
      scatterBails.forEach(b => scene.remove(b));
      scatterStumps = [];
      scatterBails = [];
    }

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
    state._timingAnnounced = false; // Patch #24
    batGroup.rotation.z = THREE.MathUtils.degToRad(-30);
    batGroup.rotation.y = 0;

    // Reset scatter meshes
    scatterStumps.forEach(s => scene.remove(s));
    scatterBails.forEach(b => scene.remove(b));
    scatterStumps = [];
    scatterBails = [];
  }

  function updateDelivery(dt) {
    if (state.phase !== 'BATTING') return;
    if (state.paused) return;

    switch (deliveryPhase) {
      case 'idle':
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
          deliveryPhase = 'inflight';
          deliveryTimer = 0;
          state.ballActive = true;
          state.ballProgress = 0;
          state.bowlerAnimating = false;
          playDeliveryWhoosh();
          playBallApproach(state.ballSpeed);
          // Patch #24: Announce ball bowled
          announceSR('Ball bowled. ' + (DELIVERY_LABELS[state.ballDeliveryType] || 'Straight') + '.');
        }
        break;

      case 'inflight':
        if (deliveryPhase !== 'inflight') break;
        deliveryTimer += dt * 1000;
        state.ballProgress = Math.min(1, deliveryTimer / state.ballSpeed);

        // Patch #24: Announce timing window
        if (state.ballProgress >= 0.7 && !state._timingAnnounced) {
          state._timingAnnounced = true;
          announceSR('Timing window open. Swing now!');
        }

        if (state.swingTriggered && !state.batAnimating) {
          deliveryPhase = 'resolved';
          const idealTime = state.ballSpeed * 0.85;
          const timingMs = Math.abs(state.swingTime - idealTime);
          const outcome = resolveOutcome(timingMs);
          handleOutcome(outcome);
          deliveryTimer = 0;
          break;
        }

        if (state.ballProgress >= 1) {
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
          if (state.wickets >= 3) {
            // All out -- handle appropriately based on match phase
            endGame();
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
    state.batsmanBalls = (state.batsmanBalls || 0) + 1;
    stopBallApproach();

    // Draw ball tracking line on the pitch
    showBallTrackingLine(outcome);

    // Feature 11: Pitch deterioration check
    if (state.totalBallsFaced >= 15 && !state.pitchDeteriorated) {
      state.pitchDeteriorated = true;
      addPitchCracks();
      showBallCommentary({ type: 'pitch_crack' }, false);
    }

    // Use center-screen coords for floating text (relative to H)
    const textX = W / 2;
    const textBaseY = H * 0.4;

    // Feature 9: DRS intercept for LBW during batting
    if (outcome.runs === -1 && outcome.type === 'lbw' && state.drsAvailable &&
        (state.matchPhase === 'batting' || state.matchPhase === 'batting_chase')) {
      state.pendingLBW = true;
      state.pendingOutcome = outcome;
      // Pause delivery progression while DRS is active
      deliveryPhase = 'idle';
      state.waitingForNext = false;
      showDRSPrompt();
      return;
    }

    // Feature 10: Run-out on doubles/triples
    if (outcome.runs === 2 || outcome.runs === 3) {
      const runoutChance = (outcome.runs === 2 ? 0.04 : 0.08) + (outcome._quality === 'mistimed' ? 0.03 : 0);
      if (Math.random() < runoutChance) {
        // Runs still count, but wicket is lost
        processRunOut(outcome);
        return;
      }
    }

    if (outcome.runs === -1) {
      // WICKET
      state.wickets++;
      state.currentOverResults.push({ runs: 0, isWicket: true, isFour: false, isSix: false });
      state.consecutiveScoringBalls = 0;

      if (outcome.type === 'lbw') {
        // LBW: ball hitting pad sound then ascending umpire tone
        playTone(120, 'sine', 0.15, 0.1); // low thud (pad)
        setTimeout(() => {
          playTone(400, 'sine', 0.1, 0.06);
          setTimeout(() => playTone(600, 'sine', 0.15, 0.08), 100);
        }, 150);
        state.postBallActive = true;
        state.postBallType = 'wicket';
        state.postBallTime = Date.now();
        spawnFloatingText('LBW!', textX, textBaseY, '#FF6600', 32);
        showBallCommentary({ runs: -1, type: 'lbw' }, false);
      } else if (outcome.type === 'stumped') {
        // Feature 5: Stumping — quick stumps rattle + keeper animation
        playStumpsHit(); // shorter stumps sound
        triggerStumpScatter();
        state.postBallActive = true;
        state.postBallType = 'wicket';
        state.postBallTime = Date.now();
        state.keeperCatchAnim = true;
        state.keeperCatchAnimStart = Date.now();
        spawnFloatingText('STUMPED!', textX, textBaseY, '#E8000D', 32);
        showBallCommentary({ runs: -1, type: 'stumped' }, false);
      } else if (outcome.type === 'caught_behind') {
        // Feature 1: Caught behind — thin edge sound + keeper animation
        playTone(3000, 'sine', 0.03, 0.1); // thin edge click
        setTimeout(() => playCrowdReaction('groan'), 100);
        state.postBallActive = true;
        state.postBallType = 'caught';
        state.postBallTime = Date.now();
        state.postBallX = 0;
        state.postBallY = 1;
        state.postBallVx = (Math.random() - 0.5) * 3;
        state.postBallSize = 6;
        state.keeperCatchAnim = true;
        state.keeperCatchAnimStart = Date.now();
        spawnFloatingText('CAUGHT BEHIND!', textX, textBaseY, '#FF8C00', 30);
        showBallCommentary({ runs: -1, type: 'caught_behind' }, false);
      } else if (outcome.type === 'bowled') {
        playStumpsHit();
        triggerStumpScatter();
        state.postBallActive = true;
        state.postBallType = 'wicket';
        state.postBallTime = Date.now();
      } else {
        playBatCrack(0);
        state.postBallActive = true;
        state.postBallType = 'caught';
        state.postBallTime = Date.now();
        state.postBallX = 0;
        state.postBallY = 1;
        state.postBallVx = (Math.random() - 0.5) * 3;
        state.postBallSize = 6;
      }

      // Camera shake for wicket
      if (!reducedMotion) cameraShake.active = true;
      cameraShake.start = Date.now();
      cameraShake.duration = 300;
      cameraShake.intensity = 0.1;

      playCrowdReaction('groan');
      if (outcome.type !== 'lbw' && outcome.type !== 'caught_behind' && outcome.type !== 'stumped') {
        spawnFloatingText('OUT!', textX, textBaseY, '#E8000D', 32);
      }

      if (!reducedMotion) gameWrap.classList.add('cb-wicket-flash');
      setTimeout(() => gameWrap.classList.remove('cb-wicket-flash'), 500);

      haptic([100]);
      state.comboStreak = 0;
      // Feature 3: Reset confidence on wicket (new batsman nervous)
      state.confidence = 30;
      // Patch #24: Detailed wicket announcement
      const wicketTypeLabel = outcome.type === 'lbw' ? 'LBW' : outcome.type === 'caught_behind' ? 'Caught Behind' : outcome.type === 'stumped' ? 'Stumped' : outcome.type;
      announceScore(`OUT! ${wicketTypeLabel}. ${3 - state.wickets} wicket${3 - state.wickets !== 1 ? 's' : ''} remaining. Score: ${state.runs} for ${state.wickets}.`);
      if (outcome.type !== 'lbw' && outcome.type !== 'caught_behind' && outcome.type !== 'stumped') showBallCommentary(outcome, false);

      if (state.wickets < 3) {
        state.newBatsmanAnim = true;
        state.newBatsmanTime = Date.now() + 400;
        // New batsman name
        state.batsmanName = BOWLER_FIRST[Math.floor(Math.random() * BOWLER_FIRST.length)].charAt(0) + '. ' +
                            BOWLER_LAST[Math.floor(Math.random() * BOWLER_LAST.length)];
        state.batsmanRuns = 0;
        state.batsmanBalls = 0;
      }

      updateHUD();
      return;
    }

    // Runs scored
    let runs = outcome.runs;
    const rawRuns = runs;
    // Feature 2: Phase-based multiplier
    const phase = getMatchPhaseForOver(state.oversCompleted);
    if (phase.label === 'POWERPLAY' && runs > 0) {
      runs = Math.round(runs * phase.multiplier);
    }
    // Feature 2: Death over boundary bonus
    if (phase.label === 'DEATH OVER' && rawRuns === 4) {
      runs = rawRuns + 1; // 4s get +1 extra
    } else if (phase.label === 'DEATH OVER' && rawRuns === 6) {
      runs = rawRuns + 2; // 6s get +2 extra
    }
    // Combo streak bonus: 1.5x on boundaries at streak 5+
    if (state.comboStreak >= 5 && (rawRuns === 4 || rawRuns === 6)) {
      runs = Math.round(runs * 1.5);
    }
    state.runs += runs;
    state.batsmanRuns = (state.batsmanRuns || 0) + runs;
    state.currentOverRuns += runs;
    state.currentOverResults.push({ runs, rawRuns, isWicket: false, isFour: rawRuns === 4, isSix: rawRuns === 6 });

    // Feature 7: Track wagon wheel shot
    state.wagonWheelShots.push({ direction: state.shotDirection, runs: rawRuns });

    // Feature 3: Confidence adjustments
    if (rawRuns === 6) state.confidence = Math.min(100, state.confidence + 12);
    else if (rawRuns === 4) state.confidence = Math.min(100, state.confidence + 8);
    else if (rawRuns >= 1) state.confidence = Math.min(100, state.confidence + 3);
    else state.confidence = Math.max(0, state.confidence - 5);
    // Feature 3: Check "in the zone" achievement
    if (state.confidence >= 90) checkAchievement('cb_in_the_zone');

    if (runs > 0) {
      state.consecutiveScoringBalls++;
      state.currentOverScoringBalls++;
      state.comboStreak++;
      if (state.comboStreak > state._maxCombo) state._maxCombo = state.comboStreak;
    } else {
      state.consecutiveScoringBalls = 0;
      state.comboStreak = 0;
    }

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
    haptic([15]); // bat contact haptic

    // Post-ball visual
    state.postBallActive = true;
    state.postBallTime = Date.now();
    state.postBallX = 0;
    state.postBallY = 1;
    state.postBallSize = 8;

    if (rawRuns === 4) {
      state.fours++;
      state.postBallType = 'four';
      state.postBallVx = (Math.random() - 0.5) * 2 - 0.3;
      const fourLabel = state.isPowerplay ? 'FOUR! (x1.5)' : 'FOUR!';
      spawnFloatingText(fourLabel, textX, textBaseY - 20, '#FFD700', 32);
      spawnParticles(textX, textBaseY, 25, ['#FFD700', '#FFA500', '#FFFFFF'], 120, 0.8);
      playCrowdReaction('cheer');
      playBoundaryJingle(false);
      haptic([30]);
      // Camera shake for four
      if (!reducedMotion) cameraShake.active = true;
      cameraShake.start = Date.now();
      cameraShake.duration = 200;
      cameraShake.intensity = 0.05;
      checkAchievement('cb_first_four');
      // Crowd jump and bat celebration on four
      state.crowdJumpTime = 0.5;
      state.batCelebration = true;
      state.batCelebrationTimer = 0.8;
    } else if (rawRuns === 6) {
      state.sixes++;
      state.postBallType = 'six';
      state.postBallVx = (Math.random() - 0.5) * 2;
      const sixLabel = state.isPowerplay ? 'SIX! (x1.5)' : 'SIX!';
      spawnFloatingText(sixLabel, textX, textBaseY - 20, '#FF00FF', 38);
      const teamColors = state.selectedTeam ? [TEAMS[state.selectedTeam].primary, TEAMS[state.selectedTeam].secondary] : ['#FF00FF', '#FFD700'];
      spawnParticles(textX, textBaseY, 40, [...teamColors, '#00FFFF', '#FF4444', '#44FF44'], 150, 1.2);
      playCrowdReaction('roar');
      playBoundaryJingle(true);
      haptic([30, 15, 50]);
      // Camera shake for six
      if (!reducedMotion) cameraShake.active = true;
      cameraShake.start = Date.now();
      cameraShake.duration = 400;
      cameraShake.intensity = 0.15;
      checkAchievement('cb_first_six');
      // Feature 2: Death over six achievement
      if (state.oversCompleted >= 4) checkAchievement('cb_death_over_six');
      triggerCrowdWave();
      // Crowd jump and bat celebration on six
      state.crowdJumpTime = 0.5;
      state.batCelebration = true;
      state.batCelebrationTimer = 0.8;
    } else if (runs === 0) {
      state.postBallType = 'default';
      state.postBallVx = (Math.random() - 0.5);
      // Patch #22: Near-miss feedback (30% chance on dot balls that are not on stumps)
      if (!state.ballIsOnStumps && Math.random() < 0.3) {
        const nearMissText = Math.random() < 0.5 ? 'CLOSE!' : 'BEATEN!';
        spawnFloatingText(nearMissText, textX, textBaseY, 'rgba(255,255,0,0.5)', 24);
        playNearMissSound();
        if (!reducedMotion) cameraShake.active = true;
        cameraShake.start = Date.now();
        cameraShake.duration = 150;
        cameraShake.intensity = 0.02;
      } else {
        spawnFloatingText('DOT', textX, textBaseY, 'rgba(255,255,255,0.6)', 20);
      }
    } else {
      state.postBallType = 'default';
      state.postBallVx = (Math.random() - 0.5) * 1.5;
      spawnFloatingText(runs.toString(), textX, textBaseY, '#FFFFFF', 24);
    }

    // Milestone checks
    if (state.runs >= 50 && state.runs - runs < 50) {
      spawnFloatingText('FIFTY!', textX, textBaseY - 60, '#FFD700', 36);
      spawnParticles(textX, textBaseY - 40, 50, ['#FFD700'], 100, 1.5);
      checkAchievement('cb_fifty');
    }
    if (state.runs >= 100 && state.runs - runs < 100) {
      spawnFloatingText('CENTURY!', textX, textBaseY - 60, '#FFD700', 40);
      spawnParticles(textX, textBaseY - 40, 80, ['#FFD700', '#FF00FF', '#00FFFF'], 150, 2);
      checkAchievement('cb_century');
    }

    if (state.currentOverScoringBalls >= 6 && state.ballsInOver === 6) {
      checkAchievement('cb_perfect_over');
    }

    const announceText = runs === 0 ? 'Dot ball.' : `${runs} run${runs > 1 ? 's' : ''}.`;
    announceScore(`${announceText} Total: ${state.runs} for ${state.wickets}.`);

    const sbScoreEl = $('sbScore');
    if (sbScoreEl) { sbScoreEl.classList.add('cb-score-pop'); setTimeout(() => sbScoreEl.classList.remove('cb-score-pop'), 300); }

    showBallCommentary(outcome, false);
    updateHUD();

    // Check if player chased down target (bowl-first mode or super over)
    if (state.matchPhase === 'batting_chase' && state.runs >= state.target) {
      const ballsRemaining = Math.max(0, 30 - state.totalBallsFaced);
      if (ballsRemaining >= 10) checkAchievement('cb_target_crushed');
      spawnFloatingText('TARGET CHASED!', textX, textBaseY - 80, '#4CAF50', 28);
      playCrowdReaction('roar');
      // End batting immediately after short delay
      setTimeout(() => {
        state.battingScore = state.runs;
        state.battingWickets = state.wickets;
        state.battingFours = state.fours;
        state.battingSixes = state.sixes;
        state.bowlingAIScore = state._bowlFirstAIScore;
        state.bowlingAIWickets = state._bowlFirstAIWickets;
        endMatch();
      }, 1000);
    }
  }

  function triggerStumpScatter() {
    state.stumpScatter = {
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
  // FEATURE 9: DRS REVIEW
  // ============================================

  function showDRSPrompt() {
    const prompt = $('drsPrompt');
    if (!prompt) return;
    // Reset timer animation
    const timer = prompt.querySelector('.cb-drs-timer');
    if (timer) {
      timer.style.animation = 'none';
      // force reflow
      void timer.offsetWidth;
      timer.style.animation = 'drsShrink 3s linear forwards';
    }
    prompt.style.display = 'block';

    state.drsTimeout = setTimeout(() => {
      hideDRSPrompt();
      if (state.pendingLBW) {
        state.pendingLBW = false;
        processWicketFromLBW(state.pendingOutcome);
      }
    }, 3000);

    prompt.onclick = function() { triggerDRS(); };
  }

  function hideDRSPrompt() {
    const prompt = $('drsPrompt');
    if (prompt) {
      prompt.style.display = 'none';
      prompt.onclick = null;
    }
  }

  function triggerDRS() {
    clearTimeout(state.drsTimeout);
    hideDRSPrompt();
    state.drsAvailable = false;
    state.pendingLBW = false;

    const overlay = $('drsOverlay');
    const result = $('drsResult');
    const pitchView = $('drsPitchView');
    const title = $('drsTitle');

    if (!overlay || !result || !pitchView) return;

    const isReversed = Math.random() < 0.35;
    if (title) title.textContent = 'BALL TRACKING';
    pitchView.innerHTML = generateDRSSvg(isReversed);
    result.textContent = '';
    result.style.color = '';
    overlay.classList.add('cb-visible');

    setTimeout(() => {
      if (isReversed) {
        result.textContent = 'MISSING! NOT OUT!';
        result.style.color = '#4CAF50';
        playCrowdReaction('cheer');
        checkAchievement('cb_drs_hero');
      } else {
        result.textContent = 'HITTING! OUT!';
        result.style.color = '#F44336';
        playCrowdReaction('groan');
      }

      setTimeout(() => {
        overlay.classList.remove('cb-visible');
        if (!isReversed) {
          processWicketFromLBW(state.pendingOutcome);
        } else {
          spawnFloatingText('NOT OUT!', W / 2, H * 0.4, '#4CAF50', 28);
          state.ballActive = false;
          deliveryPhase = 'idle';
          setTimeout(() => {
            if (state.ballsInOver >= 6) {
              endOver();
            } else {
              startDelivery();
            }
          }, 1000);
        }
      }, 2000);
    }, 2000);
  }

  function processWicketFromLBW(outcome) {
    // Process the LBW wicket that was pending during DRS
    state.wickets++;
    state.currentOverResults.push({ runs: 0, isWicket: true, isFour: false, isSix: false });
    state.consecutiveScoringBalls = 0;

    const textX = W / 2;
    const textBaseY = H * 0.4;

    // LBW sound
    playTone(120, 'sine', 0.15, 0.1);
    setTimeout(() => {
      playTone(400, 'sine', 0.1, 0.06);
      setTimeout(() => playTone(600, 'sine', 0.15, 0.08), 100);
    }, 150);
    state.postBallActive = true;
    state.postBallType = 'wicket';
    state.postBallTime = Date.now();
    spawnFloatingText('LBW!', textX, textBaseY, '#FF6600', 32);
    showBallCommentary({ runs: -1, type: 'lbw' }, false);

    if (!reducedMotion) cameraShake.active = true;
    cameraShake.start = Date.now();
    cameraShake.duration = 300;
    cameraShake.intensity = 0.1;

    playCrowdReaction('groan');
    if (!reducedMotion) gameWrap.classList.add('cb-wicket-flash');
    setTimeout(() => gameWrap.classList.remove('cb-wicket-flash'), 500);

    haptic([100]);
    state.comboStreak = 0;
    state.confidence = 30;

    const wicketTypeLabel = 'LBW';
    announceScore(`OUT! ${wicketTypeLabel}. ${3 - state.wickets} wicket${3 - state.wickets !== 1 ? 's' : ''} remaining. Score: ${state.runs} for ${state.wickets}.`);

    if (state.wickets < 3) {
      state.newBatsmanAnim = true;
      state.newBatsmanTime = Date.now() + 400;
    }

    updateHUD();

    // After processing, check if all out
    deliveryPhase = 'resolved';
    deliveryTimer = 0;
  }

  function generateDRSSvg(isReversed) {
    const endX = isReversed ? 35 : 60;
    return '<svg viewBox="0 0 120 180" width="120" height="180" style="display:block;margin:0 auto;">' +
      '<rect x="10" y="10" width="100" height="160" fill="#c8a96e" rx="4" opacity="0.3"/>' +
      '<rect x="50" y="150" width="20" height="4" fill="#D4A87C" rx="1"/>' +
      '<line x1="55" y1="155" x2="55" y2="148" stroke="#D4A87C" stroke-width="1.5"/>' +
      '<line x1="60" y1="155" x2="60" y2="148" stroke="#D4A87C" stroke-width="1.5"/>' +
      '<line x1="65" y1="155" x2="65" y2="148" stroke="#D4A87C" stroke-width="1.5"/>' +
      '<circle cx="60" cy="20" r="4" fill="#cc0000"/>' +
      '<line x1="60" y1="24" x2="' + endX + '" y2="150" stroke="#cc0000" stroke-width="2" stroke-dasharray="4 4">' +
        '<animate attributeName="stroke-dashoffset" from="200" to="0" dur="1.5s" fill="freeze"/>' +
      '</line>' +
      '<circle cx="' + endX + '" cy="150" r="5" fill="' + (isReversed ? '#4CAF50' : '#F44336') + '" opacity="0">' +
        '<animate attributeName="opacity" from="0" to="1" begin="1.5s" dur="0.3s" fill="freeze"/>' +
      '</circle>' +
      '<text x="60" y="175" text-anchor="middle" font-size="10" fill="' + (isReversed ? '#4CAF50' : '#F44336') + '" opacity="0">' +
        (isReversed ? 'MISSING' : 'HITTING') +
        '<animate attributeName="opacity" from="0" to="1" begin="1.8s" dur="0.2s" fill="freeze"/>' +
      '</text>' +
    '</svg>';
  }

  // ============================================
  // FEATURE 10: RUN-OUT PROCESSING
  // ============================================

  function processRunOut(outcome) {
    const textX = W / 2;
    const textBaseY = H * 0.4;
    const runs = outcome.runs;

    // Runs still count
    state.runs += runs;
    state.currentOverRuns += runs;
    state.currentOverResults.push({ runs, rawRuns: runs, isWicket: true, isFour: false, isSix: false });

    // But wicket is also lost
    state.wickets++;

    // Track wagon wheel shot
    state.wagonWheelShots.push({ direction: state.shotDirection, runs: runs });

    spawnFloatingText('RUN OUT!', textX, textBaseY - 40, '#FF6600', 26);
    spawnFloatingText(runs.toString(), textX, textBaseY, '#FFFFFF', 24);

    // Fielder throw sound then stumps hit
    playTone(800, 'sine', 0.08, 0.06);
    setTimeout(() => playStumpsHit(), 200);
    triggerStumpScatter();

    // Camera shake
    if (!reducedMotion) cameraShake.active = true;
    cameraShake.start = Date.now();
    cameraShake.duration = 300;
    cameraShake.intensity = 0.1;

    playCrowdReaction('groan');
    if (!reducedMotion) gameWrap.classList.add('cb-wicket-flash');
    setTimeout(() => gameWrap.classList.remove('cb-wicket-flash'), 500);

    haptic([100]);
    state.comboStreak = 0;
    state.confidence = 30;
    showBallCommentary({ runs: -1, type: 'runout' }, false);
    announceScore(`RUN OUT! ${runs} run${runs > 1 ? 's' : ''} scored but wicket lost. ${3 - state.wickets} remaining. Score: ${state.runs} for ${state.wickets}.`);

    if (state.wickets < 3) {
      state.newBatsmanAnim = true;
      state.newBatsmanTime = Date.now() + 400;
    }

    // Bat swing animation
    state.batAnimating = true;
    state.batAnimStart = Date.now();
    state.batAnimType = state.shotDirection;
    state.batAnimDuration = 200;
    playBatCrack(2);

    state.postBallActive = true;
    state.postBallTime = Date.now();
    state.postBallType = 'default';
    state.postBallX = 0;
    state.postBallY = 1;
    state.postBallVx = (Math.random() - 0.5) * 1.5;
    state.postBallSize = 8;

    updateHUD();

    // Set delivery phase so game continues
    deliveryPhase = 'resolved';
    deliveryTimer = 0;
  }

  // ============================================
  // FEATURE 11: PITCH DETERIORATION (3D cracks)
  // ============================================

  function addPitchCracks() {
    for (let i = 0; i < 5; i++) {
      const crackGeo = new THREE.BoxGeometry(0.02, 0.001, 0.3 + Math.random() * 0.4);
      const crackMat = new THREE.MeshBasicMaterial({ color: 0x5a4020, transparent: true, opacity: 0.4 });
      const crack = new THREE.Mesh(crackGeo, crackMat);
      crack.rotation.x = -Math.PI / 2;
      crack.rotation.z = (Math.random() - 0.5) * 0.5;
      crack.position.set(
        (Math.random() - 0.5) * 2,
        0.016,
        11 + (Math.random() - 0.5) * 10
      );
      scene.add(crack);
      state.pitchCracks.push(crack);
    }
  }

  function removePitchCracks() {
    state.pitchCracks.forEach(c => scene.remove(c));
    state.pitchCracks = [];
  }

  // ============================================
  // OVER / LEVEL / GAME END
  // ============================================

  function endOver() {
    if (state.currentOverRuns > state.bestOverRuns) {
      state.bestOverRuns = state.currentOverRuns;
    }

    // Feature 8: Track runs per over for manhattan chart
    state.overRunHistory.push(state.currentOverRuns);

    state.oversCompleted++;
    playCrowdClap();
    playUISound('overComplete');

    // Super over: only 1 over, so end after first over
    if (state.superOver && state.superOverPhase === 'batting') {
      endGame();
      return;
    }

    if (state.oversCompleted >= 5) {
      // Batting innings complete -- transition to innings break or endGame
      if (state.matchPhase === 'batting_chase') {
        endGame();
      } else {
        transitionToInningsBreak();
      }
      return;
    }

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

    let commentary = pickRandom(COMMENTARY.overEnd);
    // Feature 6: Pressure-based commentary prefix
    const pressure = getMatchPressure();
    if (pressure > 70) {
      const tensionPrefix = pickRandom(["The crowd is on edge! ", "Tension building! ", "Nerves all around! "]);
      commentary = tensionPrefix + commentary;
    }

    // Feature 2: Next over phase label
    const nextPhase = getMatchPhaseForOver(state.oversCompleted);

    generateBowlerForOver();

    overModal.innerHTML = `
      <h2>End of Over ${state.oversCompleted}</h2>
      <div class="cb-over-summary">${ballsHtml}</div>
      <div class="cb-stat-row"><span>Runs this over</span><span>${state.currentOverRuns}</span></div>
      <div class="cb-stat-row"><span>Score</span><span>${state.runs}/${state.wickets}</span></div>
      <div class="cb-rate-compare">
        <div class="cb-rate-item">
          <span class="label">Run Rate</span>
          <span class="value">${rr}</span>
        </div>
        <div class="cb-rate-item">
          <span class="label">Overs Left</span>
          <span class="value">${5 - state.oversCompleted}</span>
        </div>
      </div>
      ${drawWagonWheel()}
      ${drawManhattan()}
      <p class="cb-commentary">"${commentary}"</p>
      <div style="text-align:center;margin:4px 0;"><span style="color:${nextPhase.color};font-weight:700;font-size:0.8rem;">Next: ${nextPhase.label}</span></div>
      <div class="cb-over-bowler">Next: ${state.bowlerName}</div>
      <div class="cb-over-bowler-type">${state.bowlerType}</div>
      <button class="cb-btn" onclick="window._cbNextOver()">NEXT OVER &rarr;</button>
      <p class="cb-countdown" id="overCountdown">Auto-continuing in 5s</p>
    `;

    overOverlay.classList.add('cb-visible');

    // Patch #24: Between-overs SR announcement
    const rrVal = state.totalBallsFaced > 0 ? (state.runs / (state.totalBallsFaced / 6)).toFixed(2) : '0.00';
    announceSR(`End of over ${state.oversCompleted}. Score: ${state.runs} for ${state.wickets}. Run rate: ${rrVal}.`);

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

    state.phase = 'BATTING';
    state.ballsInOver = 0;
    state.currentOverRuns = 0;
    state.currentOverResults = [];
    state.consecutiveScoringBalls = 0;
    state.currentOverScoringBalls = 0;
    gameWrap.classList.add('cb-playing');

    showBowlerIntro();
    setTimeout(() => startDelivery(), 1200);
  }

  // ============================================
  // INNINGS BREAK & BOWLING TRANSITION
  // ============================================

  function transitionToInningsBreak() {
    state.phase = 'INNINGS_BREAK';
    state.matchPhase = 'bowling';
    gameWrap.classList.remove('cb-playing');

    // Save batting stats
    state.battingScore = state.runs;
    state.battingWickets = state.wickets;
    state.battingFours = state.fours;
    state.battingSixes = state.sixes;

    // Save first innings over history for worm chart comparison
    state.firstInningsOverHistory = state.overRunHistory.slice();

    if (state.wickets === 0 && state.totalBallsFaced >= 6) checkAchievement('cb_no_wicket');

    playUISound('overComplete');

    const aiTarget = state.battingScore + 1;

    if (!inningsBreakOverlay) {
      inningsBreakOverlay = $('inningsBreakOverlay');
      inningsBreakModal = $('inningsBreakModal');
    }

    inningsBreakModal.innerHTML = `
      <h2>YOUR INNINGS</h2>
      <div class="cb-final-score" style="font-size:2.5rem;margin:8px 0;">${state.battingScore} / ${state.battingWickets}</div>
      <div class="cb-stats-grid" style="margin:12px 0;">
        <div class="stat-item"><span class="stat-value">5.0</span><span class="stat-label">Overs</span></div>
        <div class="stat-item"><span class="stat-value">${state.battingFours}</span><span class="stat-label">Fours</span></div>
        <div class="stat-item"><span class="stat-value">${state.battingSixes}</span><span class="stat-label">Sixes</span></div>
      </div>
      <p style="color:var(--cb-accent);font-size:1.1rem;font-weight:700;margin:16px 0 4px;">Now defend ${state.battingScore}!</p>
      <p style="color:var(--cb-text-dim);font-size:0.85rem;margin:0 0 16px;">AI needs ${aiTarget} to win</p>
      <button class="cb-btn" onclick="window._cbStartBowling()">START BOWLING</button>
    `;

    inningsBreakOverlay.classList.add('cb-visible');
  }

  // Transition from bowling-first to batting chase (bowl-first mode)
  function transitionToBattingChase() {
    state.phase = 'INNINGS_BREAK';
    state.matchPhase = 'batting';
    gameWrap.classList.remove('cb-playing');
    gameWrap.classList.remove('cb-bowling');

    // Hide bowling UI
    if (bowlingPanel) bowlingPanel.style.display = 'none';
    if (bowlingMeter) bowlingMeter.style.display = 'none';
    if (scoreboardBowl) scoreboardBowl.style.display = 'none';

    // The AI's score becomes the target the player needs to chase
    // state.bowlingAIScore is what AI scored, player needs bowlingAIScore + 1
    const aiScore = state.bowlingAIScore;
    const aiWickets = state.bowlingAIWickets;

    // Save AI's first innings over history for worm chart
    state.firstInningsOverHistory = state.overRunHistory.slice();

    // Store AI batting stats
    state.battingScore = 0; // Will be updated as player bats
    state.battingWickets = 0;
    state.battingFours = 0;
    state.battingSixes = 0;

    // AI's score is now the target
    state.target = aiScore + 1;

    playUISound('overComplete');
    setDayEnvironment();

    if (!inningsBreakOverlay) {
      inningsBreakOverlay = $('inningsBreakOverlay');
      inningsBreakModal = $('inningsBreakModal');
    }

    const oppTeam = TEAMS[state.opponentTeam];
    inningsBreakModal.innerHTML = `
      <h2>AI INNINGS COMPLETE</h2>
      <div class="cb-final-score" style="font-size:2.5rem;margin:8px 0;">${aiScore} / ${aiWickets}</div>
      <div class="cb-stats-grid" style="margin:12px 0;">
        <div class="stat-item"><span class="stat-value">5.0</span><span class="stat-label">Overs</span></div>
        <div class="stat-item"><span class="stat-value">${state.bowlingWides}</span><span class="stat-label">Wides</span></div>
        <div class="stat-item"><span class="stat-value">${state.bowlingNoBalls}</span><span class="stat-label">No Balls</span></div>
      </div>
      ${state.bowlingExtras > 0 ? `<p style="color:var(--cb-text-dim);font-size:0.85rem;margin:4px 0;">Extras: ${state.bowlingExtras} (${state.bowlingWides}w, ${state.bowlingNoBalls}nb)</p>` : ''}
      <p style="color:var(--cb-accent);font-size:1.1rem;font-weight:700;margin:16px 0 4px;">Chase ${aiScore + 1} to win!</p>
      <p style="color:var(--cb-text-dim);font-size:0.85rem;margin:0 0 16px;">You need ${aiScore + 1} runs from 5 overs</p>
      <button class="cb-btn" onclick="window._cbStartBattingChase()">START BATTING</button>
    `;

    inningsBreakOverlay.classList.add('cb-visible');

    // Store the AI's first-innings score for endMatch calculations
    state._bowlFirstAIScore = aiScore;
    state._bowlFirstAIWickets = aiWickets;
  }

  function startBattingChase() {
    if (!inningsBreakOverlay) return;
    inningsBreakOverlay.classList.remove('cb-visible');

    // Reset for 2nd innings worm chart
    state.overRunHistory = [];

    // Update fielder jerseys and positions — opponent is fielding
    updateFielderColors();
    repositionFielders(false); // batting positions

    // Reset batting state
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
    state.shotDirection = 'straight';
    state.postBallActive = false;
    state.stumpScatter = null;
    state.particles = [];
    state.floatingTexts = [];
    state.isPowerplay = true;
    state.comboStreak = 0;
    state._maxCombo = 0;
    state.newBatsmanAnim = false;
    state.batAnimating = false;
    state.bowlerAnimating = false;
    // Feature resets for batting chase
    state.confidence = 50;
    state.bowlerConsecutiveSameType = 0;
    state.lastDeliveryType = null;
    state.wagonWheelShots = [];
    state.overRunHistory = [];
    // Keep firstInningsOverHistory — it has 1st innings data for worm chart comparison
    state.keeperCatchAnim = false;
    // Phase 2 resets for new innings
    state.drsAvailable = true;
    state.pendingLBW = false;
    state.pendingOutcome = null;
    if (state.drsTimeout) clearTimeout(state.drsTimeout);
    state.drsTimeout = null;
    state.pitchDeteriorated = false;
    removePitchCracks();
    state.timeoutUsed = false;
    deliveryPhase = 'idle';
    deliveryTimer = 0;

    // Switch phase
    setDayEnvironment();
    state.phase = 'BATTING';
    state.matchPhase = 'batting_chase';
    gameWrap.classList.add('cb-playing');
    gameWrap.classList.remove('cb-bowling');

    // Show batting HUD, hide bowling
    if (scoreboardBat) scoreboardBat.style.display = '';
    if (scoreboardBowl) scoreboardBowl.style.display = 'none';
    if (bowlingPanel) bowlingPanel.style.display = 'none';
    if (bowlingMeter) bowlingMeter.style.display = 'none';

    // Make batting 3D objects visible
    batsmanGroup.visible = true;
    bowlerGroup.visible = true;
    if (aiBatsmanGroup) aiBatsmanGroup.visible = false;

    // Reset scatter
    scatterStumps.forEach(s => scene.remove(s));
    scatterBails.forEach(b => scene.remove(b));
    scatterStumps = [];
    scatterBails = [];

    updateHUD();
    generateBowlerForOver();
    showBowlerIntro();
    // Show batting tutorial on first ever play, then start delivery
    setTimeout(() => {
      if (!showTutorial('batting')) {
        startDelivery();
      }
    }, 1200);
  }

  function startBowlingInnings() {
    if (!inningsBreakOverlay) return;
    inningsBreakOverlay.classList.remove('cb-visible');

    // Reset for 2nd innings worm chart
    state.overRunHistory = [];

    // Update fielder jerseys and positions — YOUR team is fielding
    updateFielderColors();
    repositionFielders(true); // bowling positions

    // Reset bowling state
    state.bowlingAIScore = 0;
    state.bowlingAIWickets = 0;
    state.bowlingOversCompleted = 0;
    state.bowlingBallsInOver = 0;
    state.bowlingTotalBalls = 0;
    state.bowlingCurrentOverRuns = 0;
    state.bowlingCurrentOverResults = [];
    state.selectedDelivery = 'straight';
    state.selectedLine = 'middle';
    state.meterActive = false;
    state.meterPosition = 0;
    state.meterStopped = false;
    state.meterDirection = 1;
    state.deliveryTypeHistory = [];
    state.bowlingDeliveryPhase = 'selecting';
    state.bowlingResultTimer = 0;
    state.yorkerWickets = 0;
    state.bowlingBestOverRuns = 0;
    state.lastTwoDeliveryFast = false;
    state.bowlingWides = 0;
    state.bowlingNoBalls = 0;
    state.bowlingExtras = 0;
    state.freeHitNext = false;
    state.bowlingDeliveryRepeatCount = {};
    state.postBallActive = false;
    state.stumpScatter = null;
    state.particles = [];
    state.floatingTexts = [];
    // Phase 2 resets for bowling innings
    state.drsAvailable = false; // DRS not available while bowling
    state.pendingLBW = false;
    state.pendingOutcome = null;
    state.pitchDeteriorated = false;
    removePitchCracks();
    state.timeoutUsed = false;

    // Keep consistent day match environment across both innings
    setDayEnvironment();

    // Build bowling-specific 3D objects if not yet built
    buildBowlingScene();

    // Show bowling UI, hide batting UI
    state.phase = 'BOWLING';
    gameWrap.classList.add('cb-playing');
    gameWrap.classList.add('cb-bowling');

    // Grab bowling DOM refs
    bowlingPanel = $('bowlingPanel');
    bowlingMeter = $('bowlingMeter');
    bowlingMeterFill = $('bowlingMeterFill');
    bowlingMeterIndicator = $('bowlingMeterIndicator');
    // (old bowlingHudTop/Bottom removed -- using scoreboardBowl)

    // Show bowling UI, hide batting
    if (bowlingPanel) bowlingPanel.style.display = 'flex';
    if (bowlingMeter) bowlingMeter.style.display = 'block';
    if (scoreboardBowl) scoreboardBowl.style.display = '';
    if (scoreboardBat) scoreboardBat.style.display = 'none';

    updateBowlingHUD();

    // Show bowling tutorial on first ever bowl
    showTutorial('bowling');
  }

  // ============================================
  // BOWLING 3D SCENE
  // ============================================

  function buildBowlingScene() {
    if (aiBatsmanGroup) return; // already built

    // AI batsman at the batting end (z=0.5)
    aiBatsmanGroup = new THREE.Group();
    aiBatsmanGroup.position.set(0, 0, 0.5);
    aiBatsmanGroup.visible = false;

    const oppTeam = state.opponentTeam ? TEAMS[state.opponentTeam] : { primary: '#666666' };
    const oppColor = new THREE.Color(oppTeam.primary);
    const skinColor = 0xD2A87C;
    const flat = { flatShading: true };

    // --- Shoes ---
    const aiShoeGeo = new THREE.BoxGeometry(0.1, 0.04, 0.14);
    const aiShoeMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0, ...flat });
    const aiSoleGeo = new THREE.BoxGeometry(0.1, 0.015, 0.14);
    const aiSoleMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    const aiShoeL = new THREE.Mesh(aiShoeGeo, aiShoeMat);
    aiShoeL.position.set(-0.12, 0.03, -0.13);
    aiShoeL.add(new THREE.Mesh(aiSoleGeo, aiSoleMat));
    aiShoeL.children[0].position.y = -0.02;
    aiBatsmanGroup.add(aiShoeL);
    const aiShoeR = new THREE.Mesh(aiShoeGeo.clone(), aiShoeMat.clone());
    aiShoeR.position.set(0.12, 0.03, 0.08);
    aiShoeR.add(new THREE.Mesh(aiSoleGeo.clone(), aiSoleMat.clone()));
    aiShoeR.children[0].position.y = -0.02;
    aiBatsmanGroup.add(aiShoeR);

    // --- Legs with Pads ---
    const aiThighGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.3, 8);
    const aiThighMat = new THREE.MeshLambertMaterial({ color: oppColor, ...flat });
    const aiPadGeo = new THREE.BoxGeometry(0.12, 0.3, 0.08);
    const aiPadMat = new THREE.MeshLambertMaterial({ color: 0xf5f5f0, ...flat });
    const aiPadRidgeGeo = new THREE.BoxGeometry(0.04, 0.28, 0.02);
    const aiPadRidgeMat = new THREE.MeshLambertMaterial({ color: 0xeeeee0 });

    const aiLegL = new THREE.Group();
    aiLegL.position.set(-0.12, 0.45, -0.15);
    aiLegL.add(new THREE.Mesh(aiThighGeo, aiThighMat));
    const aiPadL = new THREE.Mesh(aiPadGeo, aiPadMat);
    aiPadL.position.set(0, -0.2, 0.01);
    aiLegL.add(aiPadL);
    const aiPadRL = new THREE.Mesh(aiPadRidgeGeo, aiPadRidgeMat);
    aiPadRL.position.set(0, -0.2, 0.04);
    aiLegL.add(aiPadRL);
    aiLegL.rotation.x = THREE.MathUtils.degToRad(12);
    aiBatsmanGroup.add(aiLegL);

    const aiLegR = new THREE.Group();
    aiLegR.position.set(0.12, 0.45, 0.1);
    aiLegR.add(new THREE.Mesh(aiThighGeo.clone(), aiThighMat.clone()));
    const aiPadR = new THREE.Mesh(aiPadGeo.clone(), aiPadMat.clone());
    aiPadR.position.set(0, -0.2, 0.01);
    aiLegR.add(aiPadR);
    const aiPadRR = new THREE.Mesh(aiPadRidgeGeo.clone(), aiPadRidgeMat.clone());
    aiPadRR.position.set(0, -0.2, 0.04);
    aiLegR.add(aiPadRR);
    aiLegR.rotation.x = THREE.MathUtils.degToRad(-10);
    aiBatsmanGroup.add(aiLegR);

    // --- Torso (LatheGeometry) ---
    const aiTorsoPoints = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.18, 0),
      new THREE.Vector2(0.2, 0.15),
      new THREE.Vector2(0.22, 0.3),
      new THREE.Vector2(0.2, 0.4),
      new THREE.Vector2(0.15, 0.45),
      new THREE.Vector2(0, 0.45),
    ];
    const aiTorsoGeo = new THREE.LatheGeometry(aiTorsoPoints, 12);
    const aiBodyMat = new THREE.MeshLambertMaterial({ color: oppColor, ...flat });
    aiBatsmanBody = new THREE.Mesh(aiTorsoGeo, aiBodyMat);
    aiBatsmanBody.position.y = 0.6;
    aiBatsmanBody.rotation.x = THREE.MathUtils.degToRad(10);
    aiBatsmanGroup.add(aiBatsmanBody);

    // Stripe
    const aiStripeGeo = new THREE.BoxGeometry(0.44, 0.06, 0.44);
    const aiStripeMat = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
    const aiStripe = new THREE.Mesh(aiStripeGeo, aiStripeMat);
    aiStripe.position.set(0, 0.88, -0.02);
    aiStripe.rotation.x = THREE.MathUtils.degToRad(10);
    aiBatsmanGroup.add(aiStripe);

    // --- Arms ---
    const aiUpperArmGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.25, 8);
    const aiForearmGeo = new THREE.CylinderGeometry(0.04, 0.035, 0.22, 8);
    const aiForearmMat = new THREE.MeshLambertMaterial({ color: skinColor, ...flat });
    const aiGloveGeo = new THREE.SphereGeometry(0.04, 8, 6);
    const aiGloveMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });

    // Left arm
    const aiShoulderL = new THREE.Group();
    aiShoulderL.position.set(-0.22, 0.98, -0.02);
    aiShoulderL.rotation.z = THREE.MathUtils.degToRad(18);
    aiShoulderL.rotation.x = THREE.MathUtils.degToRad(10);
    const aiUpArmL = new THREE.Mesh(aiUpperArmGeo, new THREE.MeshLambertMaterial({ color: oppColor, ...flat }));
    aiUpArmL.position.y = -0.12;
    aiShoulderL.add(aiUpArmL);
    const aiElbowL = new THREE.Group();
    aiElbowL.position.set(0, -0.25, 0);
    aiElbowL.rotation.x = THREE.MathUtils.degToRad(-25);
    aiElbowL.add(new THREE.Mesh(aiForearmGeo, aiForearmMat));
    aiElbowL.children[0].position.y = -0.11;
    aiElbowL.add(new THREE.Mesh(aiGloveGeo, aiGloveMat));
    aiElbowL.children[1].position.y = -0.22;
    aiShoulderL.add(aiElbowL);
    aiBatsmanGroup.add(aiShoulderL);

    // Right arm
    const aiShoulderR = new THREE.Group();
    aiShoulderR.position.set(0.22, 0.98, -0.02);
    aiShoulderR.rotation.z = THREE.MathUtils.degToRad(-20);
    aiShoulderR.rotation.x = THREE.MathUtils.degToRad(25);
    const aiUpArmR = new THREE.Mesh(aiUpperArmGeo.clone(), new THREE.MeshLambertMaterial({ color: oppColor, ...flat }));
    aiUpArmR.position.y = -0.12;
    aiShoulderR.add(aiUpArmR);
    const aiElbowR = new THREE.Group();
    aiElbowR.position.set(0, -0.25, 0);
    aiElbowR.rotation.x = THREE.MathUtils.degToRad(-30);
    aiElbowR.add(new THREE.Mesh(aiForearmGeo.clone(), aiForearmMat.clone()));
    aiElbowR.children[0].position.y = -0.11;
    aiElbowR.add(new THREE.Mesh(aiGloveGeo.clone(), aiGloveMat.clone()));
    aiElbowR.children[1].position.y = -0.22;
    aiShoulderR.add(aiElbowR);
    aiBatsmanGroup.add(aiShoulderR);

    // --- Neck ---
    const aiNeckGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.08, 8);
    const aiNeckMat = new THREE.MeshLambertMaterial({ color: skinColor });
    const aiNeck = new THREE.Mesh(aiNeckGeo, aiNeckMat);
    aiNeck.position.y = 1.1;
    aiBatsmanGroup.add(aiNeck);

    // --- Helmet ---
    const aiHelmGeo = new THREE.SphereGeometry(0.2, 12, 8);
    const aiHelmMat = new THREE.MeshLambertMaterial({ color: oppColor, ...flat });
    const aiHelmet = new THREE.Mesh(aiHelmGeo, aiHelmMat);
    aiHelmet.position.y = 1.28;
    aiHelmet.scale.set(1, 0.85, 1);
    aiBatsmanGroup.add(aiHelmet);
    aiBatsmanHelmet = aiHelmet;

    // Visor
    const aiVisorGeo = new THREE.BoxGeometry(0.35, 0.04, 0.15);
    const aiVisorMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const aiVisor = new THREE.Mesh(aiVisorGeo, aiVisorMat);
    aiVisor.position.set(0, 1.2, -0.16);
    aiBatsmanGroup.add(aiVisor);

    // Face guard
    const aiGuardGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.12, 4);
    const aiGuardMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    for (let i = -1; i <= 1; i++) {
      const bar = new THREE.Mesh(aiGuardGeo, aiGuardMat);
      bar.position.set(i * 0.05, 1.14, -0.2);
      aiBatsmanGroup.add(bar);
    }

    // --- Bat (ExtrudeGeometry) ---
    aiBatGroup = new THREE.Group();
    aiBatGroup.position.set(0.3, 1.2, 0);

    const aiHandleGeo = new THREE.CylinderGeometry(0.015, 0.018, 0.25, 8);
    const aiHandleMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const aiHandle = new THREE.Mesh(aiHandleGeo, aiHandleMat);
    aiHandle.position.y = -0.12;
    aiBatGroup.add(aiHandle);

    const aiBatShape = new THREE.Shape();
    aiBatShape.moveTo(-0.04, 0);
    aiBatShape.lineTo(-0.06, 0.3);
    aiBatShape.lineTo(-0.06, 0.4);
    aiBatShape.lineTo(-0.02, 0.45);
    aiBatShape.lineTo(0.02, 0.45);
    aiBatShape.lineTo(0.06, 0.4);
    aiBatShape.lineTo(0.06, 0.3);
    aiBatShape.lineTo(0.04, 0);
    aiBatShape.closePath();
    const aiBladeGeo = new THREE.ExtrudeGeometry(aiBatShape, { depth: 0.03, bevelEnabled: false });
    const aiBladeMat = new THREE.MeshLambertMaterial({ color: 0xD4A87C, ...flat });
    const aiBlade = new THREE.Mesh(aiBladeGeo, aiBladeMat);
    aiBlade.position.set(0, -0.7, -0.015);
    aiBlade.rotation.x = Math.PI;
    aiBatGroup.add(aiBlade);

    aiBatGroup.rotation.z = THREE.MathUtils.degToRad(-30);
    aiBatsmanGroup.add(aiBatGroup);

    scene.add(aiBatsmanGroup);

    // Bowling ball (reuse the existing ball mesh for simplicity -- just control visibility)
    bowlingBallMesh = ballMesh;
    bowlingBallSeam = ballSeam;
    bowlingBallShadow = ballShadow;

    // Pitch target zones (visible on mobile during selecting phase)
    buildPitchTargetZones();
  }

  let pitchTargetZones = [];

  function buildPitchTargetZones() {
    const zoneDefs = [
      { name: 'bouncer', z: -4.5, color: 0xFF0000, opacity: 0.05 },
      { name: 'good',    z: -2.5, color: 0x00FF00, opacity: 0.05 },
      { name: 'yorker',  z: -0.5, color: 0xFFFF00, opacity: 0.05 }
    ];
    zoneDefs.forEach(def => {
      const geo = new THREE.PlaneGeometry(1.5, 2);
      const mat = new THREE.MeshBasicMaterial({
        color: def.color, transparent: true, opacity: def.opacity,
        side: THREE.DoubleSide, depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(0, 0.01, def.z);
      mesh.visible = false;
      mesh._zoneName = def.name;
      mesh._baseOpacity = def.opacity;
      scene.add(mesh);
      pitchTargetZones.push(mesh);
    });
  }

  function updatePitchTargetZones() {
    const showZones = state.phase === 'BOWLING' && state.bowlingDeliveryPhase === 'selecting' && isTouchDevice;
    pitchTargetZones.forEach(z => { z.visible = showZones; });
  }

  function flashPitchZone(tapY) {
    let zoneName = 'good';
    if (tapY < 0.3) zoneName = 'bouncer';
    else if (tapY > 0.7) zoneName = 'yorker';
    const zone = pitchTargetZones.find(z => z._zoneName === zoneName);
    if (!zone) return;
    zone.material.opacity = 0.15;
    setTimeout(() => { zone.material.opacity = zone._baseOpacity; }, 200);
  }

  let bowlingBallProgress = 0;
  let bowlingBallActive = false;
  let bowlingBallStartTime = 0;
  let bowlingBallSpeed = 800;
  let aiBatAnimating = false;
  let aiBatAnimStart = 0;
  let aiBatAnimType = 'defense';
  let bowlingResultOutcome = null;

  function updateBowlingScene(dt) {
    // Show AI batsman, hide player batsman in bowling view
    if (aiBatsmanGroup) aiBatsmanGroup.visible = true;
    batsmanGroup.visible = false;
    bowlerGroup.visible = false; // hide opponent bowler

    // Animate AI bat swing
    if (aiBatAnimating && aiBatGroup) {
      const elapsed = Date.now() - aiBatAnimStart;
      const t = Math.min(1, elapsed / 200);
      const eased = 1 - Math.pow(1 - t, 3);
      let angle;
      switch (aiBatAnimType) {
        case 'big':
          angle = -30 + eased * 180;
          aiBatGroup.rotation.z = THREE.MathUtils.degToRad(angle);
          aiBatGroup.rotation.y = THREE.MathUtils.degToRad(eased * 30);
          break;
        case 'defense':
          angle = -30 + eased * 40;
          aiBatGroup.rotation.z = THREE.MathUtils.degToRad(angle);
          aiBatGroup.rotation.y = 0;
          break;
        default:
          angle = -30 + eased * 120;
          aiBatGroup.rotation.z = THREE.MathUtils.degToRad(angle);
          aiBatGroup.rotation.y = THREE.MathUtils.degToRad(-eased * 45);
      }
      if (t >= 1) {
        aiBatAnimating = false;
        aiBatGroup.rotation.z = THREE.MathUtils.degToRad(-30);
        aiBatGroup.rotation.y = 0;
      }
    }

    // Animate bowling ball (travels from z=20 toward z=0.5)
    if (bowlingBallActive) {
      const elapsed = Date.now() - bowlingBallStartTime;
      bowlingBallProgress = Math.min(1, elapsed / bowlingBallSpeed);

      const startZ = 20;
      const endZ = 0.5;
      const bz = startZ + bowlingBallProgress * (endZ - startZ);

      // Lateral movement based on delivery type
      let lateralX = 0;
      const lineOffset = state.selectedLine === 'off' ? -0.4 : state.selectedLine === 'leg' ? 0.4 : 0;
      if (state.selectedDelivery === 'inswing') {
        lateralX = lineOffset + bowlingBallProgress * 1.2;
      } else if (state.selectedDelivery === 'outswing') {
        lateralX = lineOffset - bowlingBallProgress * 1.2;
      } else {
        lateralX = lineOffset;
      }

      // Height based on delivery
      let yOff = 0.4;
      if (state.selectedDelivery === 'bouncer' && bowlingBallProgress > 0.6) {
        yOff += (bowlingBallProgress - 0.6) / 0.4 * 1.2;
      } else if (state.selectedDelivery === 'yorker') {
        yOff = 0.4 - bowlingBallProgress * 0.3;
      } else {
        if (bowlingBallProgress < 0.5) {
          yOff = 0.4 + (0.5 - Math.abs(bowlingBallProgress - 0.25)) * 0.8;
        } else {
          yOff = 0.4 + (1 - bowlingBallProgress) * 0.3;
        }
      }

      ballMesh.visible = true;
      ballMesh.position.set(lateralX, Math.max(0.15, yOff), bz);
      ballSeam.visible = true;
      ballSeam.position.copy(ballMesh.position);
      // Patch #20: Enhanced ball rotation for bowling
      const bowlSpinMult = (state.selectedDelivery === 'inswing' || state.selectedDelivery === 'outswing') ? 25 : 15;
      ballSeam.rotation.x += 0.016 * bowlSpinMult;
      ballMesh.rotation.z += 0.016 * 8;
      ballShadow.visible = true;
      ballShadow.position.set(lateralX, 0.01, bz);

      // Sync ball glow light
      if (ballGlowLight) {
        ballGlowLight.visible = true;
        ballGlowLight.position.copy(ballMesh.position);
      }

      // When ball reaches batsman, resolve
      if (bowlingBallProgress >= 1 && state.bowlingDeliveryPhase === 'bowling') {
        resolveBowlingOutcome();
      }
    } else {
      if (state.phase === 'BOWLING') {
        ballMesh.visible = false;
        ballSeam.visible = false;
        ballShadow.visible = false;
        if (ballGlowLight) ballGlowLight.visible = false;
      }
    }

    // Post-ball animation
    if (state.postBallActive) {
      updatePostBall(dt);
    } else {
      postBallMesh.visible = false;
    }

    // Stump scatter (for bowled wickets)
    if (state.stumpScatter) {
      updateStumpScatter(dt);
    }

    updateFloatingTexts(dt);
    if (!reducedMotion) updateCrowdColors();
  }

  // ============================================
  // BOWLING GAMEPLAY
  // ============================================

  function updateBowlingMeter(dt) {
    if (!state.meterActive || state.meterStopped) return;

    // Oscillate position 0 -> 1 -> 0
    state.meterPosition += state.meterDirection * dt * 2.5; // speed of oscillation
    if (state.meterPosition >= 1) {
      state.meterPosition = 1;
      state.meterDirection = -1;
    } else if (state.meterPosition <= 0) {
      state.meterPosition = 0;
      state.meterDirection = 1;
    }

    // Update meter indicator visual
    if (bowlingMeterIndicator) {
      bowlingMeterIndicator.style.bottom = (state.meterPosition * 100) + '%';
    }

    // Accessibility: announce zone changes for screen readers
    const pos = state.meterPosition;
    const zone = (pos >= 0.35 && pos <= 0.65) ? 'green' : (pos >= 0.2 && pos <= 0.8) ? 'yellow' : 'red';
    if (zone !== state._lastMeterZone) {
      state._lastMeterZone = zone;
      if (zone === 'green') announceSR('Green zone — bowl now!');
    }
  }

  function getMeterAccuracy() {
    // Green zone: 0.35 - 0.65 (center)
    // Yellow zone: 0.2-0.35 and 0.65-0.8
    // Red zone: 0-0.2 and 0.8-1
    const pos = state.meterPosition;
    if (pos >= 0.35 && pos <= 0.65) return 'perfect';
    if (pos >= 0.2 && pos <= 0.8) return 'good';
    return 'bad';
  }

  function selectDeliveryType(type) {
    if (state.phase !== 'BOWLING') return;
    if (state.bowlingDeliveryPhase !== 'selecting') return;
    state.selectedDelivery = type;
    updateBowlingHUD();
    playUISound('select');
  }

  function selectLine(line) {
    if (state.phase !== 'BOWLING') return;
    if (state.bowlingDeliveryPhase !== 'selecting' && state.bowlingDeliveryPhase !== 'meter') return;
    state.selectedLine = line;
    updateBowlingHUD();
  }

  function startBowlingMeter() {
    if (state.phase !== 'BOWLING') return;
    if (state.bowlingDeliveryPhase !== 'selecting') return;

    state.bowlingDeliveryPhase = 'meter';
    state.meterActive = true;
    state.meterStopped = false;
    state.meterPosition = 0;
    state.meterDirection = 1;

    if (bowlingMeter) bowlingMeter.classList.add('active');
  }

  function stopBowlingMeter() {
    if (state.phase !== 'BOWLING') return;
    if (state.bowlingDeliveryPhase !== 'meter') return;

    state.meterStopped = true;
    state.meterActive = false;

    if (bowlingMeter) bowlingMeter.classList.remove('active');

    // Start the bowling delivery animation
    state.bowlingDeliveryPhase = 'bowling';
    bowlingBallActive = true;
    bowlingBallStartTime = Date.now();
    bowlingBallProgress = 0;
    bowlingBallSpeed = 800;

    haptic([10]); // bowling release haptic

    // Perfect accuracy haptic
    const accuracy = getMeterAccuracy();
    if (accuracy === 'perfect') haptic([10, 5, 10]);

    playDeliveryWhoosh();
  }

  function resolveBowlingOutcome() {
    state.bowlingDeliveryPhase = 'result';
    bowlingBallActive = false;

    // Determine accuracy
    let accuracy = getMeterAccuracy();

    // Track delivery types for repetition penalty
    state.deliveryTypeHistory.push(state.selectedDelivery);
    const currentOverHistory = state.deliveryTypeHistory.slice(-6);
    const sameTypeCount = currentOverHistory.filter(t => t === state.selectedDelivery).length;
    if (sameTypeCount >= 3) {
      // Shift accuracy one tier worse
      if (accuracy === 'perfect') accuracy = 'good';
      else if (accuracy === 'good') accuracy = 'bad';
    }

    // --- WIDE CHECK ---
    // Bad accuracy has 25% chance of being a wide
    if (accuracy === 'bad' && Math.random() < 0.25) {
      bowlingResultOutcome = { runs: 1, type: 'wide' };
      handleBowlingOutcome(bowlingResultOutcome);
      return;
    }

    // --- NO-BALL CHECK ---
    // Same delivery type 4+ times in the over = 30% chance of no-ball
    if (!state.bowlingDeliveryRepeatCount) state.bowlingDeliveryRepeatCount = {};
    state.bowlingDeliveryRepeatCount[state.selectedDelivery] = (state.bowlingDeliveryRepeatCount[state.selectedDelivery] || 0) + 1;
    const repeatCount = state.bowlingDeliveryRepeatCount[state.selectedDelivery];
    let isNoBall = false;
    if (repeatCount >= 4 && Math.random() < 0.3) {
      isNoBall = true;
    }

    // Count the ball (wides already returned above, no-balls don't count as legal deliveries)
    state.bowlingTotalBalls++;
    if (!isNoBall) {
      state.bowlingBallsInOver++;
    }

    // Pick probability table
    let probs;
    switch (accuracy) {
      case 'perfect': probs = [...AI_PROB_PERFECT]; break;
      case 'good':    probs = [...AI_PROB_GOOD]; break;
      case 'bad':     probs = [...AI_PROB_BAD]; break;
    }

    // Free hit: AI cannot be dismissed
    if (state.freeHitNext) {
      // Redistribute wicket probability to runs
      const wicketProb = probs[5] || 0;
      probs[5] = 0;
      probs[3] += Math.floor(wicketProb / 2); // to fours
      probs[4] += Math.ceil(wicketProb / 2);  // to sixes
    }

    // Delivery type bonuses
    // Bouncer against established batsman: +5% wicket
    if (state.selectedDelivery === 'bouncer' && state.bowlingAIScore >= 20) {
      probs[5] += 5;
      probs[0] = Math.max(0, probs[0] - 5);
    }
    // Yorker with perfect accuracy: +10% wicket
    if (state.selectedDelivery === 'yorker' && accuracy === 'perfect') {
      probs[5] += 10;
      probs[3] = Math.max(0, probs[3] - 5);
      probs[4] = Math.max(0, probs[4] - 5);
    }
    // Slower ball after fast deliveries: +8% wicket
    const lastTwo = state.deliveryTypeHistory.slice(-3, -1);
    const fastTypes = ['straight', 'bouncer', 'yorker'];
    if (state.selectedDelivery === 'slower' && lastTwo.length >= 2 && lastTwo.every(t => fastTypes.includes(t))) {
      probs[5] += 8;
      probs[3] = Math.max(0, probs[3] - 4);
      probs[4] = Math.max(0, probs[4] - 4);
    }

    // Normalize and roll
    const total = probs.reduce((a, b) => a + b, 0);
    const roll = Math.random() * total;
    let cum = 0;
    const outcomes = [0, 1, 2, 4, 6, -1]; // dot, 1, 2, 4, 6, wicket
    let result = { runs: 0, type: 'dot' };

    for (let i = 0; i < probs.length; i++) {
      cum += probs[i];
      if (roll < cum) {
        const runs = outcomes[i];
        if (runs === -1) {
          const wicketTypes = ['bowled', 'caught', 'lbw'];
          let wType = wicketTypes[Math.floor(Math.random() * wicketTypes.length)];
          if (state.selectedDelivery === 'yorker') wType = 'bowled';
          result = { runs: -1, type: wType };
        } else if (runs === 0) {
          result = { runs: 0, type: 'dot' };
        } else if (runs === 1) {
          result = { runs: 1, type: 'single' };
        } else if (runs === 2) {
          result = { runs: 2, type: 'two' };
        } else if (runs === 4) {
          result = { runs: 4, type: 'four' };
        } else if (runs === 6) {
          result = { runs: 6, type: 'six' };
        }
        break;
      }
    }

    // If no-ball, mark it and add 1 run + set free hit
    if (isNoBall) {
      result.isNoBall = true;
    }

    // Clear free hit after this ball (unless this ball itself is a no-ball)
    if (state.freeHitNext && !isNoBall) {
      state.freeHitNext = false;
      const fhBadge = $('freeHitBadge');
      if (fhBadge) fhBadge.classList.remove('show');
    }

    // Feature 10: Run-out chance on 2-run outcomes (bowling side)
    if (result.runs === 2 && result.type !== 'wide') {
      const runoutChance = 0.04 + (accuracy === 'bad' ? 0 : accuracy === 'good' ? 0.01 : 0.02);
      if (Math.random() < runoutChance) {
        result = { runs: 2, type: 'runout' };
      }
    }

    bowlingResultOutcome = result;
    handleBowlingOutcome(result);
  }

  function handleBowlingOutcome(outcome) {
    const textX = W / 2;
    const textBaseY = H * 0.4;

    // Feature 11: Pitch deterioration during bowling
    if (state.bowlingTotalBalls >= 15 && !state.pitchDeteriorated) {
      state.pitchDeteriorated = true;
      addPitchCracks();
      showBallCommentary({ type: 'pitch_crack' }, true);
    }

    // --- WIDE handling ---
    if (outcome.type === 'wide') {
      state.bowlingWides++;
      state.bowlingExtras++;
      state.bowlingAIScore += 1;
      // Don't increment ballsInOver or totalBalls -- wide doesn't count
      state.bowlingCurrentOverResults.push({ runs: 1, isWicket: false, isFour: false, isSix: false, isWide: true });
      spawnFloatingText('WIDE!', textX, textBaseY, '#FFD700', 28);
      // Double beep sound
      if (audioCtx && state.soundEnabled) {
        playTone(500, 'sine', 0.06, 0.06);
        setTimeout(() => playTone(500, 'sine', 0.06, 0.06), 80);
      }
      showBallCommentary(outcome, true);
      updateBowlingHUD();
      announceScore(`Wide ball! +1 run. AI: ${state.bowlingAIScore} for ${state.bowlingAIWickets}.`);
      // Re-bowl after short delay
      state.bowlingResultTimer = Date.now();
      setTimeout(() => {
        if (state.phase !== 'BOWLING') return;
        // Check if AI chased down on the wide (only in bat-first mode)
        if (state.battingFirst && state.bowlingAIScore >= state.battingScore + 1) {
          endMatch();
          return;
        }
        state.bowlingDeliveryPhase = 'selecting';
        state.postBallActive = false;
      }, 1000);
      return;
    }

    // --- NO-BALL handling ---
    if (outcome.isNoBall) {
      state.bowlingNoBalls++;
      state.bowlingExtras++;
      state.bowlingAIScore += 1; // +1 extra for no-ball
      state.freeHitNext = true;
      spawnFloatingText('NO BALL!', textX, textBaseY - 40, '#FF0000', 26);
      if (audioCtx && state.soundEnabled) {
        playTone(300, 'sine', 0.12, 0.08);
      }
      showBallCommentary({ runs: 0, type: 'noBall' }, true);
      announceScore(`No ball! Free hit next. AI: ${state.bowlingAIScore + (outcome.runs > 0 ? outcome.runs : 0)} for ${state.bowlingAIWickets}.`);
      // Show free hit badge
      const fhBadge = $('freeHitBadge');
      if (fhBadge) fhBadge.classList.add('show');
      // If the outcome was a wicket, it's void on a no-ball -- convert to dot
      if (outcome.runs === -1) {
        outcome = { runs: 0, type: 'dot', isNoBall: true };
      }
    }

    // Show free hit commentary if this was a free hit ball
    if (state.freeHitNext && !outcome.isNoBall) {
      // The free hit delivery is being bowled -- commentary handled above
    }

    // Feature 10: Run-out during bowling (AI gets run out)
    if (outcome.type === 'runout') {
      const textX = W / 2;
      const textBaseY = H * 0.4;
      state.bowlingAIScore += outcome.runs; // runs still count
      state.bowlingAIWickets++;
      state.bowlingCurrentOverRuns += outcome.runs;
      state.bowlingCurrentOverResults.push({ runs: outcome.runs, isWicket: true, isFour: false, isSix: false });

      spawnFloatingText('RUN OUT!', textX, textBaseY - 40, '#FF6600', 26);
      spawnFloatingText(outcome.runs.toString(), textX, textBaseY, '#FFFFFF', 24);
      playTone(800, 'sine', 0.08, 0.06);
      setTimeout(() => playStumpsHit(), 200);
      triggerStumpScatter();

      if (!reducedMotion) cameraShake.active = true;
      cameraShake.start = Date.now();
      cameraShake.duration = 300;
      cameraShake.intensity = 0.1;

      playCrowdReaction('roar');
      spawnParticles(textX, textBaseY, 20, ['#FF6600', '#FFD700'], 100, 0.8);
      haptic([100]);

      checkAchievement('cb_run_out');
      checkAchievement('cb_first_wicket');
      if (state.bowlingAIWickets >= 5) checkAchievement('cb_five_wickets');

      showBallCommentary(outcome, true);
      updateBowlingHUD();
      announceScore(`RUN OUT! AI scored ${outcome.runs} but lost a wicket. AI: ${state.bowlingAIScore} for ${state.bowlingAIWickets}.`);

      // Schedule next ball
      state.bowlingResultTimer = Date.now();
      const aiAllOut = state.bowlingAIWickets >= 10;
      setTimeout(() => {
        if (state.phase !== 'BOWLING') return;
        if (aiAllOut) { endMatch(); return; }
        if (state.bowlingBallsInOver >= 6) {
          state.bowlingOversCompleted++;
          state.overRunHistory.push(state.bowlingCurrentOverRuns);
          if (state.bowlingOversCompleted >= 5) { endMatch(); return; }
          showBowlingBetweenOvers();
          return;
        }
        state.bowlingDeliveryPhase = 'selecting';
        state.postBallActive = false;
        state.stumpScatter = null;
        scatterStumps.forEach(s => scene.remove(s));
        scatterBails.forEach(b => scene.remove(b));
        scatterStumps = [];
        scatterBails = [];
      }, 1200);
      return;
    }

    if (outcome.runs === -1) {
      // WICKET
      state.bowlingAIWickets++;
      state.bowlingCurrentOverResults.push({ runs: 0, isWicket: true, isFour: false, isSix: false });

      checkAchievement('cb_first_wicket');
      if (state.bowlingAIWickets >= 5) checkAchievement('cb_five_wickets');
      if (state.selectedDelivery === 'yorker') {
        state.yorkerWickets++;
        if (state.yorkerWickets >= 3) checkAchievement('cb_yorker_master');
      }

      if (outcome.type === 'lbw') {
        // LBW sound
        playTone(120, 'sine', 0.15, 0.1);
        setTimeout(() => {
          playTone(400, 'sine', 0.1, 0.06);
          setTimeout(() => playTone(600, 'sine', 0.15, 0.08), 100);
        }, 150);
        spawnFloatingText('LBW!', textX, textBaseY, '#FF6600', 32);
      } else if (outcome.type === 'bowled') {
        playStumpsHit();
        triggerStumpScatter();
        spawnFloatingText('WICKET!', textX, textBaseY, '#4CAF50', 32);
      } else {
        playBatCrack(0);
        spawnFloatingText('CAUGHT!', textX, textBaseY, '#4CAF50', 32);
      }

      // Camera shake for bowling wicket
      if (!reducedMotion) cameraShake.active = true;
      cameraShake.start = Date.now();
      cameraShake.duration = 300;
      cameraShake.intensity = 0.1;

      playCrowdReaction('roar');
      spawnParticles(textX, textBaseY, 30, ['#4CAF50', '#FFD700', '#FFFFFF'], 120, 1.0);

      // AI bat defensive push animation
      aiBatAnimating = true;
      aiBatAnimStart = Date.now();
      aiBatAnimType = 'defense';

      haptic([100]);
      // Patch #24: Detailed bowling wicket announcement
      announceScore(`Wicket! ${outcome.type}. AI: ${state.bowlingAIScore} for ${state.bowlingAIWickets}. Need ${Math.max(0, state.battingScore + 1 - state.bowlingAIScore)} more.`);
    } else {
      // Runs scored by AI
      state.bowlingAIScore += outcome.runs;
      state.bowlingCurrentOverRuns += outcome.runs;
      state.bowlingCurrentOverResults.push({
        runs: outcome.runs,
        isWicket: false,
        isFour: outcome.runs === 4,
        isSix: outcome.runs === 6
      });

      // AI bat animation
      aiBatAnimating = true;
      aiBatAnimStart = Date.now();
      if (outcome.runs >= 6) {
        aiBatAnimType = 'big';
      } else if (outcome.runs >= 4) {
        aiBatAnimType = 'normal';
      } else if (outcome.runs === 0) {
        aiBatAnimType = 'defense';
      } else {
        aiBatAnimType = 'defense';
      }

      // Post-ball visual
      state.postBallActive = true;
      state.postBallTime = Date.now();
      state.postBallX = 0;
      state.postBallY = 1;
      state.postBallVx = (Math.random() - 0.5) * 2;

      if (outcome.runs === 4) {
        state.postBallType = 'four';
        spawnFloatingText('FOUR!', textX, textBaseY, '#E8000D', 32);
        spawnParticles(textX, textBaseY, 25, ['#FFD700', '#FFA500', '#FFFFFF'], 120, 0.8);
        playCrowdReaction('cheer');
        playBatCrack(3);
        haptic([30]);
        if (!reducedMotion) cameraShake.active = true;
        cameraShake.start = Date.now();
        cameraShake.duration = 200;
        cameraShake.intensity = 0.05;
      } else if (outcome.runs === 6) {
        state.postBallType = 'six';
        spawnFloatingText('SIX!', textX, textBaseY, '#FF00FF', 36);
        spawnParticles(textX, textBaseY, 30, ['#FF00FF', '#E8000D', '#FFD700'], 130, 1.0);
        playCrowdReaction('roar');
        playBatCrack(4);
        haptic([30, 15, 50]);
        if (!reducedMotion) cameraShake.active = true;
        cameraShake.start = Date.now();
        cameraShake.duration = 400;
        cameraShake.intensity = 0.15;
      } else if (outcome.runs === 0) {
        state.postBallType = 'default';
        spawnFloatingText('DOT', textX, textBaseY, 'rgba(255,255,255,0.6)', 20);
        playBatCrack(0);
      } else {
        state.postBallType = 'default';
        spawnFloatingText(outcome.runs.toString(), textX, textBaseY, '#FFFFFF', 24);
        playBatCrack(1);
      }

      // Patch #24: Detailed bowling run announcement
      announceScore(`Delivering ${DELIVERY_LABELS[state.selectedDelivery] || 'Straight'} at ${state.selectedLine} line. AI scored ${outcome.runs} run${outcome.runs !== 1 ? 's' : ''}. AI: ${state.bowlingAIScore} for ${state.bowlingAIWickets}.`);
    }

    showBallCommentary(outcome, true);
    updateBowlingHUD();

    // Immediate check: AI chased down target — only in bat-first mode (AI chasing)
    const aiIsChasing = state.battingFirst;
    const aiChasedDown = aiIsChasing && state.bowlingAIScore >= state.battingScore + 1;
    const aiAllOut = state.bowlingAIWickets >= 10;
    const matchEnding = aiChasedDown || aiAllOut;

    if (aiChasedDown) {
      spawnFloatingText('TARGET CHASED!', W / 2, H * 0.3, '#FF4444', 28);
      announceScore(`AI wins! Chased down ${state.battingScore + 1}.`);
    }

    // Schedule next ball or end — shorter delay if match ending
    state.bowlingResultTimer = Date.now();
    setTimeout(() => {
      if (state.phase !== 'BOWLING') return;

      // Check if AI chased down target (only when AI is chasing in bat-first mode or super over)
      if ((aiIsChasing || state.superOver) && state.bowlingAIScore >= state.battingScore + 1) {
        if (state.superOver) {
          endSuperOverMatch();
        } else {
          endMatch();
        }
        return;
      }

      // Check if AI all out
      if (state.bowlingAIWickets >= 10) {
        endMatch();
        return;
      }

      // Check end of over
      if (state.bowlingBallsInOver >= 6) {
        state.bowlingOversCompleted++;
        // Feature 8: Track bowling over runs for manhattan
        state.overRunHistory.push(state.bowlingCurrentOverRuns);
        if (state.bowlingCurrentOverRuns > state.bowlingBestOverRuns) {
          state.bowlingBestOverRuns = state.bowlingCurrentOverRuns;
        }

        // Super over: only 1 over
        if (state.superOver && state.bowlingOversCompleted >= 1) {
          endSuperOverMatch();
          return;
        }

        if (state.bowlingOversCompleted >= 5) {
          endMatch();
          return;
        }

        // Show between overs for bowling
        showBowlingBetweenOvers();
        return;
      }

      // Next ball
      state.bowlingDeliveryPhase = 'selecting';
      state.postBallActive = false;
      state.stumpScatter = null;
      scatterStumps.forEach(s => scene.remove(s));
      scatterBails.forEach(b => scene.remove(b));
      scatterStumps = [];
      scatterBails = [];
    }, matchEnding ? 600 : 1200);
  }

  function showBowlingBetweenOvers() {
    state.phase = 'BETWEEN_OVERS';
    gameWrap.classList.remove('cb-playing');
    gameWrap.classList.remove('cb-bowling');

    const ballsHtml = state.bowlingCurrentOverResults.map(r => {
      if (r.isWide) return '<div class="cb-ball-dot wide">Wd</div>';
      if (r.isWicket) return '<div class="cb-ball-dot wicket">W</div>';
      if (r.isSix) return '<div class="cb-ball-dot six">6</div>';
      if (r.isFour) return '<div class="cb-ball-dot four">4</div>';
      if (r.runs === 0) return '<div class="cb-ball-dot dot">&middot;</div>';
      return `<div class="cb-ball-dot runs">${r.runs}</div>`;
    }).join('');

    const rrAI = state.bowlingTotalBalls > 0 ? (state.bowlingAIScore / (state.bowlingTotalBalls / 6)).toFixed(2) : '0.00';
    const ballsLeft = (5 - state.bowlingOversCompleted) * 6;
    const isBowlingFirst = !state.battingFirst && state.matchPhase === 'bowling';

    // Extras summary
    const extrasLine = state.bowlingExtras > 0
      ? `<div class="cb-stat-row"><span>Extras</span><span>${state.bowlingExtras} (${state.bowlingWides}w, ${state.bowlingNoBalls}nb)</span></div>`
      : '';

    // Target info — only show when AI is chasing (batting second)
    let targetHtml = '';
    let rateHtml = '';
    if (!isBowlingFirst) {
      const runsNeeded = state.battingScore + 1 - state.bowlingAIScore;
      const reqRR = ballsLeft > 0 ? (runsNeeded / (ballsLeft / 6)).toFixed(2) : '-';
      targetHtml = `<div class="cb-stat-row"><span>AI needs</span><span>${Math.max(0, runsNeeded)} from ${ballsLeft} balls</span></div>`;
      rateHtml = `
        <div class="cb-rate-compare">
          <div class="cb-rate-item">
            <span class="label">AI Run Rate</span>
            <span class="value">${rrAI}</span>
          </div>
          <div class="cb-rate-item">
            <span class="label">Required RR</span>
            <span class="value">${reqRR}</span>
          </div>
        </div>`;
    } else {
      rateHtml = `
        <div class="cb-rate-compare">
          <div class="cb-rate-item">
            <span class="label">AI Run Rate</span>
            <span class="value">${rrAI}</span>
          </div>
          <div class="cb-rate-item">
            <span class="label">Overs Left</span>
            <span class="value">${5 - state.bowlingOversCompleted}</span>
          </div>
        </div>`;
    }

    overModal.innerHTML = `
      <h2>End of Over ${state.bowlingOversCompleted} (Bowling)</h2>
      <div class="cb-over-summary">${ballsHtml}</div>
      <div class="cb-stat-row"><span>Runs conceded this over</span><span>${state.bowlingCurrentOverRuns}</span></div>
      <div class="cb-stat-row"><span>AI Score</span><span>${state.bowlingAIScore}/${state.bowlingAIWickets}</span></div>
      ${extrasLine}
      ${targetHtml}
      ${rateHtml}
      ${drawManhattan()}
      <button class="cb-btn" onclick="window._cbNextBowlingOver()">NEXT OVER &rarr;</button>
      <p class="cb-countdown" id="overCountdown">Auto-continuing in 5s</p>
    `;

    overOverlay.classList.add('cb-visible');

    state.autoOverTimer = 5;
    clearInterval(window._cbAutoOverInt);
    const countdownEl = overModal.querySelector('#overCountdown');
    window._cbAutoOverInt = setInterval(() => {
      state.autoOverTimer--;
      if (countdownEl) countdownEl.textContent = `Auto-continuing in ${state.autoOverTimer}s`;
      if (state.autoOverTimer <= 0) {
        clearInterval(window._cbAutoOverInt);
        window._cbNextBowlingOver();
      }
    }, 1000);
  }

  function startNextBowlingOver() {
    clearInterval(window._cbAutoOverInt);
    overOverlay.classList.remove('cb-visible');

    state.bowlingBallsInOver = 0;
    state.bowlingCurrentOverRuns = 0;
    state.bowlingCurrentOverResults = [];
    state.deliveryTypeHistory = [];
    state.bowlingDeliveryRepeatCount = {};

    state.phase = 'BOWLING';
    state.bowlingDeliveryPhase = 'selecting';
    gameWrap.classList.add('cb-playing');
    gameWrap.classList.add('cb-bowling');

    state.postBallActive = false;
    state.stumpScatter = null;
    scatterStumps.forEach(s => scene.remove(s));
    scatterBails.forEach(b => scene.remove(b));
    scatterStumps = [];
    scatterBails = [];

    updateBowlingHUD();
  }

  // ============================================
  // MATCH RESULT
  // ============================================

  function endMatch() {
    // If bowling first and this is the end of AI's batting (bowling phase), transition to player batting
    if (!state.battingFirst && state.matchPhase === 'bowling' && !state.superOver) {
      // AI just finished batting, now player bats to chase
      transitionToBattingChase();
      return;
    }

    // Super Over check: if tied and not already in super over
    if (!state.superOver) {
      const tied = state.bowlingAIScore === state.battingScore;
      if (tied) {
        startSuperOver();
        return;
      }
    }

    state.phase = 'MATCH_RESULT';
    gameWrap.classList.remove('cb-playing');
    gameWrap.classList.remove('cb-bowling');

    // Hide bowling UI
    if (bowlingPanel) bowlingPanel.style.display = 'none';
    if (bowlingMeter) bowlingMeter.style.display = 'none';
    if (scoreboardBowl) scoreboardBowl.style.display = 'none';

    // Hide free hit badge
    const fhBadge = $('freeHitBadge');
    if (fhBadge) fhBadge.classList.remove('show');

    const playerWon = state.bowlingAIScore < state.battingScore + 1;
    const tied = state.bowlingAIScore === state.battingScore;
    const margin = state.battingScore - state.bowlingAIScore;
    const aiWicketsLeft = 10 - state.bowlingAIWickets;

    // Calculate score
    const bowlingBonus = playerWon ? 50 : 0;
    const wicketsBonus = state.bowlingAIWickets * 10;
    const economyRate = state.bowlingTotalBalls > 0 ? (state.bowlingAIScore / (state.bowlingTotalBalls / 6)) : 0;
    const economyBonus = economyRate < 6.0 ? 20 : 0;
    const boundaryBonus = state.battingFours * 2 + state.battingSixes * 4;
    const wicketPenalty = state.battingWickets * 10;

    // Patch #18: Daily challenge check
    const challenge = getTodaysChallenge();
    let dailyChallengeBonus = 0;
    let dailyChallengeResult = false;
    if (!isDailyChallengeCompleted() && challenge.check(state)) {
      dailyChallengeResult = true;
      dailyChallengeBonus = 25;
      completeDailyChallenge();
    }

    // Patch #23: Streak bonus
    const streakBonus = Math.min(35, state.loginStreak.count * 5);

    const finalScore = Math.max(0,
      state.battingScore + boundaryBonus - wicketPenalty +
      bowlingBonus + wicketsBonus + economyBonus + dailyChallengeBonus + streakBonus
    );
    state.lastFinalScore = finalScore;

    // Achievements
    if (playerWon) {
      checkAchievement('cb_full_match_win');
      if (margin >= 30) checkAchievement('cb_clean_sweep');
    }
    if (state.battingWickets === 0) checkAchievement('cb_no_wicket');
    if (state.battingSixes >= 6) checkAchievement('cb_six_sixes');
    if (state.battingScore >= 50) checkAchievement('cb_fifty');
    if (state.battingScore >= 100) checkAchievement('cb_century');
    if (finalScore >= 200) checkAchievement('cb_high_score_200');

    // Save high score
    try {
      const prev = parseInt(localStorage.getItem('cricket-blitz-high-score')) || 0;
      if (finalScore > prev) localStorage.setItem('cricket-blitz-high-score', finalScore);
    } catch (e) {}

    // Submit score
    submitMatchScore(finalScore, playerWon, tied);

    let heading, subText;
    if (tied) {
      heading = 'MATCH TIED!';
      subText = 'What an incredible game!';
      playUISound('levelComplete');
    } else if (playerWon) {
      heading = 'YOU WIN!';
      if (state.battingFirst) {
        subText = `Defended ${state.battingScore} by ${margin} runs!`;
      } else {
        subText = `Chased down ${state._bowlFirstAIScore || state.bowlingAIScore} successfully!`;
      }
      playUISound('levelComplete');
      spawnConfetti();
    } else {
      heading = 'AI WINS';
      if (state.battingFirst) {
        subText = `AI chased ${state.battingScore + 1} with ${aiWicketsLeft} wicket${aiWicketsLeft !== 1 ? 's' : ''} left`;
      } else {
        subText = `You fell short by ${Math.abs(margin)} runs chasing ${(state._bowlFirstAIScore || state.bowlingAIScore) + 1}`;
      }
      playUISound('gameOver');
    }

    if (!matchResultOverlay) {
      matchResultOverlay = $('matchResultOverlay');
      matchResultModal = $('matchResultModal');
    }

    matchResultModal.innerHTML = `
      <h2>${heading}</h2>
      <p style="color:var(--cb-text-dim);margin:0 0 8px;">${subText}</p>
      ${playerWon ? '<div style="font-size:2rem;margin:8px 0;">&#127942;</div>' : tied ? '<div style="font-size:2rem;margin:8px 0;">&#129309;</div>' : ''}
      <div class="cb-stats-grid" style="margin:16px 0;">
        <div class="stat-item"><span class="stat-value">${state.battingScore}/${state.battingWickets}</span><span class="stat-label">Your Score</span></div>
        <div class="stat-item"><span class="stat-value">${state.bowlingAIScore}/${state.bowlingAIWickets}</span><span class="stat-label">AI Score</span></div>
        <div class="stat-item"><span class="stat-value">${economyRate.toFixed(1)}</span><span class="stat-label">Economy</span></div>
      </div>
      <div class="cb-score-breakdown">
        <div class="cb-stat-row"><span>Batting Runs</span><span>${state.battingScore}</span></div>
        <div class="cb-stat-row"><span>Boundary Bonus</span><span>+${boundaryBonus}</span></div>
        <div class="cb-stat-row"><span>Wicket Penalty</span><span>-${wicketPenalty}</span></div>
        <div class="cb-stat-row"><span>Bowling Defense Bonus</span><span>+${bowlingBonus}</span></div>
        <div class="cb-stat-row"><span>Wickets Taken (x10)</span><span>+${wicketsBonus}</span></div>
        ${state.bowlingExtras > 0 ? `<div class="cb-stat-row"><span>Extras (${state.bowlingWides}w, ${state.bowlingNoBalls}nb)</span><span>${state.bowlingExtras}</span></div>` : ''}
        ${economyBonus ? '<div class="cb-stat-row"><span>Economy Bonus</span><span>+20</span></div>' : ''}
        ${streakBonus > 0 ? `<div class="cb-stat-row"><span>Streak Bonus (Day ${state.loginStreak.count})</span><span>+${streakBonus}</span></div>` : ''}
        ${dailyChallengeBonus > 0 ? '<div class="cb-stat-row"><span>Daily Challenge Bonus</span><span>+25</span></div>' : ''}
        <div class="cb-stat-row cb-score-total"><span>Total Score</span><span>${finalScore}</span></div>
      </div>
      <div class="cb-daily-result" style="margin:10px 0;padding:8px 12px;background:rgba(255,255,255,0.05);border-radius:10px;font-size:0.85rem;">
        <span style="color:var(--cb-text-dim);">Daily Challenge: ${challenge.text}</span><br>
        <span style="color:${dailyChallengeResult || isDailyChallengeCompleted() ? '#4CAF50' : '#E8000D'};font-weight:700;">
          ${dailyChallengeResult || isDailyChallengeCompleted() ? 'Complete!' : 'Not completed'}
        </span>
      </div>
      ${state.loginStreak.count > 1 ? `<div style="font-size:0.8rem;color:var(--cb-accent);margin-bottom:8px;">Day ${state.loginStreak.count} Streak</div>` : ''}
      <div class="cb-btn-row">
        <button class="cb-btn" onclick="window._cbPlayAgain()">PLAY AGAIN</button>
        <button class="cb-share-btn" onclick="window._cbShare()">&#128279; Share</button>
      </div>
    `;

    matchResultOverlay.classList.add('cb-visible');
  }

  async function submitMatchScore(finalScore, playerWon, tied) {
    const MAX_PLAUSIBLE_SCORE = 500;
    const clampedScore = Math.min(Math.max(0, finalScore), MAX_PLAUSIBLE_SCORE);
    try {
      if (window.apiClient && currentUser) {
        await window.apiClient.submitScore('cricket-blitz', {
          score: clampedScore,
          level: 1,
          timeMs: Date.now() - state.gameStartTime,
          metadata: {
            battingScore: state.battingScore,
            battingWickets: state.battingWickets,
            battingFours: state.battingFours,
            battingSixes: state.battingSixes,
            bowlingAIScore: state.bowlingAIScore,
            bowlingAIWickets: state.bowlingAIWickets,
            team: state.selectedTeam,
            result: playerWon ? 'win' : tied ? 'tie' : 'loss',
            matchMode: true
          }
        });
      }
    } catch (e) {
      console.warn('Score submission failed:', e);
    }
  }

  function endGame() {
    if (state.superOver && state.superOverPhase === 'batting') {
      // Super over batting done, transition to super over bowling
      endSuperOverBatting();
      return;
    }
    if (state.matchPhase === 'batting_chase') {
      // Player was chasing (bowl-first mode). Batting is done.
      // Save batting stats and go to match result
      state.battingScore = state.runs;
      state.battingWickets = state.wickets;
      state.battingFours = state.fours;
      state.battingSixes = state.sixes;
      // Restore AI's bowling score for comparison
      state.bowlingAIScore = state._bowlFirstAIScore;
      state.bowlingAIWickets = state._bowlFirstAIWickets;
      endMatch();
      return;
    }
    // Normal bat-first mode: batting end goes to innings break -> bowling
    transitionToInningsBreak();
  }

  // ============================================
  // SUPER OVER
  // ============================================

  function startSuperOver() {
    state.superOver = true;
    state.superOverPhase = 'batting';
    // Save original match scores for result display
    state._origBattingScore = state.battingScore;
    state._origBowlingAIScore = state.bowlingAIScore;
    state.superOverPlayerScore = 0;
    state.superOverAIScore = 0;
    state.superOverBalls = 0;
    state.superOverWickets = 0;
    state.superOverAIWickets = 0;
    state.superOverBowlingBalls = 0;
    state.phase = 'SUPER_OVER';

    gameWrap.classList.remove('cb-playing');
    gameWrap.classList.remove('cb-bowling');

    // Hide bowling UI
    if (bowlingPanel) bowlingPanel.style.display = 'none';
    if (bowlingMeter) bowlingMeter.style.display = 'none';
    if (scoreboardBowl) scoreboardBowl.style.display = 'none';

    const soOverlay = $('superOverOverlay');
    const soModal = $('superOverModal');

    soModal.innerHTML = `
      <h2 style="color:#FFD700;">MATCH TIED!</h2>
      <h3 style="color:#FF00FF;margin:8px 0;">SUPER OVER!</h3>
      <p style="color:var(--cb-text-dim);margin:0 0 16px;">${pickRandom(COMMENTARY.superOver)}</p>
      <p style="font-size:0.9rem;color:var(--cb-text-dim);">You bat first -- score as many as you can in 6 balls!</p>
      <button class="cb-btn" onclick="window._cbStartSuperOverBatting()">START SUPER OVER</button>
    `;
    soOverlay.classList.add('cb-visible');

    playUISound('levelComplete');
    playCrowdReaction('roar');
  }

  function startSuperOverBatting() {
    const soOverlay = $('superOverOverlay');
    soOverlay.classList.remove('cb-visible');

    // Reset batting state for super over
    state.runs = 0;
    state.wickets = 0;
    state.totalBallsFaced = 0;
    state.ballsInOver = 0;
    state.oversCompleted = 0;
    state.fours = 0;
    state.sixes = 0;
    state.currentOverRuns = 0;
    state.currentOverResults = [];
    state.consecutiveScoringBalls = 0;
    state.currentOverScoringBalls = 0;
    state.shotDirection = 'straight';
    state.postBallActive = false;
    state.stumpScatter = null;
    state.particles = [];
    state.floatingTexts = [];
    state.isPowerplay = false; // No powerplay in super over
    state.comboStreak = 0;
    state.newBatsmanAnim = false;
    state.batAnimating = false;
    state.bowlerAnimating = false;
    state.target = 999; // Just score
    deliveryPhase = 'idle';
    deliveryTimer = 0;

    state.superOverPhase = 'batting';
    state.phase = 'BATTING';
    state.matchPhase = 'batting';
    gameWrap.classList.add('cb-playing');
    gameWrap.classList.remove('cb-bowling');

    // Show batting HUD
    if (scoreboardBat) scoreboardBat.style.display = '';
    if (scoreboardBowl) scoreboardBowl.style.display = 'none';

    // Make batting 3D objects visible
    batsmanGroup.visible = true;
    bowlerGroup.visible = true;
    if (aiBatsmanGroup) aiBatsmanGroup.visible = false;

    setDayEnvironment();

    // Reset scatter
    scatterStumps.forEach(s => scene.remove(s));
    scatterBails.forEach(b => scene.remove(b));
    scatterStumps = [];
    scatterBails = [];

    updateHUD();
    generateBowlerForOver();
    showBowlerIntro();
    setTimeout(() => startDelivery(), 1200);
  }

  function endSuperOverBatting() {
    state.superOverPlayerScore = state.runs;
    state.superOverWickets = state.wickets;

    gameWrap.classList.remove('cb-playing');

    // Show transition overlay
    const soOverlay = $('superOverOverlay');
    const soModal = $('superOverModal');

    soModal.innerHTML = `
      <h2>YOUR SUPER OVER</h2>
      <div class="cb-final-score" style="font-size:2.5rem;margin:8px 0;">${state.superOverPlayerScore} / ${state.superOverWickets}</div>
      <p style="color:var(--cb-accent);font-size:1.1rem;font-weight:700;margin:16px 0 4px;">AI needs ${state.superOverPlayerScore + 1} to win!</p>
      <p style="color:var(--cb-text-dim);font-size:0.85rem;margin:0 0 16px;">Now bowl them out!</p>
      <button class="cb-btn" onclick="window._cbStartSuperOverBowling()">BOWL SUPER OVER</button>
    `;
    soOverlay.classList.add('cb-visible');
    playUISound('overComplete');
  }

  function startSuperOverBowling() {
    const soOverlay = $('superOverOverlay');
    soOverlay.classList.remove('cb-visible');

    state.superOverPhase = 'bowling';
    state.phase = 'BOWLING';
    state.matchPhase = 'bowling';
    gameWrap.classList.add('cb-playing');
    gameWrap.classList.add('cb-bowling');

    // Set the batting score to super over score for target comparison
    state.battingScore = state.superOverPlayerScore;

    // Reset bowling state
    state.bowlingAIScore = 0;
    state.bowlingAIWickets = 0;
    state.bowlingOversCompleted = 0;
    state.bowlingBallsInOver = 0;
    state.bowlingTotalBalls = 0;
    state.bowlingCurrentOverRuns = 0;
    state.bowlingCurrentOverResults = [];
    state.selectedDelivery = 'straight';
    state.selectedLine = 'middle';
    state.meterActive = false;
    state.meterPosition = 0;
    state.meterStopped = false;
    state.meterDirection = 1;
    state.deliveryTypeHistory = [];
    state.bowlingDeliveryPhase = 'selecting';
    state.bowlingResultTimer = 0;
    state.bowlingWides = 0;
    state.bowlingNoBalls = 0;
    state.bowlingExtras = 0;
    state.freeHitNext = false;
    state.bowlingDeliveryRepeatCount = {};
    state.postBallActive = false;
    state.stumpScatter = null;
    state.particles = [];
    state.floatingTexts = [];

    // Reset scatter
    scatterStumps.forEach(s => scene.remove(s));
    scatterBails.forEach(b => scene.remove(b));
    scatterStumps = [];
    scatterBails = [];

    setDayEnvironment();
    buildBowlingScene();

    // Show bowling UI
    bowlingPanel = $('bowlingPanel');
    bowlingMeter = $('bowlingMeter');
    // (old bowlingHudTop/Bottom removed -- using scoreboardBowl)

    if (bowlingPanel) bowlingPanel.style.display = 'flex';
    if (bowlingMeter) bowlingMeter.style.display = 'block';
    if (scoreboardBowl) scoreboardBowl.style.display = '';
    if (scoreboardBat) scoreboardBat.style.display = 'none';
    if (scoreboardBat) scoreboardBat.style.display = 'none';

    // Ensure battingFirst is true so "AI chased" logic works
    state.battingFirst = true;

    updateBowlingHUD();
  }

  function endSuperOverMatch() {
    if (state._superOverResultShown) return;
    state._superOverResultShown = true;
    state.superOverAIScore = state.bowlingAIScore;
    state.superOverAIWickets = state.bowlingAIWickets;

    // Determine result
    const playerWon = state.superOverPlayerScore > state.superOverAIScore;
    const tied = state.superOverPlayerScore === state.superOverAIScore;

    // Restore original match scores for display
    state.battingScore = state._origBattingScore || state.battingScore;
    state.bowlingAIScore = state._origBowlingAIScore || state.bowlingAIScore;

    state.phase = 'MATCH_RESULT';
    gameWrap.classList.remove('cb-playing');
    gameWrap.classList.remove('cb-bowling');

    if (bowlingPanel) bowlingPanel.style.display = 'none';
    if (bowlingMeter) bowlingMeter.style.display = 'none';
    if (scoreboardBowl) scoreboardBowl.style.display = 'none';

    const fhBadge = $('freeHitBadge');
    if (fhBadge) fhBadge.classList.remove('show');

    if (!matchResultOverlay) {
      matchResultOverlay = $('matchResultOverlay');
      matchResultModal = $('matchResultModal');
    }

    let heading, subText;
    if (tied) {
      heading = 'SHARED TROPHY!';
      subText = `Super Over also tied at ${state.superOverPlayerScore}! What an incredible match!`;
      playUISound('levelComplete');
    } else if (playerWon) {
      heading = 'YOU WIN!';
      subText = `Won the Super Over! You: ${state.superOverPlayerScore} - AI: ${state.superOverAIScore}`;
      playUISound('levelComplete');
      spawnConfetti();
    } else {
      heading = 'AI WINS';
      subText = `AI won the Super Over: ${state.superOverAIScore} - ${state.superOverPlayerScore}`;
      playUISound('gameOver');
    }

    // Calculate a basic score for super over matches
    const finalScore = Math.max(0, state.battingScore + (playerWon ? 50 : 0) + state.superOverPlayerScore * 5);
    state.lastFinalScore = finalScore;

    if (playerWon) checkAchievement('cb_full_match_win');
    submitMatchScore(finalScore, playerWon, tied);

    matchResultModal.innerHTML = `
      <h2>${heading}</h2>
      <p style="color:var(--cb-text-dim);margin:0 0 8px;">${subText}</p>
      ${playerWon ? '<div style="font-size:2rem;margin:8px 0;">&#127942;</div>' : tied ? '<div style="font-size:2rem;margin:8px 0;">&#129309;</div>' : ''}
      <div class="cb-stats-grid" style="margin:16px 0;">
        <div class="stat-item"><span class="stat-value">${state.battingScore}</span><span class="stat-label">Your Innings</span></div>
        <div class="stat-item"><span class="stat-value">${state.bowlingAIScore}</span><span class="stat-label">AI Innings</span></div>
      </div>
      <h3 style="color:#FFD700;margin:12px 0 4px;">Super Over</h3>
      <div class="cb-stats-grid" style="margin:8px 0;">
        <div class="stat-item"><span class="stat-value">${state.superOverPlayerScore}/${state.superOverWickets}</span><span class="stat-label">Your SO</span></div>
        <div class="stat-item"><span class="stat-value">${state.superOverAIScore}/${state.superOverAIWickets}</span><span class="stat-label">AI SO</span></div>
      </div>
      <div class="cb-score-breakdown">
        <div class="cb-stat-row cb-score-total"><span>Total Score</span><span>${finalScore}</span></div>
      </div>
      <div class="cb-btn-row">
        <button class="cb-btn" onclick="window._cbPlayAgain()">PLAY AGAIN</button>
        <button class="cb-share-btn" onclick="window._cbShare()">&#128279; Share</button>
      </div>
    `;

    matchResultOverlay.classList.add('cb-visible');
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

  function spawnConfetti() {
    if (reducedMotion) return;
    const team = state.selectedTeam ? TEAMS[state.selectedTeam] : null;
    const colors = team
      ? [team.primary, team.secondary, team.accent, '#FFD700', '#FF00FF']
      : ['#FFD700', '#FF00FF', '#00FFFF', '#FF4444', '#44FF44'];
    for (let i = 0; i < 100 && state.particles.length < MAX_PARTICLES; i++) {
      state.particles.push({
        x: (Math.random() - 0.5) * 10,
        y: 8 + Math.random() * 5,
        z: 5 + Math.random() * 15,
        vx: (Math.random() - 0.5) * 3,
        vy: -(Math.random() * 2 + 1),
        vz: (Math.random() - 0.5) * 3,
        life: 2 + Math.random(),
        maxLife: 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 0.06 + Math.random() * 0.08
      });
    }
  }

  // ============================================
  // HUD UPDATE
  // ============================================

  function updateBowlingHUD() {
    const sb = $('scoreboardBowl');
    if (!sb) return;

    const se = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
    const teamAbbr = TEAM_ABBR[state.selectedTeam] || '???';
    const oppAbbr = TEAM_ABBR[state.opponentTeam] || '???';

    se('sbBowlTeams', `AI: ${oppAbbr}`);
    se('sbBowlScore', `${state.bowlingAIScore}/${state.bowlingAIWickets}`);
    se('sbBowlOvers', `${state.bowlingOversCompleted}.${state.bowlingBallsInOver}`);

    if (!state.battingFirst && state.matchPhase === 'bowling') {
      se('sbBowlTarget', '1st Innings');
    } else {
      const aiTarget = state.battingScore + 1;
      const runsNeeded = Math.max(0, aiTarget - state.bowlingAIScore);
      se('sbBowlTarget', `Need ${runsNeeded}`);
    }

    // Run rate
    const totalBalls = state.bowlingOversCompleted * 6 + state.bowlingBallsInOver;
    const rr = totalBalls > 0 ? (state.bowlingAIScore / (totalBalls / 6)).toFixed(2) : '0.00';
    se('sbBowlRR', `RR ${rr}`);

    // Ball-by-ball dots for current over
    updateBowlingOverDots();

    // Update delivery panel selection (desktop)
    const panel = $('bowlingPanel');
    if (panel) {
      panel.querySelectorAll('.cb-delivery-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.delivery === state.selectedDelivery);
      });
    }

    // Update line indicators (desktop)
    const lineIndicators = $('bowlingLineIndicators');
    if (lineIndicators) {
      lineIndicators.querySelectorAll('.cb-line-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.line === state.selectedLine);
      });
    }

    // Free hit badge visibility
    const fhBadge = $('freeHitBadge');
    if (fhBadge) fhBadge.classList.toggle('show', !!state.freeHitNext);

    // Feature 12: Strategic timeout button visibility during bowling
    const timeoutBtn = $('timeoutBtn');
    if (timeoutBtn) {
      const showTimeout = !state.timeoutUsed && state.bowlingOversCompleted >= 2 && state.phase === 'BOWLING';
      timeoutBtn.style.display = showTimeout ? 'flex' : 'none';
    }
  }

  function updateBowlingOverDots() {
    const dotsEl = $('sbBowlDots');
    if (!dotsEl) return;
    dotsEl.innerHTML = '';
    const results = state.bowlingCurrentOverResults || [];
    for (let i = 0; i < 6; i++) {
      const dot = document.createElement('span');
      dot.className = 'cb-sb-dot';
      if (i < results.length) {
        const r = results[i];
        if (r.isWicket) dot.classList.add('wicket');
        else if (r.isWide) dot.classList.add('wide');
        else if (r.isSix) dot.classList.add('six');
        else if (r.isFour) dot.classList.add('four');
        else if (r.runs === 0) dot.classList.add('dot');
        else dot.classList.add('bowled');
      } else {
        dot.classList.add('pending');
      }
      dotsEl.appendChild(dot);
    }
  }

  function updateHUD() {
    const sb = $('scoreboardBat');
    if (!sb) return;
    const se = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };

    const teamAbbr = TEAM_ABBR[state.selectedTeam] || '???';
    const oppAbbr = TEAM_ABBR[state.opponentTeam] || '???';

    se('sbTeams', `${teamAbbr} vs ${oppAbbr}`);
    se('sbScore', `${state.runs}/${state.wickets}`);
    se('sbOvers', `${state.oversCompleted}.${state.ballsInOver}`);

    // Feature 2: Three-phase match structure (declared early for sbTarget)
    const currentPhase = getMatchPhaseForOver(state.oversCompleted);

    // Target / innings info
    if (state.superOver) {
      se('sbTarget', 'SUPER OVER');
    } else if (state.matchPhase === 'batting_chase') {
      const needed = Math.max(0, state.target - state.runs);
      se('sbTarget', `Need ${needed}`);
    } else {
      se('sbTarget', currentPhase.label);
    }

    // Run rate
    const totalBalls = state.oversCompleted * 6 + state.ballsInOver;
    const rr = totalBalls > 0 ? (state.runs / (totalBalls / 6)).toFixed(2) : '0.00';
    se('sbRR', `RR ${rr}`);

    // Ball-by-ball dots for current over
    updateOverDots();

    // Shot direction indicator (desktop)
    const arrows = { straight: '\u2191', pull: '\u2190', cut: '\u2192', defense: '\u2193' };
    const labels = { straight: 'Drive', pull: 'Pull', cut: 'Cut', defense: 'Block' };
    if (shotArrow) shotArrow.textContent = arrows[state.shotDirection] || '\u2191';
    if (shotLabel) shotLabel.textContent = labels[state.shotDirection] || 'Drive';

    const pitchShotIcon = $('pitchShotIcon');
    const pitchShotName = $('pitchShotName');
    if (pitchShotIcon) pitchShotIcon.textContent = arrows[state.shotDirection] || '\u2191';
    if (pitchShotName) pitchShotName.textContent = (labels[state.shotDirection] || 'Drive').toUpperCase();

    // Feature 2: Three-phase match structure — phase badge
    state.isPowerplay = state.oversCompleted < 2;
    state.matchPhaseLabel = currentPhase.label;
    state.matchPhaseColor = currentPhase.color;
    const ppBadge = $('powerplayBadge');
    if (ppBadge) {
      ppBadge.classList.toggle('show', state.phase === 'BATTING');
      ppBadge.textContent = currentPhase.label;
      ppBadge.style.background = currentPhase.color;
      ppBadge.style.color = currentPhase.label === 'POWERPLAY' ? '#000' : '#FFF';
    }

    const tensionEdge = $('tensionEdge');
    if (state.matchPhase === 'batting_chase') {
      const needed = state.target - state.runs;
      state.tensionActive = needed > 0 && needed <= 15;
    } else {
      state.tensionActive = false;
    }
    if (tensionEdge) tensionEdge.classList.toggle('active', state.tensionActive);

    // Combo streak badge
    const comboBadge = document.getElementById('comboBadge');
    if (comboBadge) {
      if (state.comboStreak >= 3 && state.phase === 'BATTING') {
        comboBadge.textContent = state.comboStreak >= 5 ? `ON FIRE! x${state.comboStreak} (1.5x)` : `ON FIRE! x${state.comboStreak}`;
        comboBadge.classList.add('show');
      } else {
        comboBadge.classList.remove('show');
      }
    }

    // Feature 12: Strategic timeout button visibility
    const timeoutBtn = $('timeoutBtn');
    if (timeoutBtn) {
      const showTimeout = !state.timeoutUsed && (state.oversCompleted >= 2 || state.bowlingOversCompleted >= 2) && (state.phase === 'BATTING' || state.phase === 'BOWLING');
      timeoutBtn.style.display = showTimeout ? 'flex' : 'none';
    }

    // Player name bar
    const playerNameBar = $('playerNameBar');
    if (playerNameBar) {
      const isBatting = state.phase === 'BATTING' && (state.matchPhase === 'batting' || state.matchPhase === 'batting_chase');
      playerNameBar.style.display = isBatting ? 'flex' : 'none';
      if (isBatting) {
        const batsmanNameEl = $('playerBatsmanName');
        const bowlerNameEl = $('playerBowlerName');
        if (batsmanNameEl) batsmanNameEl.textContent = `*${state.batsmanName || 'Player'} ${state.batsmanRuns || 0}(${state.batsmanBalls || 0})`;
        if (bowlerNameEl) bowlerNameEl.textContent = `${state.bowlerName || 'Bowler'} (${state.bowlerType || 'pacer'})`;
      }
    }
  }

  function updateOverDots() {
    const dotsEl = $('sbDots');
    if (!dotsEl) return;
    dotsEl.innerHTML = '';
    const results = state.currentOverResults || [];
    for (let i = 0; i < 6; i++) {
      const dot = document.createElement('span');
      dot.className = 'cb-sb-dot';
      if (i < results.length) {
        const r = results[i];
        if (r.isWicket) dot.classList.add('wicket');
        else if (r.isSix) dot.classList.add('six');
        else if (r.isFour) dot.classList.add('four');
        else if (r.runs === 0) dot.classList.add('dot');
        else dot.classList.add('bowled');
      } else {
        dot.classList.add('pending');
      }
      dotsEl.appendChild(dot);
    }
  }

  function showBowlerIntro() {
    bowlerIntro.textContent = `Bowling: ${state.bowlerName} (${state.bowlerType})`;
    bowlerIntro.classList.add('show');
    setTimeout(() => bowlerIntro.classList.remove('show'), 1500);
  }

  function showBallCommentary(outcome, isBowling) {
    const el = document.getElementById('ballCommentary');
    if (!el) return;
    const pool = isBowling ? BOWLING_COMMENTARY : COMMENTARY;
    let text = '';
    if (outcome.type === 'pitch_crack') {
      text = pickRandom(COMMENTARY.pitch_crack || []);
    } else if (outcome.runs === -1 && outcome.type === 'runout') {
      text = pickRandom(COMMENTARY.runout || pool.wicket || []);
    } else if (outcome.runs === -1 && outcome.type === 'lbw') {
      text = pickRandom(COMMENTARY.lbw || pool.wicket || []);
    } else if (outcome.runs === -1 && outcome.type === 'caught_behind') {
      text = pickRandom(COMMENTARY.caught_behind || pool.wicket || []);
    } else if (outcome.runs === -1 && outcome.type === 'stumped') {
      text = pickRandom(COMMENTARY.stumped || pool.wicket || []);
    } else if (outcome.runs === -1) {
      text = pickRandom(pool.wicket || []);
    } else if (outcome.type === 'wide') {
      text = pickRandom(COMMENTARY.wide || []);
    } else if (outcome.type === 'noBall') {
      text = pickRandom(COMMENTARY.noBall || []);
    } else if (outcome.runs === 6 || outcome.type === 'six') {
      text = pickRandom(pool.six || []);
    } else if (outcome.runs === 4 || outcome.type === 'four') {
      text = pickRandom(pool.four || []);
    } else if (outcome.runs === 3) {
      text = pickRandom(pool.three || COMMENTARY.three || []);
    } else if (outcome.runs === 2 || outcome.type === 'two') {
      text = pickRandom(pool.two || []);
    } else if (outcome.runs === 1 || outcome.type === 'single') {
      text = pickRandom(pool.single || []);
    } else {
      text = pickRandom(pool.dot || []);
    }
    if (!text) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 2000);
  }

  function announceScore(text) {
    if (srAnnounce) srAnnounce.textContent = text;
    // Also update assertive aria-live region
    const assertiveEl = document.getElementById('srAssertive');
    if (assertiveEl) assertiveEl.textContent = text;
  }

  // Patch #24: Dedicated assertive SR announcement
  function announceSR(text) {
    const el = document.getElementById('srAssertive');
    if (el) el.textContent = text;
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

    // Patch #19: Save achievement for bat skin unlocks
    saveAchievementToStorage(id);

    try {
      if (window.apiClient && currentUser) {
        window.apiClient.unlockAchievement(id, 'cricket-blitz').catch(() => {});
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
      if (teams.length >= 6) checkAchievement('cb_all_teams');
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

  function haptic(pattern) { vibrate(pattern); }

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

      const jersey = document.createElement('div');
      jersey.className = 'cb-team-jersey';
      jersey.style.setProperty('--jersey-stripe', team.secondary);
      jersey.style.background = 'transparent';
      const jerseyInner = document.createElement('div');
      jerseyInner.style.cssText = `
        width: 100%; height: 100%;
        clip-path: polygon(15% 0%, 85% 0%, 100% 15%, 100% 100%, 0% 100%, 0% 15%);
        background: linear-gradient(180deg, ${team.primary} 0%, ${darkenColor(team.primary, 0.15)} 100%);
        border-radius: 0 0 4px 4px;
        position: relative;
      `;
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

      const name = document.createElement('div');
      name.className = 'cb-team-name';
      name.style.color = luminance(team.primary) > 0.55 ? '#000' : '#fff';
      name.textContent = team.name.split(' ')[1] || team.name;

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

  function buildTitleExtras() {
    // Patch #18: Daily challenge card
    const challengeDiv = $('dailyChallenge');
    if (challengeDiv) {
      const challenge = getTodaysChallenge();
      const done = isDailyChallengeCompleted();
      challengeDiv.innerHTML = `
        <div class="cb-daily-label">TODAY'S CHALLENGE</div>
        <div class="cb-daily-text">${challenge.text}</div>
        <div class="cb-daily-status">${done ? 'Complete!' : 'Not yet completed'}</div>
      `;
    }

    // Patch #23: Streak badge
    const streakDiv = $('streakBadge');
    if (streakDiv) {
      const streak = state.loginStreak;
      if (streak.count > 1) {
        streakDiv.textContent = 'Day ' + streak.count + ' Streak';
        streakDiv.style.display = 'block';
      } else {
        streakDiv.style.display = 'none';
      }
    }

    // Patch #19: Bat skin selector
    const skinDiv = $('batSkinSelector');
    if (skinDiv) {
      const available = getAvailableBatSkins();
      let html = '<div class="cb-skin-label">BAT SKIN</div><div class="cb-skin-grid">';
      available.forEach(skin => {
        const selected = state.selectedBatSkin === skin.color ? ' selected' : '';
        html += `<button class="cb-skin-btn${selected}" data-skin-id="${skin.id}" data-skin-color="${skin.color}" style="background:${skin.color};" title="${skin.name}"></button>`;
      });
      html += '</div>';
      skinDiv.innerHTML = html;
      skinDiv.querySelectorAll('.cb-skin-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const color = btn.dataset.skinColor;
          const id = btn.dataset.skinId;
          state.selectedBatSkin = color;
          try { localStorage.setItem('cricket-blitz-bat-skin', id); } catch (e) {}
          if (batBlade) batBlade.material.color.set(new THREE.Color(color));
          skinDiv.querySelectorAll('.cb-skin-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          playUISound('select');
        });
      });
    }
  }

  function selectTeam(id) {
    state.selectedTeam = id;
    playUISound('select');

    const team = TEAMS[id];

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

    const others = TEAM_IDS.filter(id => id !== state.selectedTeam);
    state.opponentTeam = others[Math.floor(Math.random() * others.length)];

    checkTeamsAchievement();

    titleOverlay.classList.remove('cb-visible');

    // Show toss
    showToss();
  }

  function showToss() {
    state.phase = 'TOSS';
    const tossOverlay = $('tossOverlay');
    const tossCoin = $('tossCoin');
    const tossResult = $('tossResult');
    const tossResultText = $('tossResultText');
    const tossChoiceButtons = $('tossChoiceButtons');
    const tossLostMsg = $('tossLostMsg');
    const tossLostText = $('tossLostText');

    // Reset
    tossResult.style.display = 'none';
    tossChoiceButtons.style.display = 'none';
    tossLostMsg.style.display = 'none';
    tossCoin.className = 'cb-coin';

    tossOverlay.classList.add('cb-visible');

    // Animate coin flip
    const playerWins = Math.random() < 0.5;
    const coinResult = playerWins ? 'Heads' : 'Tails';

    // Add flip animation class
    setTimeout(() => {
      tossCoin.classList.add(playerWins ? 'cb-coin-heads' : 'cb-coin-tails');
    }, 100);

    // Show result after animation
    setTimeout(() => {
      tossResult.style.display = 'block';
      if (playerWins) {
        state.tossResult = 'won';
        tossResultText.textContent = `It's ${coinResult}! You won the toss!`;
        tossResultText.style.color = '#4CAF50';
        tossChoiceButtons.style.display = 'block';
        playUISound('levelComplete');
        // Focus first choice button for keyboard users
        const firstBtn = tossChoiceButtons.querySelector('button');
        if (firstBtn) setTimeout(() => firstBtn.focus(), 100);
      } else {
        state.tossResult = 'lost';
        // Opponent chooses -- 70% they choose to bat
        const oppBats = Math.random() < 0.7;
        state.tossChoice = oppBats ? 'bowl' : 'bat'; // if opp bats, player bowls
        state.battingFirst = oppBats ? false : true;
        const oppTeam = TEAMS[state.opponentTeam];
        tossResultText.textContent = `It's ${coinResult}! ${oppTeam.name} won the toss.`;
        tossResultText.style.color = '#E8000D';
        tossLostText.textContent = oppBats
          ? `${oppTeam.name} choose to BAT first. You will bowl first!`
          : `${oppTeam.name} choose to BOWL first. You will bat first!`;
        tossLostMsg.style.display = 'block';
        playUISound('select');
      }
    }, 1500);
  }

  function handleTossChoice(choice) {
    state.tossChoice = choice;
    state.battingFirst = (choice === 'bat');
    const tossOverlay = $('tossOverlay');
    tossOverlay.classList.remove('cb-visible');
    playUISound('confirm');
    beginMatch();
  }

  function handleTossContinue() {
    const tossOverlay = $('tossOverlay');
    tossOverlay.classList.remove('cb-visible');
    playUISound('confirm');
    beginMatch();
  }

  function beginMatch() {
    // Common match initialization
    state.level = 1;
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
    state._maxCombo = 0;
    state.gameStartTime = Date.now();
    state.lastFrameTime = 0;
    state.newBatsmanAnim = false;
    state.batAnimating = false;
    state.bowlerAnimating = false;
    state.isPowerplay = true;
    state.crowdWaveActive = false;
    state.tensionActive = false;
    state.battingExtras = 0;
    // Feature resets
    state.confidence = 50;
    state.bowlerConsecutiveSameType = 0;
    state.lastDeliveryType = null;
    state.wagonWheelShots = [];
    state.overRunHistory = [];
    state.firstInningsOverHistory = [];
    state.keeperCatchAnim = false;
    state.keeperCatchAnimStart = 0;
    state.superOver = false;
    state.superOverPhase = null;
    state._superOverResultShown = false;
    // Phase 2 resets
    state.drsAvailable = true;
    state.pendingLBW = false;
    state.pendingOutcome = null;
    if (state.drsTimeout) clearTimeout(state.drsTimeout);
    state.drsTimeout = null;
    state.pitchDeteriorated = false;
    removePitchCracks();
    state.timeoutUsed = false;
    const timeoutBtnInit = $('timeoutBtn');
    if (timeoutBtnInit) timeoutBtnInit.style.display = 'none';
    const drsPromptInit = $('drsPrompt');
    if (drsPromptInit) drsPromptInit.style.display = 'none';
    const drsOverlayInit = $('drsOverlay');
    if (drsOverlayInit) drsOverlayInit.classList.remove('cb-visible');
    deliveryPhase = 'idle';
    deliveryTimer = 0;

    // Generate batsman name
    state.batsmanName = BOWLER_FIRST[Math.floor(Math.random() * BOWLER_FIRST.length)].charAt(0) + '. ' +
                        BOWLER_LAST[Math.floor(Math.random() * BOWLER_LAST.length)];
    state.batsmanRuns = 0;
    state.batsmanBalls = 0;

    // Reset team color tracking
    _lastTeamKey = null;

    const tensionEdge = $('tensionEdge');
    if (tensionEdge) tensionEdge.classList.remove('active');

    // Rebuild crowd with team colors
    if (crowdMesh) {
      scene.remove(crowdMesh);
      crowdMesh.geometry.dispose();
      crowdMesh.material.dispose();
    }
    buildCrowd();

    // Reset scatter
    scatterStumps.forEach(s => scene.remove(s));
    scatterBails.forEach(b => scene.remove(b));
    scatterStumps = [];
    scatterBails = [];

    if (state.battingFirst) {
      // Player bats first (original flow) — day match
      setDayEnvironment();
      state.matchPhase = 'batting';
      state.target = 999;
      state.phase = 'BATTING';
      gameWrap.classList.add('cb-playing');
      if (scoreboardBat) scoreboardBat.style.display = '';
      if (scoreboardBowl) scoreboardBowl.style.display = 'none';
      updateHUD();
      generateBowlerForOver();
      showBowlerIntro();
      // Show batting tutorial on first ever play, then start delivery
      setTimeout(() => {
        if (!showTutorial('batting')) {
          startDelivery();
        }
      }, 1200);
    } else {
      // Player bowls first
      state.matchPhase = 'bowling';
      state.battingScore = 0;
      state.battingWickets = 0;
      state.battingFours = 0;
      state.battingSixes = 0;
      // AI bats first, so show bowling directly
      // We set a temporary batting score of 999 so AI chases nothing initially
      // After bowling, player bats to chase
      state.battingScore = 0;
      // AI bats freely in first innings (no target — state.battingFirst = false handles this)
      buildBowlingScene();
      updateFielderColors();
      repositionFielders(true); // bowling positions
      state.phase = 'BOWLING';
      gameWrap.classList.add('cb-playing');
      gameWrap.classList.add('cb-bowling');

      // Reset bowling state
      state.bowlingAIScore = 0;
      state.bowlingAIWickets = 0;
      state.bowlingOversCompleted = 0;
      state.bowlingBallsInOver = 0;
      state.bowlingTotalBalls = 0;
      state.bowlingCurrentOverRuns = 0;
      state.bowlingCurrentOverResults = [];
      state.selectedDelivery = 'straight';
      state.selectedLine = 'middle';
      state.meterActive = false;
      state.meterPosition = 0;
      state.meterStopped = false;
      state.meterDirection = 1;
      state.deliveryTypeHistory = [];
      state.bowlingDeliveryPhase = 'selecting';
      state.bowlingResultTimer = 0;
      state.yorkerWickets = 0;
      state.bowlingBestOverRuns = 0;
      state.lastTwoDeliveryFast = false;
      state.bowlingWides = 0;
      state.bowlingNoBalls = 0;
      state.bowlingExtras = 0;
      state.freeHitNext = false;
      state.bowlingDeliveryRepeatCount = {};

      setDayEnvironment();

      // Show bowling UI, hide batting UI
      bowlingPanel = $('bowlingPanel');
      bowlingMeter = $('bowlingMeter');
      bowlingMeterFill = $('bowlingMeterFill');
      bowlingMeterIndicator = $('bowlingMeterIndicator');

      if (bowlingPanel) bowlingPanel.style.display = 'flex';
      if (bowlingMeter) bowlingMeter.style.display = 'block';
      if (scoreboardBowl) scoreboardBowl.style.display = '';
      if (scoreboardBat) scoreboardBat.style.display = 'none';

      updateBowlingHUD();

      // Show bowling tutorial on first ever bowl
      showTutorial('bowling');
    }
  }

  function resetToTitle() {
    state.phase = 'TITLE';
    state.matchPhase = 'batting';
    gameWrap.classList.remove('cb-playing');
    gameWrap.classList.remove('cb-bowling');
    gameOverOverlay.classList.remove('cb-visible');
    levelOverlay.classList.remove('cb-visible');
    overOverlay.classList.remove('cb-visible');
    if (inningsBreakOverlay) inningsBreakOverlay.classList.remove('cb-visible');
    if (matchResultOverlay) matchResultOverlay.classList.remove('cb-visible');
    const tossOverlay = $('tossOverlay');
    if (tossOverlay) tossOverlay.classList.remove('cb-visible');
    const soOverlay = $('superOverOverlay');
    if (soOverlay) soOverlay.classList.remove('cb-visible');
    const fhBadge = $('freeHitBadge');
    if (fhBadge) fhBadge.classList.remove('show');
    state.superOver = false;
    state.superOverPhase = null;
    state._superOverResultShown = false;
    state.battingFirst = true;
    titleOverlay.classList.add('cb-visible');
    deliveryPhase = 'idle';
    state.ballActive = false;
    state.postBallActive = false;
    state.particles = [];
    state.floatingTexts = [];
    floatingTextContainer.innerHTML = '';
    state.floatingTexts = [];
    state.tensionActive = false;
    state.crowdWaveActive = false;

    // Phase 2 resets
    state.drsAvailable = true;
    state.pendingLBW = false;
    state.pendingOutcome = null;
    if (state.drsTimeout) clearTimeout(state.drsTimeout);
    state.drsTimeout = null;
    state.pitchDeteriorated = false;
    removePitchCracks();
    state.timeoutUsed = false;
    const drsPromptReset = $('drsPrompt');
    if (drsPromptReset) drsPromptReset.style.display = 'none';
    const drsOverlayReset = $('drsOverlay');
    if (drsOverlayReset) drsOverlayReset.classList.remove('cb-visible');

    // Hide all HUD
    if (bowlingPanel) bowlingPanel.style.display = 'none';
    if (bowlingMeter) bowlingMeter.style.display = 'none';
    if (scoreboardBowl) scoreboardBowl.style.display = 'none';
    if (scoreboardBat) scoreboardBat.style.display = 'none';
    const timeoutBtnReset = $('timeoutBtn');
    if (timeoutBtnReset) timeoutBtnReset.style.display = 'none';

    // Restore day sky for title/batting
    setDayEnvironment();

    // Reset 3D visibility
    batsmanGroup.visible = true;
    bowlerGroup.visible = true;
    if (aiBatsmanGroup) aiBatsmanGroup.visible = false;

    // Clean up scatter
    scatterStumps.forEach(s => scene.remove(s));
    scatterBails.forEach(b => scene.remove(b));
    scatterStumps = [];
    scatterBails = [];

    const tensionEdge = $('tensionEdge');
    if (tensionEdge) tensionEdge.classList.remove('active');
    const ppBadge = $('powerplayBadge');
    if (ppBadge) ppBadge.classList.remove('show');

    // Refresh title extras
    buildTitleExtras();

    try {
      const best = localStorage.getItem('cricket-blitz-high-score');
      const el = $('titleBest');
      if (best && el) el.textContent = `Best: ${best} pts`;
    } catch (e) {}
  }

  // ============================================
  // INPUT HANDLING
  // ============================================

  function handleSwing(direction) {
    if (state.phase !== 'BATTING') return;
    if (deliveryPhase !== 'inflight') return;
    if (state.swingTriggered) return;

    initAudio();
    resumeAudio();

    if (direction) state.shotDirection = direction;
    state.swingTriggered = true;
    state.swingTime = deliveryTimer;
  }

  function setShotDirection(dir) {
    if (state.phase !== 'BATTING') return;
    state.shotDirection = dir;
    updateHUD();
  }

  // Keyboard
  // ============================================
  // PAUSE SYSTEM
  // ============================================

  function pauseGame() {
    if (state.phase !== 'BATTING' && state.phase !== 'BOWLING') return;
    state.paused = true;
    const overlay = $('pauseOverlay');
    if (overlay) overlay.classList.add('cb-visible');
  }

  function resumeGame() {
    state.paused = false;
    state.lastFrameTime = 0;
    const overlay = $('pauseOverlay');
    if (overlay) overlay.classList.remove('cb-visible');
    // Restore default pause modal content (may have been replaced by strategic timeout)
    const modal = $('pauseModal');
    if (modal) {
      modal.innerHTML = '<h2>PAUSED</h2>' +
        '<p style="color:var(--cb-text-dim);margin:0 0 16px;">Game paused</p>' +
        '<div class="cb-btn-row" style="flex-direction:column;gap:12px;">' +
        '<button class="cb-btn" onclick="window._cbResume()">\u25B6 RESUME</button>' +
        '<button class="cb-btn" style="background:#555;" onclick="window._cbQuitToMenu()">\u2715 QUIT TO MENU</button>' +
        '</div>';
    }
  }

  function quitToMenu() {
    state.paused = false;
    const overlay = $('pauseOverlay');
    if (overlay) overlay.classList.remove('cb-visible');
    resetToTitle();
  }

  window._cbResume = resumeGame;
  window._cbQuitToMenu = quitToMenu;

  // Feature 12: Strategic Timeout
  window._cbStrategicTimeout = function() {
    if (!state.timeoutAvailable || state.timeoutUsed) return;
    if (state.oversCompleted < 2) return;
    if (state.phase !== 'BATTING' && state.phase !== 'BOWLING') return;
    state.timeoutUsed = true;
    const btn = $('timeoutBtn');
    if (btn) btn.style.display = 'none';
    pauseGame();

    const modal = $('pauseModal');
    if (!modal) return;

    const isBatting = state.phase === 'BATTING' || state.matchPhase === 'batting' || state.matchPhase === 'batting_chase';
    const score = isBatting ? state.runs : state.bowlingAIScore;
    const wickets = isBatting ? state.wickets : state.bowlingAIWickets;
    const overs = isBatting ? state.oversCompleted : state.bowlingOversCompleted;
    const balls = isBatting ? state.totalBallsFaced : state.bowlingTotalBalls;
    const rr = balls > 0 ? (score / (balls / 6)).toFixed(2) : '0.00';

    modal.innerHTML =
      '<h2>STRATEGIC TIMEOUT</h2>' +
      '<div class="cb-stat-row"><span>Score</span><span>' + score + '/' + wickets + '</span></div>' +
      '<div class="cb-stat-row"><span>Run Rate</span><span>' + rr + '</span></div>' +
      '<div class="cb-stat-row"><span>Overs Left</span><span>' + (5 - overs) + '</span></div>' +
      drawWagonWheel() +
      drawManhattan() +
      '<button class="cb-btn" onclick="window._cbResume()" style="margin-top:12px;">RESUME</button>';
  };

  document.addEventListener('keydown', (e) => {
    // Escape = pause/resume
    if (e.key === 'Escape') {
      e.preventDefault();
      if (state.paused) resumeGame();
      else if (state.phase === 'BATTING' || state.phase === 'BOWLING') pauseGame();
      return;
    }

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

    if (state.phase === 'TOSS') {
      // Toss handled by buttons, no keyboard shortcuts needed
      return;
    }

    if (state.phase === 'SUPER_OVER') {
      if (e.key === 'Enter') {
        e.preventDefault();
        // The super over overlay has a button, Enter advances
        if (state.superOverPhase === 'batting') window._cbStartSuperOverBatting();
        else if (state.superOverPhase === 'bowling') window._cbStartSuperOverBowling();
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

    // LEVEL_COMPLETE phase no longer used in match mode

    if (state.phase === 'GAME_OVER' || state.phase === 'MATCH_RESULT') {
      if (e.key === 'Enter') {
        e.preventDefault();
        window._cbPlayAgain();
      }
      return;
    }

    if (state.phase === 'INNINGS_BREAK') {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (state.matchPhase === 'batting') {
          window._cbStartBattingChase();
        } else {
          window._cbStartBowling();
        }
      }
      return;
    }

    // Bowling controls
    if (state.phase === 'BOWLING') {
      const keyLower = e.key.toLowerCase();

      // Delivery type selection via number keys or QWERTY
      if (DELIVERY_KEYS_NUM[e.key]) {
        e.preventDefault();
        selectDeliveryType(DELIVERY_KEYS_NUM[e.key]);
        return;
      }
      if (DELIVERY_KEYS_QWERTY[keyLower]) {
        e.preventDefault();
        selectDeliveryType(DELIVERY_KEYS_QWERTY[keyLower]);
        return;
      }

      // Line selection via arrow keys
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        selectLine('off');
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        selectLine('leg');
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        selectLine('middle');
        return;
      }

      // Spacebar: start/stop meter
      if (e.key === ' ') {
        e.preventDefault();
        if (state.bowlingDeliveryPhase === 'selecting') {
          startBowlingMeter();
        } else if (state.bowlingDeliveryPhase === 'meter') {
          stopBowlingMeter();
        }
        return;
      }
      return;
    }

    if (state.phase !== 'BATTING') return;

    // Feature 9: DRS review key
    if ((e.key === 'r' || e.key === 'R') && state.pendingLBW) {
      e.preventDefault();
      triggerDRS();
      return;
    }

    switch (e.key) {
      case ' ':
        e.preventDefault();
        handleSwing();
        // Brief audio tone to confirm input
        playTone(880, 'sine', 0.04, 0.03);
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

  // Touch zones — only for desktop mouse clicks (one-swipe handles mobile)
  document.querySelectorAll('.cb-touch-zone').forEach(zone => {
    // NO touchstart handler — one-swipe system handles all touch input
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

  // ============================================
  // GESTURE CONTROLS (one-swipe mobile)
  // ============================================

  let touchStartX = 0, touchStartY = 0, touchStartTime = 0;

  function showGestureIndicator(direction) {
    const el = document.getElementById('gestureIndicator');
    if (!el) return;
    const arrows = { straight: '\u2191', pull: '\u2190', cut: '\u2192', defense: '\u2193' };
    const names = { straight: 'DRIVE', pull: 'PULL', cut: 'CUT', defense: 'BLOCK' };
    el.querySelector('.cb-gesture-arrow').textContent = arrows[direction] || '\u2191';
    el.querySelector('.cb-gesture-name').textContent = names[direction] || 'DRIVE';
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 600);
  }

  function showBowlingGestureIndicator(delivery) {
    const el = document.getElementById('gestureIndicator');
    if (!el) return;
    const labels = {
      bouncer: '\u2191 BOUNCER', yorker: '\u2193 YORKER',
      inswing: '\u2190 INSWING', outswing: '\u2192 OUTSWING',
      straight: '\u25CF GOOD LENGTH', slower: '\u25CB SLOWER'
    };
    el.querySelector('.cb-gesture-arrow').textContent = '';
    el.querySelector('.cb-gesture-name').textContent = labels[delivery] || delivery.toUpperCase();
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 600);
  }

  // --- ONE-SWIPE BATTING (mobile) ---
  // Single swipe = direction + swing in one motion

  let battingSwipeStart = null;

  function handleBattingTouchStart(e) {
    if (state.phase !== 'BATTING') return;
    if (deliveryPhase !== 'inflight') return;

    const touch = e.touches[0];
    battingSwipeStart = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
  }

  function handleBattingTouchEnd(e) {
    if (!battingSwipeStart) return;
    if (state.phase !== 'BATTING') return;
    if (deliveryPhase !== 'inflight') return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - battingSwipeStart.x;
    const dy = touch.clientY - battingSwipeStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Determine direction from swipe
    let direction = 'straight'; // default

    if (dist > 30) { // minimum swipe distance
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      // angle: 0=right, 90=down, -90=up, 180=left
      if (angle < -45 && angle > -135) direction = 'straight'; // swipe up
      else if (angle > 45 && angle < 135) direction = 'defense'; // swipe down
      else if (angle >= -45 && angle <= 45) direction = 'cut'; // swipe right
      else direction = 'pull'; // swipe left
    }
    // If very short swipe (just a tap), use default direction

    // Set direction AND swing in one go
    state.shotDirection = direction;
    handleSwing(direction); // trigger the bat swing with timing

    // Show gesture indicator briefly
    showGestureIndicator(direction);

    // Update pitch shot overlay
    const overlayIcon = document.getElementById('pitchShotIcon');
    const overlayName = document.getElementById('pitchShotName');
    const arrows = { straight: '\u2191', pull: '\u2190', cut: '\u2192', defense: '\u2193' };
    const names = { straight: 'DRIVE', pull: 'PULL', cut: 'CUT', defense: 'BLOCK' };
    if (overlayIcon) overlayIcon.textContent = arrows[direction] || '\u2191';
    if (overlayName) overlayName.textContent = names[direction] || 'DRIVE';

    battingSwipeStart = null;
  }

  // --- DRAG-PATH BOWLING (mobile) ---
  // Drag finger down the pitch to bowl

  let bowlingDragPath = [];
  let bowlingDragStart = null;

  function handleBowlingTouchStart(e) {
    if (state.phase !== 'BOWLING') return;
    if (state.bowlingDeliveryPhase !== 'selecting') return;

    const touch = e.touches[0];
    bowlingDragStart = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    bowlingDragPath = [{ x: touch.clientX, y: touch.clientY }];
  }

  function handleBowlingTouchMove(e) {
    if (!bowlingDragStart) return;
    if (state.phase !== 'BOWLING') return;
    const touch = e.touches[0];
    bowlingDragPath.push({ x: touch.clientX, y: touch.clientY });
  }

  function handleBowlingTouchEnd(e) {
    if (!bowlingDragStart) return;
    if (state.phase !== 'BOWLING' || state.bowlingDeliveryPhase !== 'selecting') {
      bowlingDragStart = null;
      bowlingDragPath = [];
      return;
    }

    const touch = e.changedTouches[0];
    const duration = Date.now() - bowlingDragStart.time;
    const totalDist = Math.sqrt(
      Math.pow(touch.clientX - bowlingDragStart.x, 2) +
      Math.pow(touch.clientY - bowlingDragStart.y, 2)
    );

    // Analyze the drag path
    const delivery = analyzeBowlingDrag(bowlingDragPath, duration, totalDist);

    state.selectedDelivery = delivery.type;
    state.selectedLine = delivery.line;

    // Accuracy based on how smooth the drag was
    const accuracy = delivery.accuracy;
    state._tapAccuracy = accuracy;

    // Set meter position based on accuracy for outcome resolution
    state.meterPosition = accuracy === 'perfect' ? 0.5 : accuracy === 'good' ? 0.3 : 0.1;
    state.meterStopped = true;
    state.meterActive = false;

    showBowlingGestureIndicator(delivery.type);
    flashPitchZone(bowlingDragStart.y / window.innerHeight);
    updateBowlingHUD();

    // Bowl immediately after short delay
    setTimeout(() => {
      if (state.phase !== 'BOWLING' || state.bowlingDeliveryPhase !== 'selecting') return;
      state.bowlingDeliveryPhase = 'bowling';
      bowlingBallActive = true;
      bowlingBallStartTime = Date.now();
      bowlingBallProgress = 0;
      bowlingBallSpeed = 800;
      haptic([10]);
      if (accuracy === 'perfect') haptic([10, 5, 10]);
      playDeliveryWhoosh();
    }, 300);

    bowlingDragStart = null;
    bowlingDragPath = [];
  }

  function analyzeBowlingDrag(path, duration, totalDist) {
    if (path.length < 2) return { type: 'straight', line: 'middle', accuracy: 'bad' };

    const startY = path[0].y;
    const endY = path[path.length - 1].y;
    const startX = path[0].x;
    const endX = path[path.length - 1].x;
    const screenH = window.innerHeight;
    const screenW = window.innerWidth;
    const dragLength = endY - startY; // positive = dragging down
    const speed = totalDist / Math.max(1, duration); // px per ms

    let type = 'straight';

    // ── BOUNCER: Quick short flick downward (fast, short distance) ──
    if (speed > 0.5 && totalDist < screenH * 0.35 && duration < 350) {
      type = 'bouncer';
    }
    // ── YORKER: Tap and hold (> 400ms, minimal movement), then release ──
    else if (duration > 400 && totalDist < screenH * 0.2) {
      type = 'yorker';
    }
    // ── SLOWER BALL: Slow gentle swipe (low speed, moderate distance) ──
    else if (speed < 0.3 && duration > 400) {
      type = 'slower';
    }
    // ── SWING: Check lateral curve in the drag path ──
    else {
      const midIdx = Math.floor(path.length / 2);
      if (midIdx > 0 && midIdx < path.length) {
        const midX = path[midIdx].x;
        const expectedMidX = (startX + endX) / 2;
        const curve = midX - expectedMidX;

        if (curve > 15) type = 'outswing';      // drag curves right
        else if (curve < -15) type = 'inswing';  // drag curves left
      }
      // ── STRAIGHT: Default for normal downward swipe ──
    }

    // Line from horizontal end position
    const endNorm = endX / screenW;
    const line = endNorm < 0.35 ? 'off' : endNorm > 0.65 ? 'leg' : 'middle';

    // Accuracy from path smoothness (less jitter = more accurate)
    let jitter = 0;
    for (let i = 2; i < path.length; i++) {
      const dx = path[i].x - path[i-1].x;
      const prevDx = path[i-1].x - path[i-2].x;
      jitter += Math.abs(dx - prevDx);
    }
    const avgJitter = jitter / Math.max(1, path.length - 2);
    const accuracy = avgJitter < 3 ? 'perfect' : avgJitter < 8 ? 'good' : 'bad';

    return { type, line, accuracy };
  }

  if (gameContainer) {
    gameContainer.addEventListener('touchstart', (e) => {
      initAudio();
      resumeAudio();

      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();

      // Dispatch to batting or bowling handler
      handleBattingTouchStart(e);
      handleBowlingTouchStart(e);
    }, { passive: true });

    gameContainer.addEventListener('touchmove', (e) => {
      handleBowlingTouchMove(e);
    }, { passive: true });

    gameContainer.addEventListener('touchend', (e) => {
      // Bowling drag-path
      if (state.phase === 'BOWLING' && bowlingDragStart) {
        handleBowlingTouchEnd(e);
        return;
      }

      // Batting one-swipe
      if (state.phase === 'BATTING' && battingSwipeStart) {
        handleBattingTouchEnd(e);
        return;
      }
    }, { passive: true });
  }

  // ============================================
  // FIRST-TIME TUTORIAL
  // ============================================

  const BATTING_TUTORIAL = [
    {
      title: 'HOW TO BAT',
      body: 'Swipe in any direction to play your shot!',
      diagram: '<div class="cb-tutorial-arrows">\u2191 Lofted<br>\u2190 Pull \u00A0\u00A0\u00A0 Cut \u2192<br>\u2193 Defense</div>'
    },
    {
      title: 'TIMING IS KEY',
      body: 'Swipe as the ball reaches the cyan marker on the pitch for PERFECT timing!',
      diagram: '<div style="font-size:2rem;">\u{1F3CF} \u2192 \u2B55</div>'
    },
    {
      title: 'BUILD CONFIDENCE',
      body: 'Hit boundaries to enter the ZONE \u2014 timing gets easier the more you score!',
      diagram: '<div style="font-size:2rem;">\u2728 \u{1F525} \u2728</div>'
    }
  ];

  const BOWLING_TUTORIAL = [
    {
      title: 'HOW TO BOWL',
      body: '<b>Swipe down</b> \u2192 Straight<br><b>Curve left</b> \u2192 Inswing<br><b>Curve right</b> \u2192 Outswing',
      diagram: '<div style="font-size:1.5rem;line-height:1.8;">\u2B07\uFE0F Straight &nbsp; \u21A9\uFE0F In &nbsp; \u21AA\uFE0F Out</div>'
    },
    {
      title: 'SPECIAL DELIVERIES',
      body: '<b>Quick flick</b> (fast + short) \u2192 Bouncer \u{1F4A5}<br><b>Tap & hold</b> (500ms+) \u2192 Yorker \u{1F3AF}<br><b>Slow swipe</b> \u2192 Slower ball',
      diagram: '<div style="font-size:1.5rem;">\u26A1 Flick &nbsp; \u{1F44A} Hold &nbsp; \u{1F40C} Slow</div>'
    },
    {
      title: 'AIM & ACCURACY',
      body: 'End your swipe <b>left</b> = off stump<br>End <b>center</b> = middle<br>End <b>right</b> = leg stump<br><br>Smooth drag = perfect accuracy!',
      diagram: '<div style="font-size:2rem;">\u{1F3AF}</div>'
    }
  ];

  let currentTutorial = null;
  let currentSlideIdx = 0;

  function showTutorial(type) {
    const seen = localStorage.getItem('cricket-blitz-' + type + '-tutorial-seen');
    if (seen) return false; // already seen

    currentTutorial = type === 'batting' ? BATTING_TUTORIAL : BOWLING_TUTORIAL;
    currentSlideIdx = 0;
    renderTutorialSlide();

    const overlay = $('tutorialOverlay');
    if (overlay) {
      overlay.classList.add('show');
      overlay.style.display = 'flex';
    }

    return true; // tutorial shown, caller should wait
  }

  function renderTutorialSlide() {
    const slide = currentTutorial[currentSlideIdx];
    const el = $('tutorialSlide');
    const dots = $('tutorialDots');
    const nextBtn = $('tutorialNext');

    if (el) el.innerHTML = '<h3>' + slide.title + '</h3><p>' + slide.body + '</p>' + slide.diagram;

    // Dots
    if (dots) {
      dots.innerHTML = currentTutorial.map(function(_, i) {
        return '<div class="cb-tutorial-dot ' + (i === currentSlideIdx ? 'active' : '') + '"></div>';
      }).join('');
    }

    // Last slide changes button
    if (nextBtn) nextBtn.textContent = currentSlideIdx === currentTutorial.length - 1 ? 'GOT IT!' : 'NEXT \u2192';
  }

  window._cbNextTutorialSlide = function() {
    currentSlideIdx++;
    if (currentSlideIdx >= currentTutorial.length) {
      closeTutorial();
    } else {
      renderTutorialSlide();
    }
  };

  window._cbSkipTutorial = function() {
    closeTutorial();
  };

  function closeTutorial() {
    const type = currentTutorial === BATTING_TUTORIAL ? 'batting' : 'bowling';
    localStorage.setItem('cricket-blitz-' + type + '-tutorial-seen', 'true');
    const overlay = $('tutorialOverlay');
    if (overlay) { overlay.classList.remove('show'); overlay.style.display = 'none'; }

    // Resume the game after tutorial
    if (type === 'batting') {
      startDelivery(); // start first ball
    } else {
      state.bowlingDeliveryPhase = 'selecting';
    }
  }

  // ============================================
  // GAME LOOP
  // ============================================

  let animFrameId = null;

  function gameLoop(timestamp) {
    animFrameId = requestAnimationFrame(gameLoop);

    if (state.paused) return;

    const dt = state.lastFrameTime ? Math.min(0.05, (timestamp - state.lastFrameTime) / 1000) : 0.016;
    state.lastFrameTime = timestamp;

    updateDelivery(dt);
    if (state.phase === 'BOWLING') {
      updateBowlingMeter(dt);
      updatePitchTargetZones();
    } else if (pitchTargetZones.length) {
      pitchTargetZones.forEach(z => { z.visible = false; });
    }
    updateThreeScene(dt);
    renderFloatingTexts();
    renderThreeScene();
  }

  // Visibility change (pause when tab hidden)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      state.paused = true;
      // Pause auto-advance countdowns
      if (window._cbAutoOverInt) {
        clearInterval(window._cbAutoOverInt);
        window._cbAutoOverInt = null;
      }
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
      icon: '\u{1F3CF}',
      gameId: 'cricket-blitz',
      buttons: ['sound', 'leaderboard', 'auth'],
      onSound: () => {
        state.soundEnabled = !state.soundEnabled;
        if (masterGain) masterGain.gain.value = state.soundEnabled ? 0.5 : 0;
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
    if (state.matchPhase === 'bowling') {
      startNextBowlingOver();
    } else {
      startNextOver();
    }
  };

  window._cbNextBowlingOver = function() {
    if (state.phase !== 'BETWEEN_OVERS') return;
    startNextBowlingOver();
  };

  window._cbStartBowling = function() {
    if (state.phase !== 'INNINGS_BREAK') return;
    startBowlingInnings();
  };

  window._cbSelectDelivery = function(type) {
    selectDeliveryType(type);
  };

  window._cbSelectLine = function(line) {
    selectLine(line);
  };

  window._cbBowlingMeterTap = function() {
    if (state.bowlingDeliveryPhase === 'selecting') {
      startBowlingMeter();
    } else if (state.bowlingDeliveryPhase === 'meter') {
      stopBowlingMeter();
    }
  };

  window._cbTossChoice = function(choice) {
    if (state.phase !== 'TOSS') return;
    handleTossChoice(choice);
  };

  window._cbTossContinue = function() {
    if (state.phase !== 'TOSS') return;
    handleTossContinue();
  };

  window._cbStartBattingChase = function() {
    if (state.phase !== 'INNINGS_BREAK') return;
    startBattingChase();
  };

  window._cbStartSuperOverBatting = function() {
    if (state.phase !== 'SUPER_OVER') return;
    startSuperOverBatting();
  };

  window._cbStartSuperOverBowling = function() {
    if (state.phase !== 'SUPER_OVER') return;
    startSuperOverBowling();
  };

  window._cbPlayAgain = function() {
    resetToTitle();
  };

  window._cbShare = function() {
    try {
      const score = state.lastFinalScore || localStorage.getItem('cricket-blitz-high-score') || '0';
      const text = `I scored ${score} in Cricket Blitz! Can you beat it? Play at ${location.origin}/games/cricket-blitz/`;
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

    // Init Three.js scene
    initThreeScene();

    // Add floating text container to game container
    gameContainer.appendChild(floatingTextContainer);

    // Resize
    window.addEventListener('resize', handleResize);
    if (window.ResizeObserver) {
      new ResizeObserver(() => handleResize()).observe(gameContainer);
    }

    // Build team select
    buildTeamGrid();

    // Patch #23: Load login streak
    state.loginStreak = loadLoginStreak();

    // Patch #19: Load bat skin
    state.selectedBatSkin = loadSelectedBatSkin();

    // Build title screen extras (daily challenge, bat skin, streak)
    buildTitleExtras();

    // Show best score
    try {
      const best = localStorage.getItem('cricket-blitz-high-score');
      const el = $('titleBest');
      if (best && el) el.textContent = `Best: ${best} pts`;
    } catch (e) {}

    // How to play — opens as overlay, close with X or clicking "How to Play" again
    const htpBtn = $('howToPlayBtn');
    const htpPanel = $('howToPlay');
    const htpClose = $('htpCloseBtn');
    function closeHtp() {
      if (htpPanel) htpPanel.classList.remove('expanded');
      if (htpBtn) htpBtn.textContent = 'How to Play';
    }
    if (htpBtn && htpPanel) {
      htpBtn.addEventListener('click', () => {
        const opening = !htpPanel.classList.contains('expanded');
        if (opening) {
          htpPanel.classList.add('expanded');
          htpBtn.textContent = 'Hide Instructions';
        } else {
          closeHtp();
        }
      });
    }
    if (htpClose) htpClose.addEventListener('click', closeHtp);

    // Play button
    const playBtn = $('playBtn');
    if (playBtn) {
      playBtn.addEventListener('click', () => startGame());
    }

    // Init header
    if (window.gameHeader) {
      initHeader();
    } else {
      const check = setInterval(() => {
        if (window.gameHeader) {
          clearInterval(check);
          initHeader();
        }
      }, 100);
      setTimeout(() => clearInterval(check), 5000);
    }

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
