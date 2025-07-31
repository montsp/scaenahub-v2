import { ProfileService } from '../services/profile';
import { AuthService } from '../services/auth';
import { DataSyncService } from '../services/database/sync';

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

describe.skip('ProfileService', () => {
  let profileService: ProfileService;

  beforeEach(() => {
    profileService = ProfileService.getInstance();
    
    // モックをリセット
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateOnlineStatus', () => {
    it('should update user online status successfully', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        profile: {
          displayName: 'Test User',
          onlineStatus: 'offline' as const
        }
      };

      const updatedUser = {
        ...mockUser,
        profile: {
          ...mockUser.profile,
          onlineStatus: 'online' as const
        }
      };

      mockAuthService.getUserById.mockResolvedValue(mockUser as any);
      mockAuthService.updateUserProfile.mockResolvedValue(updatedUser as any);

      const result = await profileService.updateOnlineStatus('user-1', 'online');

      expect(mockAuthService.getUserById).toHaveBeenCalledWith('user-1');
      expect(mockAuthService.updateUserProfile).toHaveBeenCalledWith('user-1', {
        onlineStatus: 'online'
      });
      expect(result.profile.onlineStatus).toBe('online');
    });

    it('should throw error for non-existent user', async () => {
      mockAuthService.getUserById.mockResolvedValue(null);

      await expect(profileService.updateOnlineStatus('user-1', 'online'))
        .rejects.toThrow('User not found');
    });
  });

  describe('setCustomStatus', () => {
    it('should set custom status successfully', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        profile: {
          displayName: 'Test User',
          onlineStatus: 'online' as const
        }
      };

      const customStatus = {
        text: 'Working on project',
        emoji: '💻'
      };

      const updatedUser = {
        ...mockUser,
        profile: {
          ...mockUser.profile,
          customStatus
        }
      };

      mockAuthService.getUserById.mockResolvedValue(mockUser as any);
      mockAuthService.updateUserProfile.mockResolvedValue(updatedUser as any);

      const result = await profileService.setCustomStatus('user-1', customStatus);

      expect(mockAuthService.updateUserProfile).toHaveBeenCalledWith('user-1', {
        customStatus
      });
      expect(result.profile.customStatus).toEqual(customStatus);
    });

    it('should clear custom status when null is provided', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        profile: {
          displayName: 'Test User',
          onlineStatus: 'online' as const,
          customStatus: { text: 'Old status' }
        }
      };

      const updatedUser = {
        ...mockUser,
        profile: {
          ...mockUser.profile,
          customStatus: undefined
        }
      };

      mockAuthService.getUserById.mockResolvedValue(mockUser as any);
      mockAuthService.updateUserProfile.mockResolvedValue(updatedUser as any);

      const result = await profileService.setCustomStatus('user-1', null);

      expect(mockAuthService.updateUserProfile).toHaveBeenCalledWith('user-1', {
        customStatus: undefined
      });
      expect(result.profile.customStatus).toBeUndefined();
    });

    it('should throw error for text too long', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        profile: { displayName: 'Test User', onlineStatus: 'online' as const }
      };

      mockAuthService.getUserById.mockResolvedValue(mockUser as any);

      const longText = 'a'.repeat(101);
      const customStatus = { text: longText };

      await expect(profileService.setCustomStatus('user-1', customStatus))
        .rejects.toThrow('Custom status text must be 100 characters or less');
    });
  });

  describe('updateBio', () => {
    it('should update bio successfully', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        profile: {
          displayName: 'Test User',
          onlineStatus: 'online' as const
        }
      };

      const bio = 'This is my bio';
      const updatedUser = {
        ...mockUser,
        profile: {
          ...mockUser.profile,
          bio
        }
      };

      mockAuthService.getUserById.mockResolvedValue(mockUser as any);
      mockAuthService.updateUserProfile.mockResolvedValue(updatedUser as any);

      const result = await profileService.updateBio('user-1', bio);

      expect(mockAuthService.updateUserProfile).toHaveBeenCalledWith('user-1', { bio });
      expect(result.profile.bio).toBe(bio);
    });

    it('should throw error for bio too long', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        profile: { displayName: 'Test User', onlineStatus: 'online' as const }
      };

      mockAuthService.getUserById.mockResolvedValue(mockUser as any);

      const longBio = 'a'.repeat(501);

      await expect(profileService.updateBio('user-1', longBio))
        .rejects.toThrow('Bio must be 500 characters or less');
    });
  });

  describe('updateAvatar', () => {
    it('should update avatar successfully', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        profile: {
          displayName: 'Test User',
          onlineStatus: 'online' as const
        }
      };

      const avatarUrl = 'https://example.com/avatar.jpg';
      const updatedUser = {
        ...mockUser,
        profile: {
          ...mockUser.profile,
          avatar: avatarUrl
        }
      };

      mockAuthService.getUserById.mockResolvedValue(mockUser as any);
      mockAuthService.updateUserProfile.mockResolvedValue(updatedUser as any);

      const result = await profileService.updateAvatar('user-1', avatarUrl);

      expect(mockAuthService.updateUserProfile).toHaveBeenCalledWith('user-1', {
        avatar: avatarUrl
      });
      expect(result.profile.avatar).toBe(avatarUrl);
    });

    it('should throw error for invalid URL', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        profile: { displayName: 'Test User', onlineStatus: 'online' as const }
      };

      mockAuthService.getUserById.mockResolvedValue(mockUser as any);

      await expect(profileService.updateAvatar('user-1', 'invalid-url'))
        .rejects.toThrow('Invalid avatar URL');
    });
  });

  describe('getOnlineUsers', () => {
    it('should return online users list', () => {
      // プライベートメソッドのテストのため、実際の実装では
      // updateUserActivity を呼び出してからテストする
      profileService.updateUserActivity('user-1');
      profileService.updateUserActivity('user-2');

      const onlineUsers = profileService.getOnlineUsers();

      expect(onlineUsers).toHaveLength(2);
      expect(onlineUsers.map(u => u.userId)).toContain('user-1');
      expect(onlineUsers.map(u => u.userId)).toContain('user-2');
    });

    it('should filter out inactive users', () => {
      // 5分以上前のアクティビティをシミュレート
      const oldDate = new Date(Date.now() - 6 * 60 * 1000);
      
      // プライベートプロパティにアクセスするため、any型でキャスト
      (profileService as any).onlineUsers.set('user-1', {
        status: 'online',
        lastSeen: oldDate
      });

      const onlineUsers = profileService.getOnlineUsers();

      // 古いアクティビティのユーザーは 'away' ステータスになる
      const user1 = onlineUsers.find(u => u.userId === 'user-1');
      expect(user1?.status).toBe('away');
    });
  });

  describe('searchUsersByDisplayName', () => {
    it('should search users by display name', async () => {
      const mockUsersData = [
        {
          id: 'user-1',
          username: 'testuser1',
          display_name: 'Test User 1',
          avatar: null,
          online_status: 'online',
          roles: '["member"]'
        },
        {
          id: 'user-2',
          username: 'testuser2',
          display_name: 'Test User 2',
          avatar: 'avatar.jpg',
          online_status: 'away',
          roles: '["admin"]'
        }
      ];

      mockSyncService.readData.mockReturnValue(mockUsersData);

      const result = await profileService.searchUsersByDisplayName('Test', 10);

      expect(mockSyncService.readData).toHaveBeenCalledWith(
        'users',
        expect.stringContaining('display_name LIKE ?'),
        expect.arrayContaining(['%Test%', 'Test', 'Test%', 10])
      );

      expect(result).toHaveLength(2);
      expect(result[0]?.profile.displayName).toBe('Test User 1');
      expect(result[1]?.profile.displayName).toBe('Test User 2');
    });

    it('should throw error for short query', async () => {
      await expect(profileService.searchUsersByDisplayName('a', 10))
        .rejects.toThrow('Search query must be at least 2 characters');
    });
  });
});