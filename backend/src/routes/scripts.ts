import { Router, Request, Response } from 'express';
import { ScriptService } from '../services/script';
import { authMiddleware } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();
const scriptService = ScriptService.getInstance();

// 全てのルートに認証を適用
router.use(authMiddleware);



// 脚本一覧取得
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const scripts = await scriptService.getAllScripts(user.id, user.roles);
    
    res.json({
      success: true,
      data: scripts
    });
  } catch (error) {
    console.error('Get scripts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get scripts'
    });
  }
});

// 脚本作成
router.post('/', [
  body('title')
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must be 1000 characters or less'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('permissions.viewRoles')
    .optional()
    .isArray()
    .withMessage('viewRoles must be an array'),
  body('permissions.editRoles')
    .optional()
    .isArray()
    .withMessage('editRoles must be an array'),
  body('permissions.viewUsers')
    .optional()
    .isArray()
    .withMessage('viewUsers must be an array'),
  body('permissions.editUsers')
    .optional()
    .isArray()
    .withMessage('editUsers must be an array'),
  handleValidationErrors
], async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    
    // 管理者のみ脚本作成可能
    if (!user.roles.includes('admin')) {
      res.status(403).json({
        success: false,
        message: 'Permission denied: Only administrators can create scripts'
      });
      return;
    }

    const scriptData = {
      title: req.body.title,
      description: req.body.description,
      isActive: req.body.isActive,
      permissions: req.body.permissions,
      createdBy: user.id
    };

    const script = await scriptService.createScript(scriptData);
    
    res.status(201).json({
      success: true,
      data: script
    });
  } catch (error) {
    console.error('Create script error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create script'
    });
  }
});

// 脚本詳細取得
router.get('/:id', [
  param('id').isUUID().withMessage('Invalid script ID'),
  handleValidationErrors
], async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const script = await scriptService.getScriptById((req.params as { id: string }).id, user.id, user.roles);
    
    if (!script) {
      res.status(404).json({
        success: false,
        message: 'Script not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: script
    });
  } catch (error) {
    console.error('Get script error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get script'
    });
  }
});

// 脚本更新
router.put('/:id', [
  param('id').isUUID().withMessage('Invalid script ID'),
  body('title')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must be 1000 characters or less'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('permissions.viewRoles')
    .optional()
    .isArray()
    .withMessage('viewRoles must be an array'),
  body('permissions.editRoles')
    .optional()
    .isArray()
    .withMessage('editRoles must be an array'),
  body('permissions.viewUsers')
    .optional()
    .isArray()
    .withMessage('viewUsers must be an array'),
  body('permissions.editUsers')
    .optional()
    .isArray()
    .withMessage('editUsers must be an array'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const updates = req.body;
    
    const script = await scriptService.updateScript((req.params as { id: string }).id, updates, user.id, user.roles);
    
    res.json({
      success: true,
      data: script
    });
  } catch (error) {
    console.error('Update script error:', error);
    const statusCode = error instanceof Error && error.message.includes('Permission denied') ? 403 : 
                      error instanceof Error && error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update script'
    });
  }
});

// 脚本削除
router.delete('/:id', [
  param('id').isUUID().withMessage('Invalid script ID'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    await scriptService.deleteScript((req.params as { id: string }).id, user.id, user.roles);
    
    res.json({
      success: true,
      message: 'Script deleted successfully'
    });
  } catch (error) {
    console.error('Delete script error:', error);
    const statusCode = error instanceof Error && error.message.includes('Permission denied') ? 403 : 
                      error instanceof Error && error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete script'
    });
  }
});

// 脚本行一覧取得
router.get('/:id/lines', [
  param('id').isUUID().withMessage('Invalid script ID'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const lines = await scriptService.getScriptLines((req.params as { id: string }).id, user.id, user.roles);
    
    res.json({
      success: true,
      data: lines
    });
  } catch (error) {
    console.error('Get script lines error:', error);
    const statusCode = error instanceof Error && error.message.includes('Permission denied') ? 403 : 
                      error instanceof Error && error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get script lines'
    });
  }
});

// 脚本行作成
router.post('/:id/lines', [
  param('id').isUUID().withMessage('Invalid script ID'),
  body('lineNumber')
    .isInt({ min: 1, max: 10000 })
    .withMessage('Line number must be between 1 and 10000'),
  body('characterName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Character name must be 100 characters or less'),
  body('dialogue')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Dialogue must be 2000 characters or less'),
  body('lighting')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Lighting must be 500 characters or less'),
  body('audioVideo')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Audio/Video must be 500 characters or less'),
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes must be 1000 characters or less'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const lineData = {
      lineNumber: req.body.lineNumber,
      characterName: req.body.characterName,
      dialogue: req.body.dialogue,
      lighting: req.body.lighting,
      audioVideo: req.body.audioVideo,
      notes: req.body.notes,
      formatting: req.body.formatting
    };
    
    const line = await scriptService.createScriptLine((req.params as { id: string }).id, lineData, user.id, user.roles);
    
    res.status(201).json({
      success: true,
      data: line
    });
  } catch (error) {
    console.error('Create script line error:', error);
    const statusCode = error instanceof Error && error.message.includes('Permission denied') ? 403 : 
                      error instanceof Error && error.message.includes('not found') ? 404 : 
                      error instanceof Error && error.message.includes('already exists') ? 409 : 500;
    res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create script line'
    });
  }
});

// 脚本行更新
router.put('/:id/lines/:lineNumber', [
  param('id').isUUID().withMessage('Invalid script ID'),
  param('lineNumber').isInt({ min: 1 }).withMessage('Invalid line number'),
  body('characterName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Character name must be 100 characters or less'),
  body('dialogue')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Dialogue must be 2000 characters or less'),
  body('lighting')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Lighting must be 500 characters or less'),
  body('audioVideo')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Audio/Video must be 500 characters or less'),
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes must be 1000 characters or less'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const lineNumber = parseInt((req.params as { lineNumber: string }).lineNumber);
    const updates = req.body;
    
    const line = await scriptService.updateScriptLine((req.params as { id: string }).id, lineNumber, updates, user.id, user.roles);
    
    res.json({
      success: true,
      data: line
    });
  } catch (error) {
    console.error('Update script line error:', error);
    const statusCode = error instanceof Error && error.message.includes('Permission denied') ? 403 : 
                      error instanceof Error && error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update script line'
    });
  }
});

// 脚本行削除
router.delete('/:id/lines/:lineNumber', [
  param('id').isUUID().withMessage('Invalid script ID'),
  param('lineNumber').isInt({ min: 1 }).withMessage('Invalid line number'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const lineNumber = parseInt((req.params as { lineNumber: string }).lineNumber);
    
    await scriptService.deleteScriptLine((req.params as { id: string }).id, lineNumber, user.id, user.roles);
    
    res.json({
      success: true,
      message: 'Script line deleted successfully'
    });
  } catch (error) {
    console.error('Delete script line error:', error);
    const statusCode = error instanceof Error && error.message.includes('Permission denied') ? 403 : 
                      error instanceof Error && error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete script line'
    });
  }
});

// === バージョン管理エンドポイント ===

// 脚本バージョン作成
router.post('/:id/versions', [
  param('id').isUUID().withMessage('Invalid script ID'),
  body('changeDescription')
    .isLength({ min: 1, max: 500 })
    .withMessage('Change description must be between 1 and 500 characters'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const version = await scriptService.createScriptVersion(
      (req.params as { id: string }).id,
      req.body.changeDescription,
      user.id,
      user.roles
    );
    
    res.status(201).json({
      success: true,
      data: version
    });
  } catch (error) {
    console.error('Create script version error:', error);
    const statusCode = error instanceof Error && error.message.includes('Permission denied') ? 403 : 
                      error instanceof Error && error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create script version'
    });
  }
});

// 脚本バージョン履歴取得
router.get('/:id/versions', [
  param('id').isUUID().withMessage('Invalid script ID'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const versions = await scriptService.getScriptVersions((req.params as { id: string }).id, user.id, user.roles);
    
    res.json({
      success: true,
      data: versions
    });
  } catch (error) {
    console.error('Get script versions error:', error);
    const statusCode = error instanceof Error && error.message.includes('Permission denied') ? 403 : 
                      error instanceof Error && error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get script versions'
    });
  }
});

// 行編集履歴取得
router.get('/:id/history', [
  param('id').isUUID().withMessage('Invalid script ID'),
  query('lineNumber').optional().isInt({ min: 1 }).withMessage('Invalid line number'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const lineNumber = req.query.lineNumber ? parseInt(req.query.lineNumber as string) : undefined;
    const history = await scriptService.getLineHistory((req.params as { id: string }).id, lineNumber, user.id, user.roles);
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Get line history error:', error);
    const statusCode = error instanceof Error && error.message.includes('Permission denied') ? 403 : 
                      error instanceof Error && error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get line history'
    });
  }
});

// === 同時編集制御エンドポイント ===

// 脚本ロック
router.post('/:id/lock', [
  param('id').isUUID().withMessage('Invalid script ID'),
  body('lineNumber').optional().isInt({ min: 1 }).withMessage('Invalid line number'),
  body('lockDurationMinutes').optional().isInt({ min: 1, max: 120 }).withMessage('Lock duration must be between 1 and 120 minutes'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const lock = await scriptService.lockScript(
      (req.params as { id: string }).id,
      req.body.lineNumber,
      user.id,
      user.roles,
      req.body.lockDurationMinutes || 30
    );
    
    res.json({
      success: true,
      data: lock
    });
  } catch (error) {
    console.error('Lock script error:', error);
    const statusCode = error instanceof Error && error.message.includes('Permission denied') ? 403 : 
                      error instanceof Error && error.message.includes('not found') ? 404 :
                      error instanceof Error && error.message.includes('already locked') ? 409 : 500;
    res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to lock script'
    });
  }
});

// 脚本ロック解除
router.delete('/:id/lock', [
  param('id').isUUID().withMessage('Invalid script ID'),
  body('lineNumber').optional().isInt({ min: 1 }).withMessage('Invalid line number'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    await scriptService.unlockScript((req.params as { id: string }).id, req.body.lineNumber, user.id);
    
    res.json({
      success: true,
      message: 'Script unlocked successfully'
    });
  } catch (error) {
    console.error('Unlock script error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to unlock script'
    });
  }
});

// 編集セッション開始
router.post('/:id/sessions', [
  param('id').isUUID().withMessage('Invalid script ID'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const session = await scriptService.startEditSession((req.params as { id: string }).id, user.id, user.username, user.roles);
    
    res.status(201).json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Start edit session error:', error);
    const statusCode = error instanceof Error && error.message.includes('Permission denied') ? 403 : 
                      error instanceof Error && error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to start edit session'
    });
  }
});

// アクティブな編集セッション取得
router.get('/:id/sessions', [
  param('id').isUUID().withMessage('Invalid script ID'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const sessions = await scriptService.getActiveEditSessions((req.params as { id: string }).id);
    
    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    console.error('Get active sessions error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get active sessions'
    });
  }
});

// === 場面分割エンドポイント ===

// 場面作成
router.post('/:id/scenes', [
  param('id').isUUID().withMessage('Invalid script ID'),
  body('title')
    .isLength({ min: 1, max: 200 })
    .withMessage('Scene title must be between 1 and 200 characters'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Scene description must be 1000 characters or less'),
  body('startLineNumber')
    .isInt({ min: 1 })
    .withMessage('Start line number must be a positive integer'),
  body('endLineNumber')
    .isInt({ min: 1 })
    .withMessage('End line number must be a positive integer'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const scene = await scriptService.createScene(
      (req.params as { id: string }).id,
      {
        title: req.body.title,
        description: req.body.description,
        startLineNumber: req.body.startLineNumber,
        endLineNumber: req.body.endLineNumber
      },
      user.id,
      user.roles
    );
    
    res.status(201).json({
      success: true,
      data: scene
    });
  } catch (error) {
    console.error('Create scene error:', error);
    const statusCode = error instanceof Error && error.message.includes('Permission denied') ? 403 : 
                      error instanceof Error && error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create scene'
    });
  }
});

// 場面一覧取得
router.get('/:id/scenes', [
  param('id').isUUID().withMessage('Invalid script ID'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const scenes = await scriptService.getScenes((req.params as { id: string }).id, user.id, user.roles);
    
    res.json({
      success: true,
      data: scenes
    });
  } catch (error) {
    console.error('Get scenes error:', error);
    const statusCode = error instanceof Error && error.message.includes('Permission denied') ? 403 : 
                      error instanceof Error && error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get scenes'
    });
  }
});

// === 印刷最適化エンドポイント ===

// 印刷設定保存
router.post('/:id/print-settings', [
  param('id').isUUID().withMessage('Invalid script ID'),
  body('pageSize').optional().isIn(['A4', 'A5', 'Letter']).withMessage('Invalid page size'),
  body('orientation').optional().isIn(['portrait', 'landscape']).withMessage('Invalid orientation'),
  body('fontSize').optional().isInt({ min: 8, max: 24 }).withMessage('Font size must be between 8 and 24'),
  body('lineSpacing').optional().isFloat({ min: 1.0, max: 3.0 }).withMessage('Line spacing must be between 1.0 and 3.0'),
  body('margins.top').optional().isInt({ min: 10, max: 50 }).withMessage('Top margin must be between 10 and 50'),
  body('margins.bottom').optional().isInt({ min: 10, max: 50 }).withMessage('Bottom margin must be between 10 and 50'),
  body('margins.left').optional().isInt({ min: 10, max: 50 }).withMessage('Left margin must be between 10 and 50'),
  body('margins.right').optional().isInt({ min: 10, max: 50 }).withMessage('Right margin must be between 10 and 50'),
  body('includeNotes').optional().isBoolean().withMessage('includeNotes must be a boolean'),
  body('includeLighting').optional().isBoolean().withMessage('includeLighting must be a boolean'),
  body('includeAudioVideo').optional().isBoolean().withMessage('includeAudioVideo must be a boolean'),
  body('sceneBreaks').optional().isBoolean().withMessage('sceneBreaks must be a boolean'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const settings = await scriptService.savePrintSettings(
      (req.params as { id: string }).id,
      req.body,
      user.id,
      user.roles
    );
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Save print settings error:', error);
    const statusCode = error instanceof Error && error.message.includes('Permission denied') ? 403 : 
                      error instanceof Error && error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to save print settings'
    });
  }
});

// 印刷設定取得
router.get('/:id/print-settings', [
  param('id').isUUID().withMessage('Invalid script ID'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const settings = await scriptService.getPrintSettings((req.params as { id: string }).id, user.id, user.roles);
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get print settings error:', error);
    const statusCode = error instanceof Error && error.message.includes('Permission denied') ? 403 : 
                      error instanceof Error && error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get print settings'
    });
  }
});

// 印刷用データ生成
router.get('/:id/print-data', [
  param('id').isUUID().withMessage('Invalid script ID'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const printData = await scriptService.generatePrintData((req.params as { id: string }).id, user.id, user.roles);
    
    res.json({
      success: true,
      data: printData
    });
  } catch (error) {
    console.error('Generate print data error:', error);
    const statusCode = error instanceof Error && error.message.includes('Permission denied') ? 403 : 
                      error instanceof Error && error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to generate print data'
    });
  }
});

export default router;