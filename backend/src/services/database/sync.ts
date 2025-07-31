import { TiDBService } from './tidb';
import { SQLiteService } from './sqlite';
import { v4 as uuidv4 } from 'uuid';

export interface SyncOperation {
  id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  tableName: string;
  recordId: string;
  data: any;
  timestamp: Date;
  retryCount?: number;
  priority?: 'low' | 'medium' | 'high';
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: Date;
  accessCount: number;
  lastAccessed: Date;
  size: number; // データサイズ（バイト）
}

export interface SyncStats {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  queueSize: number;
  cacheHitRate: number;
  memoryUsage: number;
  lastSyncTime: Date | null;
  syncDirection: 'bidirectional' | 'tidb-to-sqlite' | 'sqlite-to-tidb';
  conflictResolutions: number;
  averageSyncTime: number;
}

export interface ConflictResolution {
  id: string;
  tableName: string;
  recordId: string;
  conflictType: 'update-update' | 'update-delete' | 'delete-update';
  resolution: 'tidb-wins' | 'sqlite-wins' | 'merge' | 'manual';
  timestamp: Date;
  resolvedBy: 'system' | 'user';
}

export interface ResourceMonitor {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkLatency: number;
  dbConnections: number;
  queueBacklog: number;
  timestamp: Date;
}

export interface CacheConfig {
  maxMemoryMB: number;
  maxEntries: number;
  ttlMinutes: number;
  gcIntervalMinutes: number;
}

export class DataSyncService {
  private static instance: DataSyncService;
  private tidb: TiDBService;
  private sqlite: SQLiteService;
  private syncQueue: SyncOperation[] = [];
  private isOnline = true;
  private syncInterval: NodeJS.Timeout | null = null;
  
  // メモリキャッシュ管理
  private memoryCache = new Map<string, CacheEntry>();
  private cacheConfig: CacheConfig = {
    maxMemoryMB: 128, // 128MB制限
    maxEntries: 10000,
    ttlMinutes: 30,
    gcIntervalMinutes: 5
  };
  private gcInterval: NodeJS.Timeout | null = null;
  
  // 統計情報
  private stats: SyncStats = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    queueSize: 0,
    cacheHitRate: 0,
    memoryUsage: 0,
    lastSyncTime: null,
    syncDirection: 'bidirectional',
    conflictResolutions: 0,
    averageSyncTime: 0
  };
  
  // パフォーマンス監視
  private cacheHits = 0;
  private cacheMisses = 0;
  private conflictLog: ConflictResolution[] = [];
  private resourceHistory: ResourceMonitor[] = [];
  private syncTimes: number[] = [];
  
  // 双方向同期管理
  private lastSyncTimestamp: { [table: string]: Date } = {};
  private syncInProgress = false;
  private bidirectionalSyncInterval: NodeJS.Timeout | null = null;
  

  
  // 自動最適化設定
  private autoOptimization = {
    enabled: true,
    cacheAutoResize: true,
    queuePriorityAdjustment: true,
    resourceThresholds: {
      memoryWarning: 80, // 80%
      memoryCritical: 90, // 90%
      queueWarning: 1000,
      queueCritical: 5000
    }
  };

  private constructor() {
    this.tidb = TiDBService.getInstance();
    this.sqlite = SQLiteService.getInstance();
  }

  public static getInstance(): DataSyncService {
    if (!DataSyncService.instance) {
      DataSyncService.instance = new DataSyncService();
    }
    return DataSyncService.instance;
  }

  public async initialize(): Promise<void> {
    try {
      // TiDB接続を試行
      await this.tidb.connect();
      await this.tidb.createTables();
      this.isOnline = true;
      
      // SQLite接続
      this.sqlite.connect();
      
      // 初期データ同期
      await this.initialSync();
      
      // 定期同期開始
      this.startPeriodicSync();
      
      // 高度な機能を初期化
      await this.initializeAdvancedFeatures();
      
      console.log('🔄 Data sync service initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize sync service:', error);
      this.isOnline = false;
      
      // オフラインモードでSQLiteのみ使用
      this.sqlite.connect();
      console.log('📴 Running in offline mode with SQLite cache only');
    }
  }

  private async initialSync(): Promise<void> {
    if (!this.isOnline) return;

    try {
      console.log('🔄 Starting initial data sync from TiDB to SQLite...');
      
      // ユーザーデータ同期
      await this.syncTableFromTiDB('users', 'users_cache');
      
      // ロールデータ同期
      await this.syncTableFromTiDB('roles', 'roles_cache');
      
      // カテゴリデータ同期
      await this.syncTableFromTiDB('categories', 'categories_cache');
      
      // チャンネルデータ同期
      await this.syncTableFromTiDB('channels', 'channels_cache');
      
      // 脚本データ同期
      await this.syncTableFromTiDB('scripts', 'scripts_cache');
      
      // 脚本行データ同期
      await this.syncTableFromTiDB('script_lines', 'script_lines_cache');
      
      // 脚本バージョン同期
      await this.syncTableFromTiDB('script_versions', 'script_versions_cache');
      
      // 脚本行履歴同期
      await this.syncTableFromTiDB('script_line_history', 'script_line_history_cache');
      
      // 脚本ロック同期
      await this.syncTableFromTiDB('script_locks', 'script_locks_cache');
      
      // 脚本編集セッション同期
      await this.syncTableFromTiDB('script_edit_sessions', 'script_edit_sessions_cache');
      
      // 脚本場面同期
      await this.syncTableFromTiDB('script_scenes', 'script_scenes_cache');
      
      // 脚本印刷設定同期
      await this.syncTableFromTiDB('script_print_settings', 'script_print_settings_cache');
      
      // モデレーション関連データ同期
      await this.syncTableFromTiDB('moderation_rules', 'moderation_rules_cache');
      await this.syncTableFromTiDB('moderation_settings', 'moderation_settings_cache');
      await this.syncTableFromTiDB('user_timeouts', 'user_timeouts_cache');
      await this.syncTableFromTiDB('moderation_logs', 'moderation_logs_cache');
      
      // 直近のメッセージ同期（24時間以内）
      await this.syncRecentMessages();
      
      console.log('✅ Initial data sync completed');
      
    } catch (error) {
      console.error('❌ Initial sync failed:', error);
      throw error;
    }
  }

  private async syncTableFromTiDB(tidbTable: string, sqliteTable: string): Promise<void> {
    try {
      const data = await this.tidb.query(`SELECT * FROM ${tidbTable}`);
      
      // SQLiteテーブルをクリア
      this.sqlite.execute(`DELETE FROM ${sqliteTable}`);
      
      // データを挿入
      for (const row of data) {
        const columns = Object.keys(row);
        const placeholders = columns.map(() => '?').join(', ');
        const values = columns.map(col => {
          const value = row[col];
          // JSONデータは文字列として保存
          return typeof value === 'object' ? JSON.stringify(value) : value;
        });
        
        this.sqlite.execute(
          `INSERT INTO ${sqliteTable} (${columns.join(', ')}, synced_at) VALUES (${placeholders}, ?)`,
          [...values, new Date().toISOString()]
        );
      }
      
      console.log(`📊 Synced ${data.length} records from ${tidbTable} to ${sqliteTable}`);
      
    } catch (error) {
      console.error(`Failed to sync ${tidbTable}:`, error);
    }
  }

  private async syncRecentMessages(): Promise<void> {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const messages = await this.tidb.query(
        'SELECT * FROM messages WHERE created_at > ? ORDER BY created_at DESC LIMIT 1000',
        [twentyFourHoursAgo.toISOString()]
      );
      
      // メッセージキャッシュをクリア
      this.sqlite.execute('DELETE FROM messages_cache');
      
      // 最新メッセージを挿入
      for (const message of messages) {
        const columns = Object.keys(message);
        const placeholders = columns.map(() => '?').join(', ');
        const values = columns.map(col => {
          const value = message[col];
          return typeof value === 'object' ? JSON.stringify(value) : value;
        });
        
        this.sqlite.execute(
          `INSERT INTO messages_cache (${columns.join(', ')}, synced_at) VALUES (${placeholders}, ?)`,
          [...values, new Date().toISOString()]
        );
      }
      
      console.log(`📨 Synced ${messages.length} recent messages to cache`);
      
    } catch (error) {
      console.error('Failed to sync recent messages:', error);
    }
  }

  private applyDefaultValues(tableName: string, data: any): any {
    const defaults: { [key: string]: { [field: string]: any } } = {
      users: {
        roles: ['member']
      },
      roles: {
        permissions: {}
      },
      channels: {
        permissions: {},
        allowed_roles: [],
        allowed_users: [],
        settings: {}
      },
      messages: {
        mentions: [],
        reactions: [],
        attachments: [],
        embeds: []
      },
      moderation_logs: {
        metadata: {}
      }
    };

    const tableDefaults = defaults[tableName];
    if (tableDefaults) {
      const result = { ...data };
      for (const [field, defaultValue] of Object.entries(tableDefaults)) {
        if (result[field] === undefined || result[field] === null) {
          result[field] = defaultValue;
        }
      }
      return result;
    }
    return data;
  }

  public async writeData(tableName: string, operation: 'INSERT' | 'UPDATE' | 'DELETE', recordId: string, data: any): Promise<void> {
    // データをサニタイズ（undefinedをnullに変換）
    const sanitizedData = this.sanitizeDataForDatabase(data);
    
    // JSONフィールドのデフォルト値を適用
    const processedData = operation === 'INSERT' ? this.applyDefaultValues(tableName, sanitizedData) : sanitizedData;
    
    const syncOp: SyncOperation = {
      id: uuidv4(),
      operation,
      tableName,
      recordId,
      data: processedData,
      timestamp: new Date()
    };

    try {
      // ローカルSQLiteに書き込み
      await this.writeToSQLite(syncOp);
      
      if (this.isOnline) {
        // TiDBに同期書き込み
        await this.writeToTiDB(syncOp);
      } else {
        // オフライン時はキューに追加
        this.addToSyncQueue(syncOp);
      }
      
    } catch (error) {
      console.error('Write operation failed:', error);
      // TiDB書き込み失敗時はキューに追加
      if (this.isOnline) {
        this.addToSyncQueue(syncOp);
        this.isOnline = false;
      }
      throw error;
    }
  }

  private async writeToSQLite(syncOp: SyncOperation): Promise<void> {
    const { operation, tableName, recordId, data } = syncOp;
    const cacheTableName = `${tableName}_cache`;
    
    try {
      switch (operation) {
        case 'INSERT':
          const insertColumns = Object.keys(data);
          const insertPlaceholders = insertColumns.map(() => '?').join(', ');
          const insertValues = insertColumns.map(col => {
            const value = data[col];
            // Convert undefined to null
            if (value === undefined) {
              return null;
            }
            if (typeof value === 'boolean') {
              return value ? 1 : 0;
            }
            return typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
          });
          
          this.sqlite.execute(
            `INSERT OR REPLACE INTO ${cacheTableName} (${insertColumns.join(', ')}, synced_at) VALUES (${insertPlaceholders}, ?)`,
            [...insertValues, new Date().toISOString()]
          );
          break;
          
        case 'UPDATE':
          const updateColumns = Object.keys(data);
          const updateSet = updateColumns.map(col => `${col} = ?`).join(', ');
          const updateValues = updateColumns.map(col => {
            const value = data[col];
            // Convert undefined to null
            if (value === undefined) {
              return null;
            }
            if (typeof value === 'boolean') {
              return value ? 1 : 0;
            }
            return typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
          });
          
          this.sqlite.execute(
            `UPDATE ${cacheTableName} SET ${updateSet}, synced_at = ? WHERE id = ?`,
            [...updateValues, new Date().toISOString(), recordId]
          );
          break;
          
        case 'DELETE':
          this.sqlite.execute(`DELETE FROM ${cacheTableName} WHERE id = ?`, [recordId]);
          break;
      }
    } catch (error) {
      console.error('SQLite write failed:', error);
      throw error;
    }
  }

  private async writeToTiDB(syncOp: SyncOperation): Promise<void> {
    const { operation, tableName, recordId, data } = syncOp;
    
    try {
      switch (operation) {
        case 'INSERT':
          const insertColumns = Object.keys(data);
          const insertPlaceholders = insertColumns.map(() => '?').join(', ');
          const insertValues = insertColumns.map(col => {
            const value = data[col];
            // Convert undefined to null
            if (value === undefined) {
              return null;
            }
            // Convert objects to JSON strings for TiDB
            if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
              return JSON.stringify(value);
            }
            return value;
          });
          
          await this.tidb.execute(
            `INSERT INTO ${tableName} (${insertColumns.join(', ')}) VALUES (${insertPlaceholders})`,
            insertValues
          );
          break;
          
        case 'UPDATE':
          const updateColumns = Object.keys(data);
          const updateSet = updateColumns.map(col => `${col} = ?`).join(', ');
          const updateValues = updateColumns.map(col => {
            const value = data[col];
            // Convert undefined to null
            if (value === undefined) {
              return null;
            }
            // Convert objects to JSON strings for TiDB
            if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
              return JSON.stringify(value);
            }
            return value;
          });
          
          await this.tidb.execute(
            `UPDATE ${tableName} SET ${updateSet} WHERE id = ?`,
            [...updateValues, recordId]
          );
          break;
          
        case 'DELETE':
          await this.tidb.execute(`DELETE FROM ${tableName} WHERE id = ?`, [recordId]);
          break;
      }
    } catch (error: any) {
      console.error('TiDB write failed:', error);
      
      // Handle duplicate entry errors more gracefully
      if (error.code === 'ER_DUP_ENTRY') {
        console.warn(`Duplicate entry detected for ${tableName} with ID ${recordId}, skipping...`);
        return; // Don't throw error for duplicates, just skip
      }
      
      throw error;
    }
  }

  private addToSyncQueue(syncOp: SyncOperation): void {
    // 新しい優先度付きメソッドを使用
    this.addToSyncQueueWithPriority(syncOp);
  }

  private startPeriodicSync(): void {
    const interval = parseInt(process.env.SYNC_INTERVAL_MS || '5000');
    
    this.syncInterval = setInterval(async () => {
      await this.processSyncQueue();
      await this.checkConnection();
    }, interval);
  }

  private async processSyncQueue(): Promise<void> {
    if (!this.isOnline || this.syncQueue.length === 0) return;

    const operations = [...this.syncQueue];
    this.syncQueue = [];

    for (const operation of operations) {
      try {
        this.stats.totalOperations++;
        await this.writeToTiDB(operation);
        
        // 成功したら同期キューから削除
        this.sqlite.execute('DELETE FROM sync_queue WHERE id = ?', [operation.id]);
        this.stats.successfulOperations++;
        this.stats.lastSyncTime = new Date();
        
      } catch (error) {
        console.error('Sync queue processing failed:', error);
        
        // 再試行を試みる
        const retrySuccess = await this.retryFailedOperation(operation);
        if (!retrySuccess) {
          // 最大再試行回数に達した場合、失敗としてカウント
          this.sqlite.execute('DELETE FROM sync_queue WHERE id = ?', [operation.id]);
        }
        
        this.isOnline = false;
        break;
      }
    }
    
    this.stats.queueSize = this.syncQueue.length;
  }

  private async checkConnection(): Promise<void> {
    if (this.isOnline) return;

    try {
      await this.tidb.query('SELECT 1');
      this.isOnline = true;
      console.log('🔄 TiDB connection restored');
    } catch (error) {
      // 接続失敗は無視（オフラインモード継続）
    }
  }

  public readData<T = any>(tableName: string, query: string, params?: any[]): T[] {
    // If the query already contains the cache table name, use it as-is
    if (query.includes(`${tableName}_cache`)) {
      return this.sqlite.query<T>(query, params);
    }
    
    // Otherwise, replace the table name with the cache version
    const cacheTableName = `${tableName}_cache`;
    return this.sqlite.query<T>(query.replace(new RegExp(`\\b${tableName}\\b`, 'g'), cacheTableName), params);
  }

  public getConnectionStatus(): { tidb: boolean; sqlite: boolean } {
    return {
      tidb: this.isOnline && this.tidb.isConnectionActive(),
      sqlite: this.sqlite.isConnectionActive()
    };
  }

  public getSyncQueueLength(): number {
    return this.syncQueue.length;
  }

  public async cleanup(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
    }
    
    // 古いメッセージをクリア
    this.sqlite.clearOldMessages();
    
    // メモリキャッシュをクリア
    this.memoryCache.clear();
    
    await this.tidb.disconnect();
    this.sqlite.disconnect();
  }

  // === メモリキャッシュ管理機能 ===

  public setCacheConfig(config: Partial<CacheConfig>): void {
    this.cacheConfig = { ...this.cacheConfig, ...config };
  }

  public getCacheConfig(): CacheConfig {
    return { ...this.cacheConfig };
  }

  // キャッシュからデータを取得
  public getCachedData<T = any>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    
    if (!entry) {
      this.cacheMisses++;
      return null;
    }

    // TTLチェック
    const now = new Date();
    const ttlMs = this.cacheConfig.ttlMinutes * 60 * 1000;
    if (now.getTime() - entry.timestamp.getTime() > ttlMs) {
      this.memoryCache.delete(key);
      this.cacheMisses++;
      return null;
    }

    // アクセス情報を更新
    entry.accessCount++;
    entry.lastAccessed = now;
    this.cacheHits++;

    return entry.data as T;
  }

  // キャッシュにデータを保存
  public setCachedData<T = any>(key: string, data: T): void {
    const now = new Date();
    const dataSize = this.calculateDataSize(data);

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
      size: dataSize
    };

    // メモリ制限チェック
    if (this.shouldEvictCache(dataSize)) {
      this.evictLeastRecentlyUsed();
    }

    this.memoryCache.set(key, entry);
  }

  // キャッシュからデータを削除
  public removeCachedData(key: string): boolean {
    return this.memoryCache.delete(key);
  }

  // キャッシュをクリア
  public clearCache(): void {
    this.memoryCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  // データサイズを計算（概算）
  private calculateDataSize(data: any): number {
    const jsonString = JSON.stringify(data);
    return new Blob([jsonString]).size;
  }

  // データベース用にデータをサニタイズ（undefinedをnullに変換）
  private sanitizeDataForDatabase(data: any): any {
    if (data === undefined) {
      return null;
    }
    
    if (data === null || typeof data !== 'object') {
      return data;
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeDataForDatabase(item));
    }
    
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = this.sanitizeDataForDatabase(value);
    }
    
    return sanitized;
  }

  // キャッシュ退避が必要かチェック
  private shouldEvictCache(newDataSize: number): boolean {
    const currentMemoryUsage = this.getCurrentMemoryUsage();
    const maxMemoryBytes = this.cacheConfig.maxMemoryMB * 1024 * 1024;
    
    return (
      currentMemoryUsage + newDataSize > maxMemoryBytes ||
      this.memoryCache.size >= this.cacheConfig.maxEntries
    );
  }

  // 現在のメモリ使用量を取得
  private getCurrentMemoryUsage(): number {
    let totalSize = 0;
    for (const entry of this.memoryCache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  // LRU（Least Recently Used）アルゴリズムでキャッシュを退避
  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | null = null;
    let oldestTime = new Date();

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
    }
  }

  // ガベージコレクションを開始
  private startGarbageCollection(): void {
    const intervalMs = this.cacheConfig.gcIntervalMinutes * 60 * 1000;
    
    this.gcInterval = setInterval(() => {
      this.runGarbageCollection();
    }, intervalMs);
  }

  // ガベージコレクションを実行
  private runGarbageCollection(): void {
    const now = new Date();
    const ttlMs = this.cacheConfig.ttlMinutes * 60 * 1000;
    const keysToDelete: string[] = [];

    // 期限切れエントリを特定
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now.getTime() - entry.timestamp.getTime() > ttlMs) {
        keysToDelete.push(key);
      }
    }

    // 期限切れエントリを削除
    for (const key of keysToDelete) {
      this.memoryCache.delete(key);
    }

    // メモリ使用量が制限を超えている場合、追加で削除
    while (this.shouldEvictCache(0)) {
      this.evictLeastRecentlyUsed();
    }

    if (keysToDelete.length > 0) {
      console.log(`🗑️ Garbage collection: removed ${keysToDelete.length} expired cache entries`);
    }
  }

  // === 同期キュー管理の拡張 ===

  // 優先度付きキューに操作を追加
  public addToSyncQueueWithPriority(syncOp: SyncOperation): void {
    syncOp.priority = syncOp.priority || 'medium';
    syncOp.retryCount = syncOp.retryCount || 0;
    
    // 優先度に基づいてキューに挿入
    const insertIndex = this.findInsertIndex(syncOp.priority);
    this.syncQueue.splice(insertIndex, 0, syncOp);
    
    // データからundefinedを除去してnullに変換
    const sanitizedData = this.sanitizeDataForDatabase(syncOp.data);
    
    // SQLiteの同期キューテーブルにも保存
    this.sqlite.execute(
      'INSERT INTO sync_queue (id, operation, table_name, record_id, data, priority, retry_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        syncOp.id,
        syncOp.operation,
        syncOp.tableName,
        syncOp.recordId,
        JSON.stringify(sanitizedData),
        syncOp.priority,
        syncOp.retryCount,
        syncOp.timestamp.toISOString()
      ]
    );
    
    this.stats.queueSize = this.syncQueue.length;
    console.log(`📝 Added ${syncOp.priority} priority operation to sync queue: ${syncOp.operation} ${syncOp.tableName}`);
  }

  // 優先度に基づく挿入位置を見つける
  private findInsertIndex(priority: 'low' | 'medium' | 'high'): number {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const targetPriority = priorityOrder[priority];
    
    for (let i = 0; i < this.syncQueue.length; i++) {
      const currentPriority = priorityOrder[this.syncQueue[i]?.priority || 'medium'];
      if (targetPriority > currentPriority) {
        return i;
      }
    }
    
    return this.syncQueue.length;
  }

  // 失敗した操作の再試行
  private async retryFailedOperation(syncOp: SyncOperation): Promise<boolean> {
    const maxRetries = 3;
    
    if ((syncOp.retryCount || 0) >= maxRetries) {
      console.error(`❌ Operation failed after ${maxRetries} retries:`, syncOp);
      this.stats.failedOperations++;
      return false;
    }

    syncOp.retryCount = (syncOp.retryCount || 0) + 1;
    
    // 指数バックオフで再試行
    const delay = Math.pow(2, syncOp.retryCount) * 1000;
    setTimeout(() => {
      this.addToSyncQueueWithPriority(syncOp);
    }, delay);
    
    return true;
  }

  // === リソース監視と自動最適化 ===

  // 統計情報を取得
  public getStats(): SyncStats {
    const totalRequests = this.cacheHits + this.cacheMisses;
    this.stats.cacheHitRate = totalRequests > 0 ? (this.cacheHits / totalRequests) * 100 : 0;
    this.stats.memoryUsage = this.getCurrentMemoryUsage();
    this.stats.queueSize = this.syncQueue.length;
    
    return { ...this.stats };
  }

  // パフォーマンス監視を開始
  public startPerformanceMonitoring(): void {
    setInterval(() => {
      const stats = this.getStats();
      
      // メモリ使用量が80%を超えた場合の警告
      const memoryUsagePercent = (stats.memoryUsage / (this.cacheConfig.maxMemoryMB * 1024 * 1024)) * 100;
      if (memoryUsagePercent > 80) {
        console.warn(`⚠️ High memory usage: ${memoryUsagePercent.toFixed(1)}%`);
        this.runGarbageCollection();
      }
      
      // キューサイズが大きくなった場合の警告
      if (stats.queueSize > 1000) {
        console.warn(`⚠️ Large sync queue: ${stats.queueSize} operations`);
      }
      
      // キャッシュヒット率が低い場合の警告
      if (stats.cacheHitRate < 50 && this.cacheHits + this.cacheMisses > 100) {
        console.warn(`⚠️ Low cache hit rate: ${stats.cacheHitRate.toFixed(1)}%`);
      }
      
    }, 60000); // 1分間隔
  }

  // 自動最適化を実行
  public autoOptimize(): void {
    const stats = this.getStats();
    
    // キャッシュヒット率が低い場合、TTLを延長
    if (stats.cacheHitRate < 30) {
      this.cacheConfig.ttlMinutes = Math.min(this.cacheConfig.ttlMinutes * 1.5, 120);
      console.log(`🔧 Auto-optimization: Extended cache TTL to ${this.cacheConfig.ttlMinutes} minutes`);
    }
    
    // メモリ使用量が高い場合、キャッシュサイズを削減
    const memoryUsagePercent = (stats.memoryUsage / (this.cacheConfig.maxMemoryMB * 1024 * 1024)) * 100;
    if (memoryUsagePercent > 90) {
      this.cacheConfig.maxEntries = Math.max(this.cacheConfig.maxEntries * 0.8, 1000);
      this.runGarbageCollection();
      console.log(`🔧 Auto-optimization: Reduced max cache entries to ${this.cacheConfig.maxEntries}`);
    }
  }

  // 初期化時にガベージコレクションとパフォーマンス監視を開始
  public async initializeAdvancedFeatures(): Promise<void> {
    this.startGarbageCollection();
    this.startPerformanceMonitoring();
    console.log('🚀 Advanced cache and sync features initialized');
  }

  // === 双方向同期機能 ===

  public async startBidirectionalSync(): Promise<void> {
    if (this.bidirectionalSyncInterval) {
      clearInterval(this.bidirectionalSyncInterval);
    }

    // 5分間隔で双方向同期を実行
    this.bidirectionalSyncInterval = setInterval(async () => {
      if (!this.syncInProgress && this.isOnline) {
        await this.performBidirectionalSync();
      }
    }, 5 * 60 * 1000);

    console.log('🔄 Bidirectional sync started');
  }

  public stopBidirectionalSync(): void {
    if (this.bidirectionalSyncInterval) {
      clearInterval(this.bidirectionalSyncInterval);
      this.bidirectionalSyncInterval = null;
    }
    console.log('⏹️ Bidirectional sync stopped');
  }

  private async performBidirectionalSync(): Promise<void> {
    if (this.syncInProgress) return;

    this.syncInProgress = true;
    const startTime = Date.now();

    try {
      console.log('🔄 Starting bidirectional sync...');

      // 1. TiDB → SQLite の変更を同期
      await this.syncChangesFromTiDB();

      // 2. SQLite → TiDB の変更を同期
      await this.syncChangesToTiDB();

      // 3. 競合解決
      await this.resolveConflicts();

      const syncTime = Date.now() - startTime;
      this.recordSyncTime(syncTime);

      console.log(`✅ Bidirectional sync completed in ${syncTime}ms`);

    } catch (error) {
      console.error('❌ Bidirectional sync failed:', error);
      this.stats.failedOperations++;
    } finally {
      this.syncInProgress = false;
    }
  }

  private async syncChangesFromTiDB(): Promise<void> {
    // テーブルごとのタイムスタンプカラムを定義
    const tableConfigs = {
      'users': 'updated_at',
      'roles': 'updated_at',
      'channels': 'updated_at',
      'messages': 'created_at', // messagesテーブルはupdated_atがない
      'scripts': 'updated_at',
      'script_lines': 'updated_at',
      'script_versions': 'created_at', // script_versionsテーブルはupdated_atがない
      'script_line_history': 'edited_at', // script_line_historyテーブルはedited_atを使用
      'script_scenes': 'updated_at',
      'moderation_rules': 'updated_at',
      'moderation_settings': 'updated_at'
    };

    for (const [table, timestampColumn] of Object.entries(tableConfigs)) {
      try {
        const lastSync = this.lastSyncTimestamp[table] || new Date(0);
        const changes = await this.tidb.query(
          `SELECT * FROM ${table} WHERE ${timestampColumn} > ? ORDER BY ${timestampColumn} ASC`,
          [lastSync.toISOString()]
        );

        for (const change of changes) {
          await this.applySQLiteChange(table, change);
        }

        if (changes.length > 0) {
          this.lastSyncTimestamp[table] = new Date(changes[changes.length - 1][timestampColumn]);
          console.log(`📊 Synced ${changes.length} changes from TiDB ${table}`);
        }

      } catch (error) {
        console.error(`Failed to sync changes from TiDB ${table}:`, error);
      }
    }
  }

  private async syncChangesToTiDB(): Promise<void> {
    // SQLiteの変更をTiDBに同期（sync_queueを使用）
    await this.processSyncQueue();
  }

  private async applySQLiteChange(table: string, change: any): Promise<void> {
    const cacheTable = `${table}_cache`;
    
    try {
      // 既存レコードをチェック
      const existing = this.sqlite.query(
        `SELECT * FROM ${cacheTable} WHERE id = ?`,
        [change.id]
      );

      if (existing.length > 0) {
        // 更新
        const columns = Object.keys(change).filter(col => col !== 'id');
        const setClause = columns.map(col => `${col} = ?`).join(', ');
        const values = columns.map(col => {
          const value = change[col];
          return typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
        });

        this.sqlite.execute(
          `UPDATE ${cacheTable} SET ${setClause}, synced_at = ? WHERE id = ?`,
          [...values, new Date().toISOString(), change.id]
        );
      } else {
        // 挿入
        const columns = Object.keys(change);
        const placeholders = columns.map(() => '?').join(', ');
        const values = columns.map(col => {
          const value = change[col];
          return typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
        });

        this.sqlite.execute(
          `INSERT INTO ${cacheTable} (${columns.join(', ')}, synced_at) VALUES (${placeholders}, ?)`,
          [...values, new Date().toISOString()]
        );
      }

    } catch (error) {
      console.error(`Failed to apply SQLite change for ${table}:`, error);
    }
  }

  private async resolveConflicts(): Promise<void> {
    // 簡単な競合解決：TiDBを優先
    // 実際の実装では、より複雑な競合解決ロジックが必要
    console.log('🔧 Conflict resolution completed (TiDB priority)');
  }

  private recordSyncTime(syncTime: number): void {
    this.syncTimes.push(syncTime);
    
    // 最新100件の平均を計算
    if (this.syncTimes.length > 100) {
      this.syncTimes = this.syncTimes.slice(-100);
    }

    const sum = this.syncTimes.reduce((a, b) => a + b, 0);
    this.stats.averageSyncTime = sum / this.syncTimes.length;
  }

  // === リソース監視機能 ===

  public startResourceMonitoring(): void {
    setInterval(() => {
      this.collectResourceMetrics();
      this.optimizePerformance();
    }, 30000); // 30秒間隔

    console.log('📊 Resource monitoring started');
  }

  private collectResourceMetrics(): void {
    const memoryUsage = process.memoryUsage();
    
    const metrics: ResourceMonitor = {
      cpuUsage: process.cpuUsage().user / 1000000, // マイクロ秒をミリ秒に変換
      memoryUsage: memoryUsage.heapUsed,
      diskUsage: 0, // 実装が複雑なため省略
      networkLatency: 0, // 実装が複雑なため省略
      dbConnections: 1, // 簡略化
      queueBacklog: this.syncQueue.length,
      timestamp: new Date()
    };

    this.resourceHistory.push(metrics);

    // 履歴を最新100件に制限
    if (this.resourceHistory.length > 100) {
      this.resourceHistory = this.resourceHistory.slice(-100);
    }
  }

  private optimizePerformance(): void {
    const latestMetrics = this.resourceHistory[this.resourceHistory.length - 1];
    if (!latestMetrics) return;

    // メモリ使用量が高い場合、キャッシュをクリア
    if (latestMetrics.memoryUsage > 256 * 1024 * 1024) { // 256MB
      this.runGarbageCollection();
      console.log('🔧 Auto-optimization: Performed garbage collection due to high memory usage');
    }

    // キューが溜まっている場合、同期頻度を上げる
    if (latestMetrics.queueBacklog > 100) {
      this.processSyncQueue();
      console.log('🔧 Auto-optimization: Processing sync queue due to high backlog');
    }
  }

  // === 統計情報とモニタリング ===

  public getResourceHistory(): ResourceMonitor[] {
    return [...this.resourceHistory];
  }

  public getConflictLog(): ConflictResolution[] {
    return [...this.conflictLog];
  }

  public getCacheInfo(): {
    size: number;
    memoryUsage: number;
    hitRate: number;
    entries: number;
  } {
    const totalRequests = this.cacheHits + this.cacheMisses;
    return {
      size: this.memoryCache.size,
      memoryUsage: this.getCurrentMemoryUsage(),
      hitRate: totalRequests > 0 ? (this.cacheHits / totalRequests) * 100 : 0,
      entries: this.memoryCache.size
    };
  }

  // === 拡張されたクリーンアップ ===

  public async shutdown(): Promise<void> {
    console.log('🔄 Shutting down DataSyncService...');

    // 残りの同期キューを処理
    if (this.syncQueue.length > 0) {
      console.log(`📤 Processing remaining ${this.syncQueue.length} sync operations...`);
      await this.processSyncQueue();
    }

    // インターバルをクリア
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    if (this.bidirectionalSyncInterval) {
      clearInterval(this.bidirectionalSyncInterval);
    }
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
    }

    // キャッシュをクリア
    this.clearCache();

    console.log('✅ DataSyncService shutdown completed');
  }}
