import { DataSyncService } from './database/sync';
import { UserService } from './user';
import { v4 as uuidv4 } from 'uuid';

export interface ModerationRule {
  id: string;
  name: string;
  type: 'word_filter' | 'spam_detection' | 'link_filter' | 'caps_filter';
  enabled: boolean;
  severity: 'low' | 'medium' | 'high';
  action: 'warn' | 'delete' | 'timeout' | 'kick' | 'ban';
  config: {
    words?: string[];
    threshold?: number;
    duration?: number; // timeout duration in minutes
    allowedDomains?: string[];
    capsPercentage?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ModerationLog {
  id: string;
  action: 'warn' | 'delete_message' | 'timeout' | 'kick' | 'ban';
  targetUserId: string;
  moderatorId: string; // 'system' for auto-moderation
  reason: string;
  ruleId?: string;
  messageId?: string;
  channelId?: string;
  metadata: {
    originalContent?: string;
    duration?: number;
    severity?: string;
    autoModeration?: boolean;
  };
  createdAt: Date;
}

export interface ModerationSettings {
  autoModerationEnabled: boolean;
  spamThreshold: number;
  capsThreshold: number;
  linkFilterEnabled: boolean;
  wordFilterEnabled: boolean;
  allowedDomains: string[];
  exemptRoles: string[];
  logRetentionDays: number;
}

export class ModerationService {
  private static instance: ModerationService;
  private syncService: DataSyncService;
  private userService: UserService;
  private settings: ModerationSettings;
  private rules: Map<string, ModerationRule> = new Map();

  constructor() {
    this.syncService = DataSyncService.getInstance();
    this.userService = UserService.getInstance();
    
    // デフォルト設定
    this.settings = {
      autoModerationEnabled: true,
      spamThreshold: 5, // 5 messages in 10 seconds
      capsThreshold: 70, // 70% caps
      linkFilterEnabled: true,
      wordFilterEnabled: true,
      allowedDomains: ['youtube.com', 'github.com', 'google.com'],
      exemptRoles: ['admin', 'moderator'],
      logRetentionDays: 30
    };
  }

  // 初期化メソッドを公開して、テストで明示的に呼び出せるようにする
  public async initialize(): Promise<void> {
    try {
      await this.loadSettings();
      await this.loadRules();
      await this.initializeDefaultRules();
    } catch (error) {
      console.error('Failed to initialize ModerationService:', error);
    }
  }

  public static getInstance(): ModerationService {
    if (!ModerationService.instance) {
      ModerationService.instance = new ModerationService();
    }
    return ModerationService.instance;
  }

  // 設定管理
  public async getSettings(): Promise<ModerationSettings> {
    return this.settings;
  }

  public async updateSettings(newSettings: Partial<ModerationSettings>): Promise<ModerationSettings> {
    this.settings = { ...this.settings, ...newSettings };
    
    await this.syncService.writeData('moderation_settings', 'UPDATE', 'default', {
      settings: JSON.stringify(this.settings),
      updated_at: new Date().toISOString()
    });

    return this.settings;
  }

  // ルール管理
  public async createRule(ruleData: Omit<ModerationRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<ModerationRule> {
    const rule: ModerationRule = {
      id: uuidv4(),
      ...ruleData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // データベースに書き込み
    try {
      await this.syncService.writeData('moderation_rules', 'INSERT', rule.id, {
        id: rule.id,
        name: rule.name,
        type: rule.type,
        enabled: rule.enabled,
        severity: rule.severity,
        action: rule.action,
        config: JSON.stringify(rule.config),
        created_at: rule.createdAt.toISOString(),
        updated_at: rule.updatedAt.toISOString()
      });

      this.rules.set(rule.id, rule);
      return rule;
    } catch (error) {
      console.error('Failed to create moderation rule:', error);
      throw error;
    }
  }

  public async updateRule(ruleId: string, updates: Partial<ModerationRule>): Promise<ModerationRule> {
    const existingRule = this.rules.get(ruleId);
    if (!existingRule) {
      throw new Error('Moderation rule not found');
    }

    const updatedRule: ModerationRule = {
      ...existingRule,
      ...updates,
      updatedAt: new Date()
    };

    await this.syncService.writeData('moderation_rules', 'UPDATE', ruleId, {
      name: updatedRule.name,
      type: updatedRule.type,
      enabled: updatedRule.enabled,
      severity: updatedRule.severity,
      action: updatedRule.action,
      config: JSON.stringify(updatedRule.config),
      updated_at: updatedRule.updatedAt.toISOString()
    });

    this.rules.set(ruleId, updatedRule);
    return updatedRule;
  }

  public async deleteRule(ruleId: string): Promise<void> {
    if (!this.rules.has(ruleId)) {
      throw new Error('Moderation rule not found');
    }

    try {
      await this.syncService.writeData('moderation_rules', 'DELETE', ruleId, {});
      this.rules.delete(ruleId);
    } catch (error) {
      console.error('Failed to delete moderation rule:', error);
      throw error;
    }
  }

  public getAllRules(): ModerationRule[] {
    return Array.from(this.rules.values());
  }

  // メッセージの自動モデレーション
  public async moderateMessage(
    messageId: string,
    content: string,
    userId: string,
    channelId: string,
    userRoles: string[]
  ): Promise<{
    allowed: boolean;
    action?: string;
    reason?: string;
    ruleId?: string;
  }> {
    if (!this.settings.autoModerationEnabled) {
      return { allowed: true };
    }

    // 免除ロールチェック
    const hasExemptRole = userRoles.some(role => this.settings.exemptRoles.includes(role));
    if (hasExemptRole) {
      return { allowed: true };
    }

    // 各ルールをチェック
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      const violation = await this.checkRule(rule, content, userId, channelId);
      if (violation.violated && violation.reason) {
        // モデレーションアクションを実行
        await this.executeAction(rule, userId, messageId, channelId, content, violation.reason);
        
        return {
          allowed: rule.action === 'warn',
          action: rule.action,
          reason: violation.reason,
          ruleId: rule.id
        };
      }
    }

    return { allowed: true };
  }

  // ルールチェック
  private async checkRule(
    rule: ModerationRule,
    content: string,
    userId: string,
    channelId: string
  ): Promise<{ violated: boolean; reason?: string }> {
    switch (rule.type) {
      case 'word_filter':
        return this.checkWordFilter(rule, content);
      
      case 'spam_detection':
        return await this.checkSpamDetection(rule, userId, channelId);
      
      case 'link_filter':
        return this.checkLinkFilter(rule, content);
      
      case 'caps_filter':
        return this.checkCapsFilter(rule, content);
      
      default:
        return { violated: false };
    }
  }

  // 単語フィルター
  private checkWordFilter(rule: ModerationRule, content: string): { violated: boolean; reason?: string } {
    const words = rule.config.words || [];
    const lowerContent = content.toLowerCase();
    
    for (const word of words) {
      if (lowerContent.includes(word.toLowerCase())) {
        return {
          violated: true,
          reason: `Message contains prohibited word: ${word}`
        };
      }
    }
    
    return { violated: false };
  }

  // スパム検出
  private async checkSpamDetection(
    rule: ModerationRule,
    userId: string,
    channelId: string
  ): Promise<{ violated: boolean; reason?: string }> {
    const threshold = rule.config.threshold || this.settings.spamThreshold;
    const timeWindow = 10000; // 10 seconds
    const now = Date.now();

    try {
      // 最近のメッセージ数をチェック
      const recentMessages = await this.syncService.readData(
        'messages',
        'SELECT COUNT(*) as count FROM messages WHERE user_id = ? AND channel_id = ? AND created_at > ?',
        [userId, channelId, new Date(now - timeWindow).toISOString()]
      );

      const messageCount = recentMessages[0]?.count || 0;
      
      if (messageCount >= threshold) {
        return {
          violated: true,
          reason: `Spam detected: ${messageCount} messages in ${timeWindow / 1000} seconds`
        };
      }
    } catch (error) {
      console.error('Failed to check spam detection:', error);
    }

    return { violated: false };
  }

  // リンクフィルター
  private checkLinkFilter(rule: ModerationRule, content: string): { violated: boolean; reason?: string } {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = content.match(urlRegex);
    
    if (!urls) return { violated: false };

    const allowedDomains = rule.config.allowedDomains || this.settings.allowedDomains;
    
    for (const url of urls) {
      try {
        const domain = new URL(url).hostname;
        const isAllowed = allowedDomains.some(allowedDomain => 
          domain === allowedDomain || domain.endsWith('.' + allowedDomain)
        );
        
        if (!isAllowed) {
          return {
            violated: true,
            reason: `Unauthorized link detected: ${domain}`
          };
        }
      } catch (error) {
        return {
          violated: true,
          reason: 'Invalid URL detected'
        };
      }
    }

    return { violated: false };
  }

  // 大文字フィルター
  private checkCapsFilter(rule: ModerationRule, content: string): { violated: boolean; reason?: string } {
    if (content.length < 10) return { violated: false }; // 短いメッセージは除外

    const threshold = rule.config.capsPercentage || this.settings.capsThreshold;
    const letters = content.replace(/[^a-zA-Z]/g, '');
    
    if (letters.length === 0) return { violated: false };

    const capsCount = content.replace(/[^A-Z]/g, '').length;
    const capsPercentage = (capsCount / letters.length) * 100;

    if (capsPercentage >= threshold) {
      return {
        violated: true,
        reason: `Excessive caps usage: ${Math.round(capsPercentage)}%`
      };
    }

    return { violated: false };
  }

  // モデレーションアクション実行
  private async executeAction(
    rule: ModerationRule,
    userId: string,
    messageId: string,
    channelId: string,
    content: string,
    reason: string
  ): Promise<void> {
    const logData: Omit<ModerationLog, 'id' | 'createdAt'> = {
      action: rule.action as any,
      targetUserId: userId,
      moderatorId: 'system',
      reason,
      ruleId: rule.id,
      messageId,
      channelId,
      metadata: {
        originalContent: content,
        severity: rule.severity,
        autoModeration: true
      }
    };

    switch (rule.action) {
      case 'warn':
        await this.warnUser(userId, reason, logData);
        break;
      
      case 'delete':
        await this.deleteMessage(messageId, logData);
        break;
      
      case 'timeout':
        const duration = rule.config.duration || 10; // 10 minutes default
        await this.timeoutUser(userId, duration, reason, logData);
        break;
      
      case 'kick':
        await this.kickUser(userId, reason, logData);
        break;
      
      case 'ban':
        await this.banUser(userId, reason, logData);
        break;
    }
  }

  // 警告
  private async warnUser(
    userId: string,
    reason: string,
    logData: Omit<ModerationLog, 'id' | 'createdAt'>
  ): Promise<void> {
    await this.createModerationLog({
      ...logData,
      action: 'warn'
    });

    // ユーザーに警告通知を送信（Socket.ioを使用）
    // 実装は省略 - 実際にはSocket.ioサービスを使用
  }

  // メッセージ削除
  private async deleteMessage(
    messageId: string,
    logData: Omit<ModerationLog, 'id' | 'createdAt'>
  ): Promise<void> {
    try {
      // メッセージを削除（システム権限で）
      await this.syncService.writeData('messages', 'DELETE', messageId, {});
      
      await this.createModerationLog({
        ...logData,
        action: 'delete_message'
      });
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  }

  // タイムアウト
  private async timeoutUser(
    userId: string,
    duration: number,
    reason: string,
    logData: Omit<ModerationLog, 'id' | 'createdAt'>
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + duration * 60 * 1000);
    
    await this.syncService.writeData('user_timeouts', 'INSERT', uuidv4(), {
      user_id: userId,
      expires_at: expiresAt.toISOString(),
      reason,
      created_at: new Date().toISOString()
    });

    await this.createModerationLog({
      ...logData,
      action: 'timeout',
      metadata: {
        ...logData.metadata,
        duration
      }
    });
  }

  // キック（一時的な書き込み禁止）
  private async kickUser(
    userId: string,
    reason: string,
    logData: Omit<ModerationLog, 'id' | 'createdAt'>
  ): Promise<void> {
    // 24時間の書き込み禁止
    await this.timeoutUser(userId, 24 * 60, reason, logData);
    
    await this.createModerationLog({
      ...logData,
      action: 'kick'
    });
  }

  // BAN（永続的な書き込み禁止）
  private async banUser(
    userId: string,
    reason: string,
    logData: Omit<ModerationLog, 'id' | 'createdAt'>
  ): Promise<void> {
    // ユーザーをBANステータスに設定
    await this.syncService.writeData('users', 'UPDATE', userId, {
      is_banned: true,
      ban_reason: reason,
      banned_at: new Date().toISOString()
    });

    await this.createModerationLog({
      ...logData,
      action: 'ban'
    });
  }

  // モデレーションログ作成
  private async createModerationLog(logData: Omit<ModerationLog, 'id' | 'createdAt'>): Promise<ModerationLog> {
    const log: ModerationLog = {
      id: uuidv4(),
      ...logData,
      createdAt: new Date()
    };

    await this.syncService.writeData('moderation_logs', 'INSERT', log.id, {
      id: log.id,
      action: log.action,
      target_user_id: log.targetUserId,
      moderator_id: log.moderatorId,
      reason: log.reason,
      rule_id: log.ruleId,
      message_id: log.messageId,
      channel_id: log.channelId,
      metadata: JSON.stringify(log.metadata),
      created_at: log.createdAt.toISOString()
    });

    return log;
  }

  // モデレーションログ取得
  public async getModerationLogs(options?: {
    targetUserId?: string;
    moderatorId?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }): Promise<ModerationLog[]> {
    let query = 'SELECT * FROM moderation_logs WHERE 1=1';
    const params: any[] = [];

    if (options?.targetUserId) {
      query += ' AND target_user_id = ?';
      params.push(options.targetUserId);
    }

    if (options?.moderatorId) {
      query += ' AND moderator_id = ?';
      params.push(options.moderatorId);
    }

    if (options?.action) {
      query += ' AND action = ?';
      params.push(options.action);
    }

    query += ' ORDER BY created_at DESC';

    if (options?.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
      
      if (options?.offset) {
        query += ' OFFSET ?';
        params.push(options.offset);
      }
    }

    const rows = await this.syncService.readData('moderation_logs', query, params);
    return rows.map(row => this.mapRowToModerationLog(row));
  }

  // ユーザーのタイムアウト状態チェック
  public async isUserTimedOut(userId: string): Promise<boolean> {
    try {
      const timeouts = await this.syncService.readData(
        'user_timeouts',
        'SELECT * FROM user_timeouts WHERE user_id = ? AND expires_at > ?',
        [userId, new Date().toISOString()]
      );

      return timeouts.length > 0;
    } catch (error) {
      console.error('Failed to check user timeout status:', error);
      return false;
    }
  }

  // 設定とルールの読み込み
  private async loadSettings(): Promise<void> {
    try {
      const rows = await this.syncService.readData(
        'moderation_settings',
        'SELECT * FROM moderation_settings WHERE id = ?',
        ['default']
      );

      if (rows.length > 0) {
        this.settings = JSON.parse(rows[0].settings);
      }
    } catch (error) {
      console.error('Failed to load moderation settings:', error);
    }
  }

  private async loadRules(): Promise<void> {
    try {
      const rows = await this.syncService.readData(
        'moderation_rules',
        'SELECT * FROM moderation_rules ORDER BY created_at ASC'
      );

      this.rules.clear();
      for (const row of rows) {
        const rule = this.mapRowToModerationRule(row);
        this.rules.set(rule.id, rule);
      }
    } catch (error) {
      console.error('Failed to load moderation rules:', error);
    }
  }

  // データマッピング
  private mapRowToModerationRule(row: any): ModerationRule {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      enabled: Boolean(row.enabled),
      severity: row.severity,
      action: row.action,
      config: JSON.parse(row.config || '{}'),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapRowToModerationLog(row: any): ModerationLog {
    return {
      id: row.id,
      action: row.action,
      targetUserId: row.target_user_id,
      moderatorId: row.moderator_id,
      reason: row.reason,
      ruleId: row.rule_id,
      messageId: row.message_id,
      channelId: row.channel_id,
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: new Date(row.created_at)
    };
  }

  // 初期化（デフォルトルールの作成）
  public async initializeDefaultRules(): Promise<void> {
    const existingRules = this.getAllRules();
    if (existingRules.length > 0) return;

    // デフォルトルールを作成
    const defaultRules: Omit<ModerationRule, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'Spam Detection',
        type: 'spam_detection',
        enabled: true,
        severity: 'medium',
        action: 'timeout',
        config: { threshold: 5, duration: 10 }
      },
      {
        name: 'Excessive Caps',
        type: 'caps_filter',
        enabled: true,
        severity: 'low',
        action: 'warn',
        config: { capsPercentage: 70 }
      },
      {
        name: 'Unauthorized Links',
        type: 'link_filter',
        enabled: true,
        severity: 'medium',
        action: 'delete',
        config: { allowedDomains: ['youtube.com', 'github.com', 'google.com'] }
      }
    ];

    for (const ruleData of defaultRules) {
      await this.createRule(ruleData);
    }
  }
}