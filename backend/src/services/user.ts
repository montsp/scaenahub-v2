import { User } from '../types';
import { UserModel } from '../models/User';
import { RoleService } from './role';
import { DataSyncService } from './database/sync';
import { v4 as uuidv4 } from 'uuid';

export interface UserWithRoles extends User {
  roleDetails: Array<{
    id: string;
    name: string;
    color: string;
    position: number;
  }>;
}

export interface UserSearchOptions {
  query?: string;
  roles?: string[];
  isActive?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'username' | 'displayName' | 'createdAt' | 'lastActive';
  sortOrder?: 'asc' | 'desc';
}

export class UserService {
  private static instance: UserService;
  private syncService: DataSyncService;
  private roleService: RoleService;
  private userCache: Map<string, User> = new Map();
  private lastCacheUpdate: Date = new Date(0);

  private constructor() {
    this.syncService = DataSyncService.getInstance();
    this.roleService = RoleService.getInstance();
  }

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  public async createUser(userData: {
    username: string;
    displayName?: string;
    avatar?: string;
    roles?: string[];
  }): Promise<User> {
    // ユーザー名の重複チェック
    const existingUser = await this.getUserByUsername(userData.username);
    if (existingUser) {
      throw new Error('Username already exists');
    }

    // デフォルトロールの設定
    const roles = userData.roles || ['member'];
    
    // ロールの存在確認
    for (const roleName of roles) {
      const role = await this.roleService.getRoleByName(roleName);
      if (!role) {
        throw new Error(`Role '${roleName}' not found`);
      }
    }

    // ユーザー作成
    const user = await UserModel.create({
      username: userData.username,
      password: '', // 仮のパスワード（後で適切に設定）
      displayName: userData.displayName || userData.username,
      roles
    });

    // アバターを設定（プロフィールに追加）
    if (userData.avatar) {
      user.profile.avatar = userData.avatar;
    }

    // データベースに保存
    await this.syncService.writeData('users', 'INSERT', user.id, {
      id: user.id,
      username: user.username,

      display_name: user.profile.displayName,
      avatar: user.profile.avatar,
      bio: user.profile.bio,
      online_status: user.profile.onlineStatus,
      custom_status: user.profile.customStatus ? JSON.stringify(user.profile.customStatus) : null,
      roles: JSON.stringify(user.roles),
      is_active: user.isActive,
      is_banned: user.isBanned,
      last_seen: user.lastSeen.toISOString(),
      created_at: user.createdAt.toISOString(),
      updated_at: user.updatedAt.toISOString()
    });

    // キャッシュを更新
    this.userCache.set(user.id, user);
    this.lastCacheUpdate = new Date();

    return user;
  }

  public async updateUser(userId: string, updates: {
    displayName?: string;
    avatar?: string;
    isActive?: boolean;
  }): Promise<User> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // ユーザー更新
    const updatedUser: User = {
      ...user,
      profile: {
        ...user.profile,
        displayName: updates.displayName || user.profile.displayName,
        ...(updates.avatar !== undefined && { avatar: updates.avatar })
      },
      isActive: updates.isActive !== undefined ? updates.isActive : user.isActive,
      updatedAt: new Date()
    };

    // バリデーション
    const validation = UserModel.validate(updatedUser);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // データベース更新
    await this.syncService.writeData('users', 'UPDATE', userId, {
      display_name: updatedUser.profile.displayName,
      avatar: updatedUser.profile.avatar,
      is_active: updatedUser.isActive,
      updated_at: updatedUser.updatedAt.toISOString()
    });

    // キャッシュ更新
    this.userCache.set(userId, updatedUser);
    this.lastCacheUpdate = new Date();

    return updatedUser;
  }

  public async deleteUser(userId: string): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // ソフト削除（非アクティブ化）
    await this.updateUser(userId, { isActive: false });

    // キャッシュから削除
    this.userCache.delete(userId);
    this.lastCacheUpdate = new Date();
  }

  public async getUserById(userId: string): Promise<User | null> {
    // キャッシュから取得を試行
    if (this.userCache.has(userId)) {
      return this.userCache.get(userId)!;
    }

    // データベースから取得
    const usersData = this.syncService.readData<any>('users', 
      'SELECT * FROM users_cache WHERE id = ? AND is_active = 1', 
      [userId]
    );

    if (usersData.length === 0) {
      return null;
    }

    const userData = usersData[0];
    const user = this.convertToUser(userData);
    
    // キャッシュに保存
    this.userCache.set(userId, user);
    
    return user;
  }

  public async getUserByUsername(username: string): Promise<User | null> {
    // キャッシュから検索
    for (const user of this.userCache.values()) {
      if (user.username === username && user.isActive) {
        return user;
      }
    }

    // データベースから取得
    const usersData = this.syncService.readData<any>('users', 
      'SELECT * FROM users_cache WHERE username = ? AND is_active = 1', 
      [username]
    );

    if (usersData.length === 0) {
      return null;
    }

    const userData = usersData[0];
    const user = this.convertToUser(userData);
    
    // キャッシュに保存
    this.userCache.set(user.id, user);
    
    return user;
  }



  public async getUserWithRoles(userId: string): Promise<UserWithRoles | null> {
    const user = await this.getUserById(userId);
    if (!user) {
      return null;
    }

    // ロール詳細を取得
    const roleDetails: any[] = [];
    for (const roleName of user.roles) {
      const role = await this.roleService.getRoleByName(roleName);
      if (role) {
        roleDetails.push(role);
      }
    }

    return {
      ...user,
      roleDetails: roleDetails.map(role => ({
        id: role.id,
        name: role.name,
        color: role.color,
        position: role.position
      }))
    };
  }

  public async searchUsers(options: UserSearchOptions = {}): Promise<{
    users: UserWithRoles[];
    total: number;
    hasMore: boolean;
  }> {
    const {
      query = '',
      roles = [],
      isActive = true,
      limit = 50,
      offset = 0,
      sortBy = 'username',
      sortOrder = 'asc'
    } = options;

    let sql = 'SELECT * FROM users_cache WHERE is_active = ?';
    const params: any[] = [isActive ? 1 : 0];

    // 検索クエリ
    if (query) {
      sql += ' AND (username LIKE ? OR display_name LIKE ?)';
      const searchTerm = `%${query}%`;
      params.push(searchTerm, searchTerm);
    }

    // ロールフィルター
    if (roles.length > 0) {
      const roleConditions = roles.map(() => 'JSON_CONTAINS(roles, ?)').join(' OR ');
      sql += ` AND (${roleConditions})`;
      roles.forEach(role => params.push(`"${role}"`));
    }

    // ソート
    const sortColumn = {
      username: 'username',
      displayName: 'display_name',
      createdAt: 'created_at',
      lastActive: 'last_active'
    }[sortBy] || 'username';

    sql += ` ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}`;

    // 総数取得用のクエリ
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count').split(' ORDER BY')[0];
    const totalResult = this.syncService.readData<{ count: number }>('users', countSql || '', params);
    const total = totalResult[0]?.count || 0;

    // ページネーション
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const usersData = this.syncService.readData<any>('users', sql, params);
    
    // ユーザーとロール詳細を取得
    const users: UserWithRoles[] = [];
    for (const userData of usersData) {
      const user = this.convertToUser(userData);
      const roleDetails: any[] = [];
      for (const roleName of user.roles) {
        const role = await this.roleService.getRoleByName(roleName);
        if (role) {
          roleDetails.push(role);
        }
      }
      
      users.push({
        ...user,
        roleDetails: roleDetails.map(role => ({
          id: role.id,
          name: role.name,
          color: role.color,
          position: role.position
        }))
      });
    }

    return {
      users,
      total,
      hasMore: offset + users.length < total
    };
  }

  public async assignRoleToUser(userId: string, roleName: string): Promise<void> {
    await this.roleService.assignRoleToUser(userId, roleName);
    
    // キャッシュから削除して再読み込みを促す
    this.userCache.delete(userId);
  }

  public async removeRoleFromUser(userId: string, roleName: string): Promise<void> {
    await this.roleService.removeRoleFromUser(userId, roleName);
    
    // キャッシュから削除して再読み込みを促す
    this.userCache.delete(userId);
  }

  public async updateUserRoles(userId: string, roleNames: string[]): Promise<User> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // ロールの存在確認
    for (const roleName of roleNames) {
      const role = await this.roleService.getRoleByName(roleName);
      if (!role) {
        throw new Error(`Role '${roleName}' not found`);
      }
    }

    // 空のロール配列の場合はmemberロールを追加
    const finalRoles = roleNames.length === 0 ? ['member'] : roleNames;

    // データベース更新
    await this.syncService.writeData('users', 'UPDATE', userId, {
      roles: JSON.stringify(finalRoles),
      updated_at: new Date().toISOString()
    });

    // キャッシュから削除して再読み込みを促す
    this.userCache.delete(userId);

    // 更新されたユーザーを返す
    return await this.getUserById(userId) as User;
  }

  public async updateLastActive(userId: string): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) {
      return;
    }

    const now = new Date();
    
    // 最後のアクティブ時間から5分以上経過している場合のみ更新
    if (now.getTime() - user.lastSeen.getTime() > 5 * 60 * 1000) {
      await this.syncService.writeData('users', 'UPDATE', userId, {
        last_seen: now.toISOString()
      });

      // キャッシュ更新
      if (this.userCache.has(userId)) {
        const cachedUser = this.userCache.get(userId)!;
        cachedUser.lastSeen = now;
      }
    }
  }

  public async getUserStatistics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    recentlyActive: number; // 過去24時間以内
    roleDistribution: Array<{
      roleName: string;
      userCount: number;
      percentage: number;
    }>;
  }> {
    const totalResult = this.syncService.readData<{ count: number }>('users', 
      'SELECT COUNT(*) as count FROM users_cache'
    );
    const totalUsers = totalResult[0]?.count || 0;

    const activeResult = this.syncService.readData<{ count: number }>('users', 
      'SELECT COUNT(*) as count FROM users_cache WHERE is_active = 1'
    );
    const activeUsers = activeResult[0]?.count || 0;

    const inactiveUsers = totalUsers - activeUsers;

    const recentlyActiveResult = this.syncService.readData<{ count: number }>('users', 
      'SELECT COUNT(*) as count FROM users_cache WHERE is_active = 1 AND last_seen > ?',
      [new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()]
    );
    const recentlyActive = recentlyActiveResult[0]?.count || 0;

    // ロール分布を取得（簡易版）
    const roleDistribution: Array<{
      roleName: string;
      userCount: number;
      percentage: number;
    }> = [];

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      recentlyActive,
      roleDistribution
    };
  }

  public async getAllUsers(): Promise<User[]> {
    // キャッシュの有効性をチェック（5分間有効）
    const cacheAge = Date.now() - this.lastCacheUpdate.getTime();
    if (cacheAge < 5 * 60 * 1000 && this.userCache.size > 0) {
      return Array.from(this.userCache.values()).filter(user => user.isActive);
    }

    // データベースから全ユーザーを取得
    const usersData = this.syncService.readData<any>('users', 
      'SELECT * FROM users_cache WHERE is_active = 1 ORDER BY username ASC'
    );

    const users = usersData.map(userData => this.convertToUser(userData));
    
    // キャッシュを更新
    this.userCache.clear();
    users.forEach(user => this.userCache.set(user.id, user));
    this.lastCacheUpdate = new Date();

    return users;
  }

  private convertToUser(userData: any): User {
    return {
      id: userData.id,
      username: userData.username,
      passwordHash: userData.password_hash || '',
      roles: JSON.parse(userData.roles || '[\"member\"]'),
      profile: {
        displayName: userData.display_name,
        avatar: userData.avatar,
        bio: userData.bio,
        onlineStatus: userData.online_status || 'offline',
        customStatus: userData.custom_status ? JSON.parse(userData.custom_status) : undefined
      },
      isActive: userData.is_active,
      isBanned: userData.is_banned || false,
      lastSeen: new Date(userData.last_seen),
      createdAt: new Date(userData.created_at),
      updatedAt: new Date(userData.updated_at)
    };
  }

  // ロール名でユーザーを取得
  public async getUsersByRole(roleName: string): Promise<User[]> {
    const query = `
      SELECT * FROM users_cache 
      WHERE JSON_CONTAINS(roles, JSON_QUOTE(?))
      AND is_active = true
      AND is_banned = false
    `;
    
    const rows = this.syncService.readData('users', query, [roleName]);
    return rows.map(row => this.convertToUser(row));
  }

  public clearCache(): void {
    this.userCache.clear();
    this.lastCacheUpdate = new Date(0);
  }
}