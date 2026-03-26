export type NotificationType =
  | 'streak_reminder'
  | 'new_game'
  | 'leaderboard_update'
  | 'achievement_unlocked';

export interface PushToken {
  uid: string;
  token: string;
  deviceInfo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationLog {
  uid: string;
  type: NotificationType;
  sentAt: Date;
  title: string;
  body: string;
}
