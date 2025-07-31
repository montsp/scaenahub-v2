import { User, UserProfile } from '../types';
import { AuthService } from './auth';
import { DataSyncService } from './database/sync';

export interface OnlineStatusUpdate {
  userId: string;
  status: UserProfile['onlineStatus'];
  lastSeen: Date;
}

export interface CustomStatusData {
  text: string;
  emoji?: string;
  expiresAt?: Date;
}

export class ProfileService {
  private static instance: ProfileService;
  private authService: AuthService;
  private syncService: DataSyncService;
  private onlineUsers: Map<string, { status: UserProfile['onlineStatus']; lastSeen: Date }> = new Map();

  private constructor() {
    this.authService = AuthService.getInstance();
    this.syncService = DataSyncService.getInstance();
  }

  public static getInstance(): ProfileService {
    if (!ProfileService.instance) {
      ProfileService.instance = new ProfileService();
    }
    return ProfileService.instance;
  }

  public async updateOnlineStatus(userId: string, status: UserProfile['onlineStatus']): Promise<User> {
    const user = await this.authService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // オンラインユーザーマップを更新
    this.onlineUsers.set(userId, {
      status,
      lastSeen: new Date()
    });

    // データベースを更新
    const updatedUser = await this.authService.updateUserProfile(userId, {
      onlineStatus: status
    });

    return updatedUser;
  }

  public async setCustomStatus(userId: string, customStatus: CustomStatusData | null): Promise<User> {
    const user = await this.authService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // カスタムステータスの検証
    if (customStatus) {
      if (customStatus.text.length > 100) {
        throw new Error('Custom status text must be 100 characters or less');
      }
      if (customStatus.emoji && customStatus.emoji.length > 10) {
        throw new Error('Custom status emoji is too long');
      }
    }

    const updatedUser = await this.authService.updateUserProfile(userId, {
      customStatus: customStatus || undefined
    });

    return updatedUser;
  }

  public async updateBio(userId: string, bio: string): Promise<User> {
    const user = await this.authService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (bio.length > 500) {
      throw new Error('Bio must be 500 characters or less');
    }

    const updatedUser = await this.authService.updateUserProfile(userId, {
      bio
    });

    return updatedUser;
  }

  public async updateAvatar(userId: string, avatarUrl: string): Promise<User> {
    const user = await this.authService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // アバターURLの基本的な検証
    if (avatarUrl && !this.isValidUrl(avatarUrl)) {
      throw new Error('Invalid avatar URL');
    }

    const updatedUser = await this.authService.updateUserProfile(userId, {
      avatar: avatarUrl
    });

    return updatedUser;
  }

  public async updateDisplayName(userId: string, displayName: string): Promise<User> {
    const user = await this.authService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!displayName || displayName.length < 1 || displayName.length > 100) {
      throw new Error('Display name must be between 1 and 100 characters');
    }

    const updatedUser = await this.authService.updateUserProfile(userId, {
      displayName
    });

    return updatedUser;
  }

  public getOnlineUsers(): OnlineStatusUpdate[] {
    const now = new Date();
    const onlineUsers: OnlineStatusUpdate[] = [];

    for (const [userId, data] of this.onlineUsers.entries()) {
      // 5分以内にアクティビティがあったユーザーのみを「オンライン」とみなす
      const timeDiff = now.getTime() - data.lastSeen.getTime();
      const isRecentlyActive = timeDiff < 5 * 60 * 1000; // 5分

      let effectiveStatus = data.status;
      if (!isRecentlyActive && data.status === 'online') {
        effectiveStatus = 'away';
      }

      if (effectiveStatus !== 'offline') {
        onlineUsers.push({
          userId,
          status: effectiveStatus,
          lastSeen: data.lastSeen
        });
      }
    }

    return onlineUsers;
  }

  public async getUsersWithProfiles(userIds: string[]): Promise<Array<Omit<User, 'passwordHash'>>> {
    const users: Array<Omit<User, 'passwordHash'>> = [];

    for (const userId of userIds) {
      const user = await this.authService.getUserById(userId);
      if (user) {
        const { passwordHash, ...sanitizedUser } = user;
        users.push(sanitizedUser);
      }
    }

    return users;
  }

  public async searchUsersByDisplayName(query: string, limit: number = 10): Promise<Array<{
    id: string;
    username: string;
    profile: {
      displayName: string;
      avatar?: string;
      onlineStatus: UserProfile['onlineStatus'];
    };
    roles: string[];
  }>> {
    if (query.length < 2) {
      throw new Error('Search query must be at least 2 characters');
    }

    const usersData = this.syncService.readData<any>('users', 
      `SELECT id, username, display_name, avatar, online_status, roles
       FROM users_cache 
       WHERE display_name LIKE ? AND is_active = 1 AND is_banned = 0
       ORDER BY 
         CASE WHEN display_name = ? THEN 1
              WHEN display_name LIKE ? THEN 2
              ELSE 3 END,
         display_name
       LIMIT ?`,
      [`%${query}%`, query, `${query}%`, limit]
    );

    return usersData.map(userData => ({
      id: userData.id,
      username: userData.username,
      profile: {
        displayName: userData.display_name,
        avatar: userData.avatar,
        onlineStatus: userData.online_status
      },
      roles: JSON.parse(userData.roles || '["member"]')
    }));
  }

  public async getDetailedProfile(userId: string): Promise<{
    user: Omit<User, 'passwordHash'>;
    stats: {
      joinedAt: Date;
      lastSeen: Date;
      isOnline: boolean;
    };
  } | null> {
    const user = await this.authService.getUserById(userId);
    if (!user) {
      return null;
    }

    const { passwordHash, ...sanitizedUser } = user;
    const onlineData = this.onlineUsers.get(userId);
    const now = new Date();
    const isOnline = onlineData ? 
      (now.getTime() - onlineData.lastSeen.getTime()) < 5 * 60 * 1000 : false;

    return {
      user: sanitizedUser,
      stats: {
        joinedAt: user.createdAt,
        lastSeen: user.lastSeen,
        isOnline
      }
    };
  }

  public async clearExpiredCustomStatuses(): Promise<void> {
    const now = new Date();
    
    // 期限切れのカスタムステータスを持つユーザーを検索
    const usersWithExpiredStatus = this.syncService.readData<any>('users',
      `SELECT id, custom_status FROM users_cache 
       WHERE custom_status IS NOT NULL AND custom_status != ''`
    );

    for (const userData of usersWithExpiredStatus) {
      try {
        const customStatus = JSON.parse(userData.custom_status);
        if (customStatus.expiresAt && new Date(customStatus.expiresAt) <= now) {
          // 期限切れのカスタムステータスをクリア
          await this.setCustomStatus(userData.id, null);
        }
      } catch (error) {
        console.error('Error parsing custom status for user', userData.id, error);
      }
    }
  }

  public updateUserActivity(userId: string): void {
    const currentData = this.onlineUsers.get(userId);
    if (currentData) {
      this.onlineUsers.set(userId, {
        ...currentData,
        lastSeen: new Date()
      });
    } else {
      this.onlineUsers.set(userId, {
        status: 'online',
        lastSeen: new Date()
      });
    }
  }

  public async setUserOffline(userId: string): Promise<void> {
    this.onlineUsers.delete(userId);
    
    // データベースのオンラインステータスも更新
    try {
      await this.updateOnlineStatus(userId, 'offline');
    } catch (error) {
      console.error('Error setting user offline:', error);
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // 定期的なクリーンアップ処理
  public startPeriodicCleanup(): void {
    // 期限切れカスタムステータスのクリーンアップ（1時間ごと）
    setInterval(async () => {
      try {
        await this.clearExpiredCustomStatuses();
      } catch (error) {
        console.error('Error during custom status cleanup:', error);
      }
    }, 60 * 60 * 1000); // 1時間

    // 非アクティブユーザーのクリーンアップ（5分ごと）
    setInterval(() => {
      const now = new Date();
      const inactiveThreshold = 30 * 60 * 1000; // 30分

      for (const [userId, data] of this.onlineUsers.entries()) {
        const timeDiff = now.getTime() - data.lastSeen.getTime();
        if (timeDiff > inactiveThreshold) {
          this.onlineUsers.delete(userId);
        }
      }
    }, 5 * 60 * 1000); // 5分
  }
}