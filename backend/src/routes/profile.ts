import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { AuthMiddleware } from '../middleware/auth';
import { ProfileService } from '../services/profile';
import rateLimit from 'express-rate-limit';

const router = Router();
const profileService = ProfileService.getInstance();

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

// オンラインステータス更新
router.put('/status', [
  body('status')
    .isIn(['online', 'away', 'busy', 'offline'])
    .withMessage('Invalid online status')
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

    const { status } = req.body;
    const userId = req.userId!;

    const updatedUser = await profileService.updateOnlineStatus(userId, status);

    res.json({
      success: true,
      data: {
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          profile: updatedUser.profile
        }
      },
      message: 'Online status updated successfully'
    });
  } catch (error) {
    console.error('Update online status error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update online status'
    });
  }
});

// カスタムステータス設定
router.put('/custom-status', [
  body('text')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Custom status text must be 100 characters or less'),
  body('emoji')
    .optional()
    .isLength({ max: 10 })
    .withMessage('Custom status emoji is too long'),
  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Invalid expiration date format')
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

    const { text, emoji, expiresAt } = req.body;
    const userId = req.userId!;

    let customStatus: { text: string; emoji?: string; expiresAt?: Date } | null = null;
    if (text) {
      const statusData: { text: string; emoji?: string; expiresAt?: Date } = { text };
      if (emoji) statusData.emoji = emoji;
      if (expiresAt) statusData.expiresAt = new Date(expiresAt);
      customStatus = statusData;
    }

    const updatedUser = await profileService.setCustomStatus(userId, customStatus);

    res.json({
      success: true,
      data: {
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          profile: updatedUser.profile
        }
      },
      message: customStatus ? 'Custom status set successfully' : 'Custom status cleared successfully'
    });
  } catch (error) {
    console.error('Set custom status error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set custom status'
    });
  }
});

// 自己紹介文更新
router.put('/bio', [
  body('bio')
    .isLength({ max: 500 })
    .withMessage('Bio must be 500 characters or less')
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

    const { bio } = req.body;
    const userId = req.userId!;

    const updatedUser = await profileService.updateBio(userId, bio);

    res.json({
      success: true,
      data: {
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          profile: updatedUser.profile
        }
      },
      message: 'Bio updated successfully'
    });
  } catch (error) {
    console.error('Update bio error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update bio'
    });
  }
});

// アバター更新
router.put('/avatar', [
  body('avatarUrl')
    .optional()
    .isURL()
    .withMessage('Invalid avatar URL')
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

    const { avatarUrl } = req.body;
    const userId = req.userId!;

    const updatedUser = await profileService.updateAvatar(userId, avatarUrl || '');

    res.json({
      success: true,
      data: {
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          profile: updatedUser.profile
        }
      },
      message: 'Avatar updated successfully'
    });
  } catch (error) {
    console.error('Update avatar error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update avatar'
    });
  }
});

// 表示名更新
router.put('/display-name', [
  body('displayName')
    .isLength({ min: 1, max: 100 })
    .withMessage('Display name must be between 1 and 100 characters')
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

    const { displayName } = req.body;
    const userId = req.userId!;

    const updatedUser = await profileService.updateDisplayName(userId, displayName);

    res.json({
      success: true,
      data: {
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          profile: updatedUser.profile
        }
      },
      message: 'Display name updated successfully'
    });
  } catch (error) {
    console.error('Update display name error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update display name'
    });
  }
});

// オンラインユーザー一覧取得
router.get('/online-users', async (req: Request, res: Response) => {
  try {
    const onlineUsers = profileService.getOnlineUsers();
    
    // ユーザー詳細情報を取得
    const userIds = onlineUsers.map(u => u.userId);
    const usersWithProfiles = await profileService.getUsersWithProfiles(userIds);

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

    res.json({
      success: true,
      data: { onlineUsers: onlineUsersWithProfiles },
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

// ユーザー検索（表示名ベース）
router.get('/search', [
  query('q')
    .isLength({ min: 2, max: 50 })
    .withMessage('Search query must be between 2 and 50 characters'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Limit must be between 1 and 20')
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

    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 10;

    const users = await profileService.searchUsersByDisplayName(query, limit);

    res.json({
      success: true,
      data: { users },
      message: 'User search completed successfully'
    });
  } catch (error) {
    console.error('User search error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'User search failed'
    });
  }
});

// 詳細プロフィール取得
router.get('/:userId', [
  param('userId')
    .isUUID()
    .withMessage('Invalid user ID format')
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

    const userId = req.params.userId;
    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
      return;
    }
    
    const profileData = await profileService.getDetailedProfile(userId);

    if (!profileData) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      data: profileData,
      message: 'User profile retrieved successfully'
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user profile'
    });
  }
});

// アクティビティ更新（ハートビート）
router.post('/activity', async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    profileService.updateUserActivity(userId);

    res.json({
      success: true,
      message: 'Activity updated successfully'
    });
  } catch (error) {
    console.error('Update activity error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update activity'
    });
  }
});

export default router;