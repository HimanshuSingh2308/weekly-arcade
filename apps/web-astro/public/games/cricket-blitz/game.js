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
    'cb-all-teams':        { name: 'Franchise Collector', desc: 'Play a game with each of the 6 teams',     xp: 50 },
    'cb-first-wicket':     { name: 'Wicket Taker',       desc: 'Take your first wicket while bowling',    xp: 15 },
    'cb-five-wickets':     { name: 'Five-For',           desc: 'Take 5 wickets in a bowling innings',     xp: 100 },
    'cb-full-match-win':   { name: 'Match Winner',       desc: 'Win a complete match (bat + bowl)',        xp: 75 },
    'cb-clean-sweep':      { name: 'Clean Sweep',        desc: 'Win by 30+ runs margin',                  xp: 100 },
    'cb-yorker-master':    { name: 'Yorker Master',      desc: 'Take 3 wickets with yorkers',             xp: 75 }
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
    bowlingBestOverRuns: 0,
    lastTwoDeliveryFast: false,

    // Combo streak
    comboStreak: 0,

    // Camera shake
    cameraShakeTime: 0,
    cameraShakeIntensity: 0,

    // Gesture controls
    gestureDirection: null,
    gestureConfirmed: false,

    // Ball approach sound
    ballApproachActive: false
  };

  // ============================================
  // DOM REFS
  // ============================================

  const $ = (id) => document.getElementById(id);
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

  // Bowling UI refs (may be null until DOM ready)
  let bowlingPanel, bowlingMeter, bowlingMeterFill, bowlingMeterIndicator;
  let bowlingLineIndicators, bowlingHudTop, bowlingHudBottom;
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

  // Scatter physics for stumps
  let scatterStumps = [];
  let scatterBails = [];

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
    renderer.shadowMap.enabled = false; // keep perf high
    renderer.setClearColor(0x050d1a, 1);

    const container = $('threeContainer');
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a1628, 0.006);

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
            // Bottom: dark green horizon
            vec3 horizon = vec3(0.05, 0.12, 0.04);
            // Warm glow near horizon (stadium light pollution)
            vec3 warmGlow = vec3(0.14, 0.10, 0.04);
            // Middle: deep navy
            vec3 midSky = vec3(0.04, 0.086, 0.157);
            // Top: dark blue-black
            vec3 topSky = vec3(0.02, 0.05, 0.1);

            vec3 color;
            if (height < 0.0) {
              color = horizon;
            } else if (height < 0.08) {
              float t = height / 0.08;
              color = mix(horizon, warmGlow, t);
            } else if (height < 0.2) {
              float t = (height - 0.08) / 0.12;
              color = mix(warmGlow, midSky, t);
            } else {
              float t = clamp((height - 0.2) / 0.6, 0.0, 1.0);
              color = mix(midSky, topSky, t);
            }
            gl_FragColor = vec4(color, 1.0);
          }
        `
      });
      const skyDome = new THREE.Mesh(skyGeo, skyMat);
      scene.add(skyDome);

      // Stars (upper hemisphere only)
      const starCount = 200;
      const starPositions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.45; // upper hemisphere
        const r = 195;
        starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        starPositions[i * 3 + 1] = r * Math.cos(phi);
        starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
      const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, sizeAttenuation: true });
      scene.add(new THREE.Points(starGeo, starMat));

      // Crescent moon
      const moonGeo = new THREE.CircleGeometry(2, 32);
      const moonMat = new THREE.MeshBasicMaterial({ color: 0xF5F0D0, transparent: true, opacity: 0.9 });
      const moon = new THREE.Mesh(moonGeo, moonMat);
      moon.position.set(60, 140, 80);
      moon.lookAt(0, 0, 0);
      scene.add(moon);
      // Dark circle to make crescent shape
      const crescentGeo = new THREE.CircleGeometry(1.8, 32);
      const crescentMat = new THREE.MeshBasicMaterial({ color: 0x050d1a });
      const crescent = new THREE.Mesh(crescentGeo, crescentMat);
      crescent.position.set(61, 140.5, 80);
      crescent.lookAt(0, 0, 0);
      scene.add(crescent);
    })();

    // Camera
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
    camera.position.set(0, 6, -8);
    camera.lookAt(0, 0.5, 12);

    // Lighting
    const ambient = new THREE.AmbientLight(0x404060, 0.5);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xfff5e0, 0.7);
    dirLight.position.set(5, 20, 0);
    scene.add(dirLight);

    // Build stadium
    buildGround();
    buildPitch();
    buildBoundary();
    buildStands();
    buildFloodlights();
    buildCrowd();

    // Build players
    buildBatsman();
    buildBowler();
    buildBall();
    buildStumps();
    buildSweetSpot();
    buildFielders();
    buildSweetSpotRing();

    // Post-ball mesh
    const pbGeo = new THREE.SphereGeometry(0.15, 12, 8);
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
    camera.updateProjectionMatrix();
  }

  // ---- Ground ----
  function buildGround() {
    // Outer darker ground
    const outerGeo = new THREE.CircleGeometry(80, 64);
    const outerMat = new THREE.MeshLambertMaterial({ color: 0x1e6b14 });
    ground = new THREE.Mesh(outerGeo, outerMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    scene.add(ground);

    // Inner lighter ground (near pitch)
    const innerGeo = new THREE.CircleGeometry(30, 48);
    const innerMat = new THREE.MeshLambertMaterial({ color: 0x34a024 });
    const innerGround = new THREE.Mesh(innerGeo, innerMat);
    innerGround.rotation.x = -Math.PI / 2;
    innerGround.position.set(0, 0.005, 11);
    scene.add(innerGround);

    // 30-yard circle marking
    const innerRingGeo = new THREE.RingGeometry(29.8, 30.1, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
    const innerRing = new THREE.Mesh(innerRingGeo, ringMat);
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.set(0, 0.02, 11);
    scene.add(innerRing);
  }

  // ---- Pitch Strip ----
  function buildPitch() {
    const geo = new THREE.PlaneGeometry(3, 22);
    const mat = new THREE.MeshLambertMaterial({ color: 0xc8a96e });
    pitchStrip = new THREE.Mesh(geo, mat);
    pitchStrip.rotation.x = -Math.PI / 2;
    pitchStrip.position.set(0, 0.01, 11);
    scene.add(pitchStrip);

    // Pitch texture dots
    const dotGeo = new THREE.PlaneGeometry(0.06, 0.06);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xa0783c, transparent: true, opacity: 0.3 });
    for (let i = 0; i < 60; i++) {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(
        (Math.random() - 0.5) * 2.8,
        0.015,
        11 + (Math.random() - 0.5) * 20
      );
      scene.add(dot);
    }
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

  // ---- Boundary Rope ----
  function buildBoundary() {
    const geo = new THREE.RingGeometry(78, 79, 64);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
    boundaryRope = new THREE.Mesh(geo, mat);
    boundaryRope.rotation.x = -Math.PI / 2;
    boundaryRope.position.y = 0.02;
    scene.add(boundaryRope);
  }

  // ---- Stands / Crowd Wall ----
  function buildStands() {
    // A curved wall around the boundary using a partial cylinder
    const geo = new THREE.CylinderGeometry(82, 82, 12, 64, 1, true, 0, Math.PI * 2);
    const mat = new THREE.MeshLambertMaterial({
      color: 0x1a1a3e,
      side: THREE.BackSide
    });
    standsMesh = new THREE.Mesh(geo, mat);
    standsMesh.position.set(0, 6, 11);
    scene.add(standsMesh);
  }

  // ---- Crowd (colored dots as sprites on the stands) ----
  function buildCrowd() {
    const count = 500;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 81;
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
  }

  function updateCrowdColors() {
    if (!crowdMesh) return;
    const colors = crowdMesh.geometry.getAttribute('color');
    const count = Math.min(8, colors.count);
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

  // ---- Sweet Spot ----
  function buildSweetSpot() {
    const geo = new THREE.BoxGeometry(4, 0.02, 0.08);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0 });
    sweetSpotLine = new THREE.Mesh(geo, mat);
    sweetSpotLine.position.set(0, 0.03, 1.5);
    scene.add(sweetSpotLine);
  }

  // ---- Sweet Spot Ring (pulsing timing guide) ----
  let sweetSpotRing;
  function buildSweetSpotRing() {
    const geo = new THREE.RingGeometry(0.6, 0.8, 32);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0, side: THREE.DoubleSide });
    sweetSpotRing = new THREE.Mesh(geo, mat);
    sweetSpotRing.rotation.x = -Math.PI / 2;
    sweetSpotRing.position.set(0, 0.03, 1.0);
    scene.add(sweetSpotRing);
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

  function updateFielderColors() {
    if (!fielderMeshes.length) return;
    const oppTeam = state.opponentTeam ? TEAMS[state.opponentTeam] : null;
    const color = new THREE.Color(oppTeam ? oppTeam.primary : '#666666');
    fielderMeshes.forEach(group => {
      // Body is the first child mesh in each fielder group
      if (group.children && group.children[0]) {
        group.children[0].material.color.copy(color);
      }
    });
  }

  // ---- Batsman ----
  function buildBatsman() {
    batsmanGroup = new THREE.Group();
    batsmanGroup.position.set(0, 0, 0.9);

    const teamColor = 0x004BA0;
    const skinColor = 0xdba67a;

    // Shoes
    const shoeGeo = new THREE.BoxGeometry(0.1, 0.05, 0.15);
    const shoeMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });
    const shoeL = new THREE.Mesh(shoeGeo, shoeMat);
    shoeL.position.set(-0.12, 0.025, 0.02);
    batsmanGroup.add(shoeL);
    const shoeR = new THREE.Mesh(shoeGeo, shoeMat);
    shoeR.position.set(0.12, 0.025, 0.02);
    batsmanGroup.add(shoeR);

    // Legs (white cricket pads)
    const legGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.5, 8);
    const legMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });
    batsmanLegL = new THREE.Mesh(legGeo, legMat);
    batsmanLegL.position.set(-0.12, 0.3, 0);
    batsmanLegL.rotation.z = THREE.MathUtils.degToRad(2);
    batsmanGroup.add(batsmanLegL);

    batsmanLegR = new THREE.Mesh(legGeo, legMat);
    batsmanLegR.position.set(0.12, 0.3, 0);
    batsmanLegR.rotation.z = THREE.MathUtils.degToRad(-2);
    batsmanGroup.add(batsmanLegR);

    // Torso (jersey - box shape)
    const bodyGeo = new THREE.BoxGeometry(0.4, 0.5, 0.2);
    const bodyMat = new THREE.MeshLambertMaterial({ color: teamColor });
    batsmanBody = new THREE.Mesh(bodyGeo, bodyMat);
    batsmanBody.position.y = 0.8;
    batsmanBody.rotation.x = THREE.MathUtils.degToRad(10);
    batsmanGroup.add(batsmanBody);

    // Team stripe across chest
    const stripeGeo = new THREE.BoxGeometry(0.41, 0.08, 0.21);
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.set(0, 0.85, 0);
    stripe.rotation.x = THREE.MathUtils.degToRad(10);
    batsmanGroup.add(stripe);

    // Arms (sleeves)
    const armGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.4, 6);
    const armMat = new THREE.MeshLambertMaterial({ color: teamColor });
    const armL = new THREE.Mesh(armGeo, armMat);
    armL.position.set(-0.26, 0.9, -0.05);
    armL.rotation.z = THREE.MathUtils.degToRad(15);
    armL.rotation.x = THREE.MathUtils.degToRad(20);
    batsmanGroup.add(armL);
    const armR = new THREE.Mesh(armGeo, armMat);
    armR.position.set(0.26, 0.9, -0.05);
    armR.rotation.z = THREE.MathUtils.degToRad(-15);
    armR.rotation.x = THREE.MathUtils.degToRad(20);
    batsmanGroup.add(armR);

    // Hands (gloves)
    const handGeo = new THREE.SphereGeometry(0.05, 6, 4);
    const handMat = new THREE.MeshLambertMaterial({ color: skinColor });
    const handL = new THREE.Mesh(handGeo, handMat);
    handL.position.set(-0.32, 0.7, -0.18);
    batsmanGroup.add(handL);
    const handR = new THREE.Mesh(handGeo, handMat);
    handR.position.set(0.32, 0.7, -0.18);
    batsmanGroup.add(handR);

    // Neck
    const neckGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.1, 6);
    const neckMat = new THREE.MeshLambertMaterial({ color: skinColor });
    const neck = new THREE.Mesh(neckGeo, neckMat);
    neck.position.y = 1.1;
    batsmanGroup.add(neck);

    // Helmet (slightly flattened sphere)
    const helmGeo = new THREE.SphereGeometry(0.18, 12, 8);
    const helmMat = new THREE.MeshLambertMaterial({ color: teamColor });
    batsmanHelmet = new THREE.Mesh(helmGeo, helmMat);
    batsmanHelmet.position.y = 1.28;
    batsmanHelmet.scale.y = 0.85;
    batsmanGroup.add(batsmanHelmet);

    // Visor (dark strip across front-bottom of helmet)
    const visorGeo = new THREE.BoxGeometry(0.22, 0.06, 0.08);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    batsmanVisor = new THREE.Mesh(visorGeo, visorMat);
    batsmanVisor.position.set(0, 1.22, -0.14);
    batsmanGroup.add(batsmanVisor);

    // Bat group (pivots at shoulder for swing animation)
    batGroup = new THREE.Group();
    batGroup.position.set(0.3, 1.2, 0);

    // Bat handle (cylinder on top)
    const handleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6);
    const handleMat = new THREE.MeshLambertMaterial({ color: 0x8B6914 });
    batHandle = new THREE.Mesh(handleGeo, handleMat);
    batHandle.position.y = -0.15;
    batGroup.add(batHandle);

    // Bat blade
    const bladeGeo = new THREE.BoxGeometry(0.06, 0.55, 0.04);
    const bladeMat = new THREE.MeshLambertMaterial({ color: 0xD4A87C });
    batBlade = new THREE.Mesh(bladeGeo, bladeMat);
    batBlade.position.y = -0.53;
    batGroup.add(batBlade);

    // Blade highlight edge
    const edgeGeo = new THREE.BoxGeometry(0.02, 0.55, 0.045);
    const edgeMat = new THREE.MeshLambertMaterial({ color: 0xe8c888 });
    batHighlight = new THREE.Mesh(edgeGeo, edgeMat);
    batHighlight.position.set(-0.02, -0.53, 0);
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

    const skinColor = 0xdba67a;
    const oppColor = 0x666666;

    // Shoes
    const shoeGeo = new THREE.BoxGeometry(0.08, 0.04, 0.12);
    const shoeMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });
    const shoeL = new THREE.Mesh(shoeGeo, shoeMat);
    shoeL.position.set(-0.08, 0.02, 0.05);
    bowlerGroup.add(shoeL);
    const shoeR = new THREE.Mesh(shoeGeo, shoeMat);
    shoeR.position.set(0.08, 0.02, -0.05);
    bowlerGroup.add(shoeR);

    // Legs (running pose: one forward, one back)
    const legGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.35, 6);
    const legMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });
    bowlerLegL = new THREE.Mesh(legGeo, legMat);
    bowlerLegL.position.set(-0.08, 0.2, 0.05);
    bowlerLegL.rotation.x = THREE.MathUtils.degToRad(-15); // front leg
    bowlerGroup.add(bowlerLegL);

    bowlerLegR = new THREE.Mesh(legGeo, legMat);
    bowlerLegR.position.set(0.08, 0.2, -0.05);
    bowlerLegR.rotation.x = THREE.MathUtils.degToRad(15); // back leg
    bowlerGroup.add(bowlerLegR);

    // Torso (jersey)
    const bodyGeo = new THREE.BoxGeometry(0.3, 0.4, 0.18);
    const bodyMat = new THREE.MeshLambertMaterial({ color: oppColor });
    bowlerBody = new THREE.Mesh(bodyGeo, bodyMat);
    bowlerBody.position.y = 0.6;
    bowlerGroup.add(bowlerBody);

    // Team stripe on bowler torso
    const stripeGeo = new THREE.BoxGeometry(0.31, 0.06, 0.19);
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.y = 0.65;
    bowlerGroup.add(stripe);

    // Non-bowling arm (left, at side)
    const armGeoL = new THREE.CylinderGeometry(0.04, 0.03, 0.35, 6);
    const armMatL = new THREE.MeshLambertMaterial({ color: oppColor });
    const armL = new THREE.Mesh(armGeoL, armMatL);
    armL.position.set(-0.2, 0.55, 0.05);
    armL.rotation.z = THREE.MathUtils.degToRad(20);
    armL.rotation.x = THREE.MathUtils.degToRad(-20);
    bowlerGroup.add(armL);

    // Neck
    const neckGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.08, 6);
    const neckMat = new THREE.MeshLambertMaterial({ color: skinColor });
    const neck = new THREE.Mesh(neckGeo, neckMat);
    neck.position.y = 0.84;
    bowlerGroup.add(neck);

    // Head
    const headGeo = new THREE.SphereGeometry(0.12, 10, 8);
    const headMat = new THREE.MeshLambertMaterial({ color: skinColor });
    bowlerHead = new THREE.Mesh(headGeo, headMat);
    bowlerHead.position.y = 1.0;
    bowlerGroup.add(bowlerHead);

    // Bowling arm (right, raised for delivery)
    const armGeo = new THREE.CylinderGeometry(0.04, 0.03, 0.5, 6);
    const armMat = new THREE.MeshLambertMaterial({ color: skinColor });
    bowlerArm = new THREE.Mesh(armGeo, armMat);
    bowlerArm.position.set(0.2, 1.05, 0);
    bowlerArm.rotation.z = THREE.MathUtils.degToRad(-30);
    bowlerArm.visible = false;
    bowlerGroup.add(bowlerArm);

    // Ball in hand
    const bhGeo = new THREE.SphereGeometry(0.08, 8, 6);
    const bhMat = new THREE.MeshPhongMaterial({ color: 0xcc0000 });
    bowlerBallInHand = new THREE.Mesh(bhGeo, bhMat);
    bowlerBallInHand.visible = false;
    bowlerGroup.add(bowlerBallInHand);

    scene.add(bowlerGroup);
  }

  // ---- Ball ----
  function buildBall() {
    const geo = new THREE.SphereGeometry(0.15, 16, 12);
    const mat = new THREE.MeshPhongMaterial({ color: 0xcc0000, shininess: 80 });
    ballMesh = new THREE.Mesh(geo, mat);
    ballMesh.visible = false;
    scene.add(ballMesh);

    // Seam (torus)
    const seamGeo = new THREE.TorusGeometry(0.14, 0.015, 4, 16);
    const seamMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    ballSeam = new THREE.Mesh(seamGeo, seamMat);
    ballSeam.visible = false;
    scene.add(ballSeam);

    // Shadow on ground
    const shadowGeo = new THREE.CircleGeometry(0.2, 12);
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
    // Position stumps slightly behind batsman so tops are visible
    stumpsGroup.position.set(0, 0, 1.2);

    const stumpGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6);
    const stumpMat = new THREE.MeshLambertMaterial({ color: 0xD4A87C });

    for (let i = -1; i <= 1; i++) {
      const stump = new THREE.Mesh(stumpGeo, stumpMat.clone());
      stump.position.set(i * 0.1, 0.35, 0);
      stumpsGroup.add(stump);
      stumpMeshes.push(stump);
    }

    // Bails (wider, resting on top)
    const bailGeo = new THREE.BoxGeometry(0.12, 0.02, 0.02);
    const bailMat = new THREE.MeshLambertMaterial({ color: 0xf0d8a0 });

    const bail1 = new THREE.Mesh(bailGeo, bailMat.clone());
    bail1.position.set(-0.05, 0.72, 0);
    stumpsGroup.add(bail1);
    bailMeshes.push(bail1);

    const bail2 = new THREE.Mesh(bailGeo, bailMat.clone());
    bail2.position.set(0.05, 0.72, 0);
    stumpsGroup.add(bail2);
    bailMeshes.push(bail2);

    scene.add(stumpsGroup);

    // Crease lines
    creaseLineBatsman = buildCreaseLine(1.5, 4);
    creaseLineBowler = buildCreaseLine(19.5, 2.5);

    // Bowler-end stumps (far end)
    stumpsGroupFar = new THREE.Group();
    stumpsGroupFar.position.set(0, 0, 20);

    for (let i = -1; i <= 1; i++) {
      const stump = new THREE.Mesh(stumpGeo, stumpMat.clone());
      stump.position.set(i * 0.1, 0.35, 0);
      stumpsGroupFar.add(stump);
      stumpMeshesFar.push(stump);
    }
    const bailFar1 = new THREE.Mesh(bailGeo, bailMat.clone());
    bailFar1.position.set(-0.05, 0.72, 0);
    stumpsGroupFar.add(bailFar1);
    bailMeshesFar.push(bailFar1);

    const bailFar2 = new THREE.Mesh(bailGeo, bailMat.clone());
    bailFar2.position.set(0.05, 0.72, 0);
    stumpsGroupFar.add(bailFar2);
    bailMeshesFar.push(bailFar2);

    scene.add(stumpsGroupFar);
  }

  // ============================================
  // THREE.JS UPDATE (per frame)
  // ============================================

  function updateThreeScene(dt) {
    if (state.phase === 'BOWLING') {
      updateBowlingScene(dt);
      updateParticles3D(dt);
      updateCamera(dt);
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
        const pulse = 0.15 + 0.15 * Math.sin(Date.now() * 0.012);
        sweetSpotRing.material.opacity = pulse;
        const scale = 1 + 0.2 * Math.sin(Date.now() * 0.008);
        sweetSpotRing.scale.set(scale, scale, scale);
      } else {
        sweetSpotRing.material.opacity = 0;
      }
    }

    // Show/hide stumps based on scatter state
    stumpsGroup.visible = !state.stumpScatter;

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
        batGroup.rotation.z = THREE.MathUtils.degToRad(-30);
        batGroup.rotation.y = 0;
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

    ballSeam.visible = true;
    ballSeam.position.copy(ballMesh.position);
    ballSeam.rotation.x = Date.now() * 0.01; // spin

    ballShadow.visible = true;
    ballShadow.position.set(bx, 0.01, bz);
    const shadowScale = 0.5 + by * 0.3;
    ballShadow.scale.set(shadowScale, shadowScale, 1);
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
      // Reset stumps
      state.stumpScatter = null;
      scatterStumps.forEach(s => scene.remove(s));
      scatterBails.forEach(b => scene.remove(b));
      scatterStumps = [];
      scatterBails = [];
      return;
    }

    // On first frame, create scatter meshes
    if (scatterStumps.length === 0) {
      const stumpGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6);
      const stumpMat = new THREE.MeshLambertMaterial({ color: 0xd4a574 });
      ss.pieces.forEach(p => {
        const mesh = new THREE.Mesh(stumpGeo, stumpMat);
        mesh.position.copy(stumpsGroup.position);
        mesh.position.y = 0.35;
        mesh.userData = { vx: p.vx, vy: p.vy, rot: p.rot };
        scene.add(mesh);
        scatterStumps.push(mesh);
      });

      const bailGeo = new THREE.BoxGeometry(0.1, 0.02, 0.02);
      const bailMat = new THREE.MeshLambertMaterial({ color: 0xe8c888 });
      ss.bails.forEach(b => {
        const mesh = new THREE.Mesh(bailGeo, bailMat);
        mesh.position.copy(stumpsGroup.position);
        mesh.position.y = 0.72;
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
      mesh.position.y = 0.35 + d.vy * t * 1.5 - 0.5 * gravity * t * t;
      mesh.position.z = stumpsGroup.position.z - t * 0.5;
      mesh.rotation.x = d.rot * t * 6;
      mesh.rotation.z = d.rot * t * 4;
      if (mesh.position.y < 0) mesh.position.y = 0;
    });

    scatterBails.forEach(mesh => {
      const d = mesh.userData;
      mesh.position.x = stumpsGroup.position.x + d.vx * t * 2;
      mesh.position.y = 0.72 + 3 * t - 0.5 * gravity * t * t;
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
      // Default camera position: wide TV broadcast angle behind batsman
      targetCamPos = new THREE.Vector3(0, 6, -8);
      targetLookAt = new THREE.Vector3(0, 0.5, 12);
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

  function renderThreeScene() {
    if (renderer && scene && camera) {
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
      if (state.ballIsOnStumps) return { runs: -1, type: 'bowled' };
      return { runs: 0, type: 'dot' };
    }

    let quality;
    if (timingMs <= state.timingPerfect) quality = 'perfect';
    else if (timingMs <= state.timingGood) quality = 'good';
    else if (timingMs <= 200) quality = 'mistimed';
    else {
      if (state.ballIsOnStumps) return { runs: -1, type: 'bowled' };
      return { runs: 0, type: 'dot' };
    }

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

    const roll = Math.random() * 100;
    let cum = 0;
    const outcomes = [0, 1, 2, 3, 4, 6, -1];
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

    // Tint ball based on delivery type
    const dType = state.ballDeliveryType === 'slower' ? 'slower' : state.ballDeliveryType;
    if (ballMesh && DELIVERY_COLORS[dType]) {
      ballMesh.material.color.setHex(DELIVERY_COLORS[dType]);
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
        }
        break;

      case 'inflight':
        if (deliveryPhase !== 'inflight') break;
        deliveryTimer += dt * 1000;
        state.ballProgress = Math.min(1, deliveryTimer / state.ballSpeed);

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
            // All out -- go to innings break instead of game over
            transitionToInningsBreak();
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
    stopBallApproach();

    // Use center-screen coords for floating text (relative to H)
    const textX = W / 2;
    const textBaseY = H * 0.4;

    if (outcome.runs === -1) {
      // WICKET
      state.wickets++;
      state.currentOverResults.push({ runs: 0, isWicket: true, isFour: false, isSix: false });
      state.consecutiveScoringBalls = 0;

      if (outcome.type === 'bowled') {
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
      cameraShake.active = true;
      cameraShake.start = Date.now();
      cameraShake.duration = 300;
      cameraShake.intensity = 0.1;

      playCrowdReaction('groan');
      spawnFloatingText('OUT!', textX, textBaseY, '#E8000D', 32);

      if (!reducedMotion) gameWrap.classList.add('cb-wicket-flash');
      setTimeout(() => gameWrap.classList.remove('cb-wicket-flash'), 500);

      haptic([100]);
      state.comboStreak = 0;
      announceScore(`Out! ${outcome.type}. ${state.runs} for ${state.wickets}.`);
      showBallCommentary(outcome, false);

      if (state.wickets < 3) {
        state.newBatsmanAnim = true;
        state.newBatsmanTime = Date.now() + 400;
      }

      updateHUD();
      return;
    }

    // Runs scored
    let runs = outcome.runs;
    const rawRuns = runs;
    if (state.isPowerplay && runs > 0) {
      runs = Math.round(runs * 1.5);
    }
    // Combo streak bonus: 1.5x on boundaries at streak 5+
    if (state.comboStreak >= 5 && (rawRuns === 4 || rawRuns === 6)) {
      runs = Math.round(runs * 1.5);
    }
    state.runs += runs;
    state.currentOverRuns += runs;
    state.currentOverResults.push({ runs, rawRuns, isWicket: false, isFour: rawRuns === 4, isSix: rawRuns === 6 });

    if (runs > 0) {
      state.consecutiveScoringBalls++;
      state.currentOverScoringBalls++;
      state.comboStreak++;
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
      cameraShake.active = true;
      cameraShake.start = Date.now();
      cameraShake.duration = 200;
      cameraShake.intensity = 0.05;
      checkAchievement('cb-first-four');
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
      cameraShake.active = true;
      cameraShake.start = Date.now();
      cameraShake.duration = 400;
      cameraShake.intensity = 0.15;
      checkAchievement('cb-first-six');
      triggerCrowdWave();
    } else if (runs === 0) {
      state.postBallType = 'default';
      state.postBallVx = (Math.random() - 0.5);
      spawnFloatingText('DOT', textX, textBaseY, 'rgba(255,255,255,0.6)', 20);
    } else {
      state.postBallType = 'default';
      state.postBallVx = (Math.random() - 0.5) * 1.5;
      spawnFloatingText(runs.toString(), textX, textBaseY, '#FFFFFF', 24);
    }

    // Milestone checks
    if (state.runs >= 50 && state.runs - runs < 50) {
      spawnFloatingText('FIFTY!', textX, textBaseY - 60, '#FFD700', 36);
      spawnParticles(textX, textBaseY - 40, 50, ['#FFD700'], 100, 1.5);
      checkAchievement('cb-fifty');
    }
    if (state.runs >= 100 && state.runs - runs < 100) {
      spawnFloatingText('CENTURY!', textX, textBaseY - 60, '#FFD700', 40);
      spawnParticles(textX, textBaseY - 40, 80, ['#FFD700', '#FF00FF', '#00FFFF'], 150, 2);
      checkAchievement('cb-century');
    }

    if (state.currentOverScoringBalls >= 6 && state.ballsInOver === 6) {
      checkAchievement('cb-perfect-over');
    }

    const announceText = runs === 0 ? 'Dot ball.' : `${runs} run${runs > 1 ? 's' : ''}.`;
    announceScore(`${announceText} Total: ${state.runs} for ${state.wickets}.`);

    hudRuns.classList.add('cb-score-pop');
    setTimeout(() => hudRuns.classList.remove('cb-score-pop'), 300);

    showBallCommentary(outcome, false);
    updateHUD();
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
  // OVER / LEVEL / GAME END
  // ============================================

  function endOver() {
    if (state.currentOverRuns > state.bestOverRuns) {
      state.bestOverRuns = state.currentOverRuns;
    }

    state.oversCompleted++;
    playCrowdClap();
    playUISound('overComplete');

    if (state.oversCompleted >= 5) {
      // Batting innings complete -- transition to innings break
      transitionToInningsBreak();
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

    const commentary = pickRandom(COMMENTARY.overEnd);

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
      <p class="cb-commentary">"${commentary}"</p>
      <div class="cb-over-bowler">Next: ${state.bowlerName}</div>
      <div class="cb-over-bowler-type">${state.bowlerType}</div>
      <button class="cb-btn" onclick="window._cbNextOver()">NEXT OVER &rarr;</button>
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

    if (state.wickets === 0 && state.totalBallsFaced >= 6) checkAchievement('cb-no-wicket');

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

  function startBowlingInnings() {
    if (!inningsBreakOverlay) return;
    inningsBreakOverlay.classList.remove('cb-visible');

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
    state.postBallActive = false;
    state.stumpScatter = null;
    state.particles = [];
    state.floatingTexts = [];

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
    bowlingHudTop = $('bowlingHudTop');
    bowlingHudBottom = $('bowlingHudBottom');

    // Show bowling UI
    if (bowlingPanel) bowlingPanel.style.display = 'flex';
    if (bowlingMeter) bowlingMeter.style.display = 'block';
    if (bowlingHudTop) bowlingHudTop.style.display = 'flex';
    if (bowlingHudBottom) bowlingHudBottom.style.display = 'flex';

    // Hide batting HUD
    hudTop.style.display = 'none';
    hudBottom.style.display = 'none';

    updateBowlingHUD();
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

    // Body
    const bodyGeo = new THREE.CapsuleGeometry(0.25, 0.6, 4, 8);
    const bodyMat = new THREE.MeshLambertMaterial({ color: oppColor });
    aiBatsmanBody = new THREE.Mesh(bodyGeo, bodyMat);
    aiBatsmanBody.position.y = 1.0;
    aiBatsmanGroup.add(aiBatsmanBody);

    // Helmet
    const helmGeo = new THREE.SphereGeometry(0.18, 12, 8);
    const helmMat = new THREE.MeshLambertMaterial({ color: oppColor });
    const aiHelmet = new THREE.Mesh(helmGeo, helmMat);
    aiHelmet.position.y = 1.55;
    aiBatsmanGroup.add(aiHelmet);
    aiBatsmanHelmet = aiHelmet;

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.6, 8);
    const legMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });
    const legL = new THREE.Mesh(legGeo, legMat);
    legL.position.set(-0.15, 0.3, 0);
    aiBatsmanGroup.add(legL);
    const legR = new THREE.Mesh(legGeo, legMat);
    legR.position.set(0.15, 0.3, 0);
    aiBatsmanGroup.add(legR);

    // Bat
    aiBatGroup = new THREE.Group();
    aiBatGroup.position.set(0.3, 1.2, 0);
    const handleGeo = new THREE.BoxGeometry(0.05, 0.35, 0.05);
    const handleMat = new THREE.MeshLambertMaterial({ color: 0x8B6914 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.y = -0.22;
    aiBatGroup.add(handle);
    const bladeGeo = new THREE.BoxGeometry(0.12, 0.5, 0.04);
    const bladeMat = new THREE.MeshLambertMaterial({ color: 0xd4a574 });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = -0.63;
    aiBatGroup.add(blade);
    aiBatGroup.rotation.z = THREE.MathUtils.degToRad(-30);
    aiBatsmanGroup.add(aiBatGroup);

    scene.add(aiBatsmanGroup);

    // Bowling ball (reuse the existing ball mesh for simplicity -- just control visibility)
    bowlingBallMesh = ballMesh;
    bowlingBallSeam = ballSeam;
    bowlingBallShadow = ballShadow;
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
      ballSeam.rotation.x = Date.now() * 0.01;
      ballShadow.visible = true;
      ballShadow.position.set(lateralX, 0.01, bz);

      // When ball reaches batsman, resolve
      if (bowlingBallProgress >= 1 && state.bowlingDeliveryPhase === 'bowling') {
        resolveBowlingOutcome();
      }
    } else {
      if (state.phase === 'BOWLING') {
        ballMesh.visible = false;
        ballSeam.visible = false;
        ballShadow.visible = false;
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
    state.bowlingTotalBalls++;
    state.bowlingBallsInOver++;

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

    // Pick probability table
    let probs;
    switch (accuracy) {
      case 'perfect': probs = [...AI_PROB_PERFECT]; break;
      case 'good':    probs = [...AI_PROB_GOOD]; break;
      case 'bad':     probs = [...AI_PROB_BAD]; break;
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

    bowlingResultOutcome = result;
    handleBowlingOutcome(result);
  }

  function handleBowlingOutcome(outcome) {
    const textX = W / 2;
    const textBaseY = H * 0.4;

    if (outcome.runs === -1) {
      // WICKET
      state.bowlingAIWickets++;
      state.bowlingCurrentOverResults.push({ runs: 0, isWicket: true, isFour: false, isSix: false });

      checkAchievement('cb-first-wicket');
      if (state.bowlingAIWickets >= 5) checkAchievement('cb-five-wickets');
      if (state.selectedDelivery === 'yorker') {
        state.yorkerWickets++;
        if (state.yorkerWickets >= 3) checkAchievement('cb-yorker-master');
      }

      if (outcome.type === 'bowled') {
        playStumpsHit();
        triggerStumpScatter();
      } else {
        playBatCrack(0);
      }

      // Camera shake for bowling wicket
      cameraShake.active = true;
      cameraShake.start = Date.now();
      cameraShake.duration = 300;
      cameraShake.intensity = 0.1;

      playCrowdReaction('roar');
      spawnFloatingText('WICKET!', textX, textBaseY, '#4CAF50', 32);
      spawnParticles(textX, textBaseY, 30, ['#4CAF50', '#FFD700', '#FFFFFF'], 120, 1.0);

      // AI bat defensive push animation
      aiBatAnimating = true;
      aiBatAnimStart = Date.now();
      aiBatAnimType = 'defense';

      haptic([100]);
      announceScore(`Wicket! ${outcome.type}. AI: ${state.bowlingAIScore}/${state.bowlingAIWickets}`);
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
        cameraShake.active = true;
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
        cameraShake.active = true;
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

      announceScore(`${outcome.runs} run${outcome.runs !== 1 ? 's' : ''}. AI: ${state.bowlingAIScore}/${state.bowlingAIWickets}`);
    }

    showBallCommentary(outcome, true);
    updateBowlingHUD();

    // Immediate check: AI chased down target — end match quickly
    const aiChasedDown = state.bowlingAIScore >= state.battingScore + 1;
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

      // Check if AI chased down target
      if (state.bowlingAIScore >= state.battingScore + 1) {
        endMatch();
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
        if (state.bowlingCurrentOverRuns > state.bowlingBestOverRuns) {
          state.bowlingBestOverRuns = state.bowlingCurrentOverRuns;
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
      if (r.isWicket) return '<div class="cb-ball-dot wicket">W</div>';
      if (r.isSix) return '<div class="cb-ball-dot six">6</div>';
      if (r.isFour) return '<div class="cb-ball-dot four">4</div>';
      if (r.runs === 0) return '<div class="cb-ball-dot dot">&middot;</div>';
      return `<div class="cb-ball-dot runs">${r.runs}</div>`;
    }).join('');

    const rrAI = state.bowlingTotalBalls > 0 ? (state.bowlingAIScore / (state.bowlingTotalBalls / 6)).toFixed(2) : '0.00';
    const ballsLeft = (5 - state.bowlingOversCompleted) * 6;
    const runsNeeded = state.battingScore + 1 - state.bowlingAIScore;
    const reqRR = ballsLeft > 0 ? (runsNeeded / (ballsLeft / 6)).toFixed(2) : '-';

    overModal.innerHTML = `
      <h2>End of Over ${state.bowlingOversCompleted} (Bowling)</h2>
      <div class="cb-over-summary">${ballsHtml}</div>
      <div class="cb-stat-row"><span>Runs conceded this over</span><span>${state.bowlingCurrentOverRuns}</span></div>
      <div class="cb-stat-row"><span>AI Score</span><span>${state.bowlingAIScore}/${state.bowlingAIWickets}</span></div>
      <div class="cb-stat-row"><span>AI needs</span><span>${runsNeeded} from ${ballsLeft} balls</span></div>
      <div class="cb-rate-compare">
        <div class="cb-rate-item">
          <span class="label">AI Run Rate</span>
          <span class="value">${rrAI}</span>
        </div>
        <div class="cb-rate-item">
          <span class="label">Required RR</span>
          <span class="value">${reqRR}</span>
        </div>
      </div>
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
    state.phase = 'MATCH_RESULT';
    gameWrap.classList.remove('cb-playing');
    gameWrap.classList.remove('cb-bowling');

    // Hide bowling UI
    if (bowlingPanel) bowlingPanel.style.display = 'none';
    if (bowlingMeter) bowlingMeter.style.display = 'none';
    if (bowlingHudTop) bowlingHudTop.style.display = 'none';
    if (bowlingHudBottom) bowlingHudBottom.style.display = 'none';

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

    const finalScore = Math.max(0,
      state.battingScore + boundaryBonus - wicketPenalty +
      bowlingBonus + wicketsBonus + economyBonus
    );
    state.lastFinalScore = finalScore;

    // Achievements
    if (playerWon) {
      checkAchievement('cb-full-match-win');
      if (margin >= 30) checkAchievement('cb-clean-sweep');
    }
    if (state.battingWickets === 0) checkAchievement('cb-no-wicket');
    if (state.battingSixes >= 6) checkAchievement('cb-six-sixes');
    if (state.battingScore >= 50) checkAchievement('cb-fifty');
    if (state.battingScore >= 100) checkAchievement('cb-century');
    if (finalScore >= 200) checkAchievement('cb-high-score-200');

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
      subText = `Defended ${state.battingScore} by ${margin} runs!`;
      playUISound('levelComplete');
      spawnConfetti();
    } else {
      heading = 'AI WINS';
      subText = `AI chased ${state.battingScore + 1} with ${aiWicketsLeft} wicket${aiWicketsLeft !== 1 ? 's' : ''} left`;
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
        ${economyBonus ? '<div class="cb-stat-row"><span>Economy Bonus</span><span>+20</span></div>' : ''}
        <div class="cb-stat-row cb-score-total"><span>Total Score</span><span>${finalScore}</span></div>
      </div>
      <div class="cb-btn-row">
        <button class="cb-btn" onclick="window._cbPlayAgain()">PLAY AGAIN</button>
        <button class="cb-share-btn" onclick="window._cbShare()">&#128279; Share</button>
      </div>
    `;

    matchResultOverlay.classList.add('cb-visible');
  }

  async function submitMatchScore(finalScore, playerWon, tied) {
    try {
      if (window.apiClient && currentUser) {
        await window.apiClient.submitScore('cricket-blitz', {
          score: finalScore,
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
    // In match mode, batting end always goes to innings break
    transitionToInningsBreak();
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
    const bht = $('bowlingHudTop');
    const bhb = $('bowlingHudBottom');
    if (!bht || !bhb) return;

    const overs = `${state.bowlingOversCompleted}.${state.bowlingBallsInOver}/5`;
    const aiTarget = state.battingScore + 1;
    const runsNeeded = aiTarget - state.bowlingAIScore;

    const se = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
    se('bowlingOvers', overs);
    se('bowlingAIScore', `${state.bowlingAIScore}/${state.bowlingAIWickets}`);
    se('bowlingTarget', `Target: ${aiTarget}`);
    se('bowlingNeeded', `Need: ${Math.max(0, runsNeeded)}`);

    const deliveryLabel = DELIVERY_LABELS[state.selectedDelivery] || 'Straight';
    const lineLabel = state.selectedLine.charAt(0).toUpperCase() + state.selectedLine.slice(1);

    se('bowlingDeliveryType', deliveryLabel);
    se('bowlingLine', lineLabel);

    // Update delivery panel selection
    const panel = $('bowlingPanel');
    if (panel) {
      panel.querySelectorAll('.cb-delivery-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.delivery === state.selectedDelivery);
      });
    }

    // Update line indicators
    const lineIndicators = $('bowlingLineIndicators');
    if (lineIndicators) {
      lineIndicators.querySelectorAll('.cb-line-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.line === state.selectedLine);
      });
    }
  }

  function updateHUD() {
    hudOvers.textContent = `${state.oversCompleted}.${state.ballsInOver}/5`;
    hudTarget.textContent = '5 overs';
    hudRuns.textContent = state.runs;
    hudFours.textContent = state.fours;
    hudSixes.textContent = state.sixes;

    const rr = state.totalBallsFaced > 0 ? (state.runs / (state.totalBallsFaced / 6)).toFixed(2) : '0.00';
    hudRR.textContent = rr;

    const icons = hudWickets.querySelectorAll('.cb-wicket-icon');
    icons.forEach((icon, i) => {
      icon.classList.toggle('active', i >= state.wickets);
    });

    const arrows = { straight: '\u2191', pull: '\u2190', cut: '\u2192', defense: '\u2193' };
    const labels = { straight: 'Drive', pull: 'Pull', cut: 'Cut', defense: 'Block' };
    shotArrow.textContent = arrows[state.shotDirection] || '\u2191';
    shotLabel.textContent = labels[state.shotDirection] || 'Drive';

    const pitchShotIcon = $('pitchShotIcon');
    const pitchShotName = $('pitchShotName');
    if (pitchShotIcon) pitchShotIcon.textContent = arrows[state.shotDirection] || '\u2191';
    if (pitchShotName) pitchShotName.textContent = (labels[state.shotDirection] || 'Drive').toUpperCase();

    state.isPowerplay = state.oversCompleted < 2;
    const ppBadge = $('powerplayBadge');
    if (ppBadge) ppBadge.classList.toggle('show', state.isPowerplay && state.phase === 'BATTING');

    const tensionEdge = $('tensionEdge');
    state.tensionActive = false; // No target in match mode batting
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
    if (outcome.runs === -1) {
      text = pickRandom(pool.wicket || []);
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

    state.matchPhase = 'batting';
    state.level = 1;
    state.target = 999; // No target in match mode batting -- just score as much as possible
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

    // Reset team color tracking
    _lastTeamKey = null;

    const tensionEdge = $('tensionEdge');
    if (tensionEdge) tensionEdge.classList.remove('active');

    titleOverlay.classList.remove('cb-visible');
    state.phase = 'BATTING';
    gameWrap.classList.add('cb-playing');

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

    updateHUD();
    generateBowlerForOver();
    showBowlerIntro();
    setTimeout(() => startDelivery(), 1200);
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

    // Hide bowling UI
    if (bowlingPanel) bowlingPanel.style.display = 'none';
    if (bowlingMeter) bowlingMeter.style.display = 'none';
    if (bowlingHudTop) bowlingHudTop.style.display = 'none';
    if (bowlingHudBottom) bowlingHudBottom.style.display = 'none';

    // Show batting HUD elements (they'll be hidden by lack of cb-playing class anyway)
    hudTop.style.display = '';
    hudBottom.style.display = '';

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
  }

  function quitToMenu() {
    state.paused = false;
    const overlay = $('pauseOverlay');
    if (overlay) overlay.classList.remove('cb-visible');
    resetToTitle();
  }

  window._cbResume = resumeGame;
  window._cbQuitToMenu = quitToMenu;

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
        window._cbStartBowling();
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

  // Touch zones (legacy, still wired but hidden during gesture mode)
  function handleTouchZone(e) {
    e.preventDefault();
    if (state.phase !== 'BATTING') return;
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

  // ============================================
  // GESTURE CONTROLS (swipe + tap for mobile)
  // ============================================

  let touchStartX = 0, touchStartY = 0, touchStartTime = 0;
  let bowlingTouchStartTime = 0, bowlingTouchHolding = false;

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
    const labels = { bouncer: '\u2191 BOUNCER', yorker: '\u2193 YORKER', inswing: '\u2190 INSWING', outswing: '\u2192 OUTSWING', straight: '\u25CF STRAIGHT' };
    el.querySelector('.cb-gesture-arrow').textContent = '';
    el.querySelector('.cb-gesture-name').textContent = labels[delivery] || delivery;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 600);
  }

  if (gameContainer) {
    gameContainer.addEventListener('touchstart', (e) => {
      initAudio();
      resumeAudio();

      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();

      // Bowling hold detection
      if (state.phase === 'BOWLING' && state.bowlingDeliveryPhase === 'selecting') {
        bowlingTouchStartTime = Date.now();
        bowlingTouchHolding = true;
        // Start meter after brief hold (150ms)
        setTimeout(() => {
          if (bowlingTouchHolding && state.bowlingDeliveryPhase === 'selecting') {
            startBowlingMeter();
          }
        }, 150);
      }
    }, { passive: true });

    gameContainer.addEventListener('touchend', (e) => {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const deltaX = endX - touchStartX;
      const deltaY = endY - touchStartY;
      const elapsed = Date.now() - touchStartTime;
      const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Bowling phase: release stops meter, swipe sets delivery
      if (state.phase === 'BOWLING') {
        bowlingTouchHolding = false;

        if (state.bowlingDeliveryPhase === 'meter') {
          // Release = stop meter
          stopBowlingMeter();
          return;
        }

        if (state.bowlingDeliveryPhase === 'selecting' && dist > 50 && elapsed < 300) {
          // Swipe sets delivery type
          const absX = Math.abs(deltaX);
          const absY = Math.abs(deltaY);
          let delivery = 'straight';
          if (absY > absX) {
            delivery = deltaY < 0 ? 'bouncer' : 'yorker';
          } else {
            delivery = deltaX < 0 ? 'inswing' : 'outswing';
          }
          selectDeliveryType(delivery);
          showBowlingGestureIndicator(delivery);
          return;
        }
        return;
      }

      // Batting phase
      if (state.phase !== 'BATTING') return;

      if (dist > 50 && elapsed < 300) {
        // Swipe detected: set direction
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        let direction;
        if (absY > absX) {
          direction = deltaY < 0 ? 'straight' : 'defense';
        } else {
          direction = deltaX < 0 ? 'pull' : 'cut';
        }
        state.gestureDirection = direction;
        state.gestureConfirmed = true;
        setShotDirection(direction);
        showGestureIndicator(direction);
        // Update pitch shot overlay
        const overlayIcon = document.getElementById('pitchShotIcon');
        const overlayName = document.getElementById('pitchShotName');
        const arrows = { straight: '\u2191', pull: '\u2190', cut: '\u2192', defense: '\u2193' };
        const names = { straight: 'DRIVE', pull: 'PULL', cut: 'CUT', defense: 'BLOCK' };
        if (overlayIcon) overlayIcon.textContent = arrows[direction] || '\u2191';
        if (overlayName) overlayName.textContent = names[direction] || 'DRIVE';
      } else {
        // Tap: swing bat with current direction
        handleSwing(state.gestureDirection || state.shotDirection);
      }
    }, { passive: true });
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
