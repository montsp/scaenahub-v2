import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthService } from '../services/auth';
import { AuthMiddleware } from '../middleware/auth';
import rateLimit from 'express-rate-limit';

const router = Router();
const authService = AuthService.getInstance();

// レート制限設定
const authRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5分
  max: parseInt(process.env.RATE_LIMIT_AUTH || '5'), // 5回まで
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

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

// バリデーションルール
const registerValidation = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username must be 3-50 characters and contain only letters, numbers, underscores, and hyphens'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),

  body('displayName')
    .isLength({ min: 1, max: 100 })
    .withMessage('Display name must be 1-100 characters'),
  body('registrationKey')
    .notEmpty()
    .withMessage('Registration key is required')
];

const loginValidation = [
  body('username')
    .notEmpty()
    .withMessage('Username is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
];

// ユーザー登録
router.post('/register', authRateLimit, registerValidation, async (req: Request, res: Response) => {
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

    const { username, password, displayName, registrationKey } = req.body;

    const result = await authService.register({
      username,
      password,
      displayName,
      registrationKey
    });

    res.status(201).json({
      success: true,
      data: {
        user: result.user,
        tokens: result.tokens
      },
      message: 'User registered successfully'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed'
    });
  }
});

// ログイン
router.post('/login', authRateLimit, loginValidation, async (req: Request, res: Response) => {
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

    const { username, password } = req.body;

    const result = await authService.login({ username, password });

    res.json({
      success: true,
      data: {
        user: result.user,
        tokens: result.tokens
      },
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Login failed'
    });
  }
});

// トークンリフレッシュ
router.post('/refresh', generalRateLimit, async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        error: 'Refresh token is required'
      });
      return;
    }

    const tokens = await authService.refreshTokens(refreshToken);

    res.json({
      success: true,
      data: { tokens },
      message: 'Tokens refreshed successfully'
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Token refresh failed'
    });
  }
});

// ログアウト（クライアント側でトークンを削除するため、サーバー側では特に処理なし）
router.post('/logout', AuthMiddleware.authenticate, (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// 現在のユーザー情報取得
router.get('/me', AuthMiddleware.authenticate, (req: Request, res: Response) => {
  res.json({
    success: true,
    data: req.user,
    message: 'User information retrieved successfully'
  });
});

// パスワード変更
router.put('/change-password', AuthMiddleware.authenticate, changePasswordValidation, async (req: Request, res: Response) => {
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

    const { currentPassword, newPassword } = req.body;
    const userId = req.userId!;

    await authService.changePassword(userId, currentPassword, newPassword);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Password change failed'
    });
  }
});

// プロフィール更新
router.put('/profile', AuthMiddleware.authenticate, [
  body('displayName')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Display name must be 1-100 characters'),
  body('bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio must be 500 characters or less'),
  body('onlineStatus')
    .optional()
    .isIn(['online', 'away', 'busy', 'offline'])
    .withMessage('Invalid online status'),
  body('customStatus.text')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Custom status text must be 100 characters or less'),
  body('customStatus.emoji')
    .optional()
    .isLength({ max: 10 })
    .withMessage('Custom status emoji is too long')
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

    const userId = req.userId!;
    const { displayName, avatar, bio, onlineStatus, customStatus } = req.body;

    const updatedUser = await authService.updateUserProfile(userId, {
      displayName,
      avatar,
      bio,
      onlineStatus,
      customStatus
    });

    const sanitizedUser = {
      id: updatedUser.id,
      username: updatedUser.username,
      roles: updatedUser.roles,
      profile: updatedUser.profile,
      isActive: updatedUser.isActive,
      isBanned: updatedUser.isBanned,
      lastSeen: updatedUser.lastSeen,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt
    };

    res.json({
      success: true,
      data: { user: sanitizedUser },
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Profile update failed'
    });
  }
});

export default router;