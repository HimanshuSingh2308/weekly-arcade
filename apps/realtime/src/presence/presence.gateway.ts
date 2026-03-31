import {
  WebSocketGateway,
  SubscribeMessage,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { AuthenticatedSocket } from '../auth/ws-auth.middleware';
import { PresenceService } from './presence.service';

@WebSocketGateway({ namespace: '/presence' })
export class PresenceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(PresenceGateway.name);

  constructor(private readonly presenceService: PresenceService) {}

  handleConnection(client: AuthenticatedSocket) {
    if (!client.data?.user) return;
    this.presenceService.setOnline(client.data.user.uid);
    this.logger.debug(`Presence: ${client.data.user.uid} online`);
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (!client.data?.user) return;
    this.presenceService.setOffline(client.data.user.uid);
    this.logger.debug(`Presence: ${client.data.user.uid} offline`);
  }

  @SubscribeMessage('presence:ping')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    // Keep-alive, update last seen
    if (client.data?.user) {
      const p = this.presenceService.getStatus(client.data.user.uid);
      if (p) p.lastSeen = new Date();
    }
    return { event: 'presence:pong', data: {} };
  }

  @SubscribeMessage('presence:query')
  handleQuery(
    @ConnectedSocket() client: AuthenticatedSocket,
    payload: { uids: string[] },
  ) {
    const statuses = this.presenceService.getBulkStatus(payload.uids);
    return { event: 'presence:status', data: statuses };
  }
}
