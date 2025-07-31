import { RoleService } from '../services/role';
import { AuthService } from '../services/auth';
import { DataSyncService } from '../services/database/sync';
import { RoleModel } from '../models/Role';

// モック設定
const mockAuthService = {
  getUserById: jest.fn(),
  updateUserProfile: jest.fn(),
  getInstance: jest.fn()
};

const mockSyncService = {
  readData: jest.fn(),
  writeData: jest.fn(),
  getInstance: jest.fn()
};

jest.mock('../services/auth', () => ({
  AuthService: {
    getInstance: () => mockAuthService
  }
}));

jest.mock('../services/database/sync', () => ({
  DataSyncService: {
    getInstance: () => mockSyncService
  }
}));

jest.mock('../models/Role');

describe.skip('RoleService', () => {
  let roleService: RoleService;

  beforeEach(() => {
    roleService = RoleService.getInstance();
    
    // モックをリセット
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRole', () => {
    it('should create a new role successfully', async () => {
      const mockRole = {
        id: 'role-1',
        name: 'testrole',
        color: '#FF0000',
        position: 10,
        permissions: { manageServer: true },
        isDefault: false,
        mentionable: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockSyncService.readData.mockReturnValue([]); // ロール名重複なし
      (RoleModel.create as jest.Mock).mockReturnValue(mockRole);
      mockSyncService.writeData.mockResolvedValue(undefined);

      const roleData = {
        name: 'testrole',
        color: '#FF0000',
        position: 10,
        permissions: { manageServer: true }
      };

      const result = await roleService.createRole(roleData);

      expect(RoleModel.create).toHaveBeenCalledWith(roleData);
      expect(mockSyncService.writeData).toHaveBeenCalledWith('roles', 'INSERT', 'role-1', expect.any(Object));
      expect(result.name).toBe('testrole');
    });

    it('should throw error for duplicate role name', async () => {
      mockSyncService.readData.mockReturnValue([{ id: 'existing-role' }]);

      const roleData = {
        name: 'testrole'
      };

      await expect(roleService.createRole(roleData)).rejects.toThrow('Role name already exists');
    });
  });

  describe('updateRole', () => {
    it('should update role successfully', async () => {
      const mockExistingRole = {
        id: 'role-1',
        name: 'testrole',
        color: '#FF0000',
        position: 10,
        permissions: { manageServer: false },
        isDefault: false,
        mentionable: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockUpdatedRole = {
        ...mockExistingRole,
        permissions: { manageServer: true },
        updatedAt: new Date()
      };

      mockSyncService.readData.mockReturnValue([{
        id: 'role-1',
        name: 'testrole',
        color: '#FF0000',
        position: 10,
        permissions: '{"manageServer":false}',
        is_default: false,
        mentionable: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);

      (RoleModel.validate as jest.Mock).mockReturnValue({ isValid: true, errors: [] });
      mockSyncService.writeData.mockResolvedValue(undefined);

      const updates = {
        permissions: { manageServer: true }
      };

      const result = await roleService.updateRole('role-1', updates);

      expect(mockSyncService.writeData).toHaveBeenCalledWith('roles', 'UPDATE', 'role-1', expect.any(Object));
      expect(result.permissions.manageServer).toBe(true);
    });

    it('should throw error for non-existent role', async () => {
      mockSyncService.readData.mockReturnValue([]);

      await expect(roleService.updateRole('role-1', { name: 'newname' }))
        .rejects.toThrow('Role not found');
    });
  });

  describe('deleteRole', () => {
    it('should delete role and remove from users', async () => {
      const mockRole = {
        id: 'role-1',
        name: 'testrole',
        isDefault: false
      };

      const mockUsersWithRole = [
        { id: 'user-1', roles: '["testrole", "member"]' },
        { id: 'user-2', roles: '["testrole"]' }
      ];

      mockSyncService.readData
        .mockReturnValueOnce([{
          id: 'role-1',
          name: 'testrole',
          is_default: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .mockReturnValueOnce(mockUsersWithRole);

      mockSyncService.writeData.mockResolvedValue(undefined);

      await roleService.deleteRole('role-1');

      // ユーザーからロールが削除されることを確認
      expect(mockSyncService.writeData).toHaveBeenCalledWith('users', 'UPDATE', 'user-1', {
        roles: '["member"]',
        updated_at: expect.any(String)
      });

      // user-2は他にロールがないので、memberロールが追加される
      expect(mockSyncService.writeData).toHaveBeenCalledWith('users', 'UPDATE', 'user-2', {
        roles: '["member"]',
        updated_at: expect.any(String)
      });

      // ロール削除
      expect(mockSyncService.writeData).toHaveBeenCalledWith('roles', 'DELETE', 'role-1', {});
    });

    it('should throw error for default role deletion', async () => {
      mockSyncService.readData.mockReturnValue([{
        id: 'role-1',
        name: 'member',
        is_default: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);

      await expect(roleService.deleteRole('role-1')).rejects.toThrow('Cannot delete default role');
    });
  });

  describe('assignRoleToUser', () => {
    it('should assign role to user successfully', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        roles: ['member']
      };

      const mockRole = {
        id: 'role-1',
        name: 'moderator'
      };

      const updatedUser = {
        ...mockUser,
        roles: ['member', 'moderator']
      };

      mockAuthService.getUserById.mockResolvedValue(mockUser as any);
      mockSyncService.readData.mockReturnValue([{
        id: 'role-1',
        name: 'moderator',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);
      mockSyncService.writeData.mockResolvedValue(undefined);
      mockAuthService.getUserById.mockResolvedValueOnce(updatedUser as any);

      const result = await roleService.assignRoleToUser('user-1', 'moderator');

      expect(mockSyncService.writeData).toHaveBeenCalledWith('users', 'UPDATE', 'user-1', {
        roles: '["member","moderator"]',
        updated_at: expect.any(String)
      });
      expect(result.roles).toContain('moderator');
    });

    it('should throw error if user already has role', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        roles: ['member', 'moderator']
      };

      mockAuthService.getUserById.mockResolvedValue(mockUser as any);
      mockSyncService.readData.mockReturnValue([{
        id: 'role-1',
        name: 'moderator'
      }]);

      await expect(roleService.assignRoleToUser('user-1', 'moderator'))
        .rejects.toThrow('User already has this role');
    });
  });

  describe('removeRoleFromUser', () => {
    it('should remove role from user successfully', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        roles: ['member', 'moderator']
      };

      const mockRole = {
        id: 'role-1',
        name: 'moderator',
        isDefault: false
      };

      const updatedUser = {
        ...mockUser,
        roles: ['member']
      };

      mockAuthService.getUserById.mockResolvedValue(mockUser as any);
      mockSyncService.readData.mockReturnValue([{
        id: 'role-1',
        name: 'moderator',
        is_default: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);
      mockSyncService.writeData.mockResolvedValue(undefined);
      mockAuthService.getUserById.mockResolvedValueOnce(updatedUser as any);

      const result = await roleService.removeRoleFromUser('user-1', 'moderator');

      expect(mockSyncService.writeData).toHaveBeenCalledWith('users', 'UPDATE', 'user-1', {
        roles: '["member"]',
        updated_at: expect.any(String)
      });
      expect(result.roles).not.toContain('moderator');
    });

    it('should throw error for removing default role', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        roles: ['member']
      };

      mockAuthService.getUserById.mockResolvedValue(mockUser as any);
      mockSyncService.readData.mockReturnValue([{
        id: 'role-1',
        name: 'member',
        is_default: true
      }]);

      await expect(roleService.removeRoleFromUser('user-1', 'member'))
        .rejects.toThrow('Cannot remove default role');
    });
  });

  describe('hasPermission', () => {
    it('should check permission correctly', async () => {
      const mockRoles = [
        {
          id: 'role-1',
          name: 'admin',
          permissions: { manageServer: true },
          position: 100,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'role-2',
          name: 'member',
          permissions: { manageServer: false },
          position: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      mockSyncService.readData.mockReturnValue(mockRoles);
      (RoleModel.hasPermission as jest.Mock).mockReturnValue(true);

      const result = await roleService.hasPermission(['admin'], 'manageServer');

      expect(RoleModel.hasPermission).toHaveBeenCalledWith(
        ['admin'],
        expect.any(Array),
        'manageServer'
      );
      expect(result).toBe(true);
    });
  });

  describe('initializeDefaultRoles', () => {
    it('should create default roles if they do not exist', async () => {
      const mockDefaultRoles = [
        {
          id: 'role-1',
          name: 'admin',
          color: '#FF0000',
          position: 100,
          permissions: { manageServer: true },
          isDefault: false,
          mentionable: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockSyncService.readData.mockReturnValue([]); // 既存ロールなし
      (RoleModel.getDefaultRoles as jest.Mock).mockReturnValue(mockDefaultRoles);
      mockSyncService.writeData.mockResolvedValue(undefined);

      await roleService.initializeDefaultRoles();

      expect(mockSyncService.writeData).toHaveBeenCalledWith('roles', 'INSERT', 'role-1', expect.any(Object));
    });

    it('should not create default roles if they already exist', async () => {
      const mockExistingRoles = [
        {
          id: 'role-1',
          name: 'admin',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      const mockDefaultRoles = [
        {
          id: 'role-2',
          name: 'admin',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockSyncService.readData.mockReturnValue(mockExistingRoles);
      (RoleModel.getDefaultRoles as jest.Mock).mockReturnValue(mockDefaultRoles);

      await roleService.initializeDefaultRoles();

      // 既存のロールがあるため、新しいロールは作成されない
      expect(mockSyncService.writeData).not.toHaveBeenCalled();
    });
  });

  describe('hasPermission', () => {
    it('should return true for sufficient permissions', async () => {
      (RoleModel.hasPermission as jest.Mock).mockReturnValue(true);
      
      const result = await roleService.hasPermission(['admin'], 'manageServer');
      
      expect(result).toBe(true);
    });

    it('should return false for insufficient permissions', async () => {
      (RoleModel.hasPermission as jest.Mock).mockReturnValue(false);
      
      mockSyncService.readData.mockReturnValue([{
        id: 'role-1',
        name: 'member',
        permissions: JSON.stringify({ viewChannels: true }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        color: '#99AAB5',
        position: 0,
        is_default: true,
        mentionable: true
      }]);

      const result = await roleService.hasPermission(['member'], 'manageServer');

      expect(result).toBe(false);
    });
  });

  describe('getHighestPosition', () => {
    it('should return highest position among user roles', async () => {
      const roles = [
        {
          name: 'admin',
          position: 100
        },
        {
          name: 'moderator',
          position: 50
        }
      ];

      (RoleModel.getHighestPosition as jest.Mock).mockReturnValue(100);
      
      mockSyncService.readData.mockReturnValue([
        {
          id: 'role-1',
          name: 'admin',
          position: 100,
          permissions: JSON.stringify({}),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          color: '#FF0000',
          is_default: false,
          mentionable: true
        },
        {
          id: 'role-2',
          name: 'moderator',
          position: 50,
          permissions: JSON.stringify({}),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          color: '#00FF00',
          is_default: false,
          mentionable: true
        }
      ]);

      const result = await roleService.getHighestPosition(['admin', 'moderator']);

      expect(result).toBe(100);
    });
  });

  describe('canManageRole', () => {
    it('should allow managing lower position roles', async () => {
      const targetRole = {
        id: 'role-2',
        name: 'member',
        position: 0
      };

      const allRoles = [
        {
          id: 'role-1',
          name: 'admin',
          position: 100
        },
        {
          id: 'role-2',
          name: 'member',
          position: 0
        }
      ];

      mockSyncService.readData
        .mockReturnValueOnce([{ // getRoleById用
          id: 'role-2',
          name: 'member',
          position: 0,
          permissions: JSON.stringify({}),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          color: '#99AAB5',
          is_default: true,
          mentionable: true
        }])
        .mockReturnValueOnce([ // getAllRoles用
          {
            id: 'role-1',
            name: 'admin',
            position: 100,
            permissions: JSON.stringify({}),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            color: '#FF0000',
            is_default: false,
            mentionable: true
          },
          {
            id: 'role-2',
            name: 'member',
            position: 0,
            permissions: JSON.stringify({}),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            color: '#99AAB5',
            is_default: true,
            mentionable: true
          }
        ]);

      (RoleModel.canManageRole as jest.Mock).mockReturnValue(true);

      const result = await roleService.canManageRole(['admin'], 'role-2');

      expect(result).toBe(true);
    });
  });



  describe('initializeDefaultRoles', () => {
    it('should initialize default roles when none exist', async () => {
      const defaultRoles = [
        {
          name: 'admin',
          color: '#FF0000',
          position: 100,
          permissions: { manageServer: true },
          isDefault: true,
          mentionable: true
        },
        {
          name: 'member',
          color: '#99AAB5',
          position: 0,
          permissions: { viewChannels: true },
          isDefault: true,
          mentionable: true
        }
      ];

      mockSyncService.readData.mockReturnValue([]); // 既存ロールなし
      (RoleModel.getDefaultRoles as jest.Mock).mockReturnValue(defaultRoles);
      (RoleModel.create as jest.Mock).mockImplementation((data) => ({
        id: `role-${data.name}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
      mockSyncService.writeData.mockResolvedValue(undefined);

      await roleService.initializeDefaultRoles();

      expect(RoleModel.getDefaultRoles).toHaveBeenCalled();
      expect(RoleModel.create).toHaveBeenCalledTimes(2);
      expect(mockSyncService.writeData).toHaveBeenCalledTimes(2);
    });

    it('should skip initialization when roles already exist', async () => {
      mockSyncService.readData.mockReturnValue([{
        id: 'role-1',
        name: 'admin'
      }]);

      await roleService.initializeDefaultRoles();

      expect(RoleModel.getDefaultRoles).not.toHaveBeenCalled();
      expect(mockSyncService.writeData).not.toHaveBeenCalled();
    });
  });
});