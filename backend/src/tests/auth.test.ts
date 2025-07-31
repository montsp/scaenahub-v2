import { AuthService } from '../services/auth';
import { UserModel } from '../models/User';
import { DataSyncService } from '../services/database/sync';

// モック設定
jest.mock('../services/database/sync');
jest.mock('../models/User');

describe.skip('AuthService', () => {
  let authService: AuthService;
  let mockSyncService: jest.Mocked<DataSyncService>;

  beforeEach(() => {
    authService = AuthService.getInstance();
    mockSyncService = DataSyncService.getInstance() as jest.Mocked<DataSyncService>;
    
    // 環境変数設定
    process.env.REGISTRATION_KEY = 'test-key';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      // モック設定
      mockSyncService.readData.mockReturnValue([]); // ユーザー名重複なし
      
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        passwordHash: 'hashed-password',
        roles: ['member'],
        profile: {
          displayName: 'Test User',
          onlineStatus: 'offline' as const
        },
        isActive: true,
        isBanned: false,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (UserModel.create as jest.Mock).mockResolvedValue(mockUser);
      mockSyncService.writeData.mockResolvedValue(undefined);

      const userData = {
        username: 'testuser',
        password: 'password123',
        displayName: 'Test User',
        registrationKey: 'test-key'
      };

      const result = await authService.register(userData);

      expect(result.user.username).toBe('testuser');
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(mockSyncService.writeData).toHaveBeenCalledWith('users', 'INSERT', 'user-1', expect.any(Object));
    });

    it('should throw error for invalid registration key', async () => {
      const userData = {
        username: 'testuser',
        password: 'password123',
        displayName: 'Test User',
        registrationKey: 'invalid-key'
      };

      await expect(authService.register(userData)).rejects.toThrow('Invalid registration key');
    });

    it('should throw error for duplicate username', async () => {
      mockSyncService.readData.mockReturnValue([{ id: 'existing-user' }]);

      const userData = {
        username: 'testuser',
        password: 'password123',
        displayName: 'Test User',
        registrationKey: 'test-key'
      };

      await expect(authService.register(userData)).rejects.toThrow('Username already exists');
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const mockUserData = {
        id: 'user-1',
        username: 'testuser',
        password_hash: 'hashed-password',
        roles: '["member"]',
        display_name: 'Test User',
        online_status: 'offline',
        is_active: 1,
        is_banned: 0,
        last_seen: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      mockSyncService.readData.mockReturnValue([mockUserData]);
      (UserModel.updateLastSeen as jest.Mock).mockReturnValue({
        ...mockUserData,
        lastSeen: new Date(),
        updatedAt: new Date()
      });
      mockSyncService.writeData.mockResolvedValue(undefined);

      // bcrypt.compare のモック
      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const credentials = {
        username: 'testuser',
        password: 'password123'
      };

      const result = await authService.login(credentials);

      expect(result.user.username).toBe('testuser');
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    it('should throw error for invalid credentials', async () => {
      mockSyncService.readData.mockReturnValue([]);

      const credentials = {
        username: 'testuser',
        password: 'wrongpassword'
      };

      await expect(authService.login(credentials)).rejects.toThrow('Invalid username or password');
    });

    it('should throw error for banned user', async () => {
      const mockUserData = {
        id: 'user-1',
        username: 'testuser',
        password_hash: 'hashed-password',
        is_active: 1,
        is_banned: 1
      };

      mockSyncService.readData.mockReturnValue([mockUserData]);

      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const credentials = {
        username: 'testuser',
        password: 'password123'
      };

      await expect(authService.login(credentials)).rejects.toThrow('Account is banned');
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', () => {
      const payload = {
        userId: 'user-1',
        username: 'testuser',
        roles: ['member'],
        type: 'access' as const
      };

      const token = authService.generateTokens({
        id: 'user-1',
        username: 'testuser',
        roles: ['member']
      } as any).accessToken;

      const result = authService.verifyAccessToken(token);

      expect(result.userId).toBe('user-1');
      expect(result.username).toBe('testuser');
      expect(result.type).toBe('access');
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        authService.verifyAccessToken('invalid-token');
      }).toThrow('Invalid or expired access token');
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens successfully', async () => {
      const mockUserData = {
        id: 'user-1',
        username: 'testuser',
        roles: '["member"]',
        display_name: 'Test User',
        is_active: 1,
        is_banned: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_seen: new Date().toISOString()
      };

      mockSyncService.readData.mockReturnValue([mockUserData]);

      const originalTokens = authService.generateTokens({
        id: 'user-1',
        username: 'testuser',
        roles: ['member']
      } as any);

      const newTokens = await authService.refreshTokens(originalTokens.refreshToken);

      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();
      expect(newTokens.accessToken).not.toBe(originalTokens.accessToken);
    });

    it('should throw error for invalid refresh token', async () => {
      await expect(authService.refreshTokens('invalid-token')).rejects.toThrow('Invalid or expired refresh token');
    });
  });
});