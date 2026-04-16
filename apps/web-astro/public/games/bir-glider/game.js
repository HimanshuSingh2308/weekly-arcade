// ================================================
// BIR GLIDER — Main Game Script
// GameLayout provides: window.apiClient, window.authManager,
//   shared JS (api-client.js, auth.js, game-cloud.js, game-header.js)
// ================================================

// ---- State ----
let currentUser = null;
let gameState = 'menu'; // menu | waiting | playing | paused | gameover
let zenMode = false;
let muted = false;
let animFrameId = null;
let menuBgAnimId = null;

// Game vars
let canvas, ctx;
let W, H;
let distance = 0;
let score = 0;
let altitude = 200; // px from bottom ground surface (visual)
let altitudeM = 0;  // meters (computed from altitude)
let maxAltitudeM = 0;
let velocity = 0;   // vertical velocity (positive = up)
let isHolding = false;
let gliderX, gliderY;
let scrollSpeed = 0.25;
let gameTime = 0;
let runStartTime = 0;
let prayerFlagsCollected = 0;
let flagCombo = 0;
let flagComboTimer = 0;
let maxCombo = 0;
let eagleNearMisses = 0;
let thermalsCount = 0;
let inThermal = false;
let thermalTimer = 0;
let biomeIndex = 0;
let visitedBiomes = new Set();
let altitudeMilestonesHit = new Set();

// Score
let totalScore = 0;
let totalFlagScore = 0;
let totalNearMissBonus = 0;
let altitudeMilestoneBonus = 0;

// Personal best
let personalBest = 0;
let isNewBest = false;

// Goals
let goals = [];
let goalProgress = {};

// Terrain
let terrainPoints = [];
const TERRAIN_SEGMENT_W = 6;
let terrainOffset = 0;
let terrainSeed = Math.random() * 10000;
let backMountains = [];
let farMountains = [];
let midMountains = []; // third ridge layer between far and mid
let midTrees = [];
let clouds = [];
let midBuildings = [];
let riverPoints = [];
let cropPatches = [];

// Objects
let prayerFlags = [];
let eagles = [];
let thermals = [];
let particles = [];

// Zen
let zenRecovering = false;
let zenTimer = 0;
let zenDroneStarted = false;

// Biomes
const BIOMES = [
  { name: 'Bir Valley', sub: 'Dawn over the tea gardens', minDist: 0,    color1: '#f4a261', color2: '#a8dadc' },
  { name: 'Pine Forest', sub: 'Into the cedar groves',    minDist: 800,  color1: '#023e8a', color2: '#48cae4' },
  { name: 'Snow Peaks',  sub: 'Through the high passes',   minDist: 2500, color1: '#caf0f8', color2: '#90e0ef' },
  { name: 'Above Clouds', sub: 'Only sky, only silence',  minDist: 3500, color1: '#10002b', color2: '#3c096c' },
];

// ---- Audio ----
let audioCtx = null;
let windGain = null;
let windFilter = null;
let zenDroneGain = null;
let zenDroneNodes = [];
const PENTATONIC = [261.63, 293.66, 329.63, 392.00, 440.00]; // C4 D4 E4 G4 A4

function initAudio() {
  if (audioCtx || muted) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Wind layer
    const bufferSize = audioCtx.sampleRate * 2;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    windFilter = audioCtx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 800;
    windFilter.Q.value = 0.5;
    windGain = audioCtx.createGain();
    windGain.gain.value = 0;
    noiseSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(audioCtx.destination);
    noiseSource.start();
  } catch(e) {}
}

function startWind() {
  if (!audioCtx || muted) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  if (windGain) {
    windGain.gain.cancelScheduledValues(audioCtx.currentTime);
    windGain.gain.setTargetAtTime(zenMode ? 0.07 : 0.04, audioCtx.currentTime, 0.5);
  }
}

function stopWind() {
  if (!windGain) return;
  windGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.8);
}

function updateWindPitch() {
  if (!windFilter || muted) return;
  const freq = 200 + (altitudeM / 4000) * 1800;
  windFilter.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.2);
}

function playNote(freq, duration = 0.3, volume = 0.15) {
  if (!audioCtx || muted) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch(e) {}
}

function playFlagSound(combo) {
  if (muted) return;
  const notes = PENTATONIC;
  const idx = (prayerFlagsCollected) % notes.length;
  playNote(notes[idx], 0.3, 0.15);
  if (combo >= 3) {
    setTimeout(() => playNote(notes[(idx + 2) % 5], 0.25, 0.1), 80);
    if (combo >= 5) setTimeout(() => playNote(notes[(idx + 4) % 5], 0.2, 0.08), 160);
  }
}

function playThermalSound() {
  if (muted) return;
  playNote(523.25, 0.4, 0.1); // C5 ascending chime
  setTimeout(() => playNote(659.25, 0.3, 0.07), 150);
}

function playCrashSound() {
  if (!audioCtx || muted) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.6);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.7);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.7);
  } catch(e) {}
}

function stopZenDrone() {
  zenDroneNodes.forEach(({ osc, gain }) => {
    try { osc.stop(); osc.disconnect(); gain.disconnect(); } catch(e) {}
  });
  zenDroneNodes = [];
  zenDroneStarted = false;
}

function startZenDrone() {
  if (!audioCtx || muted) return;
  stopZenDrone();
  zenDroneStarted = true;
  try {
    const droneFreqs = [65.41, 130.81, 196.00]; // C2 C3 G3
    droneFreqs.forEach((f, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(0.04 - i * 0.01, audioCtx.currentTime, 2);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start();
      zenDroneNodes.push({ osc, gain });
      zenDroneGain = gain;
    });
  } catch(e) {}
}

// ---- Perlin noise (simple 1D) ----
function fade(t) { return t*t*t*(t*(t*6-15)+10); }
function lerp(a,b,t) { return a+t*(b-a); }
const perm = new Uint8Array(512);
(function(){
  for(let i=0;i<256;i++) perm[i]=i;
  for(let i=255;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [perm[i],perm[j]]=[perm[j],perm[i]]; }
  for(let i=0;i<256;i++) perm[i+256]=perm[i];
})();
function grad(h,x){ const g=h&1?-1:1; return g*x; }
function noise1d(x){
  const X=Math.floor(x)&255;
  x-=Math.floor(x);
  const u=fade(x);
  return lerp(grad(perm[X],x),grad(perm[X+1],x-1),u)*2;
}
function fbm(x, octaves=4, persistence=0.5){
  let val=0, amp=1, freq=1, max=0;
  for(let i=0;i<octaves;i++){
    val+=noise1d(x*freq)*amp;
    max+=amp; amp*=persistence; freq*=2;
  }
  return val/max;
}

// ---- Terrain generation ----
function getTerrainY(xWorld, biome) {
  const b = Math.min(biome, 3);
  const amplitude = [80, 120, 160, 100][b];
  const freqMult = [0.003, 0.004, 0.005, 0.003][b];
  const base = H * 0.75;
  const n = fbm((xWorld + terrainSeed) * freqMult);
  return base + n * amplitude;
}

/**
 * Returns terrain Y at glider X position by interpolating terrain points array.
 */
function getTerrainYAtX(x) {
  // terrain points are spaced TERRAIN_SEGMENT_W apart starting at terrainOffset
  const idx = (x - terrainOffset) / TERRAIN_SEGMENT_W;
  const i = Math.floor(idx);
  if (i < 0 || i >= terrainPoints.length - 1) {
    // Fallback: compute from noise
    return getTerrainY(x + (distance - terrainOffset), biomeIndex);
  }
  const t = idx - i;
  return terrainPoints[i] * (1 - t) + terrainPoints[i + 1] * t;
}

function generateTerrain() {
  terrainPoints = [];
  const numPoints = Math.ceil(W / TERRAIN_SEGMENT_W) + 10;
  for (let i = 0; i < numPoints; i++) {
    const xWorld = terrainOffset + i * TERRAIN_SEGMENT_W;
    terrainPoints.push(getTerrainY(xWorld, biomeIndex));
  }
}

function extendTerrain() {
  // Remove points that have scrolled off left
  while (terrainPoints.length > 0 && terrainOffset < -TERRAIN_SEGMENT_W) {
    terrainPoints.shift();
    terrainOffset += TERRAIN_SEGMENT_W;
  }
  // Add new points on the right
  const needed = Math.ceil(W / TERRAIN_SEGMENT_W) + 10;
  while (terrainPoints.length < needed) {
    const xWorld = terrainOffset + terrainPoints.length * TERRAIN_SEGMENT_W;
    terrainPoints.push(getTerrainY(xWorld, biomeIndex));
  }
}

// ---- Background elements ----
function generateBackMountains() {
  backMountains = [];
  farMountains = [];
  midMountains = [];
  clouds = [];

  // Generate smooth bezier control points for each mountain layer.
  // Each layer stores an array of { x, y } control points that will be
  // drawn as smooth quadratic bezier curves — no jagged lineTo noise.
  const totalW = W * 3;

  // Helper: generate smooth ridge control points using low-freq fbm
  function generateRidgePoints(count, freq, seed, baseY, amplitude) {
    const pts = [];
    const spacing = totalW / count;
    for (let i = 0; i <= count; i++) {
      const x = i * spacing;
      const n = fbm(x * freq + seed, 3, 0.45);
      pts.push({ x, y: baseY + n * amplitude });
    }
    return pts;
  }

  // Layer 0 (farthest): barely visible distant peaks — very low frequency, tall
  farMountains = generateRidgePoints(12, 0.0004, 50, H * 0.18, H * 0.18);
  // Layer 1 (far-mid): blue-grey transitional range
  midMountains = generateRidgePoints(16, 0.0006, 120, H * 0.30, H * 0.14);
  // Layer 2 (mid): main visible forested hills
  backMountains = generateRidgePoints(20, 0.0008, 200, H * 0.40, H * 0.12);

  // Pre-generate soft clouds (large blurred ellipses)
  const cloudCount = 3 + Math.floor(Math.random() * 2);
  for (let i = 0; i < cloudCount; i++) {
    clouds.push({
      x: Math.random() * W * 2.5,
      y: H * 0.06 + Math.random() * H * 0.16,
      w: 120 + Math.random() * 180,
      h: 14 + Math.random() * 18,
      speed: 0.04 + Math.random() * 0.08,
      alpha: 0.06 + Math.random() * 0.10,
    });
  }
}

function generateMidTrees() {
  midTrees = [];
  midBuildings = [];
  riverPoints = [];
  cropPatches = [];

  // Generate treeline silhouette control points instead of individual trees.
  // This creates one continuous wavy canopy curve — Alto's Adventure style.
  const totalW = W * 3;
  const count = 30;
  const spacing = totalW / count;
  for (let i = 0; i <= count; i++) {
    const x = i * spacing;
    const n = fbm(x * 0.002 + 500, 3, 0.5);
    // Store as { x, y } — baseline will be set at draw time
    midTrees.push({
      x,
      y: n, // normalized noise value, scaled at draw time
      // A few points get extra height for tree-tip silhouettes poking above canopy
      tip: (i % 4 === 0) ? (0.3 + Math.random() * 0.5) : 0,
    });
  }

  // Keep buildings for silhouette interest (drawn as simple dark shapes)
  for (let i = 0; i < 3; i++) {
    midBuildings.push({
      x: W * 0.3 + i * W * 0.8 + Math.random() * W * 0.3,
      w: 12 + Math.random() * 10,
      h: 10 + Math.random() * 8,
    });
  }

  // River control points
  for (let i = 0; i <= 20; i++) {
    riverPoints.push({
      x: i * (W / 20) * 3,
      yOff: (Math.random() - 0.5) * 40,
    });
  }

  // Crop field patches
  for (let i = 0; i < 8; i++) {
    cropPatches.push({
      x: Math.random() * W * 2.5,
      w: 30 + Math.random() * 60,
      h: 8 + Math.random() * 12,
      isMustard: Math.random() > 0.5,
    });
  }
}

// ---- Object spawning ----
function spawnObjects() {
  // Prayer flags — max 4 on screen at once, spawn every ~3-5 seconds
  const activeFlags = prayerFlags.filter(f => !f.collected).length;
  if (activeFlags < 4 && Math.random() < 0.003) {
    const flagY = H * 0.25 + Math.random() * H * 0.4;
    prayerFlags.push({
      x: W + 50 + Math.random() * 100,
      y: flagY,
      collected: false,
      phase: Math.random() * Math.PI * 2,
      colors: ['#1565C0','#F5F5F0','#C62828','#2E7D32','#F9A825'],
    });
  }

  // Eagles — max 3 on screen, appear after 200m
  if (distance > 200 && eagles.length < 3 && Math.random() < 0.002 + biomeIndex * 0.001) {
    eagles.push({
      x: W + 60,
      y: H * 0.15 + Math.random() * H * 0.45,
      vy: (Math.random() - 0.5) * 0.3,
      speed: 1.5 + Math.random() * biomeIndex * 0.5,
      nearMissed: false,
      radius: 18,
      wingPhase: 0,
    });
  }

  // Thermals — max 2 on screen
  if (thermals.length < 2 && Math.random() < 0.002) {
    const xWorld = terrainOffset + W + 80;
    const groundY = getTerrainY(xWorld, biomeIndex);
    thermals.push({
      x: W + 80 + Math.random() * 80,
      y: groundY - 200,
      height: 150 + Math.random() * 100,
      width: 40 + Math.random() * 30,
      phase: Math.random() * Math.PI * 2,
      active: true,
    });
  }
}

// ---- Particles ----
function spawnFlagParticles(x, y, colors) {
  for (let i = 0; i < 12; i++) {
    const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.5;
    particles.push({
      x, y,
      vx: Math.cos(angle) * (2 + Math.random() * 3),
      vy: Math.sin(angle) * (2 + Math.random() * 3) - 1,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 1, decay: 0.03 + Math.random() * 0.02,
      r: 3 + Math.random() * 3,
    });
  }
}

function spawnThermalParticles(x, y) {
  for (let i = 0; i < 6; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 30,
      y: y + Math.random() * 20,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -(1 + Math.random() * 2),
      color: `rgba(255,${150 + Math.floor(Math.random()*80)},50,`,
      life: 1, decay: 0.025,
      r: 4 + Math.random() * 4,
      alpha: true,
    });
  }
}

// ---- Sky gradient by biome + time ----
// Authentic Bir Billing color palette (derived from real landscape photography)
const BIR_PALETTE = {
  // Sky
  dawn:     { top: '#3A7FCC', mid: '#87CEEB', low: '#F5C87A', horizon: '#E8A845' },
  midday:   { top: '#2B72BF', mid: '#4A90D9', low: '#6AAFE0', horizon: '#A8C4D8' },
  sunset:   { top: '#7A4A9E', mid: '#D4608A', low: '#F5813A', horizon: '#E85C20' },
  night:    { top: '#0D1A42', mid: '#1A2A5E', low: '#2A3A6E', horizon: '#3A4A7E' },
  // Pine Forest sky
  forest:   { top: '#1A3A6E', mid: '#2E5A8E', low: '#4A8ABE', horizon: '#7AAECC' },
  // Snow Peaks sky
  alpine:   { top: '#2B72BF', mid: '#6AAAE0', low: '#B8D8F0', horizon: '#D8E8F4' },
  // Above Clouds
  cosmos:   { top: '#0A0A20', mid: '#10002b', low: '#240046', horizon: '#3c096c' },

  // Terrain per biome
  terrain: [
    // Bir Valley: tea gardens + terraced farms
    { top: '#4CAF50', bottom: '#3A8C3F', accent: '#8B6914', detail: '#D4AC0D' },
    // Pine Forest: deodar cedar
    { top: '#2D5A27', bottom: '#1A3A17', accent: '#335C2B', detail: '#4A7A3A' },
    // Snow Peaks: rock + snow
    { top: '#B8C8D8', bottom: '#E8EEF5', accent: '#4A4E5A', detail: '#F5F5F0' },
    // Above Clouds: ethereal
    { top: '#C8B8D8', bottom: '#9880B8', accent: '#6A5090', detail: '#E0D0F0' },
  ],

  // Mountains (Dhauladhar range)
  mountains: {
    far:     { fill: '#4A4E5A', snow: '#E8EEF5', shadow: '#3D3F47' },
    mid:     { fill: '#5A6070', snow: '#F0F4F8', shadow: '#4A5060' },
    near:    { fill: '#3A3E48', snow: '#F5F5F0' },
  },

  // Prayer flags (Tibetan lung ta — fixed religious order)
  flags: ['#1565C0', '#F5F5F0', '#C62828', '#2E7D32', '#F9A825'],
  flagsWeathered: ['#7090B0', '#D8D0C0', '#B06050', '#507050', '#C8A050'],

  // Atmospheric haze
  haze: 'rgba(168,196,216,',
};

function getSkyGradient(ctx, biome, distLocal) {
  const phase = (distLocal % 600) / 600; // slower day cycle
  const grad = ctx.createLinearGradient(0, 0, 0, H);

  let sky;
  if (biome === 0) {
    if (phase < 0.3) sky = BIR_PALETTE.dawn;
    else if (phase < 0.7) sky = BIR_PALETTE.midday;
    else sky = BIR_PALETTE.sunset;
  } else if (biome === 1) {
    sky = BIR_PALETTE.forest;
  } else if (biome === 2) {
    sky = BIR_PALETTE.alpine;
  } else {
    sky = BIR_PALETTE.cosmos;
  }

  grad.addColorStop(0, sky.top);
  grad.addColorStop(0.35, sky.mid);
  grad.addColorStop(0.7, sky.low);
  grad.addColorStop(1, sky.horizon);
  return grad;
}

function getTerrainColor(biome) {
  const t = BIR_PALETTE.terrain[Math.min(biome, 3)];
  return [t.top, t.bottom];
}


// ---- Drawing (Alto's Adventure-style smooth silhouette layers) ----

function drawSky() {
  const phase = ((distance % 600) / 600);
  const bi = Math.min(biomeIndex, 3);
  const isSunset = bi === 0 && phase > 0.7;
  const isDawn = bi === 0 && phase < 0.3;

  // --- Rich 10-stop sky gradient with smooth atmospheric transitions ---
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  if (bi === 0) {
    if (isDawn) {
      grad.addColorStop(0.00, '#1E3A6E');
      grad.addColorStop(0.08, '#2A5A8E');
      grad.addColorStop(0.18, '#4A80B8');
      grad.addColorStop(0.30, '#6AA0D0');
      grad.addColorStop(0.42, '#8AC0E0');
      grad.addColorStop(0.55, '#C0D8E8');
      grad.addColorStop(0.68, '#E8D0A8');
      grad.addColorStop(0.78, '#F0C080');
      grad.addColorStop(0.90, '#F5B060');
      grad.addColorStop(1.00, '#E89838');
    } else if (isSunset) {
      grad.addColorStop(0.00, '#1A1040');
      grad.addColorStop(0.08, '#2A1858');
      grad.addColorStop(0.18, '#5A2878');
      grad.addColorStop(0.28, '#8A3870');
      grad.addColorStop(0.40, '#C04868');
      grad.addColorStop(0.52, '#D86058');
      grad.addColorStop(0.64, '#E88048');
      grad.addColorStop(0.76, '#F0A040');
      grad.addColorStop(0.88, '#F5B838');
      grad.addColorStop(1.00, '#E8A030');
    } else {
      grad.addColorStop(0.00, '#1A4A8A');
      grad.addColorStop(0.08, '#2260A8');
      grad.addColorStop(0.18, '#2E72BE');
      grad.addColorStop(0.30, '#3A88D0');
      grad.addColorStop(0.42, '#4A98DA');
      grad.addColorStop(0.55, '#60A8E0');
      grad.addColorStop(0.68, '#80BBE5');
      grad.addColorStop(0.80, '#A0CCE8');
      grad.addColorStop(0.90, '#BCD8E8');
      grad.addColorStop(1.00, '#D0E0EC');
    }
  } else if (bi === 1) {
    grad.addColorStop(0.00, '#0E2248');
    grad.addColorStop(0.10, '#142E5A');
    grad.addColorStop(0.22, '#1A3A6E');
    grad.addColorStop(0.36, '#224880');
    grad.addColorStop(0.50, '#2A5A92');
    grad.addColorStop(0.64, '#3570A6');
    grad.addColorStop(0.76, '#4088B8');
    grad.addColorStop(0.86, '#5098C4');
    grad.addColorStop(0.94, '#68AAD0');
    grad.addColorStop(1.00, '#80BACC');
  } else if (bi === 2) {
    grad.addColorStop(0.00, '#1858A0');
    grad.addColorStop(0.10, '#2868B0');
    grad.addColorStop(0.22, '#3A7CC0');
    grad.addColorStop(0.36, '#5090D0');
    grad.addColorStop(0.50, '#68A4DA');
    grad.addColorStop(0.64, '#80B8E2');
    grad.addColorStop(0.76, '#98CCE8');
    grad.addColorStop(0.86, '#B0DAEE');
    grad.addColorStop(0.94, '#C8E4F2');
    grad.addColorStop(1.00, '#DCEEF6');
  } else {
    grad.addColorStop(0.00, '#020208');
    grad.addColorStop(0.10, '#060612');
    grad.addColorStop(0.22, '#0A0A1E');
    grad.addColorStop(0.36, '#10082E');
    grad.addColorStop(0.50, '#180440');
    grad.addColorStop(0.64, '#200050');
    grad.addColorStop(0.76, '#2A0060');
    grad.addColorStop(0.86, '#340870');
    grad.addColorStop(0.94, '#3C1080');
    grad.addColorStop(1.00, '#481890');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // --- Sun glow: 3 radial gradient layers for soft bloom ---
  if (bi < 3) {
    const sunX = W * 0.62 + phase * W * 0.18;
    const sunY = H * 0.08 + Math.sin(phase * Math.PI) * H * 0.06;

    // Layer 1: wide atmospheric bloom
    const bloom1R = isSunset ? 380 : isDawn ? 300 : 260;
    const bloom1A = isSunset ? 0.14 : isDawn ? 0.10 : 0.06;
    const bloom1 = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, bloom1R);
    bloom1.addColorStop(0.0, `rgba(255,250,230,${bloom1A})`);
    bloom1.addColorStop(0.15, `rgba(255,245,210,${bloom1A * 0.7})`);
    bloom1.addColorStop(0.35, `rgba(255,235,180,${bloom1A * 0.35})`);
    bloom1.addColorStop(0.6, `rgba(255,220,150,${bloom1A * 0.12})`);
    bloom1.addColorStop(1.0, 'rgba(255,200,100,0)');
    ctx.fillStyle = bloom1;
    ctx.fillRect(0, 0, W, H);

    // Layer 2: mid halo
    const bloom2R = isSunset ? 160 : isDawn ? 120 : 100;
    const bloom2A = isSunset ? 0.30 : isDawn ? 0.22 : 0.14;
    const bloom2 = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, bloom2R);
    bloom2.addColorStop(0.0, `rgba(255,252,240,${bloom2A})`);
    bloom2.addColorStop(0.3, `rgba(255,248,220,${bloom2A * 0.5})`);
    bloom2.addColorStop(0.7, `rgba(255,240,190,${bloom2A * 0.15})`);
    bloom2.addColorStop(1.0, 'rgba(255,230,170,0)');
    ctx.fillStyle = bloom2;
    ctx.fillRect(0, 0, W, H);

    // Layer 3: bright core disc
    const coreR = isSunset ? 45 : isDawn ? 30 : 20;
    const coreA = isSunset ? 0.65 : isDawn ? 0.50 : 0.40;
    const core = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, coreR);
    core.addColorStop(0.0, `rgba(255,255,248,${coreA})`);
    core.addColorStop(0.25, `rgba(255,252,235,${coreA * 0.7})`);
    core.addColorStop(0.55, `rgba(255,248,215,${coreA * 0.3})`);
    core.addColorStop(1.0, 'rgba(255,245,200,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(sunX, sunY, coreR * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Soft clouds: large blurred multi-lobe ellipses ---
  if (bi < 3 && clouds.length > 0) {
    ctx.save();
    for (const c of clouds) {
      c.x += c.speed;
      if (c.x > W * 3) c.x = -c.w * 2;
      const cx = ((c.x - distance * 0.015) % (W * 2.5) + W * 2.5) % (W * 2.5) - W * 0.25;
      if (cx < -c.w * 2 || cx > W + c.w * 2) continue;

      const tint = isSunset ? [255,180,140] : isDawn ? [255,220,190] : [255,255,255];
      ctx.globalAlpha = c.alpha * 0.7;

      // Soft outer glow
      const cGrad = ctx.createRadialGradient(cx, c.y, 0, cx, c.y, c.w);
      cGrad.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},0.35)`);
      cGrad.addColorStop(0.4, `rgba(${tint[0]},${tint[1]},${tint[2]},0.18)`);
      cGrad.addColorStop(0.7, `rgba(${tint[0]},${tint[1]},${tint[2]},0.06)`);
      cGrad.addColorStop(1, `rgba(${tint[0]},${tint[1]},${tint[2]},0)`);
      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.ellipse(cx, c.y, c.w * 1.3, c.h * 2.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Main body
      ctx.globalAlpha = c.alpha;
      ctx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},0.40)`;
      ctx.beginPath();
      ctx.ellipse(cx, c.y, c.w, c.h, 0, 0, Math.PI * 2);
      ctx.fill();

      // Secondary lobe
      ctx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},0.30)`;
      ctx.beginPath();
      ctx.ellipse(cx - c.w * 0.35, c.y - c.h * 0.3, c.w * 0.6, c.h * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tertiary lobe
      ctx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},0.25)`;
      ctx.beginPath();
      ctx.ellipse(cx + c.w * 0.4, c.y - c.h * 0.15, c.w * 0.5, c.h * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // --- Warm horizon haze band ---
  if (bi < 3) {
    ctx.save();
    const hazeY = H * 0.55;
    const hazeH = H * 0.35;
    const haze = ctx.createLinearGradient(0, hazeY, 0, hazeY + hazeH);
    if (isSunset) {
      haze.addColorStop(0.0, 'rgba(255,140,60,0)');
      haze.addColorStop(0.3, 'rgba(255,150,70,0.06)');
      haze.addColorStop(0.6, 'rgba(255,170,90,0.09)');
      haze.addColorStop(0.85, 'rgba(255,180,100,0.05)');
      haze.addColorStop(1.0, 'rgba(255,160,80,0)');
    } else if (isDawn) {
      haze.addColorStop(0.0, 'rgba(255,200,130,0)');
      haze.addColorStop(0.3, 'rgba(255,210,140,0.05)');
      haze.addColorStop(0.6, 'rgba(255,215,150,0.07)');
      haze.addColorStop(0.85, 'rgba(255,200,130,0.04)');
      haze.addColorStop(1.0, 'rgba(255,190,120,0)');
    } else {
      haze.addColorStop(0.0, 'rgba(200,220,240,0)');
      haze.addColorStop(0.3, 'rgba(200,220,240,0.04)');
      haze.addColorStop(0.6, 'rgba(200,220,240,0.08)');
      haze.addColorStop(0.85, 'rgba(200,220,240,0.10)');
      haze.addColorStop(1.0, 'rgba(200,220,240,0.06)');
    }
    ctx.fillStyle = haze;
    ctx.fillRect(0, hazeY, W, hazeH);
    ctx.restore();
  }

  // --- Stars (above clouds biome) ---
  if (bi === 3) {
    for (let i = 0; i < 180; i++) {
      const sx = ((i * 137.5 + distance * 0.008) % W);
      const sy = (i * 97.3) % (H * 0.55);
      const twinkle = 0.20 + 0.80 * Math.abs(Math.sin(distance * 0.002 + i * 2.3));
      const size = 0.3 + (i % 5) * 0.35;
      ctx.fillStyle = `rgba(255,255,255,${twinkle * 0.9})`;
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fill();
      if (i % 6 === 0) {
        const glowGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, size * 6);
        glowGrad.addColorStop(0, `rgba(200,220,255,${twinkle * 0.12})`);
        glowGrad.addColorStop(1, 'rgba(200,220,255,0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(sx, sy, size * 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawBackMountains() {
  const bi = Math.min(biomeIndex, 3);
  const phase = ((distance % 600) / 600);
  const isSunset = bi === 0 && phase > 0.7;
  const isDawn = bi === 0 && phase < 0.3;
  const totalW = W * 3;

  // Helper: draw a smooth bezier mountain silhouette from control points, filled with gradient
  function drawMountainLayer(points, scroll, baseY, gradTop, gradBot, alpha, peakTopY) {
    if (!points || points.length < 2) return;
    ctx.save();
    ctx.globalAlpha = alpha;

    // Create gradient fill — every surface is a gradient, never flat
    const grad = ctx.createLinearGradient(0, peakTopY, 0, baseY);
    grad.addColorStop(0.0, gradTop);
    grad.addColorStop(0.35, gradBot[0] || gradBot);
    grad.addColorStop(0.7, gradBot[1] || gradBot);
    grad.addColorStop(1.0, gradBot[2] || gradBot);
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(-20, baseY);

    // Draw smooth quadratic bezier curves through the control points with parallax scroll
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const sx0 = ((p0.x - scroll) % totalW + totalW) % totalW - totalW * 0.2;
      const sx1 = ((p1.x - scroll) % totalW + totalW) % totalW - totalW * 0.2;
      const cpx = (sx0 + sx1) / 2;
      const cpy = (p0.y + p1.y) / 2;
      if (i === 0) ctx.lineTo(sx0, p0.y);
      ctx.quadraticCurveTo(sx0 + (sx1 - sx0) * 0.5, p0.y * 0.5 + p1.y * 0.5 - Math.abs(sx1 - sx0) * 0.02, sx1, p1.y);
    }
    ctx.lineTo(W + 20, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // === LAYER 0 (farthest): barely visible, almost sky-colored ===
  // Atmospheric perspective: very hazy, desaturated, close to sky color
  const layer0Colors = [
    { top: 'rgba(140,160,190,1)', bot: ['rgba(160,175,200,1)', 'rgba(175,188,210,1)', 'rgba(190,200,218,1)'] },
    { top: 'rgba(100,125,150,1)', bot: ['rgba(120,140,165,1)', 'rgba(135,150,175,1)', 'rgba(150,165,185,1)'] },
    { top: 'rgba(170,185,210,1)', bot: ['rgba(185,198,220,1)', 'rgba(195,208,228,1)', 'rgba(210,218,235,1)'] },
    { top: 'rgba(30,22,55,1)',    bot: ['rgba(40,30,68,1)',    'rgba(48,38,78,1)',    'rgba(55,45,88,1)'] },
  ];
  const l0 = layer0Colors[bi];
  drawMountainLayer(farMountains, distance * 0.02, H * 0.52, l0.top, l0.bot, 0.35, H * 0.05);

  // Snow shimmer on farthest peaks (very subtle)
  if (bi < 3 && farMountains.length > 1) {
    ctx.save();
    ctx.globalAlpha = isSunset ? 0.18 : isDawn ? 0.15 : 0.22;
    const snowGrad = ctx.createLinearGradient(0, H * 0.05, 0, H * 0.30);
    snowGrad.addColorStop(0, isSunset ? 'rgba(255,210,180,0.6)' : isDawn ? 'rgba(255,225,195,0.5)' : 'rgba(245,248,255,0.6)');
    snowGrad.addColorStop(0.5, isSunset ? 'rgba(255,200,170,0.2)' : 'rgba(240,245,250,0.2)');
    snowGrad.addColorStop(1, 'rgba(240,245,250,0)');
    ctx.fillStyle = snowGrad;
    ctx.beginPath();
    ctx.moveTo(-20, H * 0.30);
    const snowLine = H * 0.28;
    for (let i = 0; i < farMountains.length - 1; i++) {
      const p0 = farMountains[i];
      const p1 = farMountains[i + 1];
      const sx0 = ((p0.x - distance * 0.02) % totalW + totalW) % totalW - totalW * 0.2;
      const sx1 = ((p1.x - distance * 0.02) % totalW + totalW) % totalW - totalW * 0.2;
      if (p0.y < snowLine || p1.y < snowLine) {
        const sy0 = Math.min(p0.y, snowLine);
        const sy1 = Math.min(p1.y, snowLine);
        ctx.quadraticCurveTo((sx0 + sx1) / 2, (sy0 + sy1) / 2, sx1, sy1);
      }
    }
    ctx.lineTo(W + 20, H * 0.30);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Atmospheric haze between layer 0 and 1
  if (bi <= 2) {
    ctx.save();
    const h1 = ctx.createLinearGradient(0, H * 0.28, 0, H * 0.50);
    const hazeC = isSunset ? [255,190,150] : isDawn ? [220,210,200] : [190,208,228];
    h1.addColorStop(0, `rgba(${hazeC[0]},${hazeC[1]},${hazeC[2]},0)`);
    h1.addColorStop(0.5, `rgba(${hazeC[0]},${hazeC[1]},${hazeC[2]},0.05)`);
    h1.addColorStop(1, `rgba(${hazeC[0]},${hazeC[1]},${hazeC[2]},0.10)`);
    ctx.fillStyle = h1;
    ctx.fillRect(0, H * 0.28, W, H * 0.22);
    ctx.restore();
  }

  // === LAYER 1 (far-mid): blue-grey, medium opacity ===
  const layer1Colors = [
    { top: 'rgba(80,105,120,1)', bot: ['rgba(95,120,135,1)', 'rgba(105,130,145,1)', 'rgba(118,142,158,1)'] },
    { top: 'rgba(55,78,90,1)',   bot: ['rgba(68,90,102,1)',  'rgba(78,98,110,1)',  'rgba(88,108,120,1)'] },
    { top: 'rgba(120,138,160,1)', bot: ['rgba(138,155,175,1)', 'rgba(150,168,188,1)', 'rgba(165,180,198,1)'] },
    { top: 'rgba(25,20,48,1)',   bot: ['rgba(35,28,60,1)',   'rgba(42,35,70,1)',   'rgba(50,42,80,1)'] },
  ];
  const l1 = layer1Colors[bi];
  drawMountainLayer(midMountains, distance * 0.05, H * 0.58, l1.top, l1.bot, 0.55, H * 0.18);

  // Atmospheric haze between layer 1 and 2
  if (bi <= 2) {
    ctx.save();
    const h2 = ctx.createLinearGradient(0, H * 0.42, 0, H * 0.60);
    const hazeC2 = isSunset ? [240,180,140] : isDawn ? [210,205,200] : [185,205,225];
    h2.addColorStop(0, `rgba(${hazeC2[0]},${hazeC2[1]},${hazeC2[2]},0)`);
    h2.addColorStop(0.4, `rgba(${hazeC2[0]},${hazeC2[1]},${hazeC2[2]},0.04)`);
    h2.addColorStop(1, `rgba(${hazeC2[0]},${hazeC2[1]},${hazeC2[2]},0.10)`);
    ctx.fillStyle = h2;
    ctx.fillRect(0, H * 0.42, W, H * 0.18);
    ctx.restore();
  }

  // === LAYER 2 (mid): main visible mountains — rich gradient, higher opacity ===
  const layer2Colors = [
    { top: 'rgba(38,78,48,1)', bot: ['rgba(48,95,58,1)', 'rgba(55,105,65,1)', 'rgba(65,115,72,1)'] },
    { top: 'rgba(22,52,28,1)', bot: ['rgba(30,62,35,1)', 'rgba(36,70,40,1)', 'rgba(42,78,45,1)'] },
    { top: 'rgba(85,100,118,1)', bot: ['rgba(100,115,132,1)', 'rgba(112,125,142,1)', 'rgba(125,138,155,1)'] },
    { top: 'rgba(30,24,52,1)', bot: ['rgba(38,30,62,1)', 'rgba(45,36,72,1)', 'rgba(52,42,82,1)'] },
  ];
  const l2 = layer2Colors[bi];
  drawMountainLayer(backMountains, distance * 0.08, H * 0.66, l2.top, l2.bot, 0.80, H * 0.30);

  // === LAYER 3 (near-mid): dark treeline silhouette with wavy canopy edge ===
  if (bi <= 1) {
    ctx.save();
    ctx.globalAlpha = 0.88;
    const treeGrad = ctx.createLinearGradient(0, H * 0.48, 0, H * 0.68);
    if (bi === 0) {
      treeGrad.addColorStop(0, 'rgba(20,52,25,1)');
      treeGrad.addColorStop(0.4, 'rgba(25,60,30,1)');
      treeGrad.addColorStop(0.7, 'rgba(30,68,35,1)');
      treeGrad.addColorStop(1, 'rgba(38,75,42,1)');
    } else {
      treeGrad.addColorStop(0, 'rgba(12,35,15,1)');
      treeGrad.addColorStop(0.4, 'rgba(16,42,20,1)');
      treeGrad.addColorStop(0.7, 'rgba(20,48,24,1)');
      treeGrad.addColorStop(1, 'rgba(25,55,28,1)');
    }
    ctx.fillStyle = treeGrad;

    // Draw wavy treeline using noise for organic canopy edge
    const treeScroll = distance * 0.12;
    ctx.beginPath();
    ctx.moveTo(-20, H * 0.68);
    for (let x = -20; x <= W + 20; x += 6) {
      const worldX = x + treeScroll;
      const n = fbm(worldX * 0.003 + 350, 3, 0.5);
      const treeY = H * 0.52 + n * H * 0.10;
      // Add subtle bumps for tree-tip silhouettes
      const tipNoise = fbm(worldX * 0.015 + 700, 2, 0.4) * 6;
      ctx.lineTo(x, treeY - tipNoise);
    }
    ctx.lineTo(W + 20, H * 0.68);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Final atmospheric haze wash at base of all mountains
  if (bi <= 2) {
    ctx.save();
    const hazeGrad = ctx.createLinearGradient(0, H * 0.52, 0, H * 0.70);
    const hC = isSunset ? [240,180,140] : isDawn ? [215,210,205] : [190,210,228];
    hazeGrad.addColorStop(0, `rgba(${hC[0]},${hC[1]},${hC[2]},0)`);
    hazeGrad.addColorStop(0.3, `rgba(${hC[0]},${hC[1]},${hC[2]},0.03)`);
    hazeGrad.addColorStop(0.6, `rgba(${hC[0]},${hC[1]},${hC[2]},0.07)`);
    hazeGrad.addColorStop(1, `rgba(${hC[0]},${hC[1]},${hC[2]},0.12)`);
    ctx.fillStyle = hazeGrad;
    ctx.fillRect(0, H * 0.52, W, H * 0.18);
    ctx.restore();
  }
}

function drawMidLayer() {
  const scrollMid = distance * 0.22;
  ctx.save();

  if (biomeIndex === 0 || biomeIndex === 1) {
    // --- Treeline silhouette: one continuous wavy curve, gradient-filled ---
    // This replaces individual tree drawing with an Alto's Adventure style canopy silhouette
    const baseY = H * 0.66;
    const canopyTopBase = H * 0.56;
    const canopyAmplitude = H * 0.06;

    // Main canopy silhouette — smooth noise curve
    ctx.globalAlpha = 0.92;
    const canopyGrad = ctx.createLinearGradient(0, canopyTopBase - canopyAmplitude, 0, baseY);
    if (biomeIndex === 0) {
      canopyGrad.addColorStop(0.0, 'rgba(18,48,22,1)');
      canopyGrad.addColorStop(0.25, 'rgba(22,55,26,1)');
      canopyGrad.addColorStop(0.50, 'rgba(26,62,30,1)');
      canopyGrad.addColorStop(0.75, 'rgba(30,68,34,1)');
      canopyGrad.addColorStop(1.0, 'rgba(35,75,38,1)');
    } else {
      canopyGrad.addColorStop(0.0, 'rgba(10,30,12,1)');
      canopyGrad.addColorStop(0.25, 'rgba(14,36,16,1)');
      canopyGrad.addColorStop(0.50, 'rgba(17,42,20,1)');
      canopyGrad.addColorStop(0.75, 'rgba(20,48,24,1)');
      canopyGrad.addColorStop(1.0, 'rgba(24,54,28,1)');
    }
    ctx.fillStyle = canopyGrad;

    ctx.beginPath();
    ctx.moveTo(-20, baseY);
    for (let x = -20; x <= W + 20; x += 4) {
      const worldX = x + scrollMid;
      // Low-freq noise for overall canopy shape
      const n1 = fbm(worldX * 0.0025 + 600, 3, 0.45);
      // Higher-freq noise for small bumps (tree tops)
      const n2 = fbm(worldX * 0.012 + 800, 2, 0.4);
      const canopyY = canopyTopBase + n1 * canopyAmplitude + n2 * 5;
      ctx.lineTo(x, canopyY);
    }
    ctx.lineTo(W + 20, baseY);
    ctx.closePath();
    ctx.fill();

    // A few individual tree-tip silhouettes poking above the canopy for interest
    ctx.globalAlpha = 0.85;
    const tipGrad = ctx.createLinearGradient(0, canopyTopBase - canopyAmplitude - 15, 0, canopyTopBase);
    if (biomeIndex === 0) {
      tipGrad.addColorStop(0, 'rgba(15,42,18,1)');
      tipGrad.addColorStop(1, 'rgba(20,50,24,1)');
    } else {
      tipGrad.addColorStop(0, 'rgba(8,26,10,1)');
      tipGrad.addColorStop(1, 'rgba(14,35,16,1)');
    }
    ctx.fillStyle = tipGrad;

    // Draw pointed tree tips at intervals using the control points
    for (const pt of midTrees) {
      if (pt.tip <= 0) continue;
      const tx = ((pt.x - scrollMid) % (W * 3) + W * 3) % (W * 3);
      if (tx < -30 || tx > W + 30) continue;
      const worldX = tx + scrollMid;
      const n1 = fbm(worldX * 0.0025 + 600, 3, 0.45);
      const canopyY = canopyTopBase + n1 * canopyAmplitude;
      const tipH = 8 + pt.tip * 18;
      ctx.beginPath();
      ctx.moveTo(tx, canopyY - tipH);
      ctx.bezierCurveTo(tx - 2, canopyY - tipH * 0.5, tx - 5, canopyY - 2, tx - 4, canopyY + 2);
      ctx.lineTo(tx + 4, canopyY + 2);
      ctx.bezierCurveTo(tx + 5, canopyY - 2, tx + 2, canopyY - tipH * 0.5, tx, canopyY - tipH);
      ctx.closePath();
      ctx.fill();
    }

    // Building silhouettes (simple dark shapes, kept minimal)
    ctx.globalAlpha = 0.70;
    for (const b of midBuildings) {
      const bx = ((b.x - scrollMid * 0.95) % (W * 3) + W * 3) % (W * 3);
      if (bx > W + 30 || bx < -30) continue;
      const bGrad = ctx.createLinearGradient(0, baseY - b.h - 5, 0, baseY);
      bGrad.addColorStop(0, biomeIndex === 0 ? 'rgba(180,165,140,1)' : 'rgba(150,140,125,1)');
      bGrad.addColorStop(1, biomeIndex === 0 ? 'rgba(160,145,120,1)' : 'rgba(130,120,108,1)');
      ctx.fillStyle = bGrad;
      ctx.fillRect(bx - b.w / 2, baseY - b.h, b.w, b.h);
      // Simple roof silhouette
      const roofGrad = ctx.createLinearGradient(0, baseY - b.h - 5, 0, baseY - b.h);
      roofGrad.addColorStop(0, 'rgba(100,20,10,1)');
      roofGrad.addColorStop(1, 'rgba(120,30,15,1)');
      ctx.fillStyle = roofGrad;
      ctx.beginPath();
      ctx.moveTo(bx - b.w / 2 - 3, baseY - b.h);
      ctx.lineTo(bx, baseY - b.h - 5);
      ctx.lineTo(bx + b.w / 2 + 3, baseY - b.h);
      ctx.closePath();
      ctx.fill();
    }

  } else if (biomeIndex === 2) {
    // Snow peaks: rocky ridge silhouette with gradient fill
    ctx.globalAlpha = 0.55;
    const rockGrad = ctx.createLinearGradient(0, H * 0.68, 0, H * 0.76);
    rockGrad.addColorStop(0, 'rgba(80,90,105,1)');
    rockGrad.addColorStop(0.5, 'rgba(95,105,118,1)');
    rockGrad.addColorStop(1, 'rgba(110,118,130,1)');
    ctx.fillStyle = rockGrad;
    ctx.beginPath();
    ctx.moveTo(-20, H * 0.76);
    for (let x = -20; x <= W + 20; x += 8) {
      const worldX = x + scrollMid * 0.5;
      const n = fbm(worldX * 0.003 + 900, 3, 0.5);
      ctx.lineTo(x, H * 0.70 + n * H * 0.04);
    }
    ctx.lineTo(W + 20, H * 0.76);
    ctx.closePath();
    ctx.fill();

    // Snow dusting gradient on top
    ctx.globalAlpha = 0.25;
    const snowGrad = ctx.createLinearGradient(0, H * 0.68, 0, H * 0.73);
    snowGrad.addColorStop(0, 'rgba(240,245,255,0.5)');
    snowGrad.addColorStop(1, 'rgba(240,245,255,0)');
    ctx.fillStyle = snowGrad;
    ctx.fillRect(0, H * 0.68, W, H * 0.05);

  } else {
    // Above clouds: ethereal cloud floor with gradient wisps
    for (let i = 0; i < 10; i++) {
      const cx = ((i * W * 0.28 - distance * 0.05) % (W * 3) + W * 3) % (W * 3);
      if (cx > W + 150 || cx < -150) continue;
      const cloudGrad = ctx.createRadialGradient(cx, H * 0.76, 0, cx, H * 0.76, 120);
      cloudGrad.addColorStop(0, 'rgba(210,195,240,0.25)');
      cloudGrad.addColorStop(0.4, 'rgba(200,185,230,0.15)');
      cloudGrad.addColorStop(0.7, 'rgba(190,175,220,0.06)');
      cloudGrad.addColorStop(1, 'rgba(180,165,210,0)');
      ctx.fillStyle = cloudGrad;
      ctx.beginPath();
      ctx.ellipse(cx, H * 0.76, 130, 20, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawTerrain() {
  const bi = Math.min(biomeIndex, 3);

  // --- Main terrain shape ---
  ctx.beginPath();
  ctx.moveTo(-10, H);
  for (let i = 0; i < terrainPoints.length; i++) {
    ctx.lineTo(i * TERRAIN_SEGMENT_W, terrainPoints[i]);
  }
  ctx.lineTo(W + 20, H);
  ctx.closePath();

  // Rich multi-stop gradient: saturated color at ridgeline fading to warm earth tones
  const tGrad = ctx.createLinearGradient(0, H * 0.58, 0, H);
  if (bi === 0) {
    // Bir Valley: lush green ridgeline -> warm golden-brown fields -> deep ochre
    tGrad.addColorStop(0.00, '#2A7A30');
    tGrad.addColorStop(0.08, '#358838');
    tGrad.addColorStop(0.18, '#429440');
    tGrad.addColorStop(0.30, '#559A48');
    tGrad.addColorStop(0.42, '#6AA050');
    tGrad.addColorStop(0.55, '#88A048');
    tGrad.addColorStop(0.68, '#A89838');
    tGrad.addColorStop(0.80, '#C09028');
    tGrad.addColorStop(0.90, '#D08820');
    tGrad.addColorStop(1.00, '#C07818');
  } else if (bi === 1) {
    // Pine Forest: deep forest floor
    tGrad.addColorStop(0.00, '#1A4A1C');
    tGrad.addColorStop(0.15, '#1E5220');
    tGrad.addColorStop(0.35, '#224A1E');
    tGrad.addColorStop(0.55, '#1E3E18');
    tGrad.addColorStop(0.75, '#1A3616');
    tGrad.addColorStop(1.00, '#163014');
  } else if (bi === 2) {
    // Snow Peaks: rock and snow
    tGrad.addColorStop(0.00, '#A0B0C0');
    tGrad.addColorStop(0.15, '#B0BCC8');
    tGrad.addColorStop(0.35, '#C0CCD8');
    tGrad.addColorStop(0.55, '#D0D8E0');
    tGrad.addColorStop(0.75, '#DDE4EA');
    tGrad.addColorStop(1.00, '#E8EEF5');
  } else {
    // Above Clouds: ethereal purple
    tGrad.addColorStop(0.00, '#A090C0');
    tGrad.addColorStop(0.20, '#B0A0C8');
    tGrad.addColorStop(0.45, '#9888B8');
    tGrad.addColorStop(0.70, '#8878A8');
    tGrad.addColorStop(1.00, '#7868A0');
  }
  ctx.fillStyle = tGrad;
  ctx.fill();

  // --- Subtle horizontal terrace lines (very low alpha) for texture ---
  if (bi <= 1) {
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = bi === 0 ? 'rgba(60,40,20,1)' : 'rgba(30,50,30,1)';
    ctx.lineWidth = 0.8;
    // Find approximate terrain top for visible area
    let minY = H;
    for (let i = 0; i < terrainPoints.length; i++) {
      if (terrainPoints[i] < minY) minY = terrainPoints[i];
    }
    // Draw horizontal lines suggesting terraced fields
    for (let y = minY + 8; y < H; y += 6) {
      ctx.beginPath();
      let drawing = false;
      for (let i = 0; i < terrainPoints.length; i++) {
        const px = i * TERRAIN_SEGMENT_W;
        if (terrainPoints[i] <= y) {
          if (!drawing) { ctx.moveTo(px, y); drawing = true; }
          else ctx.lineTo(px, y);
        } else {
          drawing = false;
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- Ridgeline highlight stroke (bright lit edge) ---
  ctx.save();
  // Outer glow
  if (bi <= 1) {
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = bi === 0 ? 'rgba(160,220,120,1)' : 'rgba(100,160,80,1)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < terrainPoints.length; i++) {
      if (i === 0) ctx.moveTo(0, terrainPoints[0]);
      else ctx.lineTo(i * TERRAIN_SEGMENT_W, terrainPoints[i]);
    }
    ctx.stroke();
  }

  // Crisp highlight
  const hlColors = [
    'rgba(180,230,140,0.14)',  // biome 0
    'rgba(120,180,90,0.12)',   // biome 1
    'rgba(255,255,255,0.25)',  // biome 2
    'rgba(200,180,240,0.10)',  // biome 3
  ];
  ctx.strokeStyle = hlColors[bi];
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 1;
  ctx.beginPath();
  for (let i = 0; i < terrainPoints.length; i++) {
    if (i === 0) ctx.moveTo(0, terrainPoints[0]);
    else ctx.lineTo(i * TERRAIN_SEGMENT_W, terrainPoints[i]);
  }
  ctx.stroke();
  ctx.restore();
}

function drawThermals() {
  for (const th of thermals) {
    if (!th.active) continue;
    th.phase += 0.03;
    const grd = ctx.createRadialGradient(th.x, th.y + th.height/2, 5, th.x, th.y + th.height/2, th.width);
    grd.addColorStop(0, 'rgba(255,200,80,0.15)');
    grd.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(th.x, th.y + th.height/2, th.width * (0.8 + 0.2*Math.sin(th.phase)), th.height/2, 0, 0, Math.PI*2);
    ctx.fill();

    // Rising wisp lines
    ctx.strokeStyle = 'rgba(255,210,100,0.08)';
    ctx.lineWidth = 1;
    for (let l = 0; l < 3; l++) {
      const p2 = th.phase + l * 0.8;
      ctx.beginPath();
      ctx.moveTo(th.x + Math.sin(p2) * th.width * 0.3, th.y + th.height);
      ctx.bezierCurveTo(th.x + Math.sin(p2+1) * th.width * 0.5, th.y + th.height * 0.5, th.x + Math.sin(p2+2) * th.width * 0.3, th.y + th.height * 0.25, th.x + Math.sin(p2+3) * th.width * 0.1, th.y);
      ctx.stroke();
    }
  }
}

function drawPrayerFlags() {
  const flagColors = BIR_PALETTE.flags;
  for (const f of prayerFlags) {
    if (f.collected) continue;
    f.phase += 0.05;
    const groundY = getTerrainY(f.x + distance, biomeIndex);
    const poleTop = f.y;

    // Pole
    ctx.strokeStyle = '#7A6A50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(f.x, groundY);
    ctx.lineTo(f.x, poleTop - 5);
    ctx.stroke();

    // String catenary
    const sX = f.x - 36, eX = f.x + 40, sY = poleTop + 4;
    ctx.strokeStyle = 'rgba(160,140,110,0.5)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(sX, sY);
    ctx.quadraticCurveTo(f.x, sY + 7 + Math.sin(f.phase) * 2, eX, sY + 2);
    ctx.stroke();

    // 5 flags (Tibetan order)
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const fx = sX + t * (eX - sX);
      const sag = Math.sin(t * Math.PI) * 7 + Math.sin(f.phase) * 2;
      const fy = sY + sag;
      const wave = Math.sin(f.phase + i * 0.6) * 3;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(wave * 0.02);
      ctx.fillStyle = flagColors[i];
      ctx.globalAlpha = 0.85;
      ctx.fillRect(0, 0, 12 + wave, 8);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

function drawEagles() {
  for (const e of eagles) {
    e.wingPhase += 0.05;
    const wing = Math.sin(e.wingPhase) * 10;
    ctx.save();
    ctx.translate(e.x, e.y + Math.cos(e.wingPhase * 0.4) * 3);

    // Clean silhouette (Alto's style)
    ctx.fillStyle = biomeIndex >= 2 ? '#1A1A2A' : '#1A0E05';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-14, -2 + wing * 0.5, -30, wing);
    ctx.quadraticCurveTo(-14, wing * 0.3 + 3, 0, 3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(14, -2 + wing * 0.5, 30, wing);
    ctx.quadraticCurveTo(14, wing * 0.3 + 3, 0, 3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 1, 5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-3, 7); ctx.lineTo(0, 13); ctx.lineTo(3, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawGlider() {
  ctx.save();
  ctx.translate(gliderX, gliderY);
  // Tilt based on velocity — nose up when rising, nose down when sinking
  const tilt = Math.max(-0.2, Math.min(0.2, -velocity * 0.04));
  ctx.rotate(tilt);

  const t = Date.now() * 0.001;
  const breathe = Math.sin(t * 2) * 0.8;

  // Side-view paraglider: canopy is an elongated airfoil shape above,
  // pilot hangs below in profile view, lines connect at angle

  // ── Thermal glow ──
  if (inThermal) {
    const gg = ctx.createRadialGradient(0, -8, 10, 0, -8, 55);
    gg.addColorStop(0, `rgba(255,210,100,${0.12 + Math.sin(t * 4) * 0.06})`);
    gg.addColorStop(1, 'rgba(255,210,100,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(-60, -40, 120, 80);
  }

  // ── SIDE-VIEW CANOPY (airfoil profile seen from the side) ──
  // The canopy from the side looks like a thick curved crescent/lens shape
  const canopyLen = 55;  // length front to back
  const canopyH = 10;    // thickness
  const canopyY = -22 + breathe; // above pilot

  // ── Stunt spin animation ──
  if (stuntActive) {
    const spinProgress = 1 - (stuntTimer / 60); // 0→1
    const spinAngle = spinProgress * Math.PI * 2; // full 360° rotation
    ctx.rotate(spinAngle);
  }

  // ── SIDE-VIEW CANOPY (airfoil seen from the side) ──
  // From the side, a paraglider canopy looks like a thick curved lens/crescent
  const cFront = -canopyLen * 0.55; // leading edge (front, leftward in side view)
  const cBack = canopyLen * 0.45;   // trailing edge (back)

  // Canopy shape — curved top, flatter bottom (airfoil cross-section)
  ctx.beginPath();
  ctx.moveTo(cFront, canopyY + 2);
  // Top surface (curved, inflated)
  ctx.bezierCurveTo(
    cFront + canopyLen * 0.25, canopyY - canopyH,
    cBack - canopyLen * 0.25, canopyY - canopyH,
    cBack, canopyY + 2
  );
  // Bottom surface (flatter)
  ctx.bezierCurveTo(
    cBack - canopyLen * 0.2, canopyY + canopyH * 0.5,
    cFront + canopyLen * 0.2, canopyY + canopyH * 0.5,
    cFront, canopyY + 2
  );
  ctx.closePath();

  // Canopy gradient — vibrant multi-color
  const cGrad = ctx.createLinearGradient(cFront, canopyY - canopyH, cBack, canopyY + canopyH * 0.5);
  cGrad.addColorStop(0, '#E53935');    // red leading edge
  cGrad.addColorStop(0.2, '#FF7043');  // orange
  cGrad.addColorStop(0.4, '#FFB300');  // amber
  cGrad.addColorStop(0.55, '#FFFFFF'); // white center
  cGrad.addColorStop(0.7, '#42A5F5');  // blue
  cGrad.addColorStop(0.85, '#1E88E5'); // deeper blue
  cGrad.addColorStop(1, '#7B1FA2');    // purple trailing edge
  ctx.fillStyle = cGrad;
  ctx.fill();

  // 3D shading — top lit, bottom in shadow
  const shadeGrad = ctx.createLinearGradient(0, canopyY - canopyH, 0, canopyY + canopyH * 0.5);
  shadeGrad.addColorStop(0, 'rgba(255,255,255,0.2)');
  shadeGrad.addColorStop(0.5, 'rgba(0,0,0,0)');
  shadeGrad.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = shadeGrad;
  ctx.fill();

  // Leading edge highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cFront, canopyY + 2);
  ctx.bezierCurveTo(
    cFront + canopyLen * 0.25, canopyY - canopyH,
    cBack - canopyLen * 0.25, canopyY - canopyH,
    cBack, canopyY + 2
  );
  ctx.stroke();

  // Rib lines on canopy (vertical seams as seen from side — short dashes)
  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  ctx.lineWidth = 0.5;
  for (let i = 1; i < 8; i++) {
    const ribT = i / 8;
    const ribX = cFront + ribT * canopyLen;
    const ribTop = canopyY - canopyH * (1 - Math.pow(ribT * 2 - 1, 2)) * 0.9 + 1;
    const ribBot = canopyY + canopyH * 0.3 * (1 - Math.pow(ribT * 2 - 1, 2));
    ctx.beginPath();
    ctx.moveTo(ribX, ribTop);
    ctx.lineTo(ribX, ribBot);
    ctx.stroke();
  }

  // ── SUSPENSION LINES (from canopy bottom to pilot — angled) ──
  const pilotY = 20;
  ctx.strokeStyle = 'rgba(60,50,40,0.2)';
  ctx.lineWidth = 0.4;
  // Lines fan from canopy to a single riser point near pilot's shoulders
  const riserX = 0, riserY = pilotY - 6;
  for (let i = 0; i < 6; i++) {
    const lt = (i + 0.5) / 6;
    const lx = cFront + lt * canopyLen;
    const ly = canopyY + canopyH * 0.3 * (1 - Math.pow(lt * 2 - 1, 2));
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(riserX, riserY);
    ctx.stroke();
  }

  // ── PILOT (side profile — facing right) ──
  const legSwing = Math.sin(t * 2) * 1.5;

  // Harness (side view — narrow profile)
  ctx.fillStyle = '#2C3E50';
  ctx.beginPath();
  ctx.ellipse(0, pilotY + 6, 4, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Jacket (blue windbreaker, side view)
  const jGrad = ctx.createLinearGradient(-4, pilotY, 4, pilotY + 10);
  jGrad.addColorStop(0, '#1565C0');
  jGrad.addColorStop(1, '#0D47A1');
  ctx.fillStyle = jGrad;
  ctx.beginPath();
  ctx.ellipse(0, pilotY + 3, 4.5, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Arm (one visible in side view — reaching up to risers)
  ctx.strokeStyle = '#1565C0';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(1, pilotY + 1);
  ctx.quadraticCurveTo(3, pilotY - 3, riserX + 1, riserY + 2);
  ctx.stroke();
  // Gloved hand
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(riserX + 1, riserY + 2, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineCap = 'butt';

  // Head/helmet (side profile)
  ctx.fillStyle = '#CC2222';
  ctx.beginPath();
  ctx.arc(1, pilotY - 5, 4.5, 0, Math.PI * 2);
  ctx.fill();
  // Helmet highlight
  ctx.fillStyle = '#EE4444';
  ctx.beginPath();
  ctx.arc(0, pilotY - 6.5, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Visor (side view — curved strip on the front of helmet)
  ctx.fillStyle = 'rgba(40,40,40,0.85)';
  ctx.beginPath();
  ctx.ellipse(3.5, pilotY - 4.5, 2, 2.5, 0.3, -0.8, 0.8);
  ctx.fill();
  // Visor glare
  ctx.fillStyle = 'rgba(120,200,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(4, pilotY - 5, 1, 1.2, 0.3, -0.5, 0.5);
  ctx.fill();

  // Neck (skin)
  ctx.fillStyle = '#D4A574';
  ctx.fillRect(0, pilotY - 1, 2.5, 2.5);

  // Leg (one visible from side — bent at knee, seated)
  ctx.strokeStyle = '#1A1A3A';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, pilotY + 10);
  ctx.quadraticCurveTo(4, pilotY + 15, 2, pilotY + 20 + legSwing);
  ctx.stroke();
  ctx.lineCap = 'butt';

  // Boot
  ctx.fillStyle = '#4E342E';
  ctx.beginPath();
  ctx.moveTo(0.5, pilotY + 19 + legSwing);
  ctx.lineTo(0, pilotY + 22 + legSwing);
  ctx.lineTo(5, pilotY + 22 + legSwing);
  ctx.lineTo(4, pilotY + 19 + legSwing);
  ctx.closePath();
  ctx.fill();

  // Speed streaks (behind the glider when moving fast)
  if (isHolding && velocity > 1.5) {
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cFront - 5 - i * 6, canopyY + i * 4);
      ctx.lineTo(cFront - 15 - i * 6 - velocity * 3, canopyY + i * 4 + 0.5);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.life -= p.decay;
    if (p.life <= 0) { particles[i] = particles[particles.length - 1]; particles.pop(); continue; }
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.alpha ? p.color + p.life + ')' : p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawSky();
  drawBackMountains();
  drawMidLayer();
  drawThermals();
  drawPrayerFlags();
  drawEagles();
  drawTerrain();
  drawGlider();
  drawParticles();
}

// ---- Collisions ----
function checkCollisions() {
  const terrainY = getTerrainYAtX(gliderX);
  if (gliderY + 12 >= terrainY) {
    if (zenMode) { velocity = 8; gliderY = terrainY - 20; zenRecovering = true; return; }
    endGame('landed'); return;
  }
  for (let i = prayerFlags.length - 1; i >= 0; i--) {
    const f = prayerFlags[i];
    if (f.collected) continue;
    if (Math.abs(gliderX - f.x) < 30 && Math.abs(gliderY - f.y) < 30) {
      f.collected = true; prayerFlagsCollected++; flagCombo++;
      flagComboTimer = 180; maxCombo = Math.max(maxCombo, flagCombo);
      const mult = flagCombo <= 2 ? 1 : flagCombo <= 4 ? 2 : flagCombo <= 7 ? 3 : 5;
      const pts = 100 * mult; totalFlagScore += pts; totalScore += pts;
      playFlagSound(flagCombo); spawnFlagParticles(f.x, f.y, f.colors);
      updateComboDisplay();
    }
  }
  for (const e of eagles) {
    const dx = gliderX - e.x, dy = gliderY - e.y, dist2 = dx*dx + dy*dy;
    if (!e.nearMissed && dist2 < 60*60 && dist2 > 20*20) {
      e.nearMissed = true; eagleNearMisses++; totalNearMissBonus += 250; totalScore += 250;
      flashScreen('rgba(255,255,255,0.25)');
    }
    if (!zenMode && dist2 < 22*22) { endGame('crashed'); return; }
  }
  inThermal = false;
  for (const t of thermals) {
    if (!t.active) continue;
    if (Math.abs(gliderX - t.x) < t.width && gliderY - t.y > 0 && gliderY - t.y < t.height) {
      inThermal = true;
      if (thermalTimer === 0) { thermalsCount++; playThermalSound(); spawnThermalParticles(gliderX, gliderY); }
      thermalTimer = 30;
    }
  }
  if (thermalTimer > 0) thermalTimer--;
}

// ---- Physics (realistic glide — gentle descent when neutral) ----
// Physics tuned for paraglider feel:
// - Hold: gradual climb (not instant rocket)
// - Release: gentle glide that slowly descends
// - Neutral: always sinking slightly (real glide ratio ~8:1)
const RISE_FORCE = 0.12;      // gentle climb when holding
const GLIDE_SINK = 0.06;      // natural sink in neutral glide
const RELEASE_DRAG = 0.92;    // velocity dampening on release (smooth transition)
const THERMAL_BOOST = 0.15;   // thermals give a nice lift
const MAX_RISE = 3;            // max upward speed (can't rocket up)
const MAX_FALL = -3;           // max downward speed (gentle terminal velocity)

function updatePhysics(dt) {
  if (isHolding) {
    // Holding — pull up, climb gradually
    velocity += RISE_FORCE * dt;
  } else {
    // Released — velocity decays smoothly toward gentle sink
    velocity *= RELEASE_DRAG;
    // Constant gentle downward pull (gravity on a glider)
    velocity -= GLIDE_SINK * dt;
  }

  if (inThermal) {
    velocity += THERMAL_BOOST * dt;
  }

  velocity = Math.max(MAX_FALL, Math.min(MAX_RISE, velocity));
  gliderY -= velocity * dt;

  // Ceiling clamp
  if (gliderY < 60) { gliderY = 60; velocity = Math.min(velocity, 0); }
  // Floor clamp (don't go below screen — collision handles death)
}

// ---- Game Loop ----
let lastTime = 0;
function gameLoop(ts) {
  animFrameId = requestAnimationFrame(gameLoop);
  const dt = Math.min((ts - lastTime) / 16.67, 3);
  lastTime = ts;
  if (gameState !== 'playing') {
    if (gameState === 'paused' || gameState === 'waiting') { draw(); }
    return;
  }
  gameTime += dt;
  distance += scrollSpeed * dt;
  totalScore = Math.floor(distance) + totalFlagScore + totalNearMissBonus + altitudeMilestoneBonus;

  let newBiome = 0;
  for (let i = BIOMES.length - 1; i >= 0; i--) { if (distance >= BIOMES[i].minDist) { newBiome = i; break; } }
  if (newBiome !== biomeIndex) { biomeIndex = newBiome; if (!visitedBiomes.has(biomeIndex)) { visitedBiomes.add(biomeIndex); showBiomeCard(BIOMES[biomeIndex]); } }

  altitudeM = Math.max(0, Math.floor((1 - gliderY / H) * 4000));
  maxAltitudeM = Math.max(maxAltitudeM, altitudeM);
  [1000, 2000, 3000, 4000].forEach(m => {
    if (altitudeM >= m && !altitudeMilestonesHit.has(m)) {
      altitudeMilestonesHit.add(m);
      altitudeMilestoneBonus += {1000:500,2000:1500,3000:3000,4000:5000}[m];
      flashScreen('rgba(255,255,255,0.15)');
    }
  });
  if (flagComboTimer > 0) { flagComboTimer -= dt; if (flagComboTimer <= 0) { flagCombo = 0; updateComboDisplay(); } }

  scrollSpeed = Math.min(0.75, 0.25 + distance * 0.00003);
  terrainOffset -= scrollSpeed * dt;
  extendTerrain();

  for (const f of prayerFlags) f.x -= scrollSpeed * dt;
  for (const e of eagles) { e.x -= (scrollSpeed + e.speed) * dt; e.y += e.vy * dt; }
  for (const t of thermals) t.x -= scrollSpeed * dt;
  prayerFlags = prayerFlags.filter(f => f.x > -60);
  eagles = eagles.filter(e => e.x > -60);
  thermals = thermals.filter(t => t.x > -100);
  spawnObjects();

  // Stunt cooldown
  if (stuntCooldown > 0) stuntCooldown -= dt;
  if (stuntActive) { stuntTimer -= dt; if (stuntTimer <= 0) stuntActive = false; }

  updatePhysics(dt);
  checkCollisions();
  checkGoals();
  updateWindPitch();
  draw();
  updateHUD();

  // Show pause button
  document.getElementById('pauseBtn').style.display = 'flex';
}

// ---- HUD ----
function updateHUD() {
  document.getElementById('hudDistance').innerHTML = Math.floor(distance) + ' <span>m</span>';
  if (personalBest > 0) {
    document.getElementById('hudBest').textContent = 'Best: ' + personalBest + 'm';
  }
  const altPct = Math.min(100, (altitudeM / 4000) * 100);
  document.getElementById('altFill').style.height = altPct + '%';
  document.getElementById('altLabel').textContent = altitudeM + 'm';
}

function updateComboDisplay() {
  const el = document.getElementById('hudCombo');
  if (flagCombo >= 2) {
    const mult = flagCombo <= 2 ? 1 : flagCombo <= 4 ? 2 : flagCombo <= 7 ? 3 : 5;
    el.textContent = 'x' + mult + ' Combo!';
    el.classList.add('active');
  } else {
    el.classList.remove('active');
  }
}

// ---- Goals ----
const GOAL_POOL_ACTIVE = [
  { id: 'thermals3', text: 'Catch 3 thermals', check: () => thermalsCount >= 3 },
  { id: 'flags10',   text: 'Collect 10 flags',  check: () => prayerFlagsCollected >= 10 },
  { id: 'dist1000',  text: 'Fly 1000m',          check: () => distance >= 1000 },
];

function pickGoals() {
  goals = GOAL_POOL_ACTIVE.slice(0, 3);
  renderGoals();
}

function checkGoals() {
  let changed = false;
  for (const g of goals) {
    const was = goalProgress[g.id];
    const now = g.check();
    if (now && !was) { goalProgress[g.id] = true; changed = true; }
  }
  if (changed) renderGoals();
}

function renderGoals() {
  const panel = document.getElementById('goalsPanel');
  if (!panel) return;
  panel.innerHTML = goals.map(g => {
    const done = goalProgress[g.id];
    return `<div class="goal-item"><div class="goal-dot ${done?'done':''}"></div>${g.text}</div>`;
  }).join('');
}

// ---- Biome card ----
let biomeCardTimeout = null;
function showBiomeCard(biome) {
  const card = document.getElementById('biomeCard');
  document.getElementById('biomeCardName').textContent = biome.name;
  document.getElementById('biomeCardSub').textContent = biome.sub;
  card.classList.add('show');
  clearTimeout(biomeCardTimeout);
  biomeCardTimeout = setTimeout(() => card.classList.remove('show'), 2500);
}

// ---- Screen flash ----
function flashScreen(color) {
  const el = document.getElementById('screenFlash');
  el.style.background = color;
  el.style.opacity = '1';
  setTimeout(() => { el.style.transition = 'opacity 0.5s'; el.style.opacity = '0'; }, 50);
  setTimeout(() => { el.style.transition = ''; }, 600);
}

// ---- Toast ----
function showToast(icon, text) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${icon}</span><span>${text}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// ---- Game Flow ----
function startGame() {
  // Reset state
  distance = 0;
  score = 0;
  totalScore = 0;
  totalFlagScore = 0;
  totalNearMissBonus = 0;
  altitudeMilestoneBonus = 0;
  altitude = 200;
  velocity = 0; // starts in neutral glide — player must hold to rise
  gliderX = W * 0.3;
  gliderY = H * 0.45;
  scrollSpeed = 0.25;
  prayerFlagsCollected = 0;
  flagCombo = 0;
  flagComboTimer = 0;
  maxCombo = 0;
  eagleNearMisses = 0;
  thermalsCount = 0;
  inThermal = false;
  thermalTimer = 0;
  biomeIndex = 0;
  altitudeM = 0;
  maxAltitudeM = 0;
  visitedBiomes = new Set([0]);
  altitudeMilestonesHit = new Set();
  isNewBest = false;
  zenRecovering = false;
  zenTimer = 0;
  stuntsPerformed = 0;
  stuntCooldown = 0;
  stuntActive = false;
  zenDroneStarted = false;

  prayerFlags = [];
  eagles = [];
  thermals = [];
  particles = [];
  goals = [];
  goalProgress = {};

  terrainOffset = 0;
  terrainSeed = Math.random() * 10000;
  generateTerrain();
  generateBackMountains();
  generateMidTrees();

  pickGoals();

  runStartTime = Date.now();
  gameTime = 0;

  // Hide/show UI
  document.getElementById('menuScreen').classList.add('hidden');
  document.getElementById('gameoverScreen').classList.add('hidden');
  document.getElementById('hud').style.display = 'block';

  // Cancel any existing game loop to prevent duplicate rAF chains
  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
  if (menuBgAnimId) { cancelAnimationFrame(menuBgAnimId); menuBgAnimId = null; }

  // Show "tap to start" overlay — game waits for first input
  gameState = 'waiting';
  document.getElementById('tapOverlay').classList.remove('hidden');

  initAudio();

  // Start rendering so player sees the world, but don't move anything
  animFrameId = requestAnimationFrame(gameLoop);
}

// Called on first tap/click/key after pressing Fly — actually starts gameplay
function launchFlight() {
  if (gameState !== 'waiting') return;
  document.getElementById('tapOverlay').classList.add('hidden');
  hideHeader();
  gameState = 'playing';
  runStartTime = Date.now();
  resize();
  startWind();
  stopZenDrone();
  if (zenMode) startZenDrone();
}

function hideHeader() {
  const hdr = document.getElementById('gameHeader');
  if (hdr) hdr.style.display = 'none';
  document.documentElement.style.setProperty('--header-h', '0px');
  resize();
}

function showHeader() {
  const hdr = document.getElementById('gameHeader');
  if (hdr) {
    hdr.style.display = 'flex';
    hdr.style.visibility = 'visible';
  }
  document.documentElement.style.setProperty('--header-h', '50px');
  resize();
}

let crashReason = 'landed';
function endGame(reason) {
  if (gameState !== 'playing') return;
  gameState = 'gameover';
  crashReason = reason || 'landed';

  showHeader();
  stopWind();
  stopZenDrone();
  playCrashSound();

  // Check personal best
  if (distance > personalBest) {
    personalBest = Math.floor(distance);
    isNewBest = true;
    localStorage.setItem('bir-glider-best', personalBest);
  }

  document.getElementById('hud').style.display = 'none';
  showGameOver();
}

function showMenu() {
  showHeader();
  gameState = 'menu';
  document.getElementById('gameoverScreen').classList.add('hidden');
  document.getElementById('pauseScreen').classList.add('hidden');
  document.getElementById('tapOverlay').classList.add('hidden');
  document.getElementById('menuScreen').classList.remove('hidden');
  document.getElementById('hud').style.display = 'none';
  document.getElementById('pauseBtn').style.display = 'none';
  updateMenuBest();
  window.scrollTo(0, 0);
  // Restart menu background animation
  animateMenuBg();
}

function showGameOver() {
  const screen = document.getElementById('gameoverScreen');
  screen.classList.remove('hidden');

  document.getElementById('statDistance').textContent = Math.floor(distance) + 'm';
  document.getElementById('statAltitude').textContent = maxAltitudeM + 'm';
  document.getElementById('statFlags').textContent = prayerFlagsCollected;
  document.getElementById('statThermals').textContent = thermalsCount;
  document.getElementById('statStunts').textContent = stuntsPerformed || 0;

  const titleEl = document.getElementById('gameoverTitle');
  const subEl = document.getElementById('gameoverSubtitle');
  const iconEl = document.getElementById('gameoverIcon');

  if (isNewBest) {
    document.getElementById('statDistance').classList.add('new-best');
    titleEl.textContent = 'New Record!';
    subEl.textContent = 'You soared further than ever before.';
    if (iconEl) iconEl.textContent = '🏆';
  } else if (crashReason === 'crashed') {
    document.getElementById('statDistance').classList.remove('new-best');
    titleEl.textContent = 'Crashed!';
    subEl.textContent = 'An eagle clipped your wing. Try again!';
    if (iconEl) iconEl.textContent = '🦅';
    const gap = personalBest - Math.floor(distance);
    if (gap > 0) {
      document.getElementById('gapToBest').innerHTML = `You were <strong>${gap}m</strong> from your record`;
    } else {
      document.getElementById('gapToBest').textContent = '';
    }
  } else {
    document.getElementById('statDistance').classList.remove('new-best');
    titleEl.textContent = 'Landed';
    subEl.textContent = 'The mountain is patient. Fly again.';
    if (iconEl) iconEl.textContent = '🏔️';
    const gap = personalBest - Math.floor(distance);
    if (gap > 0) {
      document.getElementById('gapToBest').innerHTML = `You were <strong>${gap}m</strong> from your record`;
    } else {
      document.getElementById('gapToBest').textContent = '';
    }
  }

  const biomeName = BIOMES[biomeIndex].name;
  document.getElementById('biomeReached').textContent = 'Reached: ' + biomeName;

  // Auto-submit score + unlock achievements (gameCloud handles auth nudge)
  autoSubmitScore();
  checkAndUnlockAchievements();
}

// ---- Achievements ----
async function checkAndUnlockAchievements() {
  if (!currentUser || !window.apiClient) return;

  const toUnlock = [];

  // First flight (only unlock once)
  if (!localStorage.getItem('bir-glider-first-flight')) {
    toUnlock.push('bir_first_flight');
    localStorage.setItem('bir-glider-first-flight', '1');
  }

  // Flag collector (10 in one run)
  if (prayerFlagsCollected >= 10) toUnlock.push('bir_flag_collector');

  // Altitude 1000
  if (maxAltitudeM >= 1000) toUnlock.push('bir_altitude_1000');

  // Eagle dodger
  if (eagleNearMisses >= 10) toUnlock.push('bir_eagle_dodger');

  // Himalayan explorer (Snow Peaks = biome index 2, distance 2500m)
  if (distance >= 2500) toUnlock.push('bir_himalayan_explorer');

  // Thermal rider (20 thermals)
  if (thermalsCount >= 20) toUnlock.push('bir_thermal_rider');

  // Legend (10k score)
  if (totalScore >= 10000) toUnlock.push('bir_legend');

  // Zen master (5 min = 300s) — gameTime is in dt units (~60/sec at 60fps)
  const zenPlaytimeSeconds = gameTime / 60;
  if (zenMode && zenPlaytimeSeconds >= 300) toUnlock.push('bir_zen_master');

  for (const id of toUnlock) {
    try {
      if (window.gameCloud) await window.gameCloud.unlockAchievement(id, 'bir-glider');
    } catch(e) {}
  }
}

// ---- Score submission (uses gameCloud — auto auth nudge) ----
async function autoSubmitScore() {
  const derivedScore = Math.floor(distance) + totalFlagScore + totalNearMissBonus + altitudeMilestoneBonus;
  if (window.gameCloud) {
    await window.gameCloud.submitOrQueue('bir-glider', {
      score: derivedScore,
      level: biomeIndex,
      timeMs: Date.now() - runStartTime,
      metadata: {
        distance: Math.floor(distance),
        maxAltitude: maxAltitudeM,
        prayerFlags: prayerFlagsCollected,
        maxCombo: maxCombo,
        eagleNearMisses: eagleNearMisses,
        biome: BIOMES[biomeIndex].name,
        goalsCompleted: goals.filter(g => goalProgress[g.id]).length,
        zenMode: zenMode,
      }
    });
    // Save cloud state
    await window.gameCloud.saveState('bir-glider', {
      currentLevel: biomeIndex,
      bestStreak: personalBest,
      gamesPlayed: (parseInt(localStorage.getItem('bir-glider-plays') || '0') || 0) + 1,
      lastPlayedDate: new Date().toISOString(),
      additionalData: { highScore: personalBest },
    });
    localStorage.setItem('bir-glider-plays', ((parseInt(localStorage.getItem('bir-glider-plays') || '0') || 0) + 1).toString());
  }
}

// ---- Controls ----
function onHoldStart(e) {
  e.preventDefault();
  if (gameState === 'waiting') { launchFlight(); return; }
  if (gameState !== 'playing') return;
  isHolding = true;
}
function onHoldEnd(e) {
  isHolding = false;
}

function setupControls() {
  canvas.addEventListener('mousedown', onHoldStart);
  canvas.addEventListener('mouseup', onHoldEnd);
  canvas.addEventListener('mouseleave', onHoldEnd);
  canvas.addEventListener('touchstart', onHoldStart, { passive: false });
  canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  canvas.addEventListener('touchend', onHoldEnd);
  canvas.addEventListener('touchcancel', onHoldEnd);
  // Tap overlay also triggers launch
  const tapOverlay = document.getElementById('tapOverlay');
  if (tapOverlay) {
    tapOverlay.addEventListener('click', () => { if (gameState === 'waiting') launchFlight(); });
    tapOverlay.addEventListener('touchstart', (e) => { e.preventDefault(); if (gameState === 'waiting') launchFlight(); }, { passive: false });
  }
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); onHoldStart(e); }
    if (e.code === 'Escape') {
      e.preventDefault();
      if (gameState === 'playing') pauseGame();
      else if (gameState === 'paused') resumeGame();
    }
    // Stunt: ArrowDown to perform a maneuver
    if (e.code === 'ArrowDown' && gameState === 'playing') {
      e.preventDefault();
      triggerStunt();
    }
  });
  document.addEventListener('keyup', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') onHoldEnd(e);
  });
  window.addEventListener('blur', () => {
    isHolding = false;
    if (gameState === 'playing') pauseGame();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && gameState === 'playing') pauseGame();
  });
}

// ---- Pause ----
function pauseGame() {
  if (gameState !== 'playing') return;
  gameState = 'paused';
  isHolding = false;
  document.getElementById('pauseScreen').classList.remove('hidden');
  document.getElementById('pauseBtn').style.display = 'none';
  document.getElementById('pauseDistance').textContent = Math.floor(distance) + 'm';
  document.getElementById('pauseAltitude').textContent = altitudeM + 'm alt';
}

function resumeGame() {
  if (gameState !== 'paused') return;
  document.getElementById('pauseScreen').classList.add('hidden');
  document.getElementById('pauseBtn').style.display = 'flex';
  gameState = 'playing';
  lastTime = performance.now();
}

function quitToMenu() {
  if (gameState !== 'paused') return;
  document.getElementById('pauseScreen').classList.add('hidden');
  document.getElementById('pauseBtn').style.display = 'none';
  showMenu();
}

// ---- Stunts ----
let stuntCooldown = 0;
let stuntActive = false;
let stuntType = '';
let stuntTimer = 0;
let stuntScore = 0;
let stuntsPerformed = 0;

function triggerStunt() {
  if (stuntCooldown > 0 || stuntActive) return;
  // Can only stunt when airborne (not near ground)
  if (gliderY > H * 0.75) return;

  // Pick stunt based on context
  if (inThermal) {
    stuntType = 'spiral';
    stuntScore = 500;
  } else if (velocity > 2) {
    stuntType = 'wingover';
    stuntScore = 300;
  } else if (velocity < -2) {
    stuntType = 'sat';
    stuntScore = 400;
  } else {
    stuntType = 'spin';
    stuntScore = 200;
  }

  stuntActive = true;
  stuntsPerformed++;
  stuntTimer = 60; // ~1 second
  stuntCooldown = 180; // ~3 second cooldown
  totalFlagScore += stuntScore;

  // Show stunt name
  showToast('🌀', stuntType.charAt(0).toUpperCase() + stuntType.slice(1) + '! +' + stuntScore);

  // Particles burst
  for (let i = 0; i < 8; i++) {
    particles.push({
      x: gliderX, y: gliderY,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      life: 1, decay: 0.02,
      r: 2 + Math.random() * 3,
      color: 'rgba(255,200,80,',
      alpha: true,
    });
  }
}

// ---- Zen mode ----
function toggleZenMode() {
  zenMode = !zenMode;
  const toggle = document.getElementById('zenToggle');
  toggle.classList.toggle('active', zenMode);
  toggle.setAttribute('aria-checked', zenMode ? 'true' : 'false');
  localStorage.setItem('bir-glider-zen', zenMode ? '1' : '0');
}

// ---- Sound toggle ----
function toggleMute() {
  muted = !muted;
  const btn = document.getElementById('muteBtn');
  if (btn) {
    btn.querySelector('span').textContent = muted ? '🔇' : '🔊';
    btn.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on');
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
  }
  if (windGain) windGain.gain.value = muted ? 0 : 0.04;
  localStorage.setItem('bir-glider-muted', muted ? '1' : '0');
}

// ---- Header + Auth (uses gameHeader, gameCloud provided by GameLayout) ----
function setupAuth() {
  if (window.gameHeader) {
    window.gameHeader.init({
      title: 'Bir Glider',
      icon: '🪂',
      gameId: 'bir-glider',
      buttons: ['sound', 'leaderboard', 'auth'],
      onSound: () => toggleMute(),
      onSignIn: async () => {
        currentUser = window.gameCloud ? window.gameCloud.getUser() : null;
        if (window.gameCloud) {
          const cloudState = await window.gameCloud.loadState('bir-glider');
          if (cloudState && cloudState.additionalData?.highScore) {
            const cloudBest = cloudState.additionalData.highScore;
            if (cloudBest > personalBest) {
              personalBest = cloudBest;
              localStorage.setItem('bir-glider-best', personalBest);
              updateMenuBest();
            }
          }
        }
      },
      onSignOut: () => { currentUser = null; },
    });
  } else if (window.authManager) {
    window.authManager.onAuthStateChanged(user => { currentUser = user; });
  }
}

// ---- Menu background animation ----
let menuBgOffset = 0;
function animateMenuBg() {
  if (gameState !== 'menu') return;
  const mbCanvas = document.getElementById('menuBgCanvas');
  if (!mbCanvas) return;
  const mc = mbCanvas.getContext('2d');
  const mw = mbCanvas.width;
  const mh = mbCanvas.height;
  menuBgOffset += 0.5;

  // Golden hour sunset sky (Bir's famous sunset)
  const grad = mc.createLinearGradient(0, 0, 0, mh);
  grad.addColorStop(0, '#7A4A9E');   // violet upper sky
  grad.addColorStop(0.25, '#D4608A'); // rose mid
  grad.addColorStop(0.5, '#F5813A');  // deep orange
  grad.addColorStop(0.75, '#E8A845'); // golden horizon
  grad.addColorStop(1, '#A8C4D8');    // valley haze
  mc.fillStyle = grad;
  mc.fillRect(0, 0, mw, mh);

  // Sun glow near horizon
  const sunGrad = mc.createRadialGradient(mw * 0.7, mh * 0.45, 20, mw * 0.7, mh * 0.45, mw * 0.3);
  sunGrad.addColorStop(0, 'rgba(245,200,100,0.5)');
  sunGrad.addColorStop(1, 'rgba(245,130,58,0)');
  mc.fillStyle = sunGrad;
  mc.fillRect(0, 0, mw, mh);

  // Far Dhauladhar peaks (snow-capped, sunset glow)
  for (let i = 0; i < 4; i++) {
    const mx = ((i * mw/3 + mw*0.1) - menuBgOffset * 0.05 + mw * 3) % (mw * 2);
    const peakY = mh * 0.2 + Math.sin(i * 1.7) * mh * 0.08;
    const w = mw * 0.2 + i * mw * 0.03;

    // Dark rock body
    mc.fillStyle = 'rgba(58,62,72,0.5)';
    mc.beginPath();
    mc.moveTo(mx - w, mh * 0.7);
    mc.lineTo(mx - w * 0.3, peakY + (mh * 0.7 - peakY) * 0.3);
    mc.lineTo(mx, peakY);
    mc.lineTo(mx + w * 0.4, peakY + (mh * 0.7 - peakY) * 0.25);
    mc.lineTo(mx + w, mh * 0.7);
    mc.closePath();
    mc.fill();

    // Sunset-glow snow cap
    mc.fillStyle = 'rgba(232,144,106,0.6)';
    mc.beginPath();
    mc.moveTo(mx - w * 0.25, peakY + (mh * 0.7 - peakY) * 0.18);
    mc.lineTo(mx, peakY);
    mc.lineTo(mx + w * 0.3, peakY + (mh * 0.7 - peakY) * 0.15);
    mc.closePath();
    mc.fill();
  }

  // Mid-range green mountains (deodar forest)
  mc.fillStyle = 'rgba(45,90,39,0.6)';
  for (let i = 0; i < 6; i++) {
    const mx = ((i * mw/4.5) - menuBgOffset * 0.15 + mw * 2.5) % (mw * 2);
    mc.beginPath();
    mc.moveTo(mx - mw*0.12, mh);
    mc.lineTo(mx, mh * 0.45 + Math.sin(i*1.3)*mh*0.08);
    mc.lineTo(mx + mw*0.12, mh);
    mc.closePath();
    mc.fill();
  }

  // Valley floor haze
  const hazeGrad = mc.createLinearGradient(0, mh * 0.7, 0, mh);
  hazeGrad.addColorStop(0, 'rgba(168,196,216,0)');
  hazeGrad.addColorStop(1, 'rgba(168,196,216,0.3)');
  mc.fillStyle = hazeGrad;
  mc.fillRect(0, 0, mw, mh);

  menuBgAnimId = requestAnimationFrame(animateMenuBg);
}

// ---- Resize ----
function resize() {
  const headerH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 0;
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight - headerH;
  gliderX = W * 0.3;
  if (gameState === 'menu' || gameState === 'waiting') {
    const mb = document.getElementById('menuBgCanvas');
    if (mb && mb.parentElement) {
      mb.width = mb.parentElement.offsetWidth;
      mb.height = mb.parentElement.offsetHeight;
    }
  }
}

// ---- Init ----
function updateMenuBest() {
  const el = document.getElementById('menuBest');
  if (personalBest > 0) {
    el.textContent = 'Personal Best: ' + personalBest + 'm';
  } else {
    el.textContent = 'First flight awaits';
  }
}

function init() {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');

  setupControls();
  resize();
  window.addEventListener('resize', resize);

  // Load saved data
  try {
    personalBest = parseInt(localStorage.getItem('bir-glider-best') || '0') || 0;
    zenMode = localStorage.getItem('bir-glider-zen') === '1';
    muted = localStorage.getItem('bir-glider-muted') === '1';
  } catch(e) {
    personalBest = 0; zenMode = false; muted = false;
  }

  if (zenMode) {
    document.getElementById('zenToggle').classList.add('active');
    document.getElementById('zenToggle').setAttribute('aria-checked', 'true');
  }
  if (muted) {
    const btn = document.getElementById('muteBtn');
    if (btn) {
      btn.querySelector('span').textContent = '🔇';
      btn.setAttribute('aria-label', 'Sound off');
      btn.setAttribute('aria-pressed', 'true');
    }
  }

  updateMenuBest();
  setupAuth();
  showHeader(); // ensure header visible on initial load

  // Start menu bg animation
  const mb = document.getElementById('menuBgCanvas');
  mb.width = window.innerWidth;
  mb.height = window.innerHeight - 50;
  animateMenuBg();

  // Start animation loop (idle on menu, starts game loop when startGame() called)
  animFrameId = requestAnimationFrame(ts => {
    lastTime = ts;
    animFrameId = requestAnimationFrame(gameLoop);
  });
}

// Start when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
