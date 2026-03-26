import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { GameStateService } from './game-state.service';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { SaveGameStateDto } from './dto';
import { GameState, GAME_REGISTRY, GameInfo } from '@weekly-arcade/shared';

@Controller('games')
export class GameStateController {
  constructor(private readonly gameStateService: GameStateService) {}

  /**
   * Public catalog of all available games (no auth required)
   */
  @Get('catalog')
  @Public()
  getCatalog(): GameInfo[] {
    return GAME_REGISTRY;
  }

  /**
   * Get all game states for the current user
   */
  @Get('states')
  async getAllGameStates(@CurrentUser() authUser: AuthUser): Promise<GameState[]> {
    return this.gameStateService.getAllGameStates(authUser.uid);
  }

  /**
   * Get game state for a specific game
   */
  @Get(':gameId/state')
  async getGameState(
    @CurrentUser() authUser: AuthUser,
    @Param('gameId') gameId: string
  ): Promise<GameState | null> {
    return this.gameStateService.getGameState(authUser.uid, gameId);
  }

  /**
   * Save/update game state for a specific game
   */
  @Put(':gameId/state')
  async saveGameState(
    @CurrentUser() authUser: AuthUser,
    @Param('gameId') gameId: string,
    @Body() saveDto: SaveGameStateDto
  ): Promise<GameState> {
    return this.gameStateService.saveGameState(authUser.uid, gameId, saveDto);
  }

  /**
   * Delete game state for a specific game
   */
  @Delete(':gameId/state')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGameState(
    @CurrentUser() authUser: AuthUser,
    @Param('gameId') gameId: string
  ): Promise<void> {
    return this.gameStateService.deleteGameState(authUser.uid, gameId);
  }
}
