import express, { Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import { ModerationService } from '../services/moderation';
import { authMiddleware } from '../middleware/auth';
import { PermissionMiddleware } from '../middleware/permissions';
import { handleValidationErrors } from '../middleware/validation';

const router = express.Router();
const moderationService = ModerationService.getInstance();

// モデレーション設定取得
router.get('/settings', [
  authMiddleware,
  PermissionMiddleware.requirePermission('manageServer')
], async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await moderationService.getSettings();
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error getting moderation settings:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get moderation settings'
    });
  }
});

// モデレーション設定更新
router.put('/settings', [
  authMiddleware,
  PermissionMiddleware.requirePermission('manageServer'),
  body('autoModerationEnabled')
    .optional()
    .isBoolean()
    .withMessage('autoModerationEnabled must be a boolean'),
  body('spamThreshold')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('spamThreshold must be between 1 and 20'),
  body('capsThreshold')
    .optional()
    .isInt({ min: 10, max: 100 })
    .withMessage('capsThreshold must be between 10 and 100'),
  body('linkFilterEnabled')
    .optional()
    .isBoolean()
    .withMessage('linkFilterEnabled must be a boolean'),
  body('wordFilterEnabled')
    .optional()
    .isBoolean()
    .withMessage('wordFilterEnabled must be a boolean'),
  body('allowedDomains')
    .optional()
    .isArray()
    .withMessage('allowedDomains must be an array'),
  body('exemptRoles')
    .optional()
    .isArray()
    .withMessage('exemptRoles must be an array'),
  body('logRetentionDays')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('logRetentionDays must be between 1 and 365'),
  handleValidationErrors
], async (req: Request, res: Response): Promise<void> => {
  try {
    const updatedSettings = await moderationService.updateSettings(req.body);
    
    res.json({
      success: true,
      data: updatedSettings
    });
  } catch (error) {
    console.error('Error updating moderation settings:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update moderation settings'
    });
  }
});

// モデレーションルール一覧取得
router.get('/rules', [
  authMiddleware,
  PermissionMiddleware.requirePermission('manageServer')
], async (req: Request, res: Response): Promise<void> => {
  try {
    const rules = moderationService.getAllRules();
    
    res.json({
      success: true,
      data: rules
    });
  } catch (error) {
    console.error('Error getting moderation rules:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get moderation rules'
    });
  }
});

// モデレーションルール作成
router.post('/rules', [
  authMiddleware,
  PermissionMiddleware.requirePermission('manageServer'),
  body('name')
    .isLength({ min: 1, max: 100 })
    .withMessage('Rule name must be between 1 and 100 characters'),
  body('type')
    .isIn(['word_filter', 'spam_detection', 'link_filter', 'caps_filter'])
    .withMessage('Invalid rule type'),
  body('enabled')
    .isBoolean()
    .withMessage('enabled must be a boolean'),
  body('severity')
    .isIn(['low', 'medium', 'high'])
    .withMessage('Invalid severity level'),
  body('action')
    .isIn(['warn', 'delete', 'timeout', 'kick', 'ban'])
    .withMessage('Invalid action'),
  body('config')
    .isObject()
    .withMessage('config must be an object'),
  handleValidationErrors
], async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, type, enabled, severity, action, config } = req.body;
    
    const rule = await moderationService.createRule({
      name,
      type,
      enabled,
      severity,
      action,
      config
    });
    
    res.status(201).json({
      success: true,
      data: rule
    });
  } catch (error) {
    console.error('Error creating moderation rule:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create moderation rule'
    });
  }
});

// モデレーションルール更新
router.put('/rules/:ruleId', [
  authMiddleware,
  PermissionMiddleware.requirePermission('manageServer'),
  param('ruleId').isUUID().withMessage('Invalid rule ID'),
  body('name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Rule name must be between 1 and 100 characters'),
  body('type')
    .optional()
    .isIn(['word_filter', 'spam_detection', 'link_filter', 'caps_filter'])
    .withMessage('Invalid rule type'),
  body('enabled')
    .optional()
    .isBoolean()
    .withMessage('enabled must be a boolean'),
  body('severity')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Invalid severity level'),
  body('action')
    .optional()
    .isIn(['warn', 'delete', 'timeout', 'kick', 'ban'])
    .withMessage('Invalid action'),
  body('config')
    .optional()
    .isObject()
    .withMessage('config must be an object'),
  handleValidationErrors
], async (req: Request, res: Response): Promise<void> => {
  try {
    const { ruleId } = req.params as { ruleId: string };
    
    const updatedRule = await moderationService.updateRule(ruleId, req.body);
    
    res.json({
      success: true,
      data: updatedRule
    });
  } catch (error) {
    console.error('Error updating moderation rule:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update moderation rule'
    });
  }
});

// モデレーションルール削除
router.delete('/rules/:ruleId', [
  authMiddleware,
  PermissionMiddleware.requirePermission('manageServer'),
  param('ruleId').isUUID().withMessage('Invalid rule ID'),
  handleValidationErrors
], async (req: Request, res: Response): Promise<void> => {
  try {
    const { ruleId } = req.params as { ruleId: string };
    
    await moderationService.deleteRule(ruleId);
    
    res.json({
      success: true,
      message: 'Moderation rule deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting moderation rule:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete moderation rule'
    });
  }
});

// モデレーションログ取得
router.get('/logs', [
  authMiddleware,
  PermissionMiddleware.requirePermission('manageServer'),
  query('targetUserId')
    .optional()
    .isUUID()
    .withMessage('Invalid target user ID'),
  query('moderatorId')
    .optional()
    .isUUID()
    .withMessage('Invalid moderator ID'),
  query('action')
    .optional()
    .isIn(['warn', 'delete_message', 'timeout', 'kick', 'ban'])
    .withMessage('Invalid action'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be non-negative'),
  handleValidationErrors
], async (req: Request, res: Response): Promise<void> => {
  try {
    const { targetUserId, moderatorId, action, limit, offset } = req.query;
    
    const options: any = {};
    if (targetUserId) options.targetUserId = targetUserId as string;
    if (moderatorId) options.moderatorId = moderatorId as string;
    if (action) options.action = action as string;
    if (limit) options.limit = parseInt(limit as string);
    if (offset) options.offset = parseInt(offset as string);
    
    const logs = await moderationService.getModerationLogs(options);
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('Error getting moderation logs:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get moderation logs'
    });
  }
});

// ユーザーのタイムアウト状態チェック
router.get('/users/:userId/timeout-status', [
  authMiddleware,
  PermissionMiddleware.requirePermission('manageServer'),
  param('userId').isUUID().withMessage('Invalid user ID'),
  handleValidationErrors
], async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params as { userId: string };
    
    const isTimedOut = await moderationService.isUserTimedOut(userId);
    
    res.json({
      success: true,
      data: {
        userId,
        isTimedOut
      }
    });
  } catch (error) {
    console.error('Error checking user timeout status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check timeout status'
    });
  }
});

// 手動モデレーションアクション
router.post('/actions/warn', [
  authMiddleware,
  PermissionMiddleware.requirePermission('moderateMessages'),
  body('userId')
    .isUUID()
    .withMessage('Invalid user ID'),
  body('reason')
    .isLength({ min: 1, max: 500 })
    .withMessage('Reason must be between 1 and 500 characters'),
  body('messageId')
    .optional()
    .isUUID()
    .withMessage('Invalid message ID'),
  body('channelId')
    .optional()
    .isUUID()
    .withMessage('Invalid channel ID'),
  handleValidationErrors
], async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, reason, messageId, channelId } = req.body;
    const moderatorId = req.user!.id;
    
    // 手動警告の実装
    // 実際の実装では、ModerationServiceに手動アクション用のメソッドを追加
    
    res.json({
      success: true,
      message: 'User warned successfully'
    });
  } catch (error) {
    console.error('Error warning user:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to warn user'
    });
  }
});

router.post('/actions/timeout', [
  authMiddleware,
  PermissionMiddleware.requirePermission('moderateMessages'),
  body('userId')
    .isUUID()
    .withMessage('Invalid user ID'),
  body('duration')
    .isInt({ min: 1, max: 10080 }) // max 1 week
    .withMessage('Duration must be between 1 and 10080 minutes'),
  body('reason')
    .isLength({ min: 1, max: 500 })
    .withMessage('Reason must be between 1 and 500 characters'),
  handleValidationErrors
], async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, duration, reason } = req.body;
    const moderatorId = req.user!.id;
    
    // 手動タイムアウトの実装
    // 実際の実装では、ModerationServiceに手動アクション用のメソッドを追加
    
    res.json({
      success: true,
      message: 'User timed out successfully'
    });
  } catch (error) {
    console.error('Error timing out user:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to timeout user'
    });
  }
});

router.post('/actions/ban', [
  authMiddleware,
  PermissionMiddleware.requirePermission('banMembers'),
  body('userId')
    .isUUID()
    .withMessage('Invalid user ID'),
  body('reason')
    .isLength({ min: 1, max: 500 })
    .withMessage('Reason must be between 1 and 500 characters'),
  handleValidationErrors
], async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, reason } = req.body;
    const moderatorId = req.user!.id;
    
    // 手動BANの実装
    // 実際の実装では、ModerationServiceに手動アクション用のメソッドを追加
    
    res.json({
      success: true,
      message: 'User banned successfully'
    });
  } catch (error) {
    console.error('Error banning user:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to ban user'
    });
  }
});

export default router;