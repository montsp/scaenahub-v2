import { Message, Mention, Reaction, Attachment, Embed } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class MessageModel {
  public static validate(messageData: Partial<Message>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // チャンネルID検証
    if (!messageData.channelId) {
      errors.push('Channel ID is required');
    }

    // ユーザーID検証
    if (!messageData.userId) {
      errors.push('User ID is required');
    }

    // コンテンツ検証
    if (!messageData.content) {
      errors.push('Message content is required');
    } else if (messageData.content.length > parseInt(process.env.MAX_MESSAGE_LENGTH || '2000')) {
      errors.push(`Message content must be ${process.env.MAX_MESSAGE_LENGTH || '2000'} characters or less`);
    }

    // タイプ検証
    if (messageData.type && !['text', 'file', 'system', 'announcement'].includes(messageData.type)) {
      errors.push('Invalid message type');
    }

    // メンション検証
    if (messageData.mentions && !Array.isArray(messageData.mentions)) {
      errors.push('Mentions must be an array');
    }

    // リアクション検証
    if (messageData.reactions && !Array.isArray(messageData.reactions)) {
      errors.push('Reactions must be an array');
    }

    // 添付ファイル検証
    if (messageData.attachments && !Array.isArray(messageData.attachments)) {
      errors.push('Attachments must be an array');
    }

    // 埋め込み検証
    if (messageData.embeds && !Array.isArray(messageData.embeds)) {
      errors.push('Embeds must be an array');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  public static validateMention(mention: Partial<Mention>): string[] {
    const errors: string[] = [];

    if (!mention.type || !['user', 'role', 'channel'].includes(mention.type)) {
      errors.push('Invalid mention type');
    }

    if (!mention.id) {
      errors.push('Mention ID is required');
    }

    if (!mention.name) {
      errors.push('Mention name is required');
    }

    return errors;
  }

  public static validateReaction(reaction: Partial<Reaction>): string[] {
    const errors: string[] = [];

    if (!reaction.emoji) {
      errors.push('Reaction emoji is required');
    }

    if (!reaction.users || !Array.isArray(reaction.users)) {
      errors.push('Reaction users must be an array');
    }

    if (typeof reaction.count !== 'number' || reaction.count < 0) {
      errors.push('Reaction count must be a non-negative number');
    }

    return errors;
  }

  public static validateAttachment(attachment: Partial<Attachment>): string[] {
    const errors: string[] = [];

    if (!attachment.filename) {
      errors.push('Attachment filename is required');
    }

    if (!attachment.mimeType) {
      errors.push('Attachment MIME type is required');
    }

    if (typeof attachment.size !== 'number' || attachment.size < 0) {
      errors.push('Attachment size must be a non-negative number');
    }

    if (!attachment.googleDriveId) {
      errors.push('Google Drive ID is required for attachment');
    }

    if (!attachment.url) {
      errors.push('Attachment URL is required');
    }

    return errors;
  }

  public static create(messageData: {
    channelId: string;
    userId: string;
    content: string;
    type?: Message['type'];
    threadId?: string;
    parentMessageId?: string;
    mentions?: Mention[];
    attachments?: Attachment[];
    embeds?: Embed[];
  }): Message {
    const now = new Date();

    const message: Message = {
      id: uuidv4(),
      channelId: messageData.channelId,
      userId: messageData.userId,
      content: messageData.content,
      type: messageData.type || 'text',
      mentions: messageData.mentions || [],
      reactions: [],
      attachments: messageData.attachments || [],
      embeds: messageData.embeds || [],
      isPinned: false,
      isEdited: false,
      createdAt: now
    };
    
    if (messageData.threadId) {
      message.threadId = messageData.threadId;
    }
    
    if (messageData.parentMessageId) {
      message.parentMessageId = messageData.parentMessageId;
    }

    const validation = MessageModel.validate(message);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    return message;
  }

  public static extractMentions(content: string): Mention[] {
    const mentions: Mention[] = [];
    
    // @ユーザー名のパターン
    const userMentionRegex = /@(\w+)/g;
    let match;
    
    while ((match = userMentionRegex.exec(content)) !== null) {
      if (match[1]) {
        mentions.push({
          type: 'user',
          id: match[1], // 実際の実装では、ユーザー名からIDを解決する必要がある
          name: match[1]
        });
      }
    }

    // @role:ロール名のパターン
    const roleMentionRegex = /@role:(\w+)/g;
    while ((match = roleMentionRegex.exec(content)) !== null) {
      if (match[1]) {
        mentions.push({
          type: 'role',
          id: match[1], // 実際の実装では、ロール名からIDを解決する必要がある
          name: match[1]
        });
      }
    }

    // #チャンネル名のパターン
    const channelMentionRegex = /#(\w+)/g;
    while ((match = channelMentionRegex.exec(content)) !== null) {
      if (match[1]) {
        mentions.push({
          type: 'channel',
          id: match[1], // 実際の実装では、チャンネル名からIDを解決する必要がある
          name: match[1]
        });
      }
    }

    return mentions;
  }

  public static extractUrls(content: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = content.match(urlRegex);
    return urls || [];
  }

  public static addReaction(message: Message, emoji: string, userId: string): Message {
    const existingReaction = message.reactions.find(r => r.emoji === emoji);
    
    if (existingReaction) {
      // 既存のリアクションにユーザーを追加
      if (!existingReaction.users.includes(userId)) {
        existingReaction.users.push(userId);
        existingReaction.count = existingReaction.users.length;
      }
    } else {
      // 新しいリアクションを追加
      message.reactions.push({
        emoji,
        users: [userId],
        count: 1
      });
    }

    return { ...message };
  }

  public static removeReaction(message: Message, emoji: string, userId: string): Message {
    const reactionIndex = message.reactions.findIndex(r => r.emoji === emoji);
    
    if (reactionIndex !== -1) {
      const reaction = message.reactions[reactionIndex];
      if (reaction) {
        const userIndex = reaction.users.indexOf(userId);
        
        if (userIndex !== -1) {
          reaction.users.splice(userIndex, 1);
          reaction.count = reaction.users.length;
          
          // ユーザーがいなくなったらリアクションを削除
          if (reaction.count === 0) {
            message.reactions.splice(reactionIndex, 1);
          }
        }
      }
    }

    return { ...message };
  }

  public static editMessage(message: Message, newContent: string): Message {
    const validation = MessageModel.validate({ ...message, content: newContent });
    if (!validation.isValid) {
      throw new Error(`Edit validation failed: ${validation.errors.join(', ')}`);
    }

    return {
      ...message,
      content: newContent,
      isEdited: true,
      editedAt: new Date()
    };
  }

  public static pinMessage(message: Message): Message {
    return {
      ...message,
      isPinned: true
    };
  }

  public static unpinMessage(message: Message): Message {
    return {
      ...message,
      isPinned: false
    };
  }

  public static createSystemMessage(channelId: string, content: string): Message {
    return MessageModel.create({
      channelId,
      userId: 'system',
      content,
      type: 'system'
    });
  }

  public static createAnnouncementMessage(channelId: string, userId: string, content: string): Message {
    return MessageModel.create({
      channelId,
      userId,
      content,
      type: 'announcement'
    });
  }

  public static isUserMentioned(message: Message, userId: string, userRoles: string[]): boolean {
    // 直接的なユーザーメンション
    const userMentioned = message.mentions.some(m => m.type === 'user' && m.id === userId);
    if (userMentioned) return true;

    // ロールメンション
    const roleMentioned = message.mentions.some(m => 
      m.type === 'role' && userRoles.includes(m.name)
    );
    
    return roleMentioned;
  }
}