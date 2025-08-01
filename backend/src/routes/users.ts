import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { AuthMiddleware } from '../middleware/auth';
import { PermissionMiddleware } from '../middleware/permissions';
import { UserService } from '../services/user';
import { DataSyncService } from '../services/database/sync';
import rateLimit from 'express-rate-limit';

const router = Router();
const syncService = DataSyncService.getInstance();
const userService = UserService.getInstance();

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

// ユーザー一覧取得
router.get('/', [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Search term must be 50 characters or less'),
  query('role')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Role filter must be 50 characters or less')
], async (req: Request, res: Response) => {
  try {
    // バリデーションエラーチェック
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const roleFilter = req.query.role as string;
    const offset = (page - 1) * limit;

    // クエリ構築
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (username LIKE ? OR display_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (roleFilter) {
      whereClause += ' AND JSON_CONTAINS(roles, ?)';
      params.push(`"${roleFilter}"`);
    }

    // 総数取得
    const countQuery = `SELECT COUNT(*) as total FROM users_cache ${whereClause}`;
    const countResult = syncService.readData<{ total: number }>('users', countQuery, params);
    const total = countResult[0]?.total || 0;

    // ユーザー一覧取得
    const usersQuery = `
      SELECT id, username, roles, display_name, avatar, bio, 
             online_status, custom_status, is_active, is_banned, 
             last_seen, created_at, updated_at
      FROM users_cache 
      ${whereClause} 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    const usersData = syncService.readData<any>('users', usersQuery, [...params, limit, offset]);

    // データ変換
    const users = usersData.map(userData => ({
      id: userData.id,
      username: userData.username,
      roles: JSON.parse(userData.roles || '["member"]'),
      profile: {
        displayName: userData.display_name,
        avatar: userData.avatar,
        bio: userData.bio,
        onlineStatus: userData.online_status,
        customStatus: userData.custom_status ? JSON.parse(userData.custom_status) : undefined
      },
      isActive: userData.is_active,
      isBanned: userData.is_banned,
      lastSeen: new Date(userData.last_seen),
      createdAt: new Date(userData.created_at),
      updatedAt: new Date(userData.updated_at)
    }));

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      },
      message: 'Users retrieved successfully'
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve users'
    });
  }
});

// オンラインユーザー一覧取得
router.get('/online/list', async (req: Request, res: Response) => {
  try {
    const onlineUsers = syncService.readData<any>('users',
      `SELECT id, username, display_name, avatar, online_status, custom_status, roles
       FROM users_cache 
       WHERE online_status IN ('online', 'away', 'busy') AND is_active = 1 AND is_banned = 0
       ORDER BY online_status, display_name`
    );

    const users = onlineUsers.map(userData => ({
      id: userData.id,
      username: userData.username,
      profile: {
        displayName: userData.display_name,
        avatar: userData.avatar,
        onlineStatus: userData.online_status,
        customStatus: userData.custom_status ? JSON.parse(userData.custom_status) : undefined
      },
      roles: JSON.parse(userData.roles || '["member"]')
    }));

    res.json({
      success: true,
      data: { users },
      message: 'Online users retrieved successfully'
    });
  } catch (error) {
    console.error('Get online users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve online users'
    });
  }
});

// ユーザー検索
router.get('/search/:searchQuery', [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
], async (req: Request, res: Response) => {
  try {
    // バリデーションエラーチェック
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const searchQuery = req.params.searchQuery;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!searchQuery || searchQuery.length < 2) {
      res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters'
      });
      return;
    }

    const usersData = syncService.readData<any>('users',
      `SELECT id, username, display_name, avatar, online_status, roles
       FROM users_cache 
       WHERE (username LIKE ? OR display_name LIKE ?) 
         AND is_active = 1 AND is_banned = 0
       ORDER BY 
         CASE WHEN username = ? THEN 1
              WHEN username LIKE ? THEN 2
              WHEN display_name = ? THEN 3
              WHEN display_name LIKE ? THEN 4
              ELSE 5 END,
         username
       LIMIT ?`,
      [
        `%${searchQuery}%`, `%${searchQuery}%`,
        searchQuery, `${searchQuery}%`,
        searchQuery, `${searchQuery}%`,
        limit
      ]
    );

    const users = usersData.map(userData => ({
      id: userData.id,
      username: userData.username,
      profile: {
        displayName: userData.display_name,
        avatar: userData.avatar,
        onlineStatus: userData.online_status
      },
      roles: JSON.parse(userData.roles || '["member"]')
    }));

    res.json({
      success: true,
      data: { users },
      message: 'User search completed successfully'
    });
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({
      success: false,
      error: 'User search failed'
    });
  }
});

// 特定ユーザー情報取得（最後に配置）
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const usersData = syncService.readData<any>('users',
      'SELECT id, username, roles, display_name, avatar, bio, online_status, custom_status, is_active, is_banned, last_seen, created_at, updated_at FROM users_cache WHERE id = ?',
      [userId]
    );

    if (usersData.length === 0) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    const userData = usersData[0];
    const user = {
      id: userData.id,
      username: userData.username,
      roles: JSON.parse(userData.roles || '["member"]'),
      profile: {
        displayName: userData.display_name,
        avatar: userData.avatar,
        bio: userData.bio,
        onlineStatus: userData.online_status,
        customStatus: userData.custom_status ? JSON.parse(userData.custom_status) : undefined
      },
      isActive: userData.is_active,
      isBanned: userData.is_banned,
      lastSeen: new Date(userData.last_seen),
      createdAt: new Date(userData.created_at),
      updatedAt: new Date(userData.updated_at)
    };

    res.json({
      success: true,
      data: { user },
      message: 'User retrieved successfully'
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user'
    });
  }
});

// ユーザーロール管理
router.put('/:userId/roles', [
  param('userId').isUUID().withMessage('Invalid user ID format'),
  body('roles')
    .isArray({ min: 1 })
    .withMessage('Roles must be a non-empty array'),
  body('roles.*')
    .isString()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each role must be a string between 1 and 50 characters')
], PermissionMiddleware.requireUserManagement(), async (req: Request, res: Response) => {
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

    const updatedUser = await userService.updateUserRoles(userId, roles);

    res.json({
      success: true,
      data: { user: updatedUser },
      message: 'User roles updated successfully'
    });
  } catch (error) {
    console.error('Update user roles error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update user roles'
    });
  }
});

// ユーザーにロール追加
router.post('/:userId/roles/:roleName', [
  param('userId').isUUID().withMessage('Invalid user ID format'),
  param('roleName')
    .isString()
    .isLength({ min: 1, max: 50 })
    .withMessage('Role name must be between 1 and 50 characters')
], PermissionMiddleware.requireUserManagement(), async (req: Request, res: Response) => {
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

    const { userId, roleName } = req.params;

    if (!userId || !roleName) {
      res.status(400).json({
        success: false,
        error: 'User ID and role name are required'
      });
      return;
    }

    await userService.assignRoleToUser(userId, roleName);

    res.json({
      success: true,
      message: `Role '${roleName}' assigned to user successfully`
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
router.delete('/:userId/roles/:roleName', [
  param('userId').isUUID().withMessage('Invalid user ID format'),
  param('roleName')
    .isString()
    .isLength({ min: 1, max: 50 })
    .withMessage('Role name must be between 1 and 50 characters')
], PermissionMiddleware.requireUserManagement(), async (req: Request, res: Response) => {
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

    const { userId, roleName } = req.params;

    await userService.removeRoleFromUser(userId!, roleName!);

    res.json({
      success: true,
      message: `Role '${roleName}' removed from user successfully`
    });
  } catch (error) {
    console.error('Remove role error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove role'
    });
  }
});

// ユーザー詳細（ロール情報含む）取得
router.get('/:userId/details', [
  param('userId').isUUID().withMessage('Invalid user ID format')
], PermissionMiddleware.requireAnyPermission(['manageUsers', 'manageServer']), async (req: Request, res: Response) => {
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
    const userWithRoles = await userService.getUserWithRoles(userId!);

    if (!userWithRoles) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      data: { user: userWithRoles },
      message: 'User details retrieved successfully'
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user details'
    });
  }
});

// ユーザー統計情報取得
router.get('/statistics/overview', PermissionMiddleware.requireAnyPermission(['manageUsers', 'manageServer']), async (req: Request, res: Response) => {
  try {
    const statistics = await userService.getUserStatistics();

    res.json({
      success: true,
      data: statistics,
      message: 'User statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Get user statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user statistics'
    });
  }
});

// 高度なユーザー検索
router.post('/search/advanced', [
  body('query').optional().isString().isLength({ max: 100 }),
  body('roles').optional().isArray(),
  body('roles.*').optional().isString(),
  body('isActive').optional().isBoolean(),
  body('limit').optional().isInt({ min: 1, max: 100 }),
  body('offset').optional().isInt({ min: 0 }),
  body('sortBy').optional().isIn(['username', 'displayName', 'createdAt', 'lastActive']),
  body('sortOrder').optional().isIn(['asc', 'desc'])
], PermissionMiddleware.requireAnyPermission(['manageUsers', 'manageServer']), async (req: Request, res: Response) => {
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

    const searchOptions = req.body;
    const result = await userService.searchUsers(searchOptions);

    res.json({
      success: true,
      data: result,
      message: 'Advanced user search completed successfully'
    });
  } catch (error) {
    console.error('Advanced user search error:', error);
    res.status(500).json({
      success: false,
      error: 'Advanced user search failed'
    });
  }
});

// ユーザー検索（メンション用）
router.get('/search', [
  query('query')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Search query must be 50 characters or less')
], async (req: Request, res: Response): Promise<void> => {
  try {
    // バリデーションエラーチェック
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
      return;
    }

    const { query: searchQuery } = req.query;
    const searchTerm = searchQuery as string || '';

    // SQLiteServiceを直接使用
    const sqliteService = require('../services/database/sqlite').SQLiteService.getInstance();
    
    // ユーザー検索（ユーザー名と表示名で検索）
    const users = sqliteService.query(
      `SELECT id, username, display_name, avatar, online_status
       FROM users_cache
       WHERE (username LIKE ? OR display_name LIKE ?) 
       AND is_active = 1
       ORDER BY username ASC
       LIMIT 10`,
      [`%${searchTerm}%`, `%${searchTerm}%`]
    );

    const formattedUsers = users.map((user: any) => ({
      id: user.id,
      username: user.username,
      displayName: user.display_name || user.username,
      avatarUrl: user.avatar,
      onlineStatus: user.online_status || 'offline'
    }));

    res.json({
      success: true,
      data: formattedUsers
    });
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({
      success: false,
      error: 'User search failed'
    });
  }
});

export default router;