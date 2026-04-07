import { CustomizationItem } from '../types/customization.types.js';

// ============ DRIFT LEGENDS CAR CATALOG ============

export const DRIFT_LEGENDS_CARS: CustomizationItem[] = [
  {
    id: 'dl-car-street-kart',
    type: 'ship',
    gameId: 'drift-legends',
    name: 'Street Kart',
    description: 'Your first ride. Nimble and forgiving — perfect for learning the streets.',
    icon: '\uD83D\uDE97',
    rarity: 'common',
    unlockMethod: 'free',
    unlockRequirement: { freeDefault: true },
    visualData: {
      carId: 'street-kart',
    },
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'dl-car-drift-racer',
    type: 'ship',
    gameId: 'drift-legends',
    name: 'Drift Racer',
    description: 'Tuned for drifting. Higher top speed, tighter handling.',
    icon: '\uD83C\uDFCE\uFE0F',
    rarity: 'rare',
    unlockMethod: 'coins',
    unlockRequirement: { coinCost: 200 },
    visualData: {
      carId: 'drift-racer',
    },
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'dl-car-sand-runner',
    type: 'ship',
    gameId: 'drift-legends',
    name: 'Sand Runner',
    description: 'Desert-hardened off-roader. Excellent grip on loose surfaces.',
    icon: '\uD83D\uDE99',
    rarity: 'rare',
    unlockMethod: 'coins',
    unlockRequirement: { coinCost: 300 },
    visualData: {
      carId: 'sand-runner',
    },
    isActive: true,
    sortOrder: 3,
  },
];

// Combined catalog for easy access
export const DRIFT_LEGENDS_ALL_ITEMS: CustomizationItem[] = [
  ...DRIFT_LEGENDS_CARS,
];
