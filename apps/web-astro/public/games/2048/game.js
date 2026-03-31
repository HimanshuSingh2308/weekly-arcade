(function() {
      'use strict';

      function escapeHTML(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

      const GRID_SIZE = 4;
      const WINNING_TILE = 2048;

      let grid = [];
      let score = 0;
      let bestScore = parseInt(localStorage.getItem('2048-best-score')) || 0;
      let highestTile = 0;
      let moves = 0;
      let gameOver = false;
      let won = false;
      let continueAfterWin = false;
      let previousState = null;
      let tileId = 0;
      let currentUser = null;
      let gameStartTime = Date.now();

      // Audio
      let soundEnabled = localStorage.getItem('2048-sound') !== 'false';
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

      function toggleSound() {
        soundEnabled = !soundEnabled;
        localStorage.setItem('2048-sound', soundEnabled);
        const btn = document.getElementById('soundBtn');
        btn.textContent = soundEnabled ? '\u{1F50A}' : '\u{1F507}';
        btn.classList.toggle('muted', !soundEnabled);
      }

      function playSound(type) {
        if (!soundEnabled) return;
        try {
          const ctx = getAudioContext();
          if (ctx.state === 'suspended') ctx.resume();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          const now = ctx.currentTime;
          switch (type) {
            case 'move':
              osc.frequency.value = 200; osc.type = 'sine';
              gain.gain.setValueAtTime(0.08, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
              osc.start(now); osc.stop(now + 0.05); break;
            case 'merge':
              osc.frequency.setValueAtTime(400, now); osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
              osc.type = 'sine'; gain.gain.setValueAtTime(0.12, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
              osc.start(now); osc.stop(now + 0.15); break;
            case 'bigmerge':
              osc.frequency.setValueAtTime(523, now); osc.type = 'sine';
              gain.gain.setValueAtTime(0.15, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
              osc.start(now); osc.stop(now + 0.3);
              const osc2 = ctx.createOscillator(); const gain2 = ctx.createGain();
              osc2.connect(gain2); gain2.connect(ctx.destination);
              osc2.frequency.value = 659; osc2.type = 'sine';
              gain2.gain.setValueAtTime(0.1, now); gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
              osc2.start(now); osc2.stop(now + 0.3); break;
            case 'win':
              [523, 659, 784, 1047].forEach((freq, i) => {
                setTimeout(() => {
                  const o = ctx.createOscillator(); const g = ctx.createGain();
                  o.connect(g); g.connect(ctx.destination);
                  o.frequency.value = freq; o.type = 'sine';
                  const t = ctx.currentTime;
                  g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
                  o.start(t); o.stop(t + 0.2);
                }, i * 100);
              }); break;
            case 'lose':
              osc.frequency.setValueAtTime(200, now); osc.frequency.exponentialRampToValueAtTime(100, now + 0.4);
              osc.type = 'sawtooth'; gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.4);
              osc.start(now); osc.stop(now + 0.4); break;
          }
        } catch (e) {}
      }

      const tilesContainer = document.getElementById('tilesContainer');
      const scoreEl = document.getElementById('score');
      const bestScoreEl = document.getElementById('bestScore');
      const highestTileEl = document.getElementById('highestTile');
      const gridContainer = document.getElementById('gridContainer');

      function init() {
        bestScoreEl.textContent = bestScore;
        const btn = document.getElementById('soundBtn');
        if (btn) { btn.textContent = soundEnabled ? '\u{1F50A}' : '\u{1F507}'; btn.classList.toggle('muted', !soundEnabled); }

        // Wire buttons (no inline onclick)
        document.getElementById('soundBtn').addEventListener('click', toggleSound);
        document.getElementById('undoBtn').addEventListener('click', undoMove);
        document.getElementById('newGameBtn').addEventListener('click', newGame);
        document.getElementById('closeOverlayBtn').addEventListener('click', hideOverlay);
        document.getElementById('playAgainBtn').addEventListener('click', () => { newGame(); hideOverlay(); });

        setupEventListeners();
        loadGame();

        window.gameHeader.init({
          title: '2048',
          icon: '\u{1F522}',
          gameId: '2048',
          buttons: ['leaderboard', 'auth'],
          onSignIn: async (user) => {
            currentUser = user;
            cloudState2048 = await window.gameCloud.loadState('2048');
            if (cloudState2048?.additionalData?.bestScore > bestScore) {
              bestScore = cloudState2048.additionalData.bestScore;
              localStorage.setItem('2048-best-score', bestScore);
              bestScoreEl.textContent = bestScore;
            }
            await window.gameCloud.syncGuestScores('2048');
            loadLeaderboard();
          },
          onSignOut: () => { currentUser = null; }
        });
        loadLeaderboard();
      }

      function setupEventListeners() {
        document.addEventListener('keydown', handleKeydown);
        let touchStartX, touchStartY;
        gridContainer.addEventListener('touchstart', (e) => {
          touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY;
        }, { passive: true });
        gridContainer.addEventListener('touchend', (e) => {
          if (!touchStartX || !touchStartY) return;
          const dx = e.changedTouches[0].clientX - touchStartX;
          const dy = e.changedTouches[0].clientY - touchStartY;
          const minSwipe = 30;
          if (Math.abs(dx) > Math.abs(dy)) { if (Math.abs(dx) > minSwipe) move(dx > 0 ? 'right' : 'left'); }
          else { if (Math.abs(dy) > minSwipe) move(dy > 0 ? 'down' : 'up'); }
          touchStartX = null; touchStartY = null;
        }, { passive: true });
      }

      function handleKeydown(e) {
        if (gameOver && !continueAfterWin) return;
        const keyMap = { 'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right', 'w': 'up', 's': 'down', 'a': 'left', 'd': 'right' };
        if (keyMap[e.key]) { e.preventDefault(); move(keyMap[e.key]); }
      }

      function createEmptyGrid() { return Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null)); }
      function getEmptyCells() {
        const empty = [];
        for (let r = 0; r < GRID_SIZE; r++) for (let c = 0; c < GRID_SIZE; c++) if (!grid[r][c]) empty.push({ r, c });
        return empty;
      }

      function addRandomTile() {
        const emptyCells = getEmptyCells();
        if (emptyCells.length === 0) return null;
        const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        const value = Math.random() < 0.9 ? 2 : 4;
        grid[r][c] = { id: tileId++, value, r, c, isNew: true, merged: false };
        highestTile = Math.max(highestTile, value);
        return grid[r][c];
      }

      function move(direction) {
        if (gameOver && !continueAfterWin) return;
        previousState = { grid: JSON.parse(JSON.stringify(grid)), score, highestTile, moves };
        let moved = false;
        for (let r = 0; r < GRID_SIZE; r++) for (let c = 0; c < GRID_SIZE; c++) if (grid[r][c]) { grid[r][c].merged = false; grid[r][c].isNew = false; }
        const vectors = { 'up': { r: -1, c: 0 }, 'down': { r: 1, c: 0 }, 'left': { r: 0, c: -1 }, 'right': { r: 0, c: 1 } };
        const vector = vectors[direction];
        const traversals = buildTraversals(vector);
        traversals.r.forEach(r => {
          traversals.c.forEach(c => {
            const tile = grid[r][c];
            if (tile) {
              const positions = findFarthestPosition(r, c, vector);
              const next = positions.next;
              if (next && grid[next.r]?.[next.c]?.value === tile.value && !grid[next.r][next.c].merged) {
                const merged = grid[next.r][next.c];
                merged.value *= 2; merged.merged = true;
                grid[r][c] = null; tile.r = next.r; tile.c = next.c;
                score += merged.value;
                const prevHighest = highestTile;
                highestTile = Math.max(highestTile, merged.value);
                moved = true;
                playSound(merged.value >= 512 ? 'bigmerge' : 'merge');
                if (highestTile > prevHighest && highestTile >= 256 && isPowerOfTwo(highestTile)) submitMilestoneScore(highestTile);
                if (merged.value === WINNING_TILE && !won) { won = true; playSound('win'); setTimeout(() => showWinOverlay(), 300); }
              } else {
                const farthest = positions.farthest;
                if (farthest.r !== r || farthest.c !== c) {
                  grid[farthest.r][farthest.c] = tile; grid[r][c] = null;
                  tile.r = farthest.r; tile.c = farthest.c; moved = true;
                }
              }
            }
          });
        });
        if (moved) {
          playSound('move'); moves++;
          addRandomTile(); render(); updateScore(); saveGame();
          if (!movesAvailable()) { gameOver = true; playSound('lose'); setTimeout(() => showGameOverOverlay(), 500); }
        }
      }

      function buildTraversals(vector) {
        const t = { r: [], c: [] };
        for (let i = 0; i < GRID_SIZE; i++) { t.r.push(i); t.c.push(i); }
        if (vector.r === 1) t.r.reverse();
        if (vector.c === 1) t.c.reverse();
        return t;
      }

      function findFarthestPosition(r, c, vector) {
        let previous;
        do { previous = { r, c }; r += vector.r; c += vector.c; } while (isWithinBounds(r, c) && !grid[r][c]);
        return { farthest: previous, next: isWithinBounds(r, c) ? { r, c } : null };
      }

      function isWithinBounds(r, c) { return r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE; }

      function movesAvailable() {
        if (getEmptyCells().length > 0) return true;
        for (let r = 0; r < GRID_SIZE; r++) for (let c = 0; c < GRID_SIZE; c++) {
          const tile = grid[r][c];
          if (tile) for (const dir of [{ r: 0, c: 1 }, { r: 1, c: 0 }]) {
            const nr = r + dir.r, nc = c + dir.c;
            if (isWithinBounds(nr, nc) && grid[nr][nc]?.value === tile.value) return true;
          }
        }
        return false;
      }

      function undoMove() {
        if (!previousState) return;
        grid = previousState.grid.map(row => row.map(cell => cell ? { ...cell } : null));
        score = previousState.score; highestTile = previousState.highestTile; moves = previousState.moves;
        gameOver = false; previousState = null;
        render(); updateScore();
      }

      function render() {
        tilesContainer.innerHTML = '';
        const gridEl = document.getElementById('grid');
        const cells = gridEl.querySelectorAll('.cell');
        const gridRect = gridEl.getBoundingClientRect();
        const firstCell = cells[0].getBoundingClientRect();
        const secondCell = cells[1].getBoundingClientRect();
        const cellSize = firstCell.width;
        for (let r = 0; r < GRID_SIZE; r++) for (let c = 0; c < GRID_SIZE; c++) {
          const tile = grid[r][c];
          if (tile) {
            const cellRect = cells[r * GRID_SIZE + c].getBoundingClientRect();
            const tileEl = document.createElement('div');
            const tileClass = tile.value <= 8192 ? `tile-${tile.value}` : 'tile-super';
            tileEl.className = `tile ${tileClass}`;
            if (tile.isNew) tileEl.classList.add('new');
            if (tile.merged) tileEl.classList.add('merged');
            tileEl.style.width = `${cellSize}px`;
            tileEl.style.height = `${cellSize}px`;
            tileEl.style.left = `${cellRect.left - gridRect.left}px`;
            tileEl.style.top = `${cellRect.top - gridRect.top}px`;
            tileEl.textContent = tile.value;
            tilesContainer.appendChild(tileEl);
          }
        }
      }

      function updateScore() {
        scoreEl.textContent = score; highestTileEl.textContent = highestTile;
        if (score > bestScore) { bestScore = score; bestScoreEl.textContent = bestScore; localStorage.setItem('2048-best-score', bestScore); }
      }

      function newGame() {
        grid = createEmptyGrid(); score = 0; highestTile = 0; moves = 0;
        gameOver = false; won = false; continueAfterWin = false;
        previousState = null; tileId = 0; gameStartTime = Date.now();
        addRandomTile(); addRandomTile();
        render(); updateScore(); saveGame();
      }

      function saveGame() {
        const state = {
          grid: grid.map(row => row.map(cell => cell ? { value: cell.value, id: cell.id } : null)),
          score, highestTile, moves, won, continueAfterWin, tileId
        };
        localStorage.setItem('2048-game-state', JSON.stringify(state));
      }

      function loadGame() {
        const saved = localStorage.getItem('2048-game-state');
        if (saved) {
          try {
            const state = JSON.parse(saved);
            grid = state.grid.map((row, r) => row.map((cell, c) => cell ? { ...cell, r, c, isNew: false, merged: false } : null));
            score = state.score || 0; highestTile = state.highestTile || 0;
            moves = state.moves || 0; won = state.won || false;
            continueAfterWin = state.continueAfterWin || false; tileId = state.tileId || 0;
            render(); updateScore();
            if (!movesAvailable()) gameOver = true;
          } catch (e) { newGame(); }
        } else { newGame(); }
      }

      function showGameOverOverlay() {
        document.getElementById('overlayIcon').textContent = '\u{1F614}';
        document.getElementById('overlayTitle').textContent = 'Game Over';
        document.getElementById('overlaySubtitle').textContent = 'No more moves available!';
        document.getElementById('finalScore').textContent = score;
        document.getElementById('finalHighestTile').textContent = highestTile;
        document.getElementById('finalMoves').textContent = moves;
        // Reset buttons to default
        const buttonsDiv = document.querySelector('.overlay-buttons');
        buttonsDiv.innerHTML = '';
        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn'; closeBtn.textContent = 'Close';
        closeBtn.addEventListener('click', hideOverlay);
        const playBtn = document.createElement('button');
        playBtn.className = 'btn btn-primary'; playBtn.textContent = 'Play Again';
        playBtn.addEventListener('click', () => { newGame(); hideOverlay(); });
        buttonsDiv.appendChild(closeBtn);
        buttonsDiv.appendChild(playBtn);
        document.getElementById('gameOverlay').classList.add('show');
        submitScore();
        saveCloudState();
      }

      function showWinOverlay() {
        document.getElementById('overlayIcon').textContent = '\u{1F389}';
        document.getElementById('overlayTitle').textContent = 'You Win!';
        document.getElementById('overlaySubtitle').textContent = 'You reached 2048! Keep going?';
        document.getElementById('finalScore').textContent = score;
        document.getElementById('finalHighestTile').textContent = highestTile;
        document.getElementById('finalMoves').textContent = moves;
        const buttonsDiv = document.querySelector('.overlay-buttons');
        buttonsDiv.innerHTML = '';
        const newBtn = document.createElement('button');
        newBtn.className = 'btn'; newBtn.textContent = 'New Game';
        newBtn.addEventListener('click', () => { newGame(); hideOverlay(); });
        const keepBtn = document.createElement('button');
        keepBtn.className = 'btn btn-primary'; keepBtn.textContent = 'Keep Playing';
        keepBtn.addEventListener('click', continueGame);
        buttonsDiv.appendChild(newBtn);
        buttonsDiv.appendChild(keepBtn);
        document.getElementById('gameOverlay').classList.add('show');
        submitScore();
        saveCloudState();
      }

      function continueGame() {
        continueAfterWin = true; gameOver = false; hideOverlay();
      }

      function hideOverlay() { document.getElementById('gameOverlay').classList.remove('show'); }
      function isPowerOfTwo(n) { return n > 0 && (n & (n - 1)) === 0; }
      function submitMilestoneScore(milestone) { submitScore(true); }

      async function submitScore(isMilestone) {
        const scoreData = {
          score: score, timeMs: Date.now() - gameStartTime,
          level: Math.floor(Math.log2(highestTile || 2)),
          metadata: { highestTile, moves, isMilestone: !!isMilestone }
        };
        const result = await window.gameCloud.submitOrQueue('2048', scoreData, { silent: !!isMilestone });
        if (result) loadLeaderboard();
      }

      let cloudState2048 = null;
      async function saveCloudState() {
        const prev = cloudState2048 || {};
        const state = {
          currentLevel: Math.floor(Math.log2(highestTile || 2)),
          currentStreak: 0,
          bestStreak: Math.max(prev.bestStreak || 0, Math.floor(Math.log2(highestTile || 2))),
          gamesPlayed: (prev.gamesPlayed || 0) + 1,
          gamesWon: (prev.gamesWon || 0) + (won ? 1 : 0),
          lastPlayedDate: new Date().toISOString().split('T')[0],
          additionalData: { bestScore, highestTile, totalMoves: moves }
        };
        await window.gameCloud.saveState('2048', state);
        cloudState2048 = state;
        if (state.gamesPlayed === 1) {
          window.gameCloud.unlockAchievement('first_word', '2048');
        }
        if (state.gamesWon >= 10) {
          window.gameCloud.unlockAchievement('ten_wins', '2048');
        }
      }

      async function loadLeaderboard() {
        const list = document.getElementById('leaderboardList');
        if (!window.apiClient) {
          list.innerHTML = '<li class="leaderboard-item"><span class="lb-name" style="text-align:center;width:100%">Sign in to see leaderboard</span></li>';
          return;
        }
        try {
          const entries = await window.apiClient.getLeaderboard('2048', 'daily', 5);
          if (!entries?.length) {
            list.innerHTML = '<li class="leaderboard-item"><span class="lb-name" style="text-align:center;width:100%">No scores yet. Be the first!</span></li>';
            return;
          }
          list.innerHTML = '';
          entries.forEach((entry, i) => {
            const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
            const displayName = entry.odName || entry.displayName || 'Player';
            const rawAvatarUrl = entry.odAvatarUrl || entry.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;
            const avatarUrl = rawAvatarUrl.startsWith('https://') ? rawAvatarUrl : `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;
            const li = document.createElement('li');
            li.className = 'leaderboard-item';
            const rank = document.createElement('span'); rank.className = `lb-rank ${rankClass}`; rank.textContent = i + 1;
            const avatar = document.createElement('img'); avatar.className = 'lb-avatar'; avatar.src = avatarUrl; avatar.alt = '';
            const name = document.createElement('span'); name.className = 'lb-name'; name.textContent = displayName;
            const scoreSpan = document.createElement('span'); scoreSpan.className = 'lb-score'; scoreSpan.textContent = entry.score.toLocaleString();
            li.appendChild(rank); li.appendChild(avatar); li.appendChild(name); li.appendChild(scoreSpan);
            list.appendChild(li);
          });
        } catch (error) {
          list.innerHTML = '<li class="leaderboard-item"><span class="lb-name" style="text-align:center;width:100%">Failed to load</span></li>';
        }
      }

      init();
    })();
