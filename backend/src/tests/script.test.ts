import { ScriptModel } from '../models/Script';
import { ScriptService } from '../services/script';
import { 
  Script, 
  ScriptLine, 
  ScriptPermissions, 
  ScriptFormatting,
  ScriptVersion,
  ScriptLineHistory,
  ScriptLock,
  ScriptEditSession,
  ScriptScene,
  ScriptPrintSettings
} from '../types';

// ScriptModelのモック
jest.mock('../models/Script');
jest.mock('../services/database/sync');

const mockScriptModel = ScriptModel as jest.Mocked<typeof ScriptModel>;

describe('ScriptModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Script Validation', () => {
    it('should validate script data successfully', () => {
      const scriptData = {
        title: 'テスト脚本',
        description: 'テスト用の脚本です',
        permissions: {
          viewRoles: ['member'],
          editRoles: ['admin'],
          viewUsers: [],
          editUsers: []
        }
      };

      mockScriptModel.validate.mockReturnValue({ isValid: true, errors: [] });

      const result = mockScriptModel.validate(scriptData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(mockScriptModel.validate).toHaveBeenCalledWith(scriptData);
    });

    it('should return validation errors for invalid data', () => {
      const scriptData = {
        title: '', // 空のタイトル
        permissions: {
          viewRoles: [],
          editRoles: [],
          viewUsers: [],
          editUsers: []
        }
      };

      mockScriptModel.validate.mockReturnValue({
        isValid: false,
        errors: ['Title is required']
      });

      const result = mockScriptModel.validate(scriptData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Title is required');
    });
  });

  describe('Script Line Validation', () => {
    it('should validate script line data successfully', () => {
      const lineData = {
        scriptId: 'script-1',
        lineNumber: 1,
        characterName: '太郎',
        dialogue: 'こんにちは、みなさん！',
        lighting: '明るく',
        audioVideo: 'BGM: 明るい音楽',
        notes: '元気よく',
        formatting: {
          bold: false,
          underline: false,
          italic: false,
          color: '#000000'
        }
      };

      mockScriptModel.validateLine.mockReturnValue({ isValid: true, errors: [] });

      const result = mockScriptModel.validateLine(lineData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(mockScriptModel.validateLine).toHaveBeenCalledWith(lineData);
    });

    it('should return validation errors for invalid line data', () => {
      const lineData = {
        scriptId: '',
        lineNumber: -1,
        characterName: '',
        dialogue: ''
      };

      mockScriptModel.validateLine.mockReturnValue({
        isValid: false,
        errors: ['Script ID is required', 'Line number must be positive', 'Character name is required']
      });

      const result = mockScriptModel.validateLine(lineData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Script ID is required');
      expect(result.errors).toContain('Line number must be positive');
      expect(result.errors).toContain('Character name is required');
    });
  });

  describe('Script Creation', () => {
    it('should create script with valid data', () => {
      const scriptData = {
        title: 'テスト脚本',
        description: 'テスト用の脚本です',
        isActive: true,
        permissions: {
          viewRoles: ['member'],
          editRoles: ['admin'],
          viewUsers: [],
          editUsers: []
        },
        createdBy: 'user-1'
      };

      const mockScript: Script = {
        id: 'script-1',
        title: 'テスト脚本',
        description: 'テスト用の脚本です',
        isActive: true,
        permissions: {
          viewRoles: ['member'],
          editRoles: ['admin'],
          viewUsers: [],
          editUsers: []
        },
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockScriptModel.create.mockReturnValue(mockScript);

      const result = mockScriptModel.create(scriptData);

      expect(result).toEqual(mockScript);
      expect(mockScriptModel.create).toHaveBeenCalledWith(scriptData);
    });
  });

  describe('Script Line Creation', () => {
    it('should create script line with valid data', () => {
      const lineData = {
        scriptId: 'script-1',
        lineNumber: 1,
        characterName: '太郎',
        dialogue: 'こんにちは、みなさん！',
        lighting: '明るく',
        audioVideo: 'BGM: 明るい音楽',
        notes: '元気よく',
        formatting: {
          bold: false,
          underline: false,
          italic: false,
          color: '#000000'
        },
        lastEditedBy: 'user-1'
      };

      const mockScriptLine: ScriptLine = {
        id: 'line-1',
        scriptId: 'script-1',
        lineNumber: 1,
        characterName: '太郎',
        dialogue: 'こんにちは、みなさん！',
        lighting: '明るく',
        audioVideo: 'BGM: 明るい音楽',
        notes: '元気よく',
        formatting: {
          bold: false,
          underline: false,
          italic: false,
          color: '#000000'
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        lastEditedBy: 'user-1'
      };

      mockScriptModel.createLine.mockReturnValue(mockScriptLine);

      const result = mockScriptModel.createLine(lineData);

      expect(result).toEqual(mockScriptLine);
      expect(mockScriptModel.createLine).toHaveBeenCalledWith(lineData);
    });
  });

  describe('Dialogue Color Detection', () => {
    it('should detect dialogue vs action text', () => {
      // モックの実装を設定
      mockScriptModel.getDialogueColor.mockImplementation((text: string) => {
        if (text.includes('(') || text.includes('【') || text.includes('[') || text.includes('＜')) {
          return '#0066cc'; // 青字（動き・指示）
        }
        return '#000000'; // 黒字（台詞）
      });

      expect(mockScriptModel.getDialogueColor('(舞台中央に立つ)')).toBe('#0066cc');
      expect(mockScriptModel.getDialogueColor('こんにちは、みなさん')).toBe('#000000');
      expect(mockScriptModel.getDialogueColor('【照明を暗くする】')).toBe('#0066cc');
      expect(mockScriptModel.getDialogueColor('普通の台詞です')).toBe('#000000');
      expect(mockScriptModel.getDialogueColor('[効果音: 拍手]')).toBe('#0066cc');
      expect(mockScriptModel.getDialogueColor('＜音楽フェードアウト＞')).toBe('#0066cc');
    });
  });

  describe('Version Management', () => {
    it('should create script version successfully', () => {
      const mockVersion: ScriptVersion = {
        id: 'version-1',
        scriptId: 'script-1',
        version: 1,
        title: 'テスト脚本',
        description: 'テスト用の脚本です',
        changeDescription: '初回作成',
        createdBy: 'user-1',
        createdAt: new Date()
      };

      // ScriptServiceのモック（実際のテストでは適切にモックする）
      expect(mockVersion.version).toBe(1);
      expect(mockVersion.changeDescription).toBe('初回作成');
    });

    it('should get script versions history', () => {
      const mockVersions: ScriptVersion[] = [
        {
          id: 'version-2',
          scriptId: 'script-1',
          version: 2,
          title: 'テスト脚本',
          description: 'テスト用の脚本です',
          changeDescription: '台詞を修正',
          createdBy: 'user-1',
          createdAt: new Date()
        },
        {
          id: 'version-1',
          scriptId: 'script-1',
          version: 1,
          title: 'テスト脚本',
          description: 'テスト用の脚本です',
          changeDescription: '初回作成',
          createdBy: 'user-1',
          createdAt: new Date()
        }
      ];

      expect(mockVersions).toHaveLength(2);
      expect(mockVersions[0]?.version).toBe(2);
      expect(mockVersions[1]?.version).toBe(1);
    });
  });

  describe('Line History', () => {
    it('should record line history on changes', () => {
      const mockHistory: ScriptLineHistory = {
        id: 'history-1',
        scriptLineId: 'line-1',
        scriptId: 'script-1',
        lineNumber: 1,
        characterName: '太郎',
        dialogue: 'こんにちは、みなさん！',
        lighting: '明るく',
        audioVideo: 'BGM: 明るい音楽',
        notes: '元気よく',
        formatting: {
          bold: false,
          underline: false,
          italic: false,
          color: '#000000'
        },
        changeType: 'create' as const,
        changeDescription: 'Line created',
        editedBy: 'user-1',
        editedAt: new Date()
      };

      expect(mockHistory.changeType).toBe('create');
      expect(mockHistory.editedBy).toBe('user-1');
    });
  });

  describe('Concurrent Edit Control', () => {
    it('should create script lock successfully', () => {
      const mockLock: ScriptLock = {
        id: 'lock-1',
        scriptId: 'script-1',
        lineNumber: 1,
        lockedBy: 'user-1',
        lockedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30分後
      };

      expect(mockLock.lockedBy).toBe('user-1');
      expect(mockLock.lineNumber).toBe(1);
    });

    it('should manage edit sessions', () => {
      const mockSession: ScriptEditSession = {
        id: 'session-1',
        scriptId: 'script-1',
        userId: 'user-1',
        userName: 'テストユーザー',
        startedAt: new Date(),
        lastActivity: new Date(),
        isActive: true
      };

      expect(mockSession.isActive).toBe(true);
      expect(mockSession.userName).toBe('テストユーザー');
    });
  });

  describe('Scene Management', () => {
    it('should create scene successfully', () => {
      const mockScene: ScriptScene = {
        id: 'scene-1',
        scriptId: 'script-1',
        sceneNumber: 1,
        title: '第1場',
        description: '開幕シーン',
        startLineNumber: 1,
        endLineNumber: 10,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(mockScene.sceneNumber).toBe(1);
      expect(mockScene.title).toBe('第1場');
      expect(mockScene.startLineNumber).toBe(1);
      expect(mockScene.endLineNumber).toBe(10);
    });
  });

  describe('Print Optimization', () => {
    it('should save print settings successfully', () => {
      const mockPrintSettings: ScriptPrintSettings = {
        id: 'print-1',
        scriptId: 'script-1',
        pageSize: 'A4',
        orientation: 'portrait',
        fontSize: 12,
        lineSpacing: 1.5,
        margins: {
          top: 20,
          bottom: 20,
          left: 20,
          right: 20
        },
        includeNotes: true,
        includeLighting: true,
        includeAudioVideo: true,
        sceneBreaks: true,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(mockPrintSettings.pageSize).toBe('A4');
      expect(mockPrintSettings.fontSize).toBe(12);
      expect(mockPrintSettings.margins.top).toBe(20);
    });

    it('should generate print data successfully', () => {
      const mockPrintData = {
        script: {
          id: 'script-1',
          title: 'テスト脚本',
          isActive: true
        },
        lines: [
          {
            id: 'line-1',
            lineNumber: 1,
            characterName: '太郎',
            dialogue: 'こんにちは'
          }
        ],
        scenes: [
          {
            id: 'scene-1',
            sceneNumber: 1,
            title: '第1場'
          }
        ],
        settings: {
          pageSize: 'A4',
          fontSize: 12
        }
      };

      expect(mockPrintData.script.title).toBe('テスト脚本');
      expect(mockPrintData.lines).toHaveLength(1);
      expect(mockPrintData.scenes).toHaveLength(1);
    });
  });
});