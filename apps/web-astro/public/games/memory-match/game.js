(function() {
    'use strict';

    // HTML escape helper for safe rendering
    function escapeHTML(str) {
      var div = document.createElement('div');
      div.appendChild(document.createTextNode(str));
      return div.innerHTML;
    }

    // Emoji sets for different themes
    const EMOJI_SETS = {
      animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵'],
      food: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🥝', '🍍', '🥥', '🍔', '🍕'],
      sports: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥊', '🎯', '⛳', '🎿', '🏂'],
      nature: ['🌸', '🌺', '🌻', '🌹', '🌷', '🌼', '🌴', '🌵', '🍀', '🍁', '🍂', '🌙', '⭐', '🌈', '❄️'],
      objects: ['🎮', '🎨', '🎭', '🎪', '🎢', '🚀', '⛵', '🚗', '✈️', '🏠', '💎', '🔮', '🎁', '🎈', '🎩']
    };

    // Game state
    let gameState = {
      difficulty: 'easy',
      mode: 'classic',
      cards: [],
      flippedCards: [],
      matchedPairs: 0,
      totalPairs: 0,
      moves: 0,
      score: 0,
      combo: 0,
      maxCombo: 0,
      timer: 0,
      timerInterval: null,
      isPlaying: false,
      soundEnabled: true,
      isDaily: false,
      powerups: {
        peek: 3,
        shuffle: 2,
        freeze: 1
      },
      frozen: false,
      lockBoard: false
    };

    // Difficulty configs
    const DIFFICULTY_CONFIG = {
      easy: { rows: 3, cols: 4, pairs: 6, time: 120, maxMoves: 20 },
      medium: { rows: 4, cols: 4, pairs: 8, time: 90, maxMoves: 24 },
      hard: { rows: 4, cols: 5, pairs: 10, time: 60, maxMoves: 28 }
    };

    // DOM Elements
    const menuScreen = document.getElementById('menuScreen');
    const gameBoard = document.getElementById('gameBoard');
    const scoreValue = document.getElementById('scoreValue');
    const matchesValue = document.getElementById('matchesValue');
    const movesValue = document.getElementById('movesValue');
    const timerValue = document.getElementById('timerValue');
    const timerStat = document.getElementById('timerStat');
    const comboBadge = document.getElementById('comboBadge');
    const streakBadge = document.getElementById('streakBadge');
    const comboPopup = document.getElementById('comboPopup');
    const resultsModal = document.getElementById('resultsModal');

    // Sound elements
    const flipSound = document.getElementById('flipSound');
    const matchSound = document.getElementById('matchSound');
    const comboSound = document.getElementById('comboSound');

    // Initialize menu
    function initMenu() {
      // Difficulty buttons
      document.querySelectorAll('#difficultyButtons .mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('#difficultyButtons .mode-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          gameState.difficulty = btn.dataset.difficulty;
        });
      });

      // Mode buttons
      document.querySelectorAll('#modeButtons .mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('#modeButtons .mode-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          gameState.mode = btn.dataset.mode;
        });
      });

      // Daily challenge
      const dailyBtn = document.getElementById('dailyChallengeBtn');
      const dailyData = getDailyChallenge();
      if (dailyData.completed) {
        dailyBtn.classList.add('completed');
        dailyBtn.innerHTML = '&#10004; Daily Complete!';
      }
      dailyBtn.addEventListener('click', startDailyChallenge);

      // Start button
      document.getElementById('startBtn').addEventListener('click', startGame);

      // Power-up buttons
      document.getElementById('peekBtn').addEventListener('click', usePeek);
      document.getElementById('shuffleBtn').addEventListener('click', useShuffle);
      document.getElementById('freezeBtn').addEventListener('click', useFreeze);

      // Modal buttons
      document.getElementById('playAgainBtn').addEventListener('click', () => {
        resultsModal.classList.remove('show');
        startGame();
      });
      document.getElementById('menuModalBtn').addEventListener('click', () => {
        resultsModal.classList.remove('show');
        showMenu();
      });

      // Check for saved streak
      const savedStreak = localStorage.getItem('memory-match-streak') || '0';
      streakBadge.innerHTML = '&#128293; ' + escapeHTML(savedStreak);
    }

    // Get daily challenge data
    function getDailyChallenge() {
      const today = new Date().toDateString();
      const saved = JSON.parse(localStorage.getItem('memory-match-daily') || '{}');
      return {
        completed: saved.date === today && saved.completed,
        seed: hashCode(today)
      };
    }

    function hashCode(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash);
    }

    // Start daily challenge
    function startDailyChallenge() {
      const daily = getDailyChallenge();
      if (daily.completed) {
        alert('You already completed today\'s challenge! Come back tomorrow.');
        return;
      }
      gameState.isDaily = true;
      gameState.difficulty = 'hard';
      gameState.mode = 'timed';
      startGame(daily.seed);
    }

    // Show menu
    function showMenu() {
      stopTimer();
      gameState.isPlaying = false;
      menuScreen.classList.remove('hidden');
    }

    // Toggle sound
    function toggleSound() {
      gameState.soundEnabled = !gameState.soundEnabled;
      var btn = document.getElementById('ghSoundBtn');
      if (btn) btn.classList.toggle('muted', !gameState.soundEnabled);
    }

    // Unlock audio for iOS - play/pause on user gesture
    let audioUnlocked = false;
    function unlockAudio() {
      if (audioUnlocked) return;
      const sounds = [flipSound, matchSound, comboSound];
      sounds.forEach(sound => {
        sound.play().then(() => {
          sound.pause();
          sound.currentTime = 0;
        }).catch(() => {});
      });
      audioUnlocked = true;
    }

    ['touchstart', 'mousedown', 'keydown'].forEach(event => {
      document.addEventListener(event, unlockAudio, { once: true });
    });

    // Play sound
    function playSound(sound) {
      if (!gameState.soundEnabled) return;
      sound.currentTime = 0;
      sound.play().catch(() => {});
    }

    // Get shuffled emojis
    function getShuffledEmojis(count, seed = null) {
      // Combine all emoji sets for random theme
      const allEmojis = Object.values(EMOJI_SETS).flat();

      // Seeded random for daily challenge
      const random = seed !== null
        ? seededRandom(seed)
        : () => Math.random();

      // Shuffle and pick
      const shuffled = [...allEmojis].sort(() => random() - 0.5);
      const selected = shuffled.slice(0, count);

      // Create pairs and shuffle
      const pairs = [...selected, ...selected];
      return pairs.sort(() => random() - 0.5);
    }

    function seededRandom(seed) {
      return function() {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };
    }

    // Start game
    function startGame(seed = null) {
      const config = DIFFICULTY_CONFIG[gameState.difficulty];

      // Reset state
      gameState.cards = [];
      gameState.flippedCards = [];
      gameState.matchedPairs = 0;
      gameState.totalPairs = config.pairs;
      gameState.moves = 0;
      gameState.maxMoves = (gameState.mode === 'classic') ? config.maxMoves : 0;
      gameState.score = 0;
      gameState.combo = 0;
      gameState.maxCombo = 0;
      gameState.timer = gameState.mode === 'timed' ? config.time : 0;
      gameState.isPlaying = true;
      gameState.frozen = false;
      gameState.lockBoard = false;
      gameState.powerups = { peek: 3, shuffle: 2, freeze: 1 };

      // Update power-up counts
      updatePowerupCounts();

      // Hide menu
      menuScreen.classList.add('hidden');

      // Create cards
      const emojis = getShuffledEmojis(config.pairs, seed);
      createBoard(config, emojis);

      // Update UI
      updateUI();

      // Start timer
      startTimer();

      // Quick peek at start
      setTimeout(() => {
        if (gameState.mode !== 'zen') {
          peekAllCards(1500);
        }
      }, 500);
    }

    // Create game board
    function createBoard(config, emojis) {
      gameBoard.innerHTML = '';
      gameBoard.className = `game-board ${gameState.difficulty}`;

      // Calculate card size
      const containerWidth = Math.min(window.innerWidth - 32, 500);
      const cardSize = Math.floor((containerWidth - (config.cols - 1) * 8) / config.cols);

      emojis.forEach((emoji, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.index = index;
        card.dataset.emoji = emoji;
        card.style.width = `${cardSize}px`;
        card.style.height = `${cardSize}px`;

        card.innerHTML = `
          <div class="card-face card-back"></div>
          <div class="card-face card-front">${emoji}</div>
        `;

        card.addEventListener('click', () => flipCard(card));
        gameBoard.appendChild(card);
        gameState.cards.push(card);
      });
    }

    // Flip card
    function flipCard(card) {
      if (gameState.lockBoard) return;
      if (!gameState.isPlaying) return;
      if (card.classList.contains('flipped')) return;
      if (card.classList.contains('matched')) return;
      if (gameState.flippedCards.length >= 2) return;

      playSound(flipSound);
      card.classList.add('flipped');
      gameState.flippedCards.push(card);

      if (gameState.flippedCards.length === 2) {
        gameState.moves++;
        checkMatch();

        // Check move limit (Classic mode)
        if (gameState.maxMoves > 0 && gameState.moves >= gameState.maxMoves && gameState.matchedPairs < gameState.totalPairs) {
          setTimeout(() => {
            if (gameState.matchedPairs < gameState.totalPairs) {
              endGame(false);
            }
          }, 800); // Wait for match/mismatch animation to finish
        }
      }

      updateUI();
    }

    // Check for match
    function checkMatch() {
      gameState.lockBoard = true;
      const [card1, card2] = gameState.flippedCards;
      const match = card1.dataset.emoji === card2.dataset.emoji;

      if (match) {
        handleMatch(card1, card2);
      } else {
        handleMismatch(card1, card2);
      }
    }

    // Handle match
    function handleMatch(card1, card2) {
      gameState.matchedPairs++;
      gameState.combo++;

      if (gameState.combo > gameState.maxCombo) {
        gameState.maxCombo = gameState.combo;
      }

      // Calculate score with combo multiplier
      const baseScore = 100;
      const comboMultiplier = Math.min(gameState.combo, 5);
      const pointsEarned = baseScore * comboMultiplier;

      if (gameState.mode !== 'zen') {
        gameState.score += pointsEarned;
      }

      // Show combo popup
      if (gameState.combo >= 2) {
        showComboPopup(gameState.combo);
        playSound(comboSound);
      } else {
        playSound(matchSound);
      }

      // Update combo badge
      updateComboBadge();

      setTimeout(() => {
        card1.classList.add('matched');
        card2.classList.add('matched');
        gameState.flippedCards = [];
        gameState.lockBoard = false;
        updateUI();

        // Check win
        if (gameState.matchedPairs === gameState.totalPairs) {
          endGame(true);
        }
      }, 300);
    }

    // Handle mismatch
    function handleMismatch(card1, card2) {
      gameState.combo = 0;
      updateComboBadge();

      setTimeout(() => {
        card1.classList.add('wrong');
        card2.classList.add('wrong');

        setTimeout(() => {
          card1.classList.remove('flipped', 'wrong');
          card2.classList.remove('flipped', 'wrong');
          gameState.flippedCards = [];
          gameState.lockBoard = false;
        }, 500);
      }, 500);
    }

    // Show combo popup
    function showComboPopup(combo) {
      comboPopup.textContent = `x${combo} COMBO!`;
      comboPopup.style.color = combo >= 5 ? '#ffd700' : combo >= 3 ? '#ff6b8a' : '#e94560';
      comboPopup.classList.remove('show');
      void comboPopup.offsetWidth;
      comboPopup.classList.add('show');
    }

    // Update combo badge
    function updateComboBadge() {
      if (gameState.combo >= 2) {
        comboBadge.textContent = `x${gameState.combo} COMBO`;
        comboBadge.classList.add('active');
      } else {
        comboBadge.classList.remove('active');
      }
    }

    // Update UI
    function updateUI() {
      scoreValue.textContent = gameState.score;
      matchesValue.textContent = `${gameState.matchedPairs}/${gameState.totalPairs}`;
      movesValue.textContent = gameState.maxMoves > 0
        ? `${gameState.moves}/${gameState.maxMoves}`
        : gameState.moves;
    }

    // Timer
    function startTimer() {
      stopTimer();
      updateTimerDisplay();

      gameState.timerInterval = setInterval(() => {
        if (gameState.frozen) return;

        if (gameState.mode === 'timed') {
          gameState.timer--;
          if (gameState.timer <= 0) {
            endGame(false);
            return;
          }
          // Warning states
          if (gameState.timer <= 10) {
            timerStat.classList.add('danger');
            timerStat.classList.remove('warning');
          } else if (gameState.timer <= 30) {
            timerStat.classList.add('warning');
            timerStat.classList.remove('danger');
          }
        } else {
          gameState.timer++;
        }
        updateTimerDisplay();
      }, 1000);
    }

    function stopTimer() {
      if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
      }
      timerStat.classList.remove('warning', 'danger');
    }

    function updateTimerDisplay() {
      const minutes = Math.floor(gameState.timer / 60);
      const seconds = gameState.timer % 60;
      timerValue.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    // Power-ups
    function updatePowerupCounts() {
      document.getElementById('peekCount').textContent = gameState.powerups.peek;
      document.getElementById('shuffleCount').textContent = gameState.powerups.shuffle;
      document.getElementById('freezeCount').textContent = gameState.powerups.freeze;

      document.getElementById('peekBtn').disabled = gameState.powerups.peek <= 0;
      document.getElementById('shuffleBtn').disabled = gameState.powerups.shuffle <= 0;
      document.getElementById('freezeBtn').disabled = gameState.powerups.freeze <= 0 || gameState.mode !== 'timed';
    }

    function usePeek() {
      if (gameState.powerups.peek <= 0 || gameState.lockBoard) return;
      gameState.powerups.peek--;
      updatePowerupCounts();
      peekAllCards(2000);
    }

    function peekAllCards(duration) {
      gameState.lockBoard = true;
      gameState.cards.forEach(card => {
        if (!card.classList.contains('matched')) {
          card.classList.add('flipped', 'peek');
        }
      });

      setTimeout(() => {
        gameState.cards.forEach(card => {
          if (!card.classList.contains('matched')) {
            card.classList.remove('flipped', 'peek');
          }
        });
        gameState.flippedCards = [];
        gameState.lockBoard = false;
      }, duration);
    }

    function useShuffle() {
      if (gameState.powerups.shuffle <= 0 || gameState.lockBoard) return;
      gameState.powerups.shuffle--;
      updatePowerupCounts();

      gameState.lockBoard = true;

      // Get unmatched cards
      const unmatchedCards = gameState.cards.filter(c => !c.classList.contains('matched'));
      const emojis = unmatchedCards.map(c => c.dataset.emoji);

      // Shuffle emojis
      for (let i = emojis.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [emojis[i], emojis[j]] = [emojis[j], emojis[i]];
      }

      // Flip all unmatched cards
      unmatchedCards.forEach(card => card.classList.add('flipped'));

      setTimeout(() => {
        // Reassign emojis
        unmatchedCards.forEach((card, index) => {
          card.dataset.emoji = emojis[index];
          card.querySelector('.card-front').textContent = emojis[index];
        });

        // Flip back
        setTimeout(() => {
          unmatchedCards.forEach(card => card.classList.remove('flipped'));
          gameState.flippedCards = [];
          gameState.lockBoard = false;
        }, 500);
      }, 500);
    }

    function useFreeze() {
      if (gameState.powerups.freeze <= 0 || gameState.mode !== 'timed') return;
      gameState.powerups.freeze--;
      updatePowerupCounts();

      gameState.frozen = true;
      gameBoard.classList.add('frozen');
      document.getElementById('freezeBtn').classList.add('active');

      setTimeout(() => {
        gameState.frozen = false;
        gameBoard.classList.remove('frozen');
        document.getElementById('freezeBtn').classList.remove('active');
      }, 10000);
    }

    // End game
    function endGame(won) {
      stopTimer();
      gameState.isPlaying = false;

      // Update streak
      let streak = parseInt(localStorage.getItem('memory-match-streak') || '0');
      if (won) {
        streak++;
        localStorage.setItem('memory-match-streak', streak);
      } else {
        localStorage.setItem('memory-match-streak', '0');
        streak = 0;
      }
      streakBadge.innerHTML = '&#128293; ' + escapeHTML(String(streak));

      // Daily challenge completion
      if (gameState.isDaily && won) {
        localStorage.setItem('memory-match-daily', JSON.stringify({
          date: new Date().toDateString(),
          completed: true,
          score: gameState.score,
          time: gameState.timer
        }));
        document.getElementById('dailyChallengeBtn').classList.add('completed');
        document.getElementById('dailyChallengeBtn').innerHTML = '&#10004; Daily Complete!';
      }

      // Submit score and save state
      submitScore(won);
      saveCloudState(won);

      // Show results modal
      setTimeout(() => {
        showResults(won);
      }, 500);
    }

    function showResults(won) {
      const outOfMoves = !won && gameState.maxMoves > 0 && gameState.moves >= gameState.maxMoves;
      document.getElementById('modalIcon').textContent = won ? '🏆' : (outOfMoves ? '🃏' : '⏰');
      document.getElementById('modalTitle').textContent = won ? 'Great Job!' : (outOfMoves ? 'Out of Moves!' : 'Time\'s Up!');
      document.getElementById('modalSubtitle').textContent = won
        ? 'You matched all pairs!'
        : `You found ${gameState.matchedPairs} of ${gameState.totalPairs} pairs`;

      document.getElementById('finalScore').textContent = gameState.score;
      document.getElementById('finalTime').textContent = timerValue.textContent;
      document.getElementById('finalMoves').textContent = gameState.moves;
      document.getElementById('finalCombo').textContent = `x${gameState.maxCombo}`;

      resultsModal.classList.add('show');
    }

    // Auth state management
    let currentUser = null;
    let cloudStateMemory = null;

    // Submit score via gameCloud (handles guest queueing automatically)
    async function submitScore(won) {
      if (gameState.mode === 'zen') return;

      const scoreData = {
        score: gameState.score,
        timeMs: Math.round(gameState.timer * 1000),
        metadata: {
          difficulty: gameState.difficulty,
          mode: gameState.mode,
          moves: gameState.moves,
          time: gameState.timer,
          maxCombo: gameState.maxCombo,
          won: won,
          isDaily: gameState.isDaily
        }
      };

      await window.gameCloud.submitOrQueue('memory-match', scoreData);
    }

    // Cloud state functions
    async function saveCloudState(won) {
      if (!currentUser) return;

      const prevGamesPlayed = cloudStateMemory?.gamesPlayed || 0;
      const prevGamesWon = cloudStateMemory?.gamesWon || 0;
      const prevBestStreak = cloudStateMemory?.bestStreak || 0;

      const state = {
        currentLevel: 1,
        currentStreak: 0,
        bestStreak: Math.max(prevBestStreak, gameState.maxCombo),
        gamesPlayed: prevGamesPlayed + 1,
        gamesWon: prevGamesWon + (won ? 1 : 0),
        lastPlayedDate: new Date().toISOString().split('T')[0],
        additionalData: {
          bestScore: Math.max(cloudStateMemory?.additionalData?.bestScore || 0, gameState.score),
          bestTime: Math.min(cloudStateMemory?.additionalData?.bestTime || 9999, gameState.timer),
          bestMoves: Math.min(cloudStateMemory?.additionalData?.bestMoves || 9999, gameState.moves)
        }
      };

      await window.gameCloud.saveState('memory-match', state);
      cloudStateMemory = state;

      // Check achievements
      checkAchievementsMemory(state);
    }

    async function loadCloudState() {
      cloudStateMemory = await window.gameCloud.loadState('memory-match');
    }

    async function checkAchievementsMemory(state) {
      if (!currentUser) return;
      if (state.gamesPlayed === 1) {
        await window.gameCloud.unlockAchievement('first_word', 'memory-match');
      }
      if (state.gamesWon >= 10) {
        await window.gameCloud.unlockAchievement('ten_wins', 'memory-match');
      }
    }

    function initAuth() {
      if (!window.gameCloud) return;
      window.gameCloud.initAuth({
        authBtnId: 'authBtn',
        onSignIn: (user) => {
          currentUser = user;
          loadCloudState();
          window.gameCloud.syncGuestScores('memory-match');
        },
        onSignOut: () => {
          currentUser = null;
          cloudStateMemory = null;
        }
      });
    }

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
      if (window.gameHeader) {
        window.gameHeader.init({
          title: 'Memory Match',
          icon: '\uD83C\uDCCF',
          gameId: 'memory-match',
          buttons: ['sound', 'leaderboard', 'menu', 'auth'],
          onSound: () => toggleSound(),
          onMenu: () => showMenu(),
          soundBtnId: 'ghSoundBtn',
          authBtnId: 'authBtn',
        });
      }
      initMenu();
      initAuth();
    });
  })();
