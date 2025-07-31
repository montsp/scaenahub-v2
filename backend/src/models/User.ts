import { User, UserProfile } from '../types';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

export class UserModel {
  public static validate(userData: Partial<User>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // ユーザー名検証
    if (!userData.username) {
      errors.push('Username is required');
    } else if (userData.username.length < 3 || userData.username.length > 50) {
      errors.push('Username must be between 3 and 50 characters');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(userData.username)) {
      errors.push('Username can only contain letters, numbers, underscores, and hyphens');
    }

    // パスワード検証（新規作成時）
    if (userData.passwordHash === undefined && !userData.id) {
      errors.push('Password is required');
    }



    // プロフィール検証
    if (userData.profile) {
      const profileErrors = UserModel.validateProfile(userData.profile);
      errors.push(...profileErrors);
    }

    // ロール検証
    if (userData.roles && !Array.isArray(userData.roles)) {
      errors.push('Roles must be an array');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  public static validateProfile(profile: Partial<UserProfile>): string[] {
    const errors: string[] = [];

    // 表示名検証
    if (!profile.displayName) {
      errors.push('Display name is required');
    } else if (profile.displayName.length < 1 || profile.displayName.length > 100) {
      errors.push('Display name must be between 1 and 100 characters');
    }

    // 自己紹介文検証
    if (profile.bio && profile.bio.length > 500) {
      errors.push('Bio must be 500 characters or less');
    }

    // オンラインステータス検証
    if (profile.onlineStatus && !['online', 'away', 'busy', 'offline'].includes(profile.onlineStatus)) {
      errors.push('Invalid online status');
    }

    // カスタムステータス検証
    if (profile.customStatus) {
      if (profile.customStatus.text && profile.customStatus.text.length > 100) {
        errors.push('Custom status text must be 100 characters or less');
      }
      if (profile.customStatus.emoji && profile.customStatus.emoji.length > 10) {
        errors.push('Custom status emoji is too long');
      }
    }

    return errors;
  }

  public static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  public static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  public static create(userData: {
    username: string;
    password: string;
    displayName: string;
    roles?: string[];
  }): Promise<User> {
    return new Promise(async (resolve, reject) => {
      try {
        const passwordHash = await UserModel.hashPassword(userData.password);
        const now = new Date();

        const user: User = {
          id: uuidv4(),
          username: userData.username,
          passwordHash,
          roles: userData.roles || ['member'],
          profile: {
            displayName: userData.displayName,
            onlineStatus: 'offline'
          },
          isActive: true,
          isBanned: false,
          lastSeen: now,
          createdAt: now,
          updatedAt: now
        };
        


        const validation = UserModel.validate(user);
        if (!validation.isValid) {
          reject(new Error(`Validation failed: ${validation.errors.join(', ')}`));
          return;
        }

        resolve(user);
      } catch (error) {
        reject(error);
      }
    });
  }

  public static sanitizeForResponse(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  public static updateLastSeen(user: User): User {
    return {
      ...user,
      lastSeen: new Date(),
      updatedAt: new Date()
    };
  }

  public static updateOnlineStatus(user: User, status: UserProfile['onlineStatus']): User {
    return {
      ...user,
      profile: {
        ...user.profile,
        onlineStatus: status
      },
      lastSeen: new Date(),
      updatedAt: new Date()
    };
  }

  public static updateCustomStatus(user: User, customStatus?: UserProfile['customStatus']): User {
    const updatedProfile: UserProfile = {
      ...user.profile
    };
    
    if (customStatus) {
      updatedProfile.customStatus = customStatus;
    }
    
    return {
      ...user,
      profile: updatedProfile,
      updatedAt: new Date()
    };
  }
}