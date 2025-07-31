import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { AuthMiddleware } from '../middleware/auth';
import { RoleService } from '../services/role';
import { RolePermissions } from '../types';
import rateLimit from 'express-rate-limit';

const router = Router();
const roleService = RoleService.getInstance();

// レート制限設定
const generalRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1分
  max: parseInt(process.env.RATE_LIMIT_API || '60'), // 60回まで
  message: {
    success: false,
    error: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 全てのルートに認証を適用
router.use(AuthMiddleware.authenticate);
router.use(generalRateLimit);

// ロール一覧取得
router.get('/', async (req: Request, res: Response) => {
  try {
    const roles = await roleService.getAllRoles();

    res.json({
      success: true,
      data: { roles },
      message: 'Roles retrieved successfully'
    });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve roles'
    });
  }
});

// ユーザー付きロール一覧取得
router.get('/with-users', AuthMiddleware.requireRoles(['admin', 'moderator']), async (req: Request, res: Response) => {
  try {
    const rolesWithUsers = await roleService.getRolesWithUsers();

    res.json({
      success: true,
      data: { roles: rolesWithUsers },
      message: 'Roles with users retrieved successfully'
    });
  } catch (error) {
    console.error('Get roles with users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve roles with users'
    });
  }
});

// 権限マトリックス取得
router.get('/permissions', AuthMiddleware.requireRoles(['admin']), async (req: Request, res: Response) => {
  try {
    const permissionMatrix = await roleService.getPermissionMatrix();

    res.json({
      success: true,
      data: permissionMatrix,
      message: 'Permission matrix retrieved successfully'
    });
  } catch (error) {
    console.error('Get permission matrix error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve permission matrix'
    });
  }
});

// ロール作成
router.post('/', AuthMiddleware.requireRoles(['admin']), [
  body('name')
    .isLength({ min: 1, max: 50 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Role name must be 1-50 characters and contain only letters, numbers, underscores, and hyphens'),
  body('color')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Color must be a valid hex color code'),
  body('position')
    .optional()
    .isInt({ min: 0, max: 1000 })
    .withMessage('Position must be between 0 and 1000'),
  body('mentionable')
    .optional()
    .isBoolean()
    .withMessage('Mentionable must be a boolean')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const { name, color, position, permissions, mentionable } = req.body;

    // 権限チェック - 管理者のみロール作成可能
    const hasPermission = await roleService.hasPermission(req.user!.roles, 'manageRoles');
    if (!hasPermission) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions to create roles'
      });
      return;
    }

    const role = await roleService.createRole({
      name,
      color,
      position,
      permissions,
      mentionable
    });

    res.status(201).json({
      success: true,
      data: { role },
      message: 'Role created successfully'
    });
  } catch (error) {
    console.error('Create role error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create role'
    });
  }
});

// ロール更新
router.put('/:roleId', AuthMiddleware.requireRoles(['admin']), [
  param('roleId')
    .isUUID()
    .withMessage('Invalid role ID format'),
  body('name')
    .optional()
    .isLength({ min: 1, max: 50 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Role name must be 1-50 characters and contain only letters, numbers, underscores, and hyphens'),
  body('color')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Color must be a valid hex color code'),
  body('position')
    .optional()
    .isInt({ min: 0, max: 1000 })
    .withMessage('Position must be between 0 and 1000'),
  body('mentionable')
    .optional()
    .isBoolean()
    .withMessage('Mentionable must be a boolean')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const { roleId } = req.params;
    const { name, color, position, permissions, mentionable } = req.body;

    if (!roleId) {
      res.status(400).json({
        success: false,
        error: 'Role ID is required'
      });
      return;
    }

    // 権限チェック
    const hasPermission = await roleService.hasPermission(req.user!.roles, 'manageRoles');
    if (!hasPermission) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions to update roles'
      });
      return;
    }

    // 対象ロールの管理権限チェック
    const role = await roleService.getRoleById(roleId);
    if (!role) {
      res.status(404).json({
        success: false,
        error: 'Role not found'
      });
      return;
    }

    const canManage = await roleService.canManageRole(req.user!.roles, role.name);
    if (!canManage) {
      res.status(403).json({
        success: false,
        error: 'Cannot manage role with equal or higher position'
      });
      return;
    }

    const updatedRole = await roleService.updateRole(roleId, {
      name,
      color,
      position,
      permissions,
      mentionable
    });

    res.json({
      success: true,
      data: { role: updatedRole },
      message: 'Role updated successfully'
    });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update role'
    });
  }
});

// ロール削除
router.delete('/:roleId', AuthMiddleware.requireRoles(['admin']), [
  param('roleId')
    .isUUID()
    .withMessage('Invalid role ID format')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const { roleId } = req.params;

    if (!roleId) {
      res.status(400).json({
        success: false,
        error: 'Role ID is required'
      });
      return;
    }

    // 権限チェック
    const hasPermission = await roleService.hasPermission(req.user!.roles, 'manageRoles');
    if (!hasPermission) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions to delete roles'
      });
      return;
    }

    // 対象ロールの管理権限チェック
    const role = await roleService.getRoleById(roleId);
    if (!role) {
      res.status(404).json({
        success: false,
        error: 'Role not found'
      });
      return;
    }

    const canManage = await roleService.canManageRole(req.user!.roles, role.name);
    if (!canManage) {
      res.status(403).json({
        success: false,
        error: 'Cannot delete role with equal or higher position'
      });
      return;
    }

    await roleService.deleteRole(roleId);

    res.json({
      success: true,
      message: 'Role deleted successfully'
    });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete role'
    });
  }
});

// 特定ロール取得
router.get('/:roleId', [
  param('roleId')
    .isUUID()
    .withMessage('Invalid role ID format')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const { roleId } = req.params;
    
    if (!roleId) {
      res.status(400).json({
        success: false,
        error: 'Role ID is required'
      });
      return;
    }
    
    const role = await roleService.getRoleById(roleId);

    if (!role) {
      res.status(404).json({
        success: false,
        error: 'Role not found'
      });
      return;
    }

    res.json({
      success: true,
      data: { role },
      message: 'Role retrieved successfully'
    });
  } catch (error) {
    console.error('Get role error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve role'
    });
  }
});

// ユーザーにロール割り当て
router.post('/assign', AuthMiddleware.requireRoles(['admin', 'moderator']), [
  body('userId')
    .isUUID()
    .withMessage('Invalid user ID format'),
  body('roleName')
    .isLength({ min: 1, max: 50 })
    .withMessage('Role name is required')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const { userId, roleName } = req.body;

    // 権限チェック
    const hasPermission = await roleService.hasPermission(req.user!.roles, 'manageUsers');
    if (!hasPermission) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions to assign roles'
      });
      return;
    }

    // 対象ユーザーの管理権限チェック
    const canManageUser = await roleService.canManageUser(req.user!.roles, userId);
    if (!canManageUser) {
      res.status(403).json({
        success: false,
        error: 'Cannot manage user with equal or higher role position'
      });
      return;
    }

    // 対象ロールの管理権限チェック
    const canManageRole = await roleService.canManageRole(req.user!.roles, roleName);
    if (!canManageRole) {
      res.status(403).json({
        success: false,
        error: 'Cannot assign role with equal or higher position'
      });
      return;
    }

    const updatedUser = await roleService.assignRoleToUser(userId, roleName);

    res.json({
      success: true,
      data: {
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          roles: updatedUser.roles,
          profile: updatedUser.profile
        }
      },
      message: 'Role assigned successfully'
    });
  } catch (error) {
    console.error('Assign role error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign role'
    });
  }
});

// ユーザーからロール削除
router.post('/remove', AuthMiddleware.requireRoles(['admin', 'moderator']), [
  body('userId')
    .isUUID()
    .withMessage('Invalid user ID format'),
  body('roleName')
    .isLength({ min: 1, max: 50 })
    .withMessage('Role name is required')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const { userId, roleName } = req.body;

    // 権限チェック
    const hasPermission = await roleService.hasPermission(req.user!.roles, 'manageUsers');
    if (!hasPermission) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions to remove roles'
      });
      return;
    }

    // 対象ユーザーの管理権限チェック
    const canManageUser = await roleService.canManageUser(req.user!.roles, userId);
    if (!canManageUser) {
      res.status(403).json({
        success: false,
        error: 'Cannot manage user with equal or higher role position'
      });
      return;
    }

    // 対象ロールの管理権限チェック
    const canManageRole = await roleService.canManageRole(req.user!.roles, roleName);
    if (!canManageRole) {
      res.status(403).json({
        success: false,
        error: 'Cannot remove role with equal or higher position'
      });
      return;
    }

    const updatedUser = await roleService.removeRoleFromUser(userId, roleName);

    res.json({
      success: true,
      data: {
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          roles: updatedUser.roles,
          profile: updatedUser.profile
        }
      },
      message: 'Role removed successfully'
    });
  } catch (error) {
    console.error('Remove role error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove role'
    });
  }
});

// ユーザーのロール一括設定
router.put('/user/:userId', AuthMiddleware.requireRoles(['admin']), [
  param('userId')
    .isUUID()
    .withMessage('Invalid user ID format'),
  body('roles')
    .isArray({ min: 1 })
    .withMessage('Roles must be a non-empty array'),
  body('roles.*')
    .isString()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each role name must be a valid string')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const { userId } = req.params;
    const { roles } = req.body;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
      return;
    }

    // 権限チェック
    const hasPermission = await roleService.hasPermission(req.user!.roles, 'manageUsers');
    if (!hasPermission) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions to set user roles'
      });
      return;
    }

    // 対象ユーザーの管理権限チェック
    const canManageUser = await roleService.canManageUser(req.user!.roles, userId);
    if (!canManageUser) {
      res.status(403).json({
        success: false,
        error: 'Cannot manage user with equal or higher role position'
      });
      return;
    }

    // 各ロールの管理権限チェック
    for (const roleName of roles) {
      const canManageRole = await roleService.canManageRole(req.user!.roles, roleName);
      if (!canManageRole) {
        res.status(403).json({
          success: false,
          error: `Cannot assign role '${roleName}' with equal or higher position`
        });
        return;
      }
    }

    const updatedUser = await roleService.setUserRoles(userId, roles);

    res.json({
      success: true,
      data: {
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          roles: updatedUser.roles,
          profile: updatedUser.profile
        }
      },
      message: 'User roles updated successfully'
    });
  } catch (error) {
    console.error('Set user roles error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set user roles'
    });
  }
});

export default router;