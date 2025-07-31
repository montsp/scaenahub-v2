import { Socket } from 'socket.io';
import { MessageService } from '../../services/message';
import { ChannelService } from '../../services/channel';
import { UserService } from '../../services/user';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
  userRoles?: string[];
}

export class MessageHandler {
  private messageService: MessageService;
  private channelService: ChannelService;
  private userService: UserService;

  constructor() {
    this.messageService = MessageService.getInstance();
    this.channelService = ChannelService.getInstance();
    this.userService = UserService.getInstance();
  }

  public setupMessageHandlers(socket: AuthenticatedSocket): void {
    // チャンネル参加
    socket.on('join_channel', async (data: { channelId: string }) => {
      if (!socket.userId) return;

      try {
        const { channelId } = data;
        
        // チャンネル読み取り権限チェック
        const canRead = await this.channelService.canUserReadChannel(
          channelId, 
          socket.userId, 
          socket.userRoles || []
        );

        if (!canRead) {
          socket.emit('error', { message: 'Permission denied: Cannot access this channel' });
          return;
        }

        // チャンネルルームに参加
        await socket.join(`channel:${channelId}`);
        
        socket.emit('channel_joined', { channelId });
        console.log(`User ${socket.username} joined channel ${channelId}`);

      } catch (error) {
        console.error('Join channel error:', error);
        socket.emit('error', { message: 'Failed to join channel' });
      }
    });

    // チャンネル離脱
    socket.on('leave_channel', async (data: { channelId: string }) => {
      try {
        const { channelId } = data;
        
        await socket.leave(`channel:${channelId}`);
        socket.emit('channel_left', { channelId });
        
      } catch (error) {
        console.error('Leave channel error:', error);
        socket.emit('error', { message: 'Failed to leave channel' });
      }
    });

    // メッセージ送信
    socket.on('send_message', async (data: {
      channelId: string;
      content: string;
      type?: 'text' | 'file' | 'system' | 'announcement';
      threadId?: string;
      parentMessageId?: string;
    }) => {
      if (!socket.userId) return;

      try {
        const { channelId, content, type, threadId, parentMessageId } = data;

        // メッセージ作成
        const options: any = {};
        if (type) options.type = type;
        if (threadId) options.threadId = threadId;
        if (parentMessageId) options.parentMessageId = parentMessageId;

        const message = await this.messageService.createMessage(
          channelId,
          socket.userId,
          content,
          socket.userRoles || [],
          options
        );

        // チャンネル内の全ユーザーに配信（送信者を含む）
        socket.to(`channel:${channelId}`).emit('message', message);
        
        // 送信者にも確認を送信
        socket.emit('message_sent', {
          message,
          channelId
        });
        
        // 送信者にもメッセージを送信（リアルタイム更新のため）
        socket.emit('message', message);

        // メンション通知処理
        if (message.mentions.length > 0) {
          await this.handleMentionNotifications(message, socket);
        }

        console.log(`Message sent by ${socket.username} in channel ${channelId}`);

      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // メッセージ編集
    socket.on('edit_message', async (data: {
      messageId: string;
      content: string;
    }) => {
      if (!socket.userId) return;

      try {
        const { messageId, content } = data;

        const editedMessage = await this.messageService.editMessage(
          messageId,
          content,
          socket.userId,
          socket.userRoles || []
        );

        // チャンネル内の全ユーザーに配信
        socket.to(`channel:${editedMessage.channelId}`).emit('message-updated', editedMessage);

        socket.emit('message_edit_success', {
          message: editedMessage
        });

      } catch (error) {
        console.error('Edit message error:', error);
        socket.emit('error', { message: 'Failed to edit message' });
      }
    });

    // メッセージ削除
    socket.on('delete_message', async (data: { messageId: string }) => {
      if (!socket.userId) return;

      try {
        const { messageId } = data;

        // メッセージ情報を取得してからチャンネルIDを保存
        const message = await this.messageService.getMessageById(messageId);
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        const channelId = message.channelId;

        await this.messageService.deleteMessage(
          messageId,
          socket.userId,
          socket.userRoles || []
        );

        // チャンネル内の全ユーザーに配信
        socket.to(`channel:${channelId}`).emit('message-deleted', messageId);

        socket.emit('message_delete_success', {
          messageId,
          channelId
        });

      } catch (error) {
        console.error('Delete message error:', error);
        socket.emit('error', { message: 'Failed to delete message' });
      }
    });

    // リアクション追加
    socket.on('add_reaction', async (data: {
      messageId: string;
      emoji: string;
    }) => {
      if (!socket.userId) return;

      try {
        const { messageId, emoji } = data;

        const updatedMessage = await this.messageService.addReaction(
          messageId,
          emoji,
          socket.userId,
          socket.userRoles || []
        );

        // チャンネル内の全ユーザーに配信
        socket.to(`channel:${updatedMessage.channelId}`).emit('reaction_added', {
          messageId,
          emoji,
          userId: socket.userId,
          username: socket.username,
          reactions: updatedMessage.reactions
        });

        socket.emit('reaction_add_success', {
          messageId,
          emoji,
          reactions: updatedMessage.reactions
        });

      } catch (error) {
        console.error('Add reaction error:', error);
        socket.emit('error', { message: 'Failed to add reaction' });
      }
    });

    // リアクション削除
    socket.on('remove_reaction', async (data: {
      messageId: string;
      emoji: string;
    }) => {
      if (!socket.userId) return;

      try {
        const { messageId, emoji } = data;

        const updatedMessage = await this.messageService.removeReaction(
          messageId,
          emoji,
          socket.userId,
          socket.userRoles || []
        );

        // チャンネル内の全ユーザーに配信
        socket.to(`channel:${updatedMessage.channelId}`).emit('reaction_removed', {
          messageId,
          emoji,
          userId: socket.userId,
          username: socket.username,
          reactions: updatedMessage.reactions
        });

        socket.emit('reaction_remove_success', {
          messageId,
          emoji,
          reactions: updatedMessage.reactions
        });

      } catch (error) {
        console.error('Remove reaction error:', error);
        socket.emit('error', { message: 'Failed to remove reaction' });
      }
    });

    // タイピング開始
    socket.on('typing_start', (data: { channelId: string }) => {
      if (!socket.userId) return;

      const { channelId } = data;
      
      socket.to(`channel:${channelId}`).emit('user_typing_start', {
        userId: socket.userId,
        username: socket.username,
        channelId
      });
    });

    // タイピング終了
    socket.on('typing_stop', (data: { channelId: string }) => {
      if (!socket.userId) return;

      const { channelId } = data;
      
      socket.to(`channel:${channelId}`).emit('user_typing_stop', {
        userId: socket.userId,
        username: socket.username,
        channelId
      });
    });

    // スレッド参加
    socket.on('join_thread', async (data: { threadId: string }) => {
      if (!socket.userId) return;

      try {
        const { threadId } = data;
        
        // スレッドの親メッセージを取得して権限チェック
        const parentMessage = await this.messageService.getMessageById(threadId);
        if (!parentMessage) {
          socket.emit('error', { message: 'Thread not found' });
          return;
        }

        const canRead = await this.channelService.canUserReadChannel(
          parentMessage.channelId,
          socket.userId,
          socket.userRoles || []
        );

        if (!canRead) {
          socket.emit('error', { message: 'Permission denied: Cannot access this thread' });
          return;
        }

        // スレッドルームに参加
        await socket.join(`thread:${threadId}`);
        
        socket.emit('thread_joined', { threadId });

      } catch (error) {
        console.error('Join thread error:', error);
        socket.emit('error', { message: 'Failed to join thread' });
      }
    });

    // スレッド離脱
    socket.on('leave_thread', async (data: { threadId: string }) => {
      try {
        const { threadId } = data;
        
        await socket.leave(`thread:${threadId}`);
        socket.emit('thread_left', { threadId });
        
      } catch (error) {
        console.error('Leave thread error:', error);
        socket.emit('error', { message: 'Failed to leave thread' });
      }
    });
  }

  // メンション通知処理
  private async handleMentionNotifications(message: any, socket: AuthenticatedSocket): Promise<void> {
    try {
      for (const mention of message.mentions) {
        if (mention.type === 'user') {
          // 個別ユーザーメンション
          socket.to(`user:${mention.id}`).emit('mention_notification', {
            messageId: message.id,
            channelId: message.channelId,
            mentionedBy: {
              userId: socket.userId,
              username: socket.username
            },
            content: message.content,
            timestamp: message.createdAt
          });
        } else if (mention.type === 'role') {
          // ロールメンション - そのロールを持つ全ユーザーに通知
          const usersWithRole = await this.userService.getUsersByRole(mention.name);
          
          for (const user of usersWithRole) {
            socket.to(`user:${user.id}`).emit('mention_notification', {
              messageId: message.id,
              channelId: message.channelId,
              mentionedBy: {
                userId: socket.userId,
                username: socket.username
              },
              mentionType: 'role',
              roleName: mention.name,
              content: message.content,
              timestamp: message.createdAt
            });
          }
        }
      }
    } catch (error) {
      console.error('Handle mention notifications error:', error);
    }
  }

  // ユーザー固有のルームに参加（メンション通知用）
  public async joinUserRoom(socket: AuthenticatedSocket): Promise<void> {
    if (socket.userId) {
      await socket.join(`user:${socket.userId}`);
    }
  }

  // ユーザー固有のルームから離脱
  public async leaveUserRoom(socket: AuthenticatedSocket): Promise<void> {
    if (socket.userId) {
      await socket.leave(`user:${socket.userId}`);
    }
  }
}