(function() {
      'use strict';

      // ============ HELPERS ============
      function escapeHTML(str) {
        var d = document.createElement('div');
        d.appendChild(document.createTextNode(str));
        return d.innerHTML;
      }

      // ============ GAME CONSTANTS ============
      const GRID_SIZE = 20;
      const INITIAL_SPEED = 150;
      const SPEED_INCREASE = 10;
      const MIN_SPEED = 50;
      const POINTS_PER_FOOD = 10;
      const FOOD_FOR_LEVEL_UP = 5;

      // ============ GAME STATE ============
      let canvas, ctx;
      let gridWidth, gridHeight;
      let snake = [];
      let food = { x: 0, y: 0 };
      let direction = 'right';
      let nextDirection = 'right';
      let score = 0;
      let level = 1;
      let highScore = 0;
      let foodEaten = 0;
      let gameLoop = null;
      let speed = INITIAL_SPEED;
      let isPaused = false;
      let isGameOver = false;
      let isPlaying = false;
      let soundEnabled = true;
      let currentUser = null;
      let gameStartTime = 0;

      // Touch handling
      let touchStartX = 0;
      let touchStartY = 0;

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

        highScore = parseInt(localStorage.getItem('snake-high-score')) || 0;
        document.getElementById('highScoreDisplay').textContent = highScore;

        document.addEventListener('keydown', handleKeydown);
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchstart', handleTouchStart, { passive: false });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });

        // Wire up buttons (no inline onclick)
        document.getElementById('startBtn').addEventListener('click', startGame);
        document.getElementById('restartBtn').addEventListener('click', startGame);
        document.getElementById('authModalClose').addEventListener('click', hideAuthModal);
        document.getElementById('googleSignInBtn').addEventListener('click', signInWithGoogle);
        document.getElementById('authModal').addEventListener('click', (e) => {
          if (e.target.id === 'authModal') hideAuthModal();
        });

        // Auth via shared gameHeader
        window.gameHeader.init({
          title: 'Snake',
          icon: '\u{1F40D}',
          gameId: 'snake',
          buttons: ['sound', 'leaderboard', 'auth'],
          onSound: () => toggleSound(),
          soundBtnId: 'soundBtn',
          onSignIn: async (user) => {
            currentUser = user;
            cloudState = await window.gameCloud.loadState('snake');
            if (cloudState?.additionalData?.highScore > highScore) {
              highScore = cloudState.additionalData.highScore;
              localStorage.setItem('snake-high-score', highScore);
              document.getElementById('highScoreDisplay').textContent = highScore;
            }
          },
          onSignOut: () => { currentUser = null; }
        });
      }

      function resizeCanvas() {
        const container = document.querySelector('.game-container');
        const containerWidth = container.clientWidth || 320;
        const containerHeight = container.clientHeight || 320;
        const availableWidth = containerWidth - 8;
        const availableHeight = containerHeight - 8;
        const canvasWidth = Math.max(Math.floor(availableWidth / GRID_SIZE) * GRID_SIZE, GRID_SIZE * 10);
        const canvasHeight = Math.max(Math.floor(availableHeight / GRID_SIZE) * GRID_SIZE, GRID_SIZE * 10);
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        gridWidth = Math.floor(canvas.width / GRID_SIZE);
        gridHeight = Math.floor(canvas.height / GRID_SIZE);
        if (gridWidth < 10) gridWidth = 10;
        if (gridHeight < 10) gridHeight = 10;
        if (isPlaying && !isGameOver) {
          const outOfBounds = snake.some(seg => seg.x < 0 || seg.x >= gridWidth || seg.y < 0 || seg.y >= gridHeight);
          if (outOfBounds) { gameOver(); return; }
          draw();
        }
      }

      // ============ GAME LOGIC ============
      function startGame() {
        resizeCanvas();
        if (!gridWidth || !gridHeight || gridWidth < 10 || gridHeight < 10) return;

        document.getElementById('startOverlay').classList.add('hidden');
        document.getElementById('gameOverOverlay').classList.add('hidden');

        const startX = Math.floor(gridWidth / 2);
        const startY = Math.floor(gridHeight / 2);
        snake = [
          { x: startX, y: startY },
          { x: startX - 1, y: startY },
          { x: startX - 2, y: startY }
        ];
        direction = 'right';
        nextDirection = 'right';
        score = 0; level = 1; foodEaten = 0;
        speed = INITIAL_SPEED;
        isPaused = false; isGameOver = false; isPlaying = true;
        gameStartTime = Date.now();
        updateDisplay();
        spawnFood();
        if (gameLoop) clearInterval(gameLoop);
        gameLoop = setInterval(gameStep, speed);
      }

      function gameStep() {
        if (isPaused || isGameOver) return;
        direction = nextDirection;
        const head = { ...snake[0] };
        switch (direction) {
          case 'up': head.y--; break;
          case 'down': head.y++; break;
          case 'left': head.x--; break;
          case 'right': head.x++; break;
        }
        if (head.x < 0 || head.x >= gridWidth || head.y < 0 || head.y >= gridHeight) { gameOver(); return; }
        if (snake.some(segment => segment.x === head.x && segment.y === head.y)) { gameOver(); return; }
        snake.unshift(head);
        if (head.x === food.x && head.y === food.y) { eatFood(); } else { snake.pop(); }
        draw();
      }

      function eatFood() {
        score += POINTS_PER_FOOD * level;
        foodEaten++;
        playSound('eat');
        if (foodEaten >= FOOD_FOR_LEVEL_UP) levelUp();
        updateDisplay();
        spawnFood();
      }

      function levelUp() {
        level++;
        foodEaten = 0;
        speed = Math.max(MIN_SPEED, INITIAL_SPEED - (level - 1) * SPEED_INCREASE);
        clearInterval(gameLoop);
        gameLoop = setInterval(gameStep, speed);
        playSound('levelup');
        updateDisplay();
      }

      function spawnFood() {
        let newFood;
        do {
          newFood = { x: Math.floor(Math.random() * gridWidth), y: Math.floor(Math.random() * gridHeight) };
        } while (snake.some(segment => segment.x === newFood.x && segment.y === newFood.y));
        food = newFood;
      }

      function gameOver() {
        isGameOver = true; isPlaying = false;
        clearInterval(gameLoop);
        playSound('gameover');
        const isNewHighScore = score > highScore;
        if (isNewHighScore) {
          highScore = score;
          localStorage.setItem('snake-high-score', highScore);
          document.getElementById('highScoreDisplay').textContent = highScore;
        }
        document.getElementById('finalScore').textContent = score;
        document.getElementById('gameOverSubtitle').textContent = `You reached level ${level}`;
        document.getElementById('newHighScore').style.display = isNewHighScore ? 'block' : 'none';
        document.getElementById('gameOverOverlay').classList.remove('hidden');
        submitScore();
        saveCloudState();
      }

      // ============ DRAWING ============
      function draw() {
        ctx.fillStyle = '#141414';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 0.5;
        for (let x = 0; x <= canvas.width; x += GRID_SIZE) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 0; y <= canvas.height; y += GRID_SIZE) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(food.x * GRID_SIZE + GRID_SIZE / 2, food.y * GRID_SIZE + GRID_SIZE / 2, GRID_SIZE / 2 - 2, 0, Math.PI * 2);
        ctx.fill();
        snake.forEach((segment, index) => {
          const isHead = index === 0;
          ctx.fillStyle = isHead ? '#4ade80' : '#22c55e';
          const x = segment.x * GRID_SIZE + 1;
          const y = segment.y * GRID_SIZE + 1;
          const size = GRID_SIZE - 2;
          const radius = isHead ? 6 : 4;
          ctx.beginPath(); ctx.roundRect(x, y, size, size, radius); ctx.fill();
          if (isHead) {
            ctx.fillStyle = '#000';
            const eyeSize = 3, eyeOffset = 5;
            let eye1x, eye1y, eye2x, eye2y;
            switch (direction) {
              case 'right': eye1x = x + size - eyeOffset; eye1y = y + eyeOffset; eye2x = x + size - eyeOffset; eye2y = y + size - eyeOffset; break;
              case 'left': eye1x = x + eyeOffset; eye1y = y + eyeOffset; eye2x = x + eyeOffset; eye2y = y + size - eyeOffset; break;
              case 'up': eye1x = x + eyeOffset; eye1y = y + eyeOffset; eye2x = x + size - eyeOffset; eye2y = y + eyeOffset; break;
              case 'down': eye1x = x + eyeOffset; eye1y = y + size - eyeOffset; eye2x = x + size - eyeOffset; eye2y = y + size - eyeOffset; break;
            }
            ctx.beginPath(); ctx.arc(eye1x, eye1y, eyeSize, 0, Math.PI * 2); ctx.arc(eye2x, eye2y, eyeSize, 0, Math.PI * 2); ctx.fill();
          }
        });
      }

      function updateDisplay() {
        document.getElementById('scoreDisplay').textContent = score;
        document.getElementById('levelDisplay').textContent = level;
      }

      // ============ CONTROLS ============
      function handleKeydown(e) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) e.preventDefault();
        if (!isPlaying && !isGameOver) {
          if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) { startGame(); return; }
        }
        if (e.key === ' ' || e.key === 'Escape') { e.preventDefault(); togglePause(); return; }
        switch (e.key) {
          case 'ArrowUp': case 'w': case 'W': if (direction !== 'down') nextDirection = 'up'; break;
          case 'ArrowDown': case 's': case 'S': if (direction !== 'up') nextDirection = 'down'; break;
          case 'ArrowLeft': case 'a': case 'A': if (direction !== 'right') nextDirection = 'left'; break;
          case 'ArrowRight': case 'd': case 'D': if (direction !== 'left') nextDirection = 'right'; break;
        }
      }

      function setDirection(dir) {
        if (!isPlaying) { startGame(); return; }
        switch (dir) {
          case 'up': if (direction !== 'down') nextDirection = 'up'; break;
          case 'down': if (direction !== 'up') nextDirection = 'down'; break;
          case 'left': if (direction !== 'right') nextDirection = 'left'; break;
          case 'right': if (direction !== 'left') nextDirection = 'right'; break;
        }
      }

      function handleTouchStart(e) { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; }
      function handleTouchMove(e) {
        if (!touchStartX || !touchStartY) return;
        const dx = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;
        const minSwipe = 30;
        if (Math.abs(dx) > Math.abs(dy)) {
          if (Math.abs(dx) > minSwipe) { setDirection(dx > 0 ? 'right' : 'left'); touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; }
        } else {
          if (Math.abs(dy) > minSwipe) { setDirection(dy > 0 ? 'down' : 'up'); touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; }
        }
        e.preventDefault();
      }

      function togglePause() {
        if (!isPlaying || isGameOver) return;
        isPaused = !isPaused;
        document.getElementById('pauseIndicator').classList.toggle('show', isPaused);
      }

      // ============ SOUND ============
      let audioCtx = null;
      let audioUnlocked = false;
      function getAudioContext() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); return audioCtx; }
      function unlockAudio() {
        if (audioUnlocked) return;
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer; source.connect(ctx.destination); source.start(0);
        audioUnlocked = true;
      }
      ['touchstart', 'mousedown', 'keydown'].forEach(event => { document.addEventListener(event, unlockAudio, { once: true }); });

      function playSound(type) {
        if (!soundEnabled) return;
        try {
          const ctx = getAudioContext();
          if (ctx.state === 'suspended') ctx.resume();
          const oscillator = ctx.createOscillator();
          const gainNode = ctx.createGain();
          oscillator.connect(gainNode); gainNode.connect(ctx.destination);
          const now = ctx.currentTime;
          switch (type) {
            case 'eat': oscillator.frequency.setValueAtTime(600, now); gainNode.gain.setValueAtTime(0.1, now); oscillator.start(now); oscillator.stop(now + 0.1); break;
            case 'levelup': oscillator.frequency.setValueAtTime(800, now); gainNode.gain.setValueAtTime(0.1, now); oscillator.start(now); oscillator.frequency.setValueAtTime(1000, now + 0.1); oscillator.stop(now + 0.2); break;
            case 'gameover': oscillator.frequency.setValueAtTime(200, now); gainNode.gain.setValueAtTime(0.1, now); oscillator.start(now); oscillator.stop(now + 0.3); break;
          }
        } catch (e) {}
      }

      function toggleSound() {
        soundEnabled = !soundEnabled;
        document.getElementById('soundBtn').textContent = soundEnabled ? '\u{1F50A}' : '\u{1F507}';
      }

      // ============ AUTH & CLOUD ============
      let cloudState = null;
      function showAuthModal() { document.getElementById('authModal').classList.add('show'); }
      function hideAuthModal() { document.getElementById('authModal').classList.remove('show'); }
      async function signInWithGoogle() {
        try { await window.authManager.signInWithGoogle(); hideAuthModal(); } catch (e) { console.error('Sign in failed:', e); }
      }

      async function submitScore() {
        await window.gameCloud.submitScore('snake', {
          score: score, level: level, timeMs: Date.now() - gameStartTime,
          metadata: { foodEaten: foodEaten + (level - 1) * FOOD_FOR_LEVEL_UP, finalLength: snake.length }
        });
      }

      async function saveCloudState(won) {
        const prev = cloudState || {};
        const newState = {
          currentLevel: level, currentStreak: 0,
          bestStreak: Math.max(prev.bestStreak || 0, level),
          gamesPlayed: (prev.gamesPlayed || 0) + 1,
          gamesWon: (prev.gamesWon || 0) + (won ? 1 : 0),
          lastPlayedDate: new Date().toISOString().split('T')[0],
          additionalData: { highScore, lastScore: score }
        };
        await window.gameCloud.saveState('snake', newState);
        cloudState = newState;
        if (newState.gamesPlayed === 1) window.gameCloud.unlockAchievement('first_word', 'snake');
        if (newState.gamesWon >= 10) window.gameCloud.unlockAchievement('ten_wins', 'snake');
      }

      // ============ START ============
      window.addEventListener('load', init);
    })();
