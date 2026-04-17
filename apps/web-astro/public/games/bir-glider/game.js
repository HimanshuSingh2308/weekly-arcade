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

// Environment decoration
let groundSilhouettes = [];
let skyDecorations = [];
let ambientParticles = [];
let bestDistanceMarker = null;
let terrainPatches = [];
let lastBiomeForAmbient = -1;

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

  // Pre-generate clouds with multi-lobe cumulus shapes — 10-12 at varied depths
  clouds = [];
  const cloudCount = 10 + Math.floor(Math.random() * 3);
  for (let i = 0; i < cloudCount; i++) {
    const lobeCount = 3 + Math.floor(Math.random() * 3); // 3-5 lobes
    const lobes = [];
    const baseW = 60 + Math.random() * 140;
    for (let l = 0; l < lobeCount; l++) {
      const t = l / (lobeCount - 1); // 0 to 1 across cloud width
      lobes.push({
        offsetX: (t - 0.5) * baseW * 0.8 + (Math.random() - 0.5) * baseW * 0.15,
        offsetY: -(Math.random() * 8 + 4) * (1 - Math.abs(t - 0.5) * 1.5), // taller in center
        rx: 20 + Math.random() * 25 + (l === Math.floor(lobeCount / 2) ? 15 : 0), // center lobe biggest
        ry: 8 + Math.random() * 10,
      });
    }
    clouds.push({
      x: Math.random() * W * 2.5,
      y: H * 0.05 + Math.random() * H * 0.35,
      w: baseW,
      h: 14 + Math.random() * 16,
      speed: 0.02 + Math.random() * 0.08,
      alpha: 0.04 + Math.random() * 0.10,
      lobes,
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

// ---- Environment Generation ----

function generateGroundSilhouettes() {
  groundSilhouettes = [];
  const totalW = W * 3;
  // Clustered placement: 8-12 clusters of 2-5 objects
  const clusterCount = 8 + Math.floor(Math.random() * 5);
  for (let c = 0; c < clusterCount; c++) {
    const clusterX = (c / clusterCount) * totalW + Math.random() * (totalW / clusterCount) * 0.6;
    const objectsInCluster = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < objectsInCluster; i++) {
      const types0 = ['deodar','deodar','stupa','bush','house','bush'];
      const types1 = ['tallpine','tallpine','tallpine','tallpine','deodar','rock','cabin'];
      const types2 = ['rock','rock','rock','boulder','ice'];
      const types3 = ['spire','spire','crystal'];
      const typePool = [types0, types1, types2, types3][Math.min(biomeIndex, 3)];
      const type = typePool[Math.floor(Math.random() * typePool.length)];
      const baseH = { deodar: 25, tallpine: 50, stupa: 20, bush: 8, house: 18, rock: 14, cabin: 16, boulder: 12, ice: 22, spire: 30, crystal: 18 }[type] || 15;
      groundSilhouettes.push({
        xWorld: clusterX + i * (15 + Math.random() * 25),
        type,
        h: baseH + Math.random() * baseH * 0.6,
        w: baseH * (0.4 + Math.random() * 0.4),
        seed: Math.random() * 1000,
        forBiome: Math.min(biomeIndex, 3),
      });
    }
  }
}

function generateSkyDecorations() {
  skyDecorations = [];
  // Bird flocks
  for (let i = 0; i < 3; i++) {
    skyDecorations.push({
      type: 'birdFlock',
      x: Math.random() * W * 2,
      y: H * 0.08 + Math.random() * H * 0.18,
      count: 4 + Math.floor(Math.random() * 4),
      spacing: 8 + Math.random() * 5,
      wingPhase: Math.random() * Math.PI * 2,
      speed: 0.15 + Math.random() * 0.2,
    });
  }
  // Hot air balloons (biomes 0-1)
  for (let i = 0; i < 2; i++) {
    skyDecorations.push({
      type: 'balloon',
      x: W * 0.3 + Math.random() * W * 1.5,
      y: H * 0.12 + Math.random() * H * 0.2,
      size: 18 + Math.random() * 12,
      color1: ['#C05050','#D08040','#5070B0','#A06090'][Math.floor(Math.random() * 4)],
      color2: ['#F0D080','#F0F0E0','#80B0D0','#E0C0A0'][Math.floor(Math.random() * 4)],
      bobPhase: Math.random() * Math.PI * 2,
      speed: 0.02 + Math.random() * 0.02,
    });
  }
}

function generateAmbientParticles() {
  ambientParticles = [];
  const count = 40;
  for (let i = 0; i < count; i++) {
    ambientParticles.push(createAmbientParticle(Math.random() * W, Math.random() * H));
  }
  lastBiomeForAmbient = biomeIndex;
}

function createAmbientParticle(x, y) {
  const bi = Math.min(biomeIndex, 3);
  if (bi === 2) { // snowflakes
    return { x, y, vx: (Math.random() - 0.5) * 0.3, vy: 0.2 + Math.random() * 0.4, size: 2 + Math.random() * 2, alpha: 0.2 + Math.random() * 0.3, type: 'snow', phase: Math.random() * Math.PI * 2 };
  } else if (bi === 3) { // star sparkles
    return { x, y, vx: (Math.random() - 0.5) * 0.1, vy: (Math.random() - 0.5) * 0.1, size: 1 + Math.random() * 1.5, alpha: 0.15 + Math.random() * 0.25, type: 'star', phase: Math.random() * Math.PI * 2 };
  } else if (bi === 1) { // forest mist + fireflies
    if (Math.random() < 0.3) {
      // Occasional firefly — brighter, greenish, twinkles
      return { x, y, vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.1, size: 1.5 + Math.random() * 1, alpha: 0.2 + Math.random() * 0.3, type: 'star', phase: Math.random() * Math.PI * 2 };
    }
    // Forest mist particles — slow, faint
    return { x, y, vx: (Math.random() - 0.5) * 0.1, vy: -0.02 + Math.random() * 0.06, size: 2 + Math.random() * 2, alpha: 0.06 + Math.random() * 0.08, type: 'mist', phase: Math.random() * Math.PI * 2 };
  } else { // golden pollen
    return { x, y, vx: (Math.random() - 0.5) * 0.25, vy: -0.05 + Math.random() * 0.15, size: 1 + Math.random() * 2, alpha: 0.15 + Math.random() * 0.2, type: 'pollen', phase: Math.random() * Math.PI * 2 };
  }
}

function generateTerrainPatches() {
  terrainPatches = [];
  for (let i = 0; i < 6; i++) {
    terrainPatches.push({
      xWorld: Math.random() * W * 3,
      w: 40 + Math.random() * 80,
      shade: (Math.random() - 0.5) * 0.08, // slight brightness variation
    });
  }
}

// ---- Object spawning ----
function spawnObjects() {
  // Prayer flags — max 6 on screen, spawn frequently so player always has something to chase
  const activeFlags = prayerFlags.filter(f => !f.collected).length;
  if (activeFlags < 6 && Math.random() < 0.015) {
    // Spawn flags near the glider's typical altitude range for better collectibility
    const flagY = H * 0.2 + Math.random() * H * 0.45;
    prayerFlags.push({
      x: W + 30 + Math.random() * 80,
      y: flagY,
      collected: false,
      phase: Math.random() * Math.PI * 2,
      colors: ['#1565C0','#F5F5F0','#C62828','#2E7D32','#F9A825'],
    });
  }

  // Eagles — max 3 on screen, appear after 100m, more frequent in later biomes
  if (distance > 100 && eagles.length < 3 && Math.random() < 0.006 + biomeIndex * 0.003) {
    eagles.push({
      x: W + 60,
      y: H * 0.15 + Math.random() * H * 0.45,
      vy: (Math.random() - 0.5) * 0.4,
      speed: 1.5 + Math.random() * (1 + biomeIndex * 0.5),
      nearMissed: false,
      radius: 18,
      wingPhase: 0,
    });
  }

  // Thermals — max 3 on screen, spawn more often so player can use them
  if (thermals.length < 3 && Math.random() < 0.008) {
    const xWorld = terrainOffset + W + 80;
    const groundY = getTerrainY(xWorld, biomeIndex);
    thermals.push({
      x: W + 80 + Math.random() * 80,
      y: groundY - 200,
      height: 180 + Math.random() * 120,
      width: 50 + Math.random() * 40,
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


// ============================================================
// DRAWING — clean, minimal, Alto's Adventure inspired
// 3 principles: gradients only, smooth curves, atmospheric depth
// ============================================================

function drawSky() {
  // Simple clean gradient — no overlaid shapes
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  if (biomeIndex === 0) {
    const phase = ((distance % 600) / 600);
    if (phase < 0.3) { // dawn
      grad.addColorStop(0, '#1A3A6E');
      grad.addColorStop(0.3, '#4A7AB0');
      grad.addColorStop(0.6, '#7AAECC');
      grad.addColorStop(0.85, '#E8B870');
      grad.addColorStop(1, '#F5C87A');
    } else if (phase < 0.7) { // midday
      grad.addColorStop(0, '#1A4A8E');
      grad.addColorStop(0.25, '#2B72BF');
      grad.addColorStop(0.5, '#4A90D9');
      grad.addColorStop(0.75, '#7AB8E8');
      grad.addColorStop(1, '#A8D4F0');
    } else { // sunset
      grad.addColorStop(0, '#2A1A5E');
      grad.addColorStop(0.2, '#6A3A8E');
      grad.addColorStop(0.4, '#C05878');
      grad.addColorStop(0.65, '#E88050');
      grad.addColorStop(0.85, '#F0A840');
      grad.addColorStop(1, '#E8C060');
    }
  } else if (biomeIndex === 1) {
    // Pine Forest — deep twilight, cool greens and teals, moody
    const phase1 = ((distance % 800) / 800);
    if (phase1 < 0.5) { // dusky blue-green
      grad.addColorStop(0, '#0A1A2A');
      grad.addColorStop(0.2, '#122838');
      grad.addColorStop(0.45, '#1A4050');
      grad.addColorStop(0.7, '#2A6060');
      grad.addColorStop(1, '#3A7868');
    } else { // misty grey-green
      grad.addColorStop(0, '#101820');
      grad.addColorStop(0.25, '#1A2838');
      grad.addColorStop(0.5, '#284048');
      grad.addColorStop(0.75, '#385858');
      grad.addColorStop(1, '#4A7068');
    }
  } else if (biomeIndex === 2) {
    grad.addColorStop(0, '#2060A0');
    grad.addColorStop(0.3, '#5090C8');
    grad.addColorStop(0.6, '#88B8E0');
    grad.addColorStop(1, '#C0D8F0');
  } else {
    grad.addColorStop(0, '#080818');
    grad.addColorStop(0.3, '#10002b');
    grad.addColorStop(0.6, '#1A0840');
    grad.addColorStop(1, '#2A1858');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Sun with visible disc + glow + lens flare
  if (biomeIndex < 3) {
    const phase = ((distance % 600) / 600);
    const sunX = W * (0.6 + phase * 0.25);
    const sunY = H * 0.12;
    // Dim sun in Pine Forest (canopy blocks light)
    const sunBrightness = biomeIndex === 1 ? 0.3 : 1.0;
    // Outer glow
    const sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, H * 0.3);
    sg.addColorStop(0, `rgba(255,255,240,${0.4 * sunBrightness})`);
    sg.addColorStop(0.2, `rgba(255,240,200,${0.15 * sunBrightness})`);
    sg.addColorStop(0.5, `rgba(255,220,180,${0.04 * sunBrightness})`);
    sg.addColorStop(1, 'rgba(255,220,180,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, H * 0.5);
    // Bright disc
    ctx.save();
    ctx.globalAlpha = 0.6 * sunBrightness;
    ctx.fillStyle = biomeIndex === 1 ? 'rgba(200,220,210,1)' : 'rgba(255,252,240,1)';
    ctx.beginPath();
    ctx.arc(sunX, sunY, biomeIndex === 1 ? 7 : 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.3 * sunBrightness;
    ctx.fillStyle = biomeIndex === 1 ? 'rgba(200,220,210,1)' : 'rgba(255,250,230,1)';
    ctx.beginPath();
    ctx.arc(sunX, sunY, biomeIndex === 1 ? 12 : 16, 0, Math.PI * 2);
    ctx.fill();
    // Subtle lens flare dots
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#FFF8E0';
    const cx = W * 0.5, cy = H * 0.5;
    for (let f = 1; f <= 3; f++) {
      const fx = sunX + (cx - sunX) * f * 0.25;
      const fy = sunY + (cy - sunY) * f * 0.25;
      ctx.beginPath();
      ctx.arc(fx, fy, 4 + f * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Stars for above-clouds biome only
  if (biomeIndex === 3) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 80; i++) {
      const sx = ((i * 137.5 + distance * 0.01) % W);
      const sy = (i * 97.3) % (H * 0.4);
      ctx.beginPath();
      ctx.arc(sx, sy, 0.5 + (i % 3) * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBackMountains() {
  const bi = Math.min(biomeIndex, 3);
  const segW = 4;
  const totalW = farMountains.length * segW;

  // Helper: draw a smooth ridge from noise points
  function drawRidge(points, scroll, baseY, topCol, botCol, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const g = ctx.createLinearGradient(0, H * 0.15, 0, baseY);
    g.addColorStop(0, topCol);
    g.addColorStop(1, botCol);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let x = 0; x <= W; x += segW) {
      const wi = (Math.floor((x + scroll) / segW) % points.length + points.length) % points.length;
      ctx.lineTo(x, points[wi]);
    }
    ctx.lineTo(W, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Colors per biome: [far, mid, near]
  const palettes = [
    { far: ['#7888A0','#90A0B8'], mid: ['#3A6B48','#4A8858'], near: ['#1A4025','#286838'] },
    { far: ['#2A3840','#384848'], mid: ['#0E2818','#183828'], near: ['#081A10','#102818'] }, // Pine Forest — much darker, cooler
    { far: ['#7888A8','#A0B0C8'], mid: ['#5868A0','#7888B8'], near: ['#4060A0','#608AB8'] },
    { far: ['#181030','#201840'], mid: ['#201838','#281E48'], near: ['#140C28','#1C1238'] },
  ][bi];

  // Layer 1: Far peaks — faint, hazy
  drawRidge(farMountains, distance * 0.02, H * 0.55, palettes.far[0], palettes.far[1], 0.5);

  // Layer 2: Mid range — the main mountains
  drawRidge(backMountains, distance * 0.07, H * 0.68, palettes.mid[0], palettes.mid[1], 0.9);

  // Layer 3: Near treeline (biomes 0-1 only)
  if (bi <= 1) {
    ctx.save();
    ctx.globalAlpha = 0.95;
    const tg = ctx.createLinearGradient(0, H * 0.52, 0, H * 0.72);
    tg.addColorStop(0, palettes.near[0]);
    tg.addColorStop(1, palettes.near[1]);
    ctx.fillStyle = tg;
    const ts = distance * 0.14;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.72);
    for (let x = 0; x <= W; x += 4) {
      const n = fbm((x + ts) * 0.002 + 350, 3, 0.5) * H * 0.06;
      const tip = fbm((x + ts) * 0.01 + 700, 2, 0.4) * 4;
      ctx.lineTo(x, H * 0.58 + n - tip);
    }
    ctx.lineTo(W, H * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawMidLayer() {
  // Biome 2/3 get rocky outcrops or cloud floor
  if (biomeIndex === 2) {
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#5A6878';
    const s = distance * 0.15;
    for (let i = 0; i < 8; i++) {
      const rx = ((i * W * 0.3 - s) % (W * 2.5) + W * 2.5) % (W * 2.5);
      const rh = 8 + (i % 3) * 6;
      ctx.beginPath();
      ctx.moveTo(rx - 12, H * 0.74);
      ctx.quadraticCurveTo(rx, H * 0.74 - rh, rx + 14, H * 0.74);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  } else if (biomeIndex === 3) {
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = 'rgba(180,160,210,0.3)';
    for (let i = 0; i < 6; i++) {
      const cx = ((i * W * 0.35 - distance * 0.05) % (W * 2) + W * 2) % (W * 2);
      ctx.beginPath();
      ctx.ellipse(cx, H * 0.78, 70, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  // Ground-level mist — soft ellipses near terrain (biomes 0-1)
  if (biomeIndex <= 1) {
    ctx.save();
    const mistColor = biomeIndex === 0 ? 'rgba(220,230,240,' : 'rgba(140,170,150,';
    const mistCount = biomeIndex === 1 ? 7 : 4; // More mist in pine forest
    const mistAlphaBase = biomeIndex === 1 ? 0.06 : 0.04;
    const ms = distance * 0.12;
    for (let i = 0; i < mistCount; i++) {
      const mx = ((i * W * 0.45 + 80 - ms) % (W * 2.5) + W * 2.8) % (W * 2.5) - W * 0.15;
      ctx.globalAlpha = mistAlphaBase + (i % 2) * 0.03;
      ctx.fillStyle = mistColor + '0.5)';
      ctx.beginPath();
      ctx.ellipse(mx, H * 0.74 - (biomeIndex === 1 ? i * 5 : 0), 80 + i * 20, 10 + i * 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawTerrain() {
  // ── Main terrain fill ── (apply terrainOffset for sub-pixel smooth scrolling)
  const tOff = terrainOffset;
  ctx.beginPath();
  ctx.moveTo(-10, H);
  for (let i = 0; i < terrainPoints.length; i++) {
    ctx.lineTo(i * TERRAIN_SEGMENT_W + tOff, terrainPoints[i]);
  }
  ctx.lineTo(W + 20, H);
  ctx.closePath();

  const bi = Math.min(biomeIndex, 3);
  const g = ctx.createLinearGradient(0, H * 0.6, 0, H);
  if (bi === 0) {
    g.addColorStop(0, '#2A7A30');
    g.addColorStop(0.3, '#4A9A48');
    g.addColorStop(0.6, '#88A048');
    g.addColorStop(1, '#C09028');
  } else if (bi === 1) {
    // Pine Forest — very dark forest floor with earthy browns
    g.addColorStop(0, '#0E2A12');
    g.addColorStop(0.3, '#142A14');
    g.addColorStop(0.6, '#1A2810');
    g.addColorStop(1, '#2A2818');
  } else if (bi === 2) {
    g.addColorStop(0, '#A0B0C0');
    g.addColorStop(0.5, '#C8D4E0');
    g.addColorStop(1, '#E8EEF5');
  } else {
    g.addColorStop(0, '#9080B0');
    g.addColorStop(0.5, '#8070A0');
    g.addColorStop(1, '#706090');
  }
  ctx.fillStyle = g;
  ctx.fill();

  // ── Subtle ground color variation — soft organic patches below the ridge ──
  if (bi <= 1) {
    ctx.save();
    const scroll = distance;
    for (const cp of cropPatches) {
      const sx = ((cp.x - scroll * 0.95) % (W * 2.5) + W * 3) % (W * 2.5) - W * 0.25;
      if (sx < -100 || sx > W + 100) continue;
      const ty = getTerrainYAtX(sx + cp.w) + 10;
      const pw = cp.w * 2;
      const ph = cp.h * 2;
      ctx.globalAlpha = cp.isMustard ? 0.12 : 0.08;
      ctx.fillStyle = cp.isMustard
        ? (bi === 0 ? '#B89828' : '#607030')
        : (bi === 0 ? '#1A5A20' : '#0E3810');
      // Soft ellipse — no hard edges
      ctx.beginPath();
      ctx.ellipse(sx + pw * 0.5, ty + ph * 0.5, pw * 0.5, ph * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (bi === 2) {
    // Snow: subtle rocky color patches
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#8898B0';
    for (let i = 0; i < 5; i++) {
      const px = ((i * W * 0.5 - distance * 0.3) % (W * 2.5) + W * 3) % (W * 2.5) - W * 0.25;
      const py = getTerrainYAtX(px) + 20 + i * 8;
      ctx.beginPath();
      ctx.ellipse(px, py, 50 + i * 15, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Grass texture strokes along ridgeline (biomes 0-1) ──
  if (bi <= 1) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = bi === 0 ? '#1A5A20' : '#0E3510';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    const step = 8;
    for (let x = 0; x < W; x += step) {
      const idx = Math.floor((x - tOff) / TERRAIN_SEGMENT_W);
      if (idx < 0 || idx >= terrainPoints.length) continue;
      const ty = terrainPoints[idx];
      const sx = idx * TERRAIN_SEGMENT_W + tOff;
      for (let b = 0; b < 3; b++) {
        const bx = sx + b * 3 - 3;
        const worldX = Math.floor(bx + distance);
        const bh = 5 + ((worldX * 31) % 6);
        const lean = ((worldX * 17) % 7 - 3) * 0.6;
        ctx.beginPath();
        ctx.moveTo(bx, ty);
        ctx.lineTo(bx + lean, ty - bh);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ── Snow texture (biome 2) ──
  if (bi === 2) {
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < terrainPoints.length; i++) {
      const sx = i * TERRAIN_SEGMENT_W + tOff;
      if (sx < -10 || sx > W + 10 || i % 2 !== 0) continue;
      const ty = terrainPoints[i];
      ctx.beginPath();
      ctx.ellipse(sx, ty - 1, 8 + ((i * 13) % 6), 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Scattered rocks
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#5A6878';
    for (let i = 0; i < terrainPoints.length; i += 8) {
      const sx = i * TERRAIN_SEGMENT_W + tOff;
      if (sx < -10 || sx > W + 10) continue;
      const ty = terrainPoints[i];
      const rw = 4 + ((i * 7) % 6);
      ctx.beginPath();
      ctx.ellipse(sx + 10, ty + 15 + ((i * 11) % 10), rw, rw * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Ridgeline highlight ──
  ctx.strokeStyle = bi === 2 ? 'rgba(255,255,255,0.25)' : bi === 3 ? 'rgba(160,140,200,0.1)' : 'rgba(180,230,140,0.18)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i < terrainPoints.length; i++) {
    const sx = i * TERRAIN_SEGMENT_W + tOff;
    if (i === 0) ctx.moveTo(sx, terrainPoints[0]);
    else ctx.lineTo(sx, terrainPoints[i]);
  }
  ctx.stroke();

  // ── Dark shadow just below the ridge (creates depth/contour) ──
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.strokeStyle = bi <= 1 ? '#0A2010' : bi === 2 ? '#4060A0' : '#201040';
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let i = 0; i < terrainPoints.length; i++) {
    const sx = i * TERRAIN_SEGMENT_W + tOff;
    if (i === 0) ctx.moveTo(sx, terrainPoints[0] + 5);
    else ctx.lineTo(sx, terrainPoints[i] + 5);
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

// ---- Environment Drawing ----

function drawFarSkyDecorations() {
  const bi = Math.min(biomeIndex, 3);
  for (const d of skyDecorations) {
    if (d.type === 'balloon' && bi <= 1) {
      const screenX = ((d.x - distance * 0.04) % (W * 2) + W * 2.5) % (W * 2.5) - W * 0.25;
      const bobY = d.y + Math.sin(d.bobPhase + gameTime * 0.02) * 4;
      const s = d.size;
      ctx.save();
      ctx.globalAlpha = 0.5;
      // Envelope
      ctx.beginPath();
      ctx.moveTo(screenX, bobY - s);
      ctx.bezierCurveTo(screenX - s * 0.6, bobY - s * 0.6, screenX - s * 0.5, bobY + s * 0.2, screenX, bobY + s * 0.4);
      ctx.bezierCurveTo(screenX + s * 0.5, bobY + s * 0.2, screenX + s * 0.6, bobY - s * 0.6, screenX, bobY - s);
      ctx.fillStyle = d.color1;
      ctx.fill();
      // Stripe
      ctx.beginPath();
      ctx.ellipse(screenX, bobY - s * 0.1, s * 0.35, s * 0.15, 0, 0, Math.PI * 2);
      ctx.fillStyle = d.color2;
      ctx.fill();
      // Basket
      ctx.fillStyle = 'rgba(80,60,40,0.6)';
      ctx.fillRect(screenX - 3, bobY + s * 0.5, 6, 4);
      // Lines
      ctx.strokeStyle = 'rgba(80,60,40,0.3)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(screenX - 2, bobY + s * 0.4); ctx.lineTo(screenX - 3, bobY + s * 0.5);
      ctx.moveTo(screenX + 2, bobY + s * 0.4); ctx.lineTo(screenX + 3, bobY + s * 0.5);
      ctx.stroke();
      ctx.restore();
    }
    if (d.type === 'birdFlock') {
      const screenX = ((d.x - distance * 0.03) % (W * 2) + W * 2.5) % (W * 2.5) - W * 0.25;
      d.wingPhase += 0.04;
      ctx.save();
      ctx.globalAlpha = bi >= 3 ? 0.3 : 0.35;
      ctx.strokeStyle = bi >= 2 ? 'rgba(200,210,230,0.6)' : 'rgba(40,30,20,0.5)';
      ctx.lineWidth = 1;
      for (let b = 0; b < d.count; b++) {
        // V-formation offset
        const row = Math.floor(b / 2) + 1;
        const side = b % 2 === 0 ? -1 : 1;
        const bx = screenX + (b === 0 ? 0 : side * row * d.spacing);
        const by = d.y + (b === 0 ? 0 : row * d.spacing * 0.4);
        const wing = Math.sin(d.wingPhase + b * 0.3) * 3;
        ctx.beginPath();
        ctx.moveTo(bx - 4, by + wing);
        ctx.quadraticCurveTo(bx, by - 1, bx + 4, by + wing);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

function drawClouds() {
  const bi = Math.min(biomeIndex, 3);
  const fillColor = bi === 3 ? 'rgba(140,120,180,' : 'rgba(255,255,255,';
  for (const c of clouds) {
    const screenX = ((c.x - distance * c.speed) % (W * 2.5) + W * 3) % (W * 2.5) - W * 0.25;
    if (screenX < -c.w - 50 || screenX > W + c.w + 50) continue;
    ctx.save();
    ctx.globalAlpha = c.alpha;
    if (c.lobes) {
      // Multi-lobe cumulus shape
      // Flat bottom base
      ctx.fillStyle = fillColor + '0.25)';
      ctx.beginPath();
      ctx.ellipse(screenX, c.y + 2, c.w * 0.5, c.h * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Individual lobes — overlapping circles for bumpy top
      ctx.fillStyle = fillColor + '0.35)';
      for (const lobe of c.lobes) {
        ctx.beginPath();
        ctx.ellipse(screenX + lobe.offsetX, c.y + lobe.offsetY, lobe.rx, lobe.ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Bright highlight on top-center lobe
      const centerLobe = c.lobes[Math.floor(c.lobes.length / 2)];
      ctx.fillStyle = fillColor + '0.15)';
      ctx.beginPath();
      ctx.ellipse(screenX + centerLobe.offsetX, c.y + centerLobe.offsetY - 3, centerLobe.rx * 0.6, centerLobe.ry * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Fallback: simple ellipse
      ctx.fillStyle = fillColor + '0.4)';
      ctx.beginPath();
      ctx.ellipse(screenX, c.y, c.w * 0.5, c.h, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawGroundSilhouettes() {
  const bi = Math.min(biomeIndex, 3);
  const colors = [
    'rgba(20,50,25,0.7)',   // biome 0 — dark green
    'rgba(15,35,15,0.8)',   // biome 1 — darker forest
    'rgba(60,70,85,0.6)',   // biome 2 — grey-blue rock
    'rgba(40,20,60,0.5)',   // biome 3 — dark purple
  ];

  for (const s of groundSilhouettes) {
    const screenX = s.xWorld - distance + W * 0.5;
    if (screenX < -60 || screenX > W + 60) continue;
    const baseY = getTerrainYAtX(screenX);
    ctx.save();
    ctx.fillStyle = colors[s.forBiome] || colors[bi];

    switch (s.type) {
      case 'deodar': { // Triangle with concave sides + branch tiers
        const h = s.h, w = s.w;
        ctx.beginPath();
        ctx.moveTo(screenX, baseY - h);
        ctx.quadraticCurveTo(screenX + w * 0.15, baseY - h * 0.6, screenX + w * 0.5, baseY);
        ctx.lineTo(screenX - w * 0.5, baseY);
        ctx.quadraticCurveTo(screenX - w * 0.15, baseY - h * 0.6, screenX, baseY - h);
        ctx.fill();
        // Trunk
        ctx.fillRect(screenX - 1.5, baseY - 3, 3, 3);
        break;
      }
      case 'tallpine': { // Tall layered pine — 3-5 branch tiers, visible trunk
        const h = s.h, w = s.w;
        // Trunk
        ctx.fillRect(screenX - 2, baseY - h * 0.3, 4, h * 0.3);
        // Branch tiers — widest at bottom, narrowing to top
        const tiers = 3 + Math.floor(s.seed % 3); // 3-5 tiers
        for (let t = 0; t < tiers; t++) {
          const tierFrac = t / tiers;
          const tierY = baseY - h * 0.25 - tierFrac * h * 0.75;
          const tierW = w * (1 - tierFrac * 0.6) * 0.5;
          const tierH = h * 0.22;
          ctx.beginPath();
          ctx.moveTo(screenX, tierY - tierH);
          ctx.lineTo(screenX + tierW, tierY);
          ctx.lineTo(screenX - tierW, tierY);
          ctx.closePath();
          ctx.fill();
        }
        // Pointed tip
        ctx.beginPath();
        ctx.moveTo(screenX, baseY - h);
        ctx.lineTo(screenX + w * 0.08, baseY - h * 0.85);
        ctx.lineTo(screenX - w * 0.08, baseY - h * 0.85);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'stupa': { // Narrow base + dome + spire
        const h = s.h, w = s.w;
        ctx.beginPath();
        // Base
        ctx.fillRect(screenX - w * 0.4, baseY - h * 0.35, w * 0.8, h * 0.35);
        // Dome
        ctx.beginPath();
        ctx.arc(screenX, baseY - h * 0.35, w * 0.4, Math.PI, 0);
        ctx.fill();
        // Spire
        ctx.fillRect(screenX - 0.8, baseY - h, 1.6, h * 0.55);
        break;
      }
      case 'house': { // Rectangle + triangular roof
        const h = s.h, w = s.w * 1.4;
        ctx.fillRect(screenX - w * 0.5, baseY - h * 0.6, w, h * 0.6);
        ctx.beginPath();
        ctx.moveTo(screenX - w * 0.55, baseY - h * 0.6);
        ctx.lineTo(screenX, baseY - h);
        ctx.lineTo(screenX + w * 0.55, baseY - h * 0.6);
        ctx.fill();
        break;
      }
      case 'cabin': { // Smaller house
        const h = s.h, w = s.w * 1.2;
        ctx.fillRect(screenX - w * 0.5, baseY - h * 0.55, w, h * 0.55);
        ctx.beginPath();
        ctx.moveTo(screenX - w * 0.55, baseY - h * 0.55);
        ctx.lineTo(screenX, baseY - h);
        ctx.lineTo(screenX + w * 0.55, baseY - h * 0.55);
        ctx.fill();
        break;
      }
      case 'bush': { // Bumpy arc
        const h = s.h, w = s.w * 1.2;
        ctx.beginPath();
        ctx.moveTo(screenX - w * 0.5, baseY);
        ctx.quadraticCurveTo(screenX - w * 0.25, baseY - h * 1.2, screenX, baseY - h);
        ctx.quadraticCurveTo(screenX + w * 0.25, baseY - h * 1.2, screenX + w * 0.5, baseY);
        ctx.fill();
        break;
      }
      case 'rock': case 'boulder': { // Irregular polygon
        const h = s.h, w = s.w;
        const seed = s.seed;
        ctx.beginPath();
        ctx.moveTo(screenX - w * 0.4, baseY);
        ctx.lineTo(screenX - w * 0.5, baseY - h * 0.4);
        ctx.lineTo(screenX - w * 0.1 + (seed % 5), baseY - h);
        ctx.lineTo(screenX + w * 0.3 - (seed % 3), baseY - h * 0.7);
        ctx.lineTo(screenX + w * 0.5, baseY - h * 0.2);
        ctx.lineTo(screenX + w * 0.35, baseY);
        ctx.fill();
        break;
      }
      case 'ice': { // Angular ice pillar
        const h = s.h, w = s.w * 0.6;
        ctx.fillStyle = 'rgba(160,190,220,0.5)';
        ctx.beginPath();
        ctx.moveTo(screenX - w * 0.3, baseY);
        ctx.lineTo(screenX - w * 0.15, baseY - h);
        ctx.lineTo(screenX + w * 0.2, baseY - h * 0.85);
        ctx.lineTo(screenX + w * 0.35, baseY);
        ctx.fill();
        break;
      }
      case 'spire': case 'crystal': { // Ethereal crystalline
        const h = s.h, w = s.w * 0.5;
        ctx.fillStyle = 'rgba(100,70,140,0.4)';
        ctx.beginPath();
        ctx.moveTo(screenX - w * 0.2, baseY);
        ctx.lineTo(screenX, baseY - h);
        ctx.lineTo(screenX + w * 0.25, baseY);
        ctx.fill();
        // Secondary crystal
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.moveTo(screenX + w * 0.3, baseY);
        ctx.lineTo(screenX + w * 0.2, baseY - h * 0.6);
        ctx.lineTo(screenX + w * 0.5, baseY);
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  // Best distance marker
  if (bestDistanceMarker && personalBest > 0) {
    const markerScreenX = bestDistanceMarker.worldX - distance + W * 0.5;
    if (markerScreenX > -20 && markerScreenX < W + 20) {
      const markerBaseY = getTerrainYAtX(markerScreenX);
      ctx.save();
      // Pole
      ctx.strokeStyle = 'rgba(180,150,60,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(markerScreenX, markerBaseY);
      ctx.lineTo(markerScreenX, markerBaseY - 28);
      ctx.stroke();
      // Flag pennant
      ctx.fillStyle = 'rgba(220,180,50,0.85)';
      ctx.beginPath();
      ctx.moveTo(markerScreenX, markerBaseY - 28);
      ctx.lineTo(markerScreenX + 14, markerBaseY - 24);
      ctx.lineTo(markerScreenX, markerBaseY - 20);
      ctx.fill();
      // Subtle glow
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(markerScreenX, markerBaseY - 24, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Check if player just passed it
      if (!bestDistanceMarker.passed && distance > bestDistanceMarker.worldX) {
        bestDistanceMarker.passed = true;
        flashScreen('rgba(255,215,0,0.15)');
      }
    }
  }
}

function drawAmbientParticles() {
  const bi = Math.min(biomeIndex, 3);
  const t = gameTime;
  for (const p of ambientParticles) {
    ctx.save();
    let a = p.alpha;
    if (p.type === 'star') {
      a *= 0.5 + 0.5 * Math.sin(t * 0.08 + p.phase); // twinkle
    }
    ctx.globalAlpha = a;
    if (p.type === 'pollen') {
      ctx.fillStyle = 'rgba(210,190,120,1)';
    } else if (p.type === 'dust') {
      ctx.fillStyle = 'rgba(120,160,90,1)';
    } else if (p.type === 'mist') {
      ctx.fillStyle = 'rgba(160,190,170,1)';
    } else if (p.type === 'snow') {
      ctx.fillStyle = 'rgba(240,245,255,1)';
    } else { // star / firefly
      ctx.fillStyle = 'rgba(220,210,255,1)';
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function updateAmbientParticles() {
  // Regenerate if biome changed
  if (biomeIndex !== lastBiomeForAmbient) {
    generateAmbientParticles();
  }
  for (const p of ambientParticles) {
    p.x += p.vx - scrollSpeed * 0.08;
    p.y += p.vy;
    p.phase += 0.03;
    // Wrap around
    if (p.x < -10) p.x = W + 10;
    if (p.x > W + 10) p.x = -10;
    if (p.y < -10) p.y = H + 10;
    if (p.y > H + 10) p.y = -10;
  }
}

function updateGroundSilhouettes() {
  const bi = Math.min(biomeIndex, 3);
  for (const s of groundSilhouettes) {
    const screenX = s.xWorld - distance + W * 0.5;
    if (screenX < -100) {
      // Recycle: respawn at right with current biome type
      s.xWorld = distance + W + 50 + Math.random() * 200;
      const types = [
        ['deodar','deodar','stupa','bush','house','bush'],
        ['tallpine','tallpine','tallpine','tallpine','deodar','rock','cabin'],
        ['rock','rock','rock','boulder','ice'],
        ['spire','spire','crystal'],
      ][bi];
      s.type = types[Math.floor(Math.random() * types.length)];
      const baseH = { deodar: 25, tallpine: 50, stupa: 20, bush: 8, house: 18, rock: 14, cabin: 16, boulder: 12, ice: 22, spire: 30, crystal: 18 }[s.type] || 15;
      s.h = baseH + Math.random() * baseH * 0.6;
      s.w = baseH * (0.4 + Math.random() * 0.4);
      s.seed = Math.random() * 1000;
      s.forBiome = bi;
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawSky();
  drawFarSkyDecorations();
  drawBackMountains();
  drawClouds();
  drawMidLayer();
  drawThermals();
  drawPrayerFlags();
  drawEagles();
  drawTerrain();
  drawGroundSilhouettes();
  drawGlider();
  drawParticles();
  drawAmbientParticles();
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
    if (Math.abs(gliderX - f.x) < 45 && Math.abs(gliderY - f.y) < 40) {
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

  // Altitude relative to terrain — 0m at ground, scales so top of screen ≈ 5000m
  const groundY = getTerrainYAtX(gliderX);
  altitudeM = Math.max(0, Math.floor((groundY - gliderY) / H * 6000));
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
  updateGroundSilhouettes();
  updateAmbientParticles();

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
  document.getElementById('hudScore').textContent = totalScore.toLocaleString();
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
  // Pinned goal — show first incomplete goal, or last completed
  const pinned = document.getElementById('goalsPinned');
  if (!pinned) return;
  const nextGoal = goals.find(g => !goalProgress[g.id]);
  if (nextGoal) {
    pinned.textContent = '★ ' + nextGoal.text;
  } else if (goals.length > 0) {
    pinned.textContent = '✓ All goals complete!';
  } else {
    pinned.textContent = '';
  }
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
  generateGroundSilhouettes();
  generateSkyDecorations();
  generateAmbientParticles();
  generateTerrainPatches();
  bestDistanceMarker = personalBest > 0 ? { worldX: personalBest, passed: false } : null;

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
  // Zen mode indicator
  const zenBadge = document.getElementById('hudZenBadge');
  if (zenBadge) zenBadge.classList.toggle('hidden', !zenMode);
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
  // Resize menu canvas before drawing (it was hidden, so dimensions may be 0)
  const mb = document.getElementById('menuBgCanvas');
  if (mb && mb.parentElement) {
    mb.width = mb.parentElement.offsetWidth;
    mb.height = mb.parentElement.offsetHeight;
  }
  // Restart menu background animation
  animateMenuBg();
}

function showGameOver() {
  const screen = document.getElementById('gameoverScreen');
  screen.classList.remove('hidden');

  const titleEl = document.getElementById('gameoverTitle');
  const subEl = document.getElementById('gameoverSubtitle');
  const iconEl = document.getElementById('gameoverIcon');

  if (isNewBest) {
    titleEl.textContent = 'New Record!';
    subEl.textContent = 'You soared further than ever before.';
    if (iconEl) iconEl.textContent = '🏆';
  } else if (crashReason === 'crashed') {
    titleEl.textContent = 'Crashed!';
    subEl.textContent = 'An eagle clipped your wing. Try again!';
    if (iconEl) iconEl.textContent = '🦅';
  } else {
    titleEl.textContent = 'Landed';
    subEl.textContent = 'The mountain is patient. Fly again.';
    if (iconEl) iconEl.textContent = '🏔️';
  }

  // Itemized score breakdown
  const distPts = Math.floor(distance);
  document.getElementById('sbDistance').textContent = distPts.toLocaleString();
  document.getElementById('sbFlags').textContent = totalFlagScore > 0 ? '+' + totalFlagScore.toLocaleString() : '+0';
  document.getElementById('sbNearMiss').textContent = totalNearMissBonus > 0 ? '+' + totalNearMissBonus.toLocaleString() : '+0';
  document.getElementById('sbAltBonus').textContent = altitudeMilestoneBonus > 0 ? '+' + altitudeMilestoneBonus.toLocaleString() : '+0';
  document.getElementById('sbTotal').textContent = totalScore.toLocaleString();

  // Hide zero-value bonus rows
  document.getElementById('sbFlagsRow').className = totalFlagScore > 0 ? 'score-row' : 'score-row hidden-row';
  document.getElementById('sbNearMissRow').className = totalNearMissBonus > 0 ? 'score-row' : 'score-row hidden-row';
  document.getElementById('sbAltRow').className = altitudeMilestoneBonus > 0 ? 'score-row' : 'score-row hidden-row';

  // Details line
  const biomeName = BIOMES[biomeIndex].name;
  const detailDist = document.getElementById('statDistanceDetail');
  const detailAlt = document.getElementById('statAltDetail');
  const detailBiome = document.getElementById('statBiomeDetail');
  if (detailDist) detailDist.textContent = Math.floor(distance) + 'm';
  if (detailAlt) detailAlt.textContent = maxAltitudeM + 'm alt';
  if (detailBiome) detailBiome.textContent = biomeName;

  // Gap to best
  const gap = personalBest - Math.floor(distance);
  if (!isNewBest && gap > 0) {
    document.getElementById('gapToBest').innerHTML = `You were <strong>${gap}m</strong> from your record`;
  } else {
    document.getElementById('gapToBest').textContent = '';
  }

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
  if (gameState === 'paused') { resumeGame(); return; }
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
  document.getElementById('pauseScore').textContent = totalScore.toLocaleString() + ' pts';
  // Show goals in pause
  const pauseGoalsEl = document.getElementById('pauseGoals');
  if (pauseGoalsEl) {
    pauseGoalsEl.innerHTML = goals.map(g => {
      const done = goalProgress[g.id];
      return `<div class="pause-goal-item ${done ? 'pause-goal-done' : 'pause-goal-pending'}">${done ? '✓' : '○'} ${g.text}</div>`;
    }).join('');
  }
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
