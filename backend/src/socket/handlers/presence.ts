import { Socket } from 'socket.io';
import { AuthService } from '../../services/auth';
import { ProfileService } from '../../services/profile';
import jwt from 'jsonwebtoken';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

export class PresenceHandler {
  private authService: AuthService;
  private profileService: ProfileService;
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private io?: any; // Socket.ioインスタンス

  constructor() {
    this.authService = AuthService.getInstance();
    this.profileService = ProfileService.getInstance();
  }

  public setSocketIO(io: any): void {
    this.io = io;
  }

  public async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    try {
      // Socket認証
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        socket.emit('error', { message: 'Authentication required' });
        socket.disconnect();
        return;
      }

      // トークン検証
      const payload = this.authService.verifyAccessToken(token);
      const user = await this.authService.getUserById(payload.userId);

      if (!user || !user.isActive || user.isBanned) {
        socket.emit('error', { message: 'Invalid user or account inactive' });
        socket.disconnect();
        return;
      }

      // Socket情報を設定
      socket.userId = user.id;
      socket.username = user.username;

      // ユーザーソケット管理
      if (!this.userSockets.has(user.id)) {
        this.userSockets.set(user.id, new Set());
      }
      this.userSockets.get(user.id)!.add(socket.id);

      // オンラインステータスを更新
      await this.profileService.updateOnlineStatus(user.id, 'online');
      this.profileService.updateUserActivity(user.id);

      // 他のユーザーに通知
      socket.broadcast.emit('user_online', {
        userId: user.id,
        username: user.username,
        profile: {
          displayName: user.profile.displayName,
          avatar: user.profile.avatar,
          onlineStatus: 'online',
          customStatus: user.profile.customStatus
        }
      });

      console.log(`User ${user.username} (${user.id}) connected via socket ${socket.id}`);

      // プレゼンス関連のイベントハンドラーを設定
      this.setupPresenceHandlers(socket);

    } catch (error) {
      console.error('Socket authentication error:', error);
      socket.emit('error', { message: 'Authentication failed' });
      socket.disconnect();
    }
  }

  public async handleDisconnection(socket: AuthenticatedSocket): Promise<void> {
    if (!socket.userId) return;

    try {
      // ユーザーソケット管理から削除
      const userSockets = this.userSockets.get(socket.userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        
        // 他にアクティブなソケットがない場合はオフラインに設定
        if (userSockets.size === 0) {
          this.userSockets.delete(socket.userId);
          await this.profileService.setUserOffline(socket.userId);

          // 他のユーザーに通知
          socket.broadcast.emit('user_offline', {
            userId: socket.userId,
            username: socket.username
          });

          console.log(`User ${socket.username} (${socket.userId}) went offline`);
        }
      }
    } catch (error) {
      console.error('Socket disconnection error:', error);
    }
  }

  private setupPresenceHandlers(socket: AuthenticatedSocket): void {
    // ステータス変更
    socket.on('change_status', async (data: { status: 'online' | 'away' | 'busy' | 'offline' }) => {
      if (!socket.userId) return;

      try {
        const { status } = data;
        
        if (!['online', 'away', 'busy', 'offline'].includes(status)) {
          socket.emit('error', { message: 'Invalid status' });
          return;
        }

        await this.profileService.updateOnlineStatus(socket.userId, status);

        // 他のユーザーに通知
        socket.broadcast.emit('user_status_changed', {
          userId: socket.userId,
          username: socket.username,
          status
        });

        socket.emit('status_changed', { status });
      } catch (error) {
        console.error('Change status error:', error);
        socket.emit('error', { message: 'Failed to change status' });
      }
    });

    // カスタムステータス設定
    socket.on('set_custom_status', async (data: { text?: string; emoji?: string; expiresAt?: string }) => {
      if (!socket.userId) return;

      try {
        const { text, emoji, expiresAt } = data;
        
        let customStatus: { text: string; emoji?: string; expiresAt?: Date } | null = null;
        if (text) {
          const statusData: { text: string; emoji?: string; expiresAt?: Date } = { text };
          if (emoji) statusData.emoji = emoji;
          if (expiresAt) statusData.expiresAt = new Date(expiresAt);
          customStatus = statusData;
        }

        await this.profileService.setCustomStatus(socket.userId, customStatus);

        // 他のユーザーに通知
        socket.broadcast.emit('user_custom_status_changed', {
          userId: socket.userId,
          username: socket.username,
          customStatus
        });

        socket.emit('custom_status_set', { customStatus });
      } catch (error) {
        console.error('Set custom status error:', error);
        socket.emit('error', { message: 'Failed to set custom status' });
      }
    });

    // アクティビティ更新（ハートビート）
    socket.on('heartbeat', () => {
      if (!socket.userId) return;
      
      this.profileService.updateUserActivity(socket.userId);
      socket.emit('heartbeat_ack');
    });

    // オンラインユーザー一覧要求
    socket.on('get_online_users', async () => {
      try {
        const onlineUsers = this.profileService.getOnlineUsers();
        const userIds = onlineUsers.map(u => u.userId);
        const usersWithProfiles = await this.profileService.getUsersWithProfiles(userIds);

        const onlineUsersWithProfiles = onlineUsers.map(onlineUser => {
          const userProfile = usersWithProfiles.find(u => u.id === onlineUser.userId);
          return {
            userId: onlineUser.userId,
            status: onlineUser.status,
            lastSeen: onlineUser.lastSeen,
            profile: userProfile ? {
              username: userProfile.username,
              displayName: userProfile.profile.displayName,
              avatar: userProfile.profile.avatar,
              customStatus: userProfile.profile.customStatus
            } : null
          };
        });

        socket.emit('online_users', { users: onlineUsersWithProfiles });
      } catch (error) {
        console.error('Get online users error:', error);
        socket.emit('error', { message: 'Failed to get online users' });
      }
    });

    // ユーザー詳細プロフィール要求
    socket.on('get_user_profile', async (data: { userId: string }) => {
      try {
        const { userId } = data;
        const profileData = await this.profileService.getDetailedProfile(userId);

        if (!profileData) {
          socket.emit('error', { message: 'User not found' });
          return;
        }

        socket.emit('user_profile', profileData);
      } catch (error) {
        console.error('Get user profile error:', error);
        socket.emit('error', { message: 'Failed to get user profile' });
      }
    });
  }

  public getUserSocketCount(userId: string): number {
    return this.userSockets.get(userId)?.size || 0;
  }

  public isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }

  public getOnlineUserIds(): string[] {
    return Array.from(this.userSockets.keys());
  }

  // 特定ユーザーの全ソケットにメッセージを送信
  public emitToUser(userId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, data);
    }
  }

  // 全ユーザーにブロードキャスト
  public broadcast(event: string, data: any): void {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  // 特定チャンネルにメッセージを送信
  public emitToChannel(channelId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`channel:${channelId}`).emit(event, data);
    }
  }
}