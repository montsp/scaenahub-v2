import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User, UserProfile } from '../types';
import { UserModel } from '../models/User';
import { DataSyncService } from './database/sync';
import { v4 as uuidv4 } from 'uuid';

// Helper function to safely convert to Date
function safeDate(value: any): Date {
  if (!value) return new Date();
  const date = new Date(value);
  return isNaN(date.getTime()) ? new Date() : date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface TokenPayload {
  userId: string;
  username: string;
  roles: string[];
  type: 'access' | 'refresh';
}

export class AuthService {
  private static instance: AuthService;
  private syncService: DataSyncService;

  private constructor() {
    this.syncService = DataSyncService.getInstance();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  public async register(userData: {
    username: string;
    password: string;
    displayName: string;
    registrationKey: string;
  }): Promise<{ user: Omit<User, 'passwordHash'>; tokens: AuthTokens }> {
    // 登録キー検証
    if (userData.registrationKey !== process.env.REGISTRATION_KEY) {
      throw new Error('Invalid registration key');
    }

    // ユーザー名重複チェック
    const existingUsers = this.syncService.readData<any>('users', 'SELECT id FROM users WHERE username = ?', [userData.username]);
    if (existingUsers.length > 0) {
      throw new Error('Username already exists');
    }

    // ユーザー作成（UserServiceを使用）
    const createData: {
      username: string;
      displayName: string;
    } = {
      username: userData.username,
      displayName: userData.displayName
    };
    
    const user = await UserModel.create({
      ...createData,
      password: userData.password
    });

    // データベースに保存
    await this.syncService.writeData('users', 'INSERT', user.id, {
      id: user.id,
      username: user.username,
      password_hash: user.passwordHash,
      roles: JSON.stringify(user.roles),
      display_name: user.profile.displayName,
      avatar: user.profile.avatar || null,
      bio: user.profile.bio || null,
      online_status: user.profile.onlineStatus,
      custom_status: user.profile.customStatus ? JSON.stringify(user.profile.customStatus) : null,
      is_active: user.isActive,
      is_banned: user.isBanned,
      last_seen: safeDate(user.lastSeen).toISOString(),
      created_at: safeDate(user.createdAt).toISOString(),
      updated_at: safeDate(user.updatedAt).toISOString()
    });

    // トークン生成
    const tokens = this.generateTokens(user);

    // パスワードハッシュを除外してレスポンス
    const sanitizedUser = UserModel.sanitizeForResponse(user);

    return { user: sanitizedUser, tokens };
  }

  public async login(credentials: {
    username: string;
    password: string;
  }): Promise<{ user: Omit<User, 'passwordHash'>; tokens: AuthTokens }> {
    // ユーザー検索
    const users = this.syncService.readData<any>('users', 'SELECT * FROM users WHERE username = ? AND is_active = 1', [credentials.username]);
    
    if (users.length === 0) {
      throw new Error('Invalid username or password');
    }

    const userData = users[0];
    
    // パスワード検証
    const isValidPassword = await bcrypt.compare(credentials.password, userData.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid username or password');
    }

    // BANチェック
    if (userData.is_banned) {
      throw new Error('Account is banned');
    }

    // Userオブジェクトに変換
    const user: User = {
      id: userData.id,
      username: userData.username,
      passwordHash: userData.password_hash,
      roles: JSON.parse(userData.roles || '["member"]'),
      profile: {
        displayName: userData.display_name,
        avatar: userData.avatar,
        bio: userData.bio,
        onlineStatus: userData.online_status,
        customStatus: userData.custom_status ? JSON.parse(userData.custom_status) : undefined
      },
      isActive: userData.is_active,
      isBanned: userData.is_banned,
      lastSeen: new Date(userData.last_seen),
      createdAt: new Date(userData.created_at),
      updatedAt: new Date(userData.updated_at)
    };

    // 最終ログイン時刻を更新
    const updatedUser = UserModel.updateLastSeen(user);
    await this.updateUserInDatabase(updatedUser);

    // トークン生成
    const tokens = this.generateTokens(updatedUser);

    // パスワードハッシュを除外してレスポンス
    const sanitizedUser = UserModel.sanitizeForResponse(updatedUser);

    return { user: sanitizedUser, tokens };
  }

  public generateTokens(user: User): AuthTokens {
    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      throw new Error('JWT secrets not configured');
    }

    const payload: Omit<TokenPayload, 'type'> = {
      userId: user.id,
      username: user.username,
      roles: user.roles
    };

    const accessToken = (jwt.sign as any)(
      { ...payload, type: 'access' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    ) as string;

    const refreshToken = (jwt.sign as any)(
      { ...payload, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    ) as string;

    return { accessToken, refreshToken };
  }

  // テスト用のヘルパーメソッド
  public generateAccessToken(payload: {
    userId: string;
    username: string;
    roles: string[];
    type: 'access';
  }, expiresIn?: string): string {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT secret not configured');
    }

    return (jwt.sign as any)(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: expiresIn || process.env.JWT_EXPIRES_IN || '1h' }
    ) as string;
  }

  public verifyAccessToken(token: string): TokenPayload {
    try {
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT secret not configured');
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as TokenPayload;
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  public verifyRefreshToken(token: string): TokenPayload {
    try {
      if (!process.env.JWT_REFRESH_SECRET) {
        throw new Error('JWT refresh secret not configured');
      }
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET) as TokenPayload;
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  public async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    // リフレッシュトークン検証
    const payload = this.verifyRefreshToken(refreshToken);

    // ユーザー存在確認
    const users = this.syncService.readData<any>('users', 'SELECT * FROM users WHERE id = ? AND is_active = 1', [payload.userId]);
    
    if (users.length === 0) {
      throw new Error('User not found or inactive');
    }

    const userData = users[0];
    
    if (userData.is_banned) {
      throw new Error('Account is banned');
    }

    // Userオブジェクトに変換
    const user: User = {
      id: userData.id,
      username: userData.username,
      passwordHash: userData.password_hash,
      roles: JSON.parse(userData.roles || '["member"]'),
      profile: {
        displayName: userData.display_name,
        avatar: userData.avatar,
        bio: userData.bio,
        onlineStatus: userData.online_status,
        customStatus: userData.custom_status ? JSON.parse(userData.custom_status) : undefined
      },
      isActive: userData.is_active,
      isBanned: userData.is_banned,
      lastSeen: new Date(userData.last_seen),
      createdAt: new Date(userData.created_at),
      updatedAt: new Date(userData.updated_at)
    };

    // 新しいトークンを生成
    return this.generateTokens(user);
  }

  public async getUserById(userId: string): Promise<User | null> {
    const users = this.syncService.readData<any>('users', 'SELECT * FROM users_cache WHERE id = ?', [userId]);
    
    if (users.length === 0) {
      return null;
    }

    const userData = users[0];
    
    return {
      id: userData.id,
      username: userData.username,
      passwordHash: userData.password_hash,
      roles: JSON.parse(userData.roles || '["member"]'),
      profile: {
        displayName: userData.display_name,
        avatar: userData.avatar,
        bio: userData.bio,
        onlineStatus: userData.online_status,
        customStatus: userData.custom_status ? JSON.parse(userData.custom_status) : undefined
      },
      isActive: userData.is_active,
      isBanned: userData.is_banned,
      lastSeen: safeDate(userData.last_seen),
      createdAt: safeDate(userData.created_at),
      updatedAt: safeDate(userData.updated_at)
    };
  }

  public async updateUserProfile(userId: string, profileData: {
    displayName?: string;
    avatar?: string;
    bio?: string;
    onlineStatus?: User['profile']['onlineStatus'];
    customStatus?: User['profile']['customStatus'];
  }): Promise<User> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // プロフィール更新
    const updatedProfile: UserProfile = {
      ...user.profile
    };
    
    if (profileData.displayName !== undefined) {
      updatedProfile.displayName = profileData.displayName;
    }
    if (profileData.avatar !== undefined) {
      updatedProfile.avatar = profileData.avatar;
    }
    if (profileData.bio !== undefined) {
      updatedProfile.bio = profileData.bio;
    }
    if (profileData.onlineStatus !== undefined) {
      updatedProfile.onlineStatus = profileData.onlineStatus;
    }
    if (profileData.customStatus !== undefined) {
      updatedProfile.customStatus = profileData.customStatus;
    }

    const updatedUser: User = {
      ...user,
      profile: updatedProfile,
      updatedAt: new Date()
    };

    await this.updateUserInDatabase(updatedUser);
    return updatedUser;
  }

  private async updateUserInDatabase(user: User): Promise<void> {
    await this.syncService.writeData('users', 'UPDATE', user.id, {
      username: user.username,
      password_hash: user.passwordHash,
      roles: JSON.stringify(user.roles),
      display_name: user.profile.displayName,
      avatar: user.profile.avatar || null,
      bio: user.profile.bio || null,
      online_status: user.profile.onlineStatus,
      custom_status: user.profile.customStatus ? JSON.stringify(user.profile.customStatus) : null,
      is_active: user.isActive,
      is_banned: user.isBanned,
      last_seen: safeDate(user.lastSeen).toISOString(),
      updated_at: safeDate(user.updatedAt).toISOString()
    });
  }

  public async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // 現在のパスワード検証
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // 新しいパスワードをハッシュ化
    const newPasswordHash = await UserModel.hashPassword(newPassword);

    // データベース更新
    await this.syncService.writeData('users', 'UPDATE', user.id, {
      password_hash: newPasswordHash,
      updated_at: new Date().toISOString()
    });
  }
}