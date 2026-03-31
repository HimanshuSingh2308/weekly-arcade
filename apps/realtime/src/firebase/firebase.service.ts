import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { Firestore } from '@google-cloud/firestore';
import * as fs from 'fs';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private _app: admin.app.App;
  private _firestore: Firestore;
  private _auth: admin.auth.Auth;

  async onModuleInit() {
    try {
      if (admin.apps.length > 0) {
        this._app = admin.apps[0]!;
      } else {
        // Check for Render secret file, then GOOGLE_APPLICATION_CREDENTIALS, then project ID only
        const secretFilePath = '/etc/secrets/firebase-sa.json';
        if (fs.existsSync(secretFilePath)) {
          const serviceAccount = JSON.parse(fs.readFileSync(secretFilePath, 'utf8'));
          this._app = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id,
          });
          this.logger.log('Firebase initialized with secret file credentials');
        } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
          this._app = admin.initializeApp({
            projectId: process.env.FIREBASE_PROJECT_ID || 'weekly-arcade',
          });
          this.logger.log('Firebase initialized with GOOGLE_APPLICATION_CREDENTIALS');
        } else {
          this._app = admin.initializeApp({
            projectId: process.env.FIREBASE_PROJECT_ID || 'weekly-arcade',
          });
          this.logger.log('Firebase initialized with project ID only');
        }
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

  collection(name: string) {
    return this._firestore.collection(name);
  }

  doc(path: string) {
    return this._firestore.doc(path);
  }

  batch(): FirebaseFirestore.WriteBatch {
    return this._firestore.batch();
  }

  async verifyIdToken(token: string): Promise<admin.auth.DecodedIdToken> {
    return this._auth.verifyIdToken(token);
  }
}
