import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { Firestore } from '@google-cloud/firestore';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private _app: admin.app.App;
  private _firestore: Firestore;
  private _auth: admin.auth.Auth;

  async onModuleInit() {
    try {
      // Check if already initialized
      if (admin.apps.length > 0) {
        this._app = admin.apps[0]!;
      } else {
        // Initialize with default credentials (works in Cloud Functions)
        // or with GOOGLE_APPLICATION_CREDENTIALS env var locally
        this._app = admin.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID || 'weekly-arcade',
        });
      }

      this._firestore = this._app.firestore();
      this._auth = this._app.auth();

      this.logger.log('Firebase Admin SDK initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase', error);
      throw error;
    }
  }

  get firestore(): Firestore {
    return this._firestore;
  }

  get auth(): admin.auth.Auth {
    return this._auth;
  }

  get app(): admin.app.App {
    return this._app;
  }

  // Collection helpers
  collection(name: string) {
    return this._firestore.collection(name);
  }

  doc(path: string) {
    return this._firestore.doc(path);
  }

  // Run a Firestore transaction
  async runTransaction<T>(
    updateFunction: (transaction: FirebaseFirestore.Transaction) => Promise<T>
  ): Promise<T> {
    return this._firestore.runTransaction(updateFunction);
  }

  // Verify Firebase ID token
  async verifyIdToken(token: string): Promise<admin.auth.DecodedIdToken> {
    return this._auth.verifyIdToken(token);
  }

  // Get user by UID
  async getUser(uid: string): Promise<admin.auth.UserRecord> {
    return this._auth.getUser(uid);
  }
}
