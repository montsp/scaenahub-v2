import { MessageModel } from '../models/Message';
import { DataSyncService } from './database/sync';
import { SQLiteService } from './database/sqlite';
import { AuthService } from './auth';
import { UserService } from './user';
import { RoleService } from './role';
import { ChannelService } from './channel';
import { LinkPreviewService } from './linkPreview';
import { GoogleDriveService } from './googleDrive';
import { Message, Mention, Reaction, Attachment, Embed } from '../types';

export class MessageService {
  private static instance: MessageService;
  private syncService: DataSyncService;
  private sqliteService: SQLiteService;
  private authService: AuthService;
  private userService: UserService;
  private roleService: RoleService;
  private channelService: ChannelService;
  private linkPreviewService: LinkPreviewService;
  private googleDriveService: GoogleDriveService;
  private messageCache: Map<string, Message[]> = new Map(); // channelId -> messages

  constructor() {
    this.syncService = DataSyncService.getInstance();
    this.sqliteService = SQLiteService.getInstance();
    this.authService = AuthService.getInstance();
    this.userService = UserService.getInstance();
    this.roleService = RoleService.getInstance();
    this.channelService = ChannelService.getInstance();
    this.linkPreviewService = LinkPreviewService.getInstance();
    this.googleDriveService = GoogleDriveService.getInstance();
  }

  // ModerationServiceを遅延初期化
  private getModerationService() {
    const { ModerationService } = require('./moderation');
    return ModerationService.getInstance();
  }

  public static getInstance(): MessageService {
    if (!MessageService.instance) {
      MessageService.instance = new MessageService();
    }
    return MessageService.instance;
  }

  // メッセージ投稿
  public async createMessage(
    channelId: string,
    userId: string,
    content: string,
    userRoles: string[],
    options?: {
      type?: Message['type'];
      threadId?: string;
      parentMessageId?: string;
      attachments?: Attachment[];
      embeds?: Embed[];
    }
  ): Promise<Message> {
    // チャンネルの存在確認と権限チェック
    const channel = await this.channelService.getChannelById(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    // チャンネルへの書き込み権限チェック
    const canWrite = await this.channelService.canUserWriteToChannel(channelId, userId, userRoles);
    if (!canWrite) {
      throw new Error('Permission denied: Cannot write to this channel');
    }

    // ユーザーのタイムアウト状態チェック
    const moderationService = this.getModerationService();
    const isTimedOut = await moderationService.isUserTimedOut(userId);
    if (isTimedOut) {
      throw new Error('You are currently timed out and cannot send messages');
    }

    // メンションを抽出
    const mentions = await this.resolveMentions(content);

    // リンクプレビューを生成
    const urls = MessageModel.extractUrls(content);
    const embeds = options?.embeds || [];
    if (urls.length > 0) {
      const linkPreviews = await this.linkPreviewService.generatePreviews(urls);
      embeds.push(...linkPreviews);
    }

    // メッセージ作成
    const message = MessageModel.create({
      channelId,
      userId,
      content,
      ...(options?.type && { type: options.type }),
      ...(options?.threadId && { threadId: options.threadId }),
      ...(options?.parentMessageId && { parentMessageId: options.parentMessageId }),
      mentions,
      ...(options?.attachments && { attachments: options.attachments }),
      embeds
    });

    // 自動モデレーションチェック
    const moderationResult = await moderationService.moderateMessage(
      message.id,
      content,
      userId,
      channelId,
      userRoles
    );

    if (!moderationResult.allowed) {
      throw new Error(`Message blocked by moderation: ${moderationResult.reason}`);
    }

    // データベースに保存
    await this.syncService.writeData('messages', 'INSERT', message.id, {
      id: message.id,
      channel_id: message.channelId,
      user_id: message.userId,
      content: message.content,
      type: message.type,
      thread_id: message.threadId || null,
      parent_message_id: message.parentMessageId || null,
      mentions: JSON.stringify(message.mentions || []),
      reactions: JSON.stringify(message.reactions || []),
      attachments: JSON.stringify(message.attachments || []),
      embeds: JSON.stringify(message.embeds || []),
      is_pinned: message.isPinned,
      is_edited: message.isEdited,
      created_at: message.createdAt.toISOString(),
      edited_at: message.editedAt ? message.editedAt.toISOString() : null
    });

    // ユーザー情報を取得してメッセージに追加
    const user = await this.authService.getUserById(userId);
    if (user) {
      message.user = user;
    }

    // フロントエンド互換性のためparentIdを設定
    if (message.parentMessageId) {
      message.parentId = message.parentMessageId;
    }

    // キャッシュ更新
    const channelMessages = this.messageCache.get(channelId) || [];
    channelMessages.push(message);
    this.messageCache.set(channelId, channelMessages);

    return message;
  }

  // メッセージ編集
  public async editMessage(
    messageId: string,
    newContent: string,
    userId: string,
    userRoles: string[]
  ): Promise<Message> {
    const message = await this.getMessageById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    // 編集権限チェック（作成者または管理者）
    const canEdit = message.userId === userId || await this.roleService.hasPermission(userRoles, 'manageMessages');
    if (!canEdit) {
      throw new Error('Permission denied: Cannot edit this message');
    }

    // メッセージ編集
    const editedMessage = MessageModel.editMessage(message, newContent);

    // メンションを再解析
    editedMessage.mentions = await this.resolveMentions(newContent);

    // データベース更新
    await this.syncService.writeData('messages', 'UPDATE', messageId, {
      content: editedMessage.content,
      mentions: JSON.stringify(editedMessage.mentions || []),
      is_edited: editedMessage.isEdited,
      edited_at: editedMessage.editedAt ? editedMessage.editedAt.toISOString() : null
    });

    // キャッシュ更新
    this.updateMessageInCache(editedMessage);

    return editedMessage;
  }

  // メッセージ削除
  public async deleteMessage(
    messageId: string,
    userId: string,
    userRoles: string[]
  ): Promise<void> {
    const message = await this.getMessageById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    // 削除権限チェック（作成者または管理者）
    const canDelete = message.userId === userId || await this.roleService.hasPermission(userRoles, 'manageMessages');
    if (!canDelete) {
      throw new Error('Permission denied: Cannot delete this message');
    }

    // データベースから削除
    await this.syncService.writeData('messages', 'DELETE', messageId, {});

    // キャッシュから削除
    this.removeMessageFromCache(message.channelId, messageId);
  }

  // メッセージ取得（ID指定）
  public async getMessageById(messageId: string): Promise<Message | null> {
    // キャッシュから検索
    for (const messages of this.messageCache.values()) {
      const message = messages.find(m => m.id === messageId);
      if (message) return message;
    }

    // データベースから取得
    const rows = await this.syncService.readData(
      'messages',
      'SELECT id, channel_id, user_id, content, type, thread_id, parent_message_id, mentions, reactions, attachments, embeds, is_pinned, is_edited, edited_at, created_at FROM messages_cache WHERE id = ?',
      [messageId]
    );

    if (rows.length === 0) return null;

    return this.mapRowToMessage(rows[0]);
  }

  // チャンネルのメッセージ取得（ページネーション対応）
  public async getChannelMessages(
    channelId: string,
    userId: string,
    userRoles: string[],
    options?: {
      limit?: number;
      before?: string; // メッセージID
      after?: string; // メッセージID
      pinned?: boolean;
    }
  ): Promise<Message[]> {
    // チャンネルの読み取り権限チェック
    const canRead = await this.channelService.canUserReadChannel(channelId, userId, userRoles);
    if (!canRead) {
      throw new Error('Permission denied: Cannot read this channel');
    }

    const limit = options?.limit || 50;
    let query = `
      SELECT m.id, m.channel_id, m.user_id, m.content, m.type, m.thread_id, m.parent_message_id, 
             m.mentions, m.reactions, m.attachments, m.embeds, m.is_pinned, m.is_edited, m.edited_at, m.created_at,
             u.username, u.display_name, u.roles
      FROM messages_cache m
      LEFT JOIN users_cache u ON m.user_id = u.id
      WHERE m.channel_id = ? AND m.parent_message_id IS NULL
    `;
    const params: any[] = [channelId];

    // ピン留めメッセージのフィルタ
    if (options?.pinned !== undefined) {
      query += ' AND m.is_pinned = ?';
      params.push(options.pinned);
    }

    // ページネーション
    if (options?.before) {
      const beforeMessage = await this.getMessageById(options.before);
      if (beforeMessage) {
        query += ' AND m.created_at < ?';
        params.push(beforeMessage.createdAt.toISOString());
      }
    }

    if (options?.after) {
      const afterMessage = await this.getMessageById(options.after);
      if (afterMessage) {
        query += ' AND m.created_at > ?';
        params.push(afterMessage.createdAt.toISOString());
      }
    }

    query += ' ORDER BY m.created_at DESC LIMIT ?';
    params.push(limit);

    const rows = await this.syncService.readData('messages', query, params);
    const messages = rows.map(row => this.mapRowToMessage(row));

    // キャッシュ更新
    this.messageCache.set(channelId, messages);

    return messages.reverse(); // 時系列順に並び替え
  }

  // リアクション追加
  public async addReaction(
    messageId: string,
    emoji: string,
    userId: string,
    userRoles: string[]
  ): Promise<Message> {
    const message = await this.getMessageById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    // チャンネルの読み取り権限チェック
    const canRead = await this.channelService.canUserReadChannel(message.channelId, userId, userRoles);
    if (!canRead) {
      throw new Error('Permission denied: Cannot access this channel');
    }

    // リアクション追加
    const updatedMessage = MessageModel.addReaction(message, emoji, userId);

    // データベース更新
    await this.syncService.writeData('messages', 'UPDATE', messageId, {
      reactions: JSON.stringify(updatedMessage.reactions || [])
    });

    // キャッシュ更新
    this.updateMessageInCache(updatedMessage);

    return updatedMessage;
  }

  // リアクション削除
  public async removeReaction(
    messageId: string,
    emoji: string,
    userId: string,
    userRoles: string[]
  ): Promise<Message> {
    const message = await this.getMessageById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    // チャンネルの読み取り権限チェック
    const canRead = await this.channelService.canUserReadChannel(message.channelId, userId, userRoles);
    if (!canRead) {
      throw new Error('Permission denied: Cannot access this channel');
    }

    // リアクション削除
    const updatedMessage = MessageModel.removeReaction(message, emoji, userId);

    // データベース更新
    await this.syncService.writeData('messages', 'UPDATE', messageId, {
      reactions: JSON.stringify(updatedMessage.reactions || [])
    });

    // キャッシュ更新
    this.updateMessageInCache(updatedMessage);

    return updatedMessage;
  }

  // メッセージピン留め
  public async pinMessage(
    messageId: string,
    userId: string,
    userRoles: string[]
  ): Promise<Message> {
    const message = await this.getMessageById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    // ピン留め権限チェック（管理者のみ）
    const canPin = await this.roleService.hasPermission(userRoles, 'manageMessages');
    if (!canPin) {
      throw new Error('Permission denied: Cannot pin messages');
    }

    // メッセージピン留め
    const pinnedMessage = MessageModel.pinMessage(message);

    // データベース更新
    await this.syncService.writeData('messages', 'UPDATE', messageId, {
      is_pinned: pinnedMessage.isPinned
    });

    // キャッシュ更新
    this.updateMessageInCache(pinnedMessage);

    return pinnedMessage;
  }

  // メッセージピン留め解除
  public async unpinMessage(
    messageId: string,
    userId: string,
    userRoles: string[]
  ): Promise<Message> {
    const message = await this.getMessageById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    // ピン留め解除権限チェック（管理者のみ）
    const canUnpin = await this.roleService.hasPermission(userRoles, 'manageMessages');
    if (!canUnpin) {
      throw new Error('Permission denied: Cannot unpin messages');
    }

    // メッセージピン留め解除
    const unpinnedMessage = MessageModel.unpinMessage(message);

    // データベース更新
    await this.syncService.writeData('messages', 'UPDATE', messageId, {
      is_pinned: unpinnedMessage.isPinned
    });

    // キャッシュ更新
    this.updateMessageInCache(unpinnedMessage);

    return unpinnedMessage;
  }

  // ファイルアップロード付きメッセージ投稿
  public async createMessageWithFiles(
    channelId: string,
    userId: string,
    content: string,
    userRoles: string[],
    files: Array<{
      buffer: Buffer;
      filename: string;
      mimeType: string;
    }>,
    options?: {
      type?: Message['type'];
      threadId?: string;
      parentMessageId?: string;
    }
  ): Promise<Message> {
    // ファイルアップロード権限チェック
    const canUpload = await this.roleService.hasPermission(userRoles, 'sendFiles');
    if (!canUpload) {
      throw new Error('Permission denied: Cannot upload files');
    }

    // ファイルをGoogle Driveにアップロード
    const attachments = await this.googleDriveService.uploadFiles(files, userId);

    // メッセージ作成
    return this.createMessage(channelId, userId, content, userRoles, {
      ...options,
      attachments
    });
  }

  // ファイル削除
  public async deleteAttachment(
    messageId: string,
    attachmentId: string,
    userId: string,
    userRoles: string[]
  ): Promise<Message> {
    const message = await this.getMessageById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    // 削除権限チェック（作成者または管理者）
    const canDelete = message.userId === userId || await this.roleService.hasPermission(userRoles, 'manageMessages');
    if (!canDelete) {
      throw new Error('Permission denied: Cannot delete attachment');
    }

    // 添付ファイルを検索
    const attachmentIndex = message.attachments.findIndex(a => a.id === attachmentId);
    if (attachmentIndex === -1) {
      throw new Error('Attachment not found');
    }

    const attachment = message.attachments[attachmentIndex];
    if (!attachment) {
      throw new Error('Attachment not found');
    }

    // Google Driveから削除
    try {
      await this.googleDriveService.deleteFile(attachment.googleDriveId);
    } catch (error) {
      console.error('Failed to delete file from Google Drive:', error);
      // Google Drive削除に失敗してもメッセージからは削除する
    }

    // メッセージから添付ファイルを削除
    message.attachments.splice(attachmentIndex, 1);

    // データベース更新
    await this.syncService.writeData('messages', 'UPDATE', messageId, {
      attachments: JSON.stringify(message.attachments || [])
    });

    // キャッシュ更新
    this.updateMessageInCache(message);

    return message;
  }

  // メッセージ検索
  public async searchMessages(
    query: string,
    userId: string,
    userRoles: string[],
    options?: {
      channelId?: string;
      userId?: string;
      before?: Date;
      after?: Date;
      hasAttachments?: boolean;
      limit?: number;
    }
  ): Promise<Message[]> {
    const limit = options?.limit || 50;
    let sqlQuery = `
      SELECT id, channel_id, user_id, content, type, thread_id, parent_message_id, mentions, reactions, attachments, embeds, is_pinned, is_edited, edited_at, created_at FROM messages_cache 
      WHERE content LIKE ? 
    `;
    const params: any[] = [`%${query}%`];

    // チャンネル指定
    if (options?.channelId) {
      // チャンネルの読み取り権限チェック
      const canRead = await this.channelService.canUserReadChannel(options.channelId, userId, userRoles);
      if (!canRead) {
        throw new Error('Permission denied: Cannot search in this channel');
      }
      
      sqlQuery += ' AND channel_id = ?';
      params.push(options.channelId);
    } else {
      // 全チャンネル検索の場合、読み取り可能なチャンネルのみ
      const readableChannels = await this.channelService.getUserReadableChannels(userId, userRoles);
      if (readableChannels.length === 0) {
        return [];
      }
      
      const channelIds = readableChannels.map(c => c.id);
      sqlQuery += ` AND channel_id IN (${channelIds.map(() => '?').join(',')})`;
      params.push(...channelIds);
    }

    // ユーザー指定
    if (options?.userId) {
      sqlQuery += ' AND user_id = ?';
      params.push(options.userId);
    }

    // 日付範囲
    if (options?.before) {
      sqlQuery += ' AND created_at < ?';
      params.push(options.before.toISOString());
    }

    if (options?.after) {
      sqlQuery += ' AND created_at > ?';
      params.push(options.after.toISOString());
    }

    // 添付ファイル有無
    if (options?.hasAttachments) {
      sqlQuery += ' AND JSON_LENGTH(attachments) > 0';
    }

    sqlQuery += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const rows = await this.syncService.readData('messages', sqlQuery, params);
    return rows.map(row => this.mapRowToMessage(row));
  }

  // スレッド作成
  public async createThread(
    parentMessageId: string,
    userId: string,
    content: string,
    userRoles: string[]
  ): Promise<Message> {
    const parentMessage = await this.getMessageById(parentMessageId);
    if (!parentMessage) {
      throw new Error('Parent message not found');
    }

    // 親メッセージのチャンネルへの書き込み権限チェック
    const canWrite = await this.channelService.canUserWriteToChannel(parentMessage.channelId, userId, userRoles);
    if (!canWrite) {
      throw new Error('Permission denied: Cannot write to this channel');
    }

    // スレッドIDを生成（親メッセージがスレッドの場合はそのスレッドIDを使用）
    const threadId = parentMessage.threadId || parentMessage.id;

    return this.createMessage(
      parentMessage.channelId,
      userId,
      content,
      userRoles,
      {
        threadId,
        parentMessageId
      }
    );
  }

  // スレッドメッセージ取得
  public async getThreadMessages(
    threadId: string,
    userId: string,
    userRoles: string[],
    options?: {
      limit?: number;
      before?: string;
      after?: string;
    }
  ): Promise<Message[]> {
    // スレッドの親メッセージを取得してチャンネル権限をチェック
    const parentMessage = await this.getMessageById(threadId);
    if (!parentMessage) {
      throw new Error('Thread not found');
    }

    const canRead = await this.channelService.canUserReadChannel(parentMessage.channelId, userId, userRoles);
    if (!canRead) {
      throw new Error('Permission denied: Cannot read this channel');
    }

    const limit = options?.limit || 50;
    const messages = this.sqliteService.query(
      `SELECT m.*, u.username, u.display_name, u.avatar, u.online_status
       FROM messages_cache m
       LEFT JOIN users_cache u ON m.user_id = u.id
       WHERE m.thread_id = ? 
       ${options?.before ? 'AND m.created_at < (SELECT created_at FROM messages_cache WHERE id = ?)' : ''}
       ${options?.after ? 'AND m.created_at > (SELECT created_at FROM messages_cache WHERE id = ?)' : ''}
       ORDER BY m.created_at ASC
       LIMIT ?`,
      [
        threadId,
        ...(options?.before ? [options.before] : []),
        ...(options?.after ? [options.after] : []),
        limit
      ]
    );

    // メッセージオブジェクトに変換
    const threadMessages: Message[] = [];
    for (const row of messages) {
      const message = {
        id: row.id,
        channelId: row.channel_id,
        userId: row.user_id,
        content: row.content,
        type: row.type || 'text',
        parentMessageId: row.parent_message_id,
        threadId: row.thread_id,
        isPinned: Boolean(row.is_pinned),
        createdAt: new Date(row.created_at),
        editedAt: row.edited_at ? new Date(row.edited_at) : undefined,
        isEdited: Boolean(row.edited_at),
        mentions: [],
        reactions: [],
        attachments: [],
        embeds: [],
        user: row.username ? {
          id: row.user_id,
          username: row.username,
          roles: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          profile: {
            displayName: row.display_name || row.username,
            avatar: row.avatar || '',
            onlineStatus: (row.online_status as any) || 'offline'
          }
        } as any : undefined
      };

      threadMessages.push(message as Message);
    }

    return threadMessages;
  }

  // チャンネル内のスレッド一覧取得
  public async getChannelThreads(
    channelId: string,
    userId: string,
    userRoles: string[],
    options?: {
      limit?: number;
      before?: string;
      after?: string;
    }
  ): Promise<Message[]> {
    const canRead = await this.channelService.canUserReadChannel(channelId, userId, userRoles);
    if (!canRead) {
      throw new Error('Permission denied: Cannot read this channel');
    }

    const limit = options?.limit || 20;
    const threads = this.sqliteService.query(
      `SELECT DISTINCT m1.*, u.username, u.display_name, u.avatar, u.online_status
       FROM messages_cache m1
       LEFT JOIN users_cache u ON m1.user_id = u.id
       WHERE m1.channel_id = ? 
       AND m1.thread_id IS NULL 
       AND EXISTS (
         SELECT 1 FROM messages_cache m2 
         WHERE m2.thread_id = m1.id
       )
       ${options?.before ? 'AND m1.created_at < (SELECT created_at FROM messages_cache WHERE id = ?)' : ''}
       ${options?.after ? 'AND m1.created_at > (SELECT created_at FROM messages_cache WHERE id = ?)' : ''}
       ORDER BY m1.created_at DESC
       LIMIT ?`,
      [
        channelId,
        ...(options?.before ? [options.before] : []),
        ...(options?.after ? [options.after] : []),
        limit
      ]
    );

    // メッセージオブジェクトに変換
    const threadMessages: Message[] = [];
    for (const row of threads) {
      const message = {
        id: row.id,
        channelId: row.channel_id,
        userId: row.user_id,
        content: row.content,
        type: row.type || 'text',
        parentMessageId: row.parent_message_id,
        threadId: row.thread_id,
        isPinned: Boolean(row.is_pinned),
        createdAt: new Date(row.created_at),
        editedAt: row.edited_at ? new Date(row.edited_at) : undefined,
        isEdited: Boolean(row.edited_at),
        mentions: [],
        reactions: [],
        attachments: [],
        embeds: [],
        user: row.username ? {
          id: row.user_id,
          username: row.username,
          roles: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          profile: {
            displayName: row.display_name || row.username,
            avatar: row.avatar || '',
            onlineStatus: (row.online_status as any) || 'offline'
          }
        } as any : undefined
      };

      threadMessages.push(message as Message);
    }

    return threadMessages;
  }

  // スレッド統計情報取得
  public async getThreadStats(threadId: string): Promise<{
    messageCount: number;
    participantCount: number;
    lastActivity: Date;
  }> {
    // メッセージ数
    const messageCountRows = await this.syncService.readData(
      'messages',
      'SELECT COUNT(*) as count FROM messages_cache WHERE thread_id = ?',
      [threadId]
    );
    const messageCount = messageCountRows[0]?.count || 0;

    // 参加者数
    const participantRows = await this.syncService.readData(
      'messages',
      'SELECT COUNT(DISTINCT user_id) as count FROM messages_cache WHERE thread_id = ?',
      [threadId]
    );
    const participantCount = participantRows[0]?.count || 0;

    // 最後の活動時間
    const lastActivityRows = await this.syncService.readData(
      'messages',
      'SELECT MAX(created_at) as last_activity FROM messages_cache WHERE thread_id = ?',
      [threadId]
    );
    const lastActivity = lastActivityRows[0]?.last_activity 
      ? new Date(lastActivityRows[0].last_activity)
      : new Date();

    return {
      messageCount,
      participantCount,
      lastActivity
    };
  }

  // 無限スクロール用のメッセージ取得（カーソルベース）
  public async getMessagesWithCursor(
    channelId: string,
    userId: string,
    userRoles: string[],
    options?: {
      limit?: number;
      cursor?: string; // メッセージID
      direction?: 'before' | 'after';
      includeThreads?: boolean;
    }
  ): Promise<{
    messages: Message[];
    nextCursor?: string;
    prevCursor?: string;
    hasMore: boolean;
  }> {
    const canRead = await this.channelService.canUserReadChannel(channelId, userId, userRoles);
    if (!canRead) {
      throw new Error('Permission denied: Cannot read this channel');
    }

    const limit = options?.limit || 50;
    const direction = options?.direction || 'before';
    const includeThreads = options?.includeThreads || false;

    let query = 'SELECT * FROM messages WHERE channel_id = ?';
    const params: any[] = [channelId];

    // スレッドメッセージを含めるかどうか
    if (!includeThreads) {
      query += ' AND thread_id IS NULL';
    }

    // カーソル位置の指定
    if (options?.cursor) {
      const cursorMessage = await this.getMessageById(options.cursor);
      if (cursorMessage) {
        if (direction === 'before') {
          query += ' AND created_at < ?';
          params.push(cursorMessage.createdAt.toISOString());
        } else {
          query += ' AND created_at > ?';
          params.push(cursorMessage.createdAt.toISOString());
        }
      }
    }

    // ソート順序
    if (direction === 'before') {
      query += ' ORDER BY created_at DESC';
    } else {
      query += ' ORDER BY created_at ASC';
    }

    // 1つ多く取得してhasMoreを判定
    query += ' LIMIT ?';
    params.push(limit + 1);

    const rows = await this.syncService.readData('messages', query, params);
    const messages = rows.slice(0, limit).map(row => this.mapRowToMessage(row));
    const hasMore = rows.length > limit;

    // 結果を時系列順に並び替え
    if (direction === 'before') {
      messages.reverse();
    }

    let nextCursor: string | undefined;
    let prevCursor: string | undefined;

    if (messages.length > 0) {
      if (direction === 'before' && hasMore) {
        nextCursor = messages[0]?.id;
      } else if (direction === 'after' && hasMore) {
        nextCursor = messages[messages.length - 1]?.id;
      }

      if (options?.cursor) {
        if (direction === 'before') {
          prevCursor = messages[messages.length - 1]?.id;
        } else {
          prevCursor = messages[0]?.id;
        }
      }
    }

    const result: {
      messages: Message[];
      nextCursor?: string;
      prevCursor?: string;
      hasMore: boolean;
    } = {
      messages,
      hasMore
    };

    if (nextCursor) result.nextCursor = nextCursor;
    if (prevCursor) result.prevCursor = prevCursor;

    return result;
  }

  // メンション解決（ユーザー名・ロール名からIDを取得）
  private async resolveMentions(content: string): Promise<Mention[]> {
    const mentions = MessageModel.extractMentions(content);
    if (!mentions || !Array.isArray(mentions)) {
      return [];
    }
    
    const resolvedMentions: Mention[] = [];

    for (const mention of mentions) {
      try {
        if (mention.type === 'user') {
          const user = await this.userService.getUserByUsername(mention.name);
          if (user) {
            resolvedMentions.push({
              type: 'user',
              id: user.id,
              name: user.username
            });
          }
        } else if (mention.type === 'role') {
          const role = await this.roleService.getRoleByName(mention.name);
          if (role) {
            resolvedMentions.push({
              type: 'role',
              id: role.id,
              name: role.name
            });
          }
        } else if (mention.type === 'channel') {
          const channel = await this.channelService.getChannelByName(mention.name);
          if (channel) {
            resolvedMentions.push({
              type: 'channel',
              id: channel.id,
              name: channel.name
            });
          }
        }
      } catch (error) {
        // メンション解決に失敗した場合はスキップ
        console.warn(`Failed to resolve mention: ${mention.name}`, error);
      }
    }

    return resolvedMentions;
  }

  // データベース行をMessageオブジェクトに変換
  private mapRowToMessage(row: any): Message {
    const message: Message = {
      id: row.id,
      channelId: row.channel_id,
      userId: row.user_id,
      content: row.content,
      type: row.type,
      mentions: row.mentions ? JSON.parse(row.mentions) : [],
      reactions: row.reactions ? JSON.parse(row.reactions) : [],
      attachments: row.attachments ? JSON.parse(row.attachments) : [],
      embeds: row.embeds ? JSON.parse(row.embeds) : [],
      isPinned: Boolean(row.is_pinned),
      isEdited: Boolean(row.is_edited),
      createdAt: new Date(row.created_at)
    };

    // ユーザー情報を含める
    if (row.username) {
      message.user = {
        id: row.user_id,
        username: row.username,
        passwordHash: '', // 空文字列（セキュリティのため）
        roles: row.roles ? JSON.parse(row.roles) : [],
        profile: {
          displayName: row.display_name || row.username,
          onlineStatus: 'online' as const
        },
        isActive: true,
        isBanned: false,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    // オプショナルフィールドの処理
    if (row.thread_id) {
      message.threadId = row.thread_id;
    }
    if (row.parent_message_id) {
      message.parentId = row.parent_message_id;
    }
    if (row.edited_at) {
      message.editedAt = new Date(row.edited_at);
    }

    return message;
  }

  // キャッシュ内のメッセージ更新
  private updateMessageInCache(message: Message): void {
    const channelMessages = this.messageCache.get(message.channelId);
    if (channelMessages) {
      const index = channelMessages.findIndex(m => m.id === message.id);
      if (index !== -1) {
        channelMessages[index] = message;
      }
    }
  }

  // キャッシュからメッセージ削除
  private removeMessageFromCache(channelId: string, messageId: string): void {
    const channelMessages = this.messageCache.get(channelId);
    if (channelMessages) {
      const index = channelMessages.findIndex(m => m.id === messageId);
      if (index !== -1) {
        channelMessages.splice(index, 1);
      }
    }
  }

  // メッセージの返信取得（スレッド）
  public async getMessageReplies(
    messageId: string,
    userId: string,
    userRoles: string[],
    options?: {
      limit?: number;
      before?: string;
      after?: string;
    }
  ): Promise<Message[]> {
    // 親メッセージの存在確認
    const parentMessage = await this.getMessageById(messageId);
    if (!parentMessage) {
      throw new Error('Parent message not found');
    }

    // チャンネルへの読み取り権限チェック
    const canRead = await this.channelService.canUserReadChannel(parentMessage.channelId, userId, userRoles);
    if (!canRead) {
      throw new Error('Permission denied: Cannot read this channel');
    }

    // 返信メッセージを取得（parentMessageIdが一致するメッセージ）
    const limit = options?.limit || 50;
    const replies = this.sqliteService.query(
      `SELECT m.*, u.username, u.display_name, u.avatar, u.online_status
       FROM messages_cache m
       LEFT JOIN users_cache u ON m.user_id = u.id
       WHERE m.parent_message_id = ? 
       ${options?.before ? 'AND m.created_at < (SELECT created_at FROM messages_cache WHERE id = ?)' : ''}
       ${options?.after ? 'AND m.created_at > (SELECT created_at FROM messages_cache WHERE id = ?)' : ''}
       ORDER BY m.created_at ASC
       LIMIT ?`,
      [
        messageId,
        ...(options?.before ? [options.before] : []),
        ...(options?.after ? [options.after] : []),
        limit
      ]
    );

    // メッセージオブジェクトに変換
    const messages: Message[] = [];
    for (const row of replies) {
      const message = {
        id: row.id,
        channelId: row.channel_id,
        userId: row.user_id,
        content: row.content,
        type: row.type || 'text',
        parentMessageId: row.parent_message_id,
        threadId: row.thread_id,
        isPinned: Boolean(row.is_pinned),
        createdAt: new Date(row.created_at),
        editedAt: row.edited_at ? new Date(row.edited_at) : undefined,
        isEdited: Boolean(row.edited_at),
        mentions: [],
        reactions: [],
        attachments: [],
        embeds: [],
        user: row.username ? {
          id: row.user_id,
          username: row.username,
          roles: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          profile: {
            displayName: row.display_name || row.username,
            avatar: row.avatar || '',
            onlineStatus: (row.online_status as any) || 'offline'
          }
        } as any : undefined
      };

      messages.push(message as Message);
    }

    return messages;
  }

  // メッセージに返信投稿（スレッド）
  public async createMessageReply(
    parentMessageId: string,
    userId: string,
    content: string,
    userRoles: string[]
  ): Promise<Message> {
    // 親メッセージの存在確認
    const parentMessage = await this.getMessageById(parentMessageId);
    if (!parentMessage) {
      throw new Error('Parent message not found');
    }

    // チャンネルへの書き込み権限チェック
    const canWrite = await this.channelService.canUserWriteToChannel(parentMessage.channelId, userId, userRoles);
    if (!canWrite) {
      throw new Error('Permission denied: Cannot write to this channel');
    }

    // ユーザーのタイムアウト状態チェック
    const moderationService = this.getModerationService();
    const isTimedOut = await moderationService.isUserTimedOut(userId);
    if (isTimedOut) {
      throw new Error('You are currently timed out and cannot send messages');
    }

    // メンションを抽出
    const mentions = await this.resolveMentions(content);

    // リンクプレビューを生成
    const urls = MessageModel.extractUrls(content);
    const embeds: Embed[] = [];
    if (urls.length > 0) {
      const linkPreviews = await this.linkPreviewService.generatePreviews(urls);
      embeds.push(...linkPreviews);
    }

    // 返信メッセージ作成
    const replyMessage = MessageModel.create({
      channelId: parentMessage.channelId,
      userId,
      content,
      type: 'text',
      parentMessageId,
      mentions,
      embeds
    });

    // データベースに保存（SQLiteのmessages_cacheテーブル構造に合わせる）
    this.sqliteService.execute(
      `INSERT INTO messages_cache (
        id, channel_id, user_id, content, type, parent_message_id,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        replyMessage.id,
        replyMessage.channelId,
        replyMessage.userId,
        replyMessage.content,
        replyMessage.type,
        replyMessage.parentMessageId,
        replyMessage.createdAt.toISOString()
      ]
    );

    // メンション情報を保存（簡略化）
    if (mentions.length > 0) {
      for (const mention of mentions) {
        const mentionId = require('uuid').v4();
        this.sqliteService.execute(
          'INSERT INTO mentions (id, message_id, user_id, type, created_at) VALUES (?, ?, ?, ?, ?)',
          [mentionId, replyMessage.id, (mention as any).userId, mention.type, new Date().toISOString()]
        );
      }
    }

    // 埋め込み情報を保存（簡略化）
    if (embeds.length > 0) {
      for (const embed of embeds) {
        const embedId = require('uuid').v4();
        this.sqliteService.execute(
          'INSERT INTO embeds (id, message_id, type, title, description, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [embedId, replyMessage.id, embed.type, embed.title, embed.description, embed.url, new Date().toISOString()]
        );
      }
    }

    // ユーザー情報を取得して追加
    const user = await this.userService.getUserById(userId);
    if (user) {
      replyMessage.user = {
        id: user.id,
        username: user.username,
        roles: user.roles,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        profile: {
          displayName: user.profile?.displayName || user.username,
          avatar: user.profile?.avatar || '',
          onlineStatus: user.profile?.onlineStatus || 'offline'
        }
      } as any;
    }

    // フロントエンド互換性のためparentIdを設定
    if (replyMessage.parentMessageId) {
      replyMessage.parentId = replyMessage.parentMessageId;
    }

    // 親メッセージの返信数を更新
    await this.updateMessageReplyCount(parentMessageId);

    // キャッシュを更新
    this.updateMessageInCache(replyMessage);

    return replyMessage;
  }

  // メッセージの返信数を更新（SQLiteテーブルにreply_countカラムが存在しないため、この機能は無効化）
  private async updateMessageReplyCount(messageId: string): Promise<void> {
    // SQLiteのmessages_cacheテーブルにreply_countカラムが存在しないため、
    // 返信数の更新は行わない。必要に応じて動的に計算する。
    // const replyCount = this.sqliteService.query(
    //   'SELECT COUNT(*) as count FROM messages_cache WHERE parent_message_id = ?',
    //   [messageId]
    // );
    // const count = replyCount[0]?.count || 0;
    // 実際のカラムが存在しないため、この更新は無効化
  }
}