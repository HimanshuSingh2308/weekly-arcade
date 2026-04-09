import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Req,
  Param,
  Query,
  HttpCode,
} from '@nestjs/common';
import { MatchmakingService } from './matchmaking.service';
import { FirebaseService } from '../firebase/firebase.service';
import { FindMatchDto } from './dto/join-session.dto';

@Controller('multiplayer/matchmaking')
export class MatchmakingController {
  constructor(
    private readonly matchmakingService: MatchmakingService,
    private readonly firebase: FirebaseService,
  ) {}

  @Post('find')
  async findMatch(@Req() req: any, @Body() dto: FindMatchDto) {
    const { uid, displayName, avatarUrl } = req.user;
    return this.matchmakingService.findMatch(uid, displayName || 'Player', avatarUrl || null, dto.gameId);
  }

  @Delete('cancel')
  @HttpCode(200)
  async cancelMatchmaking(@Req() req: any) {
    await this.matchmakingService.cancelMatchmaking(req.user.uid);
    return { success: true };
  }

  @Get('status')
  async getStatus(@Req() req: any) {
    return this.matchmakingService.getStatus(req.user.uid);
  }

  @Get('rating/:gameId')
  async getRating(@Req() req: any, @Param('gameId') gameId: string) {
    const rating = await this.matchmakingService.getPlayerRating(req.user.uid, gameId);
    const gameRatingDoc = await this.matchmakingService.getPlayerRatingStats(req.user.uid, gameId);
    return {
      rating,
      wins: gameRatingDoc?.won || gameRatingDoc?.wins || 0,
      losses: gameRatingDoc?.lost || gameRatingDoc?.losses || 0,
      draws: gameRatingDoc?.drawn || gameRatingDoc?.draws || 0,
      gamesPlayed: gameRatingDoc?.played || gameRatingDoc?.gamesPlayed || 0,
    };
  }

  @Get('history/:gameId')
  async getMatchHistory(
    @Req() req: any,
    @Param('gameId') gameId: string,
    @Query('limit') limit?: string,
  ) {
    const uid = req.user.uid;
    const maxResults = Math.min(parseInt(limit || '20', 10) || 20, 50);

    const snapshot = await this.firebase
      .collection('matchResults')
      .where('gameId', '==', gameId)
      .where('playerUids', 'array-contains', uid)
      .orderBy('finishedAt', 'desc')
      .limit(maxResults)
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      const myResult = data.players?.[uid];
      // Find opponent
      let opponentName = 'Unknown';
      let opponentUid = null;
      for (const [pUid, pData] of Object.entries(data.players || {})) {
        if (pUid !== uid) {
          opponentUid = pUid;
          opponentName = (pData as any).displayName || 'Player';
        }
      }
      return {
        sessionId: data.sessionId,
        gameId: data.gameId,
        finishedAt: data.finishedAt?.toDate?.() || data.finishedAt,
        outcome: myResult?.outcome || 'unknown',
        myRatingBefore: myResult?.ratingBefore,
        myRatingAfter: myResult?.ratingAfter,
        ratingChange: myResult?.ratingChange || 0,
        opponentName,
        opponentUid,
      };
    });
  }
}
