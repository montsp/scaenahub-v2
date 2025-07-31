import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth';
import { User } from '../types';

// Requestオブジェクトを拡張してユーザー情報を追加
declare global {
  namespace Express {
    interface Request {
      user?: Omit<User, 'passwordHash'>;
      userId?: string;
    }
  }
}

export class AuthMiddleware {
  private static authService = AuthService.getInstance();

  public static authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: 'Access token required'
        });
        return;
      }

      const token = authHeader.substring(7); // "Bearer " を除去

      // トークン検証
      const payload = AuthMiddleware.authService.verifyAccessToken(token);

      // ユーザー情報取得
      const user = await AuthMiddleware.authService.getUserById(payload.userId);

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      if (!user.isActive) {
        res.status(401).json({
          success: false,
          error: 'Account is inactive'
        });
        return;
      }

      if (user.isBanned) {
        res.status(403).json({
          success: false,
          error: 'Account is banned'
        });
        return;
      }

      // リクエストオブジェクトにユーザー情報を追加
      const sanitizedUser: Omit<User, 'passwordHash'> = {
        id: user.id,
        username: user.username,
        roles: user.roles,
        profile: user.profile,
        isActive: user.isActive,
        isBanned: user.isBanned,
        lastSeen: user.lastSeen,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };

      req.user = sanitizedUser;
      req.userId = user.id;

      next();
    } catch (error) {
      res.status(401).json({
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      });
    }
  };

  public static optional = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // 認証情報がない場合はそのまま続行
        next();
        return;
      }

      const token = authHeader.substring(7);

      try {
        const payload = AuthMiddleware.authService.verifyAccessToken(token);
        const user = await AuthMiddleware.authService.getUserById(payload.userId);

        if (user && user.isActive && !user.isBanned) {
          const sanitizedUser: Omit<User, 'passwordHash'> = {
            id: user.id,
            username: user.username,
            roles: user.roles,
            profile: user.profile,
            isActive: user.isActive,
            isBanned: user.isBanned,
            lastSeen: user.lastSeen,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
          };

          req.user = sanitizedUser;
          req.userId = user.id;
        }
      } catch (error) {
        // トークンが無効でも続行（オプショナル認証）
      }

      next();
    } catch (error) {
      next();
    }
  };

  public static requireRoles = (requiredRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const userRoles = req.user.roles;
      const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

      if (!hasRequiredRole) {
        res.status(403).json({
          success: false,
          error: `Required roles: ${requiredRoles.join(', ')}`
        });
        return;
      }

      next();
    };
  };

  public static requirePermission = (permission: keyof import('../types').RolePermissions) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      try {
        // RoleServiceを使用して権限チェック
        const { RoleService } = await import('../services/role');
        const roleService = RoleService.getInstance();

        const hasPermission = await roleService.hasPermission(req.user.roles, permission);

        if (hasPermission) {
          next();
          return;
        }

        res.status(403).json({
          success: false,
          error: `Permission required: ${permission}`
        });
      } catch (error) {
        console.error('Permission check error:', error);
        res.status(500).json({
          success: false,
          error: 'Permission check failed'
        });
      }
    };
  };
}
// 便利なエクスポート
export const authMiddleware = AuthMiddleware.authenticate;
export const optionalAuth = AuthMiddleware.optional;