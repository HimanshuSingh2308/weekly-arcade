import { Injectable, Logger } from '@nestjs/common';
import { MultiplayerGameLogic } from '@weekly-arcade/shared';

/**
 * Registry of per-game server-side logic implementations.
 * Future multiplayer games register their logic here at module init.
 */
@Injectable()
export class GameLogicRegistry {
  private readonly logger = new Logger(GameLogicRegistry.name);
  private readonly registry = new Map<string, MultiplayerGameLogic>();

  register(logic: MultiplayerGameLogic): void {
    if (this.registry.has(logic.gameId)) {
      this.logger.warn(`Overwriting game logic for: ${logic.gameId}`);
    }
    this.registry.set(logic.gameId, logic);
    this.logger.log(`Registered game logic: ${logic.gameId}`);
  }

  get(gameId: string): MultiplayerGameLogic | undefined {
    return this.registry.get(gameId);
  }

  has(gameId: string): boolean {
    return this.registry.has(gameId);
  }

  getRegisteredGames(): string[] {
    return Array.from(this.registry.keys());
  }
}
