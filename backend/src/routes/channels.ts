import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { AuthMiddleware } from '../middleware/auth';
import { PermissionMiddleware } from '../middleware/permissions';
import { ChannelService } from '../services/channel';
import rateLimit from 'express-rate-limit';

const router = Router();
const channelService = ChannelService.getInstance();

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

// チャンネル一覧取得（権限チェック付き）
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const channelsWithPermissions = await channelService.getChannelsWithPermissions(
      req.user.roles,
      req.user.id
    );

    res.json({
      success: true,
      data: channelsWithPermissions,
      message: 'Channels retrieved successfully'
    });
  } catch (error) {
    console.error('Get channels error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve channels'
    });
  }
});

// カテゴリ管理ルート（具体的なルートを先に定義）
// カテゴリ一覧取得
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = await channelService.getAllCategories();

    res.json({
      success: true,
      data: categories,
      message: 'Categories retrieved successfully'
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve categories'
    });
  }
});

// チャンネル詳細取得
router.get('/:channelId', [
  param('channelId').isUUID().withMessage('Invalid channel ID format')
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

    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const { channelId } = req.params;
    
    if (!channelId) {
      res.status(400).json({
        success: false,
        error: 'Channel ID is required'
      });
      return;
    }
    
    const channel = await channelService.getChannelById(channelId);

    if (!channel) {
      res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
      return;
    }

    // 権限チェック
    const permissions = await channelService.checkChannelPermissions(
      channel,
      req.user.roles,
      req.user.id
    );

    if (!permissions.canView) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions to view this channel'
      });
      return;
    }

    res.json({
      success: true,
      data: {
        channel,
        userPermissions: permissions
      },
      message: 'Channel details retrieved successfully'
    });
  } catch (error) {
    console.error('Get channel details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve channel details'
    });
  }
});

// チャンネル作成
router.post('/', [
  body('name')
    .isLength({ min: 1, max: 50 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Channel name must be 1-50 characters and contain only letters, numbers, underscores, and hyphens'),
  body('description')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Description must be 200 characters or less'),
  body('type')
    .isIn(['text', 'announcement', 'discussion'])
    .withMessage('Type must be text, announcement, or discussion'),
  body('categoryId')
    .optional()
    .isUUID()
    .withMessage('Category ID must be a valid UUID'),
  body('position')
    .optional()
    .isInt({ min: 0, max: 1000 })
    .withMessage('Position must be between 0 and 1000'),
  body('isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate must be a boolean'),
  body('allowedRoles')
    .optional()
    .isArray()
    .withMessage('allowedRoles must be an array'),
  body('allowedUsers')
    .optional()
    .isArray()
    .withMessage('allowedUsers must be an array')
], PermissionMiddleware.requireChannelManagement(), async (req: Request, res: Response) => {
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

    const channelData = req.body;
    const channel = await channelService.createChannel(channelData);

    res.status(201).json({
      success: true,
      data: { channel },
      message: 'Channel created successfully'
    });
  } catch (error) {
    console.error('Create channel error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create channel'
    });
  }
});

// チャンネル更新
router.put('/:channelId', [
  param('channelId').isUUID().withMessage('Invalid channel ID format'),
  body('name')
    .optional()
    .isLength({ min: 1, max: 50 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Channel name must be 1-50 characters and contain only letters, numbers, underscores, and hyphens'),
  body('description')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Description must be 200 characters or less'),
  body('type')
    .optional()
    .isIn(['text', 'announcement', 'discussion'])
    .withMessage('Type must be text, announcement, or discussion'),
  body('categoryId')
    .optional()
    .isUUID()
    .withMessage('Category ID must be a valid UUID'),
  body('position')
    .optional()
    .isInt({ min: 0, max: 1000 })
    .withMessage('Position must be between 0 and 1000'),
  body('isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate must be a boolean'),
  body('allowedRoles')
    .optional()
    .isArray()
    .withMessage('allowedRoles must be an array'),
  body('allowedUsers')
    .optional()
    .isArray()
    .withMessage('allowedUsers must be an array')
], PermissionMiddleware.requireChannelManagement(), async (req: Request, res: Response) => {
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

    const { channelId } = req.params;
    const updates = req.body;

    if (!channelId) {
      res.status(400).json({
        success: false,
        error: 'Channel ID is required'
      });
      return;
    }

    const updatedChannel = await channelService.updateChannel(channelId, updates);

    res.json({
      success: true,
      data: { channel: updatedChannel },
      message: 'Channel updated successfully'
    });
  } catch (error) {
    console.error('Update channel error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update channel'
    });
  }
});

// チャンネル削除
router.delete('/:channelId', [
  param('channelId').isUUID().withMessage('Invalid channel ID format')
], PermissionMiddleware.requireChannelManagement(), async (req: Request, res: Response) => {
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

    const { channelId } = req.params;
    
    if (!channelId) {
      res.status(400).json({
        success: false,
        error: 'Channel ID is required'
      });
      return;
    }
    
    await channelService.deleteChannel(channelId);

    res.json({
      success: true,
      message: 'Channel deleted successfully'
    });
  } catch (error) {
    console.error('Delete channel error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete channel'
    });
  }
});

// チャンネル検索
router.post('/search', [
  body('query').optional().isString().isLength({ max: 100 }),
  body('type').optional().isIn(['text', 'announcement', 'discussion']),
  body('categoryId').optional().isUUID(),
  body('isPrivate').optional().isBoolean(),
  body('limit').optional().isInt({ min: 1, max: 100 }),
  body('offset').optional().isInt({ min: 0 }),
  body('sortBy').optional().isIn(['name', 'createdAt', 'position']),
  body('sortOrder').optional().isIn(['asc', 'desc'])
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

    const searchOptions = req.body;
    const result = await channelService.searchChannels(searchOptions);

    res.json({
      success: true,
      data: result,
      message: 'Channel search completed successfully'
    });
  } catch (error) {
    console.error('Channel search error:', error);
    res.status(500).json({
      success: false,
      error: 'Channel search failed'
    });
  }
});

// チャンネル統計情報取得
router.get('/statistics/overview', PermissionMiddleware.requireChannelManagement(), async (req: Request, res: Response) => {
  try {
    const statistics = await channelService.getChannelStatistics();

    res.json({
      success: true,
      data: statistics,
      message: 'Channel statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Get channel statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve channel statistics'
    });
  }
});

// カテゴリ作成
router.post('/categories', [
  body('name')
    .isLength({ min: 1, max: 50 })
    .matches(/^[a-zA-Z0-9_\s-]+$/)
    .withMessage('Category name must be 1-50 characters and contain only letters, numbers, spaces, underscores, and hyphens'),
  body('position')
    .optional()
    .isInt({ min: 0, max: 1000 })
    .withMessage('Position must be between 0 and 1000')
], PermissionMiddleware.requireChannelManagement(), async (req: Request, res: Response) => {
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

    const categoryData = req.body;
    const category = await channelService.createCategory(categoryData);

    res.status(201).json({
      success: true,
      data: { category },
      message: 'Category created successfully'
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create category'
    });
  }
});

// カテゴリ更新
router.put('/categories/:categoryId', [
  param('categoryId').isUUID().withMessage('Invalid category ID format'),
  body('name')
    .optional()
    .isLength({ min: 1, max: 50 })
    .matches(/^[a-zA-Z0-9_\s-]+$/)
    .withMessage('Category name must be 1-50 characters and contain only letters, numbers, spaces, underscores, and hyphens'),
  body('position')
    .optional()
    .isInt({ min: 0, max: 1000 })
    .withMessage('Position must be between 0 and 1000')
], PermissionMiddleware.requireChannelManagement(), async (req: Request, res: Response) => {
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

    const { categoryId } = req.params;
    const updates = req.body;

    if (!categoryId) {
      res.status(400).json({
        success: false,
        error: 'Category ID is required'
      });
      return;
    }

    const updatedCategory = await channelService.updateCategory(categoryId, updates);

    res.json({
      success: true,
      data: { category: updatedCategory },
      message: 'Category updated successfully'
    });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update category'
    });
  }
});

// カテゴリ削除
router.delete('/categories/:categoryId', [
  param('categoryId').isUUID().withMessage('Invalid category ID format')
], PermissionMiddleware.requireChannelManagement(), async (req: Request, res: Response) => {
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

    const { categoryId } = req.params;
    
    if (!categoryId) {
      res.status(400).json({
        success: false,
        error: 'Category ID is required'
      });
      return;
    }
    
    await channelService.deleteCategory(categoryId);

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete category'
    });
  }
});

// カテゴリ詳細取得
router.get('/categories/:categoryId', [
  param('categoryId').isUUID().withMessage('Invalid category ID format')
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

    const { categoryId } = req.params;
    
    if (!categoryId) {
      res.status(400).json({
        success: false,
        error: 'Category ID is required'
      });
      return;
    }
    
    const category = await channelService.getCategoryById(categoryId);

    if (!category) {
      res.status(404).json({
        success: false,
        error: 'Category not found'
      });
      return;
    }

    res.json({
      success: true,
      data: { category },
      message: 'Category details retrieved successfully'
    });
  } catch (error) {
    console.error('Get category details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve category details'
    });
  }
});

export default router;