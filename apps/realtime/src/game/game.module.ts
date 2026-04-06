import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GameStateManager } from './game-state.manager';
import { GameRoomManager } from './game-room.manager';
import { GameLogicRegistry } from './game-logic.registry';
import { Chess3dLogic } from './game-logic/chess-3d.logic';
import { DriftLegendsLogic } from './game-logic/drift-legends.logic';

@Module({
  providers: [
    GameGateway,
    GameStateManager,
    GameRoomManager,
    GameLogicRegistry,
    Chess3dLogic,
    DriftLegendsLogic,
  ],
  exports: [GameLogicRegistry, GameStateManager, GameRoomManager],
})
export class GameModule {}
