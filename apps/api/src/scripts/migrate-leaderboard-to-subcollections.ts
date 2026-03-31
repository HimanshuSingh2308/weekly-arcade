/**
 * One-time migration: Convert leaderboard array-in-doc to subcollection model
 *
 * Reads each leaderboard document's `entries` array, writes each entry as a
 * subcollection document at `leaderboards/{id}/entries/{odId}`, then removes
 * the `entries` array from the parent doc (keeps metadata).
 *
 * Usage:
 *   DRY_RUN=true npx ts-node apps/api/src/scripts/migrate-leaderboard-to-subcollections.ts
 *   npx ts-node apps/api/src/scripts/migrate-leaderboard-to-subcollections.ts
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS or running in a GCP environment.
 */

import * as admin from 'firebase-admin';
import { applicationDefault } from 'firebase-admin/app';

const DRY_RUN = process.env.DRY_RUN === 'true';
const BATCH_SIZE = 500;

async function main() {
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID || 'weekly-arcade',
    });
  }

  const firestore = admin.firestore();

  console.log(`=== Leaderboard Migration: Array → Subcollection ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  // Read all leaderboard documents
  const leaderboardsSnapshot = await firestore.collection('leaderboards').get();
  console.log(`Found ${leaderboardsSnapshot.size} leaderboard documents`);
  console.log('');

  let totalEntries = 0;
  let totalMigrated = 0;
  let totalSkipped = 0;

  for (const leaderboardDoc of leaderboardsSnapshot.docs) {
    const data = leaderboardDoc.data();
    const entries = data.entries as Array<{
      odId: string;
      odName: string;
      odAvatarUrl: string | null;
      score: number;
      rank: number;
      level?: number;
      updatedAt: any;
    }>;

    if (!entries || entries.length === 0) {
      console.log(`  ${leaderboardDoc.id}: no entries array, skipping`);
      totalSkipped++;
      continue;
    }

    totalEntries += entries.length;
    console.log(`  ${leaderboardDoc.id}: ${entries.length} entries`);

    if (DRY_RUN) {
      for (const entry of entries) {
        console.log(`    [DRY RUN] Would write entries/${entry.odId} (score: ${entry.score})`);
      }
      totalMigrated += entries.length;
      continue;
    }

    // Write entries to subcollection in batches
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const chunk = entries.slice(i, i + BATCH_SIZE);
      const batch = firestore.batch();

      for (const entry of chunk) {
        const entryRef = firestore.doc(
          `leaderboards/${leaderboardDoc.id}/entries/${entry.odId}`
        );
        const entryData: Record<string, unknown> = {
          odId: entry.odId,
          score: entry.score,
          updatedAt: entry.updatedAt || new Date(),
        };
        if (entry.level != null) entryData.level = entry.level;
        batch.set(entryRef, entryData);
      }

      await batch.commit();
      totalMigrated += chunk.length;
    }

    // Remove the entries array from the parent doc, keep metadata
    await firestore.doc(`leaderboards/${leaderboardDoc.id}`).update({
      entries: admin.firestore.FieldValue.delete(),
    });

    console.log(`    Migrated ${entries.length} entries, cleaned parent doc`);
  }

  console.log('');
  console.log(`=== Complete ===`);
  console.log(`Leaderboard docs processed: ${leaderboardsSnapshot.size}`);
  console.log(`Leaderboard docs skipped (no entries): ${totalSkipped}`);
  console.log(`Entries ${DRY_RUN ? 'to migrate' : 'migrated'}: ${totalMigrated}`);
  console.log(`Total entries found: ${totalEntries}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
