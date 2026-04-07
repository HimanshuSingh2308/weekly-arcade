'use strict';
/**
 * Drift Legends -- Story Mode
 * Chapter definitions, rival configs, progression tracking, cloud save.
 */
(function () {
  // ─── Chapter Definitions ──────────────────────────────────────────
  const CHAPTERS = [
    {
      id: 1,
      name: 'Street Rookie',
      theme: 'city',
      rival: {
        name: 'Blaze',
        personality: 'aggressive',
        carId: 'street-kart',
        preRaceLine: "You're in the wrong part of town, rookie.",
        defeatLine: "Lucky shot. I'll burn you next time.",
        lostLine: "Told you. Streets are mine.",
      },
      races: ['city-circuit', 'neon-alley', 'blaze-showdown'],
      raceGoals: {
        'city-circuit': [{ type: 'finish', label: 'Finish the race' }],
        'neon-alley': [{ type: 'top3', label: 'Finish in Top 3' }],
        'blaze-showdown': [{ type: 'win', label: 'Beat Blaze (1st place)' }],
      },
      unlockRequirement: null,
      reward: { coins: 200, carUnlock: 'drift-racer', unlockText: 'The city circuit is yours. But Sandstorm rules the desert...' },
      aiSpeedMultiplier: 0.88,
      aiDriftFrequency: 0.2,
      rubberBandCap: 1.15,
    },
    {
      id: 2,
      name: 'Desert Dash',
      theme: 'desert',
      rival: {
        name: 'Sandstorm',
        personality: 'technical',
        carId: 'street-kart',
        preRaceLine: 'Technique beats raw speed every time. Learn that.',
        defeatLine: 'Hmm. You adapted. Interesting.',
        lostLine: 'Precision always wins.',
      },
      races: ['mesa-loop', 'canyon-rush', 'sandstorm-duel'],
      raceGoals: {
        'mesa-loop': [{ type: 'top3', label: 'Finish in Top 3' }],
        'canyon-rush': [{ type: 'top3', label: 'Finish in Top 3' }, { type: 'drift_score', value: 500, label: 'Earn 500 drift points' }],
        'sandstorm-duel': [{ type: 'win', label: 'Beat Sandstorm (1st place)' }],
      },
      unlockRequirement: { chapter: 1, allRacesComplete: true },
      reward: { coins: 300, carUnlock: 'sand-runner', unlockText: 'Desert tamed. But Glacier owns the ice peaks...' },
      aiSpeedMultiplier: 0.92,
      aiDriftFrequency: 0.35,
      rubberBandCap: 1.20,
    },
    {
      id: 3,
      name: 'Frost Circuit',
      theme: 'ice',
      rival: {
        name: 'Glacier',
        personality: 'defensive',
        carId: 'drift-racer',
        preRaceLine: "This is my mountain. You won't pass me.",
        defeatLine: 'The ice shifts for no one... except you, it seems.',
        lostLine: 'Cold and calculated. Every time.',
      },
      races: ['frozen-peaks', 'glacier-gorge', 'ice-crown'],
      raceGoals: {
        'frozen-peaks': [{ type: 'top3', label: 'Finish in Top 3' }, { type: 'clean_lap', label: 'Complete 1 clean lap' }],
        'glacier-gorge': [{ type: 'win', label: 'Win the race' }],
        'ice-crown': [{ type: 'win', label: 'Beat Glacier (1st place)' }, { type: 'stars', value: 2, label: 'Earn 2+ stars' }],
      },
      unlockRequirement: { chapter: 2, allRacesComplete: true },
      reward: { coins: 350, carUnlock: null, unlockText: 'The frost is behind you. Viper lurks in the jungle...' },
      aiSpeedMultiplier: 0.95,
      aiDriftFrequency: 0.5,
      rubberBandCap: 1.18,
    },
    {
      id: 4,
      name: 'Jungle Rush',
      theme: 'jungle',
      rival: {
        name: 'Viper',
        personality: 'dirty',
        carId: 'sand-runner',
        preRaceLine: "I don't play fair. Fair is for losers.",
        defeatLine: 'You survived the jungle? Impressive.',
        lostLine: 'The jungle takes what it wants.',
      },
      races: ['jungle-run', 'ruin-dash', 'vipers-lair'],
      raceGoals: {
        'jungle-run': [{ type: 'win', label: 'Win the race' }, { type: 'drift_score', value: 1000, label: 'Earn 1000 drift points' }],
        'ruin-dash': [{ type: 'win', label: 'Win the race' }, { type: 'clean_lap', label: 'Complete 1 clean lap' }],
        'vipers-lair': [{ type: 'win', label: 'Beat Viper (1st place)' }, { type: 'stars', value: 2, label: 'Earn 2+ stars' }],
      },
      unlockRequirement: { chapter: 3, allRacesComplete: true },
      reward: { coins: 400, carUnlock: null, unlockText: 'The jungle bows to you. One final race stands between you and legend status...' },
      aiSpeedMultiplier: 0.98,
      aiDriftFrequency: 0.65,
      rubberBandCap: 1.15,
    },
    {
      id: 5,
      name: 'Sky Grand Prix',
      theme: 'sky',
      rival: {
        name: 'Apex',
        personality: 'champion',
        carId: 'drift-racer',
        preRaceLine: "I've beaten everyone who's ever sat in that seat. Today is no different.",
        defeatLine: "Drift Legends. That's what they'll call you now.",
        lostLine: 'Not good enough. Not yet.',
      },
      races: ['cloud-circuit', 'grand-prix-qualify', 'apex-final'],
      raceGoals: {
        'cloud-circuit': [{ type: 'win', label: 'Win the race' }, { type: 'drift_score', value: 1500, label: 'Earn 1500 drift points' }],
        'grand-prix-qualify': [{ type: 'win', label: 'Win the race' }, { type: 'clean_lap', label: 'Complete 2 clean laps' }],
        'apex-final': [{ type: 'win', label: 'Beat Apex (1st place)' }, { type: 'stars', value: 3, label: 'Earn 3 stars' }],
      },
      unlockRequirement: { chapter: 4, allRacesComplete: true },
      reward: { coins: 500, carUnlock: null, unlockText: "Drift Legends. That's what they'll call you now." },
      aiSpeedMultiplier: 1.0,
      aiDriftFrequency: 0.8,
      rubberBandCap: 1.10,
    },
  ];

  // ─── Default Progress State ───────────────────────────────────────
  function createDefaultProgress() {
    return {
      coins: 0,
      totalDriftScore: 0,
      mpWins: 0,
      unlockedCars: ['street-kart'],
      raceResults: {},    // { trackId: { bestStars, bestTime, completed, attempts } }
      chaptersUnlocked: [1],
      storyComplete: false,
    };
  }

  // ─── Progression Logic ────────────────────────────────────────────
  function getChapterStars(progress, chapterId) {
    const ch = CHAPTERS.find(c => c.id === chapterId);
    if (!ch) return 0;
    let totalStars = 0;
    ch.races.forEach(trackId => {
      const r = progress.raceResults[trackId];
      if (r) totalStars += r.bestStars || 0;
    });
    return totalStars;
  }

  function getChapterAvgStars(progress, chapterId) {
    const ch = CHAPTERS.find(c => c.id === chapterId);
    if (!ch) return 0;
    let total = 0, count = 0;
    ch.races.forEach(trackId => {
      const r = progress.raceResults[trackId];
      if (r && r.bestStars) { total += r.bestStars; count++; }
    });
    return count > 0 ? total / count : 0;
  }

  function isChapterComplete(progress, chapterId) {
    const ch = CHAPTERS.find(c => c.id === chapterId);
    if (!ch) return false;
    return ch.races.every(trackId => {
      const r = progress.raceResults[trackId];
      return r && r.completed;
    });
  }

  function isChapterUnlocked(progress, chapterId) {
    if (chapterId === 1) return true;
    if (progress.chaptersUnlocked.includes(chapterId)) return true;

    const ch = CHAPTERS.find(c => c.id === chapterId);
    if (!ch || !ch.unlockRequirement) return false;

    const req = ch.unlockRequirement;
    if (!isChapterComplete(progress, req.chapter)) return false;
    if (req.minAvgStars && req.avgStarsChapter !== undefined) {
      if (getChapterAvgStars(progress, req.avgStarsChapter) < req.minAvgStars) return false;
    }
    return true;
  }

  function calculateRaceScore(position, driftScore, cleanLaps, totalLaps) {
    const posPoints = { 1: 100, 2: 70, 3: 50, 4: 30 }[position] || 30;
    const driftBonus = Math.floor(driftScore / 50) * 5;
    const cleanBonus = cleanLaps * 20;
    return posPoints + driftBonus + cleanBonus;
  }

  function calculateStars(raceScore, trackId) {
    const track = window.DriftLegends.TrackBuilder.TRACKS[trackId];
    if (!track) return raceScore >= 180 ? 3 : raceScore >= 100 ? 2 : raceScore >= 30 ? 1 : 0;
    const t = track.starThresholds;
    if (raceScore >= t.three) return 3;
    if (raceScore >= t.two) return 2;
    if (raceScore >= t.one) return 1;
    return 0;
  }

  function calculateCoins(stars) {
    return { 0: 0, 1: 50, 2: 100, 3: 150 }[stars] || 0;
  }

  function isCarUnlockable(progress, carId) {
    if (progress.unlockedCars.includes(carId)) return 'owned';
    if (carId === 'drift-racer') {
      if (isChapterComplete(progress, 1) && progress.coins >= 200) return 'available';
      return 'locked';
    }
    if (carId === 'sand-runner') {
      if (isChapterComplete(progress, 2) && progress.coins >= 300) return 'available';
      return 'locked';
    }
    return 'locked';
  }

  function unlockCar(progress, carId) {
    const cost = { 'drift-racer': 200, 'sand-runner': 300 }[carId] || 0;
    if (progress.coins < cost) return false;
    if (progress.unlockedCars.includes(carId)) return false;
    progress.coins -= cost;
    progress.unlockedCars.push(carId);
    return true;
  }

  // Map local car IDs to backend catalog item IDs
  var CAR_ITEM_IDS = {
    'street-kart': 'dl-car-street-kart',
    'drift-racer': 'dl-car-drift-racer',
    'sand-runner': 'dl-car-sand-runner',
  };

  // Reverse map: backend item ID -> local car ID
  var ITEM_CAR_IDS = {};
  Object.keys(CAR_ITEM_IDS).forEach(function(k) { ITEM_CAR_IDS[CAR_ITEM_IDS[k]] = k; });

  /**
   * Load server inventory (coins + owned car IDs).
   * Returns null if user is not signed in or API is unavailable.
   */
  async function loadServerInventory() {
    try {
      if (!window.apiClient || !window.apiClient.token) return null;
      var inv = await window.apiClient.getInventory();
      if (!inv) return null;
      var ownedCarIds = (inv.ownedItemIds || [])
        .filter(function(id) { return id.startsWith('dl-car-'); })
        .map(function(id) { return ITEM_CAR_IDS[id]; })
        .filter(Boolean);
      // Always include the free default car
      if (ownedCarIds.indexOf('street-kart') === -1) ownedCarIds.push('street-kart');
      return { coins: inv.coins || 0, ownedCarIds: ownedCarIds };
    } catch (_) {
      return null;
    }
  }

  /**
   * Purchase a car via the backend API.
   * Returns { success, newBalance } or null on failure.
   */
  async function purchaseCarFromServer(carId) {
    try {
      if (!window.apiClient || !window.apiClient.token) return null;
      var itemId = CAR_ITEM_IDS[carId];
      if (!itemId) return null;
      var result = await window.apiClient.purchaseItem(itemId);
      if (result && result.success) {
        return { success: true, newBalance: result.newBalance, coinsSpent: result.coinsSpent };
      }
      return null;
    } catch (e) {
      console.warn('[StoryMode] Server purchase failed:', e.message);
      return null;
    }
  }

  /**
   * Merge server inventory into local progress.
   * Adds any server-owned cars not yet in local progress.
   */
  function mergeServerInventory(progress, serverInv) {
    if (!serverInv) return progress;
    // Use the higher of local vs server coins (server may lag behind local earnings)
    progress.coins = Math.max(progress.coins || 0, serverInv.coins || 0);
    // Merge owned cars
    serverInv.ownedCarIds.forEach(function(carId) {
      if (progress.unlockedCars.indexOf(carId) === -1) {
        progress.unlockedCars.push(carId);
      }
    });
    return progress;
  }

  function getCompletionPercent(progress) {
    let completed = 0;
    let total = 0;
    CHAPTERS.forEach(ch => {
      ch.races.forEach(trackId => {
        total++;
        if (progress.raceResults[trackId]?.completed) completed++;
      });
    });
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }

  function getGoalsForRace(chapterId, trackId) {
    var ch = CHAPTERS.find(function(c) { return c.id === chapterId; });
    if (!ch || !ch.raceGoals) return [{ type: 'finish', label: 'Finish the race' }];
    return ch.raceGoals[trackId] || [{ type: 'finish', label: 'Finish the race' }];
  }

  function checkGoals(goals, result) {
    // result: { position, stars, driftScore, cleanLaps, totalLaps }
    return goals.map(function(g) {
      var passed = false;
      switch (g.type) {
        case 'finish': passed = true; break;
        case 'top3': passed = result.position <= 3; break;
        case 'win': passed = result.position === 1; break;
        case 'drift_score': passed = result.driftScore >= (g.value || 0); break;
        case 'clean_lap': passed = result.cleanLaps >= 1; break;
        case 'stars': passed = result.stars >= (g.value || 1); break;
        default: passed = true;
      }
      return { label: g.label, type: g.type, passed: passed };
    });
  }

  // ─── Cloud Save ───────────────────────────────────────────────────
  const SAVE_KEY = 'dl-progress';

  function loadLocalProgress() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : createDefaultProgress();
    } catch (_) {
      return createDefaultProgress();
    }
  }

  function saveLocalProgress(progress) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
    } catch (_) { /* ignore */ }
  }

  async function loadCloudProgress() {
    try {
      if (!window.apiClient) return null;
      const state = await window.apiClient.getGameState('drift-legends');
      // Full progress is stored in additionalData
      if (state && state.additionalData) return state.additionalData;
      return state || null;
    } catch (_) { return null; }
  }

  async function saveCloudProgress(progress) {
    try {
      if (!window.apiClient) return;
      // Map to standard API game state format (API rejects unknown top-level fields)
      var totalRaces = 0, totalWins = 0;
      Object.values(progress.raceResults || {}).forEach(function(r) {
        totalRaces += (r.attempts || 0);
        if (r.completed) totalWins++;
      });
      var maxChapter = 1;
      (progress.chaptersUnlocked || []).forEach(function(c) { if (c > maxChapter) maxChapter = c; });
      await window.apiClient.saveGameState('drift-legends', {
        currentLevel: maxChapter,
        currentStreak: 0,
        bestStreak: 0,
        gamesPlayed: totalRaces,
        gamesWon: totalWins,
        additionalData: progress,
      });
    } catch (_) { /* ignore cloud save errors */ }
  }

  function mergeProgress(local, cloud) {
    if (!cloud) return local;
    // Take the better of each value
    const merged = { ...local };
    merged.coins = Math.max(local.coins, cloud.coins || 0);
    merged.totalDriftScore = Math.max(local.totalDriftScore, cloud.totalDriftScore || 0);
    merged.mpWins = Math.max(local.mpWins, cloud.mpWins || 0);

    // Merge unlocked cars
    (cloud.unlockedCars || []).forEach(c => {
      if (!merged.unlockedCars.includes(c)) merged.unlockedCars.push(c);
    });

    // Merge race results (best of each)
    Object.keys(cloud.raceResults || {}).forEach(trackId => {
      const cr = cloud.raceResults[trackId];
      const lr = merged.raceResults[trackId];
      if (!lr) {
        merged.raceResults[trackId] = cr;
      } else {
        merged.raceResults[trackId] = {
          bestStars: Math.max(lr.bestStars || 0, cr.bestStars || 0),
          bestTime: lr.bestTime && cr.bestTime ? Math.min(lr.bestTime, cr.bestTime) : (lr.bestTime || cr.bestTime),
          completed: lr.completed || cr.completed,
          attempts: Math.max(lr.attempts || 0, cr.attempts || 0),
        };
      }
    });

    // Merge unlocked chapters
    (cloud.chaptersUnlocked || []).forEach(ch => {
      if (!merged.chaptersUnlocked.includes(ch)) merged.chaptersUnlocked.push(ch);
    });

    merged.storyComplete = local.storyComplete || cloud.storyComplete || false;
    return merged;
  }

  window.DriftLegends = window.DriftLegends || {};
  window.DriftLegends.StoryMode = {
    CHAPTERS,
    createDefaultProgress,
    getChapterStars,
    getChapterAvgStars,
    isChapterComplete,
    isChapterUnlocked,
    calculateRaceScore,
    calculateStars,
    calculateCoins,
    isCarUnlockable,
    unlockCar,
    getCompletionPercent,
    getGoalsForRace,
    checkGoals,
    loadLocalProgress,
    saveLocalProgress,
    loadCloudProgress,
    saveCloudProgress,
    mergeProgress,
    CAR_ITEM_IDS,
    loadServerInventory,
    purchaseCarFromServer,
    mergeServerInventory,
  };
})();
