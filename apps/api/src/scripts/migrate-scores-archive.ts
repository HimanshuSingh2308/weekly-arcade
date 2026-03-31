/**
 * One-time migration script: Archive old scores
 *
 * Deletes score documents older than 90 days from the `scores` collection
 * to control Firestore storage costs and query performance.
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

async function main() {
  // Initialize Firebase Admin
  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'weekly-arcade',
    });
  }

  const firestore = admin.firestore();
  const cutoffDate = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  console.log(`=== Scores Archival Migration ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no deletions)' : 'LIVE'}`);
  console.log(`Cutoff: ${cutoffDate.toISOString()} (${RETENTION_DAYS} days ago)`);
  console.log('');

  let totalDeleted = 0;
  let hasMore = true;

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

    if (DRY_RUN) {
      totalDeleted += snapshot.size;
      console.log(`[DRY RUN] Would delete ${snapshot.size} scores (total: ${totalDeleted})`);
      // In dry run, break after first batch to avoid infinite loop
      // (we're not actually deleting, so the query would return the same docs)
      const remaining = await firestore
        .collection('scores')
        .where('createdAt', '<', cutoffDate)
        .count()
        .get();
      totalDeleted = remaining.data().count;
      hasMore = false;
    } else {
      const batch = firestore.batch();
      for (const doc of snapshot.docs) {
        batch.delete(doc.ref);
      }
      await batch.commit();
      totalDeleted += snapshot.size;
      console.log(`Deleted ${totalDeleted} scores so far...`);
    }
  }

  console.log('');
  console.log(`=== Complete ===`);
  console.log(`Total scores ${DRY_RUN ? 'to delete' : 'deleted'}: ${totalDeleted}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
