import { DataSyncService } from './database/sync';
import { UserService } from './user';
import { RoleService } from './role';
import { ChannelService } from './channel';
import { ModerationService } from './moderation';
import { PerformanceMonitor } from '../utils/performanceMonitor';

export interface ServerSettings {
  serverName: string;
  description: string;
  iconUrl?: string;
  defaultRole: string;
  welcomeChannelId?: string;
  rulesChannelId?: string;
  maxMembers: number;
  inviteEnabled: boolean;
  publicServer: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  totalChannels: number;
  totalMessages: number;
  totalRoles: number;
  serverUptime: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  databaseStats: {
    localDbSize: number;
    tidbConnections: number;
    queryCount: number;
  };
  resourceUsage: {
    tidbRequestUnits: number;
    googleDriveStorage: number;
    renderMemoryUsage: number;
  };
}

export interface UserManagementData {
  id: string;
  username: string;
  displayName: string;
  roles: string[];
  isActive: boolean;
  isBanned: boolean;
  lastSeen: Date;
  joinedAt: Date;
  messageCount: number;
  warningCount: number;
}

export class AdminService {
  private static instance: AdminService;
  private syncService: DataSyncService;
  private userService: UserService;
  private roleService: RoleService;
  private channelService: ChannelService;
  private moderationService: ModerationService;

  private constructor() {
    this.syncService = DataSyncService.getInstance();
    this.userService = UserService.getInstance();
    this.roleService = RoleService.getInstance();
    this.channelService = ChannelService.getInstance();
    this.moderationService = ModerationService.getInstance();
  }

  public static getInstance(): AdminService {
    if (!AdminService.instance) {
      AdminService.instance = new AdminService();
    }
    return AdminService.instance;
  }

  // Server Settings Management
  public async getServerSettings(): Promise<ServerSettings> {
    const settings = this.syncService.readData<any>('server_settings', 
      'SELECT id, server_name, description, icon_url, default_role, welcome_channel_id, rules_channel_id, max_members, invite_enabled, public_server, created_at, updated_at FROM server_settings_cache LIMIT 1'
    );

    if (settings.length === 0) {
      // Return default settings if none exist
      const defaultSettings: ServerSettings = {
        serverName: 'ScaenaHub v2',
        description: 'Theater project communication platform',
        defaultRole: 'member',
        maxMembers: 100,
        inviteEnabled: true,
        publicServer: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Insert default settings directly without calling updateServerSettings
      await this.syncService.writeData('server_settings', 'INSERT', '1', {
        server_name: defaultSettings.serverName,
        description: defaultSettings.description,
        icon_url: null,
        default_role: defaultSettings.defaultRole,
        welcome_channel_id: null,
        rules_channel_id: null,
        max_members: defaultSettings.maxMembers,
        invite_enabled: defaultSettings.inviteEnabled ? 1 : 0,
        public_server: defaultSettings.publicServer ? 1 : 0,
        created_at: defaultSettings.createdAt.toISOString(),
        updated_at: defaultSettings.updatedAt.toISOString()
      });
      
      return defaultSettings;
    }

    return {
      serverName: settings[0].server_name,
      description: settings[0].description,
      iconUrl: settings[0].icon_url,
      defaultRole: settings[0].default_role,
      welcomeChannelId: settings[0].welcome_channel_id,
      rulesChannelId: settings[0].rules_channel_id,
      maxMembers: settings[0].max_members,
      inviteEnabled: settings[0].invite_enabled === 1,
      publicServer: settings[0].public_server === 1,
      createdAt: new Date(settings[0].created_at),
      updatedAt: new Date(settings[0].updated_at)
    };
  }

  public async updateServerSettings(settings: Partial<ServerSettings>): Promise<ServerSettings> {
    const currentSettings = await this.getServerSettings();
    const updatedSettings = {
      ...currentSettings,
      ...settings,
      updatedAt: new Date()
    };

    // Update in database
    await this.syncService.writeData('server_settings', 'UPDATE', '1', {
      server_name: updatedSettings.serverName,
      description: updatedSettings.description,
      icon_url: updatedSettings.iconUrl || null,
      default_role: updatedSettings.defaultRole,
      welcome_channel_id: updatedSettings.welcomeChannelId || null,
      rules_channel_id: updatedSettings.rulesChannelId || null,
      max_members: updatedSettings.maxMembers,
      invite_enabled: updatedSettings.inviteEnabled ? 1 : 0,
      public_server: updatedSettings.publicServer ? 1 : 0,
      created_at: updatedSettings.createdAt.toISOString(),
      updated_at: updatedSettings.updatedAt.toISOString()
    });

    return updatedSettings;
  }

  // System Statistics
  public async getSystemStats(): Promise<SystemStats> {
    const users = this.syncService.readData<any>('users', 'SELECT id, username, password_hash, roles, display_name, avatar, bio, online_status, custom_status, is_active, is_banned, last_seen, created_at, updated_at FROM users_cache');
    const channels = this.syncService.readData<any>('channels', 'SELECT id, name, description, type, category_id, position, is_private, permissions, allowed_roles, allowed_users, settings, created_by, created_at, updated_at FROM channels_cache');
    const messages = this.syncService.readData<any>('messages', 'SELECT COUNT(*) as count FROM messages_cache');
    const roles = this.syncService.readData<any>('roles', 'SELECT id, name, color, position, permissions, is_default, mentionable, created_at, updated_at FROM roles_cache');

    // Calculate active users (last seen within 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeUsers = users.filter(user => 
      new Date(user.last_seen) > oneDayAgo && user.is_active
    );

    // Get memory usage
    const memoryUsage = process.memoryUsage();
    const totalMemory = 512 * 1024 * 1024; // 512MB Render.com limit

    // Get performance metrics
    const performanceMonitor = PerformanceMonitor.getInstance();
    const performanceMetrics = performanceMonitor.getAllStats();

    return {
      totalUsers: users.length,
      activeUsers: activeUsers.length,
      totalChannels: channels.length,
      totalMessages: messages[0]?.count || 0,
      totalRoles: roles.length,
      serverUptime: process.uptime(),
      memoryUsage: {
        used: memoryUsage.heapUsed,
        total: totalMemory,
        percentage: (memoryUsage.heapUsed / totalMemory) * 100
      },
      databaseStats: {
        localDbSize: this.getLocalDbSize(),
        tidbConnections: 1, // Simplified for now
        queryCount: performanceMetrics.database_queries?.count || 0
      },
      resourceUsage: {
        tidbRequestUnits: performanceMetrics.tidb_requests?.count || 0,
        googleDriveStorage: performanceMetrics.google_drive_usage?.count || 0,
        renderMemoryUsage: memoryUsage.heapUsed
      }
    };
  }

  private getLocalDbSize(): number {
    try {
      const fs = require('fs');
      const path = require('path');
      const dbPath = path.join(process.cwd(), 'data', 'local.db');
      if (fs.existsSync(dbPath)) {
        return fs.statSync(dbPath).size;
      }
    } catch (error) {
      console.error('Error getting local DB size:', error);
    }
    return 0;
  }

  // User Management
  public async getAllUsersForManagement(): Promise<UserManagementData[]> {
    const users = this.syncService.readData<any>('users', `
      SELECT u.*, 
             COUNT(m.id) as message_count,
             COUNT(w.id) as warning_count
      FROM users_cache u
      LEFT JOIN messages_cache m ON u.id = m.author_id
      LEFT JOIN moderation_logs_cache w ON u.id = w.user_id AND w.action = 'warning'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);

    return users.map(user => ({
      id: user.id,
      username: user.username,
      displayName: user.display_name || user.username,
      roles: JSON.parse(user.roles || '[]'),
      isActive: user.is_active === 1,
      isBanned: user.is_banned === 1,
      lastSeen: new Date(user.last_seen),
      joinedAt: new Date(user.created_at),
      messageCount: user.message_count || 0,
      warningCount: user.warning_count || 0
    }));
  }

  public async banUser(userId: string, reason: string, adminId: string): Promise<void> {
    // Update user status
    await this.syncService.writeData('users', 'UPDATE', userId, {
      is_banned: 1,
      updated_at: new Date().toISOString()
    });

    // Log the action
    await (this.moderationService as any).createModerationLog({
      targetUserId: userId,
      moderatorId: adminId,
      action: 'ban',
      reason,
      metadata: { autoModeration: false }
    });
  }

  public async unbanUser(userId: string, adminId: string): Promise<void> {
    // Update user status
    await this.syncService.writeData('users', 'UPDATE', userId, {
      is_banned: 0,
      updated_at: new Date().toISOString()
    });

    // Log the action (unban is not in the enum, so we'll use a different approach)
    await (this.moderationService as any).createModerationLog({
      targetUserId: userId,
      moderatorId: adminId,
      action: 'warn', // Using warn as placeholder since unban is not in the enum
      reason: 'Admin unban',
      metadata: { autoModeration: false, actualAction: 'unban' }
    });
  }

  public async kickUser(userId: string, reason: string, adminId: string): Promise<void> {
    // For kick, we just log the action (in a real system, this might disconnect the user)
    await (this.moderationService as any).createModerationLog({
      targetUserId: userId,
      moderatorId: adminId,
      action: 'kick',
      reason,
      metadata: { autoModeration: false }
    });
  }

  public async updateUserRoles(userId: string, roleIds: string[], adminId: string): Promise<void> {
    // Update user roles
    await this.syncService.writeData('users', 'UPDATE', userId, {
      roles: JSON.stringify(roleIds),
      updated_at: new Date().toISOString()
    });

    // Log the action
    await (this.moderationService as any).createModerationLog({
      targetUserId: userId,
      moderatorId: adminId,
      action: 'warn', // Using warn as placeholder since role_update is not in the enum
      reason: `Roles updated to: ${roleIds.join(', ')}`,
      metadata: { autoModeration: false, actualAction: 'role_update' }
    });
  }

  // Dashboard Overview
  public async getDashboardOverview() {
    const stats = await this.getSystemStats();
    const recentUsers = this.syncService.readData<any>('users', 
      'SELECT id, username, password_hash, roles, display_name, avatar, bio, online_status, custom_status, is_active, is_banned, last_seen, created_at, updated_at FROM users_cache ORDER BY created_at DESC LIMIT 5'
    );
    const recentModerationLogs = this.syncService.readData<any>('moderation_logs', 
      'SELECT id, action, target_user_id, moderator_id, reason, rule_id, message_id, channel_id, metadata, created_at FROM moderation_logs_cache ORDER BY created_at DESC LIMIT 10'
    );

    return {
      stats,
      recentUsers: recentUsers.map(user => ({
        id: user.id,
        username: user.username,
        displayName: user.display_name || user.username,
        joinedAt: new Date(user.created_at),
        isActive: user.is_active === 1
      })),
      recentModerationLogs: recentModerationLogs.map(log => ({
        id: log.id,
        userId: log.user_id,
        adminId: log.admin_id,
        action: log.action,
        reason: log.reason,
        timestamp: new Date(log.timestamp)
      }))
    };
  }

  // Resource Monitoring
  public async getResourceAlerts(): Promise<Array<{type: string, message: string, severity: 'low' | 'medium' | 'high'}>> {
    const alerts = [];
    const stats = await this.getSystemStats();

    // Memory usage alerts
    if (stats.memoryUsage.percentage > 90) {
      alerts.push({
        type: 'memory',
        message: `Memory usage is at ${stats.memoryUsage.percentage.toFixed(1)}%`,
        severity: 'high' as const
      });
    } else if (stats.memoryUsage.percentage > 75) {
      alerts.push({
        type: 'memory',
        message: `Memory usage is at ${stats.memoryUsage.percentage.toFixed(1)}%`,
        severity: 'medium' as const
      });
    }

    // TiDB Request Units (assuming 50M monthly limit)
    const tidbUsagePercent = (stats.resourceUsage.tidbRequestUnits / 50000000) * 100;
    if (tidbUsagePercent > 90) {
      alerts.push({
        type: 'tidb',
        message: `TiDB Request Units at ${tidbUsagePercent.toFixed(1)}% of monthly limit`,
        severity: 'high' as const
      });
    } else if (tidbUsagePercent > 75) {
      alerts.push({
        type: 'tidb',
        message: `TiDB Request Units at ${tidbUsagePercent.toFixed(1)}% of monthly limit`,
        severity: 'medium' as const
      });
    }

    // Google Drive storage (assuming 15GB limit)
    const driveUsagePercent = (stats.resourceUsage.googleDriveStorage / (15 * 1024 * 1024 * 1024)) * 100;
    if (driveUsagePercent > 90) {
      alerts.push({
        type: 'storage',
        message: `Google Drive storage at ${driveUsagePercent.toFixed(1)}% of limit`,
        severity: 'high' as const
      });
    } else if (driveUsagePercent > 75) {
      alerts.push({
        type: 'storage',
        message: `Google Drive storage at ${driveUsagePercent.toFixed(1)}% of limit`,
        severity: 'medium' as const
      });
    }

    return alerts;
  }
}