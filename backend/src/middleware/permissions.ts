import { Request, Response, NextFunction } from 'express';
import { RoleService } from '../services/role';
import { RolePermissions } from '../types';

// auth.tsで既に型定義されているため、ここでは定義しない

export class PermissionMiddleware {
  private static roleService = RoleService.getInstance();

  // 特定の権限を要求するミドルウェア
  public static requirePermission = (permission: keyof RolePermissions) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      try {
        const hasPermission = await PermissionMiddleware.roleService.hasPermission(
          req.user.roles,
          permission
        );

        if (!hasPermission) {
          res.status(403).json({
            success: false,
            error: `Permission required: ${permission}`,
            requiredPermission: permission
          });
          return;
        }

        next();
      } catch (error) {
        console.error('Permission check error:', error);
        res.status(500).json({
          success: false,
          error: 'Permission check failed'
        });
      }
    };
  };

  // 複数の権限のうち1つでも持っていればOK
  public static requireAnyPermission = (permissions: (keyof RolePermissions)[]) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      try {
        let hasAnyPermission = false;
        
        for (const permission of permissions) {
          const hasPermission = await PermissionMiddleware.roleService.hasPermission(
            req.user.roles,
            permission
          );
          
          if (hasPermission) {
            hasAnyPermission = true;
            break;
          }
        }

        if (!hasAnyPermission) {
          res.status(403).json({
            success: false,
            error: `One of these permissions required: ${permissions.join(', ')}`,
            requiredPermissions: permissions
          });
          return;
        }

        next();
      } catch (error) {
        console.error('Permission check error:', error);
        res.status(500).json({
          success: false,
          error: 'Permission check failed'
        });
      }
    };
  };

  // 全ての権限を持っている必要がある
  public static requireAllPermissions = (permissions: (keyof RolePermissions)[]) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      try {
        const missingPermissions: string[] = [];
        
        for (const permission of permissions) {
          const hasPermission = await PermissionMiddleware.roleService.hasPermission(
            req.user.roles,
            permission
          );
          
          if (!hasPermission) {
            missingPermissions.push(permission);
          }
        }

        if (missingPermissions.length > 0) {
          res.status(403).json({
            success: false,
            error: `Missing permissions: ${missingPermissions.join(', ')}`,
            missingPermissions
          });
          return;
        }

        next();
      } catch (error) {
        console.error('Permission check error:', error);
        res.status(500).json({
          success: false,
          error: 'Permission check failed'
        });
      }
    };
  };

  // 特定のロールを管理する権限があるかチェック
  public static requireRoleManagement = (targetRoleIdParam: string = 'roleId') => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      try {
        const targetRoleId = req.params[targetRoleIdParam];
        
        if (!targetRoleId) {
          res.status(400).json({
            success: false,
            error: 'Target role ID is required'
          });
          return;
        }

        const canManage = await PermissionMiddleware.roleService.canManageRole(
          req.user.roles,
          targetRoleId
        );

        if (!canManage) {
          res.status(403).json({
            success: false,
            error: 'Insufficient permissions to manage this role'
          });
          return;
        }

        next();
      } catch (error) {
        console.error('Role management check error:', error);
        res.status(500).json({
          success: false,
          error: 'Role management check failed'
        });
      }
    };
  };

  // 管理者権限チェック（後方互換性のため）
  public static requireAdmin = () => {
    return PermissionMiddleware.requirePermission('manageServer');
  };

  // モデレーター権限チェック
  public static requireModerator = () => {
    return PermissionMiddleware.requireAnyPermission([
      'manageServer',
      'manageChannels',
      'manageMessages',
      'moderateMessages'
    ]);
  };

  // ユーザー管理権限チェック
  public static requireUserManagement = () => {
    return PermissionMiddleware.requireAnyPermission([
      'manageServer',
      'manageUsers'
    ]);
  };

  // チャンネル管理権限チェック
  public static requireChannelManagement = () => {
    return PermissionMiddleware.requireAnyPermission([
      'manageServer',
      'manageChannels'
    ]);
  };

  // 権限情報をレスポンスに追加するミドルウェア
  public static addPermissionInfo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next();
      return;
    }

    try {
      const roleService = PermissionMiddleware.roleService;
      const userRoles: any[] = [];
      for (const roleName of req.user.roles) {
        const role = await roleService.getRoleByName(roleName);
        if (role) {
          userRoles.push(role);
        }
      }
      const highestPosition = await roleService.getHighestPosition(req.user.roles);

      // 権限情報をリクエストオブジェクトに追加
      (req as any).permissions = {
        roles: userRoles,
        highestPosition,
        canManageServer: await roleService.hasPermission(req.user.roles, 'manageServer'),
        canManageChannels: await roleService.hasPermission(req.user.roles, 'manageChannels'),
        canManageRoles: await roleService.hasPermission(req.user.roles, 'manageRoles'),
        canManageUsers: await roleService.hasPermission(req.user.roles, 'manageUsers'),
        canModerateMessages: await roleService.hasPermission(req.user.roles, 'moderateMessages'),
        canKickMembers: await roleService.hasPermission(req.user.roles, 'kickMembers'),
        canBanMembers: await roleService.hasPermission(req.user.roles, 'banMembers')
      };

      next();
    } catch (error) {
      console.error('Add permission info error:', error);
      next(); // エラーが発生してもリクエストは続行
    }
  };

  // 権限チェック結果を返すヘルパー関数
  public static async checkUserPermissions(userRoles: string[]): Promise<{
    [K in keyof RolePermissions]: boolean;
  }> {
    const roleService = PermissionMiddleware.roleService;
    const permissions = {} as { [K in keyof RolePermissions]: boolean };

    const permissionKeys: (keyof RolePermissions)[] = [
      'manageServer', 'manageChannels', 'manageRoles', 'manageUsers',
      'viewChannels', 'sendMessages', 'sendFiles', 'embedLinks', 'mentionEveryone',
      'manageMessages', 'pinMessages', 'readMessageHistory',
      'kickMembers', 'banMembers', 'moderateMessages'
    ];

    for (const permission of permissionKeys) {
      permissions[permission] = await roleService.hasPermission(userRoles, permission);
    }

    return permissions;
  }
}