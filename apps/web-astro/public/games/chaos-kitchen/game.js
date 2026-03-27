(function() {
    'use strict';

    function escapeHTML(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

    // ============ GAME CONSTANTS ============
    const ROUND_TIME = 120;
    const ORDER_SPAWN_INTERVAL = 8000;
    const ORDER_TIME_LIMIT = 30;
    const CHAOS_INTERVAL = 25000;
    const CHAOS_DURATION = 10000;
    const PROCESS_TIME = 2000;

    // ============ RECIPES ============
    const RECIPES = {
      'Salad': { ingredients: ['lettuce', 'tomato'], stations: ['chop'], points: 80, icon: '🥗' },
      'Burger': { ingredients: ['bread', 'meat', 'lettuce'], stations: ['chop', 'cook'], points: 120, icon: '🍔' },
      'Omelette': { ingredients: ['egg', 'cheese'], stations: ['mix', 'cook'], points: 100, icon: '🍳' },
      'Sandwich': { ingredients: ['bread', 'cheese', 'tomato'], stations: ['chop'], points: 90, icon: '🥪' },
      'Steak': { ingredients: ['meat'], stations: ['cook'], points: 70, icon: '🥩' },
      'Scrambled Eggs': { ingredients: ['egg'], stations: ['mix', 'cook'], points: 60, icon: '🥚' }
    };

    const CHAOS_EVENTS = [
      { name: 'Floor Butter!', class: 'chaos-butter', message: '🧈 Floor is slippery!' },
      { name: 'Kitchen Fire!', class: 'chaos-fire', message: '🔥 Stove on fire! Cook faster!' },
      { name: 'Tiny Hands!', class: 'chaos-tiny', message: '🤏 Ingredients are tiny!' },
      { name: 'Rush Hour!', class: 'chaos-rush', message: '⚡ Orders come faster!' },
      { name: 'VIP Customer!', class: 'chaos-vip', message: '👑 VIP wants perfect service!' }
    ];

    const EMOJI_MAP = {
      // Raw ingredients
      'tomato': '🍅', 'lettuce': '🥬', 'meat': '🥩',
      'cheese': '🧀', 'bread': '🍞', 'egg': '🥚',
      // Chopped items
      'chopped_tomato': '🫑', 'chopped_lettuce': '🥗', 'chopped_meat': '🥓',
      // Cooked items
      'cooked_meat': '🍖', 'cooked_egg': '🍳',
      // Mixed items
      'mixed_egg': '🥣', 'mixed_cheese': '🧀',
      // Cooked after mixed
      'cooked_mixed_egg': '🍳'
    };

    const STATION_ICONS = { chop: '🔪', cook: '🍳', mix: '🥣' };

    // ============ GAME STATE ============
    let score = 0;
    let level = 1;
    let multiplier = 1.0;
    let ordersCompleted = 0;
    let chaosSurvived = 0;
    let timeRemaining = ROUND_TIME;
    let isPlaying = false;
    let heldItem = null;
    let heldEmoji = null;
    let currentPlate = [];
    let plateStations = [];
    let orders = [];
    let currentChaos = null;
    let gameTimerInterval = null;
    let orderSpawnInterval = null;
    let chaosInterval = null;
    let currentUser = null;
    let highScore = parseInt(localStorage.getItem('chaos-kitchen-high-score')) || 0;
    let gameStartTime = null;

    // ============ DOM ELEMENTS ============
    const kitchenArea = document.getElementById('kitchenArea');
    const chefEl = document.getElementById('chef');
    const chefHeldEl = document.getElementById('chefHeldItem');
    const plateContainer = document.getElementById('plateContainer');
    const ordersList = document.getElementById('ordersList');
    const chaosBannerEl = document.getElementById('chaosBanner');
    const chefFace = document.querySelector('.chef-face');

    // ============ INITIALIZATION ============
    function init() {
      document.addEventListener('click', handleKitchenClick);
      window.gameHeader.init({
        title: 'Chaos Kitchen',
        icon: '👨‍🍳',
        gameId: 'chaos-kitchen',
        buttons: ['leaderboard', 'auth'],
        onSignIn: async (user) => {
          currentUser = user;
          cloudStateKitchen = await window.gameCloud.loadState('chaos-kitchen');
          if (cloudStateKitchen?.additionalData?.highScore > highScore) {
            highScore = cloudStateKitchen.additionalData.highScore;
            localStorage.setItem('chaos-kitchen-high-score', highScore);
          }
          await window.gameCloud.syncGuestScores('chaos-kitchen');
        },
        onSignOut: () => {
          currentUser = null;
        }
      });
    }

    function handleKitchenClick(e) {
      if (!isPlaying) return;

      // Move chef to click position within kitchen area
      const kitchen = kitchenArea.getBoundingClientRect();
      const x = e.clientX - kitchen.left;
      const y = e.clientY - kitchen.top;

      // Don't move if clicking on UI elements
      if (e.target.closest('.station, .ingredient, .side-panel, .stations-top, .ingredient-shelf')) return;

      // Keep chef within bounds
      const maxX = kitchen.width - 60;
      const maxY = kitchen.height - 80;
      const newX = Math.max(0, Math.min(x - 30, maxX));
      const newY = Math.max(0, Math.min(y - 40, maxY));

      chefEl.style.left = newX + 'px';
      chefEl.style.top = newY + 'px';
    }

    // ============ GAME CONTROLS ============
    function startGame() {
      document.getElementById('startOverlay').classList.add('hidden');
      document.getElementById('gameOverOverlay').classList.add('hidden');

      score = 0;
      multiplier = 1.0;
      ordersCompleted = 0;
      chaosSurvived = 0;
      timeRemaining = ROUND_TIME;
      currentPlate = [];
      plateStations = [];
      orders = [];
      heldItem = null;
      heldEmoji = null;
      currentChaos = null;
      isPlaying = true;
      gameStartTime = Date.now();

      chefHeldEl.style.display = 'none';
      chefFace.innerHTML = '😊';
      kitchenArea.className = 'kitchen-area';

      renderPlate();
      updateDisplay();

      spawnOrder();
      spawnOrder();

      gameTimerInterval = setInterval(gameTick, 1000);
      orderSpawnInterval = setInterval(spawnOrder, ORDER_SPAWN_INTERVAL);
      chaosInterval = setInterval(triggerChaos, CHAOS_INTERVAL);
    }

    function gameTick() {
      timeRemaining--;

      // Check if game should end BEFORE processing order expirations
      // This ensures the displayed score matches the final score
      if (timeRemaining <= 0) {
        updateDisplay();
        endGame();
        return;
      }

      // Process order expirations only if game is still active
      orders.forEach(order => {
        order.timeLeft--;
        if (order.timeLeft <= 0) {
          expireOrder(order);
        }
      });

      updateDisplay();
      renderOrders();
    }

    function endGame() {
      isPlaying = false;
      clearInterval(gameTimerInterval);
      clearInterval(orderSpawnInterval);
      clearInterval(chaosInterval);

      let stars = 1;
      if (ordersCompleted >= 5) stars = 2;
      if (ordersCompleted >= 10) stars = 3;

      if (score > highScore) {
        highScore = score;
        localStorage.setItem('chaos-kitchen-high-score', highScore);
      }

      document.getElementById('endIcon').textContent = stars >= 2 ? '🎉' : '😅';
      document.getElementById('endTitle').textContent = stars >= 2 ? 'Great Service!' : 'Kitchen Closed';
      document.getElementById('starsDisplay').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
      document.getElementById('finalScore').textContent = score.toLocaleString();
      document.getElementById('finalOrders').textContent = ordersCompleted;
      document.getElementById('finalChaos').textContent = chaosSurvived;
      document.getElementById('gameOverOverlay').classList.remove('hidden');

      submitScore();
      saveCloudState();
    }

    // ============ INGREDIENTS & COOKING ============
    function pickupIngredient(name, emoji) {
      if (!isPlaying) return;

      // If already holding something, add to plate
      if (heldItem) {
        addToPlate(heldItem);
      }

      heldItem = name;
      heldEmoji = emoji;
      chefHeldEl.innerHTML = emoji;
      chefHeldEl.style.display = 'block';
      chefFace.innerHTML = '😃';

      playSound('pickup');
    }

    function addToPlate(item) {
      if (currentPlate.length >= 4) return;
      currentPlate.push(item);
      renderPlate();
      playSound('place');
    }

    function getCompletedDish() {
      // Check if current plate matches a completed recipe
      for (const [name, recipe] of Object.entries(RECIPES)) {
        // Check if all required stations have been used
        const hasAllStations = recipe.stations.every(s => plateStations.includes(s));
        if (!hasAllStations) continue;

        // Check if ingredients match (ignoring processing prefixes)
        const plateIngredients = currentPlate.map(i =>
          i.replace('chopped_', '').replace('cooked_', '').replace('mixed_', '')
        ).sort();
        const recipeIngredients = [...recipe.ingredients].sort();

        if (plateIngredients.length === recipeIngredients.length &&
            plateIngredients.every((ing, idx) => ing === recipeIngredients[idx])) {
          return { name, icon: recipe.icon };
        }
      }
      return null;
    }

    function renderPlate() {
      if (currentPlate.length === 0) {
        plateContainer.innerHTML = '<div class="plate-empty">Click ingredients to add</div>';
      } else {
        // Check if plate matches a completed dish
        const completedDish = getCompletedDish();
        if (completedDish) {
          plateContainer.innerHTML = `
            <span class="plate-item completed-dish">${completedDish.icon}</span>
            <span class="dish-name">${completedDish.name}</span>
          `;
        } else {
          plateContainer.innerHTML = currentPlate.map(item =>
            `<span class="plate-item">${EMOJI_MAP[item] || '❓'}</span>`
          ).join('');
        }
      }
    }

    function clearPlate() {
      currentPlate = [];
      plateStations = [];
      heldItem = null;
      heldEmoji = null;
      chefHeldEl.style.display = 'none';
      chefFace.innerHTML = '😊';
      renderPlate();
      playSound('clear');
    }

    function useStation(stationType) {
      if (!isPlaying) return;

      // If holding item, add to plate first
      if (heldItem) {
        addToPlate(heldItem);
        heldItem = null;
        heldEmoji = null;
        chefHeldEl.style.display = 'none';
      }

      if (currentPlate.length === 0) return;

      if (!plateStations.includes(stationType)) {
        processAtStation(stationType);
      }
    }

    function processAtStation(stationType) {
      const stationEl = document.getElementById(stationType + 'Station');
      const progressEl = document.getElementById(stationType + 'Progress');

      stationEl.classList.add('active');
      progressEl.classList.add('show');
      chefFace.innerHTML = '😤';

      let progress = 0;
      const processInterval = setInterval(() => {
        progress += 100 / (PROCESS_TIME / 100);
        progressEl.querySelector('.station-progress-fill').style.width = progress + '%';

        if (progress >= 100) {
          clearInterval(processInterval);
          stationEl.classList.remove('active');
          progressEl.classList.remove('show');
          progressEl.querySelector('.station-progress-fill').style.width = '0%';

          plateStations.push(stationType);
          chefFace.innerHTML = '😊';
          playSound('complete');

          currentPlate = currentPlate.map(item => {
            if (stationType === 'chop' && ['tomato', 'lettuce', 'meat'].includes(item)) {
              return 'chopped_' + item;
            }
            if (stationType === 'cook' && ['meat', 'egg', 'chopped_meat', 'mixed_egg'].includes(item)) {
              return 'cooked_' + item.replace('chopped_', '').replace('mixed_', '');
            }
            if (stationType === 'mix' && ['egg', 'cheese'].includes(item)) {
              return 'mixed_' + item;
            }
            return item;
          });
          renderPlate();
        }
      }, 100);
    }

    // ============ ORDERS ============
    function spawnOrder() {
      if (!isPlaying || orders.length >= 4) return;

      const recipeNames = Object.keys(RECIPES);
      const availableRecipes = level >= 2 ? recipeNames : recipeNames.filter(r => RECIPES[r].ingredients.length <= 2);
      const recipeName = availableRecipes[Math.floor(Math.random() * availableRecipes.length)];

      const order = {
        id: Date.now(),
        name: recipeName,
        recipe: RECIPES[recipeName],
        timeLeft: ORDER_TIME_LIMIT
      };

      orders.push(order);
      renderOrders();
    }

    function renderOrders() {
      if (orders.length === 0) {
        ordersList.innerHTML = '<div class="plate-empty" style="padding: 20px;">No orders yet!</div>';
        return;
      }

      ordersList.innerHTML = orders.map(order => `
        <div class="order-card ${order.timeLeft < 10 ? 'urgent' : ''}">
          <div class="order-header">
            <span class="order-name">${order.recipe.icon} ${order.name}</span>
            <span class="order-timer ${order.timeLeft < 10 ? 'danger' : ''}">${order.timeLeft}s</span>
          </div>
          <div class="order-items">
            ${order.recipe.ingredients.map(ing => `<span class="order-item">${EMOJI_MAP[ing]} ${ing}</span>`).join('')}
          </div>
          <div class="order-stations">
            ${order.recipe.stations.map(s => `<span class="order-station">${STATION_ICONS[s]}</span>`).join('')}
          </div>
        </div>
      `).join('');
    }

    function deliverPlate() {
      if (!isPlaying) return;

      // Add held item to plate before serving
      if (heldItem) {
        addToPlate(heldItem);
        heldItem = null;
        heldEmoji = null;
        chefHeldEl.style.display = 'none';
      }

      if (currentPlate.length === 0) return;

      let matchedOrder = null;
      let matchScore = 0;

      for (const order of orders) {
        const recipe = order.recipe;
        let matches = 0;

        const plateIngredients = currentPlate.map(i => i.replace('chopped_', '').replace('cooked_', '').replace('mixed_', ''));
        const requiredIngredients = [...recipe.ingredients];

        for (const ing of plateIngredients) {
          const idx = requiredIngredients.indexOf(ing);
          if (idx !== -1) {
            matches++;
            requiredIngredients.splice(idx, 1);
          }
        }

        const stationsUsed = recipe.stations.every(s => plateStations.includes(s));

        if (matches === recipe.ingredients.length && requiredIngredients.length === 0 && stationsUsed) {
          matchedOrder = order;
          matchScore = recipe.points;
          break;
        }
      }

      if (matchedOrder) {
        const bonus = matchedOrder.timeLeft > 15 ? 50 : 0;
        const totalPoints = Math.floor((matchScore + bonus) * multiplier);

        score += totalPoints;
        ordersCompleted++;
        multiplier = Math.min(2.5, multiplier + 0.2);

        orders = orders.filter(o => o.id !== matchedOrder.id);

        chefFace.innerHTML = '🤩';
        showFloatingScore(totalPoints, true);
        showServedBanner(true, matchedOrder.name);
        playSound('success');

        if (ordersCompleted % 5 === 0) {
          level++;
          submitScore(true); // Submit on level up
        }

        setTimeout(() => { if (isPlaying) chefFace.innerHTML = '😊'; }, 1000);
      } else {
        const penalty = -30;
        score = Math.max(0, score + penalty);
        multiplier = Math.max(1.0, multiplier - 0.3);

        chefFace.innerHTML = '😰';
        showFloatingScore(penalty, false);
        showServedBanner(false);
        playSound('fail');

        setTimeout(() => { if (isPlaying) chefFace.innerHTML = '😊'; }, 1000);
      }

      currentPlate = [];
      plateStations = [];
      renderPlate();
      renderOrders();
      updateDisplay();
    }

    function expireOrder(order) {
      orders = orders.filter(o => o.id !== order.id);
      score = Math.max(0, score - 50);
      multiplier = Math.max(1.0, multiplier - 0.2);
      chefFace.innerHTML = '😟';
      showFloatingScore(-50, false);
      playSound('fail');
      updateDisplay();
      setTimeout(() => { if (isPlaying) chefFace.innerHTML = '😊'; }, 1000);
    }

    // ============ CHAOS EVENTS ============
    function triggerChaos() {
      if (!isPlaying || currentChaos) return;

      const chaos = CHAOS_EVENTS[Math.floor(Math.random() * CHAOS_EVENTS.length)];
      currentChaos = chaos;

      kitchenArea.classList.add(chaos.class);
      chaosBannerEl.textContent = chaos.message;
      chaosBannerEl.classList.add('show');
      chefFace.innerHTML = '😱';

      playSound('chaos');

      setTimeout(() => {
        kitchenArea.classList.remove(chaos.class);
        chaosBannerEl.classList.remove('show');
        currentChaos = null;
        chaosSurvived++;
        score += 75;
        chefFace.innerHTML = '😎';
        showFloatingScore(75, true);
        updateDisplay();
        setTimeout(() => { if (isPlaying) chefFace.innerHTML = '😊'; }, 1000);
      }, CHAOS_DURATION);
    }

    // ============ UI UPDATES ============
    function updateDisplay() {
      document.getElementById('scoreDisplay').textContent = score.toLocaleString();
      document.getElementById('multiplierDisplay').textContent = multiplier.toFixed(1) + 'x';
      document.getElementById('ordersDisplay').textContent = ordersCompleted;
      document.getElementById('levelDisplay').textContent = level;

      const timerPercent = (timeRemaining / ROUND_TIME) * 100;
      const timerFill = document.getElementById('timerFill');
      timerFill.style.width = timerPercent + '%';
      timerFill.classList.remove('warning', 'danger');
      if (timerPercent < 20) timerFill.classList.add('danger');
      else if (timerPercent < 40) timerFill.classList.add('warning');

      const mins = Math.floor(timeRemaining / 60);
      const secs = timeRemaining % 60;
      document.getElementById('timerLabel').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function showFloatingScore(points, positive) {
      const el = document.createElement('div');
      el.className = `floating-score ${positive ? 'positive' : 'negative'}`;
      el.textContent = (positive ? '+' : '') + points;
      el.style.left = '50%';
      el.style.top = '45%';
      el.style.transform = 'translateX(-50%)';
      kitchenArea.appendChild(el);
      setTimeout(() => el.remove(), 1000);
    }

    function showServedBanner(success, orderName) {
      const banner = document.getElementById('servedBanner');
      banner.className = 'served-banner';

      if (success) {
        banner.textContent = `🍽️ ${orderName} SERVED!`;
        banner.classList.remove('fail');
      } else {
        banner.textContent = '❌ WRONG ORDER!';
        banner.classList.add('fail');
      }

      // Force reflow to restart animation
      void banner.offsetWidth;
      banner.classList.add('show');

      setTimeout(() => {
        banner.classList.remove('show');
      }, 1200);
    }

    // ============ SOUND ============
    let audioCtx = null;
    let audioUnlocked = false;

    function getAudioContext() {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      return audioCtx;
    }

    function unlockAudio() {
      if (audioUnlocked) return;
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') ctx.resume();
      // Play silent buffer to fully unlock on iOS
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      audioUnlocked = true;
    }

    ['touchstart', 'mousedown', 'keydown'].forEach(event => {
      document.addEventListener(event, unlockAudio, { once: true });
    });

    function playSound(type) {
      try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        gainNode.gain.value = 0.08;

        switch (type) {
          case 'pickup':
            oscillator.frequency.value = 600;
            oscillator.start();
            oscillator.stop(ctx.currentTime + 0.05);
            break;
          case 'place':
            oscillator.frequency.value = 450;
            oscillator.start();
            oscillator.stop(ctx.currentTime + 0.08);
            break;
          case 'complete':
            oscillator.frequency.value = 700;
            oscillator.start();
            oscillator.stop(ctx.currentTime + 0.12);
            break;
          case 'success':
            oscillator.frequency.value = 880;
            oscillator.start();
            setTimeout(() => oscillator.frequency.value = 1100, 80);
            oscillator.stop(ctx.currentTime + 0.2);
            break;
          case 'fail':
            oscillator.frequency.value = 220;
            oscillator.start();
            oscillator.stop(ctx.currentTime + 0.25);
            break;
          case 'chaos':
            oscillator.frequency.value = 330;
            oscillator.type = 'sawtooth';
            oscillator.start();
            oscillator.stop(ctx.currentTime + 0.35);
            break;
          case 'clear':
            oscillator.frequency.value = 380;
            oscillator.start();
            oscillator.stop(ctx.currentTime + 0.1);
            break;
        }
      } catch (e) {}
    }

    // ============ AUTH & API ============
    let cloudStateKitchen = null;

    async function submitScore(isLevelUp = false) {
      await window.gameCloud.submitOrQueue('chaos-kitchen', {
        score: score,
        level: level,
        timeMs: gameStartTime ? Date.now() - gameStartTime : 0,
        metadata: { ordersCompleted, chaosSurvived, multiplier, isLevelUp }
      }, { silent: isLevelUp });
    }

    async function saveCloudState() {
      if (!currentUser) return;
      try {
        const prevGamesPlayed = cloudStateKitchen?.gamesPlayed || 0;
        const prevGamesWon = cloudStateKitchen?.gamesWon || 0;
        const prevBestStreak = cloudStateKitchen?.bestStreak || 0;
        const didWin = ordersCompleted >= 5;

        const state = {
          currentLevel: level,
          currentStreak: 0,
          bestStreak: Math.max(prevBestStreak, level),
          gamesPlayed: prevGamesPlayed + 1,
          gamesWon: prevGamesWon + (didWin ? 1 : 0),
          lastPlayedDate: new Date().toISOString().split('T')[0],
          additionalData: { highScore, bestOrders: ordersCompleted }
        };
        await window.gameCloud.saveState('chaos-kitchen', state);
        cloudStateKitchen = state;

        // Check achievements
        if (state.gamesPlayed === 1) {
          await window.gameCloud.unlockAchievement('first_word', 'chaos-kitchen');
        }
        if (state.gamesWon >= 10) {
          await window.gameCloud.unlockAchievement('ten_wins', 'chaos-kitchen');
        }
      } catch (e) {
        console.error('Failed to save state:', e);
      }
    }

    // ============ START ============
    window.addEventListener('load', init);

    // Expose functions referenced by onclick attributes in HTML
    window.startGame = startGame;
    window.useStation = useStation;
    window.pickupIngredient = pickupIngredient;
    window.deliverPlate = deliverPlate;
    window.clearPlate = clearPlate;
  })();
