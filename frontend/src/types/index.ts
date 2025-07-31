// User types
export interface User {
  id: string;
  username: string;
  roles: string[];
  profile: UserProfile;
  isActive: boolean;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  id: string;
  userId: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  onlineStatus: 'online' | 'away' | 'busy' | 'offline';
  customStatus?: string;
  customStatusEmoji?: string;
  customStatusExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Auth types
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  password: string;
  displayName: string;
  registrationKey: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: User;
    tokens: {
      accessToken: string;
      refreshToken: string;
    };
  };
  error?: string;
}

// Channel types
export interface Channel {
  id: string;
  name: string;
  description?: string;
  type: 'text' | 'announcement' | 'discussion';
  categoryId?: string;
  isPrivate: boolean;
  position: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChannelCategory {
  id: string;
  name: string;
  position: number;
  isCollapsed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Message types
export interface Message {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  type: 'text' | 'system' | 'file';
  editedAt?: Date;
  isPinned: boolean;
  threadId?: string;
  replyToId?: string;
  attachments?: MessageAttachment[];
  reactions?: MessageReaction[];
  mentions?: string[];
  createdAt: Date;
  updatedAt: Date;
  user?: User;
}

export interface MessageAttachment {
  id: string;
  messageId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  createdAt: Date;
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  count?: number;
  createdAt: Date;
  user?: User;
}

// Role types
export interface Role {
  id: string;
  name: string;
  color: string;
  position: number;
  permissions: RolePermissions;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RolePermissions {
  // Server permissions
  manageServer: boolean;
  manageChannels: boolean;
  manageRoles: boolean;
  manageUsers: boolean;
  viewAuditLog: boolean;
  
  // Channel permissions
  viewChannels: boolean;
  sendMessages: boolean;
  sendTTSMessages: boolean;
  manageMessages: boolean;
  embedLinks: boolean;
  attachFiles: boolean;
  readMessageHistory: boolean;
  mentionEveryone: boolean;
  useExternalEmojis: boolean;
  addReactions: boolean;
  
  // Voice permissions (for future use)
  connect: boolean;
  speak: boolean;
  mute: boolean;
  deafen: boolean;
  moveMembers: boolean;
  useVAD: boolean;
  
  // Moderation permissions
  kickMembers: boolean;
  banMembers: boolean;
  moderateMessages: boolean;
  manageNicknames: boolean;
  
  // Script permissions
  viewScripts: boolean;
  editScripts: boolean;
  manageScripts: boolean;
}

// Script types
export interface Script {
  id: string;
  title: string;
  description?: string;
  version: number;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lines?: ScriptLine[];
}

export interface ScriptLine {
  id: string;
  scriptId: string;
  lineNumber: number;
  character: string;
  dialogue: string;
  lighting: string;
  audioVideo: string;
  notes: string;
  isDialogue: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
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

// Socket types
export interface SocketEvents {
  // Connection events
  connect: () => void;
  disconnect: () => void;
  
  // Message events
  'message:new': (message: Message) => void;
  'message:edit': (message: Message) => void;
  'message:delete': (messageId: string) => void;
  'message:reaction': (reaction: MessageReaction) => void;
  
  // Presence events
  'user:online': (userId: string) => void;
  'user:offline': (userId: string) => void;
  'user:status': (userId: string, status: UserProfile['onlineStatus']) => void;
  
  // Typing events
  'typing:start': (userId: string, channelId: string) => void;
  'typing:stop': (userId: string, channelId: string) => void;
}

// Form types
export interface FormErrors {
  [key: string]: string | undefined;
}

// Theme types
export interface Theme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    warning: string;
    success: string;
    info: string;
  };
}

// Navigation types
export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon?: React.ComponentType<any>;
  badge?: number;
  children?: NavigationItem[];
}