(function() {
    'use strict';

    // ============ HELPERS ============
    function escapeHTML(str) {
      var d = document.createElement('div');
      d.textContent = str;
      return d.innerHTML;
    }

    // ============ GAME CONSTANTS ============
    const BLOCK_HEIGHT = 20;
    const INITIAL_BLOCK_WIDTH = 200;
    const MIN_BLOCK_WIDTH = 10;
    const PERFECT_THRESHOLD = 5; // pixels tolerance for perfect stack
    const BASE_POINTS = 10;
    const PERFECT_BONUS = 15;
    const MAX_COMBO_MULTIPLIER = 10;

    // Speed progression
    const INITIAL_SPEED = 2;
    const MAX_SPEED = 8;
    const SPEED_INCREMENT = 0.15;

    // ============ GAME STATE ============
    let canvas, ctx;
    let canvasWidth, canvasHeight;

    // Tower state
    let blocks = [];
    let currentBlock = null;
    let towerWidth = INITIAL_BLOCK_WIDTH;

    // Scoring
    let score = 0;
    let combo = 0;
    let maxCombo = 0;
    let height = 0;
    let perfectStacks = 0;
    let totalStacks = 0;
    let highScore = 0;

    // Game state
    let isPlaying = false;
    let isGameOver = false;
    let gameLoop = null;
    let currentSpeed = INITIAL_SPEED;
    let soundEnabled = true;
    let currentUser = null;
    let gameStartTime = 0;

    // Visual effects
    let particles = [];
    let screenShake = 0;
    let perfectFlash = 0;

    // ============ INITIALIZATION ============
    function init() {
      canvas = document.getElementById('gameCanvas');
      ctx = canvas.getContext('2d');

      resizeCanvas();
      let resizeTimeout;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(resizeCanvas, 100);
      });

      // Load high score
      highScore = parseInt(localStorage.getItem('stack-tower-best')) || 0;
      document.getElementById('highScoreDisplay').textContent = highScore;

      // Input handlers
      document.addEventListener('keydown', handleKeydown);
      canvas.addEventListener('click', handleClick);
      canvas.addEventListener('touchstart', handleTouch, { passive: false });
      document.addEventListener('click', handleDocumentClick);
      document.addEventListener('touchstart', handleDocumentTouch, { passive: false });

      // Auth & Header
      if (window.gameHeader) {
        window.gameHeader.init({
          title: 'Stack Tower',
          icon: '🏗️',
          gameId: 'stack-tower',
          buttons: ['sound', 'leaderboard', 'auth'],
          onSound: () => toggleSound(),
          onSignIn: async () => {
            currentUser = window.gameCloud.getUser();
            cloudState = await window.gameCloud.loadState('stack-tower');
            if (cloudState && cloudState.additionalData?.highScore) {
              const cloudHighScore = cloudState.additionalData.highScore;
              if (cloudHighScore > highScore) {
                highScore = cloudHighScore;
                localStorage.setItem('stack-tower-best', highScore);
                document.getElementById('highScoreDisplay').textContent = highScore;
              }
            }
          },
          onSignOut: () => { currentUser = null; }
        });
      }

      // Initial draw
      drawStartScreen();
    }

    function resizeCanvas() {
      const container = document.querySelector('.game-container');
      const containerWidth = container.clientWidth || 400;
      const containerHeight = container.clientHeight || 600;

      canvasWidth = Math.min(containerWidth - 8, 400);
      canvasHeight = Math.min(containerHeight - 8, 600);

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      if (!isPlaying && !isGameOver) {
        drawStartScreen();
      }
    }

    function drawStartScreen() {
      ctx.fillStyle = '#243442';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Draw a sample tower
      const sampleBlocks = [
        { width: 200, x: canvasWidth / 2 - 100 },
        { width: 180, x: canvasWidth / 2 - 90 },
        { width: 160, x: canvasWidth / 2 - 80 },
        { width: 140, x: canvasWidth / 2 - 70 },
        { width: 120, x: canvasWidth / 2 - 60 }
      ];

      sampleBlocks.forEach((block, i) => {
        const y = canvasHeight - 50 - (i * BLOCK_HEIGHT);
        const gradient = ctx.createLinearGradient(block.x, y, block.x + block.width, y);
        gradient.addColorStop(0, '#FF6B6B');
        gradient.addColorStop(1, '#E85A5A');
        ctx.fillStyle = gradient;
        ctx.fillRect(block.x, y, block.width, BLOCK_HEIGHT - 2);
      });
    }

    // ============ GAME LOGIC ============
    function startGame() {
      // CRITICAL: Unlock audio on this user gesture (mobile requirement)
      unlockAudio();

      document.getElementById('startOverlay').classList.add('hidden');
      document.getElementById('gameOverOverlay').classList.add('hidden');

      // Reset state
      blocks = [];
      particles = [];
      score = 0;
      combo = 0;
      maxCombo = 0;
      height = 0;
      perfectStacks = 0;
      totalStacks = 0;
      towerWidth = INITIAL_BLOCK_WIDTH;
      currentSpeed = INITIAL_SPEED;
      screenShake = 0;
      perfectFlash = 0;
      isPlaying = true;
      isGameOver = false;
      gameStartTime = Date.now();

      // Create base block
      const baseBlock = {
        x: (canvasWidth - INITIAL_BLOCK_WIDTH) / 2,
        y: canvasHeight - 50,
        width: INITIAL_BLOCK_WIDTH
      };
      blocks.push(baseBlock);

      // Create first moving block
      spawnBlock();

      updateDisplay();

      // Start game loop
      if (gameLoop) cancelAnimationFrame(gameLoop);
      gameLoop = requestAnimationFrame(update);
    }

    function spawnBlock() {
      const lastBlock = blocks[blocks.length - 1];
      currentBlock = {
        x: -towerWidth, // Start from left
        y: lastBlock.y - BLOCK_HEIGHT,
        width: towerWidth,
        direction: 1, // 1 = right, -1 = left
        speed: currentSpeed
      };
    }

    function update() {
      if (!isPlaying || isGameOver) return;

      // Update current block position
      if (currentBlock) {
        currentBlock.x += currentBlock.direction * currentBlock.speed;

        // Bounce off edges
        if (currentBlock.x + currentBlock.width > canvasWidth) {
          currentBlock.direction = -1;
        } else if (currentBlock.x < 0) {
          currentBlock.direction = 1;
        }
      }

      // Update particles
      particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.3; // gravity
        p.life -= 0.02;
        return p.life > 0;
      });

      // Decay effects
      if (screenShake > 0) screenShake *= 0.9;
      if (perfectFlash > 0) perfectFlash *= 0.9;

      draw();
      gameLoop = requestAnimationFrame(update);
    }

    function dropBlock() {
      if (!currentBlock || isGameOver) return;

      const lastBlock = blocks[blocks.length - 1];
      const overlap = calculateOverlap(currentBlock, lastBlock);

      if (overlap.width <= 0) {
        // Complete miss - game over
        gameOver();
        return;
      }

      totalStacks++;

      // Check if perfect stack
      const isPerfect = Math.abs(overlap.offset) <= PERFECT_THRESHOLD;

      if (isPerfect) {
        // Perfect stack - keep same width, center on last block
        currentBlock.x = lastBlock.x;
        currentBlock.width = lastBlock.width;
        perfectStacks++;
        combo++;
        if (combo > maxCombo) maxCombo = combo;

        playSound('perfect');
        showComboText();
        spawnParticles(currentBlock.x + currentBlock.width / 2, currentBlock.y, '#FFE66D');
        perfectFlash = 1;
      } else {
        // Partial stack - trim overhang
        const trimmedBlock = {
          x: overlap.x,
          y: currentBlock.y,
          width: overlap.width
        };

        // Spawn falling piece particles
        if (overlap.offset > 0) {
          // Overhanging on right
          spawnFallingPiece(overlap.x + overlap.width, currentBlock.y, currentBlock.width - overlap.width);
        } else {
          // Overhanging on left
          spawnFallingPiece(currentBlock.x, currentBlock.y, -overlap.offset);
        }

        currentBlock = trimmedBlock;
        towerWidth = overlap.width;
        combo = 0;
        playSound('place');
      }

      // Calculate score
      const comboMultiplier = Math.min(combo, MAX_COMBO_MULTIPLIER);
      const blockScore = (BASE_POINTS + (isPerfect ? PERFECT_BONUS : 0)) * Math.max(comboMultiplier, 1);
      score += blockScore;
      height++;

      // Add block to tower
      blocks.push({
        x: currentBlock.x,
        y: currentBlock.y,
        width: currentBlock.width
      });

      // Check for very narrow tower (game over threshold)
      if (towerWidth < MIN_BLOCK_WIDTH) {
        gameOver();
        return;
      }

      // Increase speed
      currentSpeed = Math.min(MAX_SPEED, INITIAL_SPEED + (height * SPEED_INCREMENT));

      updateDisplay();

      // Scroll view if needed
      if (currentBlock.y < canvasHeight * 0.4) {
        scrollTower();
      }

      // Spawn next block
      spawnBlock();
    }

    function calculateOverlap(moving, stationary) {
      const movingLeft = moving.x;
      const movingRight = moving.x + moving.width;
      const stationaryLeft = stationary.x;
      const stationaryRight = stationary.x + stationary.width;

      const overlapLeft = Math.max(movingLeft, stationaryLeft);
      const overlapRight = Math.min(movingRight, stationaryRight);
      const overlapWidth = overlapRight - overlapLeft;

      return {
        x: overlapLeft,
        width: overlapWidth,
        offset: movingLeft - stationaryLeft
      };
    }

    function scrollTower() {
      const scrollAmount = BLOCK_HEIGHT * 3;
      blocks.forEach(block => {
        block.y += scrollAmount;
      });
      if (currentBlock) {
        currentBlock.y += scrollAmount;
      }
      // Remove blocks that are off screen
      blocks = blocks.filter(block => block.y < canvasHeight + BLOCK_HEIGHT);
    }

    function gameOver() {
      isGameOver = true;
      isPlaying = false;

      // Cancel animation loop
      if (gameLoop) {
        cancelAnimationFrame(gameLoop);
        gameLoop = null;
      }

      playSound('fail');

      // Trigger tower wobble animation
      screenShake = 10;

      // Check high score
      const isNewHighScore = score > highScore;
      if (isNewHighScore) {
        highScore = score;
        localStorage.setItem('stack-tower-best', highScore);
        document.getElementById('highScoreDisplay').textContent = highScore;
      }

      // Show game over after brief delay
      setTimeout(() => {
        document.getElementById('finalScore').textContent = score;
        document.getElementById('finalHeight').textContent = height;
        document.getElementById('finalCombo').textContent = maxCombo;
        document.getElementById('finalPerfects').textContent =
          totalStacks > 0 ? Math.round((perfectStacks / totalStacks) * 100) + '%' : '0%';
        document.getElementById('newHighScore').style.display = isNewHighScore ? 'block' : 'none';
        document.getElementById('gameOverOverlay').classList.remove('hidden');

        submitScore();
        saveCloudState();
      }, 500);
    }

    // ============ DRAWING ============
    function draw() {
      // Apply screen shake
      ctx.save();
      if (screenShake > 0.1) {
        ctx.translate(
          (Math.random() - 0.5) * screenShake,
          (Math.random() - 0.5) * screenShake
        );
      }

      // Clear canvas
      ctx.fillStyle = '#243442';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Perfect flash effect
      if (perfectFlash > 0.1) {
        ctx.fillStyle = `rgba(255, 230, 109, ${perfectFlash * 0.3})`;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      }

      // Draw stacked blocks
      blocks.forEach((block, index) => {
        drawBlock(block, index === blocks.length - 1);
      });

      // Draw current moving block
      if (currentBlock && !isGameOver) {
        drawBlock(currentBlock, false, true);

        // Draw guide lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(currentBlock.x, currentBlock.y + BLOCK_HEIGHT);
        ctx.lineTo(currentBlock.x, canvasHeight);
        ctx.moveTo(currentBlock.x + currentBlock.width, currentBlock.y + BLOCK_HEIGHT);
        ctx.lineTo(currentBlock.x + currentBlock.width, canvasHeight);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw particles
      particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      });
      ctx.globalAlpha = 1;

      ctx.restore();
    }

    function drawBlock(block, isTop, isMoving = false) {
      const gradient = ctx.createLinearGradient(block.x, block.y, block.x + block.width, block.y);

      if (isMoving) {
        gradient.addColorStop(0, '#FF8A8A');
        gradient.addColorStop(1, '#FF6B6B');
      } else {
        gradient.addColorStop(0, '#FF6B6B');
        gradient.addColorStop(1, '#E85A5A');
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(block.x, block.y, block.width, BLOCK_HEIGHT - 2);

      // Add highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(block.x, block.y, block.width, 3);

      // Add shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(block.x, block.y + BLOCK_HEIGHT - 4, block.width, 2);
    }

    function spawnParticles(x, y, color) {
      // Limit particle count to prevent memory issues in long sessions
      if (particles.length > 200) return;

      for (let i = 0; i < 20; i++) {
        particles.push({
          x: x,
          y: y,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8 - 3,
          size: Math.random() * 6 + 2,
          color: color,
          life: 1
        });
      }
    }

    function spawnFallingPiece(x, y, width) {
      if (width <= 0) return;
      // Limit particles to prevent memory issues
      if (particles.length > 200) return;

      // Create particles for falling piece
      for (let i = 0; i < Math.abs(width) / 5; i++) {
        particles.push({
          x: x + Math.random() * Math.abs(width),
          y: y + Math.random() * BLOCK_HEIGHT,
          vx: width > 0 ? Math.random() * 2 : -Math.random() * 2,
          vy: Math.random() * 2,
          size: Math.random() * 8 + 4,
          color: '#FF6B6B',
          life: 1
        });
      }

      playSound('trim');
    }

    function showComboText() {
      const indicator = document.getElementById('comboIndicator');
      let text = '';

      if (combo >= 15) {
        text = '🔥 PERFECT! ' + combo + 'x';
        screenShake = 5;
      } else if (combo >= 10) {
        text = '✨ Amazing! ' + combo + 'x';
      } else if (combo >= 5) {
        text = '🎯 Great! ' + combo + 'x';
      } else if (combo >= 2) {
        text = '👍 Nice! ' + combo + 'x';
      } else {
        text = '✓ Perfect!';
      }

      indicator.textContent = text;
      indicator.classList.remove('show');
      void indicator.offsetWidth; // Trigger reflow
      indicator.classList.add('show');
    }

    function updateDisplay() {
      document.getElementById('scoreDisplay').textContent = score;
      document.getElementById('heightDisplay').textContent = height;
      document.getElementById('comboDisplay').textContent = combo + 'x';
    }

    // ============ INPUT HANDLERS ============
    let lastInputTime = 0;
    const INPUT_DEBOUNCE_MS = 100; // Prevent double-firing (mobile needs longer)
    let lastEventType = null; // Track event type to avoid touch+click double fire

    function canProcessInput(eventType) {
      const now = Date.now();

      // If we just handled a touch event, ignore the synthetic click
      if (eventType === 'click' && lastEventType === 'touch' && now - lastInputTime < 300) {
        return false;
      }

      if (now - lastInputTime < INPUT_DEBOUNCE_MS) {
        return false;
      }

      lastInputTime = now;
      lastEventType = eventType;
      return true;
    }

    function isInteractiveElement(target) {
      // Don't trigger game on buttons, links, or interactive elements
      return target.closest('button') ||
             target.closest('a') ||
             target.closest('#gameHeader') ||
             target.closest('.auth-modal') ||
             target.closest('.game-overlay');
    }

    function handleGameInput(eventType) {
      if (!canProcessInput(eventType)) return;

      if (!isPlaying && !isGameOver) {
        // On start screen overlay - don't auto-start, let them use Play button
        return;
      } else if (isPlaying && !isGameOver) {
        dropBlock();
      } else if (isGameOver) {
        // On game over screen - don't auto-restart, let them use Play Again button
        return;
      }
    }

    function handleKeydown(e) {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (!canProcessInput('keyboard')) return;

        if (!isPlaying && !isGameOver) {
          startGame();
        } else if (isPlaying && !isGameOver) {
          dropBlock();
        } else if (isGameOver) {
          startGame();
        }
      }
    }

    function handleClick(e) {
      e.stopPropagation();
      if (isInteractiveElement(e.target)) return;
      handleGameInput('click');
    }

    function handleTouch(e) {
      if (isInteractiveElement(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      handleGameInput('touch');
    }

    function handleDocumentClick(e) {
      if (isInteractiveElement(e.target)) return;
      handleGameInput('click');
    }

    function handleDocumentTouch(e) {
      if (isInteractiveElement(e.target)) return;
      if (isPlaying && !isGameOver) {
        e.preventDefault();
      }
      handleGameInput('touch');
    }

    // ============ SOUND ============
    let audioCtx = null;
    let audioUnlocked = false;

    // Create AudioContext lazily (must be in user gesture on mobile)
    function getAudioContext() {
      if (!audioCtx) {
        try {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
          console.warn('Web Audio not supported');
          return null;
        }
      }
      return audioCtx;
    }

    // Unlock audio on mobile - must happen in user gesture
    async function unlockAudio() {
      if (audioUnlocked) return true;

      const ctx = getAudioContext();
      if (!ctx) return false;

      try {
        // Resume if suspended
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        // Play silent buffer to fully unlock on iOS
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);

        audioUnlocked = true;
        return true;
      } catch (e) {
        return false;
      }
    }

    // Unlock audio on ANY user interaction (critical for mobile)
    function setupAudioUnlock() {
      const unlockEvents = ['touchstart', 'touchend', 'mousedown', 'keydown', 'click'];

      function handleUnlock() {
        unlockAudio().then(unlocked => {
          if (unlocked) {
            // Remove all listeners once unlocked
            unlockEvents.forEach(evt => {
              document.removeEventListener(evt, handleUnlock, true);
            });
          }
        });
      }

      unlockEvents.forEach(evt => {
        document.addEventListener(evt, handleUnlock, true);
      });
    }

    // Initialize audio unlock listeners
    setupAudioUnlock();

    function playSound(type) {
      if (!soundEnabled) return;

      const ctx = getAudioContext();
      if (!ctx) return;

      // Try to resume on each play (mobile requirement)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Don't play if not unlocked yet
      if (ctx.state !== 'running') return;

      try {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        gainNode.gain.value = 0.1;

        switch (type) {
          case 'place':
            oscillator.frequency.value = 200;
            oscillator.start();
            oscillator.stop(ctx.currentTime + 0.1);
            break;
          case 'perfect':
            oscillator.frequency.value = 600;
            oscillator.start();
            gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
            oscillator.frequency.setValueAtTime(800, ctx.currentTime + 0.05);
            oscillator.stop(ctx.currentTime + 0.15);
            break;
          case 'trim':
            oscillator.frequency.value = 300;
            oscillator.type = 'sawtooth';
            oscillator.start();
            oscillator.stop(ctx.currentTime + 0.05);
            break;
          case 'fail':
            oscillator.frequency.value = 150;
            oscillator.start();
            oscillator.stop(ctx.currentTime + 0.3);
            break;
        }
      } catch (e) {
        // Audio playback failed silently
      }
    }

    function toggleSound() {
      soundEnabled = !soundEnabled;
      document.getElementById('soundBtn').textContent = soundEnabled ? '🔊' : '🔇';

      // Unlock audio when enabling sound (user gesture)
      if (soundEnabled) {
        unlockAudio();
      }
    }

    // ============ AUTH & CLOUD ============
    let cloudState = null;

    function showAuthModal() {
      document.getElementById('authModal').classList.add('show');
    }

    function hideAuthModal() {
      document.getElementById('authModal').classList.remove('show');
    }

    async function signInWithGoogle() {
      try {
        await window.authManager.signInWithGoogle();
        hideAuthModal();
      } catch (error) {
        console.error('Sign in failed:', error);
      }
    }

    document.getElementById('authModal').addEventListener('click', (e) => {
      if (e.target.id === 'authModal') hideAuthModal();
    });

    async function submitScore() {
      await window.gameCloud.submitScore('stack-tower', {
        score: score,
        level: height,
        timeMs: Date.now() - gameStartTime,
        metadata: {
          blocksPlaced: totalStacks,
          perfectStacks: perfectStacks,
          maxCombo: maxCombo,
          perfectRate: totalStacks > 0 ? ((perfectStacks / totalStacks) * 100).toFixed(1) : '0'
        }
      });
    }

    async function saveCloudState() {
      const prev = cloudState || {};
      const newState = {
        currentLevel: height,
        currentStreak: 0,
        bestStreak: Math.max(prev.bestStreak || 0, maxCombo),
        gamesPlayed: (prev.gamesPlayed || 0) + 1,
        gamesWon: 0,
        lastPlayedDate: new Date().toISOString().split('T')[0],
        additionalData: {
          highScore: highScore,
          lastScore: score,
          lastHeight: height
        }
      };
      await window.gameCloud.saveState('stack-tower', newState);
      cloudState = newState;

      // Achievement checks
      if (newState.gamesPlayed === 1) window.gameCloud.unlockAchievement('first_stack', 'stack-tower');
      if (height >= 10) window.gameCloud.unlockAchievement('tower_10', 'stack-tower');
      if (height >= 25) window.gameCloud.unlockAchievement('tower_25', 'stack-tower');
      if (height >= 50) window.gameCloud.unlockAchievement('skyscraper', 'stack-tower');
      if (maxCombo >= 10) window.gameCloud.unlockAchievement('combo_master', 'stack-tower');
      if (score >= 1000) window.gameCloud.unlockAchievement('score_1000', 'stack-tower');
      if (score >= 5000) window.gameCloud.unlockAchievement('score_5000', 'stack-tower');
    }

    // ============ START ============
    window.addEventListener('load', init);

    // Expose functions needed by HTML onclick attributes
    window.startGame = startGame;
    window.toggleSound = toggleSound;
    window.showAuthModal = showAuthModal;
    window.hideAuthModal = hideAuthModal;
    window.signInWithGoogle = signInWithGoogle;
  })();
