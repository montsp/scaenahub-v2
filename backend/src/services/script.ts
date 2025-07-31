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
import { ScriptModel } from '../models/Script';
import { DataSyncService } from './database/sync';
import { v4 as uuidv4 } from 'uuid';

export class ScriptService {
  private static instance: ScriptService;
  private syncService: DataSyncService;
  private scriptCache = new Map<string, Script>();
  private scriptLinesCache = new Map<string, ScriptLine[]>();
  private lastCacheUpdate = new Date(0);

  private constructor() {
    this.syncService = DataSyncService.getInstance();
  }

  public static getInstance(): ScriptService {
    if (!ScriptService.instance) {
      ScriptService.instance = new ScriptService();
    }
    return ScriptService.instance;
  }

  // 脚本一覧取得
  public async getAllScripts(userId?: string, userRoles?: string[]): Promise<Script[]> {
    await this.refreshCacheIfNeeded();
    
    const scripts = Array.from(this.scriptCache.values());
    
    // 権限フィルタリング
    if (userId && userRoles) {
      return scripts.filter(script => this.canViewScript(script, userId, userRoles));
    }
    
    return scripts;
  }

  // 脚本詳細取得
  public async getScriptById(scriptId: string, userId?: string, userRoles?: string[]): Promise<Script | null> {
    await this.refreshCacheIfNeeded();
    
    const script = this.scriptCache.get(scriptId);
    if (!script) return null;
    
    // 権限チェック
    if (userId && userRoles && !this.canViewScript(script, userId, userRoles)) {
      return null;
    }
    
    return script;
  }

  // 脚本作成
  public async createScript(scriptData: {
    title: string;
    description?: string;
    isActive?: boolean;
    permissions?: Partial<ScriptPermissions>;
    createdBy: string;
  }): Promise<Script> {
    const script = ScriptModel.create(scriptData);

    // データベースに保存
    await this.syncService.writeData('scripts', 'INSERT', script.id, {
      id: script.id,
      title: script.title,
      description: script.description,
      is_active: script.isActive,
      permissions: JSON.stringify(script.permissions),
      created_by: script.createdBy,
      created_at: script.createdAt.toISOString(),
      updated_at: script.updatedAt.toISOString()
    });

    // キャッシュ更新
    this.scriptCache.set(script.id, script);
    this.lastCacheUpdate = new Date();

    return script;
  }

  // 脚本更新
  public async updateScript(
    scriptId: string, 
    updates: Partial<Script>,
    userId: string,
    userRoles: string[]
  ): Promise<Script> {
    const script = await this.getScriptById(scriptId);
    if (!script) {
      throw new Error('Script not found');
    }

    // 編集権限チェック
    if (!this.canEditScript(script, userId, userRoles)) {
      throw new Error('Permission denied: Cannot edit this script');
    }

    const updatedScript: Script = {
      ...script,
      ...updates,
      id: script.id, // IDは変更不可
      createdBy: script.createdBy, // 作成者は変更不可
      createdAt: script.createdAt, // 作成日時は変更不可
      updatedAt: new Date()
    };

    // バリデーション
    const validation = ScriptModel.validate(updatedScript);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // データベース更新
    await this.syncService.writeData('scripts', 'UPDATE', scriptId, {
      title: updatedScript.title,
      description: updatedScript.description,
      is_active: updatedScript.isActive,
      permissions: JSON.stringify(updatedScript.permissions),
      updated_at: updatedScript.updatedAt.toISOString()
    });

    // キャッシュ更新
    this.scriptCache.set(scriptId, updatedScript);
    this.lastCacheUpdate = new Date();

    return updatedScript;
  }

  // 脚本削除
  public async deleteScript(scriptId: string, userId: string, userRoles: string[]): Promise<void> {
    const script = await this.getScriptById(scriptId);
    if (!script) {
      throw new Error('Script not found');
    }

    // 削除権限チェック（管理者または作成者のみ）
    if (!userRoles.includes('admin') && script.createdBy !== userId) {
      throw new Error('Permission denied: Cannot delete this script');
    }

    // データベースから削除（CASCADE により script_lines も削除される）
    await this.syncService.writeData('scripts', 'DELETE', scriptId, {});

    // キャッシュから削除
    this.scriptCache.delete(scriptId);
    this.scriptLinesCache.delete(scriptId);
    this.lastCacheUpdate = new Date();
  }

  // 脚本行一覧取得
  public async getScriptLines(scriptId: string, userId?: string, userRoles?: string[]): Promise<ScriptLine[]> {
    // 脚本の閲覧権限チェック
    const script = await this.getScriptById(scriptId, userId, userRoles);
    if (!script) {
      throw new Error('Script not found or permission denied');
    }

    await this.refreshLinesCacheIfNeeded(scriptId);
    
    const lines = this.scriptLinesCache.get(scriptId) || [];
    return lines.sort((a, b) => a.lineNumber - b.lineNumber);
  }

  // 脚本行作成
  public async createScriptLine(
    scriptId: string,
    lineData: {
      lineNumber: number;
      characterName?: string;
      dialogue?: string;
      lighting?: string;
      audioVideo?: string;
      notes?: string;
      formatting?: Partial<ScriptFormatting>;
    },
    userId: string,
    userRoles: string[]
  ): Promise<ScriptLine> {
    // 脚本の編集権限チェック
    const script = await this.getScriptById(scriptId);
    if (!script || !this.canEditScript(script, userId, userRoles)) {
      throw new Error('Script not found or permission denied');
    }

    // 行番号の重複チェック
    const existingLines = await this.getScriptLines(scriptId);
    if (existingLines.some(line => line.lineNumber === lineData.lineNumber)) {
      throw new Error(`Line number ${lineData.lineNumber} already exists`);
    }

    const scriptLine = ScriptModel.createLine({
      ...lineData,
      scriptId,
      lastEditedBy: userId
    });

    // 台詞の色を自動設定
    if (scriptLine.dialogue) {
      scriptLine.formatting.color = ScriptModel.getDialogueColor(scriptLine.dialogue);
    }

    // データベースに保存
    await this.syncService.writeData('script_lines', 'INSERT', scriptLine.id, {
      id: scriptLine.id,
      script_id: scriptLine.scriptId,
      line_number: scriptLine.lineNumber,
      character_name: scriptLine.characterName || '',
      dialogue: scriptLine.dialogue || '',
      lighting: scriptLine.lighting || '',
      audio_video: scriptLine.audioVideo || '',
      notes: scriptLine.notes || '',
      formatting: JSON.stringify(scriptLine.formatting),
      last_edited_by: scriptLine.lastEditedBy,
      created_at: scriptLine.createdAt.toISOString(),
      updated_at: scriptLine.updatedAt.toISOString()
    });

    // 履歴記録
    await this.recordLineHistory(scriptLine, 'create', 'Line created', userId);

    // キャッシュ更新
    const lines = this.scriptLinesCache.get(scriptId) || [];
    lines.push(scriptLine);
    this.scriptLinesCache.set(scriptId, lines);

    return scriptLine;
  }

  // 脚本行更新
  public async updateScriptLine(
    scriptId: string,
    lineNumber: number,
    updates: Partial<ScriptLine>,
    userId: string,
    userRoles: string[]
  ): Promise<ScriptLine> {
    // 脚本の編集権限チェック
    const script = await this.getScriptById(scriptId);
    if (!script || !this.canEditScript(script, userId, userRoles)) {
      throw new Error('Script not found or permission denied');
    }

    const lines = await this.getScriptLines(scriptId);
    const existingLine = lines.find(line => line.lineNumber === lineNumber);
    if (!existingLine) {
      throw new Error('Script line not found');
    }

    const updatedLine: ScriptLine = {
      ...existingLine,
      ...updates,
      id: existingLine.id, // IDは変更不可
      scriptId: existingLine.scriptId, // 脚本IDは変更不可
      lineNumber: existingLine.lineNumber, // 行番号は変更不可
      lastEditedBy: userId,
      updatedAt: new Date()
    };

    // 台詞の色を自動設定
    if (updates.dialogue !== undefined) {
      updatedLine.formatting.color = ScriptModel.getDialogueColor(updatedLine.dialogue);
    }

    // バリデーション
    const validation = ScriptModel.validateLine(updatedLine);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // データベース更新
    await this.syncService.writeData('script_lines', 'UPDATE', existingLine.id, {
      character_name: updatedLine.characterName,
      dialogue: updatedLine.dialogue,
      lighting: updatedLine.lighting,
      audio_video: updatedLine.audioVideo,
      notes: updatedLine.notes,
      formatting: JSON.stringify(updatedLine.formatting),
      last_edited_by: updatedLine.lastEditedBy,
      updated_at: updatedLine.updatedAt.toISOString()
    });

    // 履歴記録
    await this.recordLineHistory(updatedLine, 'update', 'Line updated', userId);

    // キャッシュ更新
    const cachedLines = this.scriptLinesCache.get(scriptId) || [];
    const lineIndex = cachedLines.findIndex(line => line.id === existingLine.id);
    if (lineIndex !== -1) {
      cachedLines[lineIndex] = updatedLine;
      this.scriptLinesCache.set(scriptId, cachedLines);
    }

    return updatedLine;
  }

  // 脚本行削除
  public async deleteScriptLine(
    scriptId: string,
    lineNumber: number,
    userId: string,
    userRoles: string[]
  ): Promise<void> {
    // 脚本の編集権限チェック
    const script = await this.getScriptById(scriptId);
    if (!script || !this.canEditScript(script, userId, userRoles)) {
      throw new Error('Script not found or permission denied');
    }

    const lines = await this.getScriptLines(scriptId);
    const existingLine = lines.find(line => line.lineNumber === lineNumber);
    if (!existingLine) {
      throw new Error('Script line not found');
    }

    // 履歴記録（削除前に記録）
    await this.recordLineHistory(existingLine, 'delete', 'Line deleted', userId);

    // データベースから削除
    await this.syncService.writeData('script_lines', 'DELETE', existingLine.id, {});

    // キャッシュから削除
    const cachedLines = this.scriptLinesCache.get(scriptId) || [];
    const filteredLines = cachedLines.filter(line => line.id !== existingLine.id);
    this.scriptLinesCache.set(scriptId, filteredLines);
  }

  // 権限チェック: 脚本閲覧
  public canViewScript(script: Script, userId: string, userRoles: string[]): boolean {
    const { viewRoles, viewUsers } = script.permissions;
    
    // 管理者は常に閲覧可能
    if (userRoles.includes('admin')) return true;
    
    // 作成者は常に閲覧可能
    if (script.createdBy === userId) return true;
    
    // ユーザー個別権限チェック
    if (viewUsers.includes(userId)) return true;
    
    // ロール権限チェック
    return userRoles.some(role => viewRoles.includes(role));
  }

  // 権限チェック: 脚本編集
  public canEditScript(script: Script, userId: string, userRoles: string[]): boolean {
    const { editRoles, editUsers } = script.permissions;
    
    // 管理者は常に編集可能
    if (userRoles.includes('admin')) return true;
    
    // 作成者は常に編集可能
    if (script.createdBy === userId) return true;
    
    // ユーザー個別権限チェック
    if (editUsers.includes(userId)) return true;
    
    // ロール権限チェック
    return userRoles.some(role => editRoles.includes(role));
  }

  // キャッシュ更新
  private async refreshCacheIfNeeded(): Promise<void> {
    const cacheAge = Date.now() - this.lastCacheUpdate.getTime();
    if (cacheAge > 30000) { // 30秒でキャッシュ更新
      await this.loadScriptsFromDatabase();
    }
  }

  private async refreshLinesCacheIfNeeded(scriptId: string): Promise<void> {
    if (!this.scriptLinesCache.has(scriptId)) {
      await this.loadScriptLinesFromDatabase(scriptId);
    }
  }

  private async loadScriptsFromDatabase(): Promise<void> {
    try {
      const scripts = this.syncService.readData<any>('scripts', 'SELECT * FROM scripts_cache WHERE is_active = 1');
      
      this.scriptCache.clear();
      for (const scriptData of scripts) {
        const script: Script = {
          id: scriptData.id,
          title: scriptData.title,
          description: scriptData.description,
          isActive: Boolean(scriptData.is_active),
          permissions: typeof scriptData.permissions === 'string' 
            ? JSON.parse(scriptData.permissions) 
            : scriptData.permissions,
          createdBy: scriptData.created_by,
          createdAt: new Date(scriptData.created_at),
          updatedAt: new Date(scriptData.updated_at)
        };
        this.scriptCache.set(script.id, script);
      }
      
      this.lastCacheUpdate = new Date();
    } catch (error) {
      console.error('Failed to load scripts from database:', error);
    }
  }

  private async loadScriptLinesFromDatabase(scriptId: string): Promise<void> {
    try {
      const lines = this.syncService.readData<any>(
        'script_lines', 
        'SELECT * FROM script_lines_cache WHERE script_id = ? ORDER BY line_number',
        [scriptId]
      );
      
      const scriptLines: ScriptLine[] = lines.map(lineData => ({
        id: lineData.id,
        scriptId: lineData.script_id,
        lineNumber: lineData.line_number,
        characterName: lineData.character_name,
        dialogue: lineData.dialogue,
        lighting: lineData.lighting,
        audioVideo: lineData.audio_video,
        notes: lineData.notes,
        formatting: typeof lineData.formatting === 'string' 
          ? JSON.parse(lineData.formatting) 
          : lineData.formatting,
        lastEditedBy: lineData.last_edited_by,
        createdAt: new Date(lineData.created_at),
        updatedAt: new Date(lineData.updated_at)
      }));
      
      this.scriptLinesCache.set(scriptId, scriptLines);
    } catch (error) {
      console.error('Failed to load script lines from database:', error);
      this.scriptLinesCache.set(scriptId, []);
    }
  }

  // === バージョン管理機能 ===

  // 脚本のバージョンを作成
  public async createScriptVersion(
    scriptId: string,
    changeDescription: string,
    userId: string,
    userRoles: string[]
  ): Promise<ScriptVersion> {
    const script = await this.getScriptById(scriptId);
    if (!script || !this.canEditScript(script, userId, userRoles)) {
      throw new Error('Script not found or permission denied');
    }

    // 現在の最新バージョン番号を取得
    const versions = this.syncService.readData<any>(
      'script_versions',
      'SELECT MAX(version) as max_version FROM script_versions_cache WHERE script_id = ?',
      [scriptId]
    );
    const nextVersion = (versions[0]?.max_version || 0) + 1;

    const version: ScriptVersion = {
      id: uuidv4(),
      scriptId,
      version: nextVersion,
      title: script.title,
      description: script.description,
      changeDescription,
      createdBy: userId,
      createdAt: new Date()
    };

    // データベースに保存
    await this.syncService.writeData('script_versions', 'INSERT', version.id, {
      id: version.id,
      script_id: version.scriptId,
      version: version.version,
      title: version.title,
      description: version.description,
      change_description: version.changeDescription,
      created_by: version.createdBy,
      created_at: version.createdAt.toISOString()
    });

    return version;
  }

  // 脚本のバージョン履歴を取得
  public async getScriptVersions(scriptId: string, userId?: string, userRoles?: string[]): Promise<ScriptVersion[]> {
    const script = await this.getScriptById(scriptId, userId, userRoles);
    if (!script) {
      throw new Error('Script not found or permission denied');
    }

    const versions = this.syncService.readData<any>(
      'script_versions',
      'SELECT * FROM script_versions_cache WHERE script_id = ? ORDER BY version DESC',
      [scriptId]
    );

    return versions.map(versionData => ({
      id: versionData.id,
      scriptId: versionData.script_id,
      version: versionData.version,
      title: versionData.title,
      description: versionData.description,
      changeDescription: versionData.change_description,
      createdBy: versionData.created_by,
      createdAt: new Date(versionData.created_at)
    }));
  }

  // 行編集履歴を記録
  private async recordLineHistory(
    scriptLine: ScriptLine,
    changeType: 'create' | 'update' | 'delete',
    changeDescription: string | undefined,
    userId: string
  ): Promise<void> {
    const history: ScriptLineHistory = {
      id: uuidv4(),
      scriptLineId: scriptLine.id,
      scriptId: scriptLine.scriptId,
      lineNumber: scriptLine.lineNumber,
      characterName: scriptLine.characterName,
      dialogue: scriptLine.dialogue,
      lighting: scriptLine.lighting,
      audioVideo: scriptLine.audioVideo,
      notes: scriptLine.notes,
      formatting: scriptLine.formatting,
      changeType,
      changeDescription,
      editedBy: userId,
      editedAt: new Date()
    };

    await this.syncService.writeData('script_line_history', 'INSERT', history.id, {
      id: history.id,
      script_line_id: history.scriptLineId,
      script_id: history.scriptId,
      line_number: history.lineNumber,
      character_name: history.characterName,
      dialogue: history.dialogue,
      lighting: history.lighting,
      audio_video: history.audioVideo,
      notes: history.notes,
      formatting: JSON.stringify(history.formatting),
      change_type: history.changeType,
      change_description: history.changeDescription,
      edited_by: history.editedBy,
      edited_at: history.editedAt.toISOString()
    });
  }

  // 行編集履歴を取得
  public async getLineHistory(
    scriptId: string,
    lineNumber?: number,
    userId?: string,
    userRoles?: string[]
  ): Promise<ScriptLineHistory[]> {
    const script = await this.getScriptById(scriptId, userId, userRoles);
    if (!script) {
      throw new Error('Script not found or permission denied');
    }

    let query = 'SELECT * FROM script_line_history_cache WHERE script_id = ?';
    const params: any[] = [scriptId];

    if (lineNumber !== undefined) {
      query += ' AND line_number = ?';
      params.push(lineNumber);
    }

    query += ' ORDER BY edited_at DESC';

    const history = this.syncService.readData<any>('script_line_history', query, params);

    return history.map(historyData => ({
      id: historyData.id,
      scriptLineId: historyData.script_line_id,
      scriptId: historyData.script_id,
      lineNumber: historyData.line_number,
      characterName: historyData.character_name,
      dialogue: historyData.dialogue,
      lighting: historyData.lighting,
      audioVideo: historyData.audio_video,
      notes: historyData.notes,
      formatting: typeof historyData.formatting === 'string' 
        ? JSON.parse(historyData.formatting) 
        : historyData.formatting,
      changeType: historyData.change_type as 'create' | 'update' | 'delete',
      changeDescription: historyData.change_description,
      editedBy: historyData.edited_by,
      editedAt: new Date(historyData.edited_at)
    }));
  }

  // === 同時編集制御機能 ===

  // 脚本または行をロック
  public async lockScript(
    scriptId: string,
    lineNumber: number | undefined,
    userId: string,
    userRoles: string[],
    lockDurationMinutes: number = 30
  ): Promise<ScriptLock> {
    const script = await this.getScriptById(scriptId);
    if (!script || !this.canEditScript(script, userId, userRoles)) {
      throw new Error('Script not found or permission denied');
    }

    // 既存のロックをチェック
    const existingLocks = this.syncService.readData<any>(
      'script_locks',
      'SELECT * FROM script_locks_cache WHERE script_id = ? AND (line_number = ? OR line_number IS NULL) AND expires_at > ?',
      [scriptId, lineNumber || null, new Date().toISOString()]
    );

    if (existingLocks.length > 0 && existingLocks[0].locked_by !== userId) {
      throw new Error('Script or line is already locked by another user');
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + lockDurationMinutes);

    const lock: ScriptLock = {
      id: uuidv4(),
      scriptId,
      lineNumber,
      lockedBy: userId,
      lockedAt: new Date(),
      expiresAt
    };

    // データベースに保存（UPSERT）
    await this.syncService.writeData('script_locks', 'INSERT', lock.id, {
      id: lock.id,
      script_id: lock.scriptId,
      line_number: lock.lineNumber,
      locked_by: lock.lockedBy,
      locked_at: lock.lockedAt.toISOString(),
      expires_at: lock.expiresAt.toISOString()
    });

    return lock;
  }

  // ロックを解除
  public async unlockScript(
    scriptId: string,
    lineNumber: number | undefined,
    userId: string
  ): Promise<void> {
    await this.syncService.writeData('script_locks', 'DELETE', '', {
      script_id: scriptId,
      line_number: lineNumber,
      locked_by: userId
    });
  }

  // 編集セッションを開始
  public async startEditSession(
    scriptId: string,
    userId: string,
    userName: string,
    userRoles: string[]
  ): Promise<ScriptEditSession> {
    const script = await this.getScriptById(scriptId);
    if (!script || !this.canEditScript(script, userId, userRoles)) {
      throw new Error('Script not found or permission denied');
    }

    const session: ScriptEditSession = {
      id: uuidv4(),
      scriptId,
      userId,
      userName,
      startedAt: new Date(),
      lastActivity: new Date(),
      isActive: true
    };

    // データベースに保存（UPSERT）
    await this.syncService.writeData('script_edit_sessions', 'INSERT', session.id, {
      id: session.id,
      script_id: session.scriptId,
      user_id: session.userId,
      user_name: session.userName,
      started_at: session.startedAt.toISOString(),
      last_activity: session.lastActivity.toISOString(),
      is_active: session.isActive
    });

    return session;
  }

  // 編集セッションを更新
  public async updateEditSession(sessionId: string, userId: string): Promise<void> {
    await this.syncService.writeData('script_edit_sessions', 'UPDATE', sessionId, {
      last_activity: new Date().toISOString()
    });
  }

  // 編集セッションを終了
  public async endEditSession(sessionId: string, userId: string): Promise<void> {
    await this.syncService.writeData('script_edit_sessions', 'UPDATE', sessionId, {
      is_active: false
    });
  }

  // アクティブな編集セッションを取得
  public async getActiveEditSessions(scriptId: string): Promise<ScriptEditSession[]> {
    const sessions = this.syncService.readData<any>(
      'script_edit_sessions',
      'SELECT * FROM script_edit_sessions_cache WHERE script_id = ? AND is_active = 1 AND last_activity > ?',
      [scriptId, new Date(Date.now() - 5 * 60 * 1000).toISOString()] // 5分以内のアクティビティ
    );

    return sessions.map(sessionData => ({
      id: sessionData.id,
      scriptId: sessionData.script_id,
      userId: sessionData.user_id,
      userName: sessionData.user_name,
      startedAt: new Date(sessionData.started_at),
      lastActivity: new Date(sessionData.last_activity),
      isActive: Boolean(sessionData.is_active)
    }));
  }

  // === 場面分割機能 ===

  // 場面を作成
  public async createScene(
    scriptId: string,
    sceneData: {
      title: string;
      description?: string;
      startLineNumber: number;
      endLineNumber: number;
    },
    userId: string,
    userRoles: string[]
  ): Promise<ScriptScene> {
    const script = await this.getScriptById(scriptId);
    if (!script || !this.canEditScript(script, userId, userRoles)) {
      throw new Error('Script not found or permission denied');
    }

    // 場面番号を自動採番
    const scenes = this.syncService.readData<any>(
      'script_scenes',
      'SELECT MAX(scene_number) as max_scene FROM script_scenes_cache WHERE script_id = ?',
      [scriptId]
    );
    const nextSceneNumber = (scenes[0]?.max_scene || 0) + 1;

    const scene: ScriptScene = {
      id: uuidv4(),
      scriptId,
      sceneNumber: nextSceneNumber,
      title: sceneData.title,
      description: sceneData.description,
      startLineNumber: sceneData.startLineNumber,
      endLineNumber: sceneData.endLineNumber,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.syncService.writeData('script_scenes', 'INSERT', scene.id, {
      id: scene.id,
      script_id: scene.scriptId,
      scene_number: scene.sceneNumber,
      title: scene.title,
      description: scene.description,
      start_line_number: scene.startLineNumber,
      end_line_number: scene.endLineNumber,
      created_by: scene.createdBy,
      created_at: scene.createdAt.toISOString(),
      updated_at: scene.updatedAt.toISOString()
    });

    return scene;
  }

  // 場面一覧を取得
  public async getScenes(scriptId: string, userId?: string, userRoles?: string[]): Promise<ScriptScene[]> {
    const script = await this.getScriptById(scriptId, userId, userRoles);
    if (!script) {
      throw new Error('Script not found or permission denied');
    }

    const scenes = this.syncService.readData<any>(
      'script_scenes',
      'SELECT * FROM script_scenes_cache WHERE script_id = ? ORDER BY scene_number',
      [scriptId]
    );

    return scenes.map(sceneData => ({
      id: sceneData.id,
      scriptId: sceneData.script_id,
      sceneNumber: sceneData.scene_number,
      title: sceneData.title,
      description: sceneData.description,
      startLineNumber: sceneData.start_line_number,
      endLineNumber: sceneData.end_line_number,
      createdBy: sceneData.created_by,
      createdAt: new Date(sceneData.created_at),
      updatedAt: new Date(sceneData.updated_at)
    }));
  }

  // === 印刷最適化機能 ===

  // 印刷設定を保存
  public async savePrintSettings(
    scriptId: string,
    settings: Omit<ScriptPrintSettings, 'id' | 'scriptId' | 'createdBy' | 'createdAt' | 'updatedAt'>,
    userId: string,
    userRoles: string[]
  ): Promise<ScriptPrintSettings> {
    const script = await this.getScriptById(scriptId);
    if (!script || !this.canEditScript(script, userId, userRoles)) {
      throw new Error('Script not found or permission denied');
    }

    const printSettings: ScriptPrintSettings = {
      id: uuidv4(),
      scriptId,
      ...settings,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.syncService.writeData('script_print_settings', 'INSERT', printSettings.id, {
      id: printSettings.id,
      script_id: printSettings.scriptId,
      page_size: printSettings.pageSize,
      orientation: printSettings.orientation,
      font_size: printSettings.fontSize,
      line_spacing: printSettings.lineSpacing,
      margin_top: printSettings.margins.top,
      margin_bottom: printSettings.margins.bottom,
      margin_left: printSettings.margins.left,
      margin_right: printSettings.margins.right,
      include_notes: printSettings.includeNotes,
      include_lighting: printSettings.includeLighting,
      include_audio_video: printSettings.includeAudioVideo,
      scene_breaks: printSettings.sceneBreaks,
      created_by: printSettings.createdBy,
      created_at: printSettings.createdAt.toISOString(),
      updated_at: printSettings.updatedAt.toISOString()
    });

    return printSettings;
  }

  // 印刷設定を取得
  public async getPrintSettings(scriptId: string, userId?: string, userRoles?: string[]): Promise<ScriptPrintSettings | null> {
    const script = await this.getScriptById(scriptId, userId, userRoles);
    if (!script) {
      throw new Error('Script not found or permission denied');
    }

    const settings = this.syncService.readData<any>(
      'script_print_settings',
      'SELECT * FROM script_print_settings_cache WHERE script_id = ? LIMIT 1',
      [scriptId]
    );

    if (settings.length === 0) return null;

    const settingData = settings[0];
    return {
      id: settingData.id,
      scriptId: settingData.script_id,
      pageSize: settingData.page_size as 'A4' | 'A5' | 'Letter',
      orientation: settingData.orientation as 'portrait' | 'landscape',
      fontSize: settingData.font_size,
      lineSpacing: settingData.line_spacing,
      margins: {
        top: settingData.margin_top,
        bottom: settingData.margin_bottom,
        left: settingData.margin_left,
        right: settingData.margin_right
      },
      includeNotes: Boolean(settingData.include_notes),
      includeLighting: Boolean(settingData.include_lighting),
      includeAudioVideo: Boolean(settingData.include_audio_video),
      sceneBreaks: Boolean(settingData.scene_breaks),
      createdBy: settingData.created_by,
      createdAt: new Date(settingData.created_at),
      updatedAt: new Date(settingData.updated_at)
    };
  }

  // 印刷用データを生成
  public async generatePrintData(scriptId: string, userId?: string, userRoles?: string[]): Promise<{
    script: Script;
    lines: ScriptLine[];
    scenes: ScriptScene[];
    settings: ScriptPrintSettings | null;
  }> {
    const script = await this.getScriptById(scriptId, userId, userRoles);
    if (!script) {
      throw new Error('Script not found or permission denied');
    }

    const [lines, scenes, settings] = await Promise.all([
      this.getScriptLines(scriptId, userId, userRoles),
      this.getScenes(scriptId, userId, userRoles),
      this.getPrintSettings(scriptId, userId, userRoles)
    ]);

    return { script, lines, scenes, settings };
  }
}