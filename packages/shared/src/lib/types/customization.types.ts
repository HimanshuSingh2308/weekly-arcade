// ============ CUSTOMIZATION SYSTEM TYPES ============

// Enums as union types for flexibility
export type ItemType = 'ship' | 'trail' | 'bullet' | 'hud' | 'class';
export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type UnlockMethod = 'coins' | 'xp' | 'achievement' | 'free';
export type AcquireMethod = 'coins' | 'xp' | 'achievement' | 'gift' | 'iap';
export type CoinTransactionType = 'game_reward' | 'achievement' | 'purchase' | 'iap' | 'refund' | 'admin';

// ============ ITEM CATALOG ============

export interface UnlockRequirement {
  coinCost?: number;
  xpCost?: number;
  achievementId?: string;
  freeDefault?: boolean;
}

export interface CustomizationItem {
  id: string;
  type: ItemType;
  gameId: string;
  name: string;
  description: string;
  icon: string;
  rarity: ItemRarity;
  unlockMethod: UnlockMethod;
  unlockRequirement: UnlockRequirement;
  visualData: Record<string, unknown>;
  isActive: boolean;
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============ USER INVENTORY ============

export interface UserInventoryItem {
  itemId: string;
  acquiredAt: Date;
  acquiredMethod: AcquireMethod;
  coinsPaid?: number;
  transactionId?: string;
  metadata?: Record<string, unknown>;
}

export interface UserInventory {
  odId: string;
  coins: number;
  totalCoinsEarned: number;
  updatedAt: Date;
  items: UserInventoryItem[];
}

// ============ EQUIPPED ITEMS ============

export interface UserEquippedItems {
  ship?: string;
  trail?: string;
  bullet?: string;
  hud?: string;
  class?: string;
  updatedAt?: Date;
}

// ============ COIN TRANSACTIONS ============

export interface CoinTransaction {
  id: string;
  odId: string;
  amount: number;
  type: CoinTransactionType;
  gameId?: string;
  itemId?: string;
  description: string;
  balanceAfter: number;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

// ============ API DTOs ============

export interface PurchaseItemDto {
  itemId: string;
}

export interface PurchaseItemResult {
  success: boolean;
  item: CustomizationItem;
  coinsSpent: number;
  newBalance: number;
  transactionId: string;
}

export interface EquipItemDto {
  gameId: string;
  itemType: ItemType;
  itemId: string | null; // null to unequip
}

export interface EquipItemResult {
  success: boolean;
  equipped: UserEquippedItems;
}

export interface AddCoinsDto {
  amount: number;
  type: CoinTransactionType;
  gameId: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface AddCoinsResult {
  success: boolean;
  coinsAdded: number;
  newBalance: number;
  transactionId: string;
}

export interface CoinBalanceResult {
  coins: number;
  totalCoinsEarned: number;
}

export interface CoinHistoryResult {
  transactions: CoinTransaction[];
  totalCount: number;
}

export interface CatalogResult {
  items: CustomizationItem[];
  gameId: string;
}

export interface InventoryResult {
  coins: number;
  totalCoinsEarned: number;
  items: UserInventoryItem[];
  ownedItemIds: string[];
}

export interface EquippedResult {
  gameId: string;
  equipped: UserEquippedItems;
}
