import { ChannelService } from '../services/channel';
import { DataSyncService } from '../services/database/sync';
import { RoleService } from '../services/role';
import { UserService } from '../services/user';
import { ChannelModel } from '../models/Channel';

// モック設定
const mockSyncService = {
  readData: jest.fn(),
  writeData: jest.fn(),
  getInstance: jest.fn()
};

const mockRoleService = {
  hasPermission: jest.fn(),
  getHighestPosition: jest.fn(),
  getInstance: jest.fn()
};

const mockUserService = {
  getUserById: jest.fn(),
  getInstance: jest.fn()
};

jest.mock('../services/database/sync', () => ({
  DataSyncService: {
    getInstance: () => mockSyncService
  }
}));

jest.mock('../services/role', () => ({
  RoleService: {
    getInstance: () => mockRoleService
  }
}));

jest.mock('../services/user', () => ({
  UserService: {
    getInstance: () => mockUserService
  }
}));

jest.mock('../models/Channel');

describe.skip('ChannelService', () => {
  let channelService: ChannelService;

  beforeEach(() => {
    channelService = ChannelService.getInstance();
    
    // モックをリセット
    jest.clearAllMocks();
    
    // キャッシュをクリア
    channelService.clearCache();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createChannel', () => {
    it('should create a new channel successfully', async () => {
      const mockChannel = {
        id: 'channel-1',
        name: 'test-channel',
        description: 'Test channel',
        type: 'text',
        categoryId: 'category-1',
        position: 0,
        isPrivate: false,
        permissions: {},
        allowedRoles: [],
        allowedUsers: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 重複チェック用のモック
      mockSyncService.readData.mockReturnValue([]);
      
      (ChannelModel.create as jest.Mock).mockReturnValue(mockChannel);
      mockSyncService.writeData.mockResolvedValue(undefined);

      const channelData = {
        name: 'test-channel',
        description: 'Test channel',
        type: 'text' as const,
        categoryId: 'category-1'
      };

      const result = await channelService.createChannel(channelData);

      expect(ChannelModel.create).toHaveBeenCalledWith(channelData);
      expect(mockSyncService.writeData).toHaveBeenCalledWith('channels', 'INSERT', 'channel-1', expect.any(Object));
      expect(result.name).toBe('test-channel');
    });

    it('should throw error for duplicate channel name', async () => {
      const existingChannel = {
        id: 'channel-1',
        name: 'existing-channel'
      };

      mockSyncService.readData.mockReturnValue([existingChannel]);

      const channelData = {
        name: 'existing-channel',
        type: 'text' as const
      };

      await expect(channelService.createChannel(channelData)).rejects.toThrow("Channel 'existing-channel' already exists");
    });

    it('should throw error for non-existent category', async () => {
      mockSyncService.readData
        .mockReturnValueOnce([]) // チャンネル名重複チェック
        .mockReturnValueOnce([]); // カテゴリ存在チェック

      const channelData = {
        name: 'test-channel',
        type: 'text' as const,
        categoryId: 'non-existent-category'
      };

      await expect(channelService.createChannel(channelData)).rejects.toThrow('Category not found');
    });
  });

  describe('updateChannel', () => {
    it('should update channel successfully', async () => {
      const existingChannel = {
        id: 'channel-1',
        name: 'test-channel',
        description: 'Test channel',
        type: 'text',
        categoryId: 'category-1',
        position: 0,
        isPrivate: false,
        permissions: {},
        allowedRoles: [],
        allowedUsers: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const updatedChannel = {
        ...existingChannel,
        description: 'Updated description',
        updatedAt: new Date()
      };

      // getChannelById用のモック
      mockSyncService.readData.mockReturnValue([{
        id: 'channel-1',
        name: 'test-channel',
        description: 'Test channel',
        type: 'text',
        category_id: 'category-1',
        position: 0,
        is_private: false,
        permissions: JSON.stringify({}),
        allowed_roles: JSON.stringify([]),
        allowed_users: JSON.stringify([]),
        created_at: existingChannel.createdAt.toISOString(),
        updated_at: existingChannel.updatedAt.toISOString()
      }]);

      (ChannelModel.validate as jest.Mock).mockReturnValue({ isValid: true, errors: [] });
      mockSyncService.writeData.mockResolvedValue(undefined);

      const result = await channelService.updateChannel('channel-1', { description: 'Updated description' });

      expect(mockSyncService.writeData).toHaveBeenCalledWith('channels', 'UPDATE', 'channel-1', expect.any(Object));
      expect(result.description).toBe('Updated description');
    });

    it('should throw error when updating non-existent channel', async () => {
      mockSyncService.readData.mockReturnValue([]);

      await expect(channelService.updateChannel('non-existent', { description: 'Updated' }))
        .rejects.toThrow('Channel not found');
    });

    it('should prevent duplicate channel names', async () => {
      mockSyncService.readData
        .mockReturnValueOnce([{ // getChannelById用
          id: 'channel-1',
          name: 'test-channel',
          description: 'Test channel',
          type: 'text',
          category_id: 'category-1',
          position: 0,
          is_private: false,
          permissions: JSON.stringify({}),
          allowed_roles: JSON.stringify([]),
          allowed_users: JSON.stringify([]),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .mockReturnValueOnce([{ // getChannelByName用
          id: 'channel-2',
          name: 'existing-name'
        }]);

      await expect(channelService.updateChannel('channel-1', { name: 'existing-name' }))
        .rejects.toThrow("Channel 'existing-name' already exists");
    });
  });

  describe('deleteChannel', () => {
    it('should delete channel successfully', async () => {
      const channel = {
        id: 'channel-1',
        name: 'test-channel'
      };

      // getChannelById用のモック
      mockSyncService.readData
        .mockReturnValueOnce([{
          id: 'channel-1',
          name: 'test-channel',
          description: 'Test channel',
          type: 'text',
          category_id: 'category-1',
          position: 0,
          is_private: false,
          permissions: JSON.stringify({}),
          allowed_roles: JSON.stringify([]),
          allowed_users: JSON.stringify([]),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .mockReturnValueOnce([{ count: 0 }]); // メッセージ数チェック用

      mockSyncService.writeData.mockResolvedValue(undefined);

      await channelService.deleteChannel('channel-1');

      expect(mockSyncService.writeData).toHaveBeenCalledWith('channels', 'DELETE', 'channel-1', {});
    });

    it('should prevent deleting channels with messages', async () => {
      mockSyncService.readData
        .mockReturnValueOnce([{
          id: 'channel-1',
          name: 'test-channel',
          description: 'Test channel',
          type: 'text',
          category_id: 'category-1',
          position: 0,
          is_private: false,
          permissions: JSON.stringify({}),
          allowed_roles: JSON.stringify([]),
          allowed_users: JSON.stringify([]),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .mockReturnValueOnce([{ count: 5 }]); // メッセージ数チェック用

      await expect(channelService.deleteChannel('channel-1'))
        .rejects.toThrow("Cannot delete channel 'test-channel' - 5 messages exist");
    });
  });

  describe('checkChannelPermissions', () => {
    it('should allow all permissions for server managers', async () => {
      const channel = {
        id: 'channel-1',
        name: 'test-channel',
        type: 'text',
        isPrivate: false,
        allowedRoles: [],
        allowedUsers: []
      };

      mockRoleService.hasPermission
        .mockResolvedValueOnce(true) // manageServer
        .mockResolvedValueOnce(false); // manageChannels

      const result = await channelService.checkChannelPermissions(
        channel as any,
        ['admin'],
        'user-1'
      );

      expect(result).toEqual({
        canView: true,
        canSend: true,
        canManage: true
      });
    });

    it('should deny access to private channels without permission', async () => {
      const channel = {
        id: 'channel-1',
        name: 'private-channel',
        type: 'text',
        isPrivate: true,
        allowedRoles: ['admin'],
        allowedUsers: []
      };

      mockRoleService.hasPermission
        .mockResolvedValueOnce(false) // manageServer
        .mockResolvedValueOnce(false); // manageChannels

      const result = await channelService.checkChannelPermissions(
        channel as any,
        ['member'],
        'user-1'
      );

      expect(result).toEqual({
        canView: false,
        canSend: false,
        canManage: false
      });
    });

    it('should allow access to private channels with role permission', async () => {
      const channel = {
        id: 'channel-1',
        name: 'private-channel',
        type: 'text',
        isPrivate: true,
        allowedRoles: ['member'],
        allowedUsers: []
      };

      mockRoleService.hasPermission
        .mockResolvedValueOnce(false) // manageServer
        .mockResolvedValueOnce(false) // manageChannels
        .mockResolvedValueOnce(true)  // viewChannels
        .mockResolvedValueOnce(true); // sendMessages

      const result = await channelService.checkChannelPermissions(
        channel as any,
        ['member'],
        'user-1'
      );

      expect(result).toEqual({
        canView: true,
        canSend: true,
        canManage: false
      });
    });

    it('should restrict sending in announcement channels', async () => {
      const channel = {
        id: 'channel-1',
        name: 'announcements',
        type: 'announcement',
        isPrivate: false,
        allowedRoles: [],
        allowedUsers: []
      };

      mockRoleService.hasPermission
        .mockResolvedValueOnce(false) // manageServer
        .mockResolvedValueOnce(false) // manageChannels
        .mockResolvedValueOnce(true)  // viewChannels
        .mockResolvedValueOnce(true)  // sendMessages
        .mockResolvedValueOnce(false); // manageMessages

      const result = await channelService.checkChannelPermissions(
        channel as any,
        ['member'],
        'user-1'
      );

      expect(result).toEqual({
        canView: true,
        canSend: false,
        canManage: false
      });
    });
  });

  describe('searchChannels', () => {
    it('should search channels by name', async () => {
      const channelsData = [
        {
          id: 'channel-1',
          name: 'general',
          description: 'General discussion',
          type: 'text',
          category_id: 'category-1',
          position: 0,
          is_private: false,
          permissions: JSON.stringify({}),
          allowed_roles: JSON.stringify([]),
          allowed_users: JSON.stringify([]),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      mockSyncService.readData
        .mockReturnValueOnce([{ count: 1 }]) // 総数
        .mockReturnValueOnce(channelsData); // 検索結果

      const result = await channelService.searchChannels({
        query: 'general',
        limit: 10,
        offset: 0
      });

      expect(result.channels).toHaveLength(1);
      expect(result.channels[0]?.name).toBe('general');
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should filter channels by type', async () => {
      const channelsData = [
        {
          id: 'channel-1',
          name: 'announcements',
          description: 'Important announcements',
          type: 'announcement',
          category_id: 'category-1',
          position: 0,
          is_private: false,
          permissions: JSON.stringify({}),
          allowed_roles: JSON.stringify([]),
          allowed_users: JSON.stringify([]),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      mockSyncService.readData
        .mockReturnValueOnce([{ count: 1 }]) // 総数
        .mockReturnValueOnce(channelsData); // 検索結果

      const result = await channelService.searchChannels({
        type: 'announcement',
        limit: 10,
        offset: 0
      });

      expect(result.channels).toHaveLength(1);
      expect(result.channels[0]?.type).toBe('announcement');
    });
  });

  describe('category management', () => {
    it('should create category successfully', async () => {
      mockSyncService.readData.mockReturnValue([]); // 重複チェック
      mockSyncService.writeData.mockResolvedValue(undefined);

      const categoryData = {
        name: 'General',
        position: 0
      };

      const result = await channelService.createCategory(categoryData);

      expect(result.name).toBe('General');
      expect(result.position).toBe(0);
      expect(result.channels).toEqual([]);
      expect(mockSyncService.writeData).toHaveBeenCalledWith('categories', 'INSERT', expect.any(String), expect.any(Object));
    });

    it('should throw error for duplicate category name', async () => {
      const existingCategory = {
        id: 'category-1',
        name: 'General'
      };

      mockSyncService.readData.mockReturnValue([existingCategory]);

      const categoryData = {
        name: 'General'
      };

      await expect(channelService.createCategory(categoryData)).rejects.toThrow("Category 'General' already exists");
    });

    it('should update category successfully', async () => {
      const existingCategory = {
        id: 'category-1',
        name: 'General',
        position: 0,
        channels: []
      };

      mockSyncService.readData.mockReturnValue([{
        id: 'category-1',
        name: 'General',
        position: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);

      mockSyncService.writeData.mockResolvedValue(undefined);

      const result = await channelService.updateCategory('category-1', { name: 'Updated General' });

      expect(result.name).toBe('Updated General');
      expect(mockSyncService.writeData).toHaveBeenCalledWith('categories', 'UPDATE', 'category-1', expect.any(Object));
    });

    it('should delete empty category successfully', async () => {
      mockSyncService.readData
        .mockReturnValueOnce([{ // getCategoryById用
          id: 'category-1',
          name: 'General',
          position: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .mockReturnValueOnce([]) // カテゴリ内のチャンネル
        .mockReturnValueOnce([{ count: 0 }]); // チャンネル数チェック

      mockSyncService.writeData.mockResolvedValue(undefined);

      await channelService.deleteCategory('category-1');

      expect(mockSyncService.writeData).toHaveBeenCalledWith('categories', 'DELETE', 'category-1', {});
    });

    it('should prevent deleting category with channels', async () => {
      mockSyncService.readData
        .mockReturnValueOnce([{ // getCategoryById用
          id: 'category-1',
          name: 'General',
          position: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .mockReturnValueOnce([]) // カテゴリ内のチャンネル
        .mockReturnValueOnce([{ count: 2 }]); // チャンネル数チェック

      await expect(channelService.deleteCategory('category-1'))
        .rejects.toThrow("Cannot delete category 'General' - 2 channels exist");
    });
  });

  describe('getChannelStatistics', () => {
    it('should return channel statistics', async () => {
      const channelsData = [
        {
          id: 'channel-1',
          name: 'general',
          type: 'text',
          is_private: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          description: '',
          category_id: null,
          position: 0,
          permissions: JSON.stringify({}),
          allowed_roles: JSON.stringify([]),
          allowed_users: JSON.stringify([])
        },
        {
          id: 'channel-2',
          name: 'announcements',
          type: 'announcement',
          is_private: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          description: '',
          category_id: null,
          position: 1,
          permissions: JSON.stringify({}),
          allowed_roles: JSON.stringify([]),
          allowed_users: JSON.stringify([])
        },
        {
          id: 'channel-3',
          name: 'private',
          type: 'text',
          is_private: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          description: '',
          category_id: null,
          position: 2,
          permissions: JSON.stringify({}),
          allowed_roles: JSON.stringify([]),
          allowed_users: JSON.stringify([])
        }
      ];

      const categoriesData = [
        {
          id: 'category-1',
          name: 'General',
          position: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      mockSyncService.readData
        .mockReturnValueOnce(channelsData) // getAllChannels用
        .mockReturnValueOnce(categoriesData) // getAllCategories用
        .mockReturnValueOnce([]); // getCategoryById用のチャンネル

      const result = await channelService.getChannelStatistics();

      expect(result.totalChannels).toBe(3);
      expect(result.channelsByType).toEqual([
        { type: 'text', count: 2 },
        { type: 'announcement', count: 1 },
        { type: 'discussion', count: 0 }
      ]);
      expect(result.privateChannels).toBe(1);
      expect(result.publicChannels).toBe(2);
      expect(result.totalCategories).toBe(1);
    });
  });

  describe('initializeDefaultChannels', () => {
    it('should initialize default channels when none exist', async () => {
      mockSyncService.readData
        .mockReturnValueOnce([]) // 既存チャンネルチェック
        .mockReturnValueOnce([]) // カテゴリ重複チェック
        .mockReturnValueOnce([]) // チャンネル重複チェック（general）
        .mockReturnValueOnce([]) // チャンネル重複チェック（announcements）;

      mockSyncService.writeData.mockResolvedValue(undefined);
      (ChannelModel.create as jest.Mock).mockImplementation((data) => ({
        id: `channel-${data.name}`,
        ...data,
        position: data.position || 0,
        isPrivate: false,
        permissions: {},
        allowedRoles: [],
        allowedUsers: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      await channelService.initializeDefaultChannels();

      expect(mockSyncService.writeData).toHaveBeenCalledTimes(3); // 1カテゴリ + 2チャンネル
    });

    it('should skip initialization when channels already exist', async () => {
      mockSyncService.readData.mockReturnValue([{
        id: 'channel-1',
        name: 'general'
      }]);

      await channelService.initializeDefaultChannels();

      expect(mockSyncService.writeData).not.toHaveBeenCalled();
    });
  });
});