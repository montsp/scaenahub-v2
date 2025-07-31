import { Role, RolePermissions } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class RoleModel {
  public static validate(roleData: Partial<Role>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // ロール名検証
    if (!roleData.name) {
      errors.push('Role name is required');
    } else if (roleData.name.length < 1 || roleData.name.length > 50) {
      errors.push('Role name must be between 1 and 50 characters');
    }

    // 色検証
    if (roleData.color && !/^#[0-9A-Fa-f]{6}$/.test(roleData.color)) {
      errors.push('Color must be a valid hex color code (e.g., #FF0000)');
    }

    // ポジション検証
    if (roleData.position !== undefined && (roleData.position < 0 || roleData.position > 1000)) {
      errors.push('Position must be between 0 and 1000');
    }

    // 権限検証
    if (roleData.permissions) {
      const permissionErrors = RoleModel.validatePermissions(roleData.permissions);
      errors.push(...permissionErrors);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  public static validatePermissions(permissions: Partial<RolePermissions>): string[] {
    const errors: string[] = [];
    
    const validPermissions = [
      'manageServer', 'manageChannels', 'manageRoles', 'manageUsers',
      'viewChannels', 'sendMessages', 'sendFiles', 'embedLinks', 'mentionEveryone',
      'manageMessages', 'pinMessages', 'readMessageHistory',
      'kickMembers', 'banMembers', 'moderateMessages'
    ];

    for (const [key, value] of Object.entries(permissions)) {
      if (!validPermissions.includes(key)) {
        errors.push(`Invalid permission: ${key}`);
      }
      if (typeof value !== 'boolean') {
        errors.push(`Permission ${key} must be a boolean value`);
      }
    }

    return errors;
  }

  public static create(roleData: {
    name: string;
    color?: string;
    position?: number;
    permissions?: Partial<RolePermissions>;
    isDefault?: boolean;
    mentionable?: boolean;
  }): Role {
    const now = new Date();
    
    const defaultPermissions: RolePermissions = {
      // サーバー管理
      manageServer: false,
      manageChannels: false,
      manageRoles: false,
      manageUsers: false,
      
      // チャンネル権限
      viewChannels: true,
      sendMessages: true,
      sendFiles: true,
      embedLinks: true,
      mentionEveryone: false,
      
      // メッセージ管理
      manageMessages: false,
      pinMessages: false,
      readMessageHistory: true,
      
      // モデレーション
      kickMembers: false,
      banMembers: false,
      moderateMessages: false
    };

    const role: Role = {
      id: uuidv4(),
      name: roleData.name,
      color: roleData.color || '#99AAB5',
      position: roleData.position || 0,
      permissions: { ...defaultPermissions, ...roleData.permissions },
      isDefault: roleData.isDefault || false,
      mentionable: roleData.mentionable !== undefined ? roleData.mentionable : true,
      createdAt: now,
      updatedAt: now
    };

    const validation = RoleModel.validate(role);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    return role;
  }

  public static getDefaultRoles(): Role[] {
    return [
      RoleModel.create({
        name: 'admin',
        color: '#FF0000',
        position: 100,
        isDefault: false,
        permissions: {
          // 全権限を付与
          manageServer: true,
          manageChannels: true,
          manageRoles: true,
          manageUsers: true,
          viewChannels: true,
          sendMessages: true,
          sendFiles: true,
          embedLinks: true,
          mentionEveryone: true,
          manageMessages: true,
          pinMessages: true,
          readMessageHistory: true,
          kickMembers: true,
          banMembers: true,
          moderateMessages: true
        }
      }),
      RoleModel.create({
        name: 'moderator',
        color: '#00FF00',
        position: 50,
        isDefault: false,
        permissions: {
          manageServer: false,
          manageChannels: true,
          manageRoles: false,
          manageUsers: false,
          viewChannels: true,
          sendMessages: true,
          sendFiles: true,
          embedLinks: true,
          mentionEveryone: true,
          manageMessages: true,
          pinMessages: true,
          readMessageHistory: true,
          kickMembers: true,
          banMembers: false,
          moderateMessages: true
        }
      }),
      RoleModel.create({
        name: 'member',
        color: '#99AAB5',
        position: 0,
        isDefault: true,
        permissions: {
          manageServer: false,
          manageChannels: false,
          manageRoles: false,
          manageUsers: false,
          viewChannels: true,
          sendMessages: true,
          sendFiles: true,
          embedLinks: true,
          mentionEveryone: false,
          manageMessages: false,
          pinMessages: false,
          readMessageHistory: true,
          kickMembers: false,
          banMembers: false,
          moderateMessages: false
        }
      })
    ];
  }

  public static hasPermission(userRoles: string[], roles: Role[], permission: keyof RolePermissions): boolean {
    // ユーザーが持つロールの中で、指定された権限を持つものがあるかチェック
    for (const roleName of userRoles) {
      const role = roles.find(r => r.name === roleName);
      if (role && role.permissions[permission]) {
        return true;
      }
    }
    return false;
  }

  public static getHighestPosition(userRoles: string[], roles: Role[]): number {
    let highestPosition = 0;
    
    for (const roleName of userRoles) {
      const role = roles.find(r => r.name === roleName);
      if (role && role.position > highestPosition) {
        highestPosition = role.position;
      }
    }
    
    return highestPosition;
  }

  public static canManageRole(userRoles: string[], targetRole: Role, allRoles: Role[]): boolean {
    // 管理者権限があるかチェック
    if (RoleModel.hasPermission(userRoles, allRoles, 'manageRoles')) {
      // ユーザーの最高位ロールが対象ロールより上位かチェック
      const userHighestPosition = RoleModel.getHighestPosition(userRoles, allRoles);
      return userHighestPosition > targetRole.position;
    }
    return false;
  }
}