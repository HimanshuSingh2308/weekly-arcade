import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { Invitation } from '@weekly-arcade/shared';
import { MULTIPLAYER_DEFAULTS } from './config/multiplayer-defaults';
import * as crypto from 'crypto';

@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);

  constructor(private readonly firebase: FirebaseService) {}

  async sendInvitation(
    fromUid: string,
    fromDisplayName: string,
    toUid: string,
    sessionId: string,
    gameId: string,
  ): Promise<Invitation> {
    // Validate friendship
    const userDoc = await this.firebase.doc(`users/${fromUid}`).get();
    if (!userDoc.exists) throw new NotFoundException('User not found');
    const friends: string[] = userDoc.data()?.friends ?? [];
    if (!friends.includes(toUid)) {
      throw new ForbiddenException('Can only invite friends');
    }

    // Check pending invitation limit
    const pendingCount = await this.getPendingSentCount(fromUid);
    if (pendingCount >= MULTIPLAYER_DEFAULTS.MAX_PENDING_INVITATIONS) {
      throw new ConflictException(`Maximum ${MULTIPLAYER_DEFAULTS.MAX_PENDING_INVITATIONS} pending invitations`);
    }

    // Check for duplicate invitation
    const existing = await this.firebase
      .collection('invitations')
      .where('fromUid', '==', fromUid)
      .where('toUid', '==', toUid)
      .where('sessionId', '==', sessionId)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (!existing.empty) {
      throw new ConflictException('Invitation already sent');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + MULTIPLAYER_DEFAULTS.INVITATION_TTL_MIN * 60 * 1000);
    const invitationId = crypto.randomUUID();

    const invitation: Invitation = {
      invitationId,
      sessionId,
      fromUid,
      fromDisplayName,
      toUid,
      gameId,
      status: 'pending',
      createdAt: now,
      expiresAt,
    };

    await this.firebase.doc(`invitations/${invitationId}`).set(invitation);
    this.logger.log(`Invitation sent: ${fromUid} → ${toUid} for session ${sessionId}`);

    // TODO: Send push notification via NotificationsService

    return invitation;
  }

  async getReceivedInvitations(uid: string): Promise<Invitation[]> {
    const snapshot = await this.firebase
      .collection('invitations')
      .where('toUid', '==', uid)
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const now = new Date();
    return snapshot.docs
      .map(doc => doc.data() as Invitation)
      .filter(inv => new Date(inv.expiresAt) > now);
  }

  async respondToInvitation(invitationId: string, uid: string, action: 'accept' | 'decline'): Promise<Invitation> {
    const doc = await this.firebase.doc(`invitations/${invitationId}`).get();
    if (!doc.exists) throw new NotFoundException('Invitation not found');

    const invitation = doc.data() as Invitation;

    if (invitation.toUid !== uid) {
      throw new ForbiddenException('Not your invitation');
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException('Invitation already responded to');
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }

    const newStatus = action === 'accept' ? 'accepted' : 'declined';
    await this.firebase.doc(`invitations/${invitationId}`).update({
      status: newStatus,
    });

    return { ...invitation, status: newStatus };
  }

  private async getPendingSentCount(uid: string): Promise<number> {
    const snapshot = await this.firebase
      .collection('invitations')
      .where('fromUid', '==', uid)
      .where('status', '==', 'pending')
      .get();
    return snapshot.size;
  }
}
