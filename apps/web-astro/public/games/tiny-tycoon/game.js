(() => {
  // ==========================================
  // GAME CONSTANTS
  // ==========================================
  let DRINK_TYPES = {
    basic_tea:    { emoji: '🍵', name: 'Basic Tea',         baseCoins: 5,  serveTime: 800,  unlockDay: 1 },
    boba_milk:    { emoji: '🧋', name: 'Boba Milk Tea',     baseCoins: 10, serveTime: 1200, unlockDay: 1 },
    iced_coffee:  { emoji: '☕', name: 'Iced Coffee',        baseCoins: 8,  serveTime: 1000, unlockDay: 3 },
    smoothie:     { emoji: '🥤', name: 'Fruit Smoothie',    baseCoins: 15, serveTime: 1500, unlockDay: 5 },
    strawberry:   { emoji: '🍓', name: 'Strawberry Special', baseCoins: 20, serveTime: 2000, unlockDay: 8 },
    sparkling:    { emoji: '🫧', name: 'Sparkling Boba',    baseCoins: 30, serveTime: 2500, unlockDay: 10 },
    matcha_latte: { emoji: '🍃', name: 'Matcha Latte',     baseCoins: 40, serveTime: 2800, unlockDay: 15 },
    taro_milk:    { emoji: '🟣', name: 'Taro Milk Tea',    baseCoins: 55, serveTime: 3200, unlockDay: 20 },
    signature:    { emoji: '🏆', name: 'Signature Boba',   baseCoins: 75, serveTime: 4000, unlockDay: 25 }
  };

  let CUSTOMER_TYPES = {
    regular:    { color: '#8B9DC3', patienceMod: 1.0, orderPool: ['basic_tea', 'boba_milk'],             earlyWeight: 60, lateWeight: 25 },
    student:    { color: '#FFB347', patienceMod: 1.2, orderPool: ['basic_tea', 'iced_coffee'],           earlyWeight: 30, lateWeight: 15 },
    business:   { color: '#708090', patienceMod: 0.7, orderPool: ['iced_coffee', 'boba_milk'],           earlyWeight: 10, lateWeight: 20 },
    foodie:     { color: '#DDA0DD', patienceMod: 0.9, orderPool: ['smoothie', 'strawberry', 'matcha_latte', 'taro_milk'], earlyWeight: 0, lateWeight: 25 },
    influencer: { color: '#FF69B4', patienceMod: 0.6, orderPool: ['strawberry', 'sparkling', 'taro_milk', 'signature'], earlyWeight: 0, lateWeight: 10 },
    vip:        { color: '#FFD700', patienceMod: 1.0, orderPool: 'ALL',                                 earlyWeight: 0,  lateWeight: 0  }
  };

  let UPGRADES = {
    speed_boost:  { name: 'Speed Boost',         icon: '⚡', desc: 'Reduce serve time by 5%', maxLevel: 10, costFn: (l) => 80 + (l * 40),  requires: null, visible: false },
    patience_plus:{ name: 'Patience Plus',        icon: '😊', desc: 'Customers wait 10% longer', maxLevel: 8,  costFn: (l) => 100 + (l * 50), requires: null, visible: false },
    tip_jar:      { name: 'Tip Jar',              icon: '🫙', desc: 'Higher speed bonus tips (+1/lv)', maxLevel: 8,  costFn: (l) => 60 + (l * 30),  requires: null, visible: false },
    premium_menu: { name: 'Premium Menu',         icon: '📋', desc: 'Boost drink value (+2 coins/lv)', maxLevel: 5,  costFn: (l) => 150 + (l * 100),requires: null, visible: false },
    queue_expand: { name: 'Bigger Queue',         icon: '📏', desc: 'Max queue +2 per level',   maxLevel: 3,  costFn: (l) => 200 + (l * 150),requires: null, visible: false },
    combo_keeper: { name: 'Combo Keeper',         icon: '🛡️', desc: 'Forgive angry for combo',  maxLevel: 3,  costFn: (l) => 250 + (l * 200),requires: null, visible: false },
    auto_serve_1: { name: 'Auto-Serve #1',        icon: '👨‍🍳', desc: 'Auto-serves basic drinks', maxLevel: 1,  costFn: () => 500,              requires: null, visible: true },
    auto_serve_2: { name: 'Auto-Serve #2',        icon: '👨‍🍳', desc: 'Serves drinks up to 20c',  maxLevel: 1,  costFn: () => 1500,             requires: 'auto_serve_1', visible: true },
    auto_serve_3: { name: 'Auto-Serve #3',        icon: '👨‍🍳', desc: 'Serves all drinks',        maxLevel: 1,  costFn: () => 4000,             requires: 'auto_serve_2', visible: true },
    vip_lounge:   { name: 'VIP Lounge',           icon: '👑', desc: 'VIP customers (2x coins)', maxLevel: 3,  costFn: (l) => 300 + (l * 250),requires: null, visible: true }
  };

  const ACHIEVEMENTS = {
    tt_first_day:     { name: 'Open for Business', desc: 'Complete your first day',           xp: 10 },
    tt_hundred_club:  { name: 'Hundred Club',      desc: 'Earn 100+ coins in a day',          xp: 25 },
    tt_five_hundred:  { name: 'High Roller',       desc: 'Earn 500+ coins in a day',          xp: 50 },
    tt_thousand:      { name: 'Boba Billionaire',  desc: 'Earn 1,000+ coins in a day',        xp: 100 },
    tt_perfect_day:   { name: 'Perfect Day',       desc: 'Zero angry customers (10+ served)', xp: 50 },
    tt_combo_5:       { name: 'Streak Starter',    desc: 'Reach 5x combo streak',             xp: 25 },
    tt_combo_15:      { name: 'Combo King',        desc: 'Reach 15x combo streak',            xp: 75 },
    tt_speed_demon:   { name: 'Speed Demon',       desc: 'Serve 30+ customers in a day',      xp: 50 },
    tt_upgrade_first: { name: 'Investor',          desc: 'Purchase your first upgrade',       xp: 10 },
    tt_max_upgrade:   { name: 'Fully Loaded',      desc: 'Max out any upgrade',               xp: 75 },
    tt_day_10:        { name: 'Veteran Barista',   desc: 'Reach Day 10',                      xp: 50 },
    tt_rush_survivor: { name: 'Rush Survivor',     desc: 'Survive Rush Hour perfectly',       xp: 100 },
    tt_prestige:      { name: 'New Beginnings',   desc: 'Prestige for the first time',       xp: 150 }
  };

  const PRESTIGE_PERKS = {
    1: { id: 'tier2_unlock', name: 'Tier 2 Access',  desc: 'Unlock Tier 2 upgrades (coming soon)', icon: '🔓' },
    2: { id: 'auto_combo',   name: 'Auto Combo',     desc: 'Start each day at 2x combo',           icon: '🔥' },
    3: { id: 'vip_magnet',   name: 'VIP Magnet',     desc: '+15% VIP spawn chance',                icon: '🧲' },
    4: { id: 'rush_master',  name: 'Rush Master',    desc: 'Rush Hour = 2x coins',                 icon: '⚡' },
    5: { id: 'golden_start', name: 'Golden Start',   desc: 'Start each day with 50 bonus coins',   icon: '💎' },
  };

  let SPAWN_TABLE = [
    { minDay: 1,  interval: 3000, maxQueue: 4 },
    { minDay: 2,  interval: 2700, maxQueue: 4 },
    { minDay: 3,  interval: 2400, maxQueue: 5 },
    { minDay: 4,  interval: 2200, maxQueue: 5 },
    { minDay: 5,  interval: 2000, maxQueue: 6 },
    { minDay: 6,  interval: 1800, maxQueue: 6 },
    { minDay: 8,  interval: 1600, maxQueue: 7 },
    { minDay: 10, interval: 1400, maxQueue: 8 },
    { minDay: 15, interval: 1200, maxQueue: 8 },
    { minDay: 20, interval: 1000, maxQueue: 8 },
    { minDay: 25, interval: 900,  maxQueue: 9 },
    { minDay: 30, interval: 800,  maxQueue: 10 }
  ];

  let PATIENCE_TABLE = [
    { minDay: 1,  patience: 12000 },
    { minDay: 3,  patience: 10000 },
    { minDay: 5,  patience: 8000 },
    { minDay: 7,  patience: 7000 },
    { minDay: 10, patience: 6000 },
    { minDay: 15, patience: 5500 },
    { minDay: 20, patience: 5000 },
    { minDay: 25, patience: 4500 },
    { minDay: 30, patience: 4000 }
  ];

  const DAY_DURATION = 60000; // 60 seconds

  // VIP Table positions (relative to vip lounge, in % for responsiveness)
  const VIP_TABLE_POSITIONS = [
    { x: 60, y: 30 },   // table 0 (left)
    { x: 180, y: 50 },  // table 1 (center)
    { x: 300, y: 30 }   // table 2 (right)
  ];

  // ==========================================
  // STORE CONFIGS REGISTRY
  // ==========================================
  // Save boba shop defaults for reference
  const BOBA_DRINKS = { ...DRINK_TYPES };
  const BOBA_CUSTOMERS = JSON.parse(JSON.stringify(CUSTOMER_TYPES));
  const BOBA_UPGRADES = JSON.parse(JSON.stringify(UPGRADES));
  const BOBA_SPAWN = [...SPAWN_TABLE];
  const BOBA_PATIENCE = [...PATIENCE_TABLE];

  const STORE_CONFIGS = {
    boba_shop: {
      id: 'boba_shop',
      name: 'Boba Bliss',
      emoji: '🧋',
      unlockCost: 0,
      unlockPrestige: 0,
      theme: { '--cream': '#FFF8F0', '--taupe': '#C4A882', '--brown': '#5C3D2E', '--matcha': '#7FB069', '--coral': '#E8836B', '--gold': '#F5C542', '--taro': '#9B7CB8', '--wall-top': '#FFF5EB', '--wall-bottom': '#F5E6D0', '--floor': '#D4A87C' },
      getDrinks: () => BOBA_DRINKS,
      getCustomers: () => BOBA_CUSTOMERS,
      getUpgrades: () => BOBA_UPGRADES,
      getSpawnTable: () => BOBA_SPAWN,
      getPatienceTable: () => BOBA_PATIENCE,
    },
    bean_brew: {
      id: 'bean_brew',
      name: 'Bean & Brew',
      emoji: '☕',
      unlockCost: 5000,
      unlockPrestige: 1,
      theme: { '--cream': '#F5F0E8', '--taupe': '#8B6F47', '--brown': '#3E2723', '--matcha': '#B87333', '--coral': '#D84315', '--gold': '#FFB300', '--taro': '#6D4C41', '--wall-top': '#E8DCC8', '--wall-bottom': '#D4C4A8', '--floor': '#A0845C' },
      getDrinks: () => ({
        drip_coffee:   { emoji: '☕', name: 'Drip Coffee',       baseCoins: 8,   serveTime: 700,  unlockDay: 1 },
        cappuccino:    { emoji: '🫘', name: 'Cappuccino',        baseCoins: 15,  serveTime: 1100, unlockDay: 1 },
        espresso:      { emoji: '⚡', name: 'Espresso Shot',     baseCoins: 12,  serveTime: 500,  unlockDay: 3 },
        caramel_latte: { emoji: '🍯', name: 'Caramel Latte',    baseCoins: 22,  serveTime: 1400, unlockDay: 5 },
        mocha_frappe:  { emoji: '🍫', name: 'Mocha Frappe',     baseCoins: 35,  serveTime: 1800, unlockDay: 8 },
        pour_over:     { emoji: '🏆', name: 'Pour-Over Special', baseCoins: 50,  serveTime: 2200, unlockDay: 12 },
        affogato:      { emoji: '🍨', name: 'Affogato',         baseCoins: 65,  serveTime: 2800, unlockDay: 18 },
      }),
      getCustomers: () => ({
        regular:    { color: '#A1887F', patienceMod: 1.0, orderPool: ['drip_coffee', 'cappuccino'],            earlyWeight: 50, lateWeight: 20 },
        student:    { color: '#FFB347', patienceMod: 1.2, orderPool: ['drip_coffee', 'espresso'],              earlyWeight: 30, lateWeight: 15 },
        business:   { color: '#546E7A', patienceMod: 0.6, orderPool: ['espresso', 'cappuccino', 'pour_over'],  earlyWeight: 15, lateWeight: 30 },
        foodie:     { color: '#CE93D8', patienceMod: 0.9, orderPool: ['caramel_latte', 'mocha_frappe', 'affogato'], earlyWeight: 0, lateWeight: 25 },
        influencer: { color: '#FF69B4', patienceMod: 0.5, orderPool: ['affogato', 'pour_over'],               earlyWeight: 0,  lateWeight: 10 },
        vip:        { color: '#FFD700', patienceMod: 1.0, orderPool: 'ALL',                                   earlyWeight: 0,  lateWeight: 0  }
      }),
      getUpgrades: () => BOBA_UPGRADES, // same upgrade structure
      getSpawnTable: () => BOBA_SPAWN,
      getPatienceTable: () => BOBA_PATIENCE,
    },
    juice_junction: {
      id: 'juice_junction',
      name: 'Juice Junction',
      emoji: '🍊',
      unlockCost: 15000,
      unlockPrestige: 2,
      theme: { '--cream': '#E0F7FA', '--taupe': '#00897B', '--brown': '#004D40', '--matcha': '#FF8C42', '--coral': '#FF5722', '--gold': '#FFC107', '--taro': '#26A69A', '--wall-top': '#B2DFDB', '--wall-bottom': '#80CBC4', '--floor': '#FFE0B2' },
      getDrinks: () => ({
        orange_juice:  { emoji: '🍊', name: 'Orange Juice',      baseCoins: 10,  serveTime: 800,  unlockDay: 1 },
        berry_blast:   { emoji: '🫐', name: 'Berry Blast',       baseCoins: 18,  serveTime: 1200, unlockDay: 1 },
        green_smooth:  { emoji: '🥬', name: 'Green Smoothie',    baseCoins: 15,  serveTime: 1000, unlockDay: 3 },
        acai_bowl:     { emoji: '🟣', name: 'Açaí Bowl',         baseCoins: 30,  serveTime: 1600, unlockDay: 6 },
        tropical:      { emoji: '🥭', name: 'Tropical Fusion',   baseCoins: 45,  serveTime: 2000, unlockDay: 10 },
        dragon_fruit:  { emoji: '🐉', name: 'Dragon Fruit Elixir', baseCoins: 60, serveTime: 2500, unlockDay: 15 },
        superfood:     { emoji: '💎', name: 'Superfood Supreme',  baseCoins: 80,  serveTime: 3200, unlockDay: 20 },
      }),
      getCustomers: () => ({
        regular:    { color: '#81D4FA', patienceMod: 1.0, orderPool: ['orange_juice', 'berry_blast'],         earlyWeight: 50, lateWeight: 20 },
        student:    { color: '#AED581', patienceMod: 1.3, orderPool: ['orange_juice', 'green_smooth'],        earlyWeight: 30, lateWeight: 15 },
        business:   { color: '#90A4AE', patienceMod: 0.7, orderPool: ['green_smooth', 'acai_bowl'],           earlyWeight: 10, lateWeight: 20 },
        foodie:     { color: '#F48FB1', patienceMod: 0.9, orderPool: ['acai_bowl', 'tropical', 'dragon_fruit', 'superfood'], earlyWeight: 0, lateWeight: 30 },
        influencer: { color: '#FF69B4', patienceMod: 0.5, orderPool: ['dragon_fruit', 'superfood'],           earlyWeight: 0,  lateWeight: 10 },
        vip:        { color: '#FFD700', patienceMod: 1.0, orderPool: 'ALL',                                   earlyWeight: 0,  lateWeight: 0  }
      }),
      getUpgrades: () => BOBA_UPGRADES,
      getSpawnTable: () => BOBA_SPAWN,
      getPatienceTable: () => BOBA_PATIENCE,
    },
  };

  let activeStoreId = 'boba_shop';

  function switchStore(storeId) {
    const config = STORE_CONFIGS[storeId];
    if (!config) return;

    // Save current store state
    saveGame();

    activeStoreId = storeId;
    DRINK_TYPES = config.getDrinks();
    CUSTOMER_TYPES = config.getCustomers();
    UPGRADES = config.getUpgrades();
    SPAWN_TABLE = config.getSpawnTable();
    PATIENCE_TABLE = config.getPatienceTable();

    // Load this store's saved state
    const raw = localStorage.getItem('tt_empire');
    if (raw) {
      try {
        const empire = JSON.parse(raw);
        const store = (empire.stores || {})[storeId];
        if (store) {
          currentDay = store.currentDay || 1;
          upgradeLevels = store.upgradeLevels || {};
        } else {
          currentDay = 1;
          upgradeLevels = {};
        }
        empire.activeStoreId = storeId;
        localStorage.setItem('tt_empire', JSON.stringify(empire));
      } catch(e) {}
    }

    // Apply theme colors
    const root = document.documentElement;
    for (const [prop, val] of Object.entries(config.theme)) {
      root.style.setProperty(prop, val);
    }

    updateShopEnvironment();
  }

  // Manager tiers
  const MANAGER_TIERS = {
    trainee:     { name: 'Trainee',     cost: 5000,   efficiency: 0.40, icon: '👤', minPrestige: 1 },
    experienced: { name: 'Experienced', cost: 20000,  efficiency: 0.60, icon: '👨‍💼', minPrestige: 2 },
    expert:      { name: 'Expert',      cost: 50000,  efficiency: 0.80, icon: '🧑‍🔬', minPrestige: 3 },
    star:        { name: 'Star Manager', cost: 100000, efficiency: 0.85, icon: '⭐', minPrestige: 5 },
  };

  // ==========================================
  // GAME STATE
  // ==========================================
  let gameState = 'TITLE';
  let relaxedMode = false;
  const RELAXED = { patienceMult: 1.5, spawnMult: 1.3 };
  let cumulativeStats = { totalServed: 0, totalLost: 0, totalCoinsEarned: 0, bestCombo: 0, daysPlayed: 0 };

  // Daily challenge system
  const DAILY_CHALLENGES = [
    { desc: 'Serve {n} customers', field: 'customersServed', target: 20, bonus: 50 },
    { desc: 'Earn {n} coins in one day', field: 'dayRevenue', target: 300, bonus: 75 },
    { desc: 'Reach a {n}-streak combo', field: 'peakCombo', target: 10, bonus: 60 },
    { desc: 'Lose 0 customers', field: 'customersLost', target: 0, bonus: 100, compare: 'eq' },
    { desc: 'Serve {n} customers', field: 'customersServed', target: 25, bonus: 75 },
    { desc: 'Earn {n} coins in one day', field: 'dayRevenue', target: 500, bonus: 100 },
    { desc: 'Reach a {n}-streak combo', field: 'peakCombo', target: 15, bonus: 100 },
    { desc: 'Lose at most {n} customers', field: 'customersLost', target: 2, bonus: 80, compare: 'lte' },
    { desc: 'Earn {n} coins in one day', field: 'dayRevenue', target: 150, bonus: 40 },
    { desc: 'Serve {n} customers', field: 'customersServed', target: 30, bonus: 100 },
    { desc: 'Reach a {n}-streak combo', field: 'peakCombo', target: 5, bonus: 35 },
    { desc: 'Earn {n} coins in one day', field: 'dayRevenue', target: 750, bonus: 125 },
    { desc: 'Serve {n} customers', field: 'customersServed', target: 15, bonus: 35 },
    { desc: 'Reach a {n}-streak combo', field: 'peakCombo', target: 20, bonus: 150 },
  ];
  let dailyChallenge = null;
  let dailyChallengeComplete = false;
  let wallet = 0;
  let bestScore = 0;
  let currentDay = 1;
  let upgradeLevels = {};
  let unlockedAchievements = new Set();
  let prestigeLevel = 0;
  let prestigeBridgeDays = 0;
  let masterVolume = 0.5;
  let isMuted = false;
  let loginStreak = { lastLoginDate: null, count: 0, longestStreak: 0 };
  let tutorialsSeen = { main: false, vip: false };

  // Per-day state
  let dayTimer = 0;
  let dayRevenue = 0;
  let dayPenalties = 0;
  let dayStartTime = 0;
  let customersServed = 0;
  let customersLost = 0;
  let comboStreak = 0;
  let peakCombo = 0;
  let comboForgives = 0;
  let customers = [];
  let spawnTimer = 0;
  let manualServing = null;
  let autoServing = [null, null, null];
  let rushActive = false;
  let rushTimer = 0;
  let rushStartTime = 0;
  let rushScheduled = false;
  let rushCustomerIds = new Set();
  let rushLostAny = false;
  let rushHadEvent = false;
  let rushWarningShown = false;
  let lastFrameTime = 0;
  let animFrameId = null;
  let customerIdCounter = 0;

  // VIP table state
  let vipTables = []; // { occupied: false, customerId: null }

  // Waiter state
  let waiterState = 'idle'; // idle, walking, serving
  let waiterTargetCustomerId = null;
  let waiterServeTimer = 0;
  let waiterServeTime = 0;

  // Auth
  let currentUser = null;

  // Audio
  let audioCtx = null;
  let audioInitialized = false;

  // DOM refs
  const hudEl = document.getElementById('hud');
  const hudCoins = document.getElementById('hudCoins');
  const hudTimer = document.getElementById('hudTimer');
  const hudCombo = document.getElementById('hudCombo');
  const dayBadge = document.getElementById('dayBadge');
  const rushBanner = document.getElementById('rushBanner');
  const queueArea = document.getElementById('queueArea');
  const autoStationsEl = document.getElementById('autoStations');
  const gameArea = document.getElementById('gameArea');
  const wallClock = document.getElementById('wallClock');
  const vipLoungeEl = document.getElementById('vipLounge');
  const vipCustomerArea = document.getElementById('vipCustomerArea');
  const vipTablesContainer = document.getElementById('vipTablesContainer');
  const vipWaiterEl = document.getElementById('vipWaiter');
  const mainBaristaEl = document.getElementById('mainBarista');
  const gameWrap = document.getElementById('gameWrap');

  // ==========================================
  // SAVE / LOAD (v2 — tt_empire blob)
  // ==========================================
  function saveGame() {
    // Load existing empire to preserve other stores' state
    let existingStores = {};
    try {
      const prev = JSON.parse(localStorage.getItem('tt_empire') || '{}');
      existingStores = prev.stores || {};
    } catch(e) {}

    // Update active store's state
    existingStores[activeStoreId] = {
      ...(existingStores[activeStoreId] || {}),
      unlocked: true,
      currentDay,
      upgradeLevels: { ...upgradeLevels },
      bestDayRevenue: Math.max((existingStores[activeStoreId] || {}).bestDayRevenue || 0, bestScore),
    };

    // Ensure boba_shop always exists
    if (!existingStores.boba_shop) {
      existingStores.boba_shop = { unlocked: true, currentDay: 1, upgradeLevels: {}, bestDayRevenue: 0 };
    }

    const empire = {
      version: 2,
      global: {
        wallet,
        prestigeLevel,
        bestScore,
        achievements: [...unlockedAchievements],
        cumulativeStats,
        loginStreak,
        lastPlayedTimestamp: Date.now(),
        prestigeBridgeDays: prestigeBridgeDays || 0,
      },
      stores: existingStores,
      activeStoreId,
      settings: {
        muted: isMuted,
        volume: masterVolume,
        relaxedMode,
        tutorialsSeen: {
          main: tutorialsSeen.main,
          vip: tutorialsSeen.vip,
        }
      }
    };
    localStorage.setItem('tt_empire', JSON.stringify(empire));
  }

  function loadGame() {
    // Migrate v1 flat keys to v2 empire blob
    if (localStorage.getItem('tt_wallet') !== null && !localStorage.getItem('tt_empire')) {
      migrateV1toV2();
    }

    const raw = localStorage.getItem('tt_empire');
    if (!raw) {
      // Fresh game defaults
      wallet = 0; bestScore = 0; currentDay = 1;
      upgradeLevels = {}; unlockedAchievements = new Set();
      prestigeLevel = 0; masterVolume = 0.5; isMuted = false;
      relaxedMode = false; prestigeBridgeDays = 0;
      loginStreak = { lastLoginDate: null, count: 0, longestStreak: 0 };
      tutorialsSeen = { main: false, vip: false };
      return;
    }

    try {
      const empire = JSON.parse(raw);
      const g = empire.global || {};
      wallet = g.wallet || 0;
      prestigeLevel = g.prestigeLevel || 0;
      bestScore = g.bestScore || 0;
      unlockedAchievements = new Set(g.achievements || []);
      cumulativeStats = { totalServed: 0, totalLost: 0, totalCoinsEarned: 0, bestCombo: 0, daysPlayed: 0, ...(g.cumulativeStats || {}) };
      loginStreak = g.loginStreak || { lastLoginDate: null, count: 0, longestStreak: 0 };
      prestigeBridgeDays = g.prestigeBridgeDays || 0;

      activeStoreId = empire.activeStoreId || 'boba_shop';
      const storeConfig = STORE_CONFIGS[activeStoreId];
      if (storeConfig) {
        DRINK_TYPES = storeConfig.getDrinks();
        CUSTOMER_TYPES = storeConfig.getCustomers();
        UPGRADES = storeConfig.getUpgrades();
        SPAWN_TABLE = storeConfig.getSpawnTable();
        PATIENCE_TABLE = storeConfig.getPatienceTable();
      }

      const store = (empire.stores || {})[activeStoreId] || {};
      currentDay = store.currentDay || 1;
      upgradeLevels = store.upgradeLevels || {};

      const s = empire.settings || {};
      isMuted = s.muted || false;
      masterVolume = s.volume || 0.5;
      relaxedMode = s.relaxedMode || false;
      tutorialsSeen = s.tutorialsSeen || { main: false, vip: false };
    } catch(e) {
      console.error('Failed to load empire save', e);
    }
  }

  function migrateV1toV2() {
    const empire = {
      version: 2,
      global: {
        wallet: parseInt(localStorage.getItem('tt_wallet') || '0') || 0,
        prestigeLevel: parseInt(localStorage.getItem('tt_prestige') || '0') || 0,
        bestScore: parseInt(localStorage.getItem('tt_best_score') || '0') || 0,
        achievements: (() => { try { return JSON.parse(localStorage.getItem('tt_achievements') || '[]'); } catch(e) { return []; } })(),
        cumulativeStats: (() => { try { return JSON.parse(localStorage.getItem('tt_stats') || '{}'); } catch(e) { return {}; } })(),
        loginStreak: (() => { try { return JSON.parse(localStorage.getItem('tt_login_streak') || '{}'); } catch(e) { return {}; } })(),
        lastPlayedTimestamp: Date.now(),
        prestigeBridgeDays: 0,
      },
      stores: {
        boba_shop: {
          unlocked: true,
          currentDay: parseInt(localStorage.getItem('tt_current_day') || '1') || 1,
          upgradeLevels: (() => { try { return JSON.parse(localStorage.getItem('tt_upgrades') || '{}'); } catch(e) { return {}; } })(),
          bestDayRevenue: parseInt(localStorage.getItem('tt_best_score') || '0') || 0,
        }
      },
      activeStoreId: 'boba_shop',
      settings: {
        muted: localStorage.getItem('tt_muted') === 'true',
        volume: parseFloat(localStorage.getItem('tt_volume') || '0.5') || 0.5,
        relaxedMode: localStorage.getItem('tt_relaxed_mode') === 'true',
        tutorialsSeen: {
          main: !!localStorage.getItem('tt_tutorial_seen'),
          vip: !!localStorage.getItem('tt_vip_tutorial_seen'),
        }
      }
    };
    localStorage.setItem('tt_empire', JSON.stringify(empire));
    // Clean up old keys
    ['tt_wallet', 'tt_best_score', 'tt_current_day', 'tt_upgrades', 'tt_achievements',
     'tt_stats', 'tt_prestige', 'tt_volume', 'tt_muted', 'tt_relaxed_mode',
     'tt_tutorial_seen', 'tt_vip_tutorial_seen', 'tt_login_streak'].forEach(k => localStorage.removeItem(k));
  }

  function resetGame() {
    localStorage.removeItem('tt_empire');
    loadGame();
  }

  // ==========================================
  // DAILY LOGIN & STREAK
  // ==========================================
  let welcomeBackData = null;

  function checkDailyLogin() {
    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
    if (loginStreak.lastLoginDate === today) return; // Already logged in today

    const lastDate = loginStreak.lastLoginDate;
    if (lastDate) {
      const hoursSinceLast = (now - new Date(lastDate + 'T12:00:00').getTime()) / 3600000;
      if (hoursSinceLast < 36) {
        // Within grace — increment streak
        loginStreak.count++;
      } else {
        // Streak broken
        loginStreak.count = 1;
      }
    } else {
      loginStreak.count = 1;
    }

    if (loginStreak.count > loginStreak.longestStreak) {
      loginStreak.longestStreak = loginStreak.count;
    }
    loginStreak.lastLoginDate = today;

    welcomeBackData = {
      streak: loginStreak.count,
      isNewDay: true,
    };

    saveGame();
  }

  // ==========================================
  // SOUND ENGINE
  // ==========================================
  function initAudio() {
    if (audioInitialized) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      audioInitialized = true;
    } catch(e) { console.warn('Audio init failed', e); }
  }

  function playSound(type) {
    if (!audioCtx || isMuted) return;
    const vol = masterVolume;
    const now = audioCtx.currentTime;

    try {
      switch(type) {
        case 'tap': {
          const o = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          o.type = 'sine'; o.frequency.value = 800;
          g.gain.setValueAtTime(vol * 0.3, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          o.connect(g).connect(audioCtx.destination);
          o.start(now); o.stop(now + 0.05);
          break;
        }
        case 'serve': {
          const notes = [523, 659, 784];
          notes.forEach((f, i) => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.type = 'triangle'; o.frequency.value = f;
            g.gain.setValueAtTime(vol * 0.2, now + i * 0.04);
            g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.08);
            o.connect(g).connect(audioCtx.destination);
            o.start(now + i * 0.04); o.stop(now + i * 0.04 + 0.08);
          });
          break;
        }
        case 'coin': {
          const o = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          o.type = 'sine'; o.frequency.value = 2000;
          o.frequency.setValueAtTime(2000, now);
          o.frequency.linearRampToValueAtTime(2200, now + 0.05);
          o.frequency.linearRampToValueAtTime(1800, now + 0.15);
          g.gain.setValueAtTime(vol * 0.15, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          o.connect(g).connect(audioCtx.destination);
          o.start(now); o.stop(now + 0.15);
          break;
        }
        case 'combo': {
          const bufferSize = audioCtx.sampleRate * 0.2;
          const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
          const src = audioCtx.createBufferSource();
          src.buffer = buffer;
          const bp = audioCtx.createBiquadFilter();
          bp.type = 'bandpass'; bp.Q.value = 5;
          bp.frequency.setValueAtTime(400, now);
          bp.frequency.linearRampToValueAtTime(1200, now + 0.2);
          const g = audioCtx.createGain();
          g.gain.setValueAtTime(vol * 0.1, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          src.connect(bp).connect(g).connect(audioCtx.destination);
          src.start(now); src.stop(now + 0.2);
          break;
        }
        case 'angry': {
          const o = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          o.type = 'sawtooth'; o.frequency.value = 150;
          o.frequency.linearRampToValueAtTime(100, now + 0.2);
          g.gain.setValueAtTime(vol * 0.15, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          o.connect(g).connect(audioCtx.destination);
          o.start(now); o.stop(now + 0.2);
          break;
        }
        case 'warning': {
          // Rising alert tone for rush countdown
          const ow = audioCtx.createOscillator();
          const gw = audioCtx.createGain();
          ow.type = 'sine'; ow.frequency.value = 600;
          ow.frequency.linearRampToValueAtTime(900, now + 0.3);
          gw.gain.setValueAtTime(vol * 0.12, now);
          gw.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          ow.connect(gw).connect(audioCtx.destination);
          ow.start(now); ow.stop(now + 0.35);
          break;
        }
        case 'rush': {
          [440, 659].forEach((f, i) => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.type = 'square'; o.frequency.value = f;
            g.gain.setValueAtTime(vol * 0.15, now + i * 0.1);
            g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.1);
            o.connect(g).connect(audioCtx.destination);
            o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.1);
          });
          break;
        }
        case 'dayStart': {
          const o = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          const delay = audioCtx.createDelay();
          const fb = audioCtx.createGain();
          delay.delayTime.value = 0.15;
          fb.gain.value = 0.3;
          o.type = 'sine'; o.frequency.value = 1000;
          g.gain.setValueAtTime(vol * 0.25, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          o.connect(g).connect(audioCtx.destination);
          g.connect(delay).connect(fb).connect(delay);
          delay.connect(audioCtx.destination);
          o.start(now); o.stop(now + 0.5);
          break;
        }
        case 'dayEnd': {
          [392, 330, 262].forEach((f, i) => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.type = 'triangle'; o.frequency.value = f;
            g.gain.setValueAtTime(vol * 0.2, now + i * 0.1);
            g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.15);
            o.connect(g).connect(audioCtx.destination);
            o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.15);
          });
          break;
        }
        case 'upgrade': {
          const bufLen = audioCtx.sampleRate * 0.05;
          const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
          const d = buf.getChannelData(0);
          for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
          const ns = audioCtx.createBufferSource(); ns.buffer = buf;
          const ng = audioCtx.createGain();
          ng.gain.setValueAtTime(vol * 0.1, now);
          ng.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          ns.connect(ng).connect(audioCtx.destination);
          ns.start(now); ns.stop(now + 0.05);
          const o = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          o.type = 'sine'; o.frequency.value = 1500;
          g.gain.setValueAtTime(vol * 0.2, now + 0.03);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          o.connect(g).connect(audioCtx.destination);
          o.start(now + 0.03); o.stop(now + 0.2);
          break;
        }
        case 'newBest': {
          [523, 587, 659, 698, 784].forEach((f, i) => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.type = 'triangle'; o.frequency.value = f;
            g.gain.setValueAtTime(vol * 0.2, now + i * 0.08);
            g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.15);
            o.connect(g).connect(audioCtx.destination);
            o.start(now + i * 0.08); o.stop(now + i * 0.08 + 0.15);
          });
          break;
        }
        case 'achievement': {
          [659, 784, 988].forEach((f, i) => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.type = 'sine'; o.frequency.value = f;
            g.gain.setValueAtTime(vol * 0.18, now + i * 0.1);
            g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.2);
            o.connect(g).connect(audioCtx.destination);
            o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.2);
          });
          break;
        }
      }
    } catch(e) { /* audio error, ignore */ }
  }

  // ==========================================
  // AMBIENT BACKGROUND MUSIC
  // ==========================================
  let bgmNodes = null;
  let bgmPlaying = false;

  function startBgm() {
    if (!audioCtx || bgmPlaying || isMuted) return;
    // Ensure AudioContext is running (browsers suspend until user gesture)
    if (audioCtx.state === 'suspended') audioCtx.resume();
    try {
      // Soft pad chord: C major 7 (C4, E4, G4, B4) with detuned oscillators
      const notes = [261.6, 329.6, 392.0, 493.9];
      const masterGain = audioCtx.createGain();
      masterGain.gain.value = masterVolume * 0.04;
      masterGain.connect(audioCtx.destination);

      // Low-pass filter for warmth
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      filter.Q.value = 0.7;
      filter.connect(masterGain);

      const oscs = [];
      notes.forEach((freq) => {
        // Two slightly detuned oscillators per note for chorus effect
        for (let d = -3; d <= 3; d += 6) {
          const osc = audioCtx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = freq;
          osc.detune.value = d;
          const g = audioCtx.createGain();
          g.gain.value = 0.5;
          osc.connect(g).connect(filter);
          osc.start();
          oscs.push(osc);
        }
      });

      // Slow LFO on filter cutoff for movement
      const lfo = audioCtx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.08;
      const lfoGain = audioCtx.createGain();
      lfoGain.gain.value = 300;
      lfo.connect(lfoGain).connect(filter.frequency);
      lfo.start();

      bgmNodes = { oscs, lfo, masterGain, filter };
      bgmPlaying = true;
    } catch(e) { /* bgm init failed, non-critical */ }
  }

  function stopBgm() {
    if (!bgmNodes) return;
    const nodes = bgmNodes;
    bgmNodes = null;
    bgmPlaying = false;
    try {
      const now = audioCtx.currentTime;
      nodes.masterGain.gain.linearRampToValueAtTime(0, now + 0.4);
      setTimeout(() => {
        try {
          // Disconnect from destination to guarantee silence
          nodes.masterGain.disconnect();
          nodes.oscs.forEach(o => { try { o.stop(); } catch(e) {} });
          try { nodes.lfo.stop(); } catch(e) {}
        } catch(e) {}
      }, 500);
    } catch(e) {
      // Fallback: force-disconnect immediately
      try { nodes.masterGain.disconnect(); } catch(e2) {}
      try { nodes.oscs.forEach(o => { try { o.stop(); } catch(e3) {} }); } catch(e2) {}
      try { nodes.lfo.stop(); } catch(e2) {}
    }
  }

  function updateBgmVolume() {
    if (bgmNodes && bgmNodes.masterGain) {
      bgmNodes.masterGain.gain.value = isMuted ? 0 : masterVolume * 0.04;
    }
  }

  // Auth is handled by game-header.js (see gameHeader.init below)

  // ==========================================
  // UTILITY HELPERS
  // ==========================================
  function getSpawnConfig(day) {
    let config = SPAWN_TABLE[0];
    for (const row of SPAWN_TABLE) {
      if (day >= row.minDay) config = row;
    }
    const queueBonus = (upgradeLevels.queue_expand || 0) * 2;
    const interval = config.interval * (relaxedMode ? RELAXED.spawnMult : 1);
    return { interval, maxQueue: config.maxQueue + queueBonus };
  }

  function getBasePatience(day) {
    let p = PATIENCE_TABLE[0].patience;
    for (const row of PATIENCE_TABLE) {
      if (day >= row.minDay) p = row.patience;
    }
    const patienceBonus = 1 + (upgradeLevels.patience_plus || 0) * 0.10;
    return p * patienceBonus * (relaxedMode ? RELAXED.patienceMult : 1);
  }

  function getServeTime(drinkKey) {
    const base = DRINK_TYPES[drinkKey].serveTime;
    const level = upgradeLevels.speed_boost || 0;
    return base * Math.pow(0.95, level);
  }

  function getAutoServeTimeForStation(stationIndex, drinkKey) {
    const manual = getServeTime(drinkKey);
    if (stationIndex === 2) return manual * 1.25;
    return manual * 1.5;
  }

  function getWaiterServeTime(drinkKey) {
    const manual = getServeTime(drinkKey);
    return manual * 1.5;
  }

  function getDrinkCoins(drinkKey) {
    const base = DRINK_TYPES[drinkKey].baseCoins;
    const menuBonus = (upgradeLevels.premium_menu || 0) * 2;
    return base + menuBonus;
  }

  function getAvailableDrinks(day) {
    const menuLevel = upgradeLevels.premium_menu || 0;
    const effectiveDay = day + menuLevel;
    return Object.entries(DRINK_TYPES).filter(([k, v]) => effectiveDay >= v.unlockDay).map(([k]) => k);
  }

  function getCustomerTypeWeights(day) {
    const t = Math.min(1, (day - 1) / 9);
    const weights = {};
    const available = getAvailableDrinks(day);

    for (const [type, config] of Object.entries(CUSTOMER_TYPES)) {
      if (type === 'vip') continue;
      const hasOrders = config.orderPool.some(d => available.includes(d));
      if (!hasOrders) continue;
      const w = config.earlyWeight * (1 - t) + config.lateWeight * t;
      if (w > 0) weights[type] = w;
    }
    return weights;
  }

  function weightedRandom(weights) {
    const entries = Object.entries(weights);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [key, w] of entries) {
      r -= w;
      if (r <= 0) return key;
    }
    return entries[entries.length - 1][0];
  }

  function pickOrder(customerType, day) {
    const available = getAvailableDrinks(day);
    const rawPool = CUSTOMER_TYPES[customerType].orderPool;
    const pool = (rawPool === 'ALL' ? available : rawPool.filter(d => available.includes(d)));
    if (pool.length === 0) return available[Math.floor(Math.random() * available.length)];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function formatTime(ms) {
    const secs = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function formatCoins(n) {
    return n.toLocaleString();
  }

  function getShopLevel() {
    let total = 0;
    for (const id in upgradeLevels) {
      total += (upgradeLevels[id] || 0);
    }
    // Day milestones also contribute to shop visual evolution
    // so the shop progresses even if player hasn't bought upgrades yet
    if (currentDay >= 20) total += 4;
    else if (currentDay >= 10) total += 2;
    else if (currentDay >= 5) total += 1;
    return total;
  }

  // ==========================================
  // VIP TABLE MANAGEMENT
  // ==========================================
  function getVipTableCount() {
    const vipLevel = upgradeLevels.vip_lounge || 0;
    return Math.min(vipLevel, 3);
  }

  function initVipTables() {
    const count = getVipTableCount();
    vipTables = [];
    for (let i = 0; i < count; i++) {
      vipTables.push({ occupied: false, customerId: null });
    }
  }

  function findAvailableVipTable() {
    for (let i = 0; i < vipTables.length; i++) {
      if (!vipTables[i].occupied) return i;
    }
    return -1;
  }

  function renderVipTables() {
    vipTablesContainer.innerHTML = '';
    const vipLevel = upgradeLevels.vip_lounge || 0;

    // Always show 3 table placeholders (faded if locked)
    for (let i = 0; i < 3; i++) {
      const pos = VIP_TABLE_POSITIONS[i];
      const isActive = i < vipLevel;
      const table = document.createElement('div');
      table.className = 'vip-table' + (isActive ? '' : ' faded');
      table.style.left = pos.x + 'px';
      table.style.top = pos.y + 'px';
      table.innerHTML = `
        <div class="vip-table-top"></div>
        <div class="vip-table-leg"></div>
        <div class="vip-chair chair-left"></div>
        <div class="vip-chair chair-right"></div>
      `;
      vipTablesContainer.appendChild(table);
    }
  }

  // ==========================================
  // SHOP ENVIRONMENT
  // ==========================================
  function updateShopEnvironment() {
    const shopLevel = getShopLevel();
    const shopBg = document.querySelector('.shop-bg');

    // I. Shop visual evolution
    shopBg.classList.remove('shop-level-1', 'shop-level-2', 'shop-level-3', 'shop-level-4');
    if (shopLevel >= 16) {
      shopBg.classList.add('shop-level-4');
    } else if (shopLevel >= 10) {
      shopBg.classList.add('shop-level-3');
    } else if (shopLevel >= 5) {
      shopBg.classList.add('shop-level-2');
    } else {
      shopBg.classList.add('shop-level-1');
    }

    // VIP Lounge
    const vipLevel = upgradeLevels.vip_lounge || 0;
    vipLoungeEl.classList.remove('locked', 'unlocked', 'vip-level-1', 'vip-level-2', 'vip-level-3');
    if (vipLevel > 0) {
      vipLoungeEl.classList.add('unlocked', 'vip-level-' + vipLevel);
      vipWaiterEl.style.display = 'block';
      // Position waiter at idle spot
      vipWaiterEl.style.left = '170px';
      vipWaiterEl.style.top = '70px';
    } else {
      vipLoungeEl.classList.add('locked');
      vipWaiterEl.style.display = 'none';
    }

    renderVipTables();
    initVipTables();
  }

  function triggerScreenShake() {
    gameWrap.classList.add('screen-shake');
    setTimeout(() => gameWrap.classList.remove('screen-shake'), 400);
  }

  // ==========================================
  // BARISTA ANIMATION
  // ==========================================
  function triggerBaristaServe() {
    mainBaristaEl.classList.add('serving');
    setTimeout(() => mainBaristaEl.classList.remove('serving'), 600);
  }

  // ==========================================
  // CUSTOMER MANAGEMENT
  // ==========================================
  function createCustomer() {
    const config = getSpawnConfig(currentDay);
    // Count only non-VIP customers for queue limit
    const queuedCount = customers.filter(c =>
      !c.isVip && (c.state === 'queued' || c.state === 'walking_to_queue')
    ).length;

    const vipLevel = upgradeLevels.vip_lounge || 0;
    const vipMagnetBonus = (prestigeLevel >= 3) ? 0.15 : 0; // P3 perk: VIP Magnet
    const vipChance = vipLevel > 0 ? (0.05 + vipLevel * 0.05 + vipMagnetBonus) : 0;
    let isVip = Math.random() < vipChance;

    // If VIP, check for available table
    if (isVip) {
      const tableIdx = findAvailableVipTable();
      if (tableIdx < 0) {
        isVip = false; // No table available, spawn as regular
      }
    }

    // If not VIP, check queue limit
    if (!isVip && queuedCount >= config.maxQueue) return;

    let type, order;
    if (isVip) {
      type = 'vip';
      const available = getAvailableDrinks(currentDay);
      order = available[Math.floor(Math.random() * available.length)];
      // Show VIP tutorial on first VIP customer ever
      if (!tutorialsSeen.vip) {
        tutorialsSeen.vip = true;
        saveGame();
        showVipTutorial();
      }
    } else {
      const weights = getCustomerTypeWeights(currentDay);
      type = weightedRandom(weights);
      order = pickOrder(type, currentDay);
    }

    const basePatience = getBasePatience(currentDay);
    const patienceMod = CUSTOMER_TYPES[type].patienceMod;
    const patience = basePatience * patienceMod * (0.9 + Math.random() * 0.2);

    const areaWidth = queueArea.offsetWidth || 360;

    if (isVip) {
      // VIP customer flow: find table, walk to it
      const tableIdx = findAvailableVipTable();
      if (tableIdx < 0) return; // shouldn't happen, checked above

      const tablePos = VIP_TABLE_POSITIONS[tableIdx];
      vipTables[tableIdx].occupied = true;

      const customer = {
        id: customerIdCounter++,
        type,
        order,
        isVip: true,
        maxPatience: patience,
        patience,
        state: 'walking_to_table',
        x: areaWidth + 20,
        targetX: tablePos.x,
        y: tablePos.y - 10,
        targetY: tablePos.y - 10,
        tableIndex: tableIdx,
        serveProgress: 0,
        serveTime: 0,
        el: null
      };

      vipTables[tableIdx].customerId = customer.id;
      customers.push(customer);
      createVipCustomerElement(customer);

      if (rushActive) {
        rushCustomerIds.add(customer.id);
      }
    } else {
      // Regular customer flow
      const queueX = getNextQueueX();

      const customer = {
        id: customerIdCounter++,
        type,
        order,
        isVip: false,
        maxPatience: patience,
        patience,
        state: 'walking_to_queue',
        x: areaWidth + 20,
        targetX: queueX,
        y: 30,
        serveProgress: 0,
        serveTime: 0,
        el: null
      };

      customers.push(customer);
      createCustomerElement(customer);

      if (rushActive) {
        rushCustomerIds.add(customer.id);
      }
    }
  }

  function getNextQueueX() {
    const queued = customers.filter(c => !c.isVip && (c.state === 'queued' || c.state === 'walking_to_queue' || c.state === 'serving'));
    const baseX = 40;
    const spacing = 50;
    return baseX + queued.length * spacing;
  }

  function createCustomerElement(c) {
    const el = document.createElement('div');
    el.className = 'customer' + (c.isVip ? ' vip' : '') + ' type-' + c.type + ' entering';
    el.dataset.id = c.id;
    el.style.transform = `translateX(${c.x}px)`;
    el.style.setProperty('--tx', c.x + 'px');
    el.style.top = c.y + 'px';
    // Switch from entrance to walking animation after entrance completes
    setTimeout(() => { if (el.parentNode) el.className = el.className.replace('entering', 'walking'); }, 300);

    const color = CUSTOMER_TYPES[c.type].color;

    el.innerHTML = `
      <div class="customer-shadow"></div>
      <div class="patience-icon"></div>
      <div class="patience-bar-bg">
        <div class="patience-bar" style="width:100%;background:var(--matcha)"></div>
      </div>
      ${c.isVip ? '<div class="customer-crown">👑</div>' : ''}
      <div class="customer-order">${DRINK_TYPES[c.order].emoji}</div>
      <div class="customer-face"></div>
      <div class="customer-head" style="background:${color}"></div>
      <div class="customer-body" style="background:${color}"></div>
      <div class="customer-legs">
        <div class="customer-leg" style="background:${color}"></div>
        <div class="customer-leg" style="background:${color}"></div>
      </div>
      <div class="serve-ring"></div>
    `;

    el.addEventListener('click', () => handleCustomerTap(c.id));
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      handleCustomerTap(c.id);
    }, { passive: false });

    queueArea.appendChild(el);
    c.el = el;
  }

  function createVipCustomerElement(c) {
    const el = document.createElement('div');
    el.className = 'customer vip type-vip entering';
    el.dataset.id = c.id;
    el.style.transform = `translateX(${c.x}px)`;
    el.style.setProperty('--tx', c.x + 'px');
    el.style.top = c.y + 'px';
    setTimeout(() => { if (el.parentNode) el.className = el.className.replace('entering', 'walking'); }, 300);
    el.style.pointerEvents = 'none'; // VIP not tappable

    const color = CUSTOMER_TYPES.vip.color;

    el.innerHTML = `
      <div class="customer-shadow"></div>
      <div class="patience-icon"></div>
      <div class="patience-bar-bg">
        <div class="patience-bar" style="width:100%;background:var(--matcha)"></div>
      </div>
      <div class="customer-crown">👑</div>
      <div class="customer-order">${DRINK_TYPES[c.order].emoji}</div>
      <div class="customer-face"></div>
      <div class="customer-head" style="background:${color}"></div>
      <div class="customer-body" style="background:${color}"></div>
      <div class="customer-legs">
        <div class="customer-leg" style="background:${color}"></div>
        <div class="customer-leg" style="background:${color}"></div>
      </div>
      <div class="serve-ring"></div>
    `;

    vipCustomerArea.appendChild(el);
    c.el = el;
  }

  function handleCustomerTap(customerId) {
    if (gameState !== 'PLAYING') return;
    initAudio();

    const c = customers.find(x => x.id === customerId);
    if (!c || c.state !== 'queued') return;

    // VIP customers are NOT tappable
    if (c.isVip) return;

    // Must be front of queue (non-VIP only)
    const queued = customers.filter(x => !x.isVip && x.state === 'queued').sort((a, b) => a.x - b.x);
    if (queued.length === 0 || queued[0].id !== c.id) return;

    if (manualServing) return;

    startServing(c, 'manual');
    triggerBaristaServe();
    playSound('tap');
  }

  function startServing(c, mode) {
    c.state = 'serving';
    c.serveTime = mode === 'manual' ? getServeTime(c.order) : getAutoServeTimeForStation(
      mode === 'auto0' ? 0 : mode === 'auto1' ? 1 : 2,
      c.order
    );
    c.serveProgress = 0;

    if (mode === 'manual') {
      manualServing = c.id;
      c.targetX = 20;
    } else {
      const stationIdx = parseInt(mode.charAt(4));
      autoServing[stationIdx] = c.id;
      updateAutoStationsUI();
    }

    if (c.el) {
      c.el.classList.remove('walking');
      c.el.style.animation = 'servingGlow 1s ease-in-out infinite';
    }

    recalcQueuePositions();
  }

  function completeServe(c) {
    const baseCoins = getDrinkCoins(c.order);
    const vipMultiplier = c.isVip ? 2 : 1;
    comboStreak++;
    if (comboStreak > peakCombo) peakCombo = comboStreak;
    const comboMultiplier = Math.min(3.0, 1.0 + comboStreak * 0.1);

    let tipBonus = 0;
    const tipLevel = upgradeLevels.tip_jar || 0;
    const patienceRatio = c.patience / c.maxPatience;
    if (patienceRatio > 0.9) {
      tipBonus = 5 + tipLevel;
    } else if (patienceRatio > 0.75) {
      tipBonus = 2 + tipLevel;
    }

    const prestigeMultiplier = 1 + prestigeLevel * 0.05;
    const bridgeMultiplier = (prestigeBridgeDays > 0) ? 2 : 1; // Prestige bridge: 2x for 3 days
    const rushMasterMultiplier = (prestigeLevel >= 4 && rushActive) ? 2 : 1; // P4 perk: Rush Master
    const totalCoins = Math.floor(baseCoins * vipMultiplier * comboMultiplier * prestigeMultiplier * bridgeMultiplier * rushMasterMultiplier) + tipBonus;
    dayRevenue += totalCoins;
    customersServed++;

    updateComboDisplay();

    // Coin animation - use appropriate container
    const area = c.isVip ? vipCustomerArea : queueArea;
    if (c.isVip) {
      spawnCoinAnimationInArea(c, vipCustomerArea);
      spawnFloatingTextInArea(c, `+$${totalCoins}`, vipCustomerArea);
    } else {
      spawnCoinAnimation(c);
      spawnFloatingText(c, `+$${totalCoins}`);
    }

    // C. Coin collection particles
    spawnCoinParticles(c, area);

    // B. Sparkle particles from celebration
    spawnSparkleParticles(c, area);

    // H. Tip indicator
    if (tipBonus > 0) {
      spawnTipIndicator(c, area);
    }

    playSound('serve');
    setTimeout(() => playSound('coin'), 100);
    if (comboStreak > 1 && comboStreak % 3 === 0) {
      setTimeout(() => playSound('combo'), 200);
    }

    if (c.isVip) {
      // VIP leaves from lounge (walk right)
      c.state = 'leaving_lounge';
      c.targetX = (vipCustomerArea.offsetWidth || 400) + 60;

      // Free the table
      if (c.tableIndex !== undefined && c.tableIndex >= 0 && c.tableIndex < vipTables.length) {
        vipTables[c.tableIndex].occupied = false;
        vipTables[c.tableIndex].customerId = null;
      }
    } else {
      // Regular customer exits left with happy bounce
      c.state = 'leaving_happy';
      c.targetX = -60;
    }

    if (c.el) {
      c.el.style.animation = '';
      c.el.classList.add('happy-bounce');
      c.el.style.setProperty('--tx', c.x + 'px');
      const face = c.el.querySelector('.customer-face');
      if (face) face.textContent = '😊';
      setTimeout(() => {
        if (c.el) c.el.classList.remove('happy-bounce');
      }, 500);
    }

    // Release serve slot
    if (manualServing === c.id) manualServing = null;
    for (let i = 0; i < 3; i++) {
      if (autoServing[i] === c.id) { autoServing[i] = null; updateAutoStationsUI(); }
    }

    recalcQueuePositions();
  }

  function customerAngry(c) {
    customersLost++;
    dayPenalties += 5;

    const keeperLevel = upgradeLevels.combo_keeper || 0;
    if (comboForgives < keeperLevel) {
      comboForgives++;
    } else {
      const prevCombo = comboStreak;
      // Soften combo loss: halve instead of reset to zero
      // Combo Keeper forgives entirely (handled above); this is the fallback
      comboStreak = Math.floor(comboStreak / 2);
      comboForgives = 0;
      updateComboDisplay();
      // F. Visual feedback for combo loss
      if (prevCombo > 0 && comboStreak === 0) {
        showComboLostFlash();
      } else if (prevCombo > comboStreak) {
        // Combo halved but not lost — show brief indicator
        hudCombo.classList.add('shake');
        setTimeout(() => hudCombo.classList.remove('shake'), 400);
      }
    }

    if (rushActive && rushCustomerIds.has(c.id)) {
      rushLostAny = true;
    }

    if (c.isVip) {
      // VIP angry: leave from lounge (walk right)
      c.state = 'leaving_lounge';
      c.targetX = (vipCustomerArea.offsetWidth || 400) + 60;

      // Free the table
      if (c.tableIndex !== undefined && c.tableIndex >= 0 && c.tableIndex < vipTables.length) {
        vipTables[c.tableIndex].occupied = false;
        vipTables[c.tableIndex].customerId = null;
      }

      // Reset waiter if serving this customer
      if (waiterTargetCustomerId === c.id) {
        waiterState = 'idle';
        waiterTargetCustomerId = null;
        waiterServeTimer = 0;
        vipWaiterEl.classList.remove('serving');
      }
    } else {
      c.state = 'leaving_angry';
      c.targetX = (queueArea.offsetWidth || 360) + 60;
    }

    if (c.el) {
      c.el.classList.add('angry');
      c.el.classList.remove('walking');
      c.el.style.setProperty('--tx', c.x + 'px');
      const order = c.el.querySelector('.customer-order');
      if (order) order.textContent = '😤';
      const face = c.el.querySelector('.customer-face');
      if (face) face.textContent = '';
    }

    playSound('angry');

    // Release serve slot
    if (manualServing === c.id) manualServing = null;
    for (let i = 0; i < 3; i++) {
      if (autoServing[i] === c.id) { autoServing[i] = null; updateAutoStationsUI(); }
    }

    recalcQueuePositions();
  }

  function recalcQueuePositions() {
    const inQueue = customers.filter(c => !c.isVip && (c.state === 'queued' || c.state === 'walking_to_queue' || c.state === 'serving')).sort((a, b) => a.targetX - b.targetX);
    const baseX = 40;
    const spacing = 50;
    inQueue.forEach((c, i) => {
      c.targetX = baseX + i * spacing;
    });
  }

  function spawnCoinAnimation(c) {
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const coin = document.createElement('div');
      coin.className = 'coin-pop';
      coin.style.left = (c.x + 20 + (Math.random() - 0.5) * 24) + 'px';
      coin.style.top = (c.y + 10 + (Math.random() - 0.5) * 10) + 'px';
      coin.style.animationDelay = (i * 0.08) + 's';
      coin.style.width = (8 + Math.random() * 6) + 'px';
      coin.style.height = coin.style.width;
      queueArea.appendChild(coin);
      setTimeout(() => coin.remove(), 800);
    }
    // Trail one coin to the wallet HUD
    spawnCoinTrailToWallet(c);
  }

  function spawnCoinAnimationInArea(c, area) {
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const coin = document.createElement('div');
      coin.className = 'coin-pop';
      coin.style.left = (c.x + 20 + (Math.random() - 0.5) * 24) + 'px';
      coin.style.top = (c.y + 10 + (Math.random() - 0.5) * 10) + 'px';
      coin.style.animationDelay = (i * 0.08) + 's';
      coin.style.width = (8 + Math.random() * 6) + 'px';
      coin.style.height = coin.style.width;
      area.appendChild(coin);
      setTimeout(() => coin.remove(), 800);
    }
    spawnCoinTrailToWallet(c);
  }

  function spawnCoinTrailToWallet(c) {
    const walletEl = document.getElementById('hudCoins');
    if (!walletEl) return;
    const walletRect = walletEl.getBoundingClientRect();
    const gameRect = gameWrap.getBoundingClientRect();

    const startX = gameRect.left + c.x + 20;
    const startY = gameRect.top + (c.y || 40) + 10;
    const endX = walletRect.left + walletRect.width / 2;
    const endY = walletRect.top + walletRect.height / 2;

    const coin = document.createElement('div');
    coin.className = 'coin-to-wallet';
    coin.textContent = '';
    coin.style.left = startX + 'px';
    coin.style.top = startY + 'px';
    document.body.appendChild(coin);

    coin.animate([
      { left: startX + 'px', top: startY + 'px', opacity: 1, transform: 'scale(1)' },
      { left: endX + 'px', top: endY + 'px', opacity: 0.8, transform: 'scale(0.5)', offset: 0.8 },
      { left: endX + 'px', top: endY + 'px', opacity: 0, transform: 'scale(0)' }
    ], {
      duration: 450,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      delay: 150
    }).onfinish = () => {
      coin.remove();
      // Pulse the wallet display on arrival
      walletEl.parentElement.classList.add('pulse');
      setTimeout(() => walletEl.parentElement.classList.remove('pulse'), 200);
    };
  }

  function spawnFloatingText(c, text) {
    const el = document.createElement('div');
    el.className = 'floating-text';
    el.textContent = text;
    el.style.left = (c.x + 10) + 'px';
    el.style.top = (c.y - 5) + 'px';
    queueArea.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  function spawnFloatingTextInArea(c, text, area) {
    const el = document.createElement('div');
    el.className = 'floating-text';
    el.textContent = text;
    el.style.left = (c.x + 10) + 'px';
    el.style.top = (c.y - 5) + 'px';
    area.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  function updateComboDisplay() {
    const mult = Math.min(3.0, 1.0 + comboStreak * 0.1).toFixed(1);
    hudCombo.textContent = `🔥 x${mult}`;
    hudCombo.classList.add('pulse');
    setTimeout(() => hudCombo.classList.remove('pulse'), 200);

    hudCombo.classList.remove('combo-warm', 'combo-hot', 'combo-fire');
    const multVal = parseFloat(mult);
    if (multVal >= 2.5) {
      hudCombo.classList.add('combo-fire');
    } else if (multVal >= 2.0) {
      hudCombo.classList.add('combo-hot');
    } else if (multVal >= 1.5) {
      hudCombo.classList.add('combo-warm');
    }
  }

  // ==========================================
  // AUTO-SERVE LOGIC
  // ==========================================
  function getAutoServeStations() {
    const stations = [];
    if (upgradeLevels.auto_serve_1) stations.push({ index: 0, maxBaseCoins: 10 });
    if (upgradeLevels.auto_serve_2) stations.push({ index: 1, maxBaseCoins: 20 });
    if (upgradeLevels.auto_serve_3) stations.push({ index: 2, maxBaseCoins: 999 });
    return stations;
  }

  function updateAutoStationsUI() {
    autoStationsEl.innerHTML = '';
    const stations = getAutoServeStations();
    stations.forEach((s, i) => {
      const isActive = autoServing[s.index] !== null;
      const div = document.createElement('div');
      div.className = 'auto-barista-station station-' + s.index + (isActive ? ' active' : ' idle');

      let drinkEmoji = '';
      if (isActive) {
        const c = customers.find(x => x.id === autoServing[s.index]);
        if (c) drinkEmoji = DRINK_TYPES[c.order].emoji;
      }

      div.innerHTML = `
        <div class="drink-label">${drinkEmoji}</div>
        <div class="barista">
          <div class="barista-head"></div>
          <div class="barista-arm left"></div>
          <div class="barista-arm right"></div>
          <div class="barista-body"></div>
        </div>
      `;
      autoStationsEl.appendChild(div);
    });
  }

  function tryAutoServe() {
    const stations = getAutoServeStations();
    // Only pick non-VIP queued customers
    const queued = customers.filter(c => !c.isVip && c.state === 'queued').sort((a, b) => a.x - b.x);

    for (const station of stations) {
      if (autoServing[station.index] !== null) continue;

      for (const c of queued) {
        if (c.id === manualServing) continue;
        if (autoServing.includes(c.id)) continue;
        const baseCoins = DRINK_TYPES[c.order].baseCoins;
        if (baseCoins <= station.maxBaseCoins) {
          startServing(c, `auto${station.index}`);
          break;
        }
      }
    }
  }

  // ==========================================
  // WAITER AI (VIP LOUNGE)
  // ==========================================
  function updateWaiter(dt) {
    const vipLevel = upgradeLevels.vip_lounge || 0;
    if (vipLevel <= 0) return;

    if (waiterState === 'idle') {
      // Find oldest seated VIP customer
      const seated = customers
        .filter(c => c.isVip && c.state === 'seated')
        .sort((a, b) => a.id - b.id); // oldest first

      if (seated.length > 0) {
        const target = seated[0];
        waiterState = 'walking';
        waiterTargetCustomerId = target.id;
        target.state = 'waiter_coming';

        // Move waiter to customer's table position
        const tablePos = VIP_TABLE_POSITIONS[target.tableIndex];
        if (tablePos) {
          vipWaiterEl.style.left = (tablePos.x - 5) + 'px';
          vipWaiterEl.style.top = (tablePos.y + 10) + 'px';
        }

        // After transition (0.8s), start serving
        setTimeout(() => {
          if (waiterState === 'walking' && waiterTargetCustomerId === target.id) {
            const c = customers.find(x => x.id === target.id);
            if (c && (c.state === 'waiter_coming')) {
              waiterState = 'serving';
              waiterServeTime = getWaiterServeTime(c.order);
              waiterServeTimer = 0;
              c.state = 'being_served_vip';
              c.serveTime = waiterServeTime;
              c.serveProgress = 0;
              vipWaiterEl.classList.add('serving');
            } else {
              // Customer left before waiter arrived
              waiterState = 'idle';
              waiterTargetCustomerId = null;
              vipWaiterEl.classList.remove('serving');
              resetWaiterPosition();
            }
          }
        }, 800);
      }
    }

    if (waiterState === 'serving') {
      waiterServeTimer += dt;
      const c = customers.find(x => x.id === waiterTargetCustomerId);
      if (c && c.state === 'being_served_vip') {
        c.serveProgress = waiterServeTimer;

        // Update serve ring
        if (c.el) {
          const ring = c.el.querySelector('.serve-ring');
          if (ring) {
            const pct = Math.min(1, c.serveProgress / c.serveTime);
            ring.classList.add('active');
            ring.style.background = `conic-gradient(var(--matcha) ${pct * 360}deg, transparent ${pct * 360}deg)`;
          }
        }

        // Patience drains at 50% rate while being served
        c.patience -= dt * 0.5;
        updatePatienceBar(c);

        if (c.patience <= 0) {
          customerAngry(c);
          waiterState = 'idle';
          waiterTargetCustomerId = null;
          waiterServeTimer = 0;
          vipWaiterEl.classList.remove('serving');
          resetWaiterPosition();
        } else if (waiterServeTimer >= waiterServeTime) {
          // Serve complete!
          completeServe(c);
          waiterState = 'idle';
          waiterTargetCustomerId = null;
          waiterServeTimer = 0;
          vipWaiterEl.classList.remove('serving');
          resetWaiterPosition();
        }
      } else {
        // Customer gone
        waiterState = 'idle';
        waiterTargetCustomerId = null;
        waiterServeTimer = 0;
        vipWaiterEl.classList.remove('serving');
        resetWaiterPosition();
      }
    }
  }

  function resetWaiterPosition() {
    vipWaiterEl.style.left = '170px';
    vipWaiterEl.style.top = '70px';
  }

  // ==========================================
  // GAME LOOP
  // ==========================================
  function gameLoop(timestamp) {
    // M. Stop game loop when not playing
    if (gameState !== 'PLAYING') {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
      return;
    }

    if (lastFrameTime === 0) lastFrameTime = timestamp;
    const dt = Math.min(timestamp - lastFrameTime, 100);
    lastFrameTime = timestamp;

    // Update day timer
    dayTimer -= dt;
    if (dayTimer <= 0) {
      dayTimer = 0;
      endDay();
      return;
    }

    // Update HUD
    hudCoins.textContent = formatCoins(Math.max(0, dayRevenue - dayPenalties));
    hudTimer.textContent = formatTime(dayTimer);

    // D. Update wall clock hand rotation based on timer progress
    const clockProgress = 1 - (dayTimer / DAY_DURATION);
    const clockHand = document.getElementById('clockHand');
    if (clockHand) {
      clockHand.style.transform = 'rotate(' + (clockProgress * 360) + 'deg)';
    }

    // Spawn timer
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      const config = getSpawnConfig(currentDay);
      let interval = config.interval;
      if (rushActive) interval *= 0.5;
      spawnTimer = interval * (0.8 + Math.random() * 0.4);
      createCustomer();
    }

    // Rush hour logic — 3-second countdown warning before rush starts
    if (rushScheduled && !rushActive) {
      const elapsed = DAY_DURATION - dayTimer;
      const timeUntilRush = rushStartTime - elapsed;
      if (timeUntilRush <= 3000 && timeUntilRush > 0 && !rushWarningShown) {
        rushWarningShown = true;
        rushBanner.textContent = '\u26A1 RUSH INCOMING! \u26A1';
        rushBanner.classList.add('visible');
        playSound('warning');
      }
      if (elapsed >= rushStartTime) {
        rushActive = true;
        rushTimer = 10000;
        rushBanner.textContent = '\u26A1 RUSH HOUR! \u26A1';
        rushBanner.classList.add('visible');
        playSound('rush');
        triggerScreenShake();
      }
    }
    if (rushActive) {
      rushTimer -= dt;
      // G. Rush hour countdown
      const rushSecs = Math.max(0, Math.ceil(rushTimer / 1000));
      rushBanner.textContent = `\u26A1 RUSH HOUR! ${rushSecs}s \u26A1`;
      if (rushTimer <= 0) {
        rushActive = false;
        rushBanner.classList.remove('visible');
        rushBanner.textContent = '\u26A1 RUSH HOUR! \u26A1';
      }
    }

    // Update customers
    for (const c of customers) {
      // Regular customer states
      if (c.state === 'walking_to_queue') {
        const speed = 120;
        const dx = c.targetX - c.x;
        if (Math.abs(dx) < 2) {
          c.x = c.targetX;
          c.state = 'queued';
          if (c.el) c.el.classList.remove('walking');
        } else {
          c.x += Math.sign(dx) * speed * (dt / 1000);
          if ((dx > 0 && c.x > c.targetX) || (dx < 0 && c.x < c.targetX)) {
            c.x = c.targetX;
            c.state = 'queued';
            if (c.el) c.el.classList.remove('walking');
          }
        }
      }

      // VIP walking to table
      if (c.state === 'walking_to_table') {
        const speed = 120;
        const dx = c.targetX - c.x;
        if (Math.abs(dx) < 3) {
          c.x = c.targetX;
          c.state = 'seated';
          if (c.el) c.el.classList.remove('walking');
        } else {
          c.x += Math.sign(dx) * speed * (dt / 1000);
          if ((dx > 0 && c.x > c.targetX) || (dx < 0 && c.x < c.targetX)) {
            c.x = c.targetX;
            c.state = 'seated';
            if (c.el) c.el.classList.remove('walking');
          }
        }
      }

      // VIP seated - patience ticks, waiting for waiter
      if (c.state === 'seated' || c.state === 'waiter_coming') {
        c.patience -= dt;
        updatePatienceBar(c);
        if (c.patience <= 0) {
          customerAngry(c);
        } else {
          const ratio = c.patience / c.maxPatience;
          if (ratio < 0.25 && c.el && !c.el.classList.contains('impatient')) {
            c.el.classList.add('impatient');
            const face = c.el.querySelector('.customer-face');
            if (face) face.textContent = '😤';
          }
        }
      }

      if (c.state === 'queued') {
        c.patience -= dt;
        const dx = c.targetX - c.x;
        if (Math.abs(dx) > 1) {
          c.x += Math.sign(dx) * 100 * (dt / 1000);
          if (Math.abs(c.targetX - c.x) < 1) c.x = c.targetX;
        }

        if (c.patience <= 0) {
          customerAngry(c);
        } else {
          updatePatienceBar(c);
          const ratio = c.patience / c.maxPatience;
          if (ratio < 0.25 && c.el && !c.el.classList.contains('impatient')) {
            c.el.classList.add('impatient');
            const face = c.el.querySelector('.customer-face');
            if (face) face.textContent = '😤';
          }
        }
      }

      if (c.state === 'serving') {
        c.serveProgress += dt;
        const dx = c.targetX - c.x;
        if (Math.abs(dx) > 1) {
          c.x += Math.sign(dx) * 120 * (dt / 1000);
        }

        if (c.el) {
          const ring = c.el.querySelector('.serve-ring');
          if (ring) {
            const pct = Math.min(1, c.serveProgress / c.serveTime);
            ring.classList.add('active');
            ring.style.background = `conic-gradient(var(--matcha) ${pct * 360}deg, transparent ${pct * 360}deg)`;
          }
        }

        c.patience -= dt * 0.5; // 50% drain rate while being served
        updatePatienceBar(c);

        if (c.patience <= 0) {
          customerAngry(c);
        } else if (c.serveProgress >= c.serveTime) {
          completeServe(c);
        }
      }

      // being_served_vip is handled by updateWaiter

      if (c.state === 'leaving_happy') {
        c.x -= 120 * (dt / 1000);
        if (c.x < -60) c.state = 'gone';
      }

      if (c.state === 'leaving_angry') {
        c.x += 100 * (dt / 1000);
        if (c.x > (queueArea.offsetWidth || 400) + 60) c.state = 'gone';
      }

      if (c.state === 'leaving_lounge') {
        c.x += 100 * (dt / 1000);
        if (c.x > (vipCustomerArea.offsetWidth || 400) + 60) c.state = 'gone';
      }

      // Update position
      if (c.el) {
        c.el.style.transform = `translateX(${c.x}px)`;
        c.el.style.setProperty('--tx', c.x + 'px');
      }
    }

    // Remove gone customers
    customers = customers.filter(c => {
      if (c.state === 'gone') {
        if (c.el) c.el.remove();
        return false;
      }
      return true;
    });

    // Auto-serve (regular customers only)
    tryAutoServe();

    // Waiter AI (VIP customers)
    updateWaiter(dt);

    animFrameId = requestAnimationFrame(gameLoop);
  }

  function updatePatienceBar(c) {
    if (!c.el) return;
    const bar = c.el.querySelector('.patience-bar');
    const icon = c.el.querySelector('.patience-icon');
    if (!bar) return;
    const ratio = Math.max(0, c.patience / c.maxPatience);
    bar.style.width = (ratio * 100) + '%';
    if (ratio > 0.5) {
      bar.style.background = 'var(--matcha)';
      if (icon) { icon.textContent = ''; icon.className = 'patience-icon'; }
    } else if (ratio > 0.25) {
      bar.style.background = 'var(--gold)';
      if (icon) { icon.textContent = '⚠'; icon.className = 'patience-icon warn'; }
    } else {
      bar.style.background = 'var(--coral)';
      if (icon) { icon.textContent = '!!'; icon.className = 'patience-icon urgent'; }
    }
  }

  // ==========================================
  // DAY MANAGEMENT
  // ==========================================
  function startDay() {
    initAudio();
    gameState = 'PLAYING';
    dayStartTime = Date.now();
    dayTimer = DAY_DURATION;
    dayRevenue = 0;
    dayPenalties = 0;
    customersServed = 0;
    customersLost = 0;
    comboStreak = (prestigeLevel >= 2) ? 10 : 0; // P2 perk: Auto Combo — start at 2x
    peakCombo = 0;
    comboForgives = 0;
    manualServing = null;
    autoServing = [null, null, null];
    rushActive = false;
    rushTimer = 0;
    rushLostAny = false;
    rushCustomerIds = new Set();
    rushHadEvent = false;
    rushWarningShown = false;
    spawnTimer = 1000;
    lastFrameTime = 0;

    // Reset waiter
    waiterState = 'idle';
    waiterTargetCustomerId = null;
    waiterServeTimer = 0;
    waiterServeTime = 0;

    // Clear existing customers
    customers.forEach(c => { if (c.el) c.el.remove(); });
    customers = [];

    // Init VIP tables
    initVipTables();

    // Rush hour scheduling
    if (currentDay >= 5 && Math.random() < 0.3) {
      rushScheduled = true;
      rushStartTime = 15000 + Math.random() * 30000;
      rushHadEvent = true;
    } else {
      rushScheduled = false;
    }

    // P5 perk: Golden Start — 50 bonus coins at day start
    if (prestigeLevel >= 5) {
      dayRevenue += 50;
    }

    // Prestige bridge: 2x earnings for first 3 days after prestige
    if (prestigeBridgeDays > 0) {
      prestigeBridgeDays--;
      saveGame();
    }

    // Daily challenge — pick based on day number (deterministic rotation)
    dailyChallenge = DAILY_CHALLENGES[(currentDay - 1) % DAILY_CHALLENGES.length];
    dailyChallengeComplete = false;

    // UI
    hideAllOverlays();
    hudEl.style.display = 'flex';
    dayBadge.textContent = `Day ${currentDay}`;
    hudCoins.textContent = '0';
    hudTimer.textContent = '1:00';
    updateComboDisplay();
    updateAutoStationsUI();
    updateShopEnvironment();

    playSound('dayStart');
    startBgm();

    // M. Start game loop
    if (!animFrameId) {
      animFrameId = requestAnimationFrame(gameLoop);
    }

    // E. Tutorial on first day
    if (!tutorialsSeen.main) {
      showTutorial();
    }
  }

  function endDay() {
    if (gameState !== 'PLAYING') return;
    gameState = 'DAY_END';
    // M. Cancel game loop
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    stopBgm();
    playSound('dayEnd');

    rushBanner.classList.remove('visible');
    rushActive = false;

    // Clean up ALL remaining customers
    customers.forEach(c => {
      if (manualServing === c.id) manualServing = null;
      for (let i = 0; i < 3; i++) {
        if (autoServing[i] === c.id) autoServing[i] = null;
      }
      if (c.isVip && c.tableIndex !== undefined && c.tableIndex >= 0 && c.tableIndex < vipTables.length) {
        vipTables[c.tableIndex].occupied = false;
        vipTables[c.tableIndex].customerId = null;
      }
      c.state = 'gone';
      if (c.el) c.el.remove();
    });
    customers = [];

    // Reset waiter
    waiterState = 'idle';
    waiterTargetCustomerId = null;
    vipWaiterEl.classList.remove('serving');

    const finalRevenue = Math.max(0, dayRevenue - dayPenalties);
    const isNewBest = finalRevenue > bestScore;

    submitScore(finalRevenue);

    if (isNewBest) {
      playSound('newBest');
      triggerScreenShake();
      // J. Confetti celebration
      spawnConfetti();
      bestScore = finalRevenue;
      // Show prominent full-screen personal best banner
      showPersonalBestBanner(finalRevenue);
    }

    wallet += finalRevenue;

    // Update cumulative stats
    cumulativeStats.totalServed += customersServed;
    cumulativeStats.totalLost += customersLost;
    cumulativeStats.totalCoinsEarned += finalRevenue;
    cumulativeStats.daysPlayed++;
    if (peakCombo > cumulativeStats.bestCombo) cumulativeStats.bestCombo = peakCombo;

    saveGame();

    let rushSurvivorEarned = false;
    if (rushHadEvent && !rushLostAny && rushCustomerIds.size > 0) {
      const rushGone = [...rushCustomerIds].every(id => {
        const c = customers.find(x => x.id === id);
        return !c || c.state === 'leaving_happy' || c.state === 'leaving_lounge' || c.state === 'gone';
      });
      if (rushGone) rushSurvivorEarned = true;
    }

    checkAchievements({
      dayNumber: currentDay,
      dayRevenue: finalRevenue,
      customersServed,
      customersLost,
      peakComboStreak: peakCombo,
      rushSurvivor: rushSurvivorEarned
    });

    currentDay++;
    saveGame();

    // Check daily challenge
    let challengeBonus = 0;
    if (dailyChallenge && !dailyChallengeComplete) {
      const val = dailyChallenge.field === 'dayRevenue' ? finalRevenue
        : dailyChallenge.field === 'customersServed' ? customersServed
        : dailyChallenge.field === 'customersLost' ? customersLost
        : dailyChallenge.field === 'peakCombo' ? peakCombo : 0;
      const met = dailyChallenge.compare === 'eq' ? val === dailyChallenge.target
        : dailyChallenge.compare === 'lte' ? val <= dailyChallenge.target
        : val >= dailyChallenge.target;
      if (met) {
        dailyChallengeComplete = true;
        challengeBonus = dailyChallenge.bonus;
        wallet += challengeBonus;
        playSound('achievement');
      }
    }

    // Announce to screen readers
    const sr = document.getElementById('srAnnounce');
    if (sr) sr.textContent = `Day ${currentDay} complete. Revenue: ${finalRevenue} coins. Served: ${customersServed}. Lost: ${customersLost}.`;

    setTimeout(() => showDayEnd(finalRevenue, isNewBest, dayPenalties, challengeBonus), 1000);
  }

  function showDayEnd(revenue, isNewBest, penalties, challengeBonus = 0) {
    const modal = document.getElementById('dayEndModal');
    const ch = dailyChallenge;
    const challengeDesc = ch ? ch.desc.replace('{n}', ch.target) : '';
    const challengeHtml = ch ? `
      <div class="modal-row" style="border-top:1px dashed rgba(0,0,0,0.1);margin-top:0.4rem;padding-top:0.4rem;">
        <span>🎯 ${challengeDesc}</span>
        <span style="color:${challengeBonus > 0 ? 'var(--matcha)' : 'var(--coral)'}; font-weight:700;">
          ${challengeBonus > 0 ? `+${challengeBonus} 🪙` : 'Not yet'}
        </span>
      </div>` : '';
    modal.innerHTML = `
      <h2>☀️ Day ${currentDay - 1} Complete!</h2>
      <div class="modal-row"><span>Revenue</span><span>💰 ${formatCoins(revenue)}</span></div>
      ${penalties > 0 ? `<div class="modal-row" style="color:var(--coral);font-size:0.8rem;"><span>Penalties (${customersLost} lost)</span><span>-${penalties} 🪙</span></div>` : ''}
      <div class="modal-row"><span>Served</span><span>🧋 ${customersServed}</span></div>
      <div class="modal-row"><span>Lost</span><span>😤 ${customersLost}</span></div>
      <div class="modal-row"><span>Best Combo</span><span>🔥 x${Math.min(3.0, 1.0 + peakCombo * 0.1).toFixed(1)}</span></div>
      ${challengeHtml}
      ${isNewBest ? '<div class="new-best">⭐ NEW PERSONAL BEST! ⭐</div>' : ''}
      <br>
      <div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;">
        <button class="btn" onclick="showShop()">Continue</button>
        <button class="btn btn-secondary btn-small" id="shareBtn" onclick="shareScore(${revenue}, ${currentDay - 1})">📤 Share</button>
      </div>
    `;
    showOverlay('dayEndOverlay');
  }

  // ==========================================
  // SCORE SHARING
  // ==========================================
  async function shareScore(revenue, day) {
    const text = `I earned ${formatCoins(revenue)} coins on Day ${day} in Tiny Tycoon! Can you beat my score?`;
    const url = 'https://weeklyarcade.games/games/tiny-tycoon/';

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Tiny Tycoon Score', text, url });
      } catch(e) { /* user cancelled share */ }
    } else {
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        const btn = document.getElementById('shareBtn');
        if (btn) {
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = '📤 Share'; }, 1500);
        }
      } catch(e) { /* clipboard failed */ }
    }
  }

  // ==========================================
  // UPGRADE SHOP
  // ==========================================
  function showShop() {
    gameState = 'UPGRADE_SHOP';
    // M. Cancel game loop
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    hideAllOverlays();
    hudEl.style.display = 'none';
    renderShop();
    showOverlay('shopOverlay');
  }

  function renderShop() {
    const modal = document.getElementById('shopModal');

    const stations = getAutoServeStations();
    let machinesHtml = '';
    for (let i = 0; i < stations.length; i++) {
      machinesHtml += '<div class="shop-preview-machine"></div>';
    }

    const vipLevel = upgradeLevels.vip_lounge || 0;

    let html = `
      <div class="shop-preview">
        <div class="shop-preview-rope"></div>
        <div class="shop-preview-vip${vipLevel > 0 ? ' active' : ''}"></div>
        <div class="shop-preview-machines">${machinesHtml}</div>
        <div class="shop-preview-counter"></div>
        <div class="shop-preview-label">Your Shop</div>
      </div>
      <div class="shop-wallet">💰 Wallet: ${formatCoins(wallet)} coins${prestigeLevel > 0 ? ` <span style="color:var(--gold);font-size:0.7rem;font-weight:700;">✨ P${prestigeLevel} (+${prestigeLevel * 5}%)</span>` : ''}</div>
    `;

    let firstLockedTeaser = null;
    for (const [id, upgrade] of Object.entries(UPGRADES)) {
      const level = upgradeLevels[id] || 0;
      const maxed = level >= upgrade.maxLevel;
      const cost = maxed ? 0 : upgrade.costFn(level);
      const canAfford = wallet >= cost && !maxed;
      const locked = upgrade.requires && !(upgradeLevels[upgrade.requires] || 0);

      // K. Skip locked upgrades from main list; show first as teaser below
      if (locked) {
        if (!firstLockedTeaser) {
          firstLockedTeaser = { id, upgrade };
        }
        continue;
      }

      let cardClass = 'upgrade-card';
      if (maxed) cardClass += ' maxed';
      else if (canAfford) cardClass += ' affordable';
      else cardClass += ' too-expensive';

      const visibleTag = upgrade.visible ? '<div class="upgrade-visible-tag">Shows in shop!</div>' : '';

      html += `
        <div class="${cardClass}">
          <div class="upgrade-icon">${upgrade.icon}</div>
          <div class="upgrade-info">
            <div class="upgrade-name">${upgrade.name}</div>
            <div class="upgrade-desc">${upgrade.desc}</div>
            <div class="upgrade-level">Lv ${level}/${upgrade.maxLevel}</div>
            ${visibleTag}
          </div>
          ${maxed ? '<span style="color:var(--gold);font-weight:700;font-size:0.8rem;border:1px solid var(--gold);padding:2px 8px;border-radius:6px;">MAX</span>' :
            `<button class="upgrade-buy-btn ${canAfford ? 'affordable' : ''}"
              ${canAfford ? '' : 'disabled'}
              onclick="buyUpgrade('${id}')">${formatCoins(cost)} 🪙</button>`
          }
        </div>
      `;
    }

    // K. Next unlock teaser card
    if (firstLockedTeaser) {
      const { upgrade } = firstLockedTeaser;
      html += `
        <div class="upgrade-card teaser">
          <div class="upgrade-icon">${upgrade.icon}</div>
          <div class="upgrade-info">
            <div class="upgrade-name">${upgrade.name}</div>
            <div class="upgrade-desc">${upgrade.desc}</div>
          </div>
          <span style="color:#999;font-size:0.7rem;">&#128274; Requires: ${UPGRADES[upgrade.requires].name}</span>
        </div>
      `;
    }

    const prestigeBtn = allUpgradesMaxed() ? `<button class="btn prestige-btn" onclick="showPrestigeConfirm()">✨ Prestige</button>` : '';

    html += `
      <div class="shop-actions">
        <button class="btn" onclick="startDay()">Start Day ${currentDay}</button>
        ${prestigeBtn}
        <button class="btn btn-secondary btn-small" onclick="showTitle()">Menu</button>
      </div>
    `;

    modal.innerHTML = html;
  }

  function buyUpgrade(id) {
    const upgrade = UPGRADES[id];
    const level = upgradeLevels[id] || 0;
    if (level >= upgrade.maxLevel) return;
    if (upgrade.requires && !(upgradeLevels[upgrade.requires] || 0)) return;

    const cost = upgrade.costFn(level);
    if (wallet < cost) return;

    wallet -= cost;
    upgradeLevels[id] = level + 1;
    saveGame();
    playSound('upgrade');

    checkAchievements({
      upgraded: true,
      upgradeId: id,
      upgradeLevel: level + 1,
      maxLevel: upgrade.maxLevel
    });

    renderShop();
  }

  // ==========================================
  // PRESTIGE SYSTEM
  // ==========================================
  function allUpgradesMaxed() {
    for (const [id, upgrade] of Object.entries(UPGRADES)) {
      if ((upgradeLevels[id] || 0) < upgrade.maxLevel) return false;
    }
    return true;
  }

  function showPrestigeConfirm() {
    const nextLevel = prestigeLevel + 1;
    const bonusPct = nextLevel * 5;
    const modal = document.getElementById('shopModal');
    const html = `
      <div style="text-align:center;padding:1rem 0;">
        <div style="font-size:2.5rem;margin-bottom:0.5rem;">✨</div>
        <h2 style="color:var(--gold);margin-bottom:0.5rem;">Prestige ${nextLevel}</h2>
        <p style="font-size:0.85rem;color:var(--brown);margin-bottom:0.75rem;">
          You've maxed every upgrade! Ready for a new challenge?
        </p>
        <div style="background:rgba(0,0,0,0.04);border-radius:10px;padding:0.75rem;margin-bottom:1rem;text-align:left;font-size:0.8rem;">
          <div style="margin-bottom:0.3rem;"><strong>You keep:</strong> Achievements, stats, best score</div>
          <div style="margin-bottom:0.3rem;"><strong>Reset:</strong> Upgrades, wallet → 500 coins, day counter</div>
          <div style="color:var(--matcha);font-weight:700;">Gain: +${bonusPct}% coin bonus + 2x earnings for 3 days</div>
          ${PRESTIGE_PERKS[nextLevel] ? `<div style="margin-top:0.4rem;color:var(--taro);font-weight:700;">${PRESTIGE_PERKS[nextLevel].icon} New Perk: ${PRESTIGE_PERKS[nextLevel].name} — ${PRESTIGE_PERKS[nextLevel].desc}</div>` : ''}
        </div>
        ${prestigeLevel > 0 ? `<div style="font-size:0.75rem;color:var(--taro);margin-bottom:0.75rem;">Current prestige: ${prestigeLevel} (+${prestigeLevel * 5}% bonus)</div>` : ''}
        <div style="display:flex;gap:0.5rem;justify-content:center;">
          <button class="btn" onclick="doPrestige()" style="background:linear-gradient(135deg, var(--gold), #DAA520);">Prestige!</button>
          <button class="btn btn-secondary btn-small" onclick="renderShop()">Not yet</button>
        </div>
      </div>
    `;
    modal.innerHTML = html;
  }

  function doPrestige() {
    prestigeLevel++;
    // Reset progression but keep achievements, stats, best score
    // Prestige bridge: 500 starter coins + 3 days of 2x earnings
    wallet = 500;
    prestigeBridgeDays = 3;
    currentDay = 1;
    upgradeLevels = {};
    // Clear VIP tutorial so it re-shows
    tutorialsSeen.vip = false;
    saveGame();
    playSound('newBest');
    spawnConfetti();
    // Achievement for first prestige
    if (prestigeLevel === 1 && !unlockedAchievements.has('tt_prestige')) {
      unlockAchievement('tt_prestige');
    }
    // Show confirmation then go to shop
    setTimeout(() => {
      renderShop();
    }, 1500);
  }

  // ==========================================
  // SCORE SUBMISSION (delegated to game-cloud.js)
  // ==========================================
  async function submitScore(dayRev) {
    if (dayRev > bestScore) {
      bestScore = dayRev;
      saveGame();
    }

    const scoreGameId = activeStoreId === 'boba_shop' ? 'tiny-tycoon' : `tiny-tycoon-${activeStoreId.replace(/_/g, '-')}`;
    await window.gameCloud.submitScore(scoreGameId, {
      score: dayRev,
      level: currentDay,
      timeMs: Date.now() - dayStartTime,
      metadata: {
        day: currentDay,
        customersServed,
        customersLost,
        peakCombo,
        upgradeLevels: { ...upgradeLevels }
      }
    });
  }

  // ==========================================
  // ACHIEVEMENTS
  // ==========================================
  function checkAchievements(stats) {
    const checks = {
      'tt_first_day':     () => stats.dayNumber >= 1,
      'tt_hundred_club':  () => stats.dayRevenue >= 100,
      'tt_five_hundred':  () => stats.dayRevenue >= 500,
      'tt_thousand':      () => stats.dayRevenue >= 1000,
      'tt_perfect_day':   () => stats.customersLost === 0 && stats.customersServed >= 10,
      'tt_combo_5':       () => stats.peakComboStreak >= 5,
      'tt_combo_15':      () => stats.peakComboStreak >= 15,
      'tt_speed_demon':   () => stats.customersServed >= 30,
      'tt_upgrade_first': () => stats.upgraded,
      'tt_max_upgrade':   () => stats.upgraded && stats.upgradeLevel >= stats.maxLevel,
      'tt_day_10':        () => stats.dayNumber && currentDay >= 10,
      'tt_rush_survivor': () => stats.rushSurvivor
    };

    for (const [id, condition] of Object.entries(checks)) {
      if (!unlockedAchievements.has(id) && condition()) {
        unlockAchievement(id);
      }
    }
  }

  function unlockAchievement(id) {
    unlockedAchievements.add(id);
    saveGame();
    showAchievementToast(id);

    window.gameCloud.unlockAchievement(id, 'tiny-tycoon');
  }

  const achievementQueue = [];
  let achievementShowing = false;

  function showAchievementToast(id) {
    const ach = ACHIEVEMENTS[id];
    if (!ach) return;
    achievementQueue.push(ach);
    if (!achievementShowing) processAchievementQueue();
  }

  function processAchievementQueue() {
    if (achievementQueue.length === 0) { achievementShowing = false; return; }
    achievementShowing = true;
    const ach = achievementQueue.shift();
    const toast = document.getElementById('achievementToast');
    toast.innerHTML = `🏆 ${ach.name}<br><span style="font-size:0.7rem;font-weight:400;">${ach.desc}</span>`;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => processAchievementQueue(), 400);
    }, 3000);
  }

  // ==========================================
  // UI / OVERLAYS
  // ==========================================
  function hideAllOverlays() {
    document.querySelectorAll('.overlay').forEach(o => o.classList.remove('visible'));
  }

  function showOverlay(id) {
    document.getElementById(id).classList.add('visible');
  }

  // ==========================================
  // MANAGERS & OFFLINE EARNINGS
  // ==========================================
  function getManagers() {
    try {
      const empire = JSON.parse(localStorage.getItem('tt_empire') || '{}');
      return (empire.global || {}).managers || {};
    } catch(e) { return {}; }
  }

  function hireManager(storeId, tierKey) {
    const tier = MANAGER_TIERS[tierKey];
    if (!tier || wallet < tier.cost || prestigeLevel < tier.minPrestige) return;
    const unlockedStores = getUnlockedStores();
    if (!unlockedStores.includes(storeId)) return;

    wallet -= tier.cost;

    try {
      const empire = JSON.parse(localStorage.getItem('tt_empire') || '{}');
      if (!empire.global) empire.global = {};
      if (!empire.global.managers) empire.global.managers = {};
      empire.global.managers[storeId] = { tier: tierKey };
      localStorage.setItem('tt_empire', JSON.stringify(empire));
    } catch(e) {}

    saveGame();
    playSound('upgrade');
    showHub();
  }

  function calculateOfflineEarnings() {
    const unlockedStores = getUnlockedStores();
    if (unlockedStores.length < 2) return null; // Offline only with 2+ stores

    try {
      const empire = JSON.parse(localStorage.getItem('tt_empire') || '{}');
      const managers = (empire.global || {}).managers || {};
      const lastPlayed = (empire.global || {}).lastPlayedTimestamp;
      if (!lastPlayed) return null;

      const hoursOffline = Math.min(24, (Date.now() - lastPlayed) / 3600000);
      if (hoursOffline < 0.1) return null; // Less than 6 minutes, skip

      const earnings = [];
      let totalEarned = 0;

      for (const [storeId, mgr] of Object.entries(managers)) {
        const storeData = (empire.stores || {})[storeId];
        if (!storeData || !storeData.unlocked) continue;

        const tier = MANAGER_TIERS[mgr.tier];
        if (!tier) continue;

        // Estimate daily revenue based on store's day and upgrade level
        const upgradeCount = Object.values(storeData.upgradeLevels || {}).reduce((a, b) => a + b, 0);
        const dayFactor = Math.min(storeData.currentDay || 1, 30);
        const estimatedDailyRev = 100 + dayFactor * 50 + upgradeCount * 30;
        const offlineRev = Math.floor(estimatedDailyRev * tier.efficiency * hoursOffline / 24);
        const daysAdvanced = Math.floor(hoursOffline);

        if (offlineRev > 0) {
          earnings.push({ storeId, storeName: STORE_CONFIGS[storeId]?.name || storeId, managerTier: mgr.tier, revenue: offlineRev, daysAdvanced });
          totalEarned += offlineRev;

          // Advance store day counter
          storeData.currentDay = (storeData.currentDay || 1) + daysAdvanced;
        }
      }

      if (totalEarned === 0) return null;

      // Apply streak bonus
      const streakBonus = Math.min(loginStreak.count, 7) * 0.05; // Up to +35%
      const streakEarnings = Math.floor(totalEarned * streakBonus);

      // Save updated store days
      localStorage.setItem('tt_empire', JSON.stringify(empire));

      return { earnings, totalEarned, streakBonus: streakEarnings, hoursOffline: Math.round(hoursOffline), grandTotal: totalEarned + streakEarnings };
    } catch(e) { return null; }
  }

  function showWelcomeBack(offlineData) {
    if (!offlineData) return false;

    const modal = document.getElementById('hubModal');
    let earningsHtml = '';
    for (const e of offlineData.earnings) {
      const config = STORE_CONFIGS[e.storeId];
      earningsHtml += `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:0.4rem 0;border-bottom:1px solid rgba(0,0,0,0.06);">
          <div>
            <span style="font-size:1.2rem;">${config?.emoji || '🏪'}</span>
            <span style="font-size:0.8rem;font-weight:600;color:var(--brown);">${e.storeName}</span>
            <span style="font-size:0.6rem;color:#999;"> +${e.daysAdvanced} days</span>
          </div>
          <span style="font-size:0.85rem;font-weight:700;color:var(--matcha);">💰 ${formatCoins(e.revenue)}</span>
        </div>
      `;
    }

    modal.innerHTML = `
      <div style="text-align:center;">
        <div style="font-size:2rem;margin-bottom:0.3rem;">☀️</div>
        <h2 style="margin-bottom:0.3rem;">Welcome Back!</h2>
        <div style="font-size:0.75rem;color:#999;margin-bottom:0.75rem;">You were away for ${offlineData.hoursOffline} hours</div>
      </div>
      <div style="margin-bottom:0.75rem;">
        ${earningsHtml}
      </div>
      <div style="background:rgba(0,0,0,0.03);border-radius:8px;padding:0.5rem;margin-bottom:0.75rem;font-size:0.8rem;">
        <div style="display:flex;justify-content:space-between;"><span>Offline Earnings</span><span>💰 ${formatCoins(offlineData.totalEarned)}</span></div>
        ${offlineData.streakBonus > 0 ? `<div style="display:flex;justify-content:space-between;color:var(--coral);"><span>🔥 Streak Bonus (+${Math.round(loginStreak.count * 5)}%)</span><span>💰 ${formatCoins(offlineData.streakBonus)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;font-weight:700;border-top:1px solid rgba(0,0,0,0.1);padding-top:0.3rem;margin-top:0.3rem;"><span>Total</span><span>💰 ${formatCoins(offlineData.grandTotal)}</span></div>
      </div>
      <button class="btn" onclick="collectOfflineEarnings(${offlineData.grandTotal})" style="width:100%;min-height:48px;">Collect & Play</button>
    `;

    hideAllOverlays();
    showOverlay('hubOverlay');
    return true;
  }

  function collectOfflineEarnings(amount) {
    wallet += amount;
    playSound('coin');
    saveGame();
    showHub();
  }

  // ==========================================
  // STORE HUB
  // ==========================================
  function getUnlockedStores() {
    const stores = [];
    try {
      const empire = JSON.parse(localStorage.getItem('tt_empire') || '{}');
      for (const [id, store] of Object.entries(empire.stores || {})) {
        if (store.unlocked) stores.push(id);
      }
    } catch(e) {}
    if (stores.length === 0) stores.push('boba_shop');
    return stores;
  }

  function canUnlockStore(storeId) {
    const config = STORE_CONFIGS[storeId];
    if (!config) return false;
    return prestigeLevel >= config.unlockPrestige && wallet >= config.unlockCost;
  }

  function unlockStore(storeId) {
    const config = STORE_CONFIGS[storeId];
    if (!config || !canUnlockStore(storeId)) return;
    wallet -= config.unlockCost;

    // Create store entry in empire
    try {
      const empire = JSON.parse(localStorage.getItem('tt_empire') || '{}');
      if (!empire.stores) empire.stores = {};
      empire.stores[storeId] = { unlocked: true, currentDay: 1, upgradeLevels: {}, bestDayRevenue: 0 };
      localStorage.setItem('tt_empire', JSON.stringify(empire));
    } catch(e) {}

    saveGame();
    playSound('upgrade');
    spawnConfetti();
    showHub();
  }

  function showHub() {
    gameState = 'HUB';
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    hideAllOverlays();
    hudEl.style.display = 'none';

    checkDailyLogin();

    const unlockedStores = getUnlockedStores();
    const modal = document.getElementById('hubModal');

    let storeCardsHtml = '';
    const allStoreIds = Object.keys(STORE_CONFIGS);

    for (const id of allStoreIds) {
      const config = STORE_CONFIGS[id];
      const isUnlocked = unlockedStores.includes(id);
      const isActive = id === activeStoreId;

      if (isUnlocked) {
        let empire = {};
        try { empire = JSON.parse(localStorage.getItem('tt_empire') || '{}'); } catch(e) {}
        const storeData = (empire.stores || {})[id] || {};
        const day = storeData.currentDay || 1;
        const mgr = (empire.global || {}).managers && (empire.global.managers[id]);
        const mgrBadge = mgr ? `<span style="font-size:0.65rem;">👨‍💼 ${mgr.tier || 'Trainee'}</span>` : '';

        storeCardsHtml += `
          <div class="hub-store-card${isActive ? ' active' : ''}" onclick="switchStore('${id}'); showShop();" style="cursor:pointer;background:linear-gradient(135deg, ${config.theme['--cream']}, ${config.theme['--wall-bottom']});border:2px solid ${isActive ? config.theme['--gold'] : 'rgba(0,0,0,0.1)'};border-radius:12px;padding:0.75rem;text-align:center;min-width:120px;">
            <div style="font-size:2rem;">${config.emoji}</div>
            <div style="font-size:0.8rem;font-weight:700;color:${config.theme['--brown']};">${config.name}</div>
            <div style="font-size:0.65rem;color:${config.theme['--taupe']};">Day ${day}</div>
            ${mgrBadge}
          </div>
        `;
      } else {
        // Show locked store as teaser (only show next unlockable)
        const canUnlock = canUnlockStore(id);
        const requiresText = config.unlockPrestige > prestigeLevel
          ? `P${config.unlockPrestige} required`
          : `💰 ${formatCoins(config.unlockCost)}`;

        storeCardsHtml += `
          <div class="hub-store-card locked" style="background:rgba(0,0,0,0.04);border:2px dashed rgba(0,0,0,0.15);border-radius:12px;padding:0.75rem;text-align:center;min-width:120px;opacity:${canUnlock ? 1 : 0.5};">
            <div style="font-size:2rem;filter:grayscale(0.6);">${config.emoji}</div>
            <div style="font-size:0.8rem;font-weight:700;color:#999;">${config.name}</div>
            <div style="font-size:0.6rem;color:#aaa;">${requiresText}</div>
            ${canUnlock ? `<button class="btn btn-small" style="margin-top:6px;font-size:0.7rem;min-height:32px;" onclick="event.stopPropagation(); unlockStore('${id}');">Unlock</button>` : `<div style="font-size:0.8rem;margin-top:4px;">🔒</div>`}
          </div>
        `;
      }
    }

    modal.innerHTML = `
      <h2 style="text-align:center;margin-bottom:0.3rem;">👑 Tiny Tycoon Empire</h2>
      <div style="text-align:center;font-size:0.8rem;color:var(--brown);margin-bottom:0.5rem;">
        💰 ${formatCoins(wallet)} coins
        ${prestigeLevel > 0 ? `<span style="color:var(--gold);"> ✨ P${prestigeLevel}</span>` : ''}
        ${loginStreak.count > 1 ? `<span style="color:var(--coral);"> 🔥 ${loginStreak.count}-day streak</span>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:0.5rem;margin-bottom:1rem;">
        ${storeCardsHtml}
      </div>
      <div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;">
        <button class="btn btn-small" onclick="switchStore('${activeStoreId}'); showShop();">▶ Play ${STORE_CONFIGS[activeStoreId].name}</button>
        <button class="btn btn-secondary btn-small" onclick="showStats()">📊 Stats</button>
        <button class="btn btn-secondary btn-small" onclick="showAchievements()">🏆</button>
      </div>
    `;

    showOverlay('hubOverlay');
  }

  function showTitle() {
    gameState = 'TITLE';
    // M. Cancel game loop
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    hideAllOverlays();
    hudEl.style.display = 'none';
    rushBanner.classList.remove('visible');

    // Clear customers
    customers.forEach(c => { if (c.el) c.el.remove(); });
    customers = [];

    // Update shop environment visuals
    updateShopEnvironment();

    // Check daily login streak
    checkDailyLogin();

    const bestEl = document.getElementById('titleBest');
    bestEl.innerHTML = (bestScore > 0 ? `Best Day: 💰 ${formatCoins(bestScore)}` : '') +
      (loginStreak.count > 1 ? `<div style="margin-top:4px;font-size:0.75rem;color:var(--gold);">🔥 ${loginStreak.count}-day streak</div>` : '');

    const btns = document.getElementById('titleButtons');
    const hasSave = currentDay > 1;

    const statsBtn = hasSave ? `<button class="btn btn-secondary btn-small" style="margin-top:8px;" onclick="showStats()">📊 Stats</button>` : '';
    const achBtn = `<button class="btn btn-secondary btn-small" style="margin-top:8px;" onclick="showAchievements()">🏆 Achievements</button>`;
    const relaxedToggle = `<label style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:12px;font-size:0.85rem;color:var(--brown);cursor:pointer;">
      <input type="checkbox" id="relaxedToggle" ${relaxedMode ? 'checked' : ''} onchange="toggleRelaxedMode(this.checked)" style="width:18px;height:18px;cursor:pointer;">
      Relaxed Mode <span style="font-size:0.75rem;opacity:0.7;">(more patience, slower spawns)</span>
    </label>`;
    const unlockedStores = getUnlockedStores();
    const hasMultipleStores = unlockedStores.length >= 2;
    const hubBtn = hasMultipleStores ? `<button class="btn btn-secondary btn-small" style="margin-top:8px;" onclick="showHub()">🏢 Empire Hub</button>` : '';

    btns.innerHTML = hasSave
      ? `<button class="btn" onclick="${hasMultipleStores ? 'showHub()' : 'showShop()'}">Continue (Day ${currentDay})</button><br>
         <button class="btn btn-secondary btn-small" style="margin-top:8px;" onclick="newGame()">New Game</button>
         ${statsBtn}
         ${achBtn}
         ${hubBtn}
         ${relaxedToggle}`
      : `<button class="btn" onclick="startDay()">Start Day</button>
         ${achBtn}
         ${relaxedToggle}`;

    showOverlay('titleOverlay');
    dayBadge.textContent = `Day ${currentDay}`;
  }

  function showStats() {
    const s = cumulativeStats;
    const achievCount = unlockedAchievements.size;
    const totalAch = Object.keys(ACHIEVEMENTS).length;
    const bestMult = Math.min(3.0, 1.0 + s.bestCombo * 0.1).toFixed(1);
    const modal = document.getElementById('statsModal');
    modal.innerHTML = `
      <h2>📊 Career Stats</h2>
      <div class="modal-row"><span>Days Played</span><span>☀️ ${s.daysPlayed}</span></div>
      <div class="modal-row"><span>Total Served</span><span>🧋 ${s.totalServed.toLocaleString()}</span></div>
      <div class="modal-row"><span>Total Lost</span><span>😤 ${s.totalLost.toLocaleString()}</span></div>
      <div class="modal-row"><span>Serve Rate</span><span>${s.totalServed + s.totalLost > 0 ? Math.round(s.totalServed / (s.totalServed + s.totalLost) * 100) : 0}%</span></div>
      <div class="modal-row"><span>Total Coins Earned</span><span>💰 ${s.totalCoinsEarned.toLocaleString()}</span></div>
      <div class="modal-row"><span>Best Day Revenue</span><span>⭐ ${formatCoins(bestScore)}</span></div>
      <div class="modal-row"><span>Best Combo</span><span>🔥 x${bestMult} (${s.bestCombo} streak)</span></div>
      <div class="modal-row"><span>Achievements</span><span>🏆 ${achievCount}/${totalAch}</span></div>
      ${prestigeLevel > 0 ? `<div class="modal-row"><span>Prestige Level</span><span>✨ ${prestigeLevel} (+${prestigeLevel * 5}% coins)</span></div>` : ''}
      <div class="modal-row"><span>Login Streak</span><span>🔥 ${loginStreak.count} day${loginStreak.count !== 1 ? 's' : ''}</span></div>
      <div class="modal-row"><span>Longest Streak</span><span>🏅 ${loginStreak.longestStreak} day${loginStreak.longestStreak !== 1 ? 's' : ''}</span></div>
      <br>
      <button class="btn" onclick="hideAllOverlays(); showOverlay('titleOverlay');">Back</button>
    `;
    hideAllOverlays();
    showOverlay('statsOverlay');
  }

  function showAchievements() {
    const total = Object.keys(ACHIEVEMENTS).length;
    const earned = unlockedAchievements.size;
    const totalXp = [...unlockedAchievements].reduce((sum, id) => sum + (ACHIEVEMENTS[id]?.xp || 0), 0);
    const modal = document.getElementById('achievementsModal');

    let cardsHtml = '';
    for (const [id, ach] of Object.entries(ACHIEVEMENTS)) {
      const unlocked = unlockedAchievements.has(id);
      cardsHtml += `
        <div class="ach-card ${unlocked ? 'unlocked' : 'locked'}">
          <div class="ach-icon">${unlocked ? '🏆' : '🔒'}</div>
          <div class="ach-name">${ach.name}</div>
          <div class="ach-desc">${ach.desc}</div>
          <div class="ach-xp">${unlocked ? `+${ach.xp} XP` : `${ach.xp} XP`}</div>
        </div>
      `;
    }

    modal.innerHTML = `
      <h2>🏆 Achievements</h2>
      <div class="ach-summary"><span>${earned}/${total}</span> unlocked &middot; <span>${totalXp} XP</span> earned</div>
      <div class="ach-grid">${cardsHtml}</div>
      <br>
      <button class="btn" onclick="hideAllOverlays(); showOverlay('titleOverlay');">Back</button>
    `;
    hideAllOverlays();
    showOverlay('achievementsOverlay');
  }

  function newGame() {
    if (!confirm('Reset all progress?')) return;
    cumulativeStats = { totalServed: 0, totalLost: 0, totalCoinsEarned: 0, bestCombo: 0, daysPlayed: 0 };
    resetGame();
    showTitle();
  }

  function pauseGame() {
    if (gameState !== 'PLAYING') return;
    gameState = 'PAUSED';
    stopBgm();
    showOverlay('pauseOverlay');
  }

  function resumeGame() {
    if (gameState !== 'PAUSED') return;
    gameState = 'PLAYING';
    lastFrameTime = 0;
    hideAllOverlays();
    startBgm();
    // M. Restart game loop
    if (!animFrameId) {
      animFrameId = requestAnimationFrame(gameLoop);
    }
  }

  function quitToMenu() {
    gameState = 'TITLE';
    // M. Cancel game loop
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    stopBgm();
    hideAllOverlays();
    customers.forEach(c => { if (c.el) c.el.remove(); });
    customers = [];
    showTitle();
  }

  // ==========================================
  // SOUND TOGGLE (wired via game-header onSound)
  // ==========================================
  function toggleSound() {
    initAudio();
    isMuted = !isMuted;
    saveGame();
    updateSoundBtn();
    if (isMuted) {
      stopBgm();
    } else if (gameState === 'PLAYING') {
      startBgm();
    }
  }

  function updateSoundBtn() {
    if (window._ghHeader) window._ghHeader.setSoundMuted(isMuted);
  }

  window.toggleRelaxedMode = function(on) {
    relaxedMode = on;
    saveGame();
  };

  // ==========================================
  // VISIBILITY CHANGE (auto-pause)
  // ==========================================
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && gameState === 'PLAYING') {
      pauseGame();
    }
  });

  // Keyboard support
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (gameState === 'PLAYING') pauseGame();
      else if (gameState === 'PAUSED') resumeGame();
    }
    // Space or Enter: serve front-of-queue customer (keyboard gameplay)
    if (gameState === 'PLAYING' && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      const queued = customers.filter(c => !c.isVip && c.state === 'queued').sort((a, b) => a.x - b.x);
      if (queued.length > 0) {
        handleCustomerTap(queued[0].id);
      }
    }
  });

  // First interaction init audio
  document.addEventListener('click', () => initAudio(), { once: true });
  document.addEventListener('touchstart', () => initAudio(), { once: true });

  // ==========================================
  // B. SPARKLE PARTICLES (Serve Celebration)
  // ==========================================
  function spawnSparkleParticles(c, area) {
    const count = 3 + Math.floor(Math.random() * 3); // 3-5
    for (let i = 0; i < count; i++) {
      const spark = document.createElement('div');
      spark.className = 'sparkle-particle';
      spark.style.left = (c.x + 24) + 'px';
      spark.style.top = (c.y + 20) + 'px';
      const angle = Math.random() * Math.PI * 2;
      const dist = 8 + Math.random() * 12;
      spark.style.setProperty('--sx', Math.cos(angle) * dist + 'px');
      spark.style.setProperty('--sy', Math.sin(angle) * dist + 'px');
      spark.style.animationDelay = (i * 0.05) + 's';
      area.appendChild(spark);
      setTimeout(() => spark.remove(), 600);
    }
  }

  // ==========================================
  // C. COIN COLLECTION PARTICLES
  // ==========================================
  function spawnCoinParticles(c, area) {
    const count = 4 + Math.floor(Math.random() * 3); // 4-6
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'coin-particle';
      const size = 4 + Math.random() * 2;
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.left = (c.x + 16 + (Math.random() - 0.5) * 20) + 'px';
      p.style.top = (c.y + 5) + 'px';
      p.style.setProperty('--dx', ((Math.random() - 0.5) * 20) + 'px');
      p.style.animationDelay = (i * 0.06) + 's';
      area.appendChild(p);
      setTimeout(() => p.remove(), 700);
    }
  }

  // ==========================================
  // F. COMBO LOST FLASH
  // ==========================================
  function showComboLostFlash() {
    const flash = document.createElement('div');
    flash.className = 'combo-lost-flash';
    flash.textContent = 'COMBO LOST!';
    hudCombo.style.position = 'relative';
    hudCombo.appendChild(flash);
    setTimeout(() => flash.remove(), 1000);
  }

  // ==========================================
  // H. TIP INDICATOR
  // ==========================================
  function spawnTipIndicator(c, area) {
    const el = document.createElement('div');
    el.className = 'tip-float';
    el.textContent = '+TIP!';
    el.style.left = (c.x + 30) + 'px';
    el.style.top = (c.y - 15) + 'px';
    area.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  // ==========================================
  // E. TUTORIAL ON DAY 1
  // ==========================================
  function showTutorial() {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const overlay = document.createElement('div');
    overlay.className = 'tutorial-overlay';
    overlay.innerHTML = `
      <div class="tutorial-finger">&#128070;</div>
      <div class="tutorial-text">Tap customers at the counter to serve them!</div>
      ${!isTouch ? '<div class="tutorial-text" style="font-size:0.75rem;margin-top:6px;opacity:0.8;">or press SPACEBAR</div>' : ''}
    `;
    document.body.appendChild(overlay);
    tutorialsSeen.main = true;
    saveGame();

    function dismiss() {
      if (overlay.parentNode) overlay.remove();
    }
    overlay.addEventListener('click', dismiss);
    overlay.addEventListener('touchstart', dismiss, { passive: true });
    setTimeout(dismiss, 3000);
  }

  function showVipTutorial() {
    const overlay = document.createElement('div');
    overlay.className = 'tutorial-overlay';
    overlay.innerHTML = `
      <div style="font-size:2rem;">👑</div>
      <div class="tutorial-text">VIP customer! They sit in the lounge and your waiter serves them automatically for 2x coins!</div>
    `;
    document.body.appendChild(overlay);
    function dismiss() { if (overlay.parentNode) overlay.remove(); }
    overlay.addEventListener('click', dismiss);
    overlay.addEventListener('touchstart', dismiss, { passive: true });
    setTimeout(dismiss, 4000);
  }

  // ==========================================
  // J. NEW BEST CONFETTI CELEBRATION
  // ==========================================
  function spawnConfetti() {
    const colors = ['#FFD700', '#FF69B4', '#4CAF50', '#2196F3', '#9C27B0'];
    const count = 20 + Math.floor(Math.random() * 11); // 20-30

    // Golden flash
    const flash = document.createElement('div');
    flash.className = 'golden-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 350);

    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      const startX = Math.random() * 100;
      piece.style.left = startX + '%';
      piece.style.top = '0px';
      const fallDist = 300 + Math.random() * 200;
      const drift = (Math.random() - 0.5) * 100;
      const rot = (360 + Math.random() * 720) + 'deg';
      piece.style.setProperty('--cx', '0px');
      piece.style.setProperty('--cdx', drift + 'px');
      piece.style.setProperty('--cfall', fallDist + 'px');
      piece.style.setProperty('--crot', rot);
      piece.style.animationDelay = (Math.random() * 0.3) + 's';
      gameWrap.appendChild(piece);
      setTimeout(() => piece.remove(), 2500);
    }
  }

  function showPersonalBestBanner(score) {
    const banner = document.createElement('div');
    banner.className = 'personal-best-banner';
    banner.innerHTML = `
      <div class="pb-label">⭐ NEW PERSONAL BEST! ⭐</div>
      <div class="pb-score">💰 ${formatCoins(score)}</div>
    `;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 2600);
  }

  // ==========================================
  // INIT
  // ==========================================
  loadGame();
  // gameHeader.init is called after external scripts load (see bottom of file)
  window._ttInitHeader = function() {
    window._ghHeader = window.gameHeader.init({
      title: 'Tiny Tycoon',
      icon: '🧋',
      gameId: 'tiny-tycoon',
      buttons: ['sound', 'leaderboard', 'auth'],
      onSound: () => toggleSound(),
      onSignIn: (user) => { currentUser = user; },
      onSignOut: () => { currentUser = null; }
    });
    updateSoundBtn();
  };
  updateShopEnvironment();

  // Check for offline earnings before showing title
  checkDailyLogin();
  const offlineData = calculateOfflineEarnings();
  if (offlineData && !showWelcomeBack(offlineData)) {
    showTitle();
  } else if (!offlineData) {
    showTitle();
  }
  // M. Don't start game loop at init - only when entering PLAYING state

  // Expose only functions needed by inline onclick handlers.
  // All other functions are private to the IIFE scope.
  // Note: Client-side games cannot prevent console manipulation —
  // server-side score validation is the real anti-cheat layer.
  const _api = { showShop, renderShop, buyUpgrade, startDay, showTitle, newGame, showStats, showAchievements, shareScore, showPrestigeConfirm, doPrestige, hideAllOverlays, showOverlay, resumeGame, quitToMenu, showHub, switchStore, unlockStore, hireManager, collectOfflineEarnings };
  Object.entries(_api).forEach(([k, v]) => { window[k] = v; });

  // Pause button handler
  document.getElementById('pauseBtn').addEventListener('click', () => {
    if (gameState === 'PLAYING') pauseGame();
  });
  document.getElementById('resumeBtn').addEventListener('click', () => resumeGame());
  document.getElementById('quitBtn').addEventListener('click', () => quitToMenu());

  // Keyboard: spacebar serves front customer
  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' && gameState === 'PLAYING') {
      e.preventDefault();
      const front = customers.filter(c => !c.isVip && c.state === 'queued').sort((a, b) => a.x - b.x)[0];
      if (front && !manualServing) {
        startServing(front, 'manual');
        triggerBaristaServe();
        playSound('tap');
      }
    }
  });

  })();
