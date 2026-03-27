(() => {
  // ── GAME CONSTANTS ───────────────────────────────────────
  const STARTING_COINS = 40;
  // Bonus coins removed — caused infinite feedback loops with prize scoring
  const DROP_COOLDOWN = 500; // ms
  const COIN_RADIUS = 12;
  const PUSHER_SPEED = 1.2;
  const GRAVITY = 0.15;
  const FRICTION = 0.985;
  const BOUNCE = 0.4;
  const COMBO_WINDOW = 1500; // ms
  const PLATFORM_Y_RATIO = 0.35; // where the platform shelf sits
  const EDGE_BUFFER = 20; // side walls buffer

  // Coin types
  const COIN_TYPES = {
    bronze: { color: '#CD7F32', value: 1, radius: COIN_RADIUS },
    silver: { color: '#C0C0C0', value: 5, radius: COIN_RADIUS },
    gold:   { color: '#FFD700', value: 25, radius: COIN_RADIUS + 2 },
  };

  // Prize types
  const PRIZE_TYPES = {
    star:   { color: '#FFD700', value: 100, symbol: '\u2B50', radius: 14 },
    gem:    { color: '#60a5fa', value: 250, symbol: '\uD83D\uDC8E', radius: 14 },
    crown:  { color: '#f472b6', value: 500, symbol: '\uD83D\uDC51', radius: 16 },
    trophy: { color: '#ffd700', value: 1000, symbol: '\uD83C\uDFC6', radius: 18 },
  };

  // ── GAME STATE ────────────────────────────────────────────
  let canvas, ctx;
  let gameRunning = false;
  let gameStartTime = 0;
  let score = 0;
  let coinsLeft = STARTING_COINS;
  let bestScore = 0;
  let comboCount = 0;
  let maxCombo = 0;
  let lastCollectTime = 0;
  let totalCollected = 0;
  let totalDropped = 0;
  let lastDropTime = 0;
  let sideLosses = 0;
  let soundEnabled = true;
  let mouseX = 0;
  let canvasRect = null;

  // Physics objects
  let coins = [];       // coins on the platform
  let pusherX = 0;      // pusher bar position
  let pusherDir = 1;    // pusher direction
  let platformY = 0;    // Y position of the shelf/pusher
  let platformBottom = 0; // Back wall of the platform (coins can't go past this)
  let platformFront = 0;  // Front lip — coins past this fall into score zone
  let gameWidth = 0;
  let gameHeight = 0;
  let wallLeft = 0;
  let wallRight = 0;
  let frontEdge = 0;    // Y position where coins are collected (below platform front)

  // ── AUTH ──────────────────────────────────────────────────
  let currentUser = null;

  // ── ACHIEVEMENTS ──────────────────────────────────────────
  const ACHIEVEMENTS = {
    'first_cascade':  { name: 'First Drop',     desc: 'Complete your first round',       icon: '\uD83C\uDFAF', xp: 100 },
    'combo_3':        { name: 'Triple!',         desc: 'Get a 3x combo',                  icon: '\uD83D\uDD25', xp: 150 },
    'combo_5':        { name: 'Mega Cascade!',   desc: 'Get a 5x combo',                  icon: '\uD83C\uDF1F', xp: 300 },
    'score_500':      { name: 'Bronze Pusher',   desc: 'Score over 500 points',           icon: '\uD83E\uDE99', xp: 200 },
    'score_2000':     { name: 'Silver Pusher',   desc: 'Score over 2,000 points',         icon: '\uD83E\uDE9C', xp: 400 },
    'score_5000':     { name: 'Gold Pusher',     desc: 'Score over 5,000 points',         icon: '\uD83E\uDE99', xp: 600 },
    'collect_35':     { name: 'Hoarder',         desc: 'Collect 35 coins in one round',   icon: '\uD83D\uDCB0', xp: 300 },
    'perfect_round':  { name: 'No Waste',        desc: 'Lose zero coins off the sides',   icon: '\u2728', xp: 500 },
  };

  const DEFAULT_PLAYER = '{"xp":0,"level":1,"achievements":[]}';

  function safeGetPlayer() {
    try { return JSON.parse(localStorage.getItem('coin-cascade-player') || DEFAULT_PLAYER); }
    catch(e) { return JSON.parse(DEFAULT_PLAYER); }
  }

  function safeSavePlayer(data) {
    try { localStorage.setItem('coin-cascade-player', JSON.stringify(data)); } catch(e) {}
  }

  function escapeHTML(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

  function checkAchievements(gameData) {
    const playerData = safeGetPlayer();
    const newOnes = [];
    const earned = playerData.achievements;

    if (!earned.includes('first_cascade')) newOnes.push('first_cascade');
    if (gameData.maxCombo >= 3 && !earned.includes('combo_3')) newOnes.push('combo_3');
    if (gameData.maxCombo >= 5 && !earned.includes('combo_5')) newOnes.push('combo_5');
    if (gameData.score >= 500 && !earned.includes('score_500')) newOnes.push('score_500');
    if (gameData.score >= 2000 && !earned.includes('score_2000')) newOnes.push('score_2000');
    if (gameData.score >= 5000 && !earned.includes('score_5000')) newOnes.push('score_5000');
    if (gameData.collected >= 35 && !earned.includes('collect_35')) newOnes.push('collect_35');
    if (gameData.sideLosses === 0 && gameData.collected > 0 && !earned.includes('perfect_round')) newOnes.push('perfect_round');

    if (newOnes.length > 0) {
      let bonusXP = 0;
      newOnes.forEach(id => bonusXP += ACHIEVEMENTS[id]?.xp ?? 0);
      playerData.achievements = [...earned, ...newOnes];
      playerData.xp += bonusXP;
      safeSavePlayer(playerData);
    }
    return newOnes;
  }

  // ── XP & LEVELS ──────────────────────────────────────────
  const XP_PER_LEVEL = 500;

  function addXP(amount) {
    const data = safeGetPlayer();
    const prevLevel = Math.floor(data.xp / XP_PER_LEVEL) + 1;
    data.xp += amount;
    const newLevel = Math.floor(data.xp / XP_PER_LEVEL) + 1;
    data.level = newLevel;
    safeSavePlayer(data);
    if (newLevel > prevLevel) {
      showAchievementToast({ name: `Level ${newLevel}!`, icon: '\u2B06\uFE0F', desc: 'Player level up!' });
      showLevelUpEffect();
      playSound('levelup');
    }
    return { xp: data.xp, playerLevel: newLevel, leveledUp: newLevel > prevLevel };
  }

  // ── SOUND ─────────────────────────────────────────────────
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSound(type) {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.value = 0.07;

      switch (type) {
        case 'drop':
          osc.frequency.value = 300 + Math.random() * 100;
          osc.type = 'triangle';
          osc.start(); osc.stop(ctx.currentTime + 0.06);
          break;
        case 'clink':
          osc.frequency.value = 800 + Math.random() * 400;
          osc.type = 'sine';
          gain.gain.value = 0.04;
          osc.start(); osc.stop(ctx.currentTime + 0.04);
          break;
        case 'collect':
          osc.frequency.value = 660 + comboCount * 80;
          osc.type = 'sine';
          osc.start();
          setTimeout(() => { try { osc.frequency.value = 880 + comboCount * 80; } catch(e){} }, 50);
          osc.stop(ctx.currentTime + 0.15);
          break;
        case 'combo':
          osc.type = 'triangle';
          osc.frequency.value = 523;
          osc.start();
          setTimeout(() => { try { osc.frequency.value = 659; } catch(e){} }, 60);
          setTimeout(() => { try { osc.frequency.value = 784; } catch(e){} }, 120);
          setTimeout(() => { try { osc.frequency.value = 1047; } catch(e){} }, 180);
          osc.stop(ctx.currentTime + 0.4);
          break;
        case 'sideloss':
          osc.type = 'sawtooth';
          osc.frequency.value = 150;
          gain.gain.value = 0.04;
          osc.start(); osc.stop(ctx.currentTime + 0.15);
          break;
        case 'levelup':
          osc.type = 'triangle';
          osc.frequency.value = 523;
          osc.start();
          setTimeout(() => { try { osc.frequency.value = 659; } catch(e){} }, 80);
          setTimeout(() => { try { osc.frequency.value = 784; } catch(e){} }, 160);
          osc.stop(ctx.currentTime + 0.5);
          break;
        case 'achievement':
          osc.type = 'sine';
          osc.frequency.value = 880;
          osc.start();
          setTimeout(() => { try { osc.frequency.value = 1100; } catch(e){} }, 100);
          osc.stop(ctx.currentTime + 0.35);
          break;
        case 'fail':
          osc.type = 'sawtooth';
          osc.frequency.value = 200;
          gain.gain.value = 0.05;
          osc.start(); osc.stop(ctx.currentTime + 0.3);
          break;
        case 'win':
          osc.type = 'sine';
          osc.frequency.value = 523;
          osc.start();
          setTimeout(() => { try { osc.frequency.value = 784; } catch(e){} }, 100);
          setTimeout(() => { try { osc.frequency.value = 1047; } catch(e){} }, 220);
          osc.stop(ctx.currentTime + 0.6);
          break;
        case 'bonus':
          osc.type = 'triangle';
          osc.frequency.value = 440;
          osc.start();
          setTimeout(() => { try { osc.frequency.value = 660; } catch(e){} }, 80);
          osc.stop(ctx.currentTime + 0.25);
          break;
      }
    } catch (e) { /* audio unavailable */ }
  }

  // ── VISUAL FEEDBACK ──────────────────────────────────────
  let activeToasts = 0;

  function showAchievementToast(achievement) {
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
      <span class="achievement-icon">${escapeHTML(achievement.icon)}</span>
      <div class="achievement-info">
        <div class="achievement-name">${escapeHTML(achievement.name)}</div>
        <div class="achievement-desc">${escapeHTML(achievement.desc)}</div>
      </div>`;
    toast.style.top = (20 + activeToasts * 90) + 'px';
    activeToasts++;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      activeToasts = Math.max(0, activeToasts - 1);
      setTimeout(() => toast.remove(), 350);
    }, 3500);
  }

  function showConfetti() {
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);
    const colors = ['#FFD700','#C0C0C0','#CD7F32','#e94560','#60a5fa','#39ff14'];
    for (let i = 0; i < 80; i++) {
      const el = document.createElement('div');
      el.className = 'confetti';
      el.style.cssText = `left:${Math.random()*100}%;background:${colors[i%colors.length]};animation-delay:${Math.random()*2}s;animation-duration:${2+Math.random()*2}s;border-radius:${Math.random()>0.5?'50%':'0'};`;
      container.appendChild(el);
    }
    setTimeout(() => container.remove(), 5000);
  }

  function showScorePop(points, x, y) {
    const el = document.createElement('div');
    el.className = 'score-pop';
    el.textContent = `+${points}`;
    el.style.cssText = `left:${x}px;top:${y}px;`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  function showComboPop(count) {
    const labels = { 2: 'Double!', 3: 'Triple!', 4: 'Cascade!', 5: 'MEGA CASCADE!' };
    const colors = { 2: '#60a5fa', 3: '#f472b6', 4: '#ffd700', 5: '#39ff14' };
    const label = labels[Math.min(count, 5)] || `${count}x CASCADE!`;
    const color = colors[Math.min(count, 5)] || '#39ff14';
    const el = document.createElement('div');
    el.className = 'combo-pop';
    el.textContent = label;
    el.style.cssText = `left:50%;top:40%;transform:translateX(-50%);color:${color};`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }

  function showLevelUpEffect() {
    const container = document.createElement('div');
    container.className = 'levelup-container';
    document.body.appendChild(container);
    const colors = ['#ffd700','#ff6b35','#4ade80','#60a5fa','#f472b6'];
    for (let i = 0; i < 40; i++) {
      const p = document.createElement('div');
      p.className = 'levelup-particle';
      p.style.cssText = `--angle:${(i/40)*360}deg;--delay:${(i%5)*0.05}s;background:${colors[i%colors.length]};`;
      container.appendChild(p);
    }
    setTimeout(() => container.remove(), 1500);
  }

  function showNewAchievements(newIds) {
    newIds.forEach((id, i) => {
      const ach = ACHIEVEMENTS[id];
      if (ach) setTimeout(() => {
        showAchievementToast(ach);
        playSound('achievement');
      }, i * 900);
    });
  }

  // ── SCORE SUBMISSION (via game-cloud.js) ─────────────────

  // ── COIN PHYSICS OBJECT ──────────────────────────────────
  function createCoin(x, y, type) {
    const t = COIN_TYPES[type] || COIN_TYPES.bronze;
    return {
      x, y,
      vx: (Math.random() - 0.5) * 0.5,
      vy: 0,
      radius: t.radius,
      color: t.color,
      value: t.value,
      type: type,
      isPrize: false,
      symbol: null,
      grounded: false,
    };
  }

  function createPrize(x, y, type) {
    const t = PRIZE_TYPES[type] || PRIZE_TYPES.star;
    return {
      x, y,
      vx: 0, vy: 0,
      radius: t.radius,
      color: t.color,
      value: t.value,
      type: type,
      isPrize: true,
      symbol: t.symbol,
      grounded: false,
    };
  }

  // ── INITIALIZATION ────────────────────────────────────────
  function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    try { bestScore = parseInt(localStorage.getItem('coin-cascade-best') || '0'); } catch(e) { bestScore = 0; }
    document.getElementById('hudBest').textContent = bestScore.toLocaleString();
    if (window.gameHeader) window.gameHeader.init({
      title: 'Coin Cascade',
      icon: '\u{1FA99}',
      gameId: 'coin-cascade',
      buttons: ['sound', 'leaderboard', 'auth'],
      soundBtnId: 'soundToggle',
      onSignIn: u => { currentUser = u; },
      onSignOut: () => { currentUser = null; },
    });

    resizeCanvas();
    mouseX = gameWidth / 2;
    window.addEventListener('resize', resizeCanvas);

    // Input — use pointer events to avoid click+touchstart double-fire
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);

    // Keyboard controls for accessibility
    document.addEventListener('keydown', (e) => {
      if (!gameRunning) return;
      if (e.key === 'ArrowLeft') { mouseX = Math.max(wallLeft + COIN_RADIUS, mouseX - 20); }
      else if (e.key === 'ArrowRight') { mouseX = Math.min(wallRight - COIN_RADIUS, mouseX + 20); }
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); dropCoin(mouseX); }
    });

    // Sound toggle
    document.getElementById('soundToggle').addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      document.getElementById('soundToggle').textContent = soundEnabled ? '\uD83D\uDD0A' : '\uD83D\uDD07';
    });

    // Start button
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('retryBtn').addEventListener('click', startGame);
    document.getElementById('homeBtn').addEventListener('click', () => { window.location.href = '../../'; });

    // Draw idle state
    drawIdle();
  }

  function resizeCanvas() {
    const header = document.getElementById('gameHeader');
    const hud = document.querySelector('.hud');
    const headerH = (header?.offsetHeight || 0) + (hud?.offsetHeight || 0);
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - headerH;
    canvasRect = canvas.getBoundingClientRect();

    // Calculate game dimensions
    gameWidth = canvas.width;
    gameHeight = canvas.height;
    wallLeft = EDGE_BUFFER;
    wallRight = gameWidth - EDGE_BUFFER;
    platformY = gameHeight * PLATFORM_Y_RATIO;
    platformBottom = gameHeight * 0.45; // Back wall — coins can't go above this on the platform
    platformFront = gameHeight * 0.78;  // Front lip — coins past this fall off and score
    frontEdge = gameHeight - 10;        // Collection line below the front lip
  }

  function drawIdle() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, gameWidth, gameHeight);
    drawMachine();
  }

  // ── GAME START ────────────────────────────────────────────
  function startGame() {
    document.getElementById('startOverlay').classList.add('hidden');
    document.getElementById('gameOverOverlay').classList.add('hidden');

    // Clean up stale DOM effects from previous round
    document.querySelectorAll('.score-pop, .combo-pop, .confetti-container, .levelup-container, .achievement-toast').forEach(el => el.remove());
    activeToasts = 0;

    // Reset state
    score = 0;
    coinsLeft = STARTING_COINS;
    comboCount = 0;
    maxCombo = 0;
    lastCollectTime = 0;
    totalCollected = 0;
    totalDropped = 0;
    lastDropTime = 0;
    coins = [];
    pusherX = 0;
    pusherDir = 1;
    sideLosses = 0;
    gameEnded = false;

    // Pre-populate platform with coins and prizes for immediate action
    spawnInitialCoins();

    updateHUD();
    gameRunning = true;
    gameStartTime = Date.now();
    lastFrameTime = 0;
    accumulator = 0;
    settleTimer = 0;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(gameLoop);
  }

  function spawnInitialCoins() {
    // Scatter some coins on the platform (between pusher and front lip)
    const minX = wallLeft + 30;
    const maxX = wallRight - 30;
    const minY = platformBottom + 20;
    const maxY = platformFront - 30;

    for (let i = 0; i < 20; i++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);
      const type = Math.random() < 0.1 ? 'silver' : 'bronze';
      const c = createCoin(x, y, type);
      c.grounded = true;
      c.vy = 0;
      coins.push(c);
    }

    // Add 1-2 prizes
    for (let i = 0; i < 2; i++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);
      const types = ['star', 'star', 'gem'];
      const p = createPrize(x, y, types[Math.floor(Math.random() * types.length)]);
      p.grounded = true;
      coins.push(p);
    }
  }

  // ── INPUT ─────────────────────────────────────────────────
  function handlePointerMove(e) {
    mouseX = e.clientX - canvasRect.left;
  }

  function handlePointerDown(e) {
    canvasRect = canvas.getBoundingClientRect();
    mouseX = e.clientX - canvasRect.left;
    dropCoin(mouseX);
  }

  function dropCoin(x) {
    if (!gameRunning) return;
    const now = Date.now();
    if (now - lastDropTime < DROP_COOLDOWN) return;
    if (coinsLeft <= 0) return;

    lastDropTime = now;
    coinsLeft--;
    totalDropped++;

    // Clamp to drop zone
    const dropX = Math.max(wallLeft + COIN_RADIUS, Math.min(wallRight - COIN_RADIUS, x));

    // Determine coin type
    let type = 'bronze';
    const r = Math.random();
    if (r < 0.05) type = 'gold';
    else if (r < 0.2) type = 'silver';

    const coin = createCoin(dropX, 10, type);
    coin.vy = 2;
    coins.push(coin);

    playSound('drop');
    updateHUD();
  }

  // ── GAME LOOP ─────────────────────────────────────────────
  const FIXED_DT = 1 / 60; // Physics runs at 60Hz regardless of display refresh rate
  let lastFrameTime = 0;
  let accumulator = 0;
  let settleTimer = 0;
  let rafId = null;

  function gameLoop(timestamp) {
    if (!gameRunning) { rafId = null; return; }

    if (lastFrameTime === 0) lastFrameTime = timestamp;
    const frameDelta = Math.min((timestamp - lastFrameTime) / 1000, 0.05); // cap at 50ms
    lastFrameTime = timestamp;
    accumulator += frameDelta;

    while (accumulator >= FIXED_DT) {
      update();
      accumulator -= FIXED_DT;
    }

    draw();

    // Check end condition — no coins left to drop
    // Give the pusher a few more cycles to push remaining coins off, then end
    if (coinsLeft <= 0) {
      settleTimer += frameDelta;
      // End after 8 seconds (enough for ~5 pusher cycles to clear the platform)
      if (settleTimer > 8.0 || coins.length === 0) {
        gameRunning = false;
        rafId = null;
        endGame();
        return;
      }
    }

    rafId = requestAnimationFrame(gameLoop);
  }

  function update() {
    // Move pusher
    const pusherWidth = (wallRight - wallLeft) * 0.6;
    const pusherRange = (wallRight - wallLeft - pusherWidth) / 2;
    pusherX += PUSHER_SPEED * pusherDir;
    if (pusherX > pusherRange) { pusherX = pusherRange; pusherDir = -1; }
    if (pusherX < -pusherRange) { pusherX = -pusherRange; pusherDir = 1; }

    const pusherLeft = (wallLeft + wallRight) / 2 - pusherWidth / 2 + pusherX;
    const pusherRight = pusherLeft + pusherWidth;
    const pusherY = platformY;

    // Update coins
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];

      // Apply gravity only to coins in the air (falling from drop zone or past the lip)
      // Coins on the platform surface don't get gravity — they only move from pusher/collisions
      if (!c.grounded) {
        const onPlatform = c.y > platformBottom && c.y < platformFront;
        if (!onPlatform) {
          c.vy += GRAVITY; // Full gravity when falling from above or past the lip
        } else {
          c.vy += GRAVITY * 0.02; // Tiny nudge on platform so coins settle, not slide
        }
      }

      c.x += c.vx;
      c.y += c.vy;

      // Friction
      c.vx *= FRICTION;
      if (c.grounded) c.vy = 0;

      // Pusher collision — push coins toward the front (downward on screen)
      if (c.y > pusherY - c.radius && c.y < pusherY + 20 && c.x > pusherLeft && c.x < pusherRight) {
        c.vy = Math.max(c.vy, 2.5);
        c.vx += PUSHER_SPEED * pusherDir * 0.4;
        c.grounded = false;
        if (Math.random() < 0.1) playSound('clink');
      }

      // Platform floor collision
      // The platform surface stops coins. But coins pushed by the pusher
      // accumulate at the front. When pushed hard enough, front coins
      // get displaced past the lip and fall into the score zone.
      //
      // Key mechanic: coin-to-coin collisions push front coins over the edge.
      // A coin is "over the edge" when c.y > platformFront.
      if (c.y <= platformFront) {
        // Coin is on the platform — apply floor
        const floorY = platformFront - c.radius;
        if (c.y > floorY) {
          // Coin is at the very edge. If being pushed (vy > threshold), let it over.
          if (c.vy > 0.4) {
            // Coin has enough momentum to go over the lip — don't stop it
            c.grounded = false;
          } else {
            c.y = floorY;
            c.vy = -c.vy * BOUNCE;
            if (Math.abs(c.vy) < 0.5) {
              c.vy = 0;
              c.grounded = true;
            }
          }
        }
      }
      // If c.y > platformFront: coin is past the lip, falls freely to frontEdge

      // Back wall collision — coins can't go above platformBottom (pushed back)
      if (c.y < platformBottom + c.radius && c.y > platformY + 10) {
        c.y = platformBottom + c.radius;
        c.vy = Math.abs(c.vy) * BOUNCE;
      }

      // Shelf collision — dropped coins land on the shelf (above the pusher)
      if (c.y > pusherY - c.radius && c.y < pusherY + 5 && c.vy > 0) {
        if (c.y - c.vy <= pusherY - c.radius) {
          c.y = pusherY - c.radius;
          c.vy = -c.vy * BOUNCE;
          if (Math.abs(c.vy) < 0.3) {
            c.vy = 0;
            c.grounded = true;
          }
        }
      }

      // Wall collisions
      if (c.x < wallLeft + c.radius) {
        c.x = wallLeft + c.radius;
        c.vx = Math.abs(c.vx) * BOUNCE;
      }
      if (c.x > wallRight - c.radius) {
        c.x = wallRight - c.radius;
        c.vx = -Math.abs(c.vx) * BOUNCE;
      }

      // Front edge — coin falls off = scored!
      if (c.y > frontEdge) {
        collectCoin(c, i);
        continue;
      }

      // Side loss check — coin escaped bounds (e.g., physics glitch)
      if (c.x < -50 || c.x > gameWidth + 50 || c.y > gameHeight + 50) {
        coins.splice(i, 1);
        sideLosses++;
        playSound('sideloss');
        continue;
      }
    }

    // Coin-to-coin collisions (simple overlap push)
    for (let i = 0; i < coins.length; i++) {
      for (let j = i + 1; j < coins.length; j++) {
        const a = coins[i], b = coins[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = a.radius + b.radius;

        if (dist < minDist && dist > 0) {
          const overlap = (minDist - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;

          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;

          // Transfer velocity
          const dvx = a.vx - b.vx;
          const dvy = a.vy - b.vy;
          const dot = dvx * nx + dvy * ny;

          if (dot > 0) {
            a.vx -= dot * nx * 0.5;
            a.vy -= dot * ny * 0.5;
            b.vx += dot * nx * 0.5;
            b.vy += dot * ny * 0.5;
            a.grounded = false;
            b.grounded = false;
          }
        }
      }
    }

    // Combo timeout
    if (comboCount > 0 && Date.now() - lastCollectTime > COMBO_WINDOW) {
      comboCount = 0;
      updateHUD();
    }
  }

  function collectCoin(coin, index) {
    const now = Date.now();
    coins.splice(index, 1);

    // Combo
    if (now - lastCollectTime < COMBO_WINDOW) {
      comboCount++;
    } else {
      comboCount = 1;
    }
    lastCollectTime = now;
    if (comboCount > maxCombo) maxCombo = comboCount;

    // Calculate multiplier
    let multiplier = 1;
    if (comboCount >= 5) multiplier = 5;
    else if (comboCount >= 4) multiplier = 3;
    else if (comboCount >= 3) multiplier = 2;
    else if (comboCount >= 2) multiplier = 1.5;

    const points = Math.round(coin.value * multiplier);
    const prevScore = score;
    score += points;
    totalCollected++;

    // Show score pop at coin position (convert canvas coords to screen)
    const screenX = canvasRect.left + coin.x;
    const screenY = canvasRect.top + coin.y - 20;
    showScorePop(points, screenX, screenY);

    // Combo label
    if (comboCount >= 2) {
      showComboPop(comboCount);
      playSound('combo');
    } else {
      playSound('collect');
    }

    // Score milestone celebration (no bonus coins or prize spawns — causes feedback loops)
    const prevMilestone = Math.floor(prevScore / 1000);
    const newMilestone = Math.floor(score / 1000);
    if (newMilestone > prevMilestone) {
      playSound('bonus');
      showAchievementToast({ name: `${newMilestone * 1000} pts!`, icon: '\uD83C\uDF1F', desc: 'Score milestone reached!' });
    }

    updateHUD();
  }

  // ── DRAWING ───────────────────────────────────────────────
  function draw() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, gameWidth, gameHeight);

    drawMachine();
    drawCoins();
    drawDropIndicator();
  }

  function drawMachine() {
    // Side walls
    ctx.fillStyle = '#1a1a3a';
    ctx.fillRect(0, 0, wallLeft, gameHeight);
    ctx.fillRect(wallRight, 0, gameWidth - wallRight, gameHeight);

    // Wall edges glow
    ctx.strokeStyle = '#2a2a5a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wallLeft, 0);
    ctx.lineTo(wallLeft, gameHeight);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(wallRight, 0);
    ctx.lineTo(wallRight, gameHeight);
    ctx.stroke();

    // Platform area background (the surface where coins sit)
    ctx.fillStyle = 'rgba(30, 30, 60, 0.5)';
    ctx.fillRect(wallLeft, platformBottom, wallRight - wallLeft, platformFront - platformBottom);

    // Pusher shelf line (top of drop zone)
    ctx.strokeStyle = '#3a3a6a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(wallLeft, platformY);
    ctx.lineTo(wallRight, platformY);
    ctx.stroke();

    // Back wall line
    ctx.strokeStyle = '#2a2a4a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wallLeft, platformBottom);
    ctx.lineTo(wallRight, platformBottom);
    ctx.stroke();

    // Front lip line (coins fall off past this)
    ctx.strokeStyle = '#5a5a8a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(wallLeft, platformFront);
    ctx.lineTo(wallRight, platformFront);
    ctx.stroke();

    // Pusher bar
    const pusherWidth = (wallRight - wallLeft) * 0.6;
    const pusherLeft = (wallLeft + wallRight) / 2 - pusherWidth / 2 + pusherX;
    const barH = 12;

    const grad = ctx.createLinearGradient(pusherLeft, platformY - barH/2, pusherLeft, platformY + barH/2);
    grad.addColorStop(0, '#4a4a8a');
    grad.addColorStop(0.5, '#6a6aaa');
    grad.addColorStop(1, '#3a3a6a');
    ctx.fillStyle = grad;
    ctx.fillRect(pusherLeft, platformY - barH/2, pusherWidth, barH);

    // Pusher edge glow
    ctx.strokeStyle = '#8a8acc';
    ctx.lineWidth = 1;
    ctx.strokeRect(pusherLeft, platformY - barH/2, pusherWidth, barH);

    // Front edge zone (scoring zone) - glowing line
    ctx.strokeStyle = 'rgba(57, 255, 20, 0.4)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(wallLeft, frontEdge);
    ctx.lineTo(wallRight, frontEdge);
    ctx.stroke();
    ctx.setLineDash([]);

    // "SCORE" label at bottom
    ctx.fillStyle = 'rgba(57, 255, 20, 0.5)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCORE ZONE', gameWidth / 2, frontEdge + 5);

    // Drop zone label at top
    ctx.fillStyle = 'rgba(255, 215, 0, 0.5)';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('TAP TO DROP', gameWidth / 2, 20);
  }

  function drawCoins() {
    for (const c of coins) {
      ctx.save();

      if (c.isPrize) {
        // Draw prize as emoji
        ctx.font = `${c.radius * 1.5}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(c.symbol, c.x, c.y);

        // Glow effect
        ctx.shadowColor = c.color;
        ctx.shadowBlur = 8;
        ctx.fillText(c.symbol, c.x, c.y);
      } else {
        // Draw coin circle
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);

        // Gradient fill
        const grad = ctx.createRadialGradient(
          c.x - c.radius * 0.3, c.y - c.radius * 0.3, c.radius * 0.1,
          c.x, c.y, c.radius
        );
        grad.addColorStop(0, lightenColor(c.color, 40));
        grad.addColorStop(1, c.color);
        ctx.fillStyle = grad;
        ctx.fill();

        // Border
        ctx.strokeStyle = darkenColor(c.color, 30);
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Value text on bigger coins
        if (c.value >= 5) {
          ctx.fillStyle = '#000';
          ctx.font = `bold ${c.radius * 0.9}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(c.value, c.x, c.y);
        }
      }

      ctx.restore();
    }
  }

  function drawDropIndicator() {
    if (!gameRunning || coinsLeft <= 0) return;

    // Vertical line showing where the coin will drop
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(mouseX, 0);
    ctx.lineTo(mouseX, platformY - 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // Preview coin
    ctx.beginPath();
    ctx.arc(mouseX, 15, COIN_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 215, 0, 0.4)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ── COLOR HELPERS ─────────────────────────────────────────
  function lightenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (num >> 16) + percent);
    const g = Math.min(255, ((num >> 8) & 0x00FF) + percent);
    const b = Math.min(255, (num & 0x0000FF) + percent);
    return `rgb(${r},${g},${b})`;
  }

  function darkenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - percent);
    const g = Math.max(0, ((num >> 8) & 0x00FF) - percent);
    const b = Math.max(0, (num & 0x0000FF) - percent);
    return `rgb(${r},${g},${b})`;
  }

  // ── HUD UPDATE ────────────────────────────────────────────
  function updateHUD() {
    document.getElementById('hudScore').textContent = score.toLocaleString();
    document.getElementById('hudCoins').textContent = coinsLeft;
    document.getElementById('hudCombo').textContent = comboCount > 0 ? `${comboCount}x` : '-';
    document.getElementById('hudBest').textContent = Math.max(score, bestScore).toLocaleString();
  }

  // ── GAME END ──────────────────────────────────────────────
  let gameEnded = false;

  function endGame() {
    if (gameEnded) return;
    gameEnded = true;
    gameRunning = false;
    updateHUD();

    // Announce to screen readers
    const sr = document.getElementById('srAnnounce');
    if (sr) sr.textContent = `Round over. Score: ${score}. Coins collected: ${totalCollected}. Max combo: ${maxCombo}x.`;

    const isNewBest = score > bestScore;
    if (isNewBest) {
      bestScore = score;
      try { localStorage.setItem('coin-cascade-best', bestScore.toString()); } catch(e) {}
    }

    // Sound
    playSound(score >= 500 ? 'win' : 'fail');

    // Confetti on good score
    if (score >= 1000) showConfetti();

    // Achievements
    const newAchievements = checkAchievements({
      score,
      maxCombo,
      collected: totalCollected,
      sideLosses,
    });

    // XP
    const xpEarned = Math.round(score / 10) + 25;
    addXP(xpEarned);

    // Show achievement toasts
    showNewAchievements(newAchievements);

    // Submit score (gameCloud handles auth guard + guest nudge)
    window.gameCloud.submitScore('coin-cascade', {
      score,
      timeMs: Date.now() - gameStartTime,
      metadata: { coinsDropped: totalDropped, coinsCollected: totalCollected, maxCombo: maxCombo },
    });

    // Show game over modal
    document.getElementById('goTitle').textContent = isNewBest ? 'New Record!' : 'Round Over!';
    document.getElementById('goScore').textContent = score.toLocaleString();
    document.getElementById('goScore').className = isNewBest ? 'value new-best' : 'value';
    document.getElementById('goBest').textContent = bestScore.toLocaleString();
    document.getElementById('goCollected').textContent = totalCollected;
    document.getElementById('goCombo').textContent = maxCombo + 'x';
    document.getElementById('gameOverOverlay').classList.remove('hidden');

    // Focus the retry button for keyboard users
    document.getElementById('retryBtn').focus();
  }

  // ── BOOT ──────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);
  })();
