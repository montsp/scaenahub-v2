import express, { Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import multer from 'multer';
import { MessageService } from '../services/message';
import { GoogleDriveService } from '../services/googleDrive';
import { authMiddleware } from '../middleware/auth';
import { handleValidationErrors, handleFileUploadErrors } from '../middleware/validation';

const router = express.Router();
const messageService = MessageService.getInstance();
const googleDriveService = GoogleDriveService.getInstance();

// Multer設定（メモリストレージ）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'), // 5MB
    files: 5 // 最大5ファイル
  },
  fileFilter: (req, file, cb) => {
    if (googleDriveService.isAllowedMimeType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  }
});

// メッセージ投稿
router.post('/channels/:channelId/messages', [
  authMiddleware,
  param('channelId').isUUID().withMessage('Invalid channel ID'),
  body('content')
    .isLength({ min: 1, max: parseInt(process.env.MAX_MESSAGE_LENGTH || '2000') })
    .withMessage(`Message content must be between 1 and ${process.env.MAX_MESSAGE_LENGTH || '2000'} characters`),
  body('type')
    .optional()
    .isIn(['text', 'file', 'system', 'announcement'])
    .withMessage('Invalid message type'),
  body('threadId')
    .optional()
    .isUUID()
    .withMessage('Invalid thread ID'),
  body('parentMessageId')
    .optional()
    .isUUID()
    .withMessage('Invalid parent message ID'),
  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array'),
  body('embeds')
    .optional()
    .isArray()
    .withMessage('Embeds must be an array'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params as { channelId: string };
    const { content, type, threadId, parentMessageId, attachments, embeds } = req.body;
    const userId = req.user!.id;
    const userRoles = req.user!.roles;

    const message = await messageService.createMessage(
      channelId,
      userId,
      content,
      userRoles,
      {
        type,
        threadId,
        parentMessageId,
        attachments,
        embeds
      }
    );

    // Socket.ioでリアルタイム通知
    const io = req.app.get('io');
    if (io) {
      // チャンネルの全ユーザーに新しいメッセージを通知
      io.to(`channel:${channelId}`).emit('message', message);
    }

    res.status(201).json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create message'
    });
  }
});

// チャンネルのメッセージ取得
router.get('/channels/:channelId/messages', [
  authMiddleware,
  param('channelId').isUUID().withMessage('Invalid channel ID'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('before')
    .optional()
    .isUUID()
    .withMessage('Invalid before message ID'),
  query('after')
    .optional()
    .isUUID()
    .withMessage('Invalid after message ID'),
  query('pinned')
    .optional()
    .isBoolean()
    .withMessage('Pinned must be a boolean'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params as { channelId: string };
    const { limit, before, after, pinned } = req.query;
    const userId = req.user!.id;
    const userRoles = req.user!.roles;

    const options: any = {};
    if (limit) options.limit = parseInt(limit as string);
    if (before) options.before = before as string;
    if (after) options.after = after as string;
    if (pinned === 'true') options.pinned = true;
    else if (pinned === 'false') options.pinned = false;

    const messages = await messageService.getChannelMessages(
      channelId,
      userId,
      userRoles,
      options
    );

    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error('Error getting channel messages:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get messages'
    });
  }
});

// メッセージ取得（ID指定）
router.get('/messages/:messageId', [
  authMiddleware,
  param('messageId').isUUID().withMessage('Invalid message ID'),
  handleValidationErrors
], async (req: Request, res: Response): Promise<void> => {
  try {
    const { messageId } = req.params as { messageId: string };

    const message = await messageService.getMessageById(messageId);
    if (!message) {
      res.status(404).json({
        success: false,
        error: 'Message not found'
      });
      return;
    }

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Error getting message:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get message'
    });
  }
});

// メッセージ編集
router.put('/messages/:messageId', [
  authMiddleware,
  param('messageId').isUUID().withMessage('Invalid message ID'),
  body('content')
    .isLength({ min: 1, max: parseInt(process.env.MAX_MESSAGE_LENGTH || '2000') })
    .withMessage(`Message content must be between 1 and ${process.env.MAX_MESSAGE_LENGTH || '2000'} characters`),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params as { messageId: string };
    const { content } = req.body;
    const userId = req.user!.id;
    const userRoles = req.user!.roles;

    const message = await messageService.editMessage(messageId, content, userId, userRoles);

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Error editing message:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to edit message'
    });
  }
});

// メッセージ削除
router.delete('/messages/:messageId', [
  authMiddleware,
  param('messageId').isUUID().withMessage('Invalid message ID'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params as { messageId: string };
    const userId = req.user!.id;
    const userRoles = req.user!.roles;

    await messageService.deleteMessage(messageId, userId, userRoles);

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete message'
    });
  }
});

// リアクション追加
router.post('/messages/:messageId/reactions', [
  authMiddleware,
  param('messageId').isUUID().withMessage('Invalid message ID'),
  body('emoji')
    .isLength({ min: 1, max: 10 })
    .withMessage('Emoji must be between 1 and 10 characters'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params as { messageId: string };
    const { emoji } = req.body;
    const userId = req.user!.id;
    const userRoles = req.user!.roles;

    const message = await messageService.addReaction(messageId, emoji, userId, userRoles);

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Error adding reaction:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add reaction'
    });
  }
});

// リアクション削除
router.delete('/messages/:messageId/reactions/:emoji', [
  authMiddleware,
  param('messageId').isUUID().withMessage('Invalid message ID'),
  param('emoji').isLength({ min: 1, max: 10 }).withMessage('Invalid emoji'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const { messageId, emoji } = req.params as { messageId: string; emoji: string };
    const userId = req.user!.id;
    const userRoles = req.user!.roles;

    const message = await messageService.removeReaction(messageId, emoji, userId, userRoles);

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Error removing reaction:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove reaction'
    });
  }
});

// メッセージピン留め
router.post('/messages/:messageId/pin', [
  authMiddleware,
  param('messageId').isUUID().withMessage('Invalid message ID'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params as { messageId: string };
    const userId = req.user!.id;
    const userRoles = req.user!.roles;

    const message = await messageService.pinMessage(messageId, userId, userRoles);

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Error pinning message:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to pin message'
    });
  }
});

// メッセージピン留め解除
router.delete('/messages/:messageId/pin', [
  authMiddleware,
  param('messageId').isUUID().withMessage('Invalid message ID'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params as { messageId: string };
    const userId = req.user!.id;
    const userRoles = req.user!.roles;

    const message = await messageService.unpinMessage(messageId, userId, userRoles);

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Error unpinning message:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to unpin message'
    });
  }
});

// ファイル付きメッセージ投稿
router.post('/channels/:channelId/messages/upload', [
  authMiddleware,
  upload.array('files', 5),
  param('channelId').isUUID().withMessage('Invalid channel ID'),
  body('content')
    .optional()
    .isLength({ max: parseInt(process.env.MAX_MESSAGE_LENGTH || '2000') })
    .withMessage(`Message content must be ${process.env.MAX_MESSAGE_LENGTH || '2000'} characters or less`),
  body('type')
    .optional()
    .isIn(['text', 'file', 'system', 'announcement'])
    .withMessage('Invalid message type'),
  body('threadId')
    .optional()
    .isUUID()
    .withMessage('Invalid thread ID'),
  body('parentMessageId')
    .optional()
    .isUUID()
    .withMessage('Invalid parent message ID'),
  handleValidationErrors,
  handleFileUploadErrors
], async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as { channelId: string };
    const { content = '', type, threadId, parentMessageId } = req.body;
    const userId = req.user!.id;
    const userRoles = req.user!.roles;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
      return;
    }

    // ファイル情報を準備
    const fileData = files.map(file => ({
      buffer: file.buffer,
      filename: file.originalname,
      mimeType: file.mimetype
    }));

    const message = await messageService.createMessageWithFiles(
      channelId,
      userId,
      content,
      userRoles,
      fileData,
      {
        type: type || 'file',
        threadId,
        parentMessageId
      }
    );

    res.status(201).json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload files'
    });
  }
});

// 添付ファイル削除
router.delete('/messages/:messageId/attachments/:attachmentId', [
  authMiddleware,
  param('messageId').isUUID().withMessage('Invalid message ID'),
  param('attachmentId').isUUID().withMessage('Invalid attachment ID'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const { messageId, attachmentId } = req.params as { messageId: string; attachmentId: string };
    const userId = req.user!.id;
    const userRoles = req.user!.roles;

    const message = await messageService.deleteAttachment(messageId, attachmentId, userId, userRoles);

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete attachment'
    });
  }
});

// メッセージ検索
router.get('/search', [
  authMiddleware,
  query('q')
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
  query('channelId')
    .optional()
    .isUUID()
    .withMessage('Invalid channel ID'),
  query('userId')
    .optional()
    .isUUID()
    .withMessage('Invalid user ID'),
  query('before')
    .optional()
    .isISO8601()
    .withMessage('Invalid before date'),
  query('after')
    .optional()
    .isISO8601()
    .withMessage('Invalid after date'),
  query('hasAttachments')
    .optional()
    .isBoolean()
    .withMessage('hasAttachments must be a boolean'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
], async (req: Request, res: Response) => {
  try {
    const { q, channelId, userId: searchUserId, before, after, hasAttachments, limit } = req.query;
    const userId = req.user!.id;
    const userRoles = req.user!.roles;

    const options: any = {};
    if (channelId) options.channelId = channelId as string;
    if (searchUserId) options.userId = searchUserId as string;
    if (before) options.before = new Date(before as string);
    if (after) options.after = new Date(after as string);
    if (hasAttachments === 'true') options.hasAttachments = true;
    if (limit) options.limit = parseInt(limit as string);

    const messages = await messageService.searchMessages(
      q as string,
      userId,
      userRoles,
      options
    );

    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error('Error searching messages:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search messages'
    });
  }
});

// スレッド作成
router.post('/messages/:messageId/thread', [
  authMiddleware,
  param('messageId').isUUID().withMessage('Invalid message ID'),
  body('content')
    .isLength({ min: 1, max: parseInt(process.env.MAX_MESSAGE_LENGTH || '2000') })
    .withMessage(`Thread message content must be between 1 and ${process.env.MAX_MESSAGE_LENGTH || '2000'} characters`),
  handleValidationErrors
], async (req: Request, res: Response): Promise<void> => {
  try {
    const { messageId } = req.params as { messageId: string };
    const { content } = req.body;
    const userId = req.user!.id;
    const userRoles = req.user!.roles;

    const threadMessage = await messageService.createThread(messageId, userId, content, userRoles);

    res.status(201).json({
      success: true,
      data: threadMessage
    });
  } catch (error) {
    console.error('Error creating thread:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create thread'
    });
  }
});

// スレッドメッセージ取得
router.get('/threads/:threadId/messages', [
  authMiddleware,
  param('threadId').isUUID().withMessage('Invalid thread ID'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('before')
    .optional()
    .isUUID()
    .withMessage('Invalid before message ID'),
  query('after')
    .optional()
    .isUUID()
    .withMessage('Invalid after message ID'),
  handleValidationErrors
], async (req: Request, res: Response): Promise<void> => {
  try {
    const { threadId } = req.params as { threadId: string };
    const { limit, before, after } = req.query;
    const userId = req.user!.id;
    const userRoles = req.user!.roles;

    const options: any = {};
    if (limit) options.limit = parseInt(limit as string);
    if (before) options.before = before as string;
    if (after) options.after = after as string;

    const messages = await messageService.getThreadMessages(threadId, userId, userRoles, options);

    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error('Error getting thread messages:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get thread messages'
    });
  }
});

// チャンネル内のスレッド一覧取得
router.get('/channels/:channelId/threads', [
  authMiddleware,
  param('channelId').isUUID().withMessage('Invalid channel ID'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('before')
    .optional()
    .isUUID()
    .withMessage('Invalid before message ID'),
  query('after')
    .optional()
    .isUUID()
    .withMessage('Invalid after message ID'),
  handleValidationErrors
], async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as { channelId: string };
    const { limit, before, after } = req.query;
    const userId = req.user!.id;
    const userRoles = req.user!.roles;

    const options: any = {};
    if (limit) options.limit = parseInt(limit as string);
    if (before) options.before = before as string;
    if (after) options.after = after as string;

    const threads = await messageService.getChannelThreads(channelId, userId, userRoles, options);

    res.json({
      success: true,
      data: threads
    });
  } catch (error) {
    console.error('Error getting channel threads:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get channel threads'
    });
  }
});

// スレッド統計情報取得
router.get('/threads/:threadId/stats', [
  authMiddleware,
  param('threadId').isUUID().withMessage('Invalid thread ID'),
  handleValidationErrors
], async (req: Request, res: Response): Promise<void> => {
  try {
    const { threadId } = req.params as { threadId: string };

    const stats = await messageService.getThreadStats(threadId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting thread stats:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get thread stats'
    });
  }
});

// 無限スクロール用メッセージ取得
router.get('/channels/:channelId/messages/cursor', [
  authMiddleware,
  param('channelId').isUUID().withMessage('Invalid channel ID'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('cursor')
    .optional()
    .isUUID()
    .withMessage('Invalid cursor message ID'),
  query('direction')
    .optional()
    .isIn(['before', 'after'])
    .withMessage('Direction must be before or after'),
  query('includeThreads')
    .optional()
    .isBoolean()
    .withMessage('includeThreads must be a boolean'),
  handleValidationErrors
], async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as { channelId: string };
    const { limit, cursor, direction, includeThreads } = req.query;
    const userId = req.user!.id;
    const userRoles = req.user!.roles;

    const options: any = {};
    if (limit) options.limit = parseInt(limit as string);
    if (cursor) options.cursor = cursor as string;
    if (direction) options.direction = direction as 'before' | 'after';
    if (includeThreads === 'true') options.includeThreads = true;

    const result = await messageService.getMessagesWithCursor(channelId, userId, userRoles, options);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting messages with cursor:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get messages'
    });
  }
});

// メッセージの返信取得（スレッド）
router.get('/messages/:messageId/replies', [
  authMiddleware,
  param('messageId').isUUID().withMessage('Invalid message ID'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('before')
    .optional()
    .isUUID()
    .withMessage('Invalid before message ID'),
  query('after')
    .optional()
    .isUUID()
    .withMessage('Invalid after message ID'),
  handleValidationErrors
], async (req: Request, res: Response): Promise<void> => {
  try {
    const { messageId } = req.params as { messageId: string };
    const { limit, before, after } = req.query;
    const userId = req.user!.id;
    const userRoles = req.user!.roles;

    const options: any = {};
    if (limit) options.limit = parseInt(limit as string);
    if (before) options.before = before as string;
    if (after) options.after = after as string;

    const replies = await messageService.getMessageReplies(messageId, userId, userRoles, options);

    res.json({
      success: true,
      data: replies
    });
  } catch (error) {
    console.error('Error getting message replies:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get message replies'
    });
  }
});

// メッセージに返信投稿（スレッド）
router.post('/messages/:messageId/replies', [
  authMiddleware,
  param('messageId').isUUID().withMessage('Invalid message ID'),
  body('content')
    .isLength({ min: 1, max: parseInt(process.env.MAX_MESSAGE_LENGTH || '2000') })
    .withMessage(`Reply content must be between 1 and ${process.env.MAX_MESSAGE_LENGTH || '2000'} characters`),
  handleValidationErrors
], async (req: Request, res: Response): Promise<void> => {
  try {
    const { messageId } = req.params as { messageId: string };
    const { content } = req.body;
    const userId = req.user!.id;
    const userRoles = req.user!.roles;

    const reply = await messageService.createMessageReply(messageId, userId, content, userRoles);

    // Socket.ioでリアルタイム通知
    const io = req.app.get('io');
    if (io) {
      // スレッド返信も通常のメッセージイベントとして通知
      io.to(`channel:${reply.channelId}`).emit('message', reply);
    }

    res.status(201).json({
      success: true,
      data: reply
    });
  } catch (error) {
    console.error('Error creating message reply:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create message reply'
    });
  }
});

export default router;