import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import {
  CustomizationItem,
  UserInventoryItem,
  UserEquippedItems,
  CoinTransaction,
  CoinTransactionType,
  ItemType,
  VOIDBREAK_ALL_ITEMS,
} from '@weekly-arcade/shared';
import { PurchaseItemDto, EquipItemDto, AddCoinsDto } from './dto';
import { v4 as uuidv4 } from 'uuid';

interface UserInventoryDoc {
  odId: string;
  coins: number;
  totalCoinsEarned: number;
  updatedAt: Date;
}

@Injectable()
export class CustomizationsService {
  private readonly logger = new Logger(CustomizationsService.name);

  // Collection names
  private readonly itemsCollection = 'customizationItems';
  private readonly inventoryCollection = 'userInventory';
  private readonly equippedCollection = 'userEquipped';
  private readonly transactionsCollection = 'coinTransactions';

  // In-memory item catalog (loaded from constants, can be augmented from Firestore)
  private itemCatalog: Map<string, CustomizationItem> = new Map();

  constructor(private readonly firebaseService: FirebaseService) {
    // Initialize catalog from constants
    this.initializeCatalog();
  }

  private initializeCatalog() {
    // Load Voidbreak items from constants
    for (const item of VOIDBREAK_ALL_ITEMS) {
      this.itemCatalog.set(item.id, item);
    }
    this.logger.log(`Loaded ${this.itemCatalog.size} items into catalog`);
  }

  // ============ CATALOG ============

  async getCatalog(gameId: string): Promise<CustomizationItem[]> {
    // Filter by gameId and active status
    const items = Array.from(this.itemCatalog.values())
      .filter((item) => item.gameId === gameId && item.isActive)
      .sort((a, b) => {
        // Sort by type, then sortOrder
        if (a.type !== b.type) return a.type.localeCompare(b.type);
        return a.sortOrder - b.sortOrder;
      });

    return items;
  }

  getItem(itemId: string): CustomizationItem | undefined {
    return this.itemCatalog.get(itemId);
  }

  // ============ INVENTORY ============

  async getInventory(uid: string): Promise<{
    coins: number;
    totalCoinsEarned: number;
    items: UserInventoryItem[];
    ownedItemIds: string[];
  }> {
    // Get user inventory document
    const inventoryDoc = await this.firebaseService
      .doc(`${this.inventoryCollection}/${uid}`)
      .get();

    let coins = 0;
    let totalCoinsEarned = 0;

    if (inventoryDoc.exists) {
      const data = inventoryDoc.data() as UserInventoryDoc;
      coins = data.coins || 0;
      totalCoinsEarned = data.totalCoinsEarned || 0;
    }

    // Get owned items subcollection
    const itemsSnapshot = await this.firebaseService
      .collection(`${this.inventoryCollection}/${uid}/items`)
      .get();

    const items: UserInventoryItem[] = itemsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        itemId: data.itemId,
        acquiredAt: data.acquiredAt?.toDate ? data.acquiredAt.toDate() : new Date(data.acquiredAt),
        acquiredMethod: data.acquiredMethod,
        coinsPaid: data.coinsPaid,
        transactionId: data.transactionId,
        metadata: data.metadata,
      };
    });

    const ownedItemIds = items.map((item) => item.itemId);

    // Add free items to owned list
    const freeItems = Array.from(this.itemCatalog.values())
      .filter((item) => item.unlockMethod === 'free' && item.unlockRequirement.freeDefault)
      .map((item) => item.id);

    const allOwnedIds = [...new Set([...ownedItemIds, ...freeItems])];

    return {
      coins,
      totalCoinsEarned,
      items,
      ownedItemIds: allOwnedIds,
    };
  }

  async getCoinBalance(uid: string): Promise<{ coins: number; totalCoinsEarned: number }> {
    const inventoryDoc = await this.firebaseService
      .doc(`${this.inventoryCollection}/${uid}`)
      .get();

    if (!inventoryDoc.exists) {
      return { coins: 0, totalCoinsEarned: 0 };
    }

    const data = inventoryDoc.data() as UserInventoryDoc;
    return {
      coins: data.coins || 0,
      totalCoinsEarned: data.totalCoinsEarned || 0,
    };
  }

  // ============ PURCHASE ============

  async purchaseItem(
    uid: string,
    purchaseDto: PurchaseItemDto
  ): Promise<{
    success: boolean;
    item: CustomizationItem;
    coinsSpent: number;
    newBalance: number;
    transactionId: string;
  }> {
    const { itemId } = purchaseDto;

    // Get item from catalog
    const item = this.itemCatalog.get(itemId);
    if (!item) {
      throw new NotFoundException(`Item not found: ${itemId}`);
    }

    // Check unlock method
    if (item.unlockMethod !== 'coins') {
      throw new BadRequestException(`Item ${itemId} cannot be purchased with coins`);
    }

    const coinCost = item.unlockRequirement.coinCost;
    if (!coinCost || coinCost <= 0) {
      throw new BadRequestException(`Item ${itemId} has no valid coin cost`);
    }

    // Use Firestore transaction to prevent double-spend race condition
    const transactionId = uuidv4();
    const now = new Date();

    const inventoryRef = this.firebaseService.doc(`${this.inventoryCollection}/${uid}`);
    const itemRef = this.firebaseService.doc(
      `${this.inventoryCollection}/${uid}/items/${itemId}`
    );
    const txRef = this.firebaseService.doc(`${this.transactionsCollection}/${transactionId}`);

    const newBalance = await this.firebaseService.runTransaction(async (transaction) => {
      // Read inside transaction — guarantees consistent snapshot
      const [inventoryDoc, existingItem] = await Promise.all([
        transaction.get(inventoryRef),
        transaction.get(itemRef),
      ]);

      if (existingItem.exists) {
        throw new BadRequestException(`You already own ${item.name}`);
      }

      const currentBalance = inventoryDoc.exists
        ? (inventoryDoc.data() as UserInventoryDoc).coins || 0
        : 0;

      if (currentBalance < coinCost) {
        throw new BadRequestException(
          `Insufficient coins. Need ${coinCost}, have ${currentBalance}`
        );
      }

      const balance = currentBalance - coinCost;

      // All writes inside transaction — atomic
      transaction.set(inventoryRef, {
        odId: uid,
        coins: balance,
        updatedAt: now,
      }, { merge: true });

      transaction.set(itemRef, {
        itemId,
        acquiredAt: now,
        acquiredMethod: 'coins',
        coinsPaid: coinCost,
        transactionId,
      });

      transaction.set(txRef, {
        id: transactionId,
        odId: uid,
        amount: -coinCost,
        type: 'purchase' as CoinTransactionType,
        gameId: item.gameId,
        itemId,
        description: `Purchased ${item.name}`,
        balanceAfter: balance,
        createdAt: now,
      });

      return balance;
    });

    this.logger.log(`User ${uid} purchased ${item.name} for ${coinCost} coins`);

    return {
      success: true,
      item,
      coinsSpent: coinCost,
      newBalance,
      transactionId,
    };
  }

  // ============ EQUIP ============

  async getEquipped(uid: string, gameId: string): Promise<UserEquippedItems> {
    const doc = await this.firebaseService
      .doc(`${this.equippedCollection}/${uid}/games/${gameId}`)
      .get();

    if (!doc.exists) {
      // Return defaults
      return this.getDefaultEquipped(gameId);
    }

    const data = doc.data();
    return {
      ship: data?.ship || undefined,
      trail: data?.trail || undefined,
      bullet: data?.bullet || undefined,
      hud: data?.hud || undefined,
      class: data?.class || undefined,
    };
  }

  private getDefaultEquipped(gameId: string): UserEquippedItems {
    // Get free default items for the game
    const defaults: UserEquippedItems = {};
    const gameItems = Array.from(this.itemCatalog.values()).filter(
      (item) =>
        item.gameId === gameId &&
        item.unlockMethod === 'free' &&
        item.unlockRequirement.freeDefault
    );

    for (const item of gameItems) {
      if (item.sortOrder === 1) {
        // First item in each category is default
        defaults[item.type] = item.id;
      }
    }

    return defaults;
  }

  async equipItem(
    uid: string,
    equipDto: EquipItemDto
  ): Promise<{ success: boolean; equipped: UserEquippedItems }> {
    const { gameId, itemType, itemId } = equipDto;

    // If itemId is provided (not unequipping), verify ownership
    if (itemId) {
      const item = this.itemCatalog.get(itemId);
      if (!item) {
        throw new NotFoundException(`Item not found: ${itemId}`);
      }

      if (item.gameId !== gameId) {
        throw new BadRequestException(`Item ${itemId} is not for game ${gameId}`);
      }

      if (item.type !== itemType) {
        throw new BadRequestException(`Item ${itemId} is not a ${itemType}`);
      }

      // Check ownership (free items are always owned)
      const isFreeDefault = item.unlockMethod === 'free' && item.unlockRequirement.freeDefault;
      if (!isFreeDefault) {
        const ownedDoc = await this.firebaseService
          .doc(`${this.inventoryCollection}/${uid}/items/${itemId}`)
          .get();

        if (!ownedDoc.exists) {
          throw new ForbiddenException(`You don't own ${item.name}`);
        }
      }
    }

    // Update equipped items
    const docRef = this.firebaseService.doc(
      `${this.equippedCollection}/${uid}/games/${gameId}`
    );

    await docRef.set(
      {
        [itemType]: itemId || null,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    // Get updated equipped state
    const equipped = await this.getEquipped(uid, gameId);

    this.logger.log(`User ${uid} equipped ${itemId || 'nothing'} as ${itemType} for ${gameId}`);

    return { success: true, equipped };
  }

  // ============ COINS ============

  async addCoins(
    uid: string,
    addCoinsDto: AddCoinsDto
  ): Promise<{
    success: boolean;
    coinsAdded: number;
    newBalance: number;
    transactionId: string;
  }> {
    const { amount, type, gameId, description, metadata } = addCoinsDto;

    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    // Get current balance
    const inventoryDoc = await this.firebaseService
      .doc(`${this.inventoryCollection}/${uid}`)
      .get();

    let currentBalance = 0;
    let totalEarned = 0;

    if (inventoryDoc.exists) {
      const data = inventoryDoc.data() as UserInventoryDoc;
      currentBalance = data.coins || 0;
      totalEarned = data.totalCoinsEarned || 0;
    }

    const newBalance = currentBalance + amount;
    const newTotalEarned = totalEarned + amount;
    const transactionId = uuidv4();
    const now = new Date();

    // Batch write
    const batch = this.firebaseService.batch();

    // Update inventory
    const inventoryRef = this.firebaseService.doc(`${this.inventoryCollection}/${uid}`);
    batch.set(
      inventoryRef,
      {
        odId: uid,
        coins: newBalance,
        totalCoinsEarned: newTotalEarned,
        updatedAt: now,
      },
      { merge: true }
    );

    // Record transaction
    const txRef = this.firebaseService.doc(`${this.transactionsCollection}/${transactionId}`);
    batch.set(txRef, {
      id: transactionId,
      odId: uid,
      amount,
      type,
      gameId,
      description,
      balanceAfter: newBalance,
      createdAt: now,
      metadata: metadata || {},
    });

    await batch.commit();

    this.logger.log(`User ${uid} earned ${amount} coins: ${description}`);

    return {
      success: true,
      coinsAdded: amount,
      newBalance,
      transactionId,
    };
  }

  async getCoinHistory(
    uid: string,
    limit = 50,
    startAfter?: string
  ): Promise<{ transactions: CoinTransaction[]; totalCount: number }> {
    let query = this.firebaseService
      .collection(this.transactionsCollection)
      .where('odId', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (startAfter) {
      query = query.startAfter(new Date(startAfter));
    }

    const snapshot = await query.get();

    const transactions: CoinTransaction[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: data.id,
        odId: data.odId,
        amount: data.amount,
        type: data.type,
        gameId: data.gameId,
        itemId: data.itemId,
        description: data.description,
        balanceAfter: data.balanceAfter,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        metadata: data.metadata,
      };
    });

    return {
      transactions,
      totalCount: transactions.length,
    };
  }

  // ============ ADMIN / SEEDING ============

  async seedCatalog(): Promise<{ seeded: number }> {
    const batch = this.firebaseService.batch();
    let count = 0;

    for (const item of VOIDBREAK_ALL_ITEMS) {
      const docRef = this.firebaseService.doc(`${this.itemsCollection}/${item.id}`);
      batch.set(docRef, {
        ...item,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      count++;
    }

    await batch.commit();
    this.logger.log(`Seeded ${count} items to Firestore`);

    return { seeded: count };
  }
}
