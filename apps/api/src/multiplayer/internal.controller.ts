import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { MatchmakingService } from './matchmaking.service';
import { MatchResult, MatchPlayerResult } from '@weekly-arcade/shared';
import { Public } from '../auth/decorators/public.decorator';
import { MULTIPLAYER_DEFAULTS } from './config/multiplayer-defaults';

interface GameResultsPayload {
  sessionId: string;
  gameId: string;
  results: Record<string, { score: number; rank: number; outcome: 'win' | 'loss' | 'draw' }>;
  reason: string;
}

/**
 * Internal endpoints called by the Realtime service.
 * Protected by a shared API key, not Firebase Auth.
 */
@Controller('internal')
export class InternalController {
  private readonly logger = new Logger(InternalController.name);

  constructor(
    private readonly firebase: FirebaseService,
    private readonly matchmakingService: MatchmakingService,
  ) {}

  @Post('game-results')
  @Public() // Bypass Firebase Auth — uses internal API key instead
  async handleGameResults(
    @Headers('x-internal-key') apiKey: string,
    @Body() payload: GameResultsPayload,
  ) {
    const expectedKey = process.env.INTERNAL_API_KEY;
    if (!expectedKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid internal API key');
    }

    const { sessionId, gameId, results, reason } = payload;
    this.logger.log(`Processing game results: session=${sessionId} reason=${reason}`);

    // Calculate ELO changes for each player pair
    const uids = Object.keys(results);
    const playerResults: Record<string, MatchPlayerResult> = {};

    // Fetch current ratings
    const userDocs = await this.firebase.getAll(
      ...uids.map(uid => this.firebase.doc(`users/${uid}`) as FirebaseFirestore.DocumentReference),
    );

    const ratings: Record<string, number> = {};
    for (const doc of userDocs) {
      if (doc.exists) {
        ratings[doc.id] = doc.data()?.multiplayerRating ?? MULTIPLAYER_DEFAULTS.DEFAULT_RATING;
      }
    }

    // Calculate new ratings (pairwise for N-player)
    const ratingChanges: Record<string, number> = {};
    for (const uid of uids) {
      ratingChanges[uid] = 0;
    }

    for (let i = 0; i < uids.length; i++) {
      for (let j = i + 1; j < uids.length; j++) {
        const uidA = uids[i];
        const uidB = uids[j];
        const rA = ratings[uidA] ?? MULTIPLAYER_DEFAULTS.DEFAULT_RATING;
        const rB = ratings[uidB] ?? MULTIPLAYER_DEFAULTS.DEFAULT_RATING;

        const outcomeA = results[uidA].outcome;
        if (outcomeA === 'win') {
          const elo = this.matchmakingService.calculateElo(rA, rB);
          ratingChanges[uidA] += elo.winnerNew - rA;
          ratingChanges[uidB] += elo.loserNew - rB;
        } else if (outcomeA === 'loss') {
          const elo = this.matchmakingService.calculateElo(rB, rA);
          ratingChanges[uidB] += elo.winnerNew - rB;
          ratingChanges[uidA] += elo.loserNew - rA;
        }
        // Draw: no ELO change
      }
    }

    // Average pairwise changes for N-player
    const pairCount = Math.max(1, uids.length - 1);
    for (const uid of uids) {
      ratingChanges[uid] = Math.round(ratingChanges[uid] / pairCount);
    }

    // Build match result and update users
    const batch = this.firebase.batch();

    for (const uid of uids) {
      const ratingBefore = ratings[uid] ?? MULTIPLAYER_DEFAULTS.DEFAULT_RATING;
      const ratingAfter = Math.max(MULTIPLAYER_DEFAULTS.RATING_FLOOR, ratingBefore + ratingChanges[uid]);

      playerResults[uid] = {
        displayName: '', // Could fetch from user doc
        score: results[uid].score,
        rank: results[uid].rank,
        outcome: results[uid].outcome,
        ratingBefore,
        ratingAfter,
        ratingChange: ratingAfter - ratingBefore,
      };

      // Update user rating and stats
      const statsField = results[uid].outcome === 'win' ? 'multiplayerStats.won'
        : results[uid].outcome === 'loss' ? 'multiplayerStats.lost'
        : 'multiplayerStats.drawn';

      batch.update(this.firebase.doc(`users/${uid}`) as FirebaseFirestore.DocumentReference, {
        multiplayerRating: ratingAfter,
        'multiplayerStats.played': FirebaseFirestore.FieldValue.increment(1),
        [statsField]: FirebaseFirestore.FieldValue.increment(1),
      });
    }

    // Store match result
    const matchResult: MatchResult = {
      gameId,
      sessionId,
      players: playerResults,
      durationSec: 0, // TODO: calculate from session timestamps
      totalTurns: 0,
      finishedAt: new Date(),
    };

    batch.set(this.firebase.doc(`matchResults/${sessionId}`) as FirebaseFirestore.DocumentReference, matchResult);
    await batch.commit();

    // Submit leaderboard scores server-side for each player
    // This prevents client-side score manipulation in multiplayer
    for (const uid of uids) {
      const pr = playerResults[uid];
      try {
        await this.firebase.collection('scores').add({
          uid,
          gameId,
          score: pr.ratingAfter,
          timeMs: 0, // Not tracked per-player in multiplayer
          metadata: {
            result: pr.outcome,
            opponent: 'human',
            movesPlayed: matchResult.totalTurns || 0,
            eloDelta: pr.ratingChange,
            terminationType: reason === 'forfeit' ? 'resignation' : 'completed',
          },
          createdAt: new Date(),
        });
      } catch (e) {
        this.logger.warn(`Failed to submit leaderboard score for ${uid}: ${(e as Error).message}`);
      }
    }

    this.logger.log(`Game results processed: ${uids.length} players, ratings updated, scores submitted`);
    return { success: true, playerResults };
  }
}
