/**
 * One-time migration script: Consolidate and archive old scores
 *
 * 1. Reads all scores older than 90 days
 * 2. Aggregates them into per-user-per-game summaries in `scoreArchives`
 * 3. Deletes the raw score documents
 *
 * Usage:
 *   DRY_RUN=true npx ts-node apps/api/src/scripts/migrate-scores-archive.ts   # preview
 *   npx ts-node apps/api/src/scripts/migrate-scores-archive.ts                 # execute
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS or running in a GCP environment.
 */

import * as admin from 'firebase-admin';

const DRY_RUN = process.env.DRY_RUN === 'true';
const BATCH_SIZE = 500;
const RETENTION_DAYS = 90;

interface ScoreSummary {
  odId: string;
  gameId: string;
  totalGames: number;
  bestScore: number;
  totalScore: number;
  bestLevel: number;
  bestTimeMs: number | null;
  firstPlayed: Date;
  lastPlayed: Date;
}

async function main() {
  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'weekly-arcade',
    });
  }

  const firestore = admin.firestore();
  const cutoffDate = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  console.log(`=== Scores Archival Migration ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes/deletes)' : 'LIVE'}`);
  console.log(`Cutoff: ${cutoffDate.toISOString()} (${RETENTION_DAYS} days ago)`);
  console.log('');

  // Phase 1: Read all old scores and build summaries
  console.log('Phase 1: Reading old scores...');
  const summaries = new Map<string, ScoreSummary>();
  let totalRead = 0;
  let hasMore = true;
  let lastDoc: FirebaseFirestore.DocumentSnapshot | undefined;

  while (hasMore) {
    let query = firestore
      .collection('scores')
      .where('createdAt', '<', cutoffDate)
      .orderBy('createdAt', 'asc')
      .limit(BATCH_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      hasMore = false;
      break;
    }

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const key = `${data.odId}_${data.gameId}`;
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);

      const existing = summaries.get(key);
      if (existing) {
        existing.totalGames += 1;
        existing.totalScore += data.score || 0;
        existing.bestScore = Math.max(existing.bestScore, data.score || 0);
        existing.bestLevel = Math.max(existing.bestLevel, data.level || 0);
        if (data.timeMs != null) {
          existing.bestTimeMs = existing.bestTimeMs != null
            ? Math.min(existing.bestTimeMs, data.timeMs)
            : data.timeMs;
        }
        if (createdAt < existing.firstPlayed) existing.firstPlayed = createdAt;
        if (createdAt > existing.lastPlayed) existing.lastPlayed = createdAt;
      } else {
        summaries.set(key, {
          odId: data.odId,
          gameId: data.gameId,
          totalGames: 1,
          bestScore: data.score || 0,
          totalScore: data.score || 0,
          bestLevel: data.level || 0,
          bestTimeMs: data.timeMs ?? null,
          firstPlayed: createdAt,
          lastPlayed: createdAt,
        });
      }
    }

    totalRead += snapshot.size;
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    console.log(`  Read ${totalRead} scores...`);
  }

  console.log(`  Total scores read: ${totalRead}`);
  console.log(`  Unique user-game combinations: ${summaries.size}`);
  console.log('');

  if (totalRead === 0) {
    console.log('No scores older than 90 days found. Nothing to archive.');
    return;
  }

  // Phase 2: Upsert consolidated summaries into scoreArchives
  console.log('Phase 2: Writing consolidated summaries to scoreArchives...');
  let archivedCount = 0;

  for (const [key, summary] of summaries) {
    const archiveRef = firestore.doc(`scoreArchives/${key}`);

    if (DRY_RUN) {
      const avgScore = Math.round(summary.totalScore / summary.totalGames);
      console.log(
        `  [DRY RUN] Would upsert ${key}: ${summary.totalGames} games, best=${summary.bestScore}, avg=${avgScore}`
      );
    } else {
      const existingDoc = await archiveRef.get();

      if (existingDoc.exists) {
        const prev = existingDoc.data()!;
        const newTotalGames = (prev.totalGames || 0) + summary.totalGames;
        const newTotalScore = (prev.totalScore || 0) + summary.totalScore;
        await archiveRef.set({
          odId: summary.odId,
          gameId: summary.gameId,
          totalGames: newTotalGames,
          bestScore: Math.max(prev.bestScore || 0, summary.bestScore),
          totalScore: newTotalScore,
          avgScore: Math.round(newTotalScore / newTotalGames),
          bestLevel: Math.max(prev.bestLevel || 0, summary.bestLevel),
          bestTimeMs: prev.bestTimeMs != null && summary.bestTimeMs != null
            ? Math.min(prev.bestTimeMs, summary.bestTimeMs)
            : prev.bestTimeMs ?? summary.bestTimeMs,
          firstPlayed: (prev.firstPlayed?.toDate?.() || prev.firstPlayed) < summary.firstPlayed
            ? prev.firstPlayed
            : summary.firstPlayed,
          lastPlayed: (prev.lastPlayed?.toDate?.() || prev.lastPlayed) > summary.lastPlayed
            ? prev.lastPlayed
            : summary.lastPlayed,
          updatedAt: new Date(),
        });
      } else {
        await archiveRef.set({
          ...summary,
          avgScore: Math.round(summary.totalScore / summary.totalGames),
          updatedAt: new Date(),
        });
      }
    }

    archivedCount++;
    if (archivedCount % 100 === 0) {
      console.log(`  Processed ${archivedCount}/${summaries.size} summaries...`);
    }
  }

  console.log(`  Consolidated ${archivedCount} summaries`);
  console.log('');

  // Phase 3: Delete raw score documents
  console.log('Phase 3: Deleting raw score documents...');
  let totalDeleted = 0;

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would delete ${totalRead} raw score documents`);
    totalDeleted = totalRead;
  } else {
    hasMore = true;
    while (hasMore) {
      const snapshot = await firestore
        .collection('scores')
        .where('createdAt', '<', cutoffDate)
        .limit(BATCH_SIZE)
        .get();

      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      const batch = firestore.batch();
      for (const doc of snapshot.docs) {
        batch.delete(doc.ref);
      }
      await batch.commit();

      totalDeleted += snapshot.size;
      console.log(`  Deleted ${totalDeleted} scores...`);
    }
  }

  console.log('');
  console.log(`=== Complete ===`);
  console.log(`Summaries ${DRY_RUN ? 'to write' : 'written'}: ${summaries.size}`);
  console.log(`Raw scores ${DRY_RUN ? 'to delete' : 'deleted'}: ${totalDeleted}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
