(function() {
    'use strict';

    // ============================================
    // FIELDSTONE - Kingdom Builder Puzzle
    // ============================================

    // Shared header
    const headerApi = window.gameHeader.init({
      title: 'Fieldstone',
      icon: '🏰',
      gameId: 'fieldstone',
      buttons: ['sound', 'leaderboard'],
      onSound: () => { toggleSound(); },
      soundBtnId: 'soundBtn',
    });

    // HTML sanitizer for user-supplied strings
    function escapeHTML(str) {
      const div = document.createElement('div');
      div.appendChild(document.createTextNode(str));
      return div.innerHTML;
    }

    // Sound System using Web Audio API
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    let audioCtx = null;
    let soundEnabled = true;
    let audioUnlocked = false;

    function unlockAudio() {
      if (audioUnlocked) return;
      initAudio();
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      if (audioCtx) {
        // Play silent buffer to fully unlock on iOS
        const buffer = audioCtx.createBuffer(1, 1, 22050);
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.start(0);
      }
      audioUnlocked = true;
    }

    ['touchstart', 'mousedown', 'keydown'].forEach(event => {
      document.addEventListener(event, unlockAudio, { once: true });
    });

    // Auth state
    let currentUser = null;

    function initAudio() {
      if (!audioCtx) {
        try {
          audioCtx = new AudioCtx();
        } catch(e) {
          // audio not supported
          soundEnabled = false;
        }
      }
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    }

    function playSound(type) {
      if (!soundEnabled) return;
      if (!audioCtx) initAudio();
      if (!audioCtx) return;

      try {
        const now = audioCtx.currentTime;

        switch(type) {
          case 'move': {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = 200;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
            break;
          }

          case 'rotate': {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
            break;
          }

          case 'drop': {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = 150;
            osc.type = 'triangle';
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
            break;
          }

          case 'lock': {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = 100;
            osc.type = 'square';
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
            break;
          }

          case 'clear':
            [400, 500, 600, 800].forEach((freq, i) => {
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.frequency.value = freq;
              osc.type = 'sine';
              gain.gain.setValueAtTime(0.12, now + i * 0.08);
              gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.15);
              osc.start(now + i * 0.08);
              osc.stop(now + i * 0.08 + 0.15);
            });
            break;

          case 'hardDrop': {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
            osc.type = 'sawtooth';
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
            break;
          }

          case 'attack': {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = 60;
            osc.type = 'triangle';
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
            break;
          }

          case 'victory':
            [523, 659, 784, 1047].forEach((freq, i) => {
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.frequency.value = freq;
              osc.type = 'sine';
              gain.gain.setValueAtTime(0.15, now + i * 0.15);
              gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.4);
              osc.start(now + i * 0.15);
              osc.stop(now + i * 0.15 + 0.4);
            });
            break;

          case 'defeat': {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
            osc.type = 'sawtooth';
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
            break;
          }

          case 'buy': {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.setValueAtTime(800, now + 0.05);
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
            break;
          }
        }
      } catch(e) {
        // sound playback error
      }
    }

    // Game Constants
    const BOARD_WIDTH = 10;
    const BOARD_HEIGHT = 20;
    const TILES_PER_ROUND = 10;

    // Terrain Types
    const TERRAIN = {
      EMPTY: 0,
      FOREST: 1,
      PLAINS: 2,
      MOUNTAIN: 3,
      RIVER: 4,
      SETTLEMENT: 5,
      WALL: 6,
      CURSED: 7  // Negative terrain - reduces adjacent output (wave 6+)
    };

    const TERRAIN_COLORS = {
      [TERRAIN.FOREST]: 'forest',
      [TERRAIN.PLAINS]: 'plains',
      [TERRAIN.MOUNTAIN]: 'mountain',
      [TERRAIN.RIVER]: 'river',
      [TERRAIN.SETTLEMENT]: 'settlement',
      [TERRAIN.WALL]: 'wall',
      [TERRAIN.CURSED]: 'cursed'
    };

    const TERRAIN_ICONS = {
      [TERRAIN.FOREST]: '🌲',
      [TERRAIN.PLAINS]: '🌾',
      [TERRAIN.MOUNTAIN]: '⛰️',
      [TERRAIN.RIVER]: '💧',
      [TERRAIN.SETTLEMENT]: '🏠',
      [TERRAIN.WALL]: '🧱',
      [TERRAIN.CURSED]: '💀'
    };

    // Tetromino Shapes
    const TETROMINOES = [
      [[1,1,1,1]], // I
      [[1,1],[1,1]], // O
      [[0,1,1],[1,1,0]], // S
      [[1,1,0],[0,1,1]], // Z
      [[1,0,0],[1,1,1]], // J
      [[0,0,1],[1,1,1]], // L
      [[0,1,0],[1,1,1]]  // T
    ];

    // Card Definitions
    const ALL_CARDS = [
      // Buildings (6 total)
      { id: 'lumber_mill', name: 'Lumber Mill', icon: '🪚', type: 'building', desc: '+50% Lumber production', cost: { gold: 3 }, effect: 'lumber_bonus' },
      { id: 'granary', name: 'Granary', icon: '🏪', type: 'building', desc: '+50% Food production', cost: { gold: 3 }, effect: 'food_bonus' },
      { id: 'quarry', name: 'Quarry', icon: '⛏️', type: 'building', desc: '+50% Stone production', cost: { gold: 3 }, effect: 'stone_bonus' },
      { id: 'treasury', name: 'Treasury', icon: '🏦', type: 'building', desc: '+10% Gold per round', cost: { gold: 5 }, effect: 'gold_bonus' },
      { id: 'watchtower', name: 'Watchtower', icon: '🗼', type: 'building', desc: '+20 Defence', cost: { stone: 5 }, effect: 'defence_bonus' },
      { id: 'mill', name: 'Water Mill', icon: '💧', type: 'building', desc: '+50% Gold from Rivers', cost: { gold: 4 }, effect: 'river_bonus' },
      // Units (8 total)
      { id: 'spearmen', name: 'Spearmen', icon: '🗡️', type: 'unit', desc: 'Block 30 damage', cost: { food: 4 }, power: 30 },
      { id: 'archers', name: 'Archers', icon: '🏹', type: 'unit', desc: 'Deal 40 damage', cost: { lumber: 4 }, power: 40 },
      { id: 'knights', name: 'Knights', icon: '🐴', type: 'unit', desc: 'Block 60 damage', cost: { food: 6, gold: 4 }, power: 60 },
      { id: 'catapult', name: 'Catapult', icon: '💥', type: 'unit', desc: 'Deal 80 damage', cost: { stone: 8, lumber: 4 }, power: 80 },
      { id: 'general', name: 'General', icon: '⚔️', type: 'unit', desc: 'All units +50% power', cost: { gold: 12 }, power: 0, effect: 'unit_boost' },
      { id: 'pikemen', name: 'Pikemen', icon: '🔱', type: 'unit', desc: 'Block 45 damage', cost: { food: 5, lumber: 2 }, power: 45 },
      { id: 'crossbowmen', name: 'Crossbowmen', icon: '🎯', type: 'unit', desc: 'Deal 55 damage', cost: { lumber: 6, gold: 2 }, power: 55 },
      { id: 'cavalry', name: 'Cavalry', icon: '🏇', type: 'unit', desc: 'Deal 70 damage', cost: { food: 8, gold: 3 }, power: 70 },
      // Spells (4 total)
      { id: 'terraform', name: 'Terraform', icon: '🔄', type: 'spell', desc: 'Change tile terrain', cost: { gold: 5 }, effect: 'terraform' },
      { id: 'harvest_bonus', name: 'Bountiful Harvest', icon: '✨', type: 'spell', desc: 'Double next harvest', cost: { gold: 4 }, effect: 'double_harvest' },
      { id: 'reinforcements', name: 'Reinforcements', icon: '🛡️', type: 'spell', desc: '+50 Defence this wave', cost: { gold: 6 }, effect: 'temp_defence' },
      { id: 'siege_break', name: 'Siege Break', icon: '🔥', type: 'spell', desc: 'Destroy 50 enemy power', cost: { gold: 10 }, effect: 'siege_break' },
      // Jokers (2 total) - Rare permanent run modifiers
      { id: 'gold_rush', name: 'Gold Rush', icon: '🏔️', type: 'joker', desc: 'Mountains also produce +1 Gold', cost: { gold: 15 }, effect: 'gold_rush' },
      { id: 'feudal_lord', name: 'Feudal Lord', icon: '👑', type: 'joker', desc: 'Settlements count as all terrains', cost: { gold: 15 }, effect: 'feudal_lord' }
    ];

    // Starting Decks
    const STARTING_DECKS = {
      farmer: ['granary', 'spearmen', 'spearmen', 'harvest_bonus'],
      mason: ['quarry', 'watchtower', 'catapult', 'reinforcements'],
      merchant: ['treasury', 'archers', 'knights', 'terraform']
    };

    // Game State
    let gameState = {
      board: [],
      harvestedRows: [],  // Track which rows have been harvested (they stay but can't harvest again)
      currentPiece: null,
      nextPiece: null,
      pieceX: 0,
      pieceY: 0,
      resources: { lumber: 10, food: 10, stone: 10, gold: 5 },
      score: 0,
      wave: 1,
      tilesPlaced: 0,
      cards: [],
      buildings: [],
      jokers: [],        // Permanent run modifiers
      tempEffects: [],
      gameOver: false,
      selectedDeck: 'farmer',
      dropInterval: null,
      lastDrop: 0,
      startTime: 0
    };

    // ============================================
    // META-PROGRESSION SYSTEM (Hearthstones)
    // ============================================

    const META_STORAGE_KEY = 'fieldstone_meta';

    // Unlock tiers per PRD
    const UNLOCK_TIERS = [
      { tier: 1, cost: 50, name: 'Apprentice', reward: 'Unlocks Water Mill card', unlocks: ['mill'] },
      { tier: 2, cost: 150, name: 'Builder', reward: 'Unlocks 2 new Jokers', unlocks: ['gold_rush', 'feudal_lord'] },
      { tier: 3, cost: 300, name: 'Commander', reward: 'Unlocks General + Cavalry', unlocks: ['general', 'cavalry'] },
      { tier: 4, cost: 500, name: 'Warlord', reward: 'Unlocks all Units', unlocks: ['pikemen', 'crossbowmen'] },
      { tier: 5, cost: 1000, name: 'Legend', reward: 'All cards unlocked!', unlocks: ['siege_break'] }
    ];

    // Load meta progress from localStorage
    function loadMetaProgress() {
      try {
        const saved = localStorage.getItem(META_STORAGE_KEY);
        if (saved) {
          return JSON.parse(saved);
        }
      } catch (e) {
        // failed to load meta progress
      }
      return {
        hearthstones: 0,
        totalHearthstones: 0,
        highScore: 0,
        totalRuns: 0,
        victories: 0,
        currentTier: 0,
        unlockedCards: []
      };
    }

    // Save meta progress to localStorage
    function saveMetaProgress(meta) {
      try {
        localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
      } catch (e) {
        // failed to save meta progress
      }
    }

    // Calculate Hearthstones earned from a run
    function calculateHearthstones(score, wave, victory) {
      let earned = Math.floor(score / 10); // Base: 1 hearthstone per 10 points
      if (victory) earned += 50;            // Victory bonus
      earned += wave * 5;                   // Wave bonus
      return earned;
    }

    // Check and apply unlocks
    function checkUnlocks(meta) {
      let newUnlocks = [];
      UNLOCK_TIERS.forEach(tier => {
        if (meta.totalHearthstones >= tier.cost && meta.currentTier < tier.tier) {
          meta.currentTier = tier.tier;
          tier.unlocks.forEach(cardId => {
            if (!meta.unlockedCards.includes(cardId)) {
              meta.unlockedCards.push(cardId);
              newUnlocks.push(cardId);
            }
          });
        }
      });
      return newUnlocks;
    }

    // Get current tier info
    function getCurrentTierInfo(meta) {
      const currentTier = UNLOCK_TIERS.find(t => t.tier === meta.currentTier) || { name: 'Peasant', tier: 0 };
      const nextTier = UNLOCK_TIERS.find(t => t.tier === meta.currentTier + 1);
      return { current: currentTier, next: nextTier };
    }

    // Get all cards that require unlocking
    const LOCKED_CARDS = UNLOCK_TIERS.flatMap(tier => tier.unlocks);

    // Check if a card is available (base card or unlocked)
    function isCardAvailable(cardId) {
      if (!LOCKED_CARDS.includes(cardId)) return true; // Base card
      return metaProgress.unlockedCards.includes(cardId); // Check if unlocked
    }

    let metaProgress = loadMetaProgress();

    // Initialize Board
    function initBoard() {
      gameState.board = Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(TERRAIN.EMPTY));
      gameState.harvestedRows = []; // Reset harvested rows for new game
      gameState.jokers = [];        // Reset jokers for new run
      renderBoard();
    }

    // Create random terrain piece
    function createPiece() {
      const shape = TETROMINOES[Math.floor(Math.random() * TETROMINOES.length)];

      // Normal terrains
      let terrains = [TERRAIN.FOREST, TERRAIN.PLAINS, TERRAIN.MOUNTAIN, TERRAIN.RIVER, TERRAIN.SETTLEMENT];

      // Wave 6+: 20% chance of cursed tile
      if (gameState.wave >= 6 && Math.random() < 0.2) {
        return {
          shape: shape.map(row => row.map(cell => cell ? TERRAIN.CURSED : 0)),
          terrain: TERRAIN.CURSED
        };
      }

      const terrain = terrains[Math.floor(Math.random() * terrains.length)];

      return {
        shape: shape.map(row => row.map(cell => cell ? terrain : 0)),
        terrain: terrain
      };
    }

    // Spawn new piece
    function spawnPiece() {
      if (gameState.nextPiece) {
        gameState.currentPiece = gameState.nextPiece;
      } else {
        gameState.currentPiece = createPiece();
      }
      gameState.nextPiece = createPiece();

      gameState.pieceX = Math.floor((BOARD_WIDTH - gameState.currentPiece.shape[0].length) / 2);
      gameState.pieceY = 0;

      renderNextPiece();

      if (!canPlace(gameState.pieceX, gameState.pieceY, gameState.currentPiece.shape)) {
        endGame(false);
      }
    }

    // Check if piece can be placed
    function canPlace(x, y, shape) {
      for (let row = 0; row < shape.length; row++) {
        for (let col = 0; col < shape[row].length; col++) {
          if (shape[row][col]) {
            const boardX = x + col;
            const boardY = y + row;

            if (boardX < 0 || boardX >= BOARD_WIDTH || boardY >= BOARD_HEIGHT) {
              return false;
            }
            if (boardY >= 0 && gameState.board[boardY][boardX] !== TERRAIN.EMPTY) {
              return false;
            }
          }
        }
      }
      return true;
    }

    // Move piece
    function movePiece(dx) {
      if (!gameState.currentPiece) return;

      const newX = gameState.pieceX + dx;
      if (canPlace(newX, gameState.pieceY, gameState.currentPiece.shape)) {
        gameState.pieceX = newX;
        try { playSound('move'); } catch(e) {}
        renderBoard();
      }
    }

    // Rotate piece
    function rotatePiece() {
      if (!gameState.currentPiece) return;

      const shape = gameState.currentPiece.shape;
      const rotated = shape[0].map((_, i) => shape.map(row => row[i]).reverse());

      if (canPlace(gameState.pieceX, gameState.pieceY, rotated)) {
        gameState.currentPiece.shape = rotated;
        try { playSound('rotate'); } catch(e) {}
        renderBoard();
      }
    }

    // Drop piece one row
    function dropPiece() {
      if (!gameState.currentPiece) return false;

      if (canPlace(gameState.pieceX, gameState.pieceY + 1, gameState.currentPiece.shape)) {
        gameState.pieceY++;
        renderBoard();
        return true;
      } else {
        lockPiece();
        return false;
      }
    }

    // Hard drop
    function hardDrop() {
      if (!gameState.currentPiece) return;
      try { playSound('hardDrop'); } catch(e) {}
      while (gameState.currentPiece && dropPiece()) {}
    }

    // Lock piece in place
    function lockPiece() {
      if (!gameState.currentPiece) return;

      try {
        playSound('lock');
      } catch(e) {}

      const shape = gameState.currentPiece.shape;

      // Place piece on board
      for (let row = 0; row < shape.length; row++) {
        for (let col = 0; col < shape[row].length; col++) {
          if (shape[row][col]) {
            const boardY = gameState.pieceY + row;
            const boardX = gameState.pieceX + col;
            if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
              gameState.board[boardY][boardX] = shape[row][col];
            }
          }
        }
      }

      // Clear current piece
      gameState.currentPiece = null;

      gameState.tilesPlaced++;
      updateWaveProgress();
      renderBoard();

      // Check for completed rows
      const clearedCount = checkRows();

      // Continue game after short delay
      setTimeout(() => {
        if (gameState.tilesPlaced >= TILES_PER_ROUND) {
          startAttackPhase();
        } else {
          spawnPiece();
          renderBoard();
        }
      }, clearedCount > 0 ? 350 : 50);
    }

    // Check and harvest completed rows, returns count
    // PRD: Rows stay on board after harvest - they become permanent kingdom land
    function checkRows() {
      let newHarvestedRows = [];

      for (let row = 0; row < BOARD_HEIGHT; row++) {
        // Skip already harvested rows
        if (gameState.harvestedRows.includes(row)) continue;

        if (gameState.board[row].every(cell => cell !== TERRAIN.EMPTY)) {
          newHarvestedRows.push(row);
        }
      }

      if (newHarvestedRows.length > 0) {
        harvestRows(newHarvestedRows);
      }

      return newHarvestedRows.length;
    }

    // Harvest resources from completed rows
    function harvestRows(rows) {
      // Sort rows from bottom to top for proper removal
      rows.sort((a, b) => b - a);

      // Track total resources gained for toast
      let gained = { lumber: 0, food: 0, stone: 0, gold: 0 };
      let cursedPenalty = 0;

      rows.forEach(rowIndex => {
        // Add harvesting animation
        const cells = document.querySelectorAll(`[data-row="${rowIndex}"]`);
        cells.forEach(cell => cell.classList.add('harvesting'));

        // Calculate resources with adjacency bonuses
        const row = gameState.board[rowIndex];

        // Count cursed tiles - each cursed tile reduces output by 25%
        const cursedCount = row.filter(cell => cell === TERRAIN.CURSED).length;
        const cursePenaltyMultiplier = Math.max(0, 1 - (cursedCount * 0.25));
        if (cursedCount > 0) cursedPenalty += cursedCount;

        let clusters = findClusters(row);

        clusters.forEach(cluster => {
          // Skip cursed tiles - they produce nothing
          if (cluster.terrain === TERRAIN.CURSED) return;

          const baseOutput = getBaseOutput(cluster.terrain);
          const clusterBonus = cluster.size - 1; // +1 per adjacent same terrain
          const buildingMultiplier = getBuildingMultiplier(cluster.terrain);

          // Apply curse penalty
          const totalOutput = Math.floor((baseOutput + clusterBonus) * cluster.size * buildingMultiplier * cursePenaltyMultiplier);

          // Gold Rush joker: Mountains also produce +1 Gold per tile
          const bonusGold = getJokerBonusGold(cluster.terrain) * cluster.size;

          // Track what we're gaining
          switch(cluster.terrain) {
            case TERRAIN.FOREST: gained.lumber += totalOutput; break;
            case TERRAIN.PLAINS: gained.food += totalOutput; break;
            case TERRAIN.MOUNTAIN:
              gained.stone += totalOutput;
              if (bonusGold > 0) gained.gold += bonusGold;
              break;
            case TERRAIN.RIVER: gained.gold += totalOutput; break;
            case TERRAIN.SETTLEMENT:
              // Feudal Lord joker: Settlements produce more (count as all terrains)
              const feudalBonus = hasFeudallord() ? 1.5 : 1;
              gained.lumber += Math.floor(totalOutput / 4 * feudalBonus);
              gained.food += Math.floor(totalOutput / 4 * feudalBonus);
              gained.stone += Math.floor(totalOutput / 4 * feudalBonus);
              gained.gold += Math.floor(totalOutput / 4 * feudalBonus);
              break;
          }

          addResource(cluster.terrain, totalOutput);
          if (bonusGold > 0) {
            gameState.resources.gold += bonusGold;
          }
        });
      });

      // Score for harvesting (bonus for multiple rows)
      const rowBonus = rows.length === 1 ? 10 : rows.length === 2 ? 30 : rows.length === 3 ? 60 : 100;
      gameState.score += rowBonus;

      if (gameState.tempEffects.includes('double_harvest')) {
        gameState.score += rowBonus;
        gameState.tempEffects = gameState.tempEffects.filter(e => e !== 'double_harvest');
      }

      // Play clear sound
      playSound('clear');

      // Show toast with what was gained
      let toastParts = [];
      if (gained.lumber > 0) toastParts.push(`+${gained.lumber} 🪵`);
      if (gained.food > 0) toastParts.push(`+${gained.food} 🌾`);
      if (gained.stone > 0) toastParts.push(`+${gained.stone} 🪨`);
      if (gained.gold > 0) toastParts.push(`+${gained.gold} 💰`);

      if (toastParts.length > 0) {
        let harvestMsg = `${rows.length} row${rows.length > 1 ? 's' : ''} harvested! ${toastParts.join(' ')}`;
        if (cursedPenalty > 0) {
          harvestMsg += ` (💀 -${Math.round(cursedPenalty * 25)}% curse)`;
        }
        showToast(harvestMsg, 'harvest');
      }
      showToast(`+${rowBonus} points!`, 'score');

      // PRD: Rows STAY on board - mark them as harvested (permanent kingdom land)
      rows.forEach(rowIndex => {
        if (!gameState.harvestedRows.includes(rowIndex)) {
          gameState.harvestedRows.push(rowIndex);
        }
      });

      updateUI();
      renderBoard();
    }

    // Find clusters of same terrain in a row
    function findClusters(row) {
      let clusters = [];
      let current = null;

      for (let i = 0; i < row.length; i++) {
        if (row[i] !== TERRAIN.EMPTY) {
          if (current && current.terrain === row[i]) {
            current.size++;
          } else {
            if (current) clusters.push(current);
            current = { terrain: row[i], size: 1 };
          }
        }
      }
      if (current) clusters.push(current);

      return clusters;
    }

    // Get base resource output for terrain
    function getBaseOutput(terrain) {
      switch(terrain) {
        case TERRAIN.FOREST: return 2; // Lumber
        case TERRAIN.PLAINS: return 2; // Food
        case TERRAIN.MOUNTAIN: return 2; // Stone
        case TERRAIN.RIVER: return 1; // Gold
        case TERRAIN.SETTLEMENT: return 1; // All
        default: return 0;
      }
    }

    // Get building multiplier
    function getBuildingMultiplier(terrain) {
      let multiplier = 1;
      if (terrain === TERRAIN.FOREST && gameState.buildings.includes('lumber_mill')) multiplier *= 1.5;
      if (terrain === TERRAIN.PLAINS && gameState.buildings.includes('granary')) multiplier *= 1.5;
      if (terrain === TERRAIN.MOUNTAIN && gameState.buildings.includes('quarry')) multiplier *= 1.5;
      if (terrain === TERRAIN.RIVER && gameState.buildings.includes('mill')) multiplier *= 1.5;
      return multiplier;
    }

    // Get bonus gold from Gold Rush joker (Mountains produce +1 Gold)
    function getJokerBonusGold(terrain) {
      if (terrain === TERRAIN.MOUNTAIN && gameState.jokers.includes('gold_rush')) {
        return 1;
      }
      return 0;
    }

    // Check if Feudal Lord joker is active (Settlements count as all terrains)
    function hasFeudallord() {
      return gameState.jokers.includes('feudal_lord');
    }

    // Show toast notification
    function showToast(message, type = 'harvest') {
      const container = document.getElementById('toastContainer');
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.textContent = message;
      container.appendChild(toast);

      setTimeout(() => toast.remove(), 2000);
    }

    // Add resource
    function addResource(terrain, amount) {
      switch(terrain) {
        case TERRAIN.FOREST:
          gameState.resources.lumber += amount;
          break;
        case TERRAIN.PLAINS:
          gameState.resources.food += amount;
          break;
        case TERRAIN.MOUNTAIN:
          gameState.resources.stone += amount;
          break;
        case TERRAIN.RIVER:
          gameState.resources.gold += amount;
          break;
        case TERRAIN.SETTLEMENT:
          gameState.resources.lumber += Math.floor(amount / 4);
          gameState.resources.food += Math.floor(amount / 4);
          gameState.resources.stone += Math.floor(amount / 4);
          gameState.resources.gold += Math.floor(amount / 4);
          break;
      }
    }

    // Update wave progress
    function updateWaveProgress() {
      const progress = (gameState.tilesPlaced / TILES_PER_ROUND) * 100;
      document.getElementById('waveProgress').style.width = progress + '%';
    }

    // Start attack phase
    function startAttackPhase() {
      clearInterval(gameState.dropInterval);
      playSound('attack');

      let enemyPower = calculateEnemyPower();
      const siegeBreakReduction = calculateSiegeBreak();
      enemyPower = Math.max(0, enemyPower - siegeBreakReduction);

      const playerDefence = calculatePlayerDefence();

      // Display attack phase
      renderAttackPhase(enemyPower, playerDefence, siegeBreakReduction);
      document.getElementById('attackOverlay').classList.add('show');
    }

    // Enemy Types per PRD
    const ENEMY_TYPES = {
      infantry: { icon: '🗡️', name: 'Infantry', power: 10 },
      archer: { icon: '🏹', name: 'Archers', power: 15 },
      cavalry: { icon: '🐴', name: 'Cavalry', power: 25 },
      siege: { icon: '💥', name: 'Siege', power: 40 },
      elite: { icon: '👑', name: 'Elite', power: 50 }
    };

    // Generate enemy composition based on wave
    function generateEnemies() {
      const wave = gameState.wave;
      let enemies = [];

      if (wave <= 3) {
        // Waves 1-3: Infantry only
        const count = 2 + wave;
        for (let i = 0; i < count; i++) enemies.push('infantry');
      } else if (wave <= 6) {
        // Waves 4-6: Infantry + Archers
        const infantryCount = Math.floor(wave / 2) + 1;
        const archerCount = wave - 3;
        for (let i = 0; i < infantryCount; i++) enemies.push('infantry');
        for (let i = 0; i < archerCount; i++) enemies.push('archer');
      } else if (wave <= 8) {
        // Waves 7-8: All types
        enemies.push('infantry', 'infantry', 'archer', 'archer', 'cavalry');
        if (wave === 8) enemies.push('siege');
      } else if (wave === 9) {
        // Wave 9: Elite + Siege
        enemies.push('infantry', 'archer', 'cavalry', 'siege', 'elite');
      } else {
        // Wave 10: Full assault
        enemies.push('infantry', 'infantry', 'archer', 'archer', 'cavalry', 'cavalry', 'siege', 'elite');
      }

      return enemies;
    }

    // Calculate enemy power based on wave
    function calculateEnemyPower() {
      const enemies = generateEnemies();
      let totalPower = 0;
      enemies.forEach(type => {
        totalPower += ENEMY_TYPES[type].power;
      });
      // Add some variance
      const variance = Math.floor(Math.random() * 10) - 5;
      return Math.max(10, totalPower + variance);
    }

    // Get enemy breakdown for display
    function getEnemyBreakdown() {
      const enemies = generateEnemies();
      const counts = {};
      enemies.forEach(type => {
        counts[type] = (counts[type] || 0) + 1;
      });
      return counts;
    }

    // Calculate player defence
    function calculatePlayerDefence() {
      let defence = 0;

      // Base defence from walls on board
      gameState.board.forEach(row => {
        row.forEach(cell => {
          if (cell === TERRAIN.WALL) defence += 5;
        });
      });

      // Building bonuses
      if (gameState.buildings.includes('watchtower')) defence += 20;

      // Check if General is in cards (gives +50% to all units)
      const hasGeneral = gameState.cards.includes('general');
      const unitMultiplier = hasGeneral ? 1.5 : 1;

      // Unit cards
      gameState.cards.forEach(card => {
        const cardDef = ALL_CARDS.find(c => c.id === card);
        if (cardDef && cardDef.type === 'unit' && cardDef.power > 0) {
          defence += Math.floor(cardDef.power * unitMultiplier);
        }
      });

      // Temp effects
      if (gameState.tempEffects.includes('temp_defence')) {
        defence += 50;
        gameState.tempEffects = gameState.tempEffects.filter(e => e !== 'temp_defence');
      }

      return defence;
    }

    // Calculate siege break bonus (reduces enemy power)
    function calculateSiegeBreak() {
      if (gameState.tempEffects.includes('siege_break')) {
        gameState.tempEffects = gameState.tempEffects.filter(e => e !== 'siege_break');
        return 50; // Reduce enemy power by 50
      }
      return 0;
    }

    // Render attack phase
    function renderAttackPhase(enemyPower, playerDefence, siegeBreakUsed = 0) {
      const enemyList = document.getElementById('attackEnemies');
      const breakdown = getEnemyBreakdown();

      // Show each enemy type
      let enemyHTML = '';
      for (const [type, count] of Object.entries(breakdown)) {
        const enemy = ENEMY_TYPES[type];
        enemyHTML += `
          <div class="attack-enemy">
            <div class="attack-enemy-icon">${enemy.icon}</div>
            <div class="attack-enemy-count">×${count}</div>
            <div class="attack-enemy-type">${enemy.name}</div>
          </div>
        `;
      }

      // Show total power
      enemyHTML += `
        <div class="attack-enemy total">
          <div class="attack-enemy-icon">⚔️</div>
          <div class="attack-enemy-count">${enemyPower}${siegeBreakUsed > 0 ? ` <span style="color:#4CAF50">(-${siegeBreakUsed})</span>` : ''}</div>
          <div class="attack-enemy-type">Total Power</div>
        </div>
      `;

      enemyList.innerHTML = enemyHTML;

      document.getElementById('attackDefence').textContent = `Your Defence: ${playerDefence}`;

      const result = document.getElementById('attackResult');
      if (playerDefence >= enemyPower) {
        result.className = 'attack-result victory';
        result.textContent = '✓ Wave Repelled! +50 Score';
        gameState.score += 50;
        setTimeout(() => playSound('victory'), 500);
      } else {
        const breach = enemyPower - playerDefence;
        result.className = 'attack-result breach';
        result.textContent = `✗ Breach! -${breach} Border Tiles`;
        setTimeout(() => playSound('defeat'), 500);
        // Remove some tiles from right edge
        for (let i = 0; i < Math.min(breach / 10, 5); i++) {
          removeBorderTile();
        }
      }
    }

    // Remove a border tile
    function removeBorderTile() {
      for (let row = BOARD_HEIGHT - 1; row >= 0; row--) {
        for (let col = BOARD_WIDTH - 1; col >= 0; col--) {
          if (gameState.board[row][col] !== TERRAIN.EMPTY) {
            gameState.board[row][col] = TERRAIN.EMPTY;
            return;
          }
        }
      }
    }

    // Continue after attack
    function continueAfterAttack() {
      document.getElementById('attackOverlay').classList.remove('show');

      // Clear used unit cards
      gameState.cards = gameState.cards.filter(card => {
        const cardDef = ALL_CARDS.find(c => c.id === card);
        return cardDef && cardDef.type !== 'unit';
      });

      // Gold interest from treasury
      if (gameState.buildings.includes('treasury')) {
        gameState.resources.gold += Math.floor(gameState.resources.gold * 0.1);
      }

      // Check for game over (too many breaches)
      const filledCount = gameState.board.flat().filter(c => c !== TERRAIN.EMPTY).length;
      if (filledCount < 20 && gameState.wave > 3) {
        endGame(false);
        return;
      }

      // Open shop
      openShop();
    }

    // Open card shop
    function openShop() {
      const shopCards = document.getElementById('shopCards');

      // Filter available cards (exclude already owned buildings, jokers, and locked cards)
      const regularCards = ALL_CARDS.filter(card =>
        card.type !== 'joker' &&
        !gameState.buildings.includes(card.id) &&
        isCardAvailable(card.id)
      );

      // Jokers: available only if wave >= 3, max 1 per shop, 25% chance, AND unlocked
      const availableJokers = ALL_CARDS.filter(card =>
        card.type === 'joker' &&
        !gameState.jokers.includes(card.id) &&
        isCardAvailable(card.id)
      );

      const showJoker = gameState.wave >= 3 && availableJokers.length > 0 && Math.random() < 0.25;

      // Shuffle and pick cards
      const shuffledRegular = regularCards.sort(() => Math.random() - 0.5);
      let offered = shuffledRegular.slice(0, showJoker ? 2 : 3);

      // Add a joker if showing one
      if (showJoker) {
        const joker = availableJokers[Math.floor(Math.random() * availableJokers.length)];
        offered.push(joker);
      }

      shopCards.innerHTML = offered.map((card, i) => {
        const costText = Object.entries(card.cost || {}).map(([res, amt]) => `${amt} ${res}`).join(', ');
        const canAfford = canAffordCard(card);
        const isJoker = card.type === 'joker';

        return `
          <div class="shop-card ${i === 0 && !isJoker ? 'free' : ''} ${isJoker ? 'joker' : ''} ${canAfford || (i === 0 && !isJoker) ? '' : 'disabled'}"
               onclick="buyCard('${card.id}', ${i === 0 && !isJoker})"
               data-card="${card.id}">
            <div class="shop-card-icon">${card.icon}</div>
            <div class="shop-card-name">${card.name}</div>
            ${isJoker ? '<div class="shop-card-type">⭐ JOKER</div>' : ''}
            <div class="shop-card-desc">${card.desc}</div>
            <div class="shop-card-cost">${i === 0 && !isJoker ? 'FREE' : costText}</div>
          </div>
        `;
      }).join('');

      document.getElementById('shopModal').classList.add('show');
    }

    // Check if can afford card
    function canAffordCard(card) {
      if (!card.cost) return true;
      for (let [res, amt] of Object.entries(card.cost)) {
        if (gameState.resources[res] < amt) return false;
      }
      return true;
    }

    // Buy card
    function buyCard(cardId, isFree) {
      const card = ALL_CARDS.find(c => c.id === cardId);
      if (!card) return;

      if (!isFree) {
        if (!canAffordCard(card)) return;
        for (let [res, amt] of Object.entries(card.cost)) {
          gameState.resources[res] -= amt;
        }
      }

      playSound('buy');

      if (card.type === 'building') {
        gameState.buildings.push(cardId);
        showToast(`Built ${card.name}!`, 'score');
      } else if (card.type === 'joker') {
        gameState.jokers.push(cardId);
        showToast(`👑 ${card.name} activated!`, 'score');
      } else if (card.type === 'spell') {
        // Spells add temp effects
        if (card.effect) {
          gameState.tempEffects.push(card.effect);
        }
        showToast(`Cast ${card.name}!`, 'score');
      } else {
        gameState.cards.push(cardId);
      }

      closeShop();
    }

    // Skip shop
    function skipShop() {
      gameState.resources.gold += 2;
      gameState.score += 10; // Bonus for discipline
      closeShop();
    }

    // Close shop and start next wave
    function closeShop() {
      document.getElementById('shopModal').classList.remove('show');
      gameState.wave++;
      gameState.tilesPlaced = 0;
      updateUI();

      if (gameState.wave > 10) {
        endGame(true);
      } else {
        startGameLoop();
      }
    }

    // End game
    function endGame(victory) {
      gameState.gameOver = true;
      clearInterval(gameState.dropInterval);

      playSound(victory ? 'victory' : 'defeat');

      if (victory) gameState.score += 500;

      // Award Hearthstones
      const earnedHearthstones = calculateHearthstones(gameState.score, gameState.wave, victory);
      metaProgress.hearthstones += earnedHearthstones;
      metaProgress.totalHearthstones += earnedHearthstones;
      metaProgress.totalRuns++;
      if (victory) metaProgress.victories++;
      if (gameState.score > metaProgress.highScore) {
        metaProgress.highScore = gameState.score;
      }

      // Check for new unlocks
      const newUnlocks = checkUnlocks(metaProgress);
      saveMetaProgress(metaProgress);

      const modal = document.getElementById('gameoverModal');
      document.getElementById('gameoverIcon').textContent = victory ? '👑' : '💀';
      document.getElementById('gameoverTitle').textContent = victory ? 'Victory!' : 'Kingdom Fallen';
      document.getElementById('gameoverScore').textContent = gameState.score;
      document.getElementById('gameoverWave').textContent = `Reached Wave ${gameState.wave}`;

      // Show Hearthstones earned
      document.getElementById('gameoverHearthstones').textContent = `+${earnedHearthstones} 🔥 Hearthstones`;
      document.getElementById('gameoverTotal').textContent = `Total: ${metaProgress.totalHearthstones} 🔥`;

      // Show new unlocks if any
      const unlocksEl = document.getElementById('gameoverUnlocks');
      if (newUnlocks.length > 0) {
        const unlockNames = newUnlocks.map(id => {
          const card = ALL_CARDS.find(c => c.id === id);
          return card ? `${escapeHTML(card.icon)} ${escapeHTML(card.name)}` : escapeHTML(id);
        }).join(', ');
        unlocksEl.innerHTML = `<div class="new-unlock">🎉 NEW UNLOCK: ${unlockNames}</div>`;
        unlocksEl.style.display = 'block';
      } else {
        unlocksEl.style.display = 'none';
      }

      // Show tier progress
      const tierInfo = getCurrentTierInfo(metaProgress);
      document.getElementById('gameoverTier').textContent = `Rank: ${tierInfo.current.name}`;
      if (tierInfo.next) {
        document.getElementById('gameoverNextTier').textContent = `Next: ${tierInfo.next.name} (${tierInfo.next.cost} 🔥)`;
      } else {
        document.getElementById('gameoverNextTier').textContent = 'Max Rank Achieved!';
      }

      modal.classList.add('show');

      // Submit score and save state
      submitScore();
      saveCloudState();
    }

    // Submit score to leaderboard
    async function submitScore() {
      await window.gameCloud.submitScore('fieldstone', {
        score: gameState.score,
        level: gameState.wave,
        timeMs: Date.now() - gameState.startTime,
        metadata: {
          wave: gameState.wave,
          deck: gameState.selectedDeck
        }
      });
    }

    // Start game loop
    function startGameLoop() {
      spawnPiece();
      gameState.dropInterval = setInterval(() => {
        if (!gameState.gameOver && gameState.currentPiece) {
          dropPiece();
        }
      }, 1000);
    }

    // Render board
    function renderBoard() {
      const boardEl = document.getElementById('gameBoard');

      // Create cells if not exists
      if (boardEl.children.length === 0) {
        for (let row = 0; row < BOARD_HEIGHT; row++) {
          for (let col = 0; col < BOARD_WIDTH; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            boardEl.appendChild(cell);
          }
        }
      }

      // Update cell states
      const cells = boardEl.querySelectorAll('.cell');
      cells.forEach(cell => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const terrain = gameState.board[row][col];

        cell.className = 'cell';
        if (terrain !== TERRAIN.EMPTY) {
          cell.classList.add(TERRAIN_COLORS[terrain]);
          cell.textContent = TERRAIN_ICONS[terrain];

          // Mark harvested rows (permanent kingdom land)
          if (gameState.harvestedRows.includes(row)) {
            cell.classList.add('harvested');
          }
        } else {
          cell.textContent = '';
        }
      });

      // Render current piece
      if (gameState.currentPiece) {
        const shape = gameState.currentPiece.shape;
        for (let row = 0; row < shape.length; row++) {
          for (let col = 0; col < shape[row].length; col++) {
            if (shape[row][col]) {
              const boardY = gameState.pieceY + row;
              const boardX = gameState.pieceX + col;
              if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
                const cell = boardEl.querySelector(`[data-row="${boardY}"][data-col="${boardX}"]`);
                if (cell) {
                  cell.classList.add(TERRAIN_COLORS[shape[row][col]]);
                  cell.textContent = TERRAIN_ICONS[shape[row][col]];
                }
              }
            }
          }
        }

        // Render ghost piece
        let ghostY = gameState.pieceY;
        while (canPlace(gameState.pieceX, ghostY + 1, shape)) {
          ghostY++;
        }
        if (ghostY !== gameState.pieceY) {
          for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
              if (shape[row][col]) {
                const boardY = ghostY + row;
                const boardX = gameState.pieceX + col;
                if (boardY >= 0 && boardY < BOARD_HEIGHT) {
                  const cell = boardEl.querySelector(`[data-row="${boardY}"][data-col="${boardX}"]`);
                  if (cell && !cell.classList.contains(TERRAIN_COLORS[shape[row][col]])) {
                    cell.classList.add('ghost', TERRAIN_COLORS[shape[row][col]]);
                  }
                }
              }
            }
          }
        }
      }
    }

    // Render next piece preview
    function renderNextPiece() {
      const preview = document.getElementById('nextPreview');
      preview.innerHTML = '';

      if (!gameState.nextPiece) return;

      const shape = gameState.nextPiece.shape;
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          const cell = document.createElement('div');
          cell.className = 'preview-cell';
          if (shape[row] && shape[row][col]) {
            const terrain = shape[row][col];
            cell.classList.add(TERRAIN_COLORS[terrain]);
            cell.textContent = TERRAIN_ICONS[terrain];
          }
          preview.appendChild(cell);
        }
      }
    }

    // Update UI
    function updateUI() {
      document.getElementById('lumber').textContent = gameState.resources.lumber;
      document.getElementById('food').textContent = gameState.resources.food;
      document.getElementById('stone').textContent = gameState.resources.stone;
      document.getElementById('gold').textContent = gameState.resources.gold;
      document.getElementById('score').textContent = gameState.score;
      document.getElementById('waveNumber').textContent = gameState.wave;

      // Update mobile UI
      document.getElementById('mobileLumber').textContent = gameState.resources.lumber;
      document.getElementById('mobileFood').textContent = gameState.resources.food;
      document.getElementById('mobileStone').textContent = gameState.resources.stone;
      document.getElementById('mobileGold').textContent = gameState.resources.gold;
      document.getElementById('mobileScore').textContent = gameState.score;
      document.getElementById('mobileWave').textContent = gameState.wave;

      // Update cards list
      const cardsList = document.getElementById('cardsList');
      cardsList.innerHTML = gameState.cards.map(cardId => {
        const card = ALL_CARDS.find(c => c.id === cardId);
        if (!card) return '';
        return `
          <div class="card">
            <div class="card-header">
              <span class="card-name">${card.icon} ${card.name}</span>
            </div>
            <div class="card-desc">${card.desc}</div>
          </div>
        `;
      }).join('');

      // Update jokers display
      const jokersSection = document.getElementById('jokersSection');
      const jokersList = document.getElementById('jokersList');
      if (gameState.jokers.length > 0) {
        jokersSection.style.display = 'block';
        jokersList.innerHTML = gameState.jokers.map(jokerId => {
          const joker = ALL_CARDS.find(c => c.id === jokerId);
          if (!joker) return '';
          return `
            <div class="card joker-card">
              <div class="card-header">
                <span class="card-name">${joker.icon} ${joker.name}</span>
              </div>
              <div class="card-desc">${joker.desc}</div>
            </div>
          `;
        }).join('');
      } else {
        jokersSection.style.display = 'none';
      }

      // Update enemy preview with type breakdown
      const enemyPower = calculateEnemyPower();
      const breakdown = getEnemyBreakdown();
      const typeIcons = Object.entries(breakdown).map(([type, count]) =>
        `${ENEMY_TYPES[type].icon}×${count}`
      ).join(' ');

      document.getElementById('enemyList').innerHTML = `
        <div class="enemy-wave">
          <div>
            <div class="enemy-count">~${enemyPower} Power</div>
            <div class="enemy-type">Wave ${gameState.wave}: ${typeIcons}</div>
          </div>
        </div>
      `;

      // Mobile cards strip
      var mobileCards = document.getElementById('mobileCards');
      if (mobileCards) {
        mobileCards.innerHTML = gameState.cards.map(function(cardId) {
          var card = ALL_CARDS.find(function(c) { return c.id === cardId; });
          return card ? '<span class="mobile-card">' + card.icon + ' ' + card.name + '</span>' : '';
        }).join('');
      }

      // Mobile enemy
      var mobileEnemy = document.getElementById('mobileEnemy');
      if (mobileEnemy) {
        mobileEnemy.textContent = typeIcons + ' ~' + enemyPower;
      }

      renderBoard();
    }

    // Input handling
    function setupInput() {
      document.addEventListener('keydown', (e) => {
        if (gameState.gameOver) return;
        if (document.getElementById('shopModal').classList.contains('show')) return;
        if (document.getElementById('attackOverlay').classList.contains('show')) return;

        switch(e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            movePiece(-1);
            break;
          case 'ArrowRight':
            e.preventDefault();
            movePiece(1);
            break;
          case 'ArrowUp':
            e.preventDefault();
            rotatePiece();
            break;
          case 'ArrowDown':
            e.preventDefault();
            dropPiece();
            break;
          case ' ':
            e.preventDefault();
            hardDrop();
            break;
        }
      });

      // Touch controls
      let touchStartX = 0;
      let touchStartY = 0;
      let touchStartTime = 0;

      // Gesture controls — full game container (not just board)
      const touchZone = document.querySelector('.game-container');

      touchZone.addEventListener('touchstart', (e) => {
        // Don't intercept touches on buttons/modals/UI elements
        if (e.target.closest('button, .mobile-ui, .shop-modal, .attack-overlay, .menu-modal, .game-over-modal, .tutorial-modal, a')) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
        e.preventDefault();
      }, { passive: false });

      touchZone.addEventListener('touchend', (e) => {
        if (e.target.closest('button, .mobile-ui, .shop-modal, .attack-overlay, .menu-modal, .game-over-modal, .tutorial-modal, a')) return;
        if (gameState.gameOver) return;

        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        const dt = Date.now() - touchStartTime;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Tap to rotate (small movement, quick tap)
        if (distance < 20 && dt < 300) {
          rotatePiece();
          return;
        }

        // Swipe gestures
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > 30) movePiece(1);
          else if (dx < -30) movePiece(-1);
        } else {
          if (dy > 50) hardDrop();
          else if (dy < -30) rotatePiece();
        }
      });

      // Gesture hint — show once on first mobile visit
      if ('ontouchstart' in window && !localStorage.getItem('fieldstone-gesture-hint-seen')) {
        const hint = document.getElementById('gestureHint');
        hint.style.display = 'flex';
        document.getElementById('gestureHintDismiss').addEventListener('click', () => {
          hint.style.display = 'none';
          localStorage.setItem('fieldstone-gesture-hint-seen', '1');
        });
      }

    }

    // Start game
    function startGame() {
      // Initialize audio on user interaction
      initAudio();

      document.getElementById('menuScreen').classList.add('hidden');

      gameState.startTime = Date.now();

      // Initialize with selected deck
      gameState.cards = [...STARTING_DECKS[gameState.selectedDeck]];

      initBoard();
      updateUI();
      setupInput();
      startGameLoop();
    }

    // Update menu with meta progress
    function updateMenuMeta() {
      const tierInfo = getCurrentTierInfo(metaProgress);
      document.getElementById('menuHearthstones').textContent = metaProgress.totalHearthstones;
      document.getElementById('menuRank').textContent = tierInfo.current.name;
      document.getElementById('menuRuns').textContent = metaProgress.totalRuns;
      document.getElementById('menuWins').textContent = metaProgress.victories;
      document.getElementById('menuBest').textContent = metaProgress.highScore;
    }

    // Return to menu after game over
    function returnToMenu() {
      // Hide game over modal
      document.getElementById('gameoverModal').classList.remove('show');

      // Clear the game board display
      document.getElementById('gameBoard').innerHTML = '';
      document.getElementById('nextPreview').innerHTML = '';

      // Reset game state
      gameState.board = [];
      gameState.harvestedRows = [];
      gameState.currentPiece = null;
      gameState.nextPiece = null;
      gameState.pieceX = 0;
      gameState.pieceY = 0;
      gameState.resources = { lumber: 10, food: 10, stone: 10, gold: 5 };
      gameState.score = 0;
      gameState.wave = 1;
      gameState.tilesPlaced = 0;
      gameState.cards = [];
      gameState.buildings = [];
      gameState.jokers = [];
      gameState.tempEffects = [];
      gameState.gameOver = false;

      // Clear any running intervals
      if (gameState.dropInterval) {
        clearInterval(gameState.dropInterval);
        gameState.dropInterval = null;
      }

      // Reload meta progress from localStorage (in case it was updated)
      metaProgress = loadMetaProgress();

      // Update and show menu
      updateMenuMeta();
      document.getElementById('menuScreen').classList.remove('hidden');
    }

    // Initialize
    document.getElementById('startBtn').addEventListener('click', startGame);

    document.querySelectorAll('.deck-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.deck-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        gameState.selectedDeck = btn.dataset.deck;
      });
    });

    document.getElementById('shopSkip').addEventListener('click', skipShop);
    document.getElementById('attackContinue').addEventListener('click', continueAfterAttack);

    // Make buyCard global
    window.buyCard = buyCard;

    // Initialize menu with meta progress
    updateMenuMeta();

    // Tutorial functions
    function openTutorial() {
      document.getElementById('tutorialModal').classList.add('show');
    }

    function closeTutorial() {
      document.getElementById('tutorialModal').classList.remove('show');
    }

    document.getElementById('tutorialBtn').addEventListener('click', openTutorial);
    window.closeTutorial = closeTutorial;

    // Sound toggle
    function toggleSound() {
      soundEnabled = !soundEnabled;
      headerApi.setSoundMuted(!soundEnabled);
    }

    // Cloud state
    let cloudStateFieldstone = null;

    async function saveCloudState() {
      const prevGamesPlayed = cloudStateFieldstone?.gamesPlayed || 0;
      const prevGamesWon = cloudStateFieldstone?.gamesWon || 0;
      const prevBestStreak = cloudStateFieldstone?.bestStreak || 0;
      const didWin = gameState.wave >= 10;

      const state = {
        currentLevel: gameState.wave,
        currentStreak: 0,
        bestStreak: Math.max(prevBestStreak, gameState.wave),
        gamesPlayed: prevGamesPlayed + 1,
        gamesWon: prevGamesWon + (didWin ? 1 : 0),
        lastPlayedDate: new Date().toISOString().split('T')[0],
        additionalData: {
          bestScore: Math.max(cloudStateFieldstone?.additionalData?.bestScore || 0, gameState.score),
          bestWave: Math.max(cloudStateFieldstone?.additionalData?.bestWave || 0, gameState.wave)
        }
      };
      await window.gameCloud.saveState('fieldstone', state);
      cloudStateFieldstone = state;

      // Check achievements
      if (state.gamesPlayed === 1) {
        await window.gameCloud.unlockAchievement('first_word', 'fieldstone');
      }
      if (state.gamesWon >= 10) {
        await window.gameCloud.unlockAchievement('ten_wins', 'fieldstone');
      }
    }

    async function loadCloudState() {
      cloudStateFieldstone = await window.gameCloud.loadState('fieldstone');
    }

    // Auth integration via gameCloud
    if (window.gameCloud) window.gameCloud.initAuth({
      signInStyle: 'name',
      onSignIn: (user) => {
        currentUser = user;
        loadCloudState();
      },
      onSignOut: () => {
        currentUser = null;
      }
    });

    // Expose functions used by inline onclick handlers
    window.toggleSound = toggleSound;
    window.returnToMenu = returnToMenu;
    window.closeTutorial = closeTutorial;
    window.buyCard = buyCard;
  })();
