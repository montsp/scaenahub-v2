/// <reference types="jest" />

import { MessageService } from '../services/message';
import { MessageModel } from '../models/Message';
import { DataSyncService } from '../services/database/sync';
import { UserService } from '../services/user';
import { RoleService } from '../services/role';
import { ChannelService } from '../services/channel';
import { Message } from '../types';

// モックの設定
jest.mock('../services/database/sync');
jest.mock('../models/Message');
jest.mock('../services/user');
jest.mock('../services/role');
jest.mock('../services/channel');
jest.mock('../services/moderation');

const mockSyncService = {
  writeData: jest.fn(),
  readData: jest.fn(),
} as any;

const mockUserService = {
  getUserByUsername: jest.fn(),
} as any;

const mockRoleService = {
  hasPermission: jest.fn(),
  getRoleByName: jest.fn(),
} as any;

const mockChannelService = {
  getChannelById: jest.fn(),
  canUserWriteToChannel: jest.fn(),
  canUserReadChannel: jest.fn(),
  getChannelByName: jest.fn(),
} as any;

const mockModerationService = {
  isUserTimedOut: jest.fn(),
  moderateMessage: jest.fn(),
} as any;

const mockMessageModel = MessageModel as jest.Mocked<typeof MessageModel>;

describe('MessageService', () => {
  let messageService: MessageService;

  beforeEach(() => {
    jest.clearAllMocks();

    // サービスのモック設定
    jest.spyOn(DataSyncService, 'getInstance').mockReturnValue(mockSyncService);
    jest.spyOn(UserService, 'getInstance').mockReturnValue(mockUserService);
    jest.spyOn(RoleService, 'getInstance').mockReturnValue(mockRoleService);
    jest.spyOn(ChannelService, 'getInstance').mockReturnValue(mockChannelService);
    
    // ModerationServiceのモック設定
    const { ModerationService } = require('../services/moderation');
    jest.spyOn(ModerationService, 'getInstance').mockReturnValue(mockModerationService);

    messageService = new MessageService();
  });

  describe('Message Creation', () => {
    const mockMessage: Message = {
      id: 'message-1',
      channelId: 'channel-1',
      userId: 'user-1',
      content: 'Hello @testuser!',
      type: 'text',
      mentions: [{
        type: 'user',
        id: 'user-2',
        name: 'testuser'
      }],
      reactions: [],
      attachments: [],
      embeds: [],
      isPinned: false,
      isEdited: false,
      createdAt: new Date()
    };

    it('should create a message successfully', async () => {
      // モック設定
      mockChannelService.getChannelById.mockResolvedValue({ id: 'channel-1', name: 'general' });
      mockChannelService.canUserWriteToChannel.mockResolvedValue(true);
      mockModerationService.isUserTimedOut.mockResolvedValue(false);
      mockModerationService.moderateMessage.mockResolvedValue({ allowed: true });
      mockUserService.getUserByUsername.mockResolvedValue({ id: 'user-2', username: 'testuser' });
      mockMessageModel.extractMentions.mockReturnValue([{
        type: 'user',
        id: 'testuser',
        name: 'testuser'
      }]);
      mockMessageModel.extractUrls.mockReturnValue([]);
      mockMessageModel.create.mockReturnValue(mockMessage);
      mockSyncService.writeData.mockResolvedValue(undefined);

      const result = await messageService.createMessage(
        'channel-1',
        'user-1',
        'Hello @testuser!',
        ['member']
      );

      expect(result).toEqual(mockMessage);
      expect(mockChannelService.getChannelById).toHaveBeenCalledWith('channel-1');
      expect(mockChannelService.canUserWriteToChannel).toHaveBeenCalledWith('channel-1', 'user-1', ['member']);
      expect(mockMessageModel.create).toHaveBeenCalled();
      expect(mockSyncService.writeData).toHaveBeenCalledWith(
        'messages',
        'INSERT',
        mockMessage.id,
        expect.objectContaining({
          id: mockMessage.id,
          channel_id: mockMessage.channelId,
          user_id: mockMessage.userId,
          content: mockMessage.content
        })
      );
    });

    it('should throw error when channel not found', async () => {
      mockChannelService.getChannelById.mockResolvedValue(null);

      await expect(messageService.createMessage(
        'nonexistent-channel',
        'user-1',
        'Hello!',
        ['member']
      )).rejects.toThrow('Channel not found');
    });

    it('should throw error when user lacks write permission', async () => {
      mockChannelService.getChannelById.mockResolvedValue({ id: 'channel-1', name: 'general' });
      mockChannelService.canUserWriteToChannel.mockResolvedValue(false);

      await expect(messageService.createMessage(
        'channel-1',
        'user-1',
        'Hello!',
        ['member']
      )).rejects.toThrow('Permission denied: Cannot write to this channel');
    });
  });

  describe('Message Editing', () => {
    const mockMessage: Message = {
      id: 'message-1',
      channelId: 'channel-1',
      userId: 'user-1',
      content: 'Original message',
      type: 'text',
      mentions: [],
      reactions: [],
      attachments: [],
      embeds: [],
      isPinned: false,
      isEdited: false,
      createdAt: new Date()
    };

    it('should edit message by owner', async () => {
      const editedMessage = {
        ...mockMessage,
        content: 'Edited message',
        isEdited: true,
        editedAt: new Date()
      };

      mockSyncService.readData.mockResolvedValue([{
        id: 'message-1',
        channel_id: 'channel-1',
        user_id: 'user-1',
        content: 'Original message',
        type: 'text',
        mentions: '[]',
        reactions: '[]',
        attachments: '[]',
        embeds: '[]',
        is_pinned: 0,
        is_edited: 0,
        created_at: mockMessage.createdAt.toISOString()
      }]);

      mockMessageModel.extractMentions.mockReturnValue([]);
      mockMessageModel.extractUrls.mockReturnValue([]);
      mockMessageModel.editMessage.mockReturnValue(editedMessage);
      mockSyncService.writeData.mockResolvedValue(undefined);

      const result = await messageService.editMessage(
        'message-1',
        'Edited message',
        'user-1',
        ['member']
      );

      expect(result.content).toBe('Edited message');
      expect(result.isEdited).toBe(true);
      expect(mockMessageModel.editMessage).toHaveBeenCalledWith(mockMessage, 'Edited message');
      expect(mockSyncService.writeData).toHaveBeenCalledWith(
        'messages',
        'UPDATE',
        'message-1',
        expect.objectContaining({
          content: 'Edited message',
          is_edited: true
        })
      );
    });

    it('should edit message by admin', async () => {
      const editedMessage = {
        ...mockMessage,
        content: 'Admin edited message',
        isEdited: true,
        editedAt: new Date()
      };

      mockSyncService.readData.mockResolvedValue([{
        id: 'message-1',
        channel_id: 'channel-1',
        user_id: 'user-1',
        content: 'Original message',
        type: 'text',
        mentions: '[]',
        reactions: '[]',
        attachments: '[]',
        embeds: '[]',
        is_pinned: 0,
        is_edited: 0,
        created_at: mockMessage.createdAt.toISOString()
      }]);

      mockRoleService.hasPermission.mockResolvedValue(true);
      mockMessageModel.extractMentions.mockReturnValue([]);
      mockMessageModel.extractUrls.mockReturnValue([]);
      mockMessageModel.editMessage.mockReturnValue(editedMessage);
      mockSyncService.writeData.mockResolvedValue(undefined);

      const result = await messageService.editMessage(
        'message-1',
        'Admin edited message',
        'admin-user',
        ['admin']
      );

      expect(result.content).toBe('Admin edited message');
      expect(mockRoleService.hasPermission).toHaveBeenCalledWith(['admin'], 'manageMessages');
    });

    it('should throw error when user lacks edit permission', async () => {
      mockSyncService.readData.mockResolvedValue([{
        id: 'message-1',
        channel_id: 'channel-1',
        user_id: 'user-1',
        content: 'Original message',
        type: 'text',
        mentions: '[]',
        reactions: '[]',
        attachments: '[]',
        embeds: '[]',
        is_pinned: 0,
        is_edited: 0,
        created_at: mockMessage.createdAt.toISOString()
      }]);

      mockRoleService.hasPermission.mockResolvedValue(false);

      await expect(messageService.editMessage(
        'message-1',
        'Edited message',
        'other-user',
        ['member']
      )).rejects.toThrow('Permission denied: Cannot edit this message');
    });
  });

  describe('Message Deletion', () => {
    const mockMessage: Message = {
      id: 'message-1',
      channelId: 'channel-1',
      userId: 'user-1',
      content: 'Message to delete',
      type: 'text',
      mentions: [],
      reactions: [],
      attachments: [],
      embeds: [],
      isPinned: false,
      isEdited: false,
      createdAt: new Date()
    };

    it('should delete message by owner', async () => {
      mockSyncService.readData.mockResolvedValue([{
        id: 'message-1',
        channel_id: 'channel-1',
        user_id: 'user-1',
        content: 'Message to delete',
        type: 'text',
        mentions: '[]',
        reactions: '[]',
        attachments: '[]',
        embeds: '[]',
        is_pinned: 0,
        is_edited: 0,
        created_at: mockMessage.createdAt.toISOString()
      }]);

      mockSyncService.writeData.mockResolvedValue(undefined);

      await messageService.deleteMessage('message-1', 'user-1', ['member']);

      expect(mockSyncService.writeData).toHaveBeenCalledWith(
        'messages',
        'DELETE',
        'message-1',
        {}
      );
    });

    it('should delete message by admin', async () => {
      mockSyncService.readData.mockResolvedValue([{
        id: 'message-1',
        channel_id: 'channel-1',
        user_id: 'user-1',
        content: 'Message to delete',
        type: 'text',
        mentions: '[]',
        reactions: '[]',
        attachments: '[]',
        embeds: '[]',
        is_pinned: 0,
        is_edited: 0,
        created_at: mockMessage.createdAt.toISOString()
      }]);

      mockRoleService.hasPermission.mockResolvedValue(true);
      mockSyncService.writeData.mockResolvedValue(undefined);

      await messageService.deleteMessage('message-1', 'admin-user', ['admin']);

      expect(mockRoleService.hasPermission).toHaveBeenCalledWith(['admin'], 'manageMessages');
      expect(mockSyncService.writeData).toHaveBeenCalledWith(
        'messages',
        'DELETE',
        'message-1',
        {}
      );
    });

    it('should throw error when user lacks delete permission', async () => {
      mockSyncService.readData.mockResolvedValue([{
        id: 'message-1',
        channel_id: 'channel-1',
        user_id: 'user-1',
        content: 'Message to delete',
        type: 'text',
        mentions: '[]',
        reactions: '[]',
        attachments: '[]',
        embeds: '[]',
        is_pinned: 0,
        is_edited: 0,
        created_at: mockMessage.createdAt.toISOString()
      }]);

      mockRoleService.hasPermission.mockResolvedValue(false);

      await expect(messageService.deleteMessage(
        'message-1',
        'other-user',
        ['member']
      )).rejects.toThrow('Permission denied: Cannot delete this message');
    });
  });

  describe('Message Reactions', () => {
    const mockMessage: Message = {
      id: 'message-1',
      channelId: 'channel-1',
      userId: 'user-1',
      content: 'Message with reactions',
      type: 'text',
      mentions: [],
      reactions: [],
      attachments: [],
      embeds: [],
      isPinned: false,
      isEdited: false,
      createdAt: new Date()
    };

    it('should add reaction to message', async () => {
      const messageWithReaction = {
        ...mockMessage,
        reactions: [{
          emoji: '👍',
          users: ['user-2'],
          count: 1
        }]
      };

      mockSyncService.readData.mockResolvedValue([{
        id: 'message-1',
        channel_id: 'channel-1',
        user_id: 'user-1',
        content: 'Message with reactions',
        type: 'text',
        mentions: '[]',
        reactions: '[]',
        attachments: '[]',
        embeds: '[]',
        is_pinned: 0,
        is_edited: 0,
        created_at: mockMessage.createdAt.toISOString()
      }]);

      mockChannelService.canUserReadChannel.mockResolvedValue(true);
      mockMessageModel.addReaction.mockReturnValue(messageWithReaction);
      mockSyncService.writeData.mockResolvedValue(undefined);

      const result = await messageService.addReaction(
        'message-1',
        '👍',
        'user-2',
        ['member']
      );

      expect(result.reactions).toHaveLength(1);
      expect(result.reactions[0]?.emoji).toBe('👍');
      expect(mockMessageModel.addReaction).toHaveBeenCalledWith(mockMessage, '👍', 'user-2');
      expect(mockSyncService.writeData).toHaveBeenCalledWith(
        'messages',
        'UPDATE',
        'message-1',
        expect.objectContaining({
          reactions: JSON.stringify(messageWithReaction.reactions)
        })
      );
    });

    it('should remove reaction from message', async () => {
      const messageWithoutReaction = {
        ...mockMessage,
        reactions: []
      };

      mockSyncService.readData.mockResolvedValue([{
        id: 'message-1',
        channel_id: 'channel-1',
        user_id: 'user-1',
        content: 'Message with reactions',
        type: 'text',
        mentions: '[]',
        reactions: JSON.stringify([{ emoji: '👍', users: ['user-2'], count: 1 }]),
        attachments: '[]',
        embeds: '[]',
        is_pinned: 0,
        is_edited: 0,
        created_at: mockMessage.createdAt.toISOString()
      }]);

      mockChannelService.canUserReadChannel.mockResolvedValue(true);
      mockMessageModel.removeReaction.mockReturnValue(messageWithoutReaction);
      mockSyncService.writeData.mockResolvedValue(undefined);

      const result = await messageService.removeReaction(
        'message-1',
        '👍',
        'user-2',
        ['member']
      );

      expect(result.reactions).toHaveLength(0);
      expect(mockMessageModel.removeReaction).toHaveBeenCalled();
    });
  });

  describe('Message Pinning', () => {
    const mockMessage: Message = {
      id: 'message-1',
      channelId: 'channel-1',
      userId: 'user-1',
      content: 'Message to pin',
      type: 'text',
      mentions: [],
      reactions: [],
      attachments: [],
      embeds: [],
      isPinned: false,
      isEdited: false,
      createdAt: new Date()
    };

    it('should pin message with admin permission', async () => {
      const pinnedMessage = { ...mockMessage, isPinned: true };

      mockSyncService.readData.mockResolvedValue([{
        id: 'message-1',
        channel_id: 'channel-1',
        user_id: 'user-1',
        content: 'Message to pin',
        type: 'text',
        mentions: '[]',
        reactions: '[]',
        attachments: '[]',
        embeds: '[]',
        is_pinned: 0,
        is_edited: 0,
        created_at: mockMessage.createdAt.toISOString()
      }]);

      mockRoleService.hasPermission.mockResolvedValue(true);
      mockMessageModel.pinMessage.mockReturnValue(pinnedMessage);
      mockSyncService.writeData.mockResolvedValue(undefined);

      const result = await messageService.pinMessage('message-1', 'admin-user', ['admin']);

      expect(result.isPinned).toBe(true);
      expect(mockRoleService.hasPermission).toHaveBeenCalledWith(['admin'], 'manageMessages');
      expect(mockMessageModel.pinMessage).toHaveBeenCalledWith(mockMessage);
    });

    it('should throw error when user lacks pin permission', async () => {
      mockSyncService.readData.mockResolvedValue([{
        id: 'message-1',
        channel_id: 'channel-1',
        user_id: 'user-1',
        content: 'Message to pin',
        type: 'text',
        mentions: '[]',
        reactions: '[]',
        attachments: '[]',
        embeds: '[]',
        is_pinned: 0,
        is_edited: 0,
        created_at: mockMessage.createdAt.toISOString()
      }]);

      mockRoleService.hasPermission.mockResolvedValue(false);

      await expect(messageService.pinMessage(
        'message-1',
        'user-1',
        ['member']
      )).rejects.toThrow('Permission denied: Cannot pin messages');
    });
  });

  describe('Channel Messages Retrieval', () => {
    it('should get channel messages with pagination', async () => {
      const mockMessages = [
        {
          id: 'message-1',
          channel_id: 'channel-1',
          user_id: 'user-1',
          content: 'First message',
          type: 'text',
          mentions: '[]',
          reactions: '[]',
          attachments: '[]',
          embeds: '[]',
          is_pinned: 0,
          is_edited: 0,
          created_at: new Date('2024-01-01T10:00:00Z').toISOString()
        },
        {
          id: 'message-2',
          channel_id: 'channel-1',
          user_id: 'user-2',
          content: 'Second message',
          type: 'text',
          mentions: '[]',
          reactions: '[]',
          attachments: '[]',
          embeds: '[]',
          is_pinned: 0,
          is_edited: 0,
          created_at: new Date('2024-01-01T11:00:00Z').toISOString()
        }
      ];

      mockChannelService.canUserReadChannel.mockResolvedValue(true);
      mockSyncService.readData.mockResolvedValue(mockMessages);

      const result = await messageService.getChannelMessages(
        'channel-1',
        'user-1',
        ['member'],
        { limit: 10 }
      );

      expect(result).toHaveLength(2);
      expect(result[0]?.content).toBe('Second message'); // DESC順で取得後、reverse()で時系列順に
      expect(result[1]?.content).toBe('First message');
      expect(mockChannelService.canUserReadChannel).toHaveBeenCalledWith('channel-1', 'user-1', ['member']);
    });

    it('should throw error when user lacks read permission', async () => {
      mockChannelService.canUserReadChannel.mockResolvedValue(false);

      await expect(messageService.getChannelMessages(
        'channel-1',
        'user-1',
        ['member']
      )).rejects.toThrow('Permission denied: Cannot read this channel');
    });
  });
});