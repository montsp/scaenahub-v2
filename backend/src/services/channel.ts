import { Channel, ChannelType, ChannelPermissions } from '../types';
import { ChannelModel } from '../models/Channel';
import { RoleService } from './role';
import { UserService } from './user';
import { DataSyncService } from './database/sync';
import { v4 as uuidv4 } from 'uuid';

export interface ChannelWithPermissions extends Channel {
  userPermissions: {
    canView: boolean;
    canSend: boolean;
    canManage: boolean;
  };
}

export interface ChannelSearchOptions {
  query?: string;
  type?: ChannelType;
  categoryId?: string;
  isPrivate?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'createdAt' | 'position';
  sortOrder?: 'asc' | 'desc';
}

export interface CategoryWithChannels {
  id: string;
  name: string;
  position: number;
  channels: Channel[];
}

export class ChannelService {
  private static instance: ChannelService;
  private syncService: DataSyncService;
  private roleService: RoleService;
  private userService: UserService;
  private channelCache: Map<string, Channel> = new Map();
  private categoryCache: Map<string, CategoryWithChannels> = new Map();
  private lastCacheUpdate: Date = new Date(0);

  private constructor() {
    this.syncService = DataSyncService.getInstance();
    this.roleService = RoleService.getInstance();
    this.userService = UserService.getInstance();
  }

  public static getInstance(): ChannelService {
    if (!ChannelService.instance) {
      ChannelService.instance = new ChannelService();
    }
    return ChannelService.instance;
  }

  public async initializeDefaultChannels(): Promise<void> {
    try {
      // 既存のチャンネルをチェック
      const existingChannels = await this.getAllChannels();
      
      if (existingChannels.length === 0) {
        console.log('🔧 Initializing default channels...');
        
        // デフォルトカテゴリを作成または取得
        let generalCategory = await this.getCategoryByName('General');
        if (!generalCategory) {
          generalCategory = await this.createCategory({
            name: 'General',
            position: 0
          });
        }

        // デフォルトチャンネルを作成
        const defaultChannels = [
          {
            name: 'general',
            description: 'General discussion channel',
            type: 'text' as ChannelType,
            categoryId: generalCategory.id,
            position: 0
          },
          {
            name: 'announcements',
            description: 'Important announcements',
            type: 'announcement' as ChannelType,
            categoryId: generalCategory.id,
            position: 1
          }
        ];

        for (const channelData of defaultChannels) {
          // チャンネルが既に存在するかチェック
          const existingChannel = await this.getChannelByName(channelData.name);
          if (!existingChannel) {
            await this.createChannel(channelData);
          }
        }
        
        console.log('✅ Default channels initialized successfully');
      } else {
        console.log('📺 Default channels already exist, skipping initialization');
      }
    } catch (error) {
      console.error('❌ Failed to initialize default channels:', error);
    }
  }

  public async createChannel(channelData: {
    name: string;
    description?: string;
    type: ChannelType;
    categoryId?: string;
    position?: number;
    isPrivate?: boolean;
    permissions?: Partial<ChannelPermissions>;
    allowedRoles?: string[];
    allowedUsers?: string[];
  }): Promise<Channel> {
    // チャンネル名の重複チェック
    const existingChannel = await this.getChannelByName(channelData.name);
    if (existingChannel) {
      throw new Error(`Channel '${channelData.name}' already exists`);
    }

    // カテゴリの存在確認
    if (channelData.categoryId) {
      const category = await this.getCategoryById(channelData.categoryId);
      if (!category) {
        throw new Error('Category not found');
      }
    }

    // チャンネル作成
    const channel = ChannelModel.create(channelData);

    // データベースに保存
    await this.syncService.writeData('channels', 'INSERT', channel.id, {
      id: channel.id,
      name: channel.name,
      description: channel.description || null,
      type: channel.type,
      category_id: channel.categoryId || null,
      position: channel.position,
      is_private: channel.isPrivate,
      permissions: JSON.stringify(channel.permissions || {}),
      allowed_roles: JSON.stringify(channel.allowedRoles || []),
      allowed_users: JSON.stringify(channel.allowedUsers || []),
      settings: JSON.stringify(channel.settings || {}),
      created_at: channel.createdAt.toISOString(),
      updated_at: channel.updatedAt.toISOString()
    });

    // キャッシュを更新
    this.channelCache.set(channel.id, channel);
    this.lastCacheUpdate = new Date();

    return channel;
  }

  public async updateChannel(channelId: string, updates: {
    name?: string;
    description?: string;
    type?: ChannelType;
    categoryId?: string;
    position?: number;
    isPrivate?: boolean;
    permissions?: Partial<ChannelPermissions>;
    allowedRoles?: string[];
    allowedUsers?: string[];
  }): Promise<Channel> {
    const channel = await this.getChannelById(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    // 名前の重複チェック
    if (updates.name && updates.name !== channel.name) {
      const existingChannel = await this.getChannelByName(updates.name);
      if (existingChannel) {
        throw new Error(`Channel '${updates.name}' already exists`);
      }
    }

    // カテゴリの存在確認
    if (updates.categoryId && updates.categoryId !== channel.categoryId) {
      const category = await this.getCategoryById(updates.categoryId);
      if (!category) {
        throw new Error('Category not found');
      }
    }

    // チャンネル更新
    const updatedChannel: Channel = {
      ...channel,
      name: updates.name || channel.name,
      ...(updates.description !== undefined && { description: updates.description }),
      type: updates.type || channel.type,
      ...(updates.categoryId !== undefined && { categoryId: updates.categoryId }),
      position: updates.position !== undefined ? updates.position : channel.position,
      isPrivate: updates.isPrivate !== undefined ? updates.isPrivate : channel.isPrivate,
      permissions: updates.permissions ? { ...channel.permissions, ...updates.permissions } : channel.permissions,
      allowedRoles: updates.allowedRoles || channel.allowedRoles,
      allowedUsers: updates.allowedUsers || channel.allowedUsers,
      updatedAt: new Date()
    };

    // バリデーション
    const validation = ChannelModel.validate(updatedChannel);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // データベース更新
    await this.syncService.writeData('channels', 'UPDATE', channelId, {
      name: updatedChannel.name,
      description: updatedChannel.description,
      type: updatedChannel.type,
      category_id: updatedChannel.categoryId,
      position: updatedChannel.position,
      is_private: updatedChannel.isPrivate,
      permissions: updatedChannel.permissions,
      allowed_roles: updatedChannel.allowedRoles,
      allowed_users: updatedChannel.allowedUsers,
      settings: updatedChannel.settings || {},
      updated_at: updatedChannel.updatedAt.toISOString()
    });

    // キャッシュ更新
    this.channelCache.set(channelId, updatedChannel);
    this.lastCacheUpdate = new Date();

    return updatedChannel;
  }

  public async deleteChannel(channelId: string): Promise<void> {
    const channel = await this.getChannelById(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    // メッセージ数をチェック
    const messageCount = this.syncService.readData<{ count: number }>('messages', 
      'SELECT COUNT(*) as count FROM messages_cache WHERE channel_id = ?', 
      [channelId]
    )[0]?.count || 0;

    if (messageCount > 0) {
      throw new Error(`Cannot delete channel '${channel.name}' - ${messageCount} messages exist`);
    }

    // データベースから削除
    await this.syncService.writeData('channels', 'DELETE', channelId, {});

    // キャッシュから削除
    this.channelCache.delete(channelId);
    this.lastCacheUpdate = new Date();
  }

  public async getChannelById(channelId: string): Promise<Channel | null> {
    // キャッシュから取得を試行
    if (this.channelCache.has(channelId)) {
      return this.channelCache.get(channelId)!;
    }

    // データベースから取得
    const channelsData = this.syncService.readData<any>('channels', 
      'SELECT * FROM channels_cache WHERE id = ?', 
      [channelId]
    );

    if (channelsData.length === 0) {
      return null;
    }

    const channelData = channelsData[0];
    const channel = this.convertToChannel(channelData);
    
    // キャッシュに保存
    this.channelCache.set(channelId, channel);
    
    return channel;
  }

  public async getChannelByName(name: string): Promise<Channel | null> {
    // キャッシュから検索
    for (const channel of this.channelCache.values()) {
      if (channel.name === name) {
        return channel;
      }
    }

    // データベースから取得
    const channelsData = this.syncService.readData<any>('channels', 
      'SELECT * FROM channels_cache WHERE name = ?', 
      [name]
    );

    if (channelsData.length === 0) {
      return null;
    }

    const channelData = channelsData[0];
    const channel = this.convertToChannel(channelData);
    
    // キャッシュに保存
    this.channelCache.set(channel.id, channel);
    
    return channel;
  }

  public async getAllChannels(): Promise<Channel[]> {
    // キャッシュの有効性をチェック（5分間有効）
    const cacheAge = Date.now() - this.lastCacheUpdate.getTime();
    if (cacheAge < 5 * 60 * 1000 && this.channelCache.size > 0) {
      return Array.from(this.channelCache.values()).sort((a, b) => a.position - b.position);
    }

    // データベースから全チャンネルを取得
    const channelsData = this.syncService.readData<any>('channels', 
      'SELECT * FROM channels_cache ORDER BY position ASC, name ASC'
    );

    const channels = channelsData.map(channelData => this.convertToChannel(channelData));
    
    // キャッシュを更新
    this.channelCache.clear();
    channels.forEach(channel => this.channelCache.set(channel.id, channel));
    this.lastCacheUpdate = new Date();

    return channels;
  }

  public async getChannelsWithPermissions(userRoles: string[], userId: string): Promise<ChannelWithPermissions[]> {
    const allChannels = await this.getAllChannels();
    const channelsWithPermissions: ChannelWithPermissions[] = [];

    for (const channel of allChannels) {
      const permissions = await this.checkChannelPermissions(channel, userRoles, userId);
      
      // プライベートチャンネルで閲覧権限がない場合はスキップ
      if (channel.isPrivate && !permissions.canView) {
        continue;
      }

      channelsWithPermissions.push({
        ...channel,
        userPermissions: permissions
      });
    }

    return channelsWithPermissions;
  }

  public async checkChannelPermissions(channel: Channel, userRoles: string[], userId: string): Promise<{
    canView: boolean;
    canSend: boolean;
    canManage: boolean;
  }> {
    // 管理者権限チェック
    const hasManageServer = await this.roleService.hasPermission(userRoles, 'manageServer');
    const hasManageChannels = await this.roleService.hasPermission(userRoles, 'manageChannels');
    
    if (hasManageServer || hasManageChannels) {
      return {
        canView: true,
        canSend: true,
        canManage: true
      };
    }

    // プライベートチャンネルの場合
    if (channel.isPrivate) {
      const hasRoleAccess = channel.allowedRoles.some(role => userRoles.includes(role));
      const hasUserAccess = channel.allowedUsers.includes(userId);
      
      if (!hasRoleAccess && !hasUserAccess) {
        return {
          canView: false,
          canSend: false,
          canManage: false
        };
      }
    }

    // 基本権限チェック
    const canViewChannels = await this.roleService.hasPermission(userRoles, 'viewChannels');
    const canSendMessages = await this.roleService.hasPermission(userRoles, 'sendMessages');

    // チャンネル固有の権限チェック
    let canView = canViewChannels;
    let canSend = canSendMessages;

    // アナウンスチャンネルの場合、送信権限を制限
    if (channel.type === 'announcement') {
      const canManageMessages = await this.roleService.hasPermission(userRoles, 'manageMessages');
      canSend = canSend && canManageMessages;
    }

    return {
      canView,
      canSend,
      canManage: false
    };
  }

  public async searchChannels(options: ChannelSearchOptions = {}): Promise<{
    channels: Channel[];
    total: number;
    hasMore: boolean;
  }> {
    const {
      query = '',
      type,
      categoryId,
      isPrivate,
      limit = 50,
      offset = 0,
      sortBy = 'position',
      sortOrder = 'asc'
    } = options;

    let sql = 'SELECT * FROM channels_cache WHERE 1=1';
    const params: any[] = [];

    // 検索クエリ
    if (query) {
      sql += ' AND (name LIKE ? OR description LIKE ?)';
      const searchTerm = `%${query}%`;
      params.push(searchTerm, searchTerm);
    }

    // タイプフィルター
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    // カテゴリフィルター
    if (categoryId) {
      sql += ' AND category_id = ?';
      params.push(categoryId);
    }

    // プライベートフィルター
    if (isPrivate !== undefined) {
      sql += ' AND is_private = ?';
      params.push(isPrivate ? 1 : 0);
    }

    // 総数取得用のクエリ
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
    const totalResult = this.syncService.readData<{ count: number }>('channels', countSql, params);
    const total = totalResult[0]?.count || 0;

    // ソート
    const sortColumn = {
      name: 'name',
      createdAt: 'created_at',
      position: 'position'
    }[sortBy] || 'position';

    sql += ` ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}`;

    // ページネーション
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const channelsData = this.syncService.readData<any>('channels', sql, params);
    const channels = channelsData.map(channelData => this.convertToChannel(channelData));

    return {
      channels,
      total,
      hasMore: offset + channels.length < total
    };
  }

  // カテゴリ管理機能
  public async createCategory(categoryData: {
    name: string;
    position?: number;
  }): Promise<CategoryWithChannels> {
    // カテゴリ名の重複チェック
    const existingCategory = await this.getCategoryByName(categoryData.name);
    if (existingCategory) {
      throw new Error(`Category '${categoryData.name}' already exists`);
    }

    const categoryId = uuidv4();
    const category = {
      id: categoryId,
      name: categoryData.name,
      position: categoryData.position || 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // データベースに保存
    await this.syncService.writeData('categories', 'INSERT', categoryId, {
      id: category.id,
      name: category.name,
      position: category.position,
      created_at: category.createdAt.toISOString(),
      updated_at: category.updatedAt.toISOString()
    });

    const result: CategoryWithChannels = {
      ...category,
      channels: []
    };

    // キャッシュを更新
    this.categoryCache.set(categoryId, result);

    return result;
  }

  public async updateCategory(categoryId: string, updates: {
    name?: string;
    position?: number;
  }): Promise<CategoryWithChannels> {
    const category = await this.getCategoryById(categoryId);
    if (!category) {
      throw new Error('Category not found');
    }

    // 名前の重複チェック
    if (updates.name && updates.name !== category.name) {
      const existingCategory = await this.getCategoryByName(updates.name);
      if (existingCategory) {
        throw new Error(`Category '${updates.name}' already exists`);
      }
    }

    const updatedCategory = {
      ...category,
      name: updates.name || category.name,
      position: updates.position !== undefined ? updates.position : category.position,
      updatedAt: new Date()
    };

    // データベース更新
    await this.syncService.writeData('categories', 'UPDATE', categoryId, {
      name: updatedCategory.name,
      position: updatedCategory.position,
      updated_at: updatedCategory.updatedAt.toISOString()
    });

    // キャッシュ更新
    this.categoryCache.set(categoryId, updatedCategory);

    return updatedCategory;
  }

  public async deleteCategory(categoryId: string): Promise<void> {
    const category = await this.getCategoryById(categoryId);
    if (!category) {
      throw new Error('Category not found');
    }

    // カテゴリ内のチャンネル数をチェック
    const channelCount = this.syncService.readData<{ count: number }>('channels', 
      'SELECT COUNT(*) as count FROM channels_cache WHERE category_id = ?', 
      [categoryId]
    )[0]?.count || 0;

    if (channelCount > 0) {
      throw new Error(`Cannot delete category '${category.name}' - ${channelCount} channels exist`);
    }

    // データベースから削除
    await this.syncService.writeData('categories', 'DELETE', categoryId, {});

    // キャッシュから削除
    this.categoryCache.delete(categoryId);
  }

  public async getCategoryById(categoryId: string): Promise<CategoryWithChannels | null> {
    // キャッシュから取得を試行
    if (this.categoryCache.has(categoryId)) {
      return this.categoryCache.get(categoryId)!;
    }

    // データベースから取得
    const categoriesData = this.syncService.readData<any>('categories', 
      'SELECT * FROM categories_cache WHERE id = ?', 
      [categoryId]
    );

    if (categoriesData.length === 0) {
      return null;
    }

    const categoryData = categoriesData[0];
    
    // カテゴリ内のチャンネルを取得
    const channelsData = this.syncService.readData<any>('channels', 
      'SELECT * FROM channels_cache WHERE category_id = ? ORDER BY position ASC', 
      [categoryId]
    );

    const channels = channelsData.map(channelData => this.convertToChannel(channelData));

    const category: CategoryWithChannels = {
      id: categoryData.id,
      name: categoryData.name,
      position: categoryData.position,
      channels
    };
    
    // キャッシュに保存
    this.categoryCache.set(categoryId, category);
    
    return category;
  }

  public async getCategoryByName(name: string): Promise<CategoryWithChannels | null> {
    // キャッシュから検索
    for (const category of this.categoryCache.values()) {
      if (category.name === name) {
        return category;
      }
    }

    // データベースから取得
    const categoriesData = this.syncService.readData<any>('categories', 
      'SELECT * FROM categories_cache WHERE name = ?', 
      [name]
    );

    if (categoriesData.length === 0) {
      return null;
    }

    const categoryData = categoriesData[0];
    return await this.getCategoryById(categoryData.id);
  }

  public async getAllCategories(): Promise<CategoryWithChannels[]> {
    // データベースから全カテゴリを取得
    const categoriesData = this.syncService.readData<any>('categories', 
      'SELECT * FROM categories_cache ORDER BY position ASC, name ASC'
    );

    const categories: CategoryWithChannels[] = [];
    
    for (const categoryData of categoriesData) {
      const category = await this.getCategoryById(categoryData.id);
      if (category) {
        categories.push(category);
      }
    }

    return categories;
  }

  public async getChannelStatistics(): Promise<{
    totalChannels: number;
    channelsByType: Array<{
      type: ChannelType;
      count: number;
    }>;
    privateChannels: number;
    publicChannels: number;
    totalCategories: number;
  }> {
    const allChannels = await this.getAllChannels();
    const allCategories = await this.getAllCategories();

    const channelsByType = [
      { type: 'text' as ChannelType, count: 0 },
      { type: 'announcement' as ChannelType, count: 0 },
      { type: 'discussion' as ChannelType, count: 0 }
    ];

    let privateChannels = 0;
    let publicChannels = 0;

    for (const channel of allChannels) {
      const typeEntry = channelsByType.find(entry => entry.type === channel.type);
      if (typeEntry) {
        typeEntry.count++;
      }

      if (channel.isPrivate) {
        privateChannels++;
      } else {
        publicChannels++;
      }
    }

    return {
      totalChannels: allChannels.length,
      channelsByType,
      privateChannels,
      publicChannels,
      totalCategories: allCategories.length
    };
  }

  private convertToChannel(channelData: any): Channel {
    return {
      id: channelData.id,
      name: channelData.name,
      description: channelData.description,
      type: channelData.type,
      categoryId: channelData.category_id,
      position: channelData.position,
      isPrivate: channelData.is_private,
      permissions: JSON.parse(channelData.permissions || '{}'),
      allowedRoles: JSON.parse(channelData.allowed_roles || '[]'),
      allowedUsers: JSON.parse(channelData.allowed_users || '[]'),
      createdAt: new Date(channelData.created_at),
      updatedAt: new Date(channelData.updated_at)
    };
  }

  public clearCache(): void {
    this.channelCache.clear();
    this.categoryCache.clear();
    this.lastCacheUpdate = new Date(0);
  }

  // メッセージ関連の権限チェックメソッド
  public async canUserWriteToChannel(channelId: string, userId: string, userRoles: string[]): Promise<boolean> {
    const channel = await this.getChannelById(channelId);
    if (!channel) return false;

    // プライベートチャンネルの場合、メンバーかどうかチェック
    if (channel.isPrivate) {
      const isMember = await this.isChannelMember(channelId, userId);
      if (!isMember) return false;
    }

    // チャンネル権限チェック
    const permissions = await this.getChannelPermissions(channelId, userId, userRoles);
    return permissions.canSend;
  }

  public async canUserReadChannel(channelId: string, userId: string, userRoles: string[]): Promise<boolean> {
    const channel = await this.getChannelById(channelId);
    if (!channel) return false;

    // プライベートチャンネルの場合、メンバーかどうかチェック
    if (channel.isPrivate) {
      const isMember = await this.isChannelMember(channelId, userId);
      if (!isMember) return false;
    }

    // チャンネル権限チェック
    const permissions = await this.getChannelPermissions(channelId, userId, userRoles);
    return permissions.canView;
  }

  private async getChannelPermissions(channelId: string, userId: string, userRoles: string[]): Promise<{
    canView: boolean;
    canSend: boolean;
    canManage: boolean;
  }> {
    const channel = await this.getChannelById(channelId);
    if (!channel) {
      return { canView: false, canSend: false, canManage: false };
    }

    // 管理者は全権限
    const isAdmin = await this.roleService.hasPermission(userRoles, 'manageChannels');
    if (isAdmin) {
      return { canView: true, canSend: true, canManage: true };
    }

    // 基本権限チェック
    const canView = await this.roleService.hasPermission(userRoles, 'viewChannels');
    const canSend = await this.roleService.hasPermission(userRoles, 'sendMessages');

    return {
      canView,
      canSend,
      canManage: false
    };
  }



  private async isChannelMember(channelId: string, userId: string): Promise<boolean> {
    const membersData = this.syncService.readData<any>(
      'channel_members',
      'SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?',
      [channelId, userId]
    );

    return membersData.length > 0;
  }

  // ユーザーが読み取り可能なチャンネル一覧を取得
  public async getUserReadableChannels(userId: string, userRoles: string[]): Promise<Channel[]> {
    const allChannels = await this.getAllChannels();
    const readableChannels: Channel[] = [];

    for (const channel of allChannels) {
      const canRead = await this.canUserReadChannel(channel.id, userId, userRoles);
      if (canRead) {
        readableChannels.push(channel);
      }
    }

    return readableChannels;
  }
}