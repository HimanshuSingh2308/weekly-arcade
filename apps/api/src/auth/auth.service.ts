import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { User, CreateUserDto } from '@weekly-arcade/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly usersCollection = 'users';

  constructor(private readonly firebaseService: FirebaseService) {}

  async createOrUpdateUser(uid: string, userData: CreateUserDto): Promise<User> {
    const userRef = this.firebaseService.doc(`${this.usersCollection}/${uid}`);
    const userDoc = await userRef.get();

    const now = new Date();

    if (userDoc.exists) {
      // Update last login
      await userRef.update({
        updatedAt: now,
      });
      return userDoc.data() as User;
    }

    // Create new user
    const newUser: User = {
      uid,
      email: userData.email,
      displayName: userData.displayName,
      avatarUrl: userData.avatarUrl || null,
      createdAt: now,
      updatedAt: now,
      totalXP: 0,
      playerLevel: 1,
      settings: {
        soundEnabled: true,
        theme: 'dark',
        notificationsEnabled: true,
      },
      friends: [],
    };

    await userRef.set(newUser);
    this.logger.log(`Created new user: ${uid}`);

    return newUser;
  }

  async getUser(uid: string): Promise<User | null> {
    const userDoc = await this.firebaseService
      .doc(`${this.usersCollection}/${uid}`)
      .get();

    if (!userDoc.exists) {
      return null;
    }

    return userDoc.data() as User;
  }

  async deleteUser(uid: string): Promise<void> {
    // Delete user document
    await this.firebaseService.doc(`${this.usersCollection}/${uid}`).delete();

    // Delete user from Firebase Auth
    await this.firebaseService.auth.deleteUser(uid);

    this.logger.log(`Deleted user: ${uid}`);
  }
}
