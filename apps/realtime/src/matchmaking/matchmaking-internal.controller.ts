import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { MatchmakingGateway } from './matchmaking.gateway';

@Controller('internal/matchmaking')
export class MatchmakingInternalController {
  constructor(private readonly matchmakingGateway: MatchmakingGateway) {}

  /**
   * Called by the API when a match is found (from findMatch or cron).
   * Pushes the match notification instantly to connected players via WebSocket.
   */
  @Post('notify-match')
  notifyMatch(
    @Headers('x-internal-key') apiKey: string,
    @Body() payload: { uid1: string; uid2: string; sessionId: string },
  ) {
    const expectedKey = process.env.INTERNAL_API_KEY;
    if (!expectedKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid internal API key');
    }

    this.matchmakingGateway.notifyMatch(payload.uid1, payload.uid2, payload.sessionId);
    return { notified: true };
  }
}
