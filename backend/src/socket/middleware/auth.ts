import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import { AuthService } from '../../services/auth';
import { UserService } from '../../services/user';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
  userRoles?: string[];
}

export class SocketAuthMiddleware {
  private authService: AuthService;
  private userService: UserService;

  constructor() {
    this.authService = AuthService.getInstance();
    this.userService = UserService.getInstance();
  }

  // Socket.io認証ミドルウェア
  public authenticate() {
    return async (socket: AuthenticatedSocket, next: (err?: ExtendedError) => void) => {
      try {
        // トークンを取得（複数の方法をサポート）
        const token = this.extractToken(socket);

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // トークン検証
        const payload = this.authService.verifyAccessToken(token);
        if (!payload || !payload.userId) {
          return next(new Error('Invalid authentication token'));
        }

        // ユーザー情報取得
        const user = await this.authService.getUserById(payload.userId);
        if (!user) {
          return next(new Error('User not found'));
        }

        // ユーザー状態チェック
        if (!user.isActive) {
          return next(new Error('User account is inactive'));
        }

        if (user.isBanned) {
          return next(new Error('User account is banned'));
        }

        // Socket情報を設定
        socket.userId = user.id;
        socket.username = user.username;
        socket.userRoles = user.roles;

        console.log(`Socket authenticated for user: ${user.username} (${user.id})`);
        next();

      } catch (error) {
        console.error('Socket authentication error:', error);
        
        if (error instanceof Error) {
          if (error.message.includes('expired')) {
            return next(new Error('Authentication token expired'));
          } else if (error.message.includes('invalid')) {
            return next(new Error('Invalid authentication token'));
          }
        }
        
        return next(new Error('Authentication failed'));
      }
    };
  }

  // トークン抽出（複数の方法をサポート）
  private extractToken(socket: AuthenticatedSocket): string | null {
    // 1. handshake.auth.token から取得
    if (socket.handshake.auth?.token) {
      return socket.handshake.auth.token;
    }

    // 2. handshake.headers.authorization から取得
    const authHeader = socket.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // 3. クエリパラメータから取得
    const queryToken = socket.handshake.query?.token;
    if (typeof queryToken === 'string') {
      return queryToken;
    }

    // 4. Cookieから取得（オプション）
    const cookies = socket.handshake.headers.cookie;
    if (cookies) {
      const tokenMatch = cookies.match(/token=([^;]+)/);
      if (tokenMatch && tokenMatch[1]) {
        return tokenMatch[1];
      }
    }

    return null;
  }

  // 権限チェックミドルウェア
  public requirePermission(permission: string) {
    return async (socket: AuthenticatedSocket, next: (err?: ExtendedError) => void) => {
      try {
        if (!socket.userId || !socket.userRoles) {
          return next(new Error('Authentication required'));
        }

        // 権限チェック（RoleServiceを使用）
        const { RoleService } = await import('../../services/role');
        const roleService = RoleService.getInstance();
        
        const hasPermission = await roleService.hasPermission(socket.userRoles, permission as any);
        
        if (!hasPermission) {
          return next(new Error(`Permission denied: ${permission} required`));
        }

        next();

      } catch (error) {
        console.error('Socket permission check error:', error);
        return next(new Error('Permission check failed'));
      }
    };
  }

  // 管理者権限チェック
  public requireAdmin() {
    return this.requirePermission('manageServer');
  }

  // モデレーター権限チェック
  public requireModerator() {
    return async (socket: AuthenticatedSocket, next: (err?: ExtendedError) => void) => {
      try {
        if (!socket.userId || !socket.userRoles) {
          return next(new Error('Authentication required'));
        }

        const { RoleService } = await import('../../services/role');
        const roleService = RoleService.getInstance();
        
        const hasModeratorPermission = await roleService.hasPermission(socket.userRoles, 'manageMessages') ||
                                      await roleService.hasPermission(socket.userRoles, 'manageChannels') ||
                                      await roleService.hasPermission(socket.userRoles, 'manageServer');
        
        if (!hasModeratorPermission) {
          return next(new Error('Moderator permission required'));
        }

        next();

      } catch (error) {
        console.error('Socket moderator check error:', error);
        return next(new Error('Permission check failed'));
      }
    };
  }

  // レート制限ミドルウェア
  public rateLimit(maxRequests: number, windowMs: number) {
    const requests = new Map<string, { count: number; resetTime: number }>();

    return (socket: AuthenticatedSocket, next: (err?: ExtendedError) => void) => {
      const userId = socket.userId;
      if (!userId) {
        return next(new Error('Authentication required'));
      }

      const now = Date.now();
      const userRequests = requests.get(userId);

      if (!userRequests || now > userRequests.resetTime) {
        // 新しいウィンドウまたは期限切れ
        requests.set(userId, {
          count: 1,
          resetTime: now + windowMs
        });
        return next();
      }

      if (userRequests.count >= maxRequests) {
        return next(new Error('Rate limit exceeded'));
      }

      userRequests.count++;
      next();
    };
  }

  // エラーハンドリングミドルウェア
  public errorHandler() {
    return (socket: AuthenticatedSocket, next: (err?: ExtendedError) => void) => {
      socket.on('error', (error: Error) => {
        console.error(`Socket error for user ${socket.username}:`, error);
        
        // クライアントにエラー情報を送信
        socket.emit('error', {
          message: error.message,
          timestamp: new Date().toISOString()
        });
      });

      // 未処理の例外をキャッチ
      socket.onAny((eventName, ...args) => {
        try {
          // イベント処理のログ
          console.log(`Socket event: ${eventName} from user ${socket.username}`);
        } catch (error) {
          console.error(`Unhandled error in socket event ${eventName}:`, error);
          socket.emit('error', {
            message: 'Internal server error',
            timestamp: new Date().toISOString()
          });
        }
      });

      next();
    };
  }

  // 接続制限チェック
  public connectionLimit(maxConnections: number) {
    const userConnections = new Map<string, number>();

    return (socket: AuthenticatedSocket, next: (err?: ExtendedError) => void) => {
      const userId = socket.userId;
      if (!userId) {
        return next(new Error('Authentication required'));
      }

      const currentConnections = userConnections.get(userId) || 0;
      
      if (currentConnections >= maxConnections) {
        return next(new Error('Maximum connections exceeded'));
      }

      // 接続数を増加
      userConnections.set(userId, currentConnections + 1);

      // 切断時に接続数を減少
      socket.on('disconnect', () => {
        const connections = userConnections.get(userId) || 0;
        if (connections <= 1) {
          userConnections.delete(userId);
        } else {
          userConnections.set(userId, connections - 1);
        }
      });

      next();
    };
  }
}