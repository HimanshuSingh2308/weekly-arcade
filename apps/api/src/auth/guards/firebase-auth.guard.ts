import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FirebaseService } from '../../firebase/firebase.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import * as crypto from 'crypto';

interface CachedToken {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  expiry: number;
}

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  // Token verification cache: hash(token) → decoded claims + expiry
  // Avoids expensive RSA verification on every request (~50-100ms CPU savings)
  private readonly tokenCache = new Map<string, CachedToken>();
  private readonly TOKEN_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_TOKEN_CACHE = 10_000;

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.split('Bearer ')[1];
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex').slice(0, 16);

    // Check cache first
    const cached = this.tokenCache.get(tokenHash);
    if (cached && Date.now() < cached.expiry) {
      request.user = {
        uid: cached.uid,
        email: cached.email,
        displayName: cached.name,
        avatarUrl: cached.picture,
      };
      return true;
    }

    try {
      const decodedToken = await this.firebaseService.verifyIdToken(token);

      // Cache the verified token
      if (this.tokenCache.size >= this.MAX_TOKEN_CACHE) {
        // Evict oldest entries
        const cutoff = Date.now();
        for (const [key, val] of this.tokenCache) {
          if (val.expiry < cutoff) this.tokenCache.delete(key);
        }
        // If still full, delete first entry (LRU)
        if (this.tokenCache.size >= this.MAX_TOKEN_CACHE) {
          const first = this.tokenCache.keys().next().value;
          if (first) this.tokenCache.delete(first);
        }
      }

      this.tokenCache.set(tokenHash, {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name,
        picture: decodedToken.picture,
        expiry: Date.now() + this.TOKEN_CACHE_TTL_MS,
      });

      request.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        displayName: decodedToken.name,
        avatarUrl: decodedToken.picture,
      };
      return true;
    } catch (error) {
      this.logger.error('Token verification failed', error);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
