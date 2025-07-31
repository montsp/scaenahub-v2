import { AdminService } from '../services/admin';
import { DataSyncService } from '../services/database/sync';
import { UserService } from '../services/user';
import { RoleService } from '../services/role';
import { ChannelService } from '../services/channel';
import { ModerationService } from '../services/moderation';

// モック設定
const mockSyncService = {
  readData: jest.fn(),
  writeData: jest.fn(),
  getInstance: jest.fn()
};

const mockUserService = {
  getInstance: jest.fn()
};

const mockRoleService = {
  getInstance: jest.fn()
};

const mockChannelService = {
  getInstance: jest.fn()
};

const mockModerationService = {
  createModerationLog: jest.fn(),
  getInstance: jest.fn()
};

jest.mock('../services/database/sync', () => ({
  DataSyncService: {
    getInstance: () => mockSyncService
  }
}));

jest.mock('../services/user', () => ({
  UserService: {
    getInstance: () => mockUserService
  }
}));

jest.mock('../services/role', () => ({
  RoleService: {
    getInstance: () => mockRoleService
  }
}));

jest.mock('../services/channel', () => ({
  ChannelService: {
    getInstance: () => mockChannelService
  }
}));

jest.mock('../services/moderation', () => ({
  ModerationService: {
    getInstance: () => mockModerationService
  }
}));

jest.mock('../utils/performanceMonitor', () => ({
  PerformanceMonitor: {
    getInstance: jest.fn().mockReturnValue({
      getAllStats: jest.fn().mockReturnValue({
        database_queries: { count: 100 },
        tidb_requests: { count: 1000 },
        google_drive_usage: { count: 500000000 }
      })
    })
  }
}));

describe('AdminService', () => {
  let adminService: AdminService;

  beforeEach(() => {
    adminService = AdminService.getInstance();
    jest.clearAllMocks();
  });

  describe('Server Settings Management', () => {
    it('should get default server settings when none exist', async () => {
      mockSyncService.readData.mockReturnValue([]);
      mockSyncService.writeData.mockResolvedValue(undefined);

      const settings = await adminService.getServerSettings();

      expect(settings.serverName).toBe('ScaenaHub v2');
      expect(settings.description).toBe('Theater project communication platform');
      expect(settings.defaultRole).toBe('member');
      expect(settings.maxMembers).toBe(100);
      expect(settings.inviteEnabled).toBe(true);
      expect(settings.publicServer).toBe(false);
    });

    it('should get existing server settings', async () => {
      const mockSettings = {
        server_name: 'Custom Server',
        description: 'Custom description',
        icon_url: 'https://example.com/icon.png',
        default_role: 'user',
        welcome_channel_id: 'channel-1',
        rules_channel_id: 'channel-2',
        max_members: 50,
        invite_enabled: 0,
        public_server: 1,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };

      mockSyncService.readData.mockReturnValue([mockSettings]);

      const settings = await adminService.getServerSettings();

      expect(settings.serverName).toBe('Custom Server');
      expect(settings.description).toBe('Custom description');
      expect(settings.iconUrl).toBe('https://example.com/icon.png');
      expect(settings.defaultRole).toBe('user');
      expect(settings.welcomeChannelId).toBe('channel-1');
      expect(settings.rulesChannelId).toBe('channel-2');
      expect(settings.maxMembers).toBe(50);
      expect(settings.inviteEnabled).toBe(false);
      expect(settings.publicServer).toBe(true);
    });

    it('should update server settings', async () => {
      const existingSettings = {
        server_name: 'Old Server',
        description: 'Old description',
        default_role: 'member',
        max_members: 100,
        invite_enabled: 1,
        public_server: 0,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z'
      };

      mockSyncService.readData.mockReturnValue([existingSettings]);
      mockSyncService.writeData.mockResolvedValue(undefined);

      const updates = {
        serverName: 'New Server',
        description: 'New description',
        maxMembers: 200
      };

      const updatedSettings = await adminService.updateServerSettings(updates);

      expect(updatedSettings.serverName).toBe('New Server');
      expect(updatedSettings.description).toBe('New description');
      expect(updatedSettings.maxMembers).toBe(200);
      expect(updatedSettings.defaultRole).toBe('member'); // Should keep existing value
      expect(mockSyncService.writeData).toHaveBeenCalled();
    });
  });

  describe('System Statistics', () => {
    it('should get system statistics', async () => {
      const mockUsers = [
        { id: 'user-1', last_seen: new Date().toISOString(), is_active: 1 },
        { id: 'user-2', last_seen: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), is_active: 1 },
        { id: 'user-3', last_seen: new Date().toISOString(), is_active: 0 }
      ];
      const mockChannels = [{ id: 'channel-1' }, { id: 'channel-2' }];
      const mockMessages = [{ count: 150 }];
      const mockRoles = [{ id: 'role-1' }, { id: 'role-2' }, { id: 'role-3' }];

      mockSyncService.readData
        .mockReturnValueOnce(mockUsers) // users
        .mockReturnValueOnce(mockChannels) // channels
        .mockReturnValueOnce(mockMessages) // messages
        .mockReturnValueOnce(mockRoles); // roles

      const stats = await adminService.getSystemStats();

      expect(stats.totalUsers).toBe(3);
      expect(stats.activeUsers).toBe(1); // Only user-1 is active and seen within 24h
      expect(stats.totalChannels).toBe(2);
      expect(stats.totalMessages).toBe(150);
      expect(stats.totalRoles).toBe(3);
      expect(stats.serverUptime).toBeGreaterThan(0);
      expect(stats.memoryUsage).toBeDefined();
      expect(stats.databaseStats).toBeDefined();
      expect(stats.resourceUsage).toBeDefined();
    });
  });

  describe('User Management', () => {
    it('should get all users for management', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          username: 'testuser1',
          display_name: 'Test User 1',
          roles: '["member"]',
          is_active: 1,
          is_banned: 0,
          last_seen: '2024-01-01T00:00:00.000Z',
          created_at: '2024-01-01T00:00:00.000Z',
          message_count: 10,
          warning_count: 0
        },
        {
          id: 'user-2',
          username: 'testuser2',
          display_name: null,
          roles: '["admin"]',
          is_active: 1,
          is_banned: 1,
          last_seen: '2024-01-02T00:00:00.000Z',
          created_at: '2024-01-02T00:00:00.000Z',
          message_count: 5,
          warning_count: 2
        }
      ];

      mockSyncService.readData.mockReturnValue(mockUsers);

      const users = await adminService.getAllUsersForManagement();

      expect(users).toHaveLength(2);
      expect(users[0]).toEqual({
        id: 'user-1',
        username: 'testuser1',
        displayName: 'Test User 1',
        roles: ['member'],
        isActive: true,
        isBanned: false,
        lastSeen: new Date('2024-01-01T00:00:00.000Z'),
        joinedAt: new Date('2024-01-01T00:00:00.000Z'),
        messageCount: 10,
        warningCount: 0
      });
      expect(users[1]).toEqual({
        id: 'user-2',
        username: 'testuser2',
        displayName: 'testuser2', // Should fallback to username
        roles: ['admin'],
        isActive: true,
        isBanned: true,
        lastSeen: new Date('2024-01-02T00:00:00.000Z'),
        joinedAt: new Date('2024-01-02T00:00:00.000Z'),
        messageCount: 5,
        warningCount: 2
      });
    });

    it('should ban a user', async () => {
      mockSyncService.writeData.mockResolvedValue(undefined);
      mockModerationService.createModerationLog.mockResolvedValue(undefined);

      await adminService.banUser('user-1', 'Violation of rules', 'admin-1');

      expect(mockSyncService.writeData).toHaveBeenCalledWith(
        'users',
        'UPDATE',
        'user-1',
        expect.objectContaining({
          is_banned: 1,
          updated_at: expect.any(String)
        })
      );
      expect(mockModerationService.createModerationLog).toHaveBeenCalledWith({
        targetUserId: 'user-1',
        moderatorId: 'admin-1',
        action: 'ban',
        reason: 'Violation of rules',
        metadata: { autoModeration: false }
      });
    });

    it('should unban a user', async () => {
      mockSyncService.writeData.mockResolvedValue(undefined);
      mockModerationService.createModerationLog.mockResolvedValue(undefined);

      await adminService.unbanUser('user-1', 'admin-1');

      expect(mockSyncService.writeData).toHaveBeenCalledWith(
        'users',
        'UPDATE',
        'user-1',
        expect.objectContaining({
          is_banned: 0,
          updated_at: expect.any(String)
        })
      );
      expect(mockModerationService.createModerationLog).toHaveBeenCalledWith({
        targetUserId: 'user-1',
        moderatorId: 'admin-1',
        action: 'warn',
        reason: 'Admin unban',
        metadata: { autoModeration: false, actualAction: 'unban' }
      });
    });

    it('should kick a user', async () => {
      mockModerationService.createModerationLog.mockResolvedValue(undefined);

      await adminService.kickUser('user-1', 'Temporary removal', 'admin-1');

      expect(mockModerationService.createModerationLog).toHaveBeenCalledWith({
        targetUserId: 'user-1',
        moderatorId: 'admin-1',
        action: 'kick',
        reason: 'Temporary removal',
        metadata: { autoModeration: false }
      });
    });

    it('should update user roles', async () => {
      mockSyncService.writeData.mockResolvedValue(undefined);
      mockModerationService.createModerationLog.mockResolvedValue(undefined);

      const newRoles = ['admin', 'moderator'];
      await adminService.updateUserRoles('user-1', newRoles, 'admin-1');

      expect(mockSyncService.writeData).toHaveBeenCalledWith(
        'users',
        'UPDATE',
        'user-1',
        expect.objectContaining({
          roles: JSON.stringify(newRoles),
          updated_at: expect.any(String)
        })
      );
      expect(mockModerationService.createModerationLog).toHaveBeenCalledWith({
        targetUserId: 'user-1',
        moderatorId: 'admin-1',
        action: 'warn',
        reason: 'Roles updated to: admin, moderator',
        metadata: { autoModeration: false, actualAction: 'role_update' }
      });
    });
  });

  describe('Dashboard Overview', () => {
    it('should get dashboard overview', async () => {
      // Mock system stats
      const mockUsers = [{ id: 'user-1', last_seen: new Date().toISOString(), is_active: 1 }];
      const mockChannels = [{ id: 'channel-1' }];
      const mockMessages = [{ count: 50 }];
      const mockRoles = [{ id: 'role-1' }];

      // Mock recent users
      const mockRecentUsers = [
        {
          id: 'user-1',
          username: 'newuser',
          display_name: 'New User',
          created_at: '2024-01-01T00:00:00.000Z',
          is_active: 1
        }
      ];

      // Mock recent moderation logs
      const mockRecentLogs = [
        {
          id: 'log-1',
          user_id: 'user-1',
          admin_id: 'admin-1',
          action: 'warn',
          reason: 'Spam',
          timestamp: '2024-01-01T00:00:00.000Z'
        }
      ];

      mockSyncService.readData
        .mockReturnValueOnce(mockUsers) // for stats - users
        .mockReturnValueOnce(mockChannels) // for stats - channels
        .mockReturnValueOnce(mockMessages) // for stats - messages
        .mockReturnValueOnce(mockRoles) // for stats - roles
        .mockReturnValueOnce(mockRecentUsers) // recent users
        .mockReturnValueOnce(mockRecentLogs); // recent logs

      const overview = await adminService.getDashboardOverview();

      expect(overview.stats).toBeDefined();
      expect(overview.recentUsers).toHaveLength(1);
      expect(overview.recentUsers[0]).toEqual({
        id: 'user-1',
        username: 'newuser',
        displayName: 'New User',
        joinedAt: new Date('2024-01-01T00:00:00.000Z'),
        isActive: true
      });
      expect(overview.recentModerationLogs).toHaveLength(1);
      expect(overview.recentModerationLogs[0]).toEqual({
        id: 'log-1',
        userId: 'user-1',
        adminId: 'admin-1',
        action: 'warn',
        reason: 'Spam',
        timestamp: new Date('2024-01-01T00:00:00.000Z')
      });
    });
  });

  describe('Resource Alerts', () => {
    it('should generate resource alerts', async () => {
      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage;
      (process.memoryUsage as any) = jest.fn().mockReturnValue({
        heapUsed: 400 * 1024 * 1024, // 400MB (78% of 512MB)
        heapTotal: 450 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        rss: 500 * 1024 * 1024
      });

      // Mock other data for stats
      mockSyncService.readData
        .mockReturnValueOnce([]) // users
        .mockReturnValueOnce([]) // channels
        .mockReturnValueOnce([{ count: 0 }]) // messages
        .mockReturnValueOnce([]); // roles

      const alerts = await adminService.getResourceAlerts();

      expect(alerts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'memory',
            severity: 'medium',
            message: expect.stringContaining('Memory usage is at')
          })
        ])
      );

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });

    it('should generate high severity alerts for critical usage', async () => {
      // Mock very high memory usage
      const originalMemoryUsage = process.memoryUsage;
      (process.memoryUsage as any) = jest.fn().mockReturnValue({
        heapUsed: 480 * 1024 * 1024, // 480MB (93.75% of 512MB)
        heapTotal: 500 * 1024 * 1024,
        external: 10 * 1024 * 1024,
        rss: 510 * 1024 * 1024
      });

      // Mock other data for stats
      mockSyncService.readData
        .mockReturnValueOnce([]) // users
        .mockReturnValueOnce([]) // channels
        .mockReturnValueOnce([{ count: 0 }]) // messages
        .mockReturnValueOnce([]); // roles

      const alerts = await adminService.getResourceAlerts();

      expect(alerts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'memory',
            severity: 'high',
            message: expect.stringContaining('Memory usage is at')
          })
        ])
      );

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });
  });
});