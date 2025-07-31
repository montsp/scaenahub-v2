import Database from 'better-sqlite3';
import { join } from 'path';

export class SQLiteService {
  private static instance: SQLiteService;
  private db: Database.Database | null = null;
  private isConnected = false;

  private constructor() {}

  public static getInstance(): SQLiteService {
    if (!SQLiteService.instance) {
      SQLiteService.instance = new SQLiteService();
    }
    return SQLiteService.instance;
  }

  public connect(): void {
    try {
      const dbPath = join(process.cwd(), 'data', 'cache.db');
      
      // データディレクトリが存在しない場合は作成
      const fs = require('fs');
      const dataDir = join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 1000');
      this.db.pragma('temp_store = memory');
      
      this.isConnected = true;
      console.log('✅ Connected to SQLite cache database');
      
      this.createTables();
      
    } catch (error) {
      this.isConnected = false;
      console.error('❌ Failed to connect to SQLite:', error);
      throw error;
    }
  }

  public disconnect(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isConnected = false;
      console.log('🔌 Disconnected from SQLite cache');
    }
  }

  public query<T = any>(sql: string, params?: any[]): T[] {
    if (!this.isConnected || !this.db) {
      throw new Error('SQLite connection not established');
    }

    try {
      const stmt = this.db.prepare(sql);
      const result = params ? stmt.all(...params) : stmt.all();
      return result as T[];
    } catch (error) {
      console.error('SQLite Query Error:', error);
      throw error;
    }
  }

  public execute(sql: string, params?: any[]): Database.RunResult {
    if (!this.isConnected || !this.db) {
      throw new Error('SQLite connection not established');
    }

    try {
      const stmt = this.db.prepare(sql);
      return params ? stmt.run(...params) : stmt.run();
    } catch (error) {
      console.error('SQLite Execute Error:', error);
      throw error;
    }
  }

  public get<T = any>(sql: string, params?: any[]): T | undefined {
    if (!this.isConnected || !this.db) {
      throw new Error('SQLite connection not established');
    }

    try {
      const stmt = this.db.prepare(sql);
      return params ? stmt.get(...params) as T : stmt.get() as T;
    } catch (error) {
      console.error('SQLite Get Error:', error);
      throw error;
    }
  }

  public isConnectionActive(): boolean {
    return this.isConnected;
  }

  private createTables(): void {
    const tables = [
      // Users cache table
      `CREATE TABLE IF NOT EXISTS users_cache (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        roles TEXT,
        display_name TEXT NOT NULL,
        avatar TEXT,
        bio TEXT,
        online_status TEXT DEFAULT 'offline',
        custom_status TEXT,
        is_active INTEGER DEFAULT 1,
        is_banned INTEGER DEFAULT 0,
        last_seen TEXT DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      // Roles cache table
      `CREATE TABLE IF NOT EXISTS roles_cache (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        color TEXT DEFAULT '#99AAB5',
        position INTEGER DEFAULT 0,
        permissions TEXT,
        is_default INTEGER DEFAULT 0,
        mentionable INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      // Categories cache table
      `CREATE TABLE IF NOT EXISTS categories_cache (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        position INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      // Channels cache table
      `CREATE TABLE IF NOT EXISTS channels_cache (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT DEFAULT 'text',
        category_id TEXT,
        position INTEGER DEFAULT 0,
        is_private INTEGER DEFAULT 0,
        permissions TEXT,
        allowed_roles TEXT,
        allowed_users TEXT,
        settings TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      // Messages cache table (最新のメッセージのみ)
      `CREATE TABLE IF NOT EXISTS messages_cache (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT DEFAULT 'text',
        thread_id TEXT,
        parent_message_id TEXT,
        mentions TEXT,
        reactions TEXT,
        attachments TEXT,
        embeds TEXT,
        is_pinned INTEGER DEFAULT 0,
        is_edited INTEGER DEFAULT 0,
        edited_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      // Scripts cache table
      `CREATE TABLE IF NOT EXISTS scripts_cache (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        is_active INTEGER DEFAULT 1,
        permissions TEXT DEFAULT '{"viewRoles": [], "editRoles": [], "viewUsers": [], "editUsers": []}',
        created_by TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      // Script lines cache table
      `CREATE TABLE IF NOT EXISTS script_lines_cache (
        id TEXT PRIMARY KEY,
        script_id TEXT NOT NULL,
        line_number INTEGER NOT NULL,
        character_name TEXT DEFAULT '',
        dialogue TEXT DEFAULT '',
        lighting TEXT DEFAULT '',
        audio_video TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        formatting TEXT DEFAULT '{"bold": false, "underline": false, "italic": false, "color": "#000000"}',
        last_edited_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(script_id, line_number)
      )`,

      // Script versions cache table
      `CREATE TABLE IF NOT EXISTS script_versions_cache (
        id TEXT PRIMARY KEY,
        script_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        change_description TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(script_id, version)
      )`,

      // Script line history cache table
      `CREATE TABLE IF NOT EXISTS script_line_history_cache (
        id TEXT PRIMARY KEY,
        script_line_id TEXT,
        script_id TEXT NOT NULL,
        line_number INTEGER NOT NULL,
        character_name TEXT DEFAULT '',
        dialogue TEXT DEFAULT '',
        lighting TEXT DEFAULT '',
        audio_video TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        formatting TEXT DEFAULT '{"bold": false, "underline": false, "italic": false, "color": "#000000"}',
        change_type TEXT NOT NULL,
        change_description TEXT,
        edited_by TEXT NOT NULL,
        edited_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      // Script locks cache table
      `CREATE TABLE IF NOT EXISTS script_locks_cache (
        id TEXT PRIMARY KEY,
        script_id TEXT NOT NULL,
        line_number INTEGER,
        locked_by TEXT NOT NULL,
        locked_at TEXT DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT NOT NULL,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(script_id, line_number)
      )`,

      // Script edit sessions cache table
      `CREATE TABLE IF NOT EXISTS script_edit_sessions_cache (
        id TEXT PRIMARY KEY,
        script_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        started_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_activity TEXT DEFAULT CURRENT_TIMESTAMP,
        is_active INTEGER DEFAULT 1,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(script_id, user_id)
      )`,

      // Script scenes cache table
      `CREATE TABLE IF NOT EXISTS script_scenes_cache (
        id TEXT PRIMARY KEY,
        script_id TEXT NOT NULL,
        scene_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        start_line_number INTEGER NOT NULL,
        end_line_number INTEGER NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(script_id, scene_number)
      )`,

      // Script print settings cache table
      `CREATE TABLE IF NOT EXISTS script_print_settings_cache (
        id TEXT PRIMARY KEY,
        script_id TEXT NOT NULL,
        page_size TEXT DEFAULT 'A4',
        orientation TEXT DEFAULT 'portrait',
        font_size INTEGER DEFAULT 12,
        line_spacing REAL DEFAULT 1.5,
        margin_top INTEGER DEFAULT 20,
        margin_bottom INTEGER DEFAULT 20,
        margin_left INTEGER DEFAULT 20,
        margin_right INTEGER DEFAULT 20,
        include_notes INTEGER DEFAULT 1,
        include_lighting INTEGER DEFAULT 1,
        include_audio_video INTEGER DEFAULT 1,
        scene_breaks INTEGER DEFAULT 1,
        created_by TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(script_id)
      )`,

      // Moderation rules cache table
      `CREATE TABLE IF NOT EXISTS moderation_rules_cache (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        severity TEXT DEFAULT 'medium',
        action TEXT NOT NULL,
        config TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      // Moderation settings cache table
      `CREATE TABLE IF NOT EXISTS moderation_settings_cache (
        id TEXT PRIMARY KEY DEFAULT 'default',
        settings TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      // User timeouts cache table
      `CREATE TABLE IF NOT EXISTS user_timeouts_cache (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        reason TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      // Moderation logs cache table
      `CREATE TABLE IF NOT EXISTS moderation_logs_cache (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        target_user_id TEXT,
        moderator_id TEXT NOT NULL,
        reason TEXT,
        rule_id TEXT,
        message_id TEXT,
        channel_id TEXT,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      // Server settings cache table
      `CREATE TABLE IF NOT EXISTS server_settings_cache (
        id INTEGER PRIMARY KEY DEFAULT 1,
        server_name TEXT NOT NULL DEFAULT 'ScaenaHub v2',
        description TEXT DEFAULT 'Theater project communication platform',
        icon_url TEXT,
        default_role TEXT DEFAULT 'member',
        welcome_channel_id TEXT,
        rules_channel_id TEXT,
        max_members INTEGER DEFAULT 100,
        invite_enabled INTEGER DEFAULT 1,
        public_server INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      // Sync queue table (オフライン時の操作を記録)
      `CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation TEXT NOT NULL,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        data TEXT NOT NULL,
        priority INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        attempts INTEGER DEFAULT 0,
        retry_count INTEGER DEFAULT 0,
        last_attempt TEXT,
        status TEXT DEFAULT 'pending'
      )`
    ];

    for (const table of tables) {
      try {
        this.execute(table);
      } catch (error) {
        console.error('❌ Failed to create SQLite table:', error);
        throw error;
      }
    }

    // Migrate existing sync_queue table to add missing columns if they don't exist
    try {
      const tableInfo = this.query(`PRAGMA table_info(sync_queue)`);
      const hasPriorityColumn = tableInfo.some((col: any) => col.name === 'priority');
      const hasRetryCountColumn = tableInfo.some((col: any) => col.name === 'retry_count');
      
      if (!hasPriorityColumn) {
        console.log('🔄 Adding priority column to sync_queue table...');
        this.execute('ALTER TABLE sync_queue ADD COLUMN priority INTEGER DEFAULT 0');
        console.log('✅ Priority column added to sync_queue table');
      }
      
      if (!hasRetryCountColumn) {
        console.log('🔄 Adding retry_count column to sync_queue table...');
        this.execute('ALTER TABLE sync_queue ADD COLUMN retry_count INTEGER DEFAULT 0');
        console.log('✅ Retry_count column added to sync_queue table');
      }
    } catch (error) {
      console.error('❌ Failed to migrate sync_queue table:', error);
    }

    // インデックス作成
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_username ON users_cache(username)',
      'CREATE INDEX IF NOT EXISTS idx_users_online_status ON users_cache(online_status)',
      'CREATE INDEX IF NOT EXISTS idx_channels_type ON channels_cache(type)',
      'CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages_cache(channel_id)',
      'CREATE INDEX IF NOT EXISTS idx_messages_created ON messages_cache(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status)',
      'CREATE INDEX IF NOT EXISTS idx_scripts_active ON scripts_cache(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_scripts_created_by ON scripts_cache(created_by)',
      'CREATE INDEX IF NOT EXISTS idx_script_lines_script ON script_lines_cache(script_id)',
      'CREATE INDEX IF NOT EXISTS idx_script_lines_number ON script_lines_cache(script_id, line_number)',
      'CREATE INDEX IF NOT EXISTS idx_script_versions_script ON script_versions_cache(script_id, version)',
      'CREATE INDEX IF NOT EXISTS idx_script_line_history_script ON script_line_history_cache(script_id, line_number)',
      'CREATE INDEX IF NOT EXISTS idx_script_line_history_edited ON script_line_history_cache(edited_by, edited_at)',
      'CREATE INDEX IF NOT EXISTS idx_script_locks_expires ON script_locks_cache(expires_at)',
      'CREATE INDEX IF NOT EXISTS idx_script_sessions_active ON script_edit_sessions_cache(script_id, is_active)',
      'CREATE INDEX IF NOT EXISTS idx_script_sessions_activity ON script_edit_sessions_cache(last_activity)',
      'CREATE INDEX IF NOT EXISTS idx_script_scenes_script ON script_scenes_cache(script_id, scene_number)',
      'CREATE INDEX IF NOT EXISTS idx_script_scenes_lines ON script_scenes_cache(script_id, start_line_number, end_line_number)'
    ];

    for (const index of indexes) {
      try {
        this.execute(index);
      } catch (error) {
        // インデックスが既に存在する場合は無視
      }
    }

    console.log('🗄️ All SQLite cache tables created/verified successfully');
    
    // Run migrations
    this.runMigrations();
  }

  private runMigrations(): void {
    try {
      // Migration: Add updated_at column to categories_cache table if it doesn't exist
      const categoriesTableInfo = this.query(`PRAGMA table_info(categories_cache)`);
      const hasUpdatedAt = categoriesTableInfo.some((col: any) => col.name === 'updated_at');
      
      if (!hasUpdatedAt) {
        this.execute(`ALTER TABLE categories_cache ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP`);
        console.log('✅ Migration: Added updated_at column to categories_cache table');
      }

      // Migration: Check and add missing columns to channels_cache table
      const channelsTableInfo = this.query(`PRAGMA table_info(channels_cache)`);
      const channelColumnNames = channelsTableInfo.map((col: any) => col.name);
      
      // Add missing columns one by one
      const requiredColumns = [
        { name: 'permissions', definition: 'TEXT' },
        { name: 'allowed_roles', definition: 'TEXT' },
        { name: 'allowed_users', definition: 'TEXT' },
        { name: 'settings', definition: 'TEXT' },
        { name: 'updated_at', definition: 'TEXT DEFAULT CURRENT_TIMESTAMP' }
      ];

      for (const column of requiredColumns) {
        if (!channelColumnNames.includes(column.name)) {
          this.execute(`ALTER TABLE channels_cache ADD COLUMN ${column.name} ${column.definition}`);
          console.log(`✅ Migration: Added ${column.name} column to channels_cache table`);
        }
      }
      
    } catch (error) {
      console.error('❌ SQLite migration failed:', error);
      // Don't throw error to prevent startup failure
    }
  }

  public clearOldMessages(olderThanHours: number = 24): void {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();
    
    try {
      const result = this.execute(
        'DELETE FROM messages_cache WHERE created_at < ? AND is_pinned = 0',
        [cutoffTime]
      );
      
      if (result.changes > 0) {
        console.log(`🧹 Cleared ${result.changes} old messages from cache`);
      }
    } catch (error) {
      console.error('Failed to clear old messages:', error);
    }
  }

  public getMemoryUsage(): { used: number; total: number } {
    if (!this.db) return { used: 0, total: 0 };
    
    try {
      const result = this.get<{ page_count: number; page_size: number }>(
        'PRAGMA page_count; PRAGMA page_size;'
      );
      
      return {
        used: (result?.page_count || 0) * (result?.page_size || 0),
        total: parseInt(process.env.CACHE_SIZE_MB || '100') * 1024 * 1024
      };
    } catch (error) {
      return { used: 0, total: 0 };
    }
  }
}