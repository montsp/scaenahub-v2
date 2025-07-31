import { Role, RolePermissions, User } from '../types';
import { RoleModel } from '../models/Role';
import { DataSyncService } from './database/sync';
import { AuthService } from './auth';
import { v4 as uuidv4 } from 'uuid';

export interface RoleWithUsers {
  role: Role;
  userCount: number;
  users: Array<{
    id: string;
    username: string;
    displayName: string;
  }>;
}

export class RoleService {
  private static instance: RoleService;
  private syncService: DataSyncService;
  private authService: AuthService;

  private constructor() {
    this.syncService = DataSyncService.getInstance();
    this.authService = AuthService.getInstance();
  }

  public static getInstance(): RoleService {
    if (!RoleService.instance) {
      RoleService.instance = new RoleService();
    }
    return RoleService.instance;
  }

  public async createRole(roleData: {
    name: string;
    color?: string;
    position?: number;
    permissions?: Partial<RolePermissions>;
    mentionable?: boolean;
  }): Promise<Role> {
    // ロール名の重複チェック
    const existingRoles = this.syncService.readData<any>('roles', 
      'SELECT * FROM roles_cache WHERE name = ?', 
      [roleData.name]
    );

    if (existingRoles.length > 0) {
      throw new Error('Role name already exists');
    }

    // ロール作成
    const role = RoleModel.create(roleData);

    // データベースに保存
    await this.syncService.writeData('roles', 'INSERT', role.id, {
      id: role.id,
      name: role.name,
      color: role.color,
      position: role.position,
      permissions: JSON.stringify(role.permissions),
      is_default: role.isDefault,
      mentionable: role.mentionable,
      created_at: role.createdAt.toISOString(),
      updated_at: role.updatedAt.toISOString()
    });

    return role;
  }

  public async updateRole(roleId: string, updates: {
    name?: string;
    color?: string;
    position?: number;
    permissions?: Partial<RolePermissions>;
    mentionable?: boolean;
  }): Promise<Role> {
    const role = await this.getRoleById(roleId);
    if (!role) {
      throw new Error('Role not found');
    }

    // ロール名の重複チェック（名前を変更する場合）
    if (updates.name && updates.name !== role.name) {
      const existingRoles = this.syncService.readData<any>('roles', 
        'SELECT * FROM roles_cache WHERE name = ? AND id != ?', 
        [updates.name, roleId]
      );

      if (existingRoles.length > 0) {
        throw new Error('Role name already exists');
      }
    }

    // ロール更新
    const updatedRole: Role = {
      ...role,
      name: updates.name || role.name,
      color: updates.color || role.color,
      position: updates.position !== undefined ? updates.position : role.position,
      permissions: updates.permissions ? { ...role.permissions, ...updates.permissions } : role.permissions,
      mentionable: updates.mentionable !== undefined ? updates.mentionable : role.mentionable,
      updatedAt: new Date()
    };

    // バリデーション
    const validation = RoleModel.validate(updatedRole);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // データベース更新
    await this.syncService.writeData('roles', 'UPDATE', roleId, {
      name: updatedRole.name,
      color: updatedRole.color,
      position: updatedRole.position,
      permissions: JSON.stringify(updatedRole.permissions),
      mentionable: updatedRole.mentionable,
      updated_at: updatedRole.updatedAt.toISOString()
    });

    return updatedRole;
  }

  public async deleteRole(roleId: string): Promise<void> {
    const role = await this.getRoleById(roleId);
    if (!role) {
      throw new Error('Role not found');
    }

    // デフォルトロールは削除不可
    if (role.isDefault) {
      throw new Error('Cannot delete default role');
    }

    // このロールを持つユーザーを検索
    const usersWithRole = this.syncService.readData<any>('users', 
      'SELECT id, roles FROM users_cache WHERE JSON_CONTAINS(roles, ?)', 
      [`"${role.name}"`]
    );

    // ユーザーからロールを削除
    for (const userData of usersWithRole) {
      const userRoles = JSON.parse(userData.roles || '["member"]');
      const updatedRoles = userRoles.filter((r: string) => r !== role.name);
      
      // 最低1つのロールは必要
      if (updatedRoles.length === 0) {
        updatedRoles.push('member');
      }

      await this.syncService.writeData('users', 'UPDATE', userData.id, {
        roles: JSON.stringify(updatedRoles),
        updated_at: new Date().toISOString()
      });
    }

    // ロール削除
    await this.syncService.writeData('roles', 'DELETE', roleId, {});
  }

  public async getRoleById(roleId: string): Promise<Role | null> {
    const rolesData = this.syncService.readData<any>('roles', 
      'SELECT * FROM roles_cache WHERE id = ?', 
      [roleId]
    );

    if (rolesData.length === 0) {
      return null;
    }

    return this.convertToRole(rolesData[0]);
  }

  public async getRoleByName(roleName: string): Promise<Role | null> {
    const rolesData = this.syncService.readData<any>('roles', 
      'SELECT * FROM roles_cache WHERE name = ?', 
      [roleName]
    );

    if (rolesData.length === 0) {
      return null;
    }

    return this.convertToRole(rolesData[0]);
  }

  public async getAllRoles(): Promise<Role[]> {
    const rolesData = this.syncService.readData<any>('roles', 
      'SELECT * FROM roles_cache ORDER BY position DESC, name ASC'
    );

    return rolesData.map(roleData => this.convertToRole(roleData));
  }

  public async getRolesWithUsers(): Promise<RoleWithUsers[]> {
    const roles = await this.getAllRoles();
    const rolesWithUsers: RoleWithUsers[] = [];

    for (const role of roles) {
      // このロールを持つユーザーを取得
      const usersData = this.syncService.readData<any>('users', 
        'SELECT id, username, display_name FROM users_cache WHERE JSON_CONTAINS(roles, ?) AND is_active = 1', 
        [`"${role.name}"`]
      );

      const users = usersData.map(userData => ({
        id: userData.id,
        username: userData.username,
        displayName: userData.display_name
      }));

      rolesWithUsers.push({
        role,
        userCount: users.length,
        users
      });
    }

    return rolesWithUsers;
  }

  public async assignRoleToUser(userId: string, roleName: string): Promise<User> {
    const user = await this.authService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const role = await this.getRoleByName(roleName);
    if (!role) {
      throw new Error('Role not found');
    }

    // 既にロールを持っているかチェック
    if (user.roles.includes(roleName)) {
      throw new Error('User already has this role');
    }

    // ロールを追加
    const updatedRoles = [...user.roles, roleName];

    await this.syncService.writeData('users', 'UPDATE', userId, {
      roles: JSON.stringify(updatedRoles),
      updated_at: new Date().toISOString()
    });

    // 更新されたユーザーを返す
    const updatedUser = await this.authService.getUserById(userId);
    return updatedUser!;
  }

  public async removeRoleFromUser(userId: string, roleName: string): Promise<User> {
    const user = await this.authService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // ロールを持っているかチェック
    if (!user.roles.includes(roleName)) {
      throw new Error('User does not have this role');
    }

    // デフォルトロールは削除不可
    const role = await this.getRoleByName(roleName);
    if (role?.isDefault) {
      throw new Error('Cannot remove default role');
    }

    // ロールを削除
    const updatedRoles = user.roles.filter(r => r !== roleName);

    // 最低1つのロールは必要
    if (updatedRoles.length === 0) {
      updatedRoles.push('member');
    }

    await this.syncService.writeData('users', 'UPDATE', userId, {
      roles: JSON.stringify(updatedRoles),
      updated_at: new Date().toISOString()
    });

    // 更新されたユーザーを返す
    const updatedUser = await this.authService.getUserById(userId);
    return updatedUser!;
  }

  public async setUserRoles(userId: string, roleNames: string[]): Promise<User> {
    const user = await this.authService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // ロールの存在確認
    for (const roleName of roleNames) {
      const role = await this.getRoleByName(roleName);
      if (!role) {
        throw new Error(`Role '${roleName}' not found`);
      }
    }

    // 最低1つのロールは必要
    if (roleNames.length === 0) {
      roleNames.push('member');
    }

    await this.syncService.writeData('users', 'UPDATE', userId, {
      roles: JSON.stringify(roleNames),
      updated_at: new Date().toISOString()
    });

    // 更新されたユーザーを返す
    const updatedUser = await this.authService.getUserById(userId);
    return updatedUser!;
  }

  public async hasPermission(userRoles: string[], permission: keyof RolePermissions): Promise<boolean> {
    const roles = await this.getAllRoles();
    return RoleModel.hasPermission(userRoles, roles, permission);
  }

  public async getHighestPosition(userRoles: string[]): Promise<number> {
    const roles = await this.getAllRoles();
    return RoleModel.getHighestPosition(userRoles, roles);
  }

  public async canManageRole(userRoles: string[], targetRoleName: string): Promise<boolean> {
    const roles = await this.getAllRoles();
    const targetRole = roles.find(r => r.name === targetRoleName);
    
    if (!targetRole) {
      return false;
    }

    return RoleModel.canManageRole(userRoles, targetRole, roles);
  }

  public async canManageUser(managerRoles: string[], targetUserId: string): Promise<boolean> {
    const targetUser = await this.authService.getUserById(targetUserId);
    if (!targetUser) {
      return false;
    }

    const managerHighestPosition = await this.getHighestPosition(managerRoles);
    const targetHighestPosition = await this.getHighestPosition(targetUser.roles);

    // 管理者は自分より下位のロールを持つユーザーのみ管理可能
    return managerHighestPosition > targetHighestPosition;
  }

  public async initializeDefaultRoles(): Promise<void> {
    const existingRoles = await this.getAllRoles();
    
    // デフォルトロールが存在しない場合のみ作成
    const defaultRoles = RoleModel.getDefaultRoles();
    
    for (const defaultRole of defaultRoles) {
      const existingRole = existingRoles.find(r => r.name === defaultRole.name);
      if (!existingRole) {
        await this.syncService.writeData('roles', 'INSERT', defaultRole.id, {
          id: defaultRole.id,
          name: defaultRole.name,
          color: defaultRole.color,
          position: defaultRole.position,
          permissions: JSON.stringify(defaultRole.permissions),
          is_default: defaultRole.isDefault,
          mentionable: defaultRole.mentionable,
          created_at: defaultRole.createdAt.toISOString(),
          updated_at: defaultRole.updatedAt.toISOString()
        });
        
        console.log(`✅ Created default role: ${defaultRole.name}`);
      }
    }
  }

  public async getPermissionMatrix(): Promise<{
    roles: Role[];
    permissions: Array<{
      key: keyof RolePermissions;
      name: string;
      category: string;
    }>;
  }> {
    const roles = await this.getAllRoles();
    
    const permissions: Array<{
      key: keyof RolePermissions;
      name: string;
      category: string;
    }> = [
      // サーバー管理
      { key: 'manageServer', name: 'サーバー管理', category: 'サーバー管理' },
      { key: 'manageChannels', name: 'チャンネル管理', category: 'サーバー管理' },
      { key: 'manageRoles', name: 'ロール管理', category: 'サーバー管理' },
      { key: 'manageUsers', name: 'ユーザー管理', category: 'サーバー管理' },
      
      // チャンネル権限
      { key: 'viewChannels', name: 'チャンネル閲覧', category: 'チャンネル権限' },
      { key: 'sendMessages', name: 'メッセージ送信', category: 'チャンネル権限' },
      { key: 'sendFiles', name: 'ファイル送信', category: 'チャンネル権限' },
      { key: 'embedLinks', name: 'リンク埋め込み', category: 'チャンネル権限' },
      { key: 'mentionEveryone', name: '全員メンション', category: 'チャンネル権限' },
      
      // メッセージ管理
      { key: 'manageMessages', name: 'メッセージ管理', category: 'メッセージ管理' },
      { key: 'pinMessages', name: 'メッセージピン留め', category: 'メッセージ管理' },
      { key: 'readMessageHistory', name: 'メッセージ履歴閲覧', category: 'メッセージ管理' },
      
      // モデレーション
      { key: 'kickMembers', name: 'メンバーキック', category: 'モデレーション' },
      { key: 'banMembers', name: 'メンバーBAN', category: 'モデレーション' },
      { key: 'moderateMessages', name: 'メッセージモデレート', category: 'モデレーション' }
    ];

    return { roles, permissions };
  }

  private convertToRole(roleData: any): Role {
    return {
      id: roleData.id,
      name: roleData.name,
      color: roleData.color,
      position: roleData.position,
      permissions: JSON.parse(roleData.permissions || '{}'),
      isDefault: roleData.is_default,
      mentionable: roleData.mentionable,
      createdAt: new Date(roleData.created_at),
      updatedAt: new Date(roleData.updated_at)
    };
  }
}