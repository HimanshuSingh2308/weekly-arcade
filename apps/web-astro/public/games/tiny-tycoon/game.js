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
    tt_prestige:      { name: 'New Beginnings',   desc: 'Prestige for the first time',       xp: 150 },
    tt_second_store:  { name: 'Franchise Owner',  desc: 'Open your second store',            xp: 100 },
    tt_three_stores:  { name: 'Chain Operator',   desc: 'Open 3 stores',                     xp: 200 },
    tt_five_stores:   { name: 'Empire Builder',   desc: 'Open all 5 stores',                 xp: 500 },
    tt_first_manager: { name: 'Delegation',       desc: 'Hire your first manager',           xp: 75  },
    tt_all_managers:  { name: 'Full Staff',       desc: 'All stores have managers',          xp: 300 },
    tt_50k_coins:     { name: 'Money Bags',       desc: 'Earn 50K lifetime coins',           xp: 150 },
    tt_250k_coins:    { name: 'Quarter Million',  desc: 'Earn 250K lifetime coins',          xp: 250 },
    tt_1m_coins:      { name: 'Millionaire',      desc: 'Earn 1M lifetime coins',            xp: 500 },
    tt_hq_upgrade:    { name: 'Corporate HQ',     desc: 'Purchase first HQ upgrade',         xp: 100 },
    tt_streak_7:      { name: 'Weekly Regular',   desc: '7-day login streak',                xp: 100 },
    tt_streak_30:     { name: 'Dedicated Owner',  desc: '30-day login streak',               xp: 300 },
    tt_critic_served: { name: 'Rave Review',      desc: 'Serve food critic perfectly',       xp: 75  },
    tt_prestige_3:    { name: 'Master Barista',   desc: 'Reach Prestige 3',                  xp: 200 },
    tt_prestige_5:    { name: 'Grand Master',     desc: 'Reach Prestige 5',                  xp: 400 },
    tt_day_25:        { name: 'Quarter Century',  desc: 'Reach Day 25 in any store',         xp: 75  },
    tt_day_50:        { name: 'Half Century',     desc: 'Reach Day 50 in any store',         xp: 150 },
    tt_day_75:        { name: 'Diamond Barista',  desc: 'Reach Day 75 in any store',         xp: 200 },
    tt_day_100:       { name: 'Centurion',        desc: 'Reach Day 100 in any store',        xp: 300 }
  };

  const PRESTIGE_PERKS = {
    1: { id: 'tier2_unlock', name: 'Tier 2 Access',  desc: 'Unlock Tier 2 upgrades', icon: '🔓' },
    2: { id: 'auto_combo',   name: 'Auto Combo',     desc: 'Start each day at 2x combo',           icon: '🔥' },
    3: { id: 'vip_magnet',   name: 'VIP Magnet',     desc: '+15% VIP spawn chance',                icon: '🧲' },
    4: { id: 'rush_master',  name: 'Rush Master',    desc: 'Rush Hour = 2x coins',                 icon: '⚡' },
    5: { id: 'golden_start', name: 'Golden Start',   desc: 'Start each day with 50 bonus coins',   icon: '💎' },
  };

  const MILESTONES = [
    { day: 25,  bonus: 500,   achievement: 'tt_day_25'  },
    { day: 50,  bonus: 1500,  achievement: 'tt_day_50'  },
    { day: 75,  bonus: 3000,  achievement: 'tt_day_75'  },
    { day: 100, bonus: 5000,  achievement: 'tt_day_100' },
  ];

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
    { minDay: 2,  patience: 11000 },
    { minDay: 3,  patience: 10000 },
    { minDay: 4,  patience: 9000 },
    { minDay: 5,  patience: 8500 },
    { minDay: 7,  patience: 7500 },
    { minDay: 10, patience: 6500 },
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
  // STORE CONFIGS & EMPIRE SYSTEMS
  // ==========================================
  const BOBA_DRINKS = { ...DRINK_TYPES };
  const BOBA_CUSTOMERS = Object.fromEntries(Object.entries(CUSTOMER_TYPES).map(([k, v]) => [k, { ...v }]));
  const BOBA_UPGRADES = Object.fromEntries(Object.entries(UPGRADES).map(([k, v]) => [k, { ...v }]));
  const BOBA_SPAWN = [...SPAWN_TABLE];
  const BOBA_PATIENCE = [...PATIENCE_TABLE];

  const STORE_CONFIGS = {
    boba_shop: {
      id: 'boba_shop', name: 'Boba Bliss', emoji: '🧋', unlockCost: 0, unlockPrestige: 0,
      theme: { '--cream': '#FFF8F0', '--taupe': '#C4A882', '--brown': '#5C3D2E', '--matcha': '#7FB069', '--coral': '#E8836B', '--gold': '#F5C542', '--taro': '#9B7CB8', '--wall-top': '#FFF5EB', '--wall-bottom': '#F5E6D0', '--floor': '#D4A87C' },
      getDrinks: () => BOBA_DRINKS, getCustomers: () => BOBA_CUSTOMERS, getUpgrades: () => BOBA_UPGRADES, getSpawnTable: () => BOBA_SPAWN, getPatienceTable: () => BOBA_PATIENCE,
    },
    bean_brew: {
      id: 'bean_brew', name: 'Bean & Brew', emoji: '☕', unlockCost: 5000, unlockPrestige: 1,
      theme: { '--cream': '#F5F0E8', '--taupe': '#8B6F47', '--brown': '#3E2723', '--matcha': '#B87333', '--coral': '#D84315', '--gold': '#FFB300', '--taro': '#6D4C41', '--wall-top': '#E8DCC8', '--wall-bottom': '#D4C4A8', '--floor': '#A0845C' },
      getDrinks: () => ({ drip_coffee: { emoji: '☕', name: 'Drip Coffee', baseCoins: 8, serveTime: 700, unlockDay: 1 }, cappuccino: { emoji: '🫘', name: 'Cappuccino', baseCoins: 15, serveTime: 1100, unlockDay: 1 }, espresso: { emoji: '⚡', name: 'Espresso Shot', baseCoins: 12, serveTime: 500, unlockDay: 3 }, caramel_latte: { emoji: '🍯', name: 'Caramel Latte', baseCoins: 22, serveTime: 1400, unlockDay: 5 }, mocha_frappe: { emoji: '🍫', name: 'Mocha Frappe', baseCoins: 35, serveTime: 1800, unlockDay: 8 }, pour_over: { emoji: '🏆', name: 'Pour-Over Special', baseCoins: 50, serveTime: 2200, unlockDay: 12 }, affogato: { emoji: '🍨', name: 'Affogato', baseCoins: 65, serveTime: 2800, unlockDay: 18 } }),
      getCustomers: () => ({ regular: { color: '#A1887F', patienceMod: 1.0, orderPool: ['drip_coffee', 'cappuccino'], earlyWeight: 50, lateWeight: 20 }, student: { color: '#FFB347', patienceMod: 1.2, orderPool: ['drip_coffee', 'espresso'], earlyWeight: 30, lateWeight: 15 }, business: { color: '#546E7A', patienceMod: 0.6, orderPool: ['espresso', 'cappuccino', 'pour_over'], earlyWeight: 15, lateWeight: 30 }, foodie: { color: '#CE93D8', patienceMod: 0.9, orderPool: ['caramel_latte', 'mocha_frappe', 'affogato'], earlyWeight: 0, lateWeight: 25 }, influencer: { color: '#FF69B4', patienceMod: 0.5, orderPool: ['affogato', 'pour_over'], earlyWeight: 0, lateWeight: 10 }, vip: { color: '#FFD700', patienceMod: 1.0, orderPool: 'ALL', earlyWeight: 0, lateWeight: 0 } }),
      getUpgrades: () => BOBA_UPGRADES, getSpawnTable: () => BOBA_SPAWN, getPatienceTable: () => BOBA_PATIENCE,
    },
    juice_junction: {
      id: 'juice_junction', name: 'Juice Junction', emoji: '🍊', unlockCost: 15000, unlockPrestige: 2,
      theme: { '--cream': '#E0F7FA', '--taupe': '#00897B', '--brown': '#004D40', '--matcha': '#FF8C42', '--coral': '#FF5722', '--gold': '#FFC107', '--taro': '#26A69A', '--wall-top': '#B2DFDB', '--wall-bottom': '#80CBC4', '--floor': '#FFE0B2' },
      getDrinks: () => ({ orange_juice: { emoji: '🍊', name: 'Orange Juice', baseCoins: 10, serveTime: 800, unlockDay: 1 }, berry_blast: { emoji: '🫐', name: 'Berry Blast', baseCoins: 18, serveTime: 1200, unlockDay: 1 }, green_smooth: { emoji: '🥬', name: 'Green Smoothie', baseCoins: 15, serveTime: 1000, unlockDay: 3 }, acai_bowl: { emoji: '🟣', name: 'Açaí Bowl', baseCoins: 30, serveTime: 1600, unlockDay: 6 }, tropical: { emoji: '🥭', name: 'Tropical Fusion', baseCoins: 45, serveTime: 2000, unlockDay: 10 }, dragon_fruit: { emoji: '🐉', name: 'Dragon Fruit Elixir', baseCoins: 60, serveTime: 2500, unlockDay: 15 }, superfood: { emoji: '💎', name: 'Superfood Supreme', baseCoins: 80, serveTime: 3200, unlockDay: 20 } }),
      getCustomers: () => ({ regular: { color: '#81D4FA', patienceMod: 1.0, orderPool: ['orange_juice', 'berry_blast'], earlyWeight: 50, lateWeight: 20 }, student: { color: '#AED581', patienceMod: 1.3, orderPool: ['orange_juice', 'green_smooth'], earlyWeight: 30, lateWeight: 15 }, business: { color: '#90A4AE', patienceMod: 0.7, orderPool: ['green_smooth', 'acai_bowl'], earlyWeight: 10, lateWeight: 20 }, foodie: { color: '#F48FB1', patienceMod: 0.9, orderPool: ['acai_bowl', 'tropical', 'dragon_fruit', 'superfood'], earlyWeight: 0, lateWeight: 30 }, influencer: { color: '#FF69B4', patienceMod: 0.5, orderPool: ['dragon_fruit', 'superfood'], earlyWeight: 0, lateWeight: 10 }, vip: { color: '#FFD700', patienceMod: 1.0, orderPool: 'ALL', earlyWeight: 0, lateWeight: 0 } }),
      getUpgrades: () => BOBA_UPGRADES, getSpawnTable: () => BOBA_SPAWN, getPatienceTable: () => BOBA_PATIENCE,
    },
    sweet_tooth: {
      id: 'sweet_tooth', name: 'Sweet Tooth', emoji: '🧁', unlockCost: 40000, unlockPrestige: 3,
      theme: { '--cream': '#FFF0F5', '--taupe': '#D4A0A0', '--brown': '#8B4513', '--matcha': '#B76E79', '--coral': '#FF6B81', '--gold': '#FFB6C1', '--taro': '#C9A0DC', '--wall-top': '#FFE4EC', '--wall-bottom': '#FFD1DC', '--floor': '#98FB98' },
      getDrinks: () => ({ cookie: { emoji: '🍪', name: 'Cookie', baseCoins: 12, serveTime: 600, unlockDay: 1 }, cupcake: { emoji: '🧁', name: 'Cupcake', baseCoins: 20, serveTime: 1000, unlockDay: 1 }, croissant: { emoji: '🥐', name: 'Croissant', baseCoins: 16, serveTime: 900, unlockDay: 3 }, cake_slice: { emoji: '🍰', name: 'Slice of Cake', baseCoins: 35, serveTime: 1500, unlockDay: 6 }, cream_puff: { emoji: '🏰', name: 'Cream Puff Tower', baseCoins: 50, serveTime: 2200, unlockDay: 10 }, tiramisu: { emoji: '🇮🇹', name: 'Tiramisu', baseCoins: 70, serveTime: 2800, unlockDay: 15 }, tasting_plate: { emoji: '👨‍🍳', name: "Chef's Tasting", baseCoins: 100, serveTime: 3500, unlockDay: 20 } }),
      getCustomers: () => ({ regular: { color: '#F8BBD0', patienceMod: 1.1, orderPool: ['cookie', 'cupcake'], earlyWeight: 50, lateWeight: 20 }, student: { color: '#CE93D8', patienceMod: 1.3, orderPool: ['cookie', 'croissant'], earlyWeight: 30, lateWeight: 10 }, business: { color: '#90A4AE', patienceMod: 0.7, orderPool: ['croissant', 'cake_slice'], earlyWeight: 10, lateWeight: 20 }, foodie: { color: '#FFB74D', patienceMod: 0.8, orderPool: ['cake_slice', 'cream_puff', 'tiramisu', 'tasting_plate'], earlyWeight: 0, lateWeight: 35 }, influencer: { color: '#FF69B4', patienceMod: 0.5, orderPool: ['tiramisu', 'tasting_plate'], earlyWeight: 0, lateWeight: 10 }, vip: { color: '#FFD700', patienceMod: 1.0, orderPool: 'ALL', earlyWeight: 0, lateWeight: 0 } }),
      getUpgrades: () => BOBA_UPGRADES, getSpawnTable: () => BOBA_SPAWN, getPatienceTable: () => BOBA_PATIENCE,
    },
    golden_lounge: {
      id: 'golden_lounge', name: 'Golden Lounge', emoji: '🥂', unlockCost: 100000, unlockPrestige: 5,
      theme: { '--cream': '#1B1B3A', '--taupe': '#C9B037', '--brown': '#F5F5DC', '--matcha': '#FFD700', '--coral': '#FF4444', '--gold': '#FFD700', '--taro': '#9B59B6', '--wall-top': '#1B1B3A', '--wall-bottom': '#0D0D2B', '--floor': '#0D0D0D' },
      getDrinks: () => ({ sparkling_water: { emoji: '💧', name: 'Sparkling Water', baseCoins: 20, serveTime: 500, unlockDay: 1 }, cocktail: { emoji: '🍸', name: 'Classic Cocktail', baseCoins: 40, serveTime: 1200, unlockDay: 1 }, wine: { emoji: '🍷', name: 'Wine Glass', baseCoins: 35, serveTime: 1000, unlockDay: 3 }, signature_mix: { emoji: '🌟', name: 'Signature Mix', baseCoins: 60, serveTime: 1800, unlockDay: 6 }, champagne: { emoji: '🍾', name: 'Champagne Tower', baseCoins: 90, serveTime: 2500, unlockDay: 10 }, royal_reserve: { emoji: '👑', name: 'Royal Reserve', baseCoins: 120, serveTime: 3200, unlockDay: 15 }, diamond: { emoji: '💎', name: 'Diamond Collection', baseCoins: 200, serveTime: 4000, unlockDay: 20 } }),
      getCustomers: () => ({ regular: { color: '#B0BEC5', patienceMod: 0.9, orderPool: ['sparkling_water', 'cocktail'], earlyWeight: 40, lateWeight: 15 }, student: { color: '#7986CB', patienceMod: 1.0, orderPool: ['sparkling_water', 'wine'], earlyWeight: 20, lateWeight: 10 }, business: { color: '#455A64', patienceMod: 0.5, orderPool: ['cocktail', 'wine', 'signature_mix'], earlyWeight: 25, lateWeight: 25 }, foodie: { color: '#CE93D8', patienceMod: 0.8, orderPool: ['signature_mix', 'champagne', 'royal_reserve', 'diamond'], earlyWeight: 0, lateWeight: 30 }, influencer: { color: '#FF80AB', patienceMod: 0.4, orderPool: ['royal_reserve', 'diamond'], earlyWeight: 0, lateWeight: 15 }, vip: { color: '#FFD700', patienceMod: 1.0, orderPool: 'ALL', earlyWeight: 0, lateWeight: 0 } }),
      getUpgrades: () => BOBA_UPGRADES, getSpawnTable: () => BOBA_SPAWN, getPatienceTable: () => BOBA_PATIENCE,
    },
  };

  let activeStoreId = 'boba_shop';

  function switchStore(storeId) {
    const config = STORE_CONFIGS[storeId];
    if (!config) return;
    saveGame();
    activeStoreId = storeId;
    DRINK_TYPES = config.getDrinks();
    CUSTOMER_TYPES = config.getCustomers();
    UPGRADES = config.getUpgrades();
    SPAWN_TABLE = config.getSpawnTable();
    PATIENCE_TABLE = config.getPatienceTable();
    const raw = localStorage.getItem('tt_empire');
    if (raw) {
      try {
        const empire = JSON.parse(raw);
        const store = (empire.stores || {})[storeId];
        if (store) { currentDay = store.currentDay || 1; upgradeLevels = store.upgradeLevels || {}; }
        else { currentDay = 1; upgradeLevels = {}; }
        empire.activeStoreId = storeId;
        localStorage.setItem('tt_empire', JSON.stringify(empire)); invalidateEmpireCache();
      } catch(e) {}
    }
    const root = document.documentElement;
    for (const [prop, val] of Object.entries(config.theme)) root.style.setProperty(prop, val);
    updateShopEnvironment();
  }

  const MANAGER_TIERS = {
    trainee: { name: 'Trainee', cost: 5000, efficiency: 0.40, icon: '👤', minPrestige: 1 },
    experienced: { name: 'Experienced', cost: 20000, efficiency: 0.60, icon: '👨‍💼', minPrestige: 2 },
    expert: { name: 'Expert', cost: 50000, efficiency: 0.80, icon: '🧑‍🔬', minPrestige: 3 },
    star: { name: 'Star Manager', cost: 100000, efficiency: 0.85, icon: '⭐', minPrestige: 5 },
  };

  const HQ_UPGRADES = {
    franchise_bonus: { name: 'Franchise Bonus', icon: '🏢', desc: '+5% revenue ALL stores/lv', maxLevel: 5, costFn: (l) => 10000 + l * 8000, effect: (l) => l * 0.05 },
    supply_chain: { name: 'Supply Chain', icon: '📦', desc: '-10% serve time ALL/lv', maxLevel: 3, costFn: (l) => 15000 + l * 12000, effect: (l) => l * 0.10 },
    brand_recognition: { name: 'Brand Recognition', icon: '📢', desc: '+15% patience ALL/lv', maxLevel: 3, costFn: (l) => 12000 + l * 10000, effect: (l) => l * 0.15 },
    loyalty_network: { name: 'Loyalty Network', icon: '💳', desc: '+10% VIP rate ALL/lv', maxLevel: 3, costFn: (l) => 20000 + l * 15000, effect: (l) => l * 0.10 },
    corporate_training: { name: 'Corporate Training', icon: '🎓', desc: '+10% manager eff ALL/lv', maxLevel: 3, costFn: (l) => 25000 + l * 20000, effect: (l) => l * 0.10 },
  };

  const TIER2_UPGRADES = {
    golden_touch: { name: 'Golden Touch', icon: '✨', desc: '+15% coins/lv', maxLevel: 5, costFn: (l) => Math.floor(2000 * Math.pow(l + 1, 1.5)) },
    quick_hands: { name: 'Quick Hands', icon: '🤲', desc: '-10% manual serve time/lv', maxLevel: 3, costFn: (l) => Math.floor(3000 * Math.pow(l + 1, 1.5)) },
    double_shot: { name: 'Double Shot', icon: '🎯', desc: '15/25/35% chance 2x coins', maxLevel: 3, costFn: (l) => Math.floor(5000 * Math.pow(l + 1, 1.5)) },
    loyalty_program: { name: 'Loyalty Program', icon: '💝', desc: 'Returning customers +tip', maxLevel: 3, costFn: (l) => Math.floor(4000 * Math.pow(l + 1, 1.5)) },
    express_lane: { name: 'Express Lane', icon: '🏎️', desc: '4th auto-serve at 1.0x speed', maxLevel: 1, costFn: () => 15000 },
    extra_waiter: { name: 'Extra Waiter', icon: '🧑‍🍳', desc: '+1 VIP waiter (up to 3)', maxLevel: 2, costFn: (l) => Math.floor(8000 * Math.pow(l + 1, 1.5)) },
    vip_tables: { name: 'VIP Tables', icon: '🪑', desc: '+2 VIP tables/lv', maxLevel: 3, costFn: (l) => Math.floor(5000 * Math.pow(l + 1, 1.5)) },
    waiter_speed: { name: 'Waiter Speed', icon: '💨', desc: '-10% waiter serve time/lv', maxLevel: 5, costFn: (l) => Math.floor(3000 * Math.pow(l + 1, 1.5)) },
    vip_attraction: { name: 'VIP Attraction', icon: '🧲', desc: '+10% VIP spawn/lv', maxLevel: 3, costFn: (l) => Math.floor(6000 * Math.pow(l + 1, 1.5)) },
    concierge: { name: 'Concierge', icon: '🎩', desc: 'VIPs never leave angry', maxLevel: 1, costFn: () => 25000 },
    station_speed: { name: 'Station Speed', icon: '⚡', desc: '-10% auto-serve time/lv', maxLevel: 5, costFn: (l) => Math.floor(2000 * Math.pow(l + 1, 1.5)) },
    station_range: { name: 'Station Range', icon: '📏', desc: 'Auto-serve higher drinks', maxLevel: 3, costFn: (l) => Math.floor(4000 * Math.pow(l + 1, 1.5)) },
    dual_prep: { name: 'Dual Prep', icon: '👥', desc: 'Station serves 2 at once', maxLevel: 1, costFn: () => 15000 },
  };

  const STORE_DECORATIONS = {
    boba_shop: [{ id: 'neon_sign', name: 'Neon Sign', cost: 500, icon: '💡' }, { id: 'plants', name: 'Potted Plants', cost: 750, icon: '🌿' }, { id: 'fairy_lights', name: 'Fairy Lights', cost: 1000, icon: '✨' }, { id: 'flooring', name: 'Premium Flooring', cost: 1500, icon: '🪵' }, { id: 'jukebox', name: 'Jukebox', cost: 2000, icon: '🎵' }, { id: 'aquarium', name: 'Aquarium', cost: 3000, icon: '🐠' }, { id: 'chandelier', name: 'Chandelier', cost: 4000, icon: '💎' }, { id: 'gold_counter', name: 'Gold Counter', cost: 5000, icon: '🥇' }],
    bean_brew: [{ id: 'chalkboard', name: 'Chalkboard Menu', cost: 600, icon: '📋' }, { id: 'clock', name: 'Vintage Clock', cost: 900, icon: '🕐' }, { id: 'edison', name: 'Edison Bulbs', cost: 1200, icon: '💡' }, { id: 'leather', name: 'Leather Seats', cost: 2000, icon: '💺' }, { id: 'art_wall', name: 'Coffee Art Wall', cost: 3000, icon: '🎨' }, { id: 'espresso_machine', name: 'Espresso Machine', cost: 4500, icon: '☕' }, { id: 'record', name: 'Record Player', cost: 5500, icon: '🎶' }, { id: 'copper', name: 'Copper Pipes', cost: 7000, icon: '🔧' }],
    juice_junction: [{ id: 'surfboard', name: 'Surfboard', cost: 800, icon: '🏄' }, { id: 'palms', name: 'Tropical Plants', cost: 1200, icon: '🌴' }, { id: 'tiki', name: 'Tiki Torches', cost: 1800, icon: '🔥' }, { id: 'bamboo', name: 'Bamboo Counter', cost: 2500, icon: '🎋' }, { id: 'fruit_wall', name: 'Fruit Wall', cost: 3500, icon: '🍊' }, { id: 'waterfall', name: 'Waterfall Feature', cost: 5000, icon: '💧' }, { id: 'parrot', name: 'Parrot Perch', cost: 6000, icon: '🦜' }, { id: 'sand', name: 'Sand Floor', cost: 8000, icon: '🏖️' }],
    sweet_tooth: [{ id: 'candy_jars', name: 'Candy Jars', cost: 700, icon: '🍬' }, { id: 'macaron', name: 'Macaron Tower', cost: 1100, icon: '🧁' }, { id: 'donut_wall', name: 'Donut Wall', cost: 1600, icon: '🍩' }, { id: 'pink_oven', name: 'Pink Oven', cost: 2500, icon: '🔥' }, { id: 'candy_cane', name: 'Candy Pillars', cost: 3500, icon: '🍭' }, { id: 'gingerbread', name: 'Gingerbread Trim', cost: 5000, icon: '🏠' }, { id: 'cotton_candy', name: 'Cotton Candy', cost: 6500, icon: '🍥' }, { id: 'crystal_cake', name: 'Crystal Cake Stand', cost: 8500, icon: '💎' }],
    golden_lounge: [{ id: 'velvet_rope', name: 'Velvet Rope', cost: 1000, icon: '🪢' }, { id: 'mirror', name: 'Art Deco Mirror', cost: 2000, icon: '🪞' }, { id: 'crystal_chand', name: 'Crystal Chandelier', cost: 3000, icon: '💎' }, { id: 'pillars', name: 'Marble Pillars', cost: 5000, icon: '🏛️' }, { id: 'piano', name: 'Grand Piano', cost: 8000, icon: '🎹' }, { id: 'champagne_fountain', name: 'Champagne Fountain', cost: 12000, icon: '🍾' }, { id: 'star_ceiling', name: 'Starlight Ceiling', cost: 15000, icon: '⭐' }, { id: 'diamond_bar', name: 'Diamond Bar Top', cost: 20000, icon: '💎' }],
  };

  const MANAGER_UPGRADES = {
    training_1: { name: 'Training I', cost: 3000, effect: 0.05, icon: '📚', desc: '+5% efficiency' },
    training_2: { name: 'Training II', cost: 8000, effect: 0.10, icon: '📖', desc: '+10% efficiency' },
    training_3: { name: 'Training III', cost: 20000, effect: 0.15, icon: '🎓', desc: '+15% efficiency' },
    motivation: { name: 'Motivation Bonus', cost: 10000, effect: 0.02, icon: '🌟', desc: '+2%/login day eff' },
    night_shift: { name: 'Night Shift', cost: 25000, effect: 0, icon: '🌙', desc: 'Accrual cap 36h' },
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
  let loginStreak = { lastLoginDate: null, count: 0, longestStreak: 0 };
  let collectedMilestones = new Set();
  let tutorialsSeen = { main: false, vip: false };
  let masterVolume = 0.5;
  let isMuted = false;

  // Per-day state
  let dayTimer = 0;
  let dayRevenue = 0;
  let dayPenalties = 0;
  let dayStartTime = 0;
  let customersServed = 0;
  let customersLost = 0;
  let adaptivePatienceBoost = 0; // +% patience when player is struggling
  let grandReopeningActive = false; // 2x customers for 1 day after major damage
  let comboStreak = 0;
  let peakCombo = 0;
  let comboForgives = 0;
  let customers = [];
  let spawnTimer = 0;
  let manualServing = null;
  let autoServing = [null, null, null, null];
  let rushActive = false;
  let rushTimer = 0;
  let rushStartTime = 0;
  let rushScheduled = false;
  let rushCustomerIds = new Set();
  let rushLostAny = false;
  let rushHadEvent = false;
  let rushWarningShown = false;
  // Extended events
  let happyHourActive = false;
  let happyHourTimer = 0;
  let criticActive = false;
  let criticCustomerId = null;
  let eventPityCounter = 0;
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
    // Load existing empire to preserve ALL state (hqUpgrades, managers, tier2, decorations)
    let prev = {};
    try { prev = JSON.parse(localStorage.getItem('tt_empire') || '{}'); } catch(e) {}
    const existingStores = prev.stores || {};
    const existingGlobal = prev.global || {};

    // Update active store (preserve tier2Levels, decorations etc.)
    existingStores[activeStoreId] = {
      ...(existingStores[activeStoreId] || {}),
      unlocked: true,
      currentDay,
      upgradeLevels: { ...upgradeLevels },
      bestDayRevenue: Math.max((existingStores[activeStoreId] || {}).bestDayRevenue || 0, bestScore),
    };
    if (!existingStores.boba_shop) {
      existingStores.boba_shop = { unlocked: true, currentDay: 1, upgradeLevels: {}, bestDayRevenue: 0 };
    }

    const empire = {
      version: 2,
      global: {
        ...existingGlobal, // Preserve hqUpgrades, managers, etc.
        wallet,
        prestigeLevel,
        bestScore,
        achievements: [...unlockedAchievements],
        cumulativeStats,
        loginStreak,
        lastPlayedTimestamp: Date.now(),
        prestigeBridgeDays: prestigeBridgeDays || 0,
        collectedMilestones: [...collectedMilestones],
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
    localStorage.setItem('tt_empire', JSON.stringify(empire)); invalidateEmpireCache();

    // Cloud sync (non-blocking) — save empire to backend for cross-device persistence
    if (window.gameCloud && window.gameCloud.isSignedIn()) {
      window.gameCloud.saveState('tiny-tycoon', {
        additionalData: empire,
        lastPlayedDate: new Date().toISOString().split('T')[0],
        gamesPlayed: cumulativeStats.daysPlayed || 0,
      }).catch(() => {}); // Silent fail — localStorage is primary
    }
  }

  async function loadCloudState() {
    if (!window.gameCloud || !window.gameCloud.isSignedIn()) return false;
    try {
      const cloudState = await window.gameCloud.loadState('tiny-tycoon');
      if (!cloudState || !cloudState.additionalData) return false;

      const cloudEmpire = cloudState.additionalData;
      const localRaw = localStorage.getItem('tt_empire');
      const localEmpire = localRaw ? JSON.parse(localRaw) : null;

      // Merge strategy: use whichever has more progress (higher lifetime coins)
      const cloudCoins = (cloudEmpire.global || {}).cumulativeStats?.totalCoinsEarned || 0;
      const localCoins = localEmpire ? ((localEmpire.global || {}).cumulativeStats?.totalCoinsEarned || 0) : 0;

      if (cloudCoins > localCoins) {
        localStorage.setItem('tt_empire', JSON.stringify(cloudEmpire)); invalidateEmpireCache();
        return true; // Cloud was newer — reload from localStorage
      }
      return false; // Local is ahead or equal
    } catch(e) {
      return false;
    }
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
      collectedMilestones = new Set(g.collectedMilestones || []);

      activeStoreId = empire.activeStoreId || 'boba_shop';
      const storeConfig = STORE_CONFIGS[activeStoreId];
      if (storeConfig) {
        DRINK_TYPES = storeConfig.getDrinks();
        CUSTOMER_TYPES = storeConfig.getCustomers();
        UPGRADES = storeConfig.getUpgrades();
        SPAWN_TABLE = storeConfig.getSpawnTable();
        PATIENCE_TABLE = storeConfig.getPatienceTable();
      }

      const store = (empire.stores || {})[(empire.activeStoreId || 'boba_shop')] || {};
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
    localStorage.setItem('tt_empire', JSON.stringify(empire)); invalidateEmpireCache();
    // Clean up old keys
    ['tt_wallet', 'tt_best_score', 'tt_current_day', 'tt_upgrades', 'tt_achievements',
     'tt_stats', 'tt_prestige', 'tt_volume', 'tt_muted', 'tt_relaxed_mode',
     'tt_tutorial_seen', 'tt_vip_tutorial_seen', 'tt_login_streak'].forEach(k => localStorage.removeItem(k));
  }

  function resetGame() {
    localStorage.removeItem('tt_empire'); invalidateEmpireCache();
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
    const reopeningMult = grandReopeningActive ? 0.5 : 1; // 2x customers = half interval
    const interval = config.interval * (relaxedMode ? RELAXED.spawnMult : 1) * reopeningMult;
    return { interval, maxQueue: config.maxQueue + queueBonus };
  }

  function getBasePatience(day) {
    let p = PATIENCE_TABLE[0].patience;
    for (const row of PATIENCE_TABLE) {
      if (day >= row.minDay) p = row.patience;
    }
    const patienceBonus = 1 + (upgradeLevels.patience_plus || 0) * 0.10;
    const hqBrand = 1 + getHqLevel('brand_recognition') * 0.15;
    return p * patienceBonus * hqBrand * (relaxedMode ? RELAXED.patienceMult : 1);
  }

  // Empire cache — avoids re-parsing localStorage on every hot-path call
  let _empireCache = null;
  function getEmpire() {
    if (!_empireCache) {
      try { _empireCache = JSON.parse(localStorage.getItem('tt_empire') || '{}'); }
      catch(e) { _empireCache = {}; }
    }
    return _empireCache;
  }
  function invalidateEmpireCache() { _empireCache = null; }

  function getHqLevel(upgradeId) {
    const empire = getEmpire();
    return ((empire.global || {}).hqUpgrades || {})[upgradeId] || 0;
  }

  function getTier2Level(upgradeId) {
    const empire = getEmpire();
    const store = (empire.stores || {})[activeStoreId] || {};
    return (store.tier2Levels || {})[upgradeId] || 0;
  }

  function getManagers() {
    const empire = getEmpire();
    return (empire.global || {}).managers || {};
  }

  function getUnlockedStores() {
    const stores = [];
    const empire = getEmpire();
    for (const [id, store] of Object.entries(empire.stores || {})) {
      if (store.unlocked) stores.push(id);
    }
    if (stores.length === 0) stores.push('boba_shop');
    return stores;
  }

  function getOwnedDecorations() {
    const empire = getEmpire();
    return ((empire.stores || {})[activeStoreId] || {}).decorations || [];
  }

  function getServeTime(drinkKey) {
    const base = DRINK_TYPES[drinkKey].serveTime;
    const level = upgradeLevels.speed_boost || 0;
    const hqSupplyChain = getHqLevel('supply_chain') * 0.10;
    const t2QuickHands = getTier2Level('quick_hands') * 0.10;
    return base * Math.pow(0.95, level) * (1 - hqSupplyChain) * (1 - t2QuickHands);
  }

  function getAutoServeTimeForStation(stationIndex, drinkKey) {
    const manual = getServeTime(drinkKey);
    const stationSpeedBonus = getTier2Level('station_speed') * 0.10;
    const dualPrepBonus = getTier2Level('dual_prep') > 0 ? 0.30 : 0; // 30% faster with dual prep
    const baseMultiplier = stationIndex === 3 ? 1.0 : (stationIndex === 2 ? 1.25 : 1.5); // Express lane = 1.0x
    return manual * baseMultiplier * (1 - stationSpeedBonus) * (1 - dualPrepBonus);
  }

  function getWaiterServeTime(drinkKey) {
    const manual = getServeTime(drinkKey);
    const waiterSpeedBonus = getTier2Level('waiter_speed') * 0.10;
    const extraWaiters = getTier2Level('extra_waiter'); // 0-2: each extra waiter = 20% faster
    return manual * 1.5 * (1 - waiterSpeedBonus) * (1 - extraWaiters * 0.20);
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
    const t2Tables = getTier2Level('vip_tables') * 2; // +2 tables per level
    return Math.min(vipLevel + t2Tables, 9); // Cap at 9 tables
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

    // Render purchased decorations
    renderDecorations();
  }

  function renderDecorations() {
    const shopBg = document.querySelector('.shop-bg');
    if (!shopBg) return;

    // Remove existing decoration elements and vibe elements
    shopBg.querySelectorAll('.shop-decor,.vibe-mote,.vibe-sparkle').forEach(el => el.remove());
    shopBg.classList.remove('vibe-bare', 'vibe-cozy', 'vibe-premium', 'vibe-luxurious');

    const owned = getOwnedDecorations();
    if (owned.length === 0) {
      shopBg.classList.add('vibe-bare');
      return;
    }

    const decoVisuals = {
      // ── Boba Bliss ──
      neon_sign: {
        html: '<div class="shop-decor decor-neon"><span class="neon-tube">BOBA</span></div>',
        css: 'position:absolute;top:6px;right:10px;'
      },
      plants: {
        html: '<div class="shop-decor decor-plants"><div class="pot-plant"><div class="pot-leaves"></div><div class="pot-base"></div></div><div class="pot-plant" style="margin-left:8px;"><div class="pot-leaves small"></div><div class="pot-base small"></div></div></div>',
        css: 'position:absolute;top:14%;left:6px;display:flex;gap:2px;z-index:11;'
      },
      fairy_lights: {
        html: '<div class="shop-decor decor-fairy"><span class="fairy-bulb" style="--d:0s;--c:#FF6B6B;"></span><span class="fairy-bulb" style="--d:0.4s;--c:#FFD93D;"></span><span class="fairy-bulb" style="--d:0.8s;--c:#6BCB77;"></span><span class="fairy-bulb" style="--d:1.2s;--c:#4D96FF;"></span><span class="fairy-bulb" style="--d:1.6s;--c:#FF6BD6;"></span><span class="fairy-bulb" style="--d:2.0s;--c:#FFD93D;"></span><span class="fairy-bulb" style="--d:2.4s;--c:#FF6B6B;"></span><span class="fairy-bulb" style="--d:2.8s;--c:#6BCB77;"></span></div>',
        css: 'position:absolute;top:1px;left:5%;right:5%;display:flex;justify-content:space-between;z-index:7;'
      },
      flooring: {
        html: '<div class="shop-decor decor-floor"></div>',
        css: 'position:absolute;bottom:0;left:0;right:0;height:30px;'
      },
      jukebox: {
        html: '<div class="shop-decor decor-jukebox"><div class="jukebox-body"><span class="jukebox-note">&#9835;</span></div></div>',
        css: 'position:absolute;top:17%;right:8px;'
      },
      aquarium: {
        html: '<div class="shop-decor decor-aquarium"><div class="aq-tank"><div class="aq-water"></div><div class="aq-fish f1"></div><div class="aq-fish f2"></div><div class="aq-plant"></div></div></div>',
        css: 'position:absolute;top:6px;left:6px;z-index:7;'
      },
      chandelier: {
        html: '<div class="shop-decor decor-chandelier"><div class="ch-chain"></div><div class="ch-body"><div class="ch-arm left"></div><div class="ch-arm right"></div><div class="ch-crystal c1"></div><div class="ch-crystal c2"></div><div class="ch-crystal c3"></div></div></div>',
        css: 'position:absolute;top:0;left:50%;transform:translateX(-50%);z-index:7;'
      },
      gold_counter: {
        html: '<div class="shop-decor decor-gold-counter"></div>',
        css: 'position:absolute;top:25.5%;left:0;right:0;height:4px;'
      },

      // ── Bean & Brew ──
      chalkboard: {
        html: '<div class="shop-decor decor-chalk"><div class="chalk-board"></div></div>',
        css: 'position:absolute;top:8px;right:8px;'
      },
      clock: {
        html: '<div class="shop-decor decor-clock"><div class="clock-face"><div class="clock-dot"></div></div></div>',
        css: 'position:absolute;top:6px;left:50%;transform:translateX(-50%);'
      },
      edison: {
        html: '<div class="shop-decor decor-edison"><div class="edison-row"><div class="edison-bulb"><div class="eb-wire"></div><div class="eb-glass"></div></div><div class="edison-bulb"><div class="eb-wire"></div><div class="eb-glass"></div></div><div class="edison-bulb"><div class="eb-wire"></div><div class="eb-glass"></div></div></div></div>',
        css: 'position:absolute;top:0;left:15%;right:15%;'
      },
      leather: {
        html: '<div class="shop-decor decor-leather"><div class="leather-seat"></div></div>',
        css: 'position:absolute;top:17%;right:10px;'
      },
      art_wall: {
        html: '<div class="shop-decor decor-art"><div class="art-frame"></div></div>',
        css: 'position:absolute;top:10px;left:10px;'
      },
      espresso_machine: {
        html: '<div class="shop-decor decor-espresso"><div class="espresso-body"><div class="espresso-steam"></div><div class="espresso-steam"></div></div></div>',
        css: 'position:absolute;top:15%;left:55%;'
      },
      record: {
        html: '<div class="shop-decor decor-record"><div class="record-disc"></div></div>',
        css: 'position:absolute;top:17%;left:10px;'
      },
      copper: {
        html: '<div class="shop-decor decor-copper"><div class="copper-pipe"></div></div>',
        css: 'position:absolute;top:0;right:0;width:6px;height:100%;opacity:0.5;'
      },

      // ── Juice Junction ──
      surfboard: {
        html: '<div class="shop-decor decor-surfboard"><div class="surfboard-shape"></div></div>',
        css: 'position:absolute;top:4px;right:6px;'
      },
      palms: {
        html: '<div class="shop-decor decor-palms"><div class="palm-tree"><div class="palm-fronds"><div class="palm-frond-mid"></div></div><div class="palm-trunk"></div></div><div class="palm-tree" style="margin-left:6px;"><div class="palm-fronds"><div class="palm-frond-mid"></div></div><div class="palm-trunk"></div></div></div>',
        css: 'position:absolute;top:2%;left:4px;display:flex;'
      },
      tiki: {
        html: '<div class="shop-decor decor-tiki"><div class="tiki-torch"><div class="tiki-flame"></div><div class="tiki-post"></div></div></div>',
        css: 'position:absolute;top:10%;right:8px;'
      },
      bamboo: {
        html: '<div class="shop-decor decor-bamboo"><div class="bamboo-bar"></div></div>',
        css: 'position:absolute;bottom:28px;left:0;right:0;'
      },
      fruit_wall: {
        html: '<div class="shop-decor decor-fruit-wall"><div class="fruit-row"><div class="css-fruit orange"></div><div class="css-fruit lemon"></div><div class="css-fruit grape"></div><div class="css-fruit lime"></div></div></div>',
        css: 'position:absolute;top:10px;left:6px;'
      },
      waterfall: {
        html: '<div class="shop-decor decor-waterfall"><div class="waterfall-stream"></div></div>',
        css: 'position:absolute;top:12px;left:50%;transform:translateX(-50%);'
      },
      parrot: {
        html: '<div class="shop-decor decor-parrot"><div class="parrot-body"></div><div class="parrot-perch"></div></div>',
        css: 'position:absolute;top:6px;left:8px;'
      },
      sand: {
        html: '<div class="shop-decor decor-sand"><div class="sand-floor"></div></div>',
        css: 'position:absolute;bottom:0;left:0;right:0;height:30px;'
      },

      // ── Sweet Tooth ──
      candy_jars: {
        html: '<div class="shop-decor decor-candy-jars"><div class="candy-jar-row"><div class="candy-jar"><div class="candy-dots"></div></div><div class="candy-jar"><div class="candy-dots"></div></div><div class="candy-jar"><div class="candy-dots"></div></div></div></div>',
        css: 'position:absolute;top:8px;right:6px;'
      },
      macaron: {
        html: '<div class="shop-decor decor-macaron"><div class="macaron-stack"><div class="macaron-piece pink"></div><div class="macaron-piece mint"></div><div class="macaron-piece lavender"></div></div></div>',
        css: 'position:absolute;top:12px;left:8px;'
      },
      donut_wall: {
        html: '<div class="shop-decor decor-donut-wall"><div class="donut-row"><div class="css-donut d-pink"></div><div class="css-donut d-choc"></div><div class="css-donut d-blue"></div></div></div>',
        css: 'position:absolute;top:6px;left:28%;'
      },
      pink_oven: {
        html: '<div class="shop-decor decor-pink-oven"><div class="oven-body"><div class="oven-window"></div></div></div>',
        css: 'position:absolute;top:15%;right:8px;'
      },
      candy_cane: {
        html: '<div class="shop-decor decor-candy-cane"><div class="cane-shape"></div></div>',
        css: 'position:absolute;top:12%;left:6px;'
      },
      gingerbread: {
        html: '<div class="shop-decor decor-gingerbread"><div class="gingerbread-trim"></div></div>',
        css: 'position:absolute;top:0;left:0;right:0;'
      },
      cotton_candy: {
        html: '<div class="shop-decor decor-cotton-candy"><div class="cotton-candy-shape"><div class="cotton-candy-fluff"></div><div class="cotton-candy-stick"></div></div></div>',
        css: 'position:absolute;top:17%;left:50%;'
      },
      crystal_cake: {
        html: '<div class="shop-decor decor-crystal-cake"><div class="cake-stand" style="position:relative;"><div class="cake-sparkle"></div><div class="cake-tier t1"></div><div class="cake-tier t2"></div><div class="cake-tier t3"></div><div class="cake-stand-base"></div></div></div>',
        css: 'position:absolute;top:10px;left:50%;transform:translateX(-50%);'
      },

      // ── Golden Lounge ──
      velvet_rope: {
        html: '<div class="shop-decor decor-velvet-rope"><div class="velvet-rope-set"><div class="rope-post"></div><div class="rope-line"></div><div class="rope-post"></div></div></div>',
        css: 'position:absolute;top:16%;left:25%;'
      },
      mirror: {
        html: '<div class="shop-decor decor-mirror"><div class="mirror-frame"><div class="mirror-corner tl"></div><div class="mirror-corner tr"></div><div class="mirror-corner bl"></div><div class="mirror-corner br"></div></div></div>',
        css: 'position:absolute;top:6px;right:8px;'
      },
      crystal_chand: {
        html: '<div class="shop-decor decor-crystal-chand"><div class="cc-chain"></div><div class="cc-body"><div class="cc-arm left"></div><div class="cc-arm right"></div><div class="cc-crystal"></div><div class="cc-crystal"></div><div class="cc-crystal"></div><div class="cc-crystal"></div><div class="cc-crystal"></div></div></div>',
        css: 'position:absolute;top:0;left:50%;transform:translateX(-50%);'
      },
      pillars: {
        html: '<div class="shop-decor decor-pillars"><div class="pillar-col"><div class="pillar-capital"></div><div class="pillar-shaft"></div><div class="pillar-base"></div></div></div>',
        css: 'position:absolute;top:5%;left:4px;'
      },
      piano: {
        html: '<div class="shop-decor decor-piano"><div class="piano-body"><div class="piano-keys"></div></div></div>',
        css: 'position:absolute;top:17%;right:4px;'
      },
      champagne_fountain: {
        html: '<div class="shop-decor decor-champagne"><div class="champagne-tower"><div class="champagne-tier ct1"></div><div class="champagne-tier ct2"></div><div class="champagne-tier ct3"></div><div class="champagne-drop"></div><div class="champagne-drop"></div><div class="champagne-drop"></div></div></div>',
        css: 'position:absolute;top:10px;left:8px;'
      },
      star_ceiling: {
        html: '<div class="shop-decor decor-star-ceiling"><div class="star-field"><div class="mini-star" style="top:2px;left:10%;animation-delay:0s;"></div><div class="mini-star" style="top:4px;left:30%;animation-delay:0.7s;"></div><div class="mini-star" style="top:1px;left:50%;animation-delay:1.4s;"></div><div class="mini-star" style="top:3px;left:70%;animation-delay:0.3s;"></div><div class="mini-star" style="top:2px;left:85%;animation-delay:2.1s;"></div><div class="mini-star" style="top:5px;left:20%;animation-delay:1.8s;"></div><div class="mini-star" style="top:4px;left:60%;animation-delay:0.9s;"></div></div></div>',
        css: 'position:absolute;top:0;left:5%;right:5%;height:10px;'
      },
      diamond_bar: {
        html: '<div class="shop-decor decor-diamond-bar"><div class="diamond-surface"><div class="diamond-gem"></div><div class="diamond-gem"></div><div class="diamond-gem"></div><div class="diamond-gem"></div></div></div>',
        css: 'position:absolute;bottom:28px;left:0;right:0;'
      },
    };

    for (const id of owned) {
      const visual = decoVisuals[id];
      if (!visual) continue;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = visual.html;
      const el = wrapper.firstElementChild;
      if (el) {
        el.style.cssText = visual.css;
        shopBg.appendChild(el);
      }
    }

    // ── Vibe / Atmosphere system ──
    const vibeScore = Math.min(100, owned.length * 12.5);
    let vibeClass = 'vibe-bare';
    let moteCount = 0;
    let sparkleCount = 0;

    if (vibeScore > 75) {
      vibeClass = 'vibe-luxurious';
      moteCount = 4;
      sparkleCount = 3;
    } else if (vibeScore > 50) {
      vibeClass = 'vibe-premium';
      moteCount = 3;
    } else if (vibeScore > 25) {
      vibeClass = 'vibe-cozy';
      moteCount = 2;
    }

    shopBg.classList.add(vibeClass);

    // Add floating dust motes
    for (let i = 0; i < moteCount; i++) {
      const mote = document.createElement('div');
      mote.className = 'vibe-mote';
      mote.style.cssText = 'left:' + (15 + Math.random() * 70) + '%;bottom:' + (10 + Math.random() * 40) + '%;animation-delay:' + (i * 1.5) + 's;animation-duration:' + (5 + Math.random() * 3) + 's;';
      shopBg.appendChild(mote);
    }

    // Add sparkle particles for luxurious vibe
    for (let i = 0; i < sparkleCount; i++) {
      const sp = document.createElement('div');
      sp.className = 'vibe-sparkle';
      sp.style.cssText = 'left:' + (10 + Math.random() * 80) + '%;top:' + (10 + Math.random() * 60) + '%;animation-delay:' + (i * 0.8) + 's;';
      shopBg.appendChild(sp);
    }
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
  function createCustomer(isCritic) {
    const config = getSpawnConfig(currentDay);
    // Count only non-VIP customers for queue limit
    const queuedCount = customers.filter(c =>
      !c.isVip && (c.state === 'queued' || c.state === 'walking_to_queue')
    ).length;

    const vipLevel = upgradeLevels.vip_lounge || 0;
    let vipChance = 0;
    if (vipLevel > 0) {
      const vipMagnetBonus = (prestigeLevel >= 3) ? 0.15 : 0;
      const hqLoyalty = getHqLevel('loyalty_network') * 0.10;
      const t2VipAttraction = getTier2Level('vip_attraction') * 0.10;
      vipChance = 0.05 + vipLevel * 0.05 + vipMagnetBonus + hqLoyalty + t2VipAttraction;
    }
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
        isCritic: !!isCritic,
        isCelebrity: false, // set below
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

      // Celebrity: rare 3x coins, 0.5x patience (Day 15+, 5%)
      if (!isCritic && currentDay >= 15 && Math.random() < 0.05) {
        customer.isCelebrity = true;
        customer.maxPatience = patience * 0.5;
        customer.patience = patience * 0.5;
      }
      // Critic: high risk/reward, 0.8x patience
      if (isCritic) {
        customer.maxPatience = patience * 0.8;
        customer.patience = patience * 0.8;
        type = 'business';
        customer.type = type;
        customer.order = pickOrder('foodie', currentDay);
      }

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
    const spacing = queued.length >= 8 ? 42 : 50;
    return baseX + queued.length * spacing;
  }

  function createCustomerElement(c) {
    const el = document.createElement('div');
    el.className = 'customer' + (c.isVip ? ' vip' : '') + (c.isCelebrity ? ' celebrity' : '') + (c.isCritic ? ' critic' : '') + ' type-' + c.type + ' entering';
    el.dataset.id = c.id;
    el.style.transform = `translateX(${c.x}px)`;
    el.style.setProperty('--tx', c.x + 'px');
    el.style.top = c.y + 'px';
    // Switch from entrance to walking animation after entrance completes
    setTimeout(() => { if (el.parentNode) el.className = el.className.replace('entering', 'walking'); }, 300);

    const color = c.isCelebrity ? '#FF1493' : (c.isCritic ? '#455A64' : CUSTOMER_TYPES[c.type].color);

    // Celebrity flash effect
    if (c.isCelebrity) {
      const flash = document.createElement('div');
      flash.className = 'celebrity-flash';
      queueArea.appendChild(flash);
      setTimeout(() => flash.remove(), 600);
    }

    el.innerHTML = `
      <div class="customer-shadow"></div>
      <div class="patience-icon"></div>
      <div class="patience-bar-bg">
        <div class="patience-bar" style="width:100%;background:var(--matcha)"></div>
      </div>
      ${c.isVip ? '<div class="customer-crown">👑</div>' : ''}
      ${c.isCelebrity ? '<div class="customer-accessory" style="position:absolute;top:-2px;left:50%;transform:translateX(-50%);font-size:0.5rem;z-index:3;">🕶️</div>' : ''}
      ${c.isCritic ? '<div class="customer-accessory" style="position:absolute;top:-4px;left:50%;transform:translateX(-50%);font-size:0.55rem;z-index:3;">🎩</div>' : ''}
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
    // Loyalty Program: extra tip bonus per level
    const loyaltyLevel = getTier2Level('loyalty_program');
    if (loyaltyLevel > 0) tipBonus += loyaltyLevel * 3;

    const prestigeMultiplier = 1 + prestigeLevel * 0.05;
    const bridgeMultiplier = (prestigeBridgeDays > 0) ? 2 : 1;
    const rushMasterMultiplier = (prestigeLevel >= 4 && rushActive) ? 2 : 1;
    const hqFranchise = 1 + getHqLevel('franchise_bonus') * 0.05;
    const t2Golden = 1 + getTier2Level('golden_touch') * 0.15;
    const t2DoubleShot = getTier2Level('double_shot');
    const doubleShotMultiplier = (t2DoubleShot > 0 && Math.random() < (0.10 + t2DoubleShot * 0.05)) ? 2 : 1;
    const happyHourMultiplier = happyHourActive ? 2 : 1;
    const celebrityMultiplier = c.isCelebrity ? 3 : 1;
    const rawCoins = Math.floor(baseCoins * vipMultiplier * comboMultiplier * prestigeMultiplier * bridgeMultiplier * rushMasterMultiplier * hqFranchise * t2Golden * doubleShotMultiplier * happyHourMultiplier * celebrityMultiplier);
    const totalCoins = Math.min(rawCoins, 5000) + tipBonus; // Cap per-serve at 5000 to prevent edge-case inflation

    // Critic bonus: serve >80% patience for +200
    if (c.isCritic) {
      if ((c.patience / c.maxPatience) > 0.8) {
        dayRevenue += 200;
        spawnFloatingText(c, '+200 Rave Review!');
      }
      criticCustomerId = null;
    }

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
    dayPenalties += c.isCritic ? 50 : 5;
    if (c.isCritic) criticCustomerId = null;

    // Adaptive difficulty: if 3+ lost in first 20s, boost patience for remaining customers
    const elapsed = DAY_DURATION - dayTimer;
    if (elapsed < 20000 && customersLost >= 3 && adaptivePatienceBoost === 0) {
      adaptivePatienceBoost = 0.25; // +25% patience for rest of day
      customers.forEach(cu => {
        if (cu.state === 'queued' || cu.state === 'walking_to_queue') {
          cu.patience += cu.maxPatience * 0.25;
          cu.maxPatience *= 1.25;
        }
      });
    }

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
    const spacing = inQueue.length > 8 ? 42 : 50; // Tighter spacing at max queue to avoid overflow
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
    const rangeBonus = getTier2Level('station_range'); // 0-3: expands which drinks each station handles
    if (upgradeLevels.auto_serve_1) stations.push({ index: 0, maxBaseCoins: 10 + rangeBonus * 10 });
    if (upgradeLevels.auto_serve_2) stations.push({ index: 1, maxBaseCoins: 20 + rangeBonus * 15 });
    if (upgradeLevels.auto_serve_3) stations.push({ index: 2, maxBaseCoins: 999 });
    if (getTier2Level('express_lane') > 0) stations.push({ index: 3, maxBaseCoins: 999 }); // 4th station at 1.0x speed
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

    // Happy Hour logic
    if (happyHourTimer > 0 && !happyHourActive) {
      const elapsed = DAY_DURATION - dayTimer;
      if (elapsed >= happyHourTimer) {
        happyHourActive = true;
        happyHourTimer = 15000;
        rushBanner.textContent = '🎉 HAPPY HOUR! 2x Coins! 🎉';
        rushBanner.classList.add('visible');
        playSound('rush');
      }
    }
    if (happyHourActive) {
      happyHourTimer -= dt;
      const hhSecs = Math.max(0, Math.ceil(happyHourTimer / 1000));
      rushBanner.textContent = `🎉 HAPPY HOUR! 2x Coins! ${hhSecs}s 🎉`;
      if (happyHourTimer <= 0) {
        happyHourActive = false;
        rushBanner.classList.remove('visible');
      }
    }

    // Critic Visit — spawn mid-day
    if (criticActive && !criticCustomerId) {
      const elapsed = DAY_DURATION - dayTimer;
      if (elapsed > 20000 && elapsed < 40000 && Math.random() < 0.02) {
        criticCustomerId = 'pending';
        createCustomer(true);
        criticActive = false;
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
        // Concierge upgrade: VIPs never leave angry
        if (getTier2Level('concierge') > 0 && c.patience < 100) c.patience = 100;
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
    adaptivePatienceBoost = 0;
    grandReopeningActive = false; // Only lasts 1 day
    manualServing = null;
    autoServing = [null, null, null, null];
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

    // Event scheduling (Rush Hour, Happy Hour, Critic Visit)
    happyHourActive = false;
    happyHourTimer = 0;
    criticActive = false;
    criticCustomerId = null;
    rushScheduled = false;
    const guaranteeEvent = eventPityCounter >= 3;
    let eventPicked = false;
    if (currentDay >= 5) {
      if (Math.random() < 0.30 || guaranteeEvent) {
        rushScheduled = true;
        rushStartTime = 15000 + Math.random() * 30000;
        rushHadEvent = true;
        eventPicked = true;
      }
    }
    if (!eventPicked && currentDay >= 10) {
      if (Math.random() < 0.15 || (guaranteeEvent && !eventPicked)) {
        happyHourTimer = 20000 + Math.random() * 25000;
        eventPicked = true;
      }
    }
    if (!eventPicked && currentDay >= 15) {
      if (Math.random() < 0.10) {
        criticActive = true;
        eventPicked = true;
      }
    }
    eventPityCounter = eventPicked ? 0 : eventPityCounter + 1;

    // Grand Re-Opening banner
    if (grandReopeningActive) {
      rushBanner.textContent = '🎉 GRAND RE-OPENING! 2x Customers! 🎉';
      rushBanner.classList.add('visible');
      setTimeout(() => { if (!rushActive && !happyHourActive) rushBanner.classList.remove('visible'); }, 5000);
    }

    // P5 perk: Golden Start — 50 bonus coins at day start
    if (prestigeLevel >= 5) {
      dayRevenue += 50;
    }

    // Milestone check
    for (const m of MILESTONES) {
      if (currentDay >= m.day && !collectedMilestones.has(m.day)) {
        collectedMilestones.add(m.day);
        wallet += m.bonus;
        if (m.achievement && !unlockedAchievements.has(m.achievement)) unlockAchievement(m.achievement);
        spawnConfetti();
        playSound('newBest');
      }
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

  function getNextGoalHint() {
    // Find cheapest affordable or nearly-affordable upgrade
    let closest = null;
    let closestGap = Infinity;
    for (const [id, upgrade] of Object.entries(UPGRADES)) {
      const level = upgradeLevels[id] || 0;
      if (level >= upgrade.maxLevel) continue;
      const locked = upgrade.requires && !(upgradeLevels[upgrade.requires] || 0);
      if (locked) continue;
      const cost = upgrade.costFn(level);
      const gap = cost - wallet;
      if (gap > 0 && gap < closestGap) {
        closestGap = gap;
        closest = { name: upgrade.name, icon: upgrade.icon, gap, level: level + 1 };
      }
    }
    if (closest && closestGap < 500) {
      return `<div style="font-size:0.75rem;color:var(--taro);margin-top:0.5rem;">💡 ${formatCoins(closest.gap)} more for ${closest.icon} ${closest.name} Lv${closest.level}!</div>`;
    }
    // Check milestone proximity
    for (const m of MILESTONES) {
      if (currentDay < m.day && m.day - currentDay <= 5) {
        return `<div style="font-size:0.75rem;color:var(--taro);margin-top:0.5rem;">🎯 Day ${m.day} milestone in ${m.day - currentDay} days! (+${formatCoins(m.bonus)} bonus)</div>`;
      }
    }
    // Check for upcoming drink unlocks
    for (const [key, drink] of Object.entries(DRINK_TYPES)) {
      if (drink.unlockDay > currentDay && drink.unlockDay <= currentDay + 3) {
        return `<div style="font-size:0.75rem;color:var(--taro);margin-top:0.5rem;">🆕 Day ${drink.unlockDay} unlocks ${drink.emoji} ${drink.name}!</div>`;
      }
    }
    // Check for upcoming event unlocks
    if (currentDay < 5 && currentDay >= 3) return `<div style="font-size:0.75rem;color:var(--taro);margin-top:0.5rem;">⚡ Day 5 unlocks Rush Hour events!</div>`;
    if (currentDay < 10 && currentDay >= 8) return `<div style="font-size:0.75rem;color:var(--taro);margin-top:0.5rem;">🎉 Day 10 unlocks Happy Hour events!</div>`;
    if (currentDay < 15 && currentDay >= 13) return `<div style="font-size:0.75rem;color:var(--taro);margin-top:0.5rem;">🎩 Day 15 unlocks Critic visits & celebrities!</div>`;
    return '';
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
      ${getNextGoalHint()}
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

    // Find recommended upgrade (cheapest affordable non-maxed)
    let recommendedId = null;
    let recommendedCost = Infinity;
    for (const [id, upgrade] of Object.entries(UPGRADES)) {
      const level = upgradeLevels[id] || 0;
      if (level >= upgrade.maxLevel) continue;
      const locked = upgrade.requires && !(upgradeLevels[upgrade.requires] || 0);
      if (locked) continue;
      const cost = upgrade.costFn(level);
      if (cost <= wallet && cost < recommendedCost) {
        recommendedCost = cost;
        recommendedId = id;
      }
    }
    // If nothing affordable, recommend the cheapest overall
    if (!recommendedId) {
      for (const [id, upgrade] of Object.entries(UPGRADES)) {
        const level = upgradeLevels[id] || 0;
        if (level >= upgrade.maxLevel) continue;
        const locked = upgrade.requires && !(upgradeLevels[upgrade.requires] || 0);
        if (locked) continue;
        const cost = upgrade.costFn(level);
        if (cost < recommendedCost) { recommendedCost = cost; recommendedId = id; }
      }
    }

    let firstLockedTeaser = null;
    const maxedUpgrades = [];
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

      // Collapse maxed upgrades into summary
      if (maxed) {
        maxedUpgrades.push(upgrade.icon);
        continue;
      }

      let cardClass = 'upgrade-card';
      if (maxed) cardClass += ' maxed';
      else if (canAfford) cardClass += ' affordable';
      else cardClass += ' too-expensive';

      const visibleTag = upgrade.visible ? '<div class="upgrade-visible-tag">Shows in shop!</div>' : '';
      const isRecommended = id === recommendedId;

      html += `
        <div class="${cardClass}${isRecommended ? ' recommended' : ''}">
          ${isRecommended ? '<div style="position:absolute;top:-6px;right:8px;background:var(--matcha);color:#fff;font-size:0.5rem;font-weight:700;padding:1px 6px;border-radius:4px;">⭐ BEST VALUE</div>' : ''}
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

    // Maxed upgrades collapsed summary
    if (maxedUpgrades.length > 0) {
      html += `<div style="text-align:center;font-size:0.7rem;color:var(--gold);padding:0.3rem;opacity:0.7;">${maxedUpgrades.join(' ')} — ${maxedUpgrades.length} maxed</div>`;
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

    html += renderTier2Tab();
    html += renderDecorTab();

    const prestigeBtn = allUpgradesMaxed() ? `<button class="btn prestige-btn" onclick="showPrestigeConfirm()">✨ Prestige</button>` : '';
    const hubBtn = getUnlockedStores().length >= 2 ? `<button class="btn btn-secondary btn-small" onclick="showHub()">🏢 Hub</button>` : '';

    html += `
      <div class="shop-actions">
        <button class="btn" onclick="startDay()">Start Day ${currentDay}</button>
        ${prestigeBtn}
        ${hubBtn}
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
    // Reset progression but keep achievements, stats, best score, store unlocks, decorations, managers
    wallet = 500;
    prestigeBridgeDays = 3;
    currentDay = 1;
    upgradeLevels = {};
    collectedMilestones = new Set();
    tutorialsSeen.vip = false;

    // Reset all stores' upgradeLevels and day counters (keep unlocks, decorations, managers)
    try {
      const empire = JSON.parse(localStorage.getItem('tt_empire') || '{}');
      for (const [id, store] of Object.entries(empire.stores || {})) {
        if (store.unlocked) {
          store.currentDay = 1;
          store.upgradeLevels = {};
          // Keep: unlocked, decorations, tier2Levels, bestDayRevenue
        }
      }
      localStorage.setItem('tt_empire', JSON.stringify(empire)); invalidateEmpireCache();
    } catch(e) {}

    // Re-apply active store config
    switchStore(activeStoreId);

    saveGame();
    playSound('newBest');
    spawnConfetti();
    if (prestigeLevel === 1 && !unlockedAchievements.has('tt_prestige')) {
      unlockAchievement('tt_prestige');
    }
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
      'tt_rush_survivor': () => stats.rushSurvivor,
      'tt_second_store':  () => getUnlockedStores().length >= 2,
      'tt_three_stores':  () => getUnlockedStores().length >= 3,
      'tt_five_stores':   () => getUnlockedStores().length >= 5,
      'tt_first_manager': () => Object.keys(getManagers()).length >= 1,
      'tt_all_managers':  () => { const m = getManagers(); const s = getUnlockedStores(); return s.length >= 2 && s.every(id => m[id]); },
      'tt_50k_coins':     () => cumulativeStats.totalCoinsEarned >= 50000,
      'tt_250k_coins':    () => cumulativeStats.totalCoinsEarned >= 250000,
      'tt_1m_coins':      () => cumulativeStats.totalCoinsEarned >= 1000000,
      'tt_hq_upgrade':    () => { const e = getEmpire(); return Object.values((e.global||{}).hqUpgrades||{}).some(v=>v>0); },
      'tt_streak_7':      () => loginStreak.count >= 7,
      'tt_streak_30':     () => loginStreak.count >= 30,
      'tt_critic_served': () => stats.criticServed,
      'tt_prestige_3':    () => prestigeLevel >= 3,
      'tt_prestige_5':    () => prestigeLevel >= 5,
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
  function hireManager(storeId, tierKey) {
    const tier = MANAGER_TIERS[tierKey];
    if (!tier || wallet < tier.cost || prestigeLevel < tier.minPrestige) return;
    if (!getUnlockedStores().includes(storeId)) return;
    wallet -= tier.cost;
    try {
      const empire = JSON.parse(localStorage.getItem('tt_empire') || '{}');
      if (!empire.global) empire.global = {};
      if (!empire.global.managers) empire.global.managers = {};
      empire.global.managers[storeId] = { tier: tierKey };
      localStorage.setItem('tt_empire', JSON.stringify(empire)); invalidateEmpireCache();
    } catch(e) {}
    saveGame();
    playSound('upgrade');
    showHub();
  }

  function calculateStoreDamage(hoursOffline) {
    if (hoursOffline <= 36) return { level: 'none', repairCost: 0 };
    const empire = getEmpire();
    if ((empire.settings || {}).vacationMode) return { level: 'none', repairCost: 0 };
    const rm = relaxedMode ? 0.5 : 1;
    if (hoursOffline <= 48) return { level: 'minor', repairCost: 0, desc: 'Dusty shelves' };
    if (hoursOffline <= 72) return { level: 'moderate', repairCost: Math.floor(200 * rm), desc: '1 station offline' };
    if (hoursOffline <= 168) return { level: 'major', repairCost: Math.floor(500 * rm), desc: '2 stations offline' };
    return { level: 'closed', repairCost: Math.floor(1000 * rm), desc: 'Store closed', grandReopening: true };
  }

  function calculateOfflineEarnings() {
    const unlockedStores = getUnlockedStores();
    if (unlockedStores.length < 2) return null;
    try {
      const empire = JSON.parse(localStorage.getItem('tt_empire') || '{}');
      const managers = (empire.global || {}).managers || {};
      const lastPlayed = (empire.global || {}).lastPlayedTimestamp;
      if (!lastPlayed) return null;
      const hoursOffline = Math.min(24, (Date.now() - lastPlayed) / 3600000);
      if (hoursOffline < 0.1) return null;
      const earnings = [];
      let totalEarned = 0;
      for (const [storeId, mgr] of Object.entries(managers)) {
        const storeData = (empire.stores || {})[storeId];
        if (!storeData || !storeData.unlocked) continue;
        const tier = MANAGER_TIERS[mgr.tier];
        if (!tier) continue;
        const upgradeCount = Object.values(storeData.upgradeLevels || {}).reduce((a, b) => a + b, 0);
        const dayFactor = Math.min(storeData.currentDay || 1, 30);
        const estimatedDailyRev = 100 + dayFactor * 50 + upgradeCount * 30;
        const corpTraining = ((empire.global || {}).hqUpgrades || {}).corporate_training || 0;
        const efficiencyBoost = tier.efficiency + corpTraining * 0.10; // HQ Corporate Training: +10% per level
        const offlineRev = Math.floor(estimatedDailyRev * Math.min(efficiencyBoost, 0.95) * hoursOffline / 24); // Cap at 95%
        const daysAdvanced = Math.floor(hoursOffline);
        if (offlineRev > 0) {
          earnings.push({ storeId, storeName: STORE_CONFIGS[storeId]?.name || storeId, revenue: offlineRev, daysAdvanced });
          totalEarned += offlineRev;
          storeData.currentDay = (storeData.currentDay || 1) + daysAdvanced;
        }
      }
      if (totalEarned === 0) return null;
      const streakBonus = Math.min(loginStreak.count, 7) * 0.05;
      const streakEarnings = Math.floor(totalEarned * streakBonus);
      localStorage.setItem('tt_empire', JSON.stringify(empire)); invalidateEmpireCache();
      return { earnings, totalEarned, streakBonus: streakEarnings, hoursOffline: Math.round(hoursOffline), grandTotal: totalEarned + streakEarnings };
    } catch(e) { return null; }
  }

  function showWelcomeBack(offlineData) {
    if (!offlineData) return false;
    const damage = calculateStoreDamage(offlineData.hoursOffline);
    const totalRepair = damage.repairCost * offlineData.earnings.length;
    const modal = document.getElementById('hubModal');
    let earningsHtml = '';
    for (const e of offlineData.earnings) {
      const config = STORE_CONFIGS[e.storeId];
      earningsHtml += `<div style="display:flex;justify-content:space-between;padding:0.4rem 0;border-bottom:1px solid rgba(0,0,0,0.06);"><div><span style="font-size:1.2rem;">${config?.emoji||'🏪'}</span> <span style="font-size:0.8rem;font-weight:600;">${e.storeName}</span> <span style="font-size:0.6rem;color:#999;">+${e.daysAdvanced}d</span></div><span style="font-size:0.85rem;font-weight:700;color:var(--matcha);">💰 ${formatCoins(e.revenue)}</span></div>`;
    }
    const damageHtml = damage.repairCost > 0 ? `<div style="background:rgba(255,100,100,0.08);border-radius:8px;padding:0.5rem;margin-bottom:0.5rem;font-size:0.75rem;"><div style="font-weight:700;color:var(--coral);">🔧 Maintenance Needed</div><div style="color:#888;">${damage.desc} — Repair: 💰 ${formatCoins(totalRepair)}</div>${damage.grandReopening?'<div style="color:var(--matcha);">🎉 Grand Re-Opening: 2x customers next day!</div>':''}</div>` : '';
    const netTotal = offlineData.grandTotal - totalRepair;
    modal.innerHTML = `<div style="text-align:center;"><div style="font-size:2rem;">☀️</div><h2>Welcome Back!</h2><div style="font-size:0.75rem;color:#999;margin-bottom:0.75rem;">Away for ${offlineData.hoursOffline}h</div></div><div style="margin-bottom:0.75rem;">${earningsHtml}</div>${damageHtml}<div style="background:rgba(0,0,0,0.03);border-radius:8px;padding:0.5rem;margin-bottom:0.75rem;font-size:0.8rem;"><div style="display:flex;justify-content:space-between;"><span>Offline Earnings</span><span>💰 ${formatCoins(offlineData.totalEarned)}</span></div>${offlineData.streakBonus>0?`<div style="display:flex;justify-content:space-between;color:var(--coral);"><span>🔥 Streak Bonus</span><span>💰 ${formatCoins(offlineData.streakBonus)}</span></div>`:''}${totalRepair>0?`<div style="display:flex;justify-content:space-between;color:#c00;"><span>🔧 Repairs</span><span>-💰 ${formatCoins(totalRepair)}</span></div>`:''}<div style="display:flex;justify-content:space-between;font-weight:700;border-top:1px solid rgba(0,0,0,0.1);padding-top:0.3rem;margin-top:0.3rem;"><span>Net Total</span><span>💰 ${formatCoins(Math.max(0,netTotal))}</span></div></div><button class="btn" onclick="collectOfflineEarnings(${Math.max(0,netTotal)}, ${!!damage.grandReopening})" style="width:100%;min-height:48px;">${totalRepair>0?'Repair & Collect':'Collect & Play'}</button>`;
    hideAllOverlays();
    showOverlay('hubOverlay');
    return true;
  }

  function collectOfflineEarnings(amount, hasGrandReopening) {
    wallet += amount;
    if (hasGrandReopening) grandReopeningActive = true;
    playSound('coin');
    saveGame();
    showHub();
  }

  // ==========================================
  // STORE HUB
  // ==========================================
  function canUnlockStore(storeId) {
    const config = STORE_CONFIGS[storeId];
    if (!config) return false;
    return prestigeLevel >= config.unlockPrestige && wallet >= config.unlockCost;
  }

  function unlockStore(storeId) {
    const config = STORE_CONFIGS[storeId];
    if (!config || !canUnlockStore(storeId)) return;
    wallet -= config.unlockCost;
    try {
      const empire = JSON.parse(localStorage.getItem('tt_empire') || '{}');
      if (!empire.stores) empire.stores = {};
      empire.stores[storeId] = { unlocked: true, currentDay: 1, upgradeLevels: {}, bestDayRevenue: 0 };
      localStorage.setItem('tt_empire', JSON.stringify(empire)); invalidateEmpireCache();
    } catch(e) {}
    saveGame();
    playSound('upgrade');
    spawnConfetti();
    showHub();
  }

  // First-time tooltips
  const _tooltipsShown = {};
  function showFirstTimeTooltip(key, message) {
    if (_tooltipsShown[key]) return;
    try {
      const empire = getEmpire();
      const seen = (empire.settings || {}).tooltipsSeen || {};
      if (seen[key]) { _tooltipsShown[key] = true; return; }
    } catch(e) {}
    _tooltipsShown[key] = true;
    const tip = document.createElement('div');
    tip.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.85);color:#fff;padding:10px 16px;border-radius:10px;font-size:0.75rem;max-width:300px;text-align:center;z-index:800;animation:fadeIn 0.3s ease;pointer-events:auto;';
    tip.innerHTML = `💡 ${message}<div style="margin-top:6px;font-size:0.6rem;opacity:0.6;">Tap to dismiss</div>`;
    tip.onclick = () => {
      tip.remove();
      try {
        const emp = JSON.parse(localStorage.getItem('tt_empire') || '{}');
        if (!emp.settings) emp.settings = {};
        if (!emp.settings.tooltipsSeen) emp.settings.tooltipsSeen = {};
        emp.settings.tooltipsSeen[key] = true;
        localStorage.setItem('tt_empire', JSON.stringify(emp)); invalidateEmpireCache();
      } catch(e) {}
    };
    document.body.appendChild(tip);
    setTimeout(() => { if (tip.parentNode) tip.remove(); }, 6000);
  }

  function showHub() {
    gameState = 'HUB';
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    hideAllOverlays();
    hudEl.style.display = 'none';
    checkDailyLogin();
    showFirstTimeTooltip('hub', 'Welcome to your Empire Hub! Tap a store to play, or unlock new ones.');
    const unlockedStores = getUnlockedStores();
    const modal = document.getElementById('hubModal');
    let storeCardsHtml = '';
    for (const id of Object.keys(STORE_CONFIGS)) {
      const config = STORE_CONFIGS[id];
      const isUnlocked = unlockedStores.includes(id);
      if (isUnlocked) {
        let empire = {};
        try { empire = JSON.parse(localStorage.getItem('tt_empire') || '{}'); } catch(e) {}
        const storeData = (empire.stores || {})[id] || {};
        const day = storeData.currentDay || 1;
        const mgr = (empire.global || {}).managers && (empire.global.managers[id]);
        const mgrBadge = mgr ? `<div style="font-size:0.6rem;margin-top:2px;">👨‍💼 ${MANAGER_TIERS[mgr.tier]?.name||mgr.tier}</div>` : '';
        storeCardsHtml += `<div style="cursor:pointer;background:linear-gradient(135deg,${config.theme['--cream']},${config.theme['--wall-bottom']});border:2px solid ${id===activeStoreId?config.theme['--gold']:'rgba(0,0,0,0.1)'};border-radius:12px;padding:0.75rem;text-align:center;min-width:100px;" onclick="switchStore('${id}'); showShop();"><div style="font-size:2rem;">${config.emoji}</div><div style="font-size:0.8rem;font-weight:700;color:${config.theme['--brown']};">${config.name}</div><div style="font-size:0.65rem;color:${config.theme['--taupe']};">Day ${day}</div>${mgrBadge}${mgr?'':'<div style="font-size:0.55rem;color:#bbb;margin-top:2px;">No manager</div>'}</div>`;
      } else {
        const canUnlock = canUnlockStore(id);
        const req = config.unlockPrestige > prestigeLevel ? `P${config.unlockPrestige} required` : `💰 ${formatCoins(config.unlockCost)}`;
        storeCardsHtml += `<div style="background:rgba(0,0,0,0.04);border:2px dashed rgba(0,0,0,0.15);border-radius:12px;padding:0.75rem;text-align:center;min-width:100px;opacity:${canUnlock?1:0.5};"><div style="font-size:2rem;filter:grayscale(0.6);">${config.emoji}</div><div style="font-size:0.8rem;font-weight:700;color:#999;">${config.name}</div><div style="font-size:0.6rem;color:#aaa;">${req}</div>${canUnlock?`<button class="btn btn-small" style="margin-top:6px;font-size:0.7rem;min-height:44px;" onclick="event.stopPropagation(); unlockStore('${id}');">Unlock</button>`:'<div style="font-size:0.8rem;margin-top:4px;">🔒</div>'}</div>`;
      }
    }
    modal.innerHTML = `<h2 style="text-align:center;margin-bottom:0.3rem;">👑 Tiny Tycoon Empire</h2><div style="text-align:center;font-size:0.8rem;color:var(--brown);margin-bottom:0.5rem;">💰 ${formatCoins(wallet)}${prestigeLevel>0?` <span style="color:var(--gold);">✨ P${prestigeLevel}</span>`:''}${loginStreak.count>1?` <span style="color:var(--coral);">🔥 ${loginStreak.count}d</span>`:''}</div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:0.5rem;margin-bottom:1rem;">${storeCardsHtml}</div><div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;"><button class="btn btn-small" onclick="switchStore('${activeStoreId}'); showShop();">▶ Play ${STORE_CONFIGS[activeStoreId].name}</button>${prestigeLevel>=2?'<button class="btn btn-secondary btn-small" onclick="showHQ()">🏢 HQ</button>':''}<button class="btn btn-secondary btn-small" onclick="showStats()">📊</button><button class="btn btn-secondary btn-small" onclick="showAchievements()">🏆</button></div>`;
    showOverlay('hubOverlay');
  }

  // ==========================================
  // HQ UPGRADES UI
  // ==========================================
  function showHQ() {
    showFirstTimeTooltip('hq', 'HQ upgrades boost ALL your stores at once. Invest here for empire-wide bonuses!');
    const modal = document.getElementById('hubModal');
    let html = '<h2 style="text-align:center;">🏢 Headquarters</h2><div style="font-size:0.75rem;color:#999;text-align:center;margin-bottom:0.75rem;">Global bonuses for all stores</div>';
    for (const [id, upg] of Object.entries(HQ_UPGRADES)) {
      const level = getHqLevel(id);
      const isMaxed = level >= upg.maxLevel;
      const cost = isMaxed ? '—' : formatCoins(upg.costFn(level));
      const canAfford = !isMaxed && wallet >= upg.costFn(level);
      html += `<div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem;background:rgba(0,0,0,${canAfford?'0.03':'0.01'});border-radius:8px;margin-bottom:0.4rem;"><span style="font-size:1.3rem;">${upg.icon}</span><div style="flex:1;"><div style="font-size:0.8rem;font-weight:700;">${upg.name} ${isMaxed?'<span style="color:var(--gold);">MAX</span>':`Lv${level}`}</div><div style="font-size:0.65rem;color:#888;">${upg.desc}</div></div>${isMaxed?'':`<button class="btn btn-small" ${canAfford?`onclick="buyHqUpgrade('${id}')"`:'disabled'} style="font-size:0.7rem;min-height:44px;opacity:${canAfford?1:0.5};">💰 ${cost}</button>`}</div>`;
    }
    html += '<br><button class="btn btn-secondary btn-small" onclick="showHub()">← Back</button>';
    modal.innerHTML = html;
    hideAllOverlays();
    showOverlay('hubOverlay');
  }

  function buyHqUpgrade(id) {
    const upg = HQ_UPGRADES[id];
    const level = getHqLevel(id);
    if (!upg || level >= upg.maxLevel) return;
    const cost = upg.costFn(level);
    if (wallet < cost) return;
    wallet -= cost;
    try {
      const empire = JSON.parse(localStorage.getItem('tt_empire') || '{}');
      if (!empire.global) empire.global = {};
      if (!empire.global.hqUpgrades) empire.global.hqUpgrades = {};
      empire.global.hqUpgrades[id] = level + 1;
      localStorage.setItem('tt_empire', JSON.stringify(empire)); invalidateEmpireCache();
    } catch(e) {}
    saveGame();
    playSound('upgrade');
    showHQ();
  }

  // ==========================================
  // TIER 2 UPGRADES (per store, in shop)
  // ==========================================
  function renderTier2Tab() {
    if (prestigeLevel < 1) return '';
    showFirstTimeTooltip('tier2', 'Tier 2 unlocked! These advanced upgrades use polynomial pricing — each level costs more.');
    let html = '<div style="margin-top:1rem;border-top:2px solid var(--gold);padding-top:0.75rem;"><h3 style="font-size:0.85rem;color:var(--gold);margin-bottom:0.5rem;">✨ Tier 2 Upgrades</h3>';
    for (const [id, upg] of Object.entries(TIER2_UPGRADES)) {
      const level = getTier2Level(id);
      const isMaxed = level >= upg.maxLevel;
      const cost = isMaxed ? '—' : formatCoins(upg.costFn(level));
      const canAfford = !isMaxed && wallet >= upg.costFn(level);
      html += `<div class="upgrade-card" style="opacity:${canAfford||isMaxed?1:0.6};"><span class="upgrade-icon">${upg.icon}</span><div class="upgrade-info"><div class="upgrade-name">${upg.name} ${isMaxed?'<span style="color:var(--gold);">MAX</span>':`Lv${level}`}</div><div class="upgrade-desc">${upg.desc}</div></div>${isMaxed?'':`<button class="btn btn-small upgrade-btn" ${canAfford?`onclick="buyTier2('${id}')"`:'disabled'} style="opacity:${canAfford?1:0.5};">💰 ${cost}</button>`}</div>`;
    }
    html += '</div>';
    return html;
  }

  function buyTier2(id) {
    const upg = TIER2_UPGRADES[id];
    const level = getTier2Level(id);
    if (!upg || level >= upg.maxLevel) return;
    const cost = upg.costFn(level);
    if (wallet < cost) return;
    wallet -= cost;
    try {
      const empire = JSON.parse(localStorage.getItem('tt_empire') || '{}');
      const store = (empire.stores || {})[activeStoreId];
      if (store) {
        if (!store.tier2Levels) store.tier2Levels = {};
        store.tier2Levels[id] = level + 1;
        localStorage.setItem('tt_empire', JSON.stringify(empire)); invalidateEmpireCache();
      }
    } catch(e) {}
    saveGame();
    playSound('upgrade');
    renderShop();
  }

  // ==========================================
  // DECORATIONS (per store, in shop)
  // ==========================================
  function renderDecorTab() {
    const decos = STORE_DECORATIONS[activeStoreId] || [];
    if (decos.length === 0) return '';
    showFirstTimeTooltip('decor', 'Decorations are cosmetic — they make your shop look great but don\'t affect gameplay. Persist across prestige!');
    const owned = getOwnedDecorations();
    let html = '<div style="margin-top:1rem;border-top:2px solid var(--taro);padding-top:0.75rem;"><h3 style="font-size:0.85rem;color:var(--taro);margin-bottom:0.3rem;">🎨 Decorations</h3><div style="font-size:0.65rem;color:var(--taupe);margin-bottom:0.5rem;">' + owned.length + '/' + decos.length + ' owned</div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:0.5rem;">';
    for (const d of decos) {
      const isOwned = owned.includes(d.id);
      const canAfford = !isOwned && wallet >= d.cost;
      html += `<div style="background:rgba(0,0,0,${isOwned?'0.02':'0.06'});border-radius:8px;padding:0.5rem;text-align:center;opacity:${isOwned||canAfford?1:0.5};"><div style="font-size:1.4rem;margin-bottom:2px;">${d.icon}</div><div style="font-size:0.7rem;font-weight:700;color:var(--brown);">${d.name}</div>${isOwned?'<div style="font-size:0.6rem;color:var(--matcha);font-weight:600;">Owned ✓</div>':`<div style="font-size:0.6rem;color:var(--taupe);margin-top:1px;">💰 ${formatCoins(d.cost)}</div><button class="btn btn-small" ${canAfford?`onclick="buyDecor('${d.id}')"`:'disabled'} style="font-size:0.6rem;margin-top:3px;min-height:44px;opacity:${canAfford?1:0.4};">Buy</button>`}</div>`;
    }
    html += '</div></div>';
    return html;
  }

  function buyDecor(decorId) {
    const decos = STORE_DECORATIONS[activeStoreId] || [];
    const deco = decos.find(d => d.id === decorId);
    if (!deco || wallet < deco.cost) return;
    wallet -= deco.cost;
    try {
      const empire = JSON.parse(localStorage.getItem('tt_empire') || '{}');
      const store = (empire.stores || {})[activeStoreId];
      if (store) {
        if (!store.decorations) store.decorations = [];
        if (!store.decorations.includes(decorId)) store.decorations.push(decorId);
        localStorage.setItem('tt_empire', JSON.stringify(empire)); invalidateEmpireCache();
      }
    } catch(e) {}
    saveGame();
    playSound('upgrade');
    renderShop();
  }

  // ==========================================
  // MANAGER UPGRADES (per manager, in hub)
  // ==========================================
  function showManagerUpgrades(storeId) {
    showFirstTimeTooltip('manager', 'Managers run your stores while you\'re away. Higher tiers earn more offline coins!');
    const managers = getManagers();
    const mgr = managers[storeId];
    if (!mgr) return;
    const config = STORE_CONFIGS[storeId];
    const modal = document.getElementById('hubModal');
    let html = `<h2 style="text-align:center;">${config?.emoji||'🏪'} ${config?.name||storeId} Manager</h2><div style="text-align:center;font-size:0.8rem;color:#888;margin-bottom:0.75rem;">Tier: ${MANAGER_TIERS[mgr.tier]?.name||mgr.tier}</div>`;
    const currentTierKeys = Object.keys(MANAGER_TIERS);
    const currentIdx = currentTierKeys.indexOf(mgr.tier);
    if (currentIdx < currentTierKeys.length - 1) {
      const nextKey = currentTierKeys[currentIdx + 1];
      const nextTier = MANAGER_TIERS[nextKey];
      if (prestigeLevel >= nextTier.minPrestige) {
        const canAfford = wallet >= nextTier.cost;
        html += `<div style="background:rgba(0,0,0,0.04);border-radius:8px;padding:0.5rem;margin-bottom:0.5rem;"><div style="font-size:0.8rem;font-weight:700;">Upgrade to ${nextTier.icon} ${nextTier.name}</div><div style="font-size:0.65rem;color:#888;">Efficiency: ${Math.round(nextTier.efficiency*100)}%</div><button class="btn btn-small" ${canAfford?`onclick="upgradeManagerTier('${storeId}','${nextKey}')"`:'disabled'} style="margin-top:4px;font-size:0.7rem;opacity:${canAfford?1:0.5};">💰 ${formatCoins(nextTier.cost)}</button></div>`;
      }
    }
    const mgrUpgrades = mgr.upgrades || {};
    for (const [id, upg] of Object.entries(MANAGER_UPGRADES)) {
      const isOwned = !!mgrUpgrades[id];
      const canAfford = !isOwned && wallet >= upg.cost;
      html += `<div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem;background:rgba(0,0,0,0.02);border-radius:8px;margin-bottom:0.3rem;opacity:${isOwned||canAfford?1:0.5};"><span style="font-size:1.1rem;">${upg.icon}</span><div style="flex:1;"><div style="font-size:0.75rem;font-weight:600;">${upg.name} ${isOwned?'<span style="color:var(--matcha);">✓</span>':''}</div><div style="font-size:0.6rem;color:#888;">${upg.desc}</div></div>${isOwned?'':`<button class="btn btn-small" ${canAfford?`onclick="buyManagerUpgrade('${storeId}','${id}')"`:'disabled'} style="font-size:0.65rem;min-height:44px;opacity:${canAfford?1:0.5};">💰 ${formatCoins(upg.cost)}</button>`}</div>`;
    }
    html += '<br><button class="btn btn-secondary btn-small" onclick="showHub()">← Back</button>';
    modal.innerHTML = html;
    hideAllOverlays();
    showOverlay('hubOverlay');
  }

  function upgradeManagerTier(storeId, newTier) {
    const tier = MANAGER_TIERS[newTier];
    if (!tier || wallet < tier.cost) return;
    wallet -= tier.cost;
    try {
      const empire = JSON.parse(localStorage.getItem('tt_empire') || '{}');
      if (empire.global?.managers?.[storeId]) {
        empire.global.managers[storeId].tier = newTier;
        localStorage.setItem('tt_empire', JSON.stringify(empire)); invalidateEmpireCache();
      }
    } catch(e) {}
    saveGame();
    playSound('upgrade');
    showManagerUpgrades(storeId);
  }

  function buyManagerUpgrade(storeId, upgradeId) {
    const upg = MANAGER_UPGRADES[upgradeId];
    if (!upg || wallet < upg.cost) return;
    wallet -= upg.cost;
    try {
      const empire = JSON.parse(localStorage.getItem('tt_empire') || '{}');
      if (empire.global?.managers?.[storeId]) {
        if (!empire.global.managers[storeId].upgrades) empire.global.managers[storeId].upgrades = {};
        empire.global.managers[storeId].upgrades[upgradeId] = true;
        localStorage.setItem('tt_empire', JSON.stringify(empire)); invalidateEmpireCache();
      }
    } catch(e) {}
    saveGame();
    playSound('upgrade');
    showManagerUpgrades(storeId);
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
    const hasMultipleStores = getUnlockedStores().length >= 2;
    const hubBtnTitle = hasMultipleStores ? `<button class="btn btn-secondary btn-small" style="margin-top:8px;" onclick="showHub()">🏢 Hub</button>` : '';
    const continueAction = hasMultipleStores ? 'showHub()' : 'showShop()';
    btns.innerHTML = hasSave
      ? `<button class="btn" onclick="${continueAction}">Continue (Day ${currentDay})</button><br>
         <button class="btn btn-secondary btn-small" style="margin-top:8px;" onclick="newGame()">New Game</button>
         ${hubBtnTitle}
         ${statsBtn}
         ${achBtn}
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
    // Show vacation toggle only when 2+ stores (offline exists)
    const vacLabel = document.getElementById('vacationToggleLabel');
    const vacToggle = document.getElementById('vacationToggle');
    if (vacLabel && getUnlockedStores().length >= 2) {
      vacLabel.style.display = 'block';
      const empire = getEmpire();
      vacToggle.checked = !!((empire.settings || {}).vacationMode);
      vacToggle.onchange = () => {
        try {
          const emp = JSON.parse(localStorage.getItem('tt_empire') || '{}');
          if (!emp.settings) emp.settings = {};
          emp.settings.vacationMode = vacToggle.checked;
          localStorage.setItem('tt_empire', JSON.stringify(emp)); invalidateEmpireCache();
        } catch(e) {}
        saveGame();
      };
    } else if (vacLabel) {
      vacLabel.style.display = 'none';
    }
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
  document.addEventListener('contextmenu', (e) => e.preventDefault()); // Prevent long-press menu

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
      onSignIn: async (user) => {
        currentUser = user;
        // Try to load cloud state — if cloud has more progress, reload
        const cloudWasNewer = await loadCloudState();
        if (cloudWasNewer) {
          loadGame();
          showTitle();
        }
      },
      onSignOut: () => { currentUser = null; }
    });
    updateSoundBtn();
  };
  updateShopEnvironment();
  checkDailyLogin();
  const offlineData = calculateOfflineEarnings();
  if (offlineData && showWelcomeBack(offlineData)) {
    // Welcome back screen shown
  } else {
    showTitle();
  }
  // M. Don't start game loop at init - only when entering PLAYING state

  // Expose only functions needed by inline onclick handlers.
  // All other functions are private to the IIFE scope.
  // Note: Client-side games cannot prevent console manipulation —
  // server-side score validation is the real anti-cheat layer.
  const _api = { showShop, renderShop, buyUpgrade, startDay, showTitle, newGame, showStats, showAchievements, shareScore, showPrestigeConfirm, doPrestige, hideAllOverlays, showOverlay, resumeGame, quitToMenu, showHub, switchStore, unlockStore, hireManager, collectOfflineEarnings, showHQ, buyHqUpgrade, buyTier2, buyDecor, showManagerUpgrades, upgradeManagerTier, buyManagerUpgrade };
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
