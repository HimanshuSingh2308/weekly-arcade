import { Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { FirebaseService } from '../firebase/firebase.service';

export interface AuthenticatedSocket extends Socket {
  data: {
    user: { uid: string; email: string };
    sessionId: string;
  };
}

const logger = new Logger('WsAuthMiddleware');

/**
 * Socket.IO middleware that verifies Firebase JWT on connection handshake.
 * Attaches user info and sessionId to socket.data for use in gateways.
 */
export function createWsAuthMiddleware(firebaseService: FirebaseService) {
  return async (socket: Socket, next: (err?: Error) => void) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication required: no token provided'));
      }

      const decoded = await firebaseService.verifyIdToken(token);
      socket.data.user = { uid: decoded.uid, email: decoded.email || '' };

      const sessionId = socket.handshake.query?.sessionId as string;
      if (!sessionId) {
        return next(new Error('Session ID required'));
      }
      socket.data.sessionId = sessionId;

      logger.debug(`Authenticated: uid=${decoded.uid} session=${sessionId}`);
      next();
    } catch (error) {
      logger.warn(`Auth failed: ${(error as Error).message}`);
      next(new Error('Authentication failed: invalid token'));
    }
  };
}
