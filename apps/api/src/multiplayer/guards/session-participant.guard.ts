import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { Session } from '@weekly-arcade/shared';

/**
 * Guard that verifies the authenticated user is a participant in the session.
 * Expects :sessionId in the route params and request.user.uid from FirebaseAuthGuard.
 * Attaches the session document to request.session for controller use.
 */
@Injectable()
export class SessionParticipantGuard implements CanActivate {
  constructor(private readonly firebase: FirebaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const sessionId = request.params.sessionId;
    const uid = request.user?.uid;

    if (!sessionId) {
      throw new NotFoundException('Session ID required');
    }

    if (!uid) {
      throw new ForbiddenException('Authentication required');
    }

    const sessionDoc = await this.firebase.doc(`sessions/${sessionId}`).get();
    if (!sessionDoc.exists) {
      throw new NotFoundException('Session not found');
    }

    const session = sessionDoc.data() as Session;
    const player = session.players?.[uid];

    if (!player || player.status === 'left') {
      throw new ForbiddenException('Not a participant in this session');
    }

    // Attach session data to request for use in controller
    request.session = session;
    return true;
  }
}
