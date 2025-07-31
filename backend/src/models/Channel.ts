import { Channel, ChannelType, ChannelPermissions, ChannelSettings } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class ChannelModel {
  public static validate(channelData: Partial<Channel>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // チャンネル名検証
    if (!channelData.name) {
      errors.push('Channel name is required');
    } else if (channelData.name.length < 1 || channelData.name.length > 100) {
      errors.push('Channel name must be between 1 and 100 characters');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(channelData.name)) {
      errors.push('Channel name can only contain letters, numbers, underscores, and hyphens');
    }

    // 説明検証
    if (channelData.description && channelData.description.length > 500) {
      errors.push('Channel description must be 500 characters or less');
    }

    // タイプ検証
    if (channelData.type && !['text', 'announcement', 'discussion'].includes(channelData.type)) {
      errors.push('Invalid channel type');
    }

    // 許可されたロール検証
    if (channelData.allowedRoles && !Array.isArray(channelData.allowedRoles)) {
      errors.push('Allowed roles must be an array');
    }

    // 許可されたユーザー検証
    if (channelData.allowedUsers && !Array.isArray(channelData.allowedUsers)) {
      errors.push('Allowed users must be an array');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  public static create(channelData: {
    name: string;
    description?: string;
    type: ChannelType;
    categoryId?: string;
    position?: number;
    isPrivate?: boolean;
    permissions?: Partial<ChannelPermissions>;
    allowedRoles?: string[];
    allowedUsers?: string[];
    settings?: Partial<ChannelSettings>;
  }): Channel {
    const now = new Date();
    
    const defaultPermissions: ChannelPermissions = {
      viewChannel: true,
      sendMessages: true,
      manageMessages: false,
      readHistory: true
    };

    const channel: Channel = {
      id: uuidv4(),
      name: channelData.name,
      type: channelData.type,
      position: channelData.position || 0,
      isPrivate: channelData.isPrivate || false,
      permissions: { ...defaultPermissions, ...channelData.permissions },
      allowedRoles: channelData.allowedRoles || [],
      allowedUsers: channelData.allowedUsers || [],
      settings: channelData.settings || {},
      createdAt: now,
      updatedAt: now
    };
    
    if (channelData.description) {
      channel.description = channelData.description;
    }
    
    if (channelData.categoryId) {
      channel.categoryId = channelData.categoryId;
    }
    
    const validation = ChannelModel.validate(channel);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    return channel;
  }
}