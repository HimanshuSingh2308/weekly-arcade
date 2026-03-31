import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { FieldValue } from '@google-cloud/firestore';
import { FirebaseService } from '../firebase/firebase.service';
import { User, UserSettings } from '@weekly-arcade/shared';
import { UpdateUserDto, UpdateSettingsDto } from './dto';

// Convert Firestore Timestamps to ISO strings for JSON serialization
function serializeDates<T extends object>(obj: T): T {
  const result = { ...obj } as Record<string, unknown>;
  for (const [key, value] of Object.entries(result)) {
    if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      result[key] = (value as { toDate: () => Date }).toDate().toISOString();
    } else if (value instanceof Date) {
      result[key] = value.toISOString();
    }
  }
  return result as T;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly usersCollection = 'users';

  constructor(private readonly firebaseService: FirebaseService) {}

  async getProfile(uid: string): Promise<User> {
    const userDoc = await this.firebaseService
      .doc(`${this.usersCollection}/${uid}`)
      .get();

    if (!userDoc.exists) {
      throw new NotFoundException('User not found');
    }

    return serializeDates(userDoc.data() as User);
  }

  async updateProfile(uid: string, updateDto: UpdateUserDto): Promise<User> {
    const userRef = this.firebaseService.doc(`${this.usersCollection}/${uid}`);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new NotFoundException('User not found');
    }

    const updates: Partial<User> = {
      ...updateDto,
      updatedAt: new Date(),
    };

    await userRef.update(updates);

    const updatedDoc = await userRef.get();
    return updatedDoc.data() as User;
  }

  async updateSettings(uid: string, settingsDto: UpdateSettingsDto): Promise<UserSettings> {
    const userRef = this.firebaseService.doc(`${this.usersCollection}/${uid}`);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new NotFoundException('User not found');
    }

    const currentUser = userDoc.data() as User;
    const newSettings: UserSettings = {
      ...currentUser.settings,
      ...settingsDto,
    };

    await userRef.update({
      settings: newSettings,
      updatedAt: new Date(),
    });

    this.logger.log(`Updated settings for user: ${uid}`);
    return newSettings;
  }

  async addFriend(uid: string, friendUid: string): Promise<string[]> {
    if (uid === friendUid) {
      throw new BadRequestException('Cannot add yourself as a friend');
    }

    const userRef = this.firebaseService.doc(`${this.usersCollection}/${uid}`);
    const friendRef = this.firebaseService.doc(`${this.usersCollection}/${friendUid}`);

    const [userDoc, friendDoc] = await Promise.all([
      userRef.get(),
      friendRef.get(),
    ]);

    if (!userDoc.exists) {
      throw new NotFoundException('User not found');
    }

    if (!friendDoc.exists) {
      throw new NotFoundException('Friend user not found');
    }

    const user = userDoc.data() as User;
    const friends = user.friends || [];

    if (friends.includes(friendUid)) {
      throw new BadRequestException('Already friends');
    }

    if (friends.length >= 50) {
      throw new BadRequestException('Friends list is full (max 50)');
    }

    const newFriends = [...friends, friendUid];

    await userRef.update({
      friends: newFriends,
      updatedAt: new Date(),
    });

    this.logger.log(`User ${uid} added friend ${friendUid}`);
    return newFriends;
  }

  async removeFriend(uid: string, friendUid: string): Promise<string[]> {
    const userRef = this.firebaseService.doc(`${this.usersCollection}/${uid}`);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new NotFoundException('User not found');
    }

    const user = userDoc.data() as User;
    const friends = user.friends || [];

    if (!friends.includes(friendUid)) {
      throw new BadRequestException('Not in friends list');
    }

    const newFriends = friends.filter((f) => f !== friendUid);

    await userRef.update({
      friends: newFriends,
      updatedAt: new Date(),
    });

    this.logger.log(`User ${uid} removed friend ${friendUid}`);
    return newFriends;
  }

  async getFriends(uid: string): Promise<User[]> {
    const userDoc = await this.firebaseService
      .doc(`${this.usersCollection}/${uid}`)
      .get();

    if (!userDoc.exists) {
      throw new NotFoundException('User not found');
    }

    const user = userDoc.data() as User;
    const friendUids = user.friends || [];

    if (friendUids.length === 0) {
      return [];
    }

    // Single round-trip batch read via Firestore getAll()
    const friendRefs = friendUids.map((fid) =>
      this.firebaseService.doc(`${this.usersCollection}/${fid}`)
    );
    const friendDocs = await this.firebaseService.getAll(...friendRefs);

    return friendDocs
      .filter((doc) => doc.exists)
      .map((doc) => doc.data() as User);
  }

  async updatePlayStreak(uid: string): Promise<void> {
    const userRef = this.firebaseService.doc(`${this.usersCollection}/${uid}`);
    const userDoc = await userRef.get();

    if (!userDoc.exists) return;

    const user = userDoc.data() as User;
    const today = new Date().toISOString().split('T')[0];

    // Already counted today
    if (user.lastPlayedDate === today) return;

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const currentStreak = user.currentPlayStreak || 0;

    const newStreak = user.lastPlayedDate === yesterday ? currentStreak + 1 : 1;

    await userRef.update({
      lastPlayedDate: today,
      currentPlayStreak: newStreak,
      updatedAt: new Date(),
    });

    this.logger.log(`Updated play streak for user ${uid}: ${newStreak} days`);
  }

  /**
   * Add XP using atomic increment — no read required, eliminates hot-doc contention.
   * Level is recalculated from the new totalXP after the write.
   */
  async addXP(uid: string, xpAmount: number): Promise<{ totalXP: number; playerLevel: number }> {
    const userRef = this.firebaseService.doc(`${this.usersCollection}/${uid}`);

    // Atomic increment — no read needed, safe under concurrent writes
    await userRef.update({
      totalXP: FieldValue.increment(xpAmount),
      updatedAt: new Date(),
    });

    // Read back to compute level (single read, non-contended)
    const updated = await userRef.get();
    if (!updated.exists) {
      throw new NotFoundException('User not found');
    }

    const newTotalXP = (updated.data() as User).totalXP;
    const newLevel = Math.floor(Math.sqrt(newTotalXP / 100)) + 1;

    // Update level only if changed (avoids unnecessary write)
    const currentLevel = (updated.data() as User).playerLevel;
    if (newLevel !== currentLevel) {
      await userRef.update({ playerLevel: newLevel });
    }

    this.logger.log(`Added ${xpAmount} XP to user ${uid}. New total: ${newTotalXP}, Level: ${newLevel}`);
    return { totalXP: newTotalXP, playerLevel: newLevel };
  }
}
