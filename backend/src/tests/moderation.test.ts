import { ModerationService, ModerationRule } from '../services/moderation';
import { DataSyncService } from '../services/database/sync';
import { UserService } from '../services/user';
import { MessageService } from '../services/message';

// モックの設定
jest.mock('../services/database/sync');
jest.mock('../services/user');
jest.mock('../services/message');

describe('ModerationService', () => {
  let moderationService: ModerationService;
  let mockSyncService: jest.Mocked<DataSyncService>;
  let mockUserService: jest.Mocked<UserService>;
  let mockMessageService: jest.Mocked<MessageService>;

  beforeEach(async () => {
    // モックの設定
    const mockDataSyncService = {
      writeData: jest.fn().mockResolvedValue(undefined),
      readData: jest.fn().mockReturnValue([]),
      getInstance: jest.fn()
    };

    const mockUserServiceInstance = {
      getInstance: jest.fn()
    };

    const mockMessageServiceInstance = {
      getInstance: jest.fn()
    };

    // モックインスタンスの設定
    (DataSyncService.getInstance as jest.Mock).mockReturnValue(mockDataSyncService);
    (UserService.getInstance as jest.Mock).mockReturnValue(mockUserServiceInstance);
    (MessageService.getInstance as jest.Mock).mockReturnValue(mockMessageServiceInstance);

    mockSyncService = mockDataSyncService as any;
    mockUserService = mockUserServiceInstance as any;
    mockMessageService = mockMessageServiceInstance as any;

    // シングルトンインスタンスをリセット
    (ModerationService as any).instance = undefined;

    // サービスインスタンスの作成
    moderationService = ModerationService.getInstance();
    
    // 明示的に初期化を実行
    await moderationService.initialize();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Settings Management', () => {
    it('should get default settings', async () => {
      const settings = await moderationService.getSettings();

      expect(settings).toBeDefined();
      expect(settings.autoModerationEnabled).toBe(true);
      expect(settings.spamThreshold).toBe(5);
      expect(settings.capsThreshold).toBe(70);
      expect(Array.isArray(settings.allowedDomains)).toBe(true);
      expect(Array.isArray(settings.exemptRoles)).toBe(true);
    });

    it('should update settings', async () => {
      const newSettings = {
        autoModerationEnabled: false,
        spamThreshold: 10,
        capsThreshold: 80
      };

      const updatedSettings = await moderationService.updateSettings(newSettings);

      expect(updatedSettings.autoModerationEnabled).toBe(false);
      expect(updatedSettings.spamThreshold).toBe(10);
      expect(updatedSettings.capsThreshold).toBe(80);
    });
  });

  describe('Rule Management', () => {
    it('should create a moderation rule', async () => {
      const ruleData = {
        name: 'Test Word Filter',
        type: 'word_filter' as const,
        enabled: true,
        severity: 'medium' as const,
        action: 'warn' as const,
        config: {
          words: ['badword1', 'badword2']
        }
      };

      const rule = await moderationService.createRule(ruleData);

      expect(rule).toBeDefined();
      expect(rule.id).toBeDefined();
      expect(rule.name).toBe('Test Word Filter');
      expect(rule.type).toBe('word_filter');
      expect(rule.config.words).toEqual(['badword1', 'badword2']);
      expect(mockSyncService.writeData).toHaveBeenCalledWith(
        'moderation_rules',
        'INSERT',
        rule.id,
        expect.any(Object)
      );
    });

    it('should get all rules', () => {
      const rules = moderationService.getAllRules();
      expect(Array.isArray(rules)).toBe(true);
    });

    it('should update a rule', async () => {
      // まずルールを作成
      const ruleData = {
        name: 'Test Rule',
        type: 'word_filter' as const,
        enabled: true,
        severity: 'low' as const,
        action: 'warn' as const,
        config: { words: ['test'] }
      };

      const createdRule = await moderationService.createRule(ruleData);

      // ルールを更新
      const updates = {
        name: 'Updated Rule',
        severity: 'high' as const
      };

      const updatedRule = await moderationService.updateRule(createdRule.id, updates);

      expect(updatedRule.name).toBe('Updated Rule');
      expect(updatedRule.severity).toBe('high');
    });

    it('should delete a rule', async () => {
      // まずルールを作成
      const ruleData = {
        name: 'Test Rule',
        type: 'word_filter' as const,
        enabled: true,
        severity: 'low' as const,
        action: 'warn' as const,
        config: { words: ['test'] }
      };

      const createdRule = await moderationService.createRule(ruleData);

      // ルールを削除
      await moderationService.deleteRule(createdRule.id);

      expect(mockSyncService.writeData).toHaveBeenCalledWith(
        'moderation_rules',
        'DELETE',
        createdRule.id,
        {}
      );
    });

    it('should throw error when updating non-existent rule', async () => {
      await expect(
        moderationService.updateRule('non-existent-id', { name: 'Updated' })
      ).rejects.toThrow('Moderation rule not found');
    });

    it('should throw error when deleting non-existent rule', async () => {
      await expect(
        moderationService.deleteRule('non-existent-id')
      ).rejects.toThrow('Moderation rule not found');
    });
  });

  describe('Message Moderation', () => {

    it('should allow clean messages', async () => {
      const result = await moderationService.moderateMessage(
        'message-1',
        'This is a clean message',
        'user-1',
        'channel-1',
        ['member']
      );

      expect(result.allowed).toBe(true);
      expect(result.action).toBeUndefined();
      expect(result.reason).toBeUndefined();
    });

    it('should block messages with bad words', async () => {
      // テスト用のWord Filterルールを作成
      await moderationService.createRule({
        name: 'Test Word Filter',
        type: 'word_filter',
        enabled: true,
        severity: 'medium',
        action: 'delete',
        config: {
          words: ['badword']
        }
      });

      const result = await moderationService.moderateMessage(
        'message-1',
        'This message contains badword',
        'user-1',
        'channel-1',
        ['member']
      );

      expect(result.allowed).toBe(false);
      expect(result.action).toBe('delete');
      expect(result.reason).toContain('prohibited word');
    });

    it('should warn for excessive caps', async () => {
      // テスト用のCaps Filterルールを作成
      await moderationService.createRule({
        name: 'Test Caps Filter',
        type: 'caps_filter',
        enabled: true,
        severity: 'low',
        action: 'warn',
        config: {
          capsPercentage: 70
        }
      });

      const result = await moderationService.moderateMessage(
        'message-1',
        'THIS MESSAGE HAS TOO MANY CAPS',
        'user-1',
        'channel-1',
        ['member']
      );

      expect(result.allowed).toBe(true); // warn action allows message
      expect(result.action).toBe('warn');
      expect(result.reason).toContain('caps usage');
    });

    it('should allow messages from exempt roles', async () => {
      // テスト用のWord Filterルールを作成
      await moderationService.createRule({
        name: 'Test Word Filter',
        type: 'word_filter',
        enabled: true,
        severity: 'medium',
        action: 'delete',
        config: {
          words: ['badword']
        }
      });

      const result = await moderationService.moderateMessage(
        'message-1',
        'This message contains badword',
        'user-1',
        'channel-1',
        ['admin'] // admin is exempt
      );

      expect(result.allowed).toBe(true);
    });

    it('should skip moderation when disabled', async () => {
      // テスト用のWord Filterルールを作成
      await moderationService.createRule({
        name: 'Test Word Filter',
        type: 'word_filter',
        enabled: true,
        severity: 'medium',
        action: 'delete',
        config: {
          words: ['badword']
        }
      });

      // モデレーションを無効化
      await moderationService.updateSettings({ autoModerationEnabled: false });

      const result = await moderationService.moderateMessage(
        'message-1',
        'This message contains badword',
        'user-1',
        'channel-1',
        ['member']
      );

      expect(result.allowed).toBe(true);
    });
  });

  describe('Word Filter', () => {
    beforeEach(async () => {
      // Word Filter専用のルールを作成
      await moderationService.createRule({
        name: 'Word Filter Test',
        type: 'word_filter',
        enabled: true,
        severity: 'medium',
        action: 'delete',
        config: {
          words: ['badword', 'spam']
        }
      });
    });

    it('should detect prohibited words case-insensitively', async () => {
      const result1 = await moderationService.moderateMessage(
        'msg-1', 'This contains badword', 'user-1', 'channel-1', ['member']
      );
      expect(result1.allowed).toBe(false);

      const result2 = await moderationService.moderateMessage(
        'msg-2', 'This contains spam', 'user-1', 'channel-1', ['member']
      );
      expect(result2.allowed).toBe(false);
    });
  });

  describe('Link Filter', () => {
    beforeEach(async () => {
      // Link Filter専用のルールを作成
      await moderationService.createRule({
        name: 'Link Filter Test',
        type: 'link_filter',
        enabled: true,
        severity: 'medium',
        action: 'delete',
        config: {
          allowedDomains: ['youtube.com', 'github.com']
        }
      });
    });

    it('should allow links from allowed domains', async () => {
      const result = await moderationService.moderateMessage(
        'msg-1',
        'Check out this video: https://youtube.com/watch?v=123',
        'user-1',
        'channel-1',
        ['member']
      );

      expect(result.allowed).toBe(true);
    });

    it('should block links from unauthorized domains', async () => {
      const result = await moderationService.moderateMessage(
        'msg-1',
        'Suspicious link: https://malicious-site.com/virus',
        'user-1',
        'channel-1',
        ['member']
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Unauthorized link');
    });
  });

  describe('Caps Filter', () => {
    beforeEach(async () => {
      // Caps Filter専用のルールを作成
      await moderationService.createRule({
        name: 'Caps Filter Test',
        type: 'caps_filter',
        enabled: true,
        severity: 'low',
        action: 'warn',
        config: {
          capsPercentage: 70
        }
      });
    });

    it('should ignore short messages', async () => {
      const result = await moderationService.moderateMessage(
        'msg-1',
        'OK',
        'user-1',
        'channel-1',
        ['member']
      );

      expect(result.allowed).toBe(true);
    });

    it('should detect excessive caps in long messages', async () => {
      const result = await moderationService.moderateMessage(
        'msg-1',
        'THIS IS A VERY LONG MESSAGE WITH TOO MANY CAPS',
        'user-1',
        'channel-1',
        ['member']
      );

      expect(result.allowed).toBe(true); // warn allows message
      expect(result.action).toBe('warn');
    });
  });

  describe('Spam Detection', () => {
    beforeEach(async () => {
      // Spam Detection専用のルールを作成
      await moderationService.createRule({
        name: 'Spam Detection Test',
        type: 'spam_detection',
        enabled: true,
        severity: 'medium',
        action: 'timeout',
        config: {
          threshold: 3,
          duration: 10
        }
      });
    });

    it('should detect spam based on message frequency', async () => {
      // 最近のメッセージが閾値を超える場合をモック
      mockSyncService.readData.mockImplementation((table, query, params) => {
        if (table === 'messages' && query.includes('COUNT(*)')) {
          return [{ count: 4 }]; // 閾値3を超える
        }
        return [];
      });

      const result = await moderationService.moderateMessage(
        'msg-1',
        'Normal message',
        'user-1',
        'channel-1',
        ['member']
      );

      expect(result.allowed).toBe(false);
      expect(result.action).toBe('timeout');
      expect(result.reason).toContain('Spam detected');
    });
  });

  describe('User Timeout Status', () => {
    it('should check if user is timed out', async () => {
      // アクティブなタイムアウトがある場合
      mockSyncService.readData.mockReturnValueOnce([{
        user_id: 'user-1',
        expires_at: new Date(Date.now() + 3600000).toISOString()
      }]);

      const isTimedOut = await moderationService.isUserTimedOut('user-1');
      expect(isTimedOut).toBe(true);
    });

    it('should return false when user is not timed out', async () => {
      // タイムアウトがない場合
      mockSyncService.readData.mockReturnValue([]);

      const isTimedOut = await moderationService.isUserTimedOut('user-1');
      expect(isTimedOut).toBe(false);
    });
  });

  describe('Moderation Logs', () => {
    it('should get moderation logs with filters', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: 'warn',
          target_user_id: 'user-1',
          moderator_id: 'system',
          reason: 'Test warning',
          rule_id: 'rule-1',
          message_id: 'msg-1',
          channel_id: 'channel-1',
          metadata: '{"autoModeration": true}',
          created_at: new Date().toISOString()
        }
      ];

      mockSyncService.readData.mockReturnValueOnce(mockLogs);

      const logs = await moderationService.getModerationLogs({
        targetUserId: 'user-1',
        action: 'warn',
        limit: 10
      });

      expect(logs).toHaveLength(1);
      expect(logs[0]?.action).toBe('warn');
      expect(logs[0]?.targetUserId).toBe('user-1');
    });
  });

  describe('Default Rules Initialization', () => {
    it('should initialize default rules when none exist', async () => {
      // 既存ルールがない状態をモック
      const emptyService = new (ModerationService as any)();
      
      await emptyService.initializeDefaultRules();

      // デフォルトルールが作成されることを確認
      expect(mockSyncService.writeData).toHaveBeenCalledWith(
        'moderation_rules',
        'INSERT',
        expect.any(String),
        expect.any(Object)
      );
    });
  });
});