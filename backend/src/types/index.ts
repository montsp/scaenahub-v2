// User関連の型定義
export interface User {
  id: string;
  username: string;
  passwordHash: string;
  roles: string[];
  profile: UserProfile;
  isActive: boolean;
  isBanned: boolean;
  lastSeen: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  displayName: string;
  avatar?: string;
  bio?: string;
  onlineStatus: 'online' | 'away' | 'busy' | 'offline';
  customStatus?: {
    text: string;
    emoji?: string;
    expiresAt?: Date;
  };
}

// Channel関連の型定義
export type ChannelType = 'text' | 'announcement' | 'discussion';

export interface Channel {
  id: string;
  name: string;
  description?: string;
  type: ChannelType;
  categoryId?: string;
  position: number;
  isPrivate: boolean;
  permissions: ChannelPermissions;
  allowedRoles: string[];
  allowedUsers: string[];
  settings?: ChannelSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChannelPermissions {
  viewChannel?: boolean;
  sendMessages?: boolean;
  manageMessages?: boolean;
  readHistory?: boolean;
}

export interface ChannelSettings {
  slowMode?: number;
  requireApproval?: boolean;
  autoArchive?: boolean;
  maxThreads?: number;
}

export interface Category {
  id: string;
  name: string;
  position: number;
  channels: string[];
}

// Message関連の型定義
export interface Message {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  type: 'text' | 'file' | 'system' | 'announcement';
  threadId?: string;
  parentMessageId?: string;
  mentions: Mention[];
  reactions: Reaction[];
  attachments: Attachment[];
  embeds: Embed[];
  isPinned: boolean;
  isEdited: boolean;
  editedAt?: Date;
  createdAt: Date;
  user?: User; // ユーザー情報（フロントエンド表示用）
}

export interface Mention {
  type: 'user' | 'role' | 'channel';
  id: string;
  name: string;
}

export interface Reaction {
  emoji: string;
  users: string[];
  count: number;
}

// Script関連の型定義
export interface Script {
  id: string;
  title: string;
  description?: string;
  isActive: boolean;
  permissions: ScriptPermissions;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScriptLine {
  id: string;
  scriptId: string;
  lineNumber: number;
  characterName: string;
  dialogue: string;
  lighting: string;
  audioVideo: string;
  notes: string;
  formatting: ScriptFormatting;
  lastEditedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScriptPermissions {
  viewRoles: string[];
  editRoles: string[];
  viewUsers: string[];
  editUsers: string[];
}

export interface ScriptFormatting {
  bold: boolean;
  underline: boolean;
  italic: boolean;
  color: string;
}

// 脚本編集履歴・バージョン管理
export interface ScriptVersion {
  id: string;
  scriptId: string;
  version: number;
  title: string;
  description: string | undefined;
  changeDescription: string;
  createdBy: string;
  createdAt: Date;
}

export interface ScriptLineHistory {
  id: string;
  scriptLineId: string;
  scriptId: string;
  lineNumber: number;
  characterName: string;
  dialogue: string;
  lighting: string;
  audioVideo: string;
  notes: string;
  formatting: ScriptFormatting;
  changeType: 'create' | 'update' | 'delete';
  changeDescription: string | undefined;
  editedBy: string;
  editedAt: Date;
}

// 同時編集制御
export interface ScriptLock {
  id: string;
  scriptId: string;
  lineNumber: number | undefined; // 行レベルのロック（nullの場合は脚本全体）
  lockedBy: string;
  lockedAt: Date;
  expiresAt: Date;
}

export interface ScriptEditSession {
  id: string;
  scriptId: string;
  userId: string;
  userName: string;
  startedAt: Date;
  lastActivity: Date;
  isActive: boolean;
}

// 場面分割機能
export interface ScriptScene {
  id: string;
  scriptId: string;
  sceneNumber: number;
  title: string;
  description: string | undefined;
  startLineNumber: number;
  endLineNumber: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// 印刷最適化
export interface ScriptPrintSettings {
  id: string;
  scriptId: string;
  pageSize: 'A4' | 'A5' | 'Letter';
  orientation: 'portrait' | 'landscape';
  fontSize: number;
  lineSpacing: number;
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  includeNotes: boolean;
  includeLighting: boolean;
  includeAudioVideo: boolean;
  sceneBreaks: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  googleDriveId: string;
  url: string;
}

export interface Embed {
  type: 'link' | 'image' | 'video';
  url: string;
  title?: string;
  description?: string;
  thumbnail?: string;
}

// Role関連の型定義
export interface Role {
  id: string;
  name: string;
  color: string;
  position: number;
  permissions: RolePermissions;
  isDefault: boolean;
  mentionable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RolePermissions {
  // サーバー管理
  manageServer: boolean;
  manageChannels: boolean;
  manageRoles: boolean;
  manageUsers: boolean;
  
  // チャンネル権限
  viewChannels: boolean;
  sendMessages: boolean;
  sendFiles: boolean;
  embedLinks: boolean;
  mentionEveryone: boolean;
  
  // メッセージ管理
  manageMessages: boolean;
  pinMessages: boolean;
  readMessageHistory: boolean;
  
  // モデレーション
  kickMembers: boolean;
  banMembers: boolean;
  moderateMessages: boolean;
}

// API関連の型定義
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

