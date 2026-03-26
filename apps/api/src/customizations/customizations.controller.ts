import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CustomizationsService } from './customizations.service';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { PurchaseItemDto, EquipItemDto, AddCoinsDto } from './dto';
import {
  CustomizationItem,
  UserEquippedItems,
  CoinTransaction,
} from '@weekly-arcade/shared';

@Controller('customizations')
export class CustomizationsController {
  constructor(private readonly customizationsService: CustomizationsService) {}

  // ============ CATALOG (Public) ============

  /**
   * Get all items available for a game
   */
  @Get('catalog/:gameId')
  @Public()
  async getCatalog(@Param('gameId') gameId: string): Promise<{
    items: CustomizationItem[];
    gameId: string;
  }> {
    const items = await this.customizationsService.getCatalog(gameId);
    return { items, gameId };
  }

  // ============ INVENTORY (Auth Required) ============

  /**
   * Get user's inventory (coins + owned items)
   */
  @Get('inventory')
  async getInventory(@CurrentUser() authUser: AuthUser): Promise<{
    coins: number;
    totalCoinsEarned: number;
    items: Array<{
      itemId: string;
      acquiredAt: Date;
      acquiredMethod: string;
      coinsPaid?: number;
    }>;
    ownedItemIds: string[];
  }> {
    return this.customizationsService.getInventory(authUser.uid);
  }

  /**
   * Get equipped items for a specific game
   */
  @Get('equipped/:gameId')
  async getEquipped(
    @CurrentUser() authUser: AuthUser,
    @Param('gameId') gameId: string
  ): Promise<{
    gameId: string;
    equipped: UserEquippedItems;
  }> {
    const equipped = await this.customizationsService.getEquipped(authUser.uid, gameId);
    return { gameId, equipped };
  }

  // ============ PURCHASE (Auth Required) ============

  /**
   * Purchase an item with coins
   */
  @Post('purchase')
  @HttpCode(HttpStatus.OK)
  async purchaseItem(
    @CurrentUser() authUser: AuthUser,
    @Body() purchaseDto: PurchaseItemDto
  ): Promise<{
    success: boolean;
    item: CustomizationItem;
    coinsSpent: number;
    newBalance: number;
    transactionId: string;
  }> {
    return this.customizationsService.purchaseItem(authUser.uid, purchaseDto);
  }

  /**
   * Equip an owned item
   */
  @Post('equip')
  @HttpCode(HttpStatus.OK)
  async equipItem(
    @CurrentUser() authUser: AuthUser,
    @Body() equipDto: EquipItemDto
  ): Promise<{
    success: boolean;
    equipped: UserEquippedItems;
  }> {
    return this.customizationsService.equipItem(authUser.uid, equipDto);
  }

  // ============ COINS (Auth Required) ============

  /**
   * Add coins (from game events)
   * SECURITY: Rate limited to prevent coin flooding from console abuse
   */
  @Post('coins/add')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    short: { limit: 1, ttl: 5000 }, // 1 per 5 seconds
    medium: { limit: 5, ttl: 60000 }, // 5 per minute
    long: { limit: 30, ttl: 3600000 }, // 30 per hour
  })
  async addCoins(
    @CurrentUser() authUser: AuthUser,
    @Body() addCoinsDto: AddCoinsDto
  ): Promise<{
    success: boolean;
    coinsAdded: number;
    newBalance: number;
    transactionId: string;
  }> {
    return this.customizationsService.addCoins(authUser.uid, addCoinsDto);
  }

  /**
   * Get current coin balance
   */
  @Get('coins/balance')
  async getCoinBalance(@CurrentUser() authUser: AuthUser): Promise<{
    coins: number;
    totalCoinsEarned: number;
  }> {
    return this.customizationsService.getCoinBalance(authUser.uid);
  }

  /**
   * Get coin transaction history
   */
  @Get('coins/history')
  async getCoinHistory(
    @CurrentUser() authUser: AuthUser,
    @Query('limit') limit?: string
  ): Promise<{
    transactions: CoinTransaction[];
    totalCount: number;
  }> {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.customizationsService.getCoinHistory(authUser.uid, limitNum);
  }

  // ============ ADMIN ============

  /**
   * Seed catalog to Firestore (for initial setup)
   * In production, this should be protected by admin auth
   */
  @Post('admin/seed-catalog')
  @HttpCode(HttpStatus.OK)
  async seedCatalog(@CurrentUser() authUser: AuthUser): Promise<{ seeded: number }> {
    // TODO: Add admin role check
    return this.customizationsService.seedCatalog();
  }
}
