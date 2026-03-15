export interface User {
  uid: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  totalXP: number;
  playerLevel: number;
  settings: UserSettings;
  friends: string[];
}

export interface UserSettings {
  soundEnabled: boolean;
  theme: 'dark' | 'light' | 'system';
  notificationsEnabled: boolean;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  avatarUrl: string | null;
  playerLevel: number;
  totalXP: number;
  createdAt: Date;
}

export interface CreateUserDto {
  email: string;
  displayName: string;
  avatarUrl?: string;
}

export interface UpdateProfileDto {
  displayName?: string;
  avatarUrl?: string;
}

export interface UpdateSettingsDto {
  soundEnabled?: boolean;
  theme?: 'dark' | 'light' | 'system';
  notificationsEnabled?: boolean;
}
