// ================================================
// BIR GLIDER — Main Game Script
// GameLayout provides: window.apiClient, window.authManager,
//   shared JS (api-client.js, auth.js, game-cloud.js, game-header.js)
// ================================================

// ---- State ----
let currentUser = null;
let gameState = 'menu'; // menu | playing | paused | gameover
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
let midTrees = [];
let clouds = [];

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
  const segW = 4;
  const totalW = W * 3;
  const segs = Math.ceil(totalW / segW);

  // Far Dhauladhar ridge (smooth rolling profile)
  for (let i = 0; i <= segs; i++) {
    const x = i * segW;
    const n = fbm(x * 0.0008 + 50, 3, 0.5);
    farMountains.push(H * 0.22 + n * H * 0.18);
  }
  // Mid forest ridge
  for (let i = 0; i <= segs; i++) {
    const x = i * segW;
    const n = fbm(x * 0.0012 + 200, 3, 0.5);
    backMountains.push(H * 0.42 + n * H * 0.14);
  }
}

function generateMidTrees() {
  midTrees = [];
  for (let i = 0; i < 50; i++) {
    midTrees.push({
      x: Math.random() * W * 3,
      height: 25 + Math.random() * 50,
    });
  }
}

// ---- Object spawning ----
function spawnObjects() {
  // Prayer flags — every 200-350m equivalent pixels
  if (Math.random() < 0.012) {
    const xWorld = terrainOffset + W + 50;
    const groundY = getTerrainY(xWorld, biomeIndex);
    const h = 30 + Math.random() * 60;
    prayerFlags.push({
      x: W + 50 + Math.random() * 100,
      y: groundY - h,
      collected: false,
      phase: Math.random() * Math.PI * 2,
      colors: ['#e63946','#f4a261','#2a9d8f','#e9c46a','#264653'],
    });
  }

  // Eagles — appear after 200m
  if (distance > 200 && Math.random() < 0.008 + biomeIndex * 0.002) {
    const yRand = H * 0.2 + Math.random() * H * 0.5;
    eagles.push({
      x: W + 60,
      y: yRand,
      vy: (Math.random() - 0.5) * 0.5,
      speed: 1.5 + Math.random() * biomeIndex * 0.5,
      nearMissed: false,
      radius: 18,
      wingPhase: 0,
    });
  }

  // Thermals — every ~300px
  if (Math.random() < 0.009) {
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
  ctx.fillStyle = getSkyGradient(ctx, biomeIndex, distance);
  ctx.fillRect(0, 0, W, H);

  const phase = ((distance % 600) / 600);

  // Sun glow
  if (biomeIndex < 3) {
    const sunX = W * 0.65 + phase * W * 0.2;
    const sunY = H * 0.15 + Math.sin(phase * Math.PI) * H * 0.05;
    const sunR = phase > 0.7 ? 150 : 90;
    const sunAlpha = phase > 0.7 ? 0.5 : 0.25;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 5, sunX, sunY, sunR);
    sunGrad.addColorStop(0, `rgba(255,255,220,${sunAlpha})`);
    sunGrad.addColorStop(0.3, `rgba(255,240,180,${sunAlpha * 0.4})`);
    sunGrad.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, W, H);
  }

  // Stars (above clouds)
  if (biomeIndex === 3) {
    for (let i = 0; i < 120; i++) {
      const sx = ((i * 137.5 + distance * 0.01) % W);
      const sy = (i * 97.3) % (H * 0.5);
      const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(distance * 0.003 + i * 2));
      ctx.fillStyle = `rgba(255,255,255,${twinkle})`;
      ctx.beginPath(); ctx.arc(sx, sy, 0.4 + (i % 3) * 0.5, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawBackMountains() {
  const segW = 4;

  // --- Layer 1: Far Dhauladhar range (smooth rolling ridge, very slow parallax) ---
  const farScroll = distance * 0.04;
  const farColors = [
    ['#6A7088', '#8A90A5'], // biome 0: hazy blue-grey (atmospheric perspective)
    ['#4A5565', '#657080'], // biome 1: darker blue-grey
    ['#9AA8B8', '#B8C8D5'], // biome 2: pale icy
    ['#2A2040', '#3A2850'], // biome 3: deep purple
  ];
  const fc = farColors[Math.min(biomeIndex, 3)];

  ctx.save();
  const farGrad = ctx.createLinearGradient(0, H * 0.1, 0, H * 0.55);
  farGrad.addColorStop(0, fc[0]);
  farGrad.addColorStop(1, fc[1]);
  ctx.fillStyle = farGrad;
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.moveTo(-10, H * 0.55);
  for (let i = 0; i <= Math.ceil(W / segW) + 20; i++) {
    const worldI = (Math.floor((i * segW + farScroll) / segW) % farMountains.length + farMountains.length) % farMountains.length;
    ctx.lineTo(i * segW, farMountains[worldI]);
  }
  ctx.lineTo(W + 20, H * 0.55);
  ctx.closePath();
  ctx.fill();

  // Snow highlight on far peaks
  if (biomeIndex < 3) {
    const isSunset = biomeIndex === 0 && ((distance % 600) / 600) > 0.7;
    ctx.fillStyle = isSunset ? 'rgba(232,160,120,0.3)' : 'rgba(240,245,250,0.35)';
    ctx.beginPath();
    ctx.moveTo(-10, H * 0.55);
    for (let i = 0; i <= Math.ceil(W / segW) + 20; i++) {
      const worldI = (Math.floor((i * segW + farScroll) / segW) % farMountains.length + farMountains.length) % farMountains.length;
      const y = farMountains[worldI];
      ctx.lineTo(i * segW, Math.min(y + 20, H * 0.35));
    }
    ctx.lineTo(W + 20, H * 0.55);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // --- Layer 2: Mid mountain ridge (forest-covered, closer) ---
  const midScroll = distance * 0.1;
  const midColors = [
    ['#2D5A27', '#3A7A3F'], // biome 0: forest green
    ['#1A3A17', '#2A5025'], // biome 1: dark forest
    ['#5A6575', '#7A8595'], // biome 2: grey rock
    ['#2A2045', '#3A3060'], // biome 3: purple
  ];
  const mc = midColors[Math.min(biomeIndex, 3)];
  ctx.save();
  const midGrad = ctx.createLinearGradient(0, H * 0.3, 0, H * 0.68);
  midGrad.addColorStop(0, mc[0]);
  midGrad.addColorStop(1, mc[1]);
  ctx.fillStyle = midGrad;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(-10, H * 0.68);
  for (let i = 0; i <= Math.ceil(W / segW) + 20; i++) {
    const worldI = (Math.floor((i * segW + midScroll) / segW) % backMountains.length + backMountains.length) % backMountains.length;
    ctx.lineTo(i * segW, backMountains[worldI]);
  }
  ctx.lineTo(W + 20, H * 0.68);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Atmospheric haze between layers
  if (biomeIndex <= 1) {
    ctx.save();
    const hazeGrad = ctx.createLinearGradient(0, H * 0.4, 0, H * 0.65);
    hazeGrad.addColorStop(0, 'rgba(180,200,220,0)');
    hazeGrad.addColorStop(1, 'rgba(180,200,220,0.12)');
    ctx.fillStyle = hazeGrad;
    ctx.fillRect(0, H * 0.4, W, H * 0.25);
    ctx.restore();
  }
}

function drawMidLayer() {
  const scrollMid = distance * 0.22;
  ctx.save();

  if (biomeIndex === 0 || biomeIndex === 1) {
    // Tree silhouettes on the mid ridge (Alto's style — clean shapes, no detail)
    const treeColor = biomeIndex === 0 ? '#1E4A1E' : '#122E12';
    ctx.fillStyle = treeColor;
    ctx.globalAlpha = 0.85;
    for (const t of midTrees) {
      const tx = ((t.x - scrollMid) % (W * 3) + W * 3) % (W * 3);
      if (tx > W + 40 || tx < -40) continue;
      const baseY = H * 0.64;
      const h = t.height;

      // Smooth pine silhouette with curved edges
      ctx.beginPath();
      ctx.moveTo(tx, baseY - h);
      ctx.bezierCurveTo(tx - h * 0.15, baseY - h * 0.6, tx - h * 0.3, baseY - h * 0.15, tx - h * 0.22, baseY);
      ctx.lineTo(tx + h * 0.22, baseY);
      ctx.bezierCurveTo(tx + h * 0.3, baseY - h * 0.15, tx + h * 0.15, baseY - h * 0.6, tx, baseY - h);
      ctx.closePath();
      ctx.fill();
    }
  } else if (biomeIndex === 2) {
    // Rocky outcrops
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#5A6070';
    for (let i = 0; i < 12; i++) {
      const rx = ((i * W * 0.25 - scrollMid * 0.5) % (W * 3) + W * 3) % (W * 3);
      const rh = 10 + (i % 4) * 8;
      ctx.beginPath();
      ctx.moveTo(rx - 15, H * 0.72);
      ctx.quadraticCurveTo(rx, H * 0.72 - rh, rx + 18, H * 0.72);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    // Cloud floor
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(200,180,230,0.35)';
    for (let i = 0; i < 10; i++) {
      const cx = ((i * W * 0.28 - distance * 0.06) % (W * 3) + W * 3) % (W * 3);
      ctx.beginPath();
      ctx.ellipse(cx, H * 0.76, 90, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 50, H * 0.78, 60, 11, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawTerrain() {
  const t = BIR_PALETTE.terrain[Math.min(biomeIndex, 3)];

  ctx.beginPath();
  ctx.moveTo(-10, H);
  for (let i = 0; i < terrainPoints.length; i++) {
    ctx.lineTo(i * TERRAIN_SEGMENT_W, terrainPoints[i]);
  }
  ctx.lineTo(W + 20, H);
  ctx.closePath();
  const tGrad = ctx.createLinearGradient(0, H * 0.6, 0, H);
  tGrad.addColorStop(0, t.top);
  tGrad.addColorStop(1, t.bottom);
  ctx.fillStyle = tGrad;
  ctx.fill();

  // Subtle ridgeline highlight
  ctx.strokeStyle = biomeIndex === 2 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < terrainPoints.length; i++) {
    if (i === 0) ctx.moveTo(0, terrainPoints[0]);
    else ctx.lineTo(i * TERRAIN_SEGMENT_W, terrainPoints[i]);
  }
  ctx.stroke();
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
  ctx.rotate(Math.max(-0.3, Math.min(0.3, -velocity * 0.03)));

  // Thermal glow
  if (inThermal) {
    const gp = Date.now() * 0.004;
    const gg = ctx.createRadialGradient(0, -5, 8, 0, -5, 45);
    gg.addColorStop(0, `rgba(255,200,80,${0.15 + Math.sin(gp) * 0.08})`);
    gg.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(-50, -35, 100, 65);
  }

  // Canopy — smooth curved paraglider wing
  ctx.beginPath();
  ctx.moveTo(-34, -5);
  ctx.quadraticCurveTo(-22, -28, 0, -30);
  ctx.quadraticCurveTo(22, -28, 34, -5);
  ctx.quadraticCurveTo(22, -10, 0, -12);
  ctx.quadraticCurveTo(-22, -10, -34, -5);
  ctx.closePath();

  // Indian tricolor canopy
  const cg = ctx.createLinearGradient(-34, -30, 34, -5);
  cg.addColorStop(0, '#FF6F00');
  cg.addColorStop(0.2, '#FF8F00');
  cg.addColorStop(0.42, '#FFF3E0');
  cg.addColorStop(0.58, '#FFF3E0');
  cg.addColorStop(0.8, '#2E7D32');
  cg.addColorStop(1, '#1B5E20');
  ctx.fillStyle = cg;
  ctx.fill();

  // Rib lines
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 0.5;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 8, -28 + Math.abs(i) * 2.5);
    ctx.lineTo(i * 8, -10 + Math.abs(i) * 0.5);
    ctx.stroke();
  }

  // Top edge highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-32, -7);
  ctx.quadraticCurveTo(-20, -27, 0, -29);
  ctx.quadraticCurveTo(20, -27, 32, -7);
  ctx.stroke();

  // Lines to harness
  ctx.strokeStyle = 'rgba(80,60,40,0.5)';
  ctx.lineWidth = 0.5;
  [[-18,-7,-4,7],[-7,-10,-1,8],[7,-10,1,8],[18,-7,4,7]].forEach(l => {
    ctx.beginPath(); ctx.moveTo(l[0],l[1]); ctx.lineTo(l[2],l[3]); ctx.stroke();
  });

  // Pilot silhouette
  ctx.fillStyle = '#2C3E50';
  ctx.beginPath();
  ctx.ellipse(0, 12, 5, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1A2A3A';
  ctx.fillRect(-4, 17, 3, 8);
  ctx.fillRect(1, 17, 3, 8);
  ctx.fillStyle = '#E63946';
  ctx.beginPath();
  ctx.arc(0, 5, 4, 0, Math.PI * 2);
  ctx.fill();

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
    endGame(); return;
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
    if (!zenMode && dist2 < 22*22) { endGame(); return; }
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

// ---- Physics ----
const GRAVITY = 0.18, RISE_FORCE = 0.5, THERMAL_BOOST = 0.25, MAX_RISE = 8, MAX_FALL = -6;
function updatePhysics(dt) {
  if (isHolding) velocity += RISE_FORCE; else velocity -= GRAVITY;
  if (inThermal) velocity += THERMAL_BOOST;
  velocity = Math.max(MAX_FALL, Math.min(MAX_RISE, velocity));
  gliderY -= velocity;
  if (gliderY < 60) { gliderY = 60; velocity = Math.min(velocity, 0); }
}

// ---- Game Loop ----
let lastTime = 0;
function gameLoop(ts) {
  animFrameId = requestAnimationFrame(gameLoop);
  const dt = Math.min((ts - lastTime) / 16.67, 3);
  lastTime = ts;
  if (gameState !== 'playing') {
    if (gameState === 'paused') { draw(); } // keep rendering while paused
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
  velocity = 2;
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

  gameState = 'playing';

  initAudio();
  startWind();
  stopZenDrone();
  if (zenMode) startZenDrone();

  animFrameId = requestAnimationFrame(gameLoop);
}

function endGame() {
  if (gameState !== 'playing') return;
  gameState = 'gameover';

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
  gameState = 'menu';
  document.getElementById('gameoverScreen').classList.add('hidden');
  document.getElementById('menuScreen').classList.remove('hidden');
  document.getElementById('hud').style.display = 'none';
  updateMenuBest();
}

function showGameOver() {
  const screen = document.getElementById('gameoverScreen');
  screen.classList.remove('hidden');

  document.getElementById('statDistance').textContent = Math.floor(distance) + 'm';
  document.getElementById('statAltitude').textContent = maxAltitudeM + 'm';
  document.getElementById('statFlags').textContent = prayerFlagsCollected;

  if (isNewBest) {
    document.getElementById('statDistance').classList.add('new-best');
    document.getElementById('gameoverTitle').textContent = 'New Record!';
    document.getElementById('gameoverSubtitle').textContent = 'You soared further than ever before.';
  } else {
    document.getElementById('statDistance').classList.remove('new-best');
    document.getElementById('gameoverTitle').textContent = 'Landed';
    document.getElementById('gameoverSubtitle').textContent = 'The mountain is patient. Fly again.';
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
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight - 50;
  gliderX = W * 0.3;
  if (gameState === 'menu') {
    const mb = document.getElementById('menuBgCanvas');
    mb.width = mb.parentElement.offsetWidth;
    mb.height = mb.parentElement.offsetHeight;
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
