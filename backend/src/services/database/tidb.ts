import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { join } from 'path';

export class TiDBService {
  private static instance: TiDBService;
  private connection: mysql.Connection | null = null;
  private isConnected = false;

  private constructor() {}

  public static getInstance(): TiDBService {
    if (!TiDBService.instance) {
      TiDBService.instance = new TiDBService();
    }
    return TiDBService.instance;
  }

  public async connect(): Promise<void> {
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        if (!process.env.TIDB_HOST || !process.env.TIDB_USER || !process.env.TIDB_PASSWORD || !process.env.TIDB_DATABASE) {
          throw new Error('Missing required TiDB environment variables');
        }

        const config: mysql.ConnectionOptions = {
          host: process.env.TIDB_HOST,
          port: parseInt(process.env.TIDB_PORT || '4000'),
          user: process.env.TIDB_USER,
          password: process.env.TIDB_PASSWORD,
          database: process.env.TIDB_DATABASE,
          connectTimeout: 15000,
          charset: 'utf8mb4',
          ssl: {
            rejectUnauthorized: false // TiDB Cloudでは通常falseに設定
          }
        };

        // カスタムCA証明書が指定されている場合
        if (process.env.TIDB_SSL_CA) {
          config.ssl = {
            ca: readFileSync(join(process.cwd(), process.env.TIDB_SSL_CA)),
            rejectUnauthorized: true
          };
        }

        this.connection = await mysql.createConnection(config);
        this.isConnected = true;
        
        console.log('✅ Connected to TiDB Cloud Serverless');
        
        // 接続テスト
        await this.connection.execute('SELECT 1 as test');
        return;
        
      } catch (error) {
        retryCount++;
        this.isConnected = false;
        console.error(`❌ Failed to connect to TiDB (attempt ${retryCount}/${maxRetries}):`, error);
        
        if (retryCount >= maxRetries) {
          console.error('❌ Max TiDB connection retries reached. System will continue with SQLite only.');
          throw error;
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
      }
    }
  }

  public async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
      this.isConnected = false;
      console.log('🔌 Disconnected from TiDB');
    }
  }

  public async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.isConnected || !this.connection) {
      throw new Error('TiDB connection not established');
    }

    try {
      const [rows] = await this.connection.execute(sql, params);
      return rows as T[];
    } catch (error) {
      console.error('TiDB Query Error:', error);
      throw error;
    }
  }

  public async execute(sql: string, params?: any[]): Promise<mysql.ResultSetHeader> {
    if (!this.isConnected || !this.connection) {
      throw new Error('TiDB connection not established');
    }

    try {
      const [result] = await this.connection.execute(sql, params);
      return result as mysql.ResultSetHeader;
    } catch (error) {
      console.error('TiDB Execute Error:', error);
      throw error;
    }
  }

  public isConnectionActive(): boolean {
    return this.isConnected;
  }

  public async createTables(): Promise<void> {
    const tables = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        roles JSON,
        display_name VARCHAR(100) NOT NULL,
        avatar TEXT,
        bio TEXT,
        online_status ENUM('online', 'away', 'busy', 'offline') DEFAULT 'offline',
        custom_status JSON,
        is_active BOOLEAN DEFAULT TRUE,
        is_banned BOOLEAN DEFAULT FALSE,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_username (username),
        INDEX idx_online_status (online_status),
        INDEX idx_last_seen (last_seen)
      )`,

      // Roles table
      `CREATE TABLE IF NOT EXISTS roles (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        color VARCHAR(7) DEFAULT '#99AAB5',
        position INT DEFAULT 0,
        permissions JSON,
        is_default BOOLEAN DEFAULT FALSE,
        mentionable BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_position (position)
      )`,

      // Categories table
      `CREATE TABLE IF NOT EXISTS categories (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        position INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_position (position)
      )`,

      // Channels table
      `CREATE TABLE IF NOT EXISTS channels (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        type ENUM('text', 'announcement', 'discussion') DEFAULT 'text',
        category_id VARCHAR(36),
        position INT DEFAULT 0,
        is_private BOOLEAN DEFAULT FALSE,
        permissions JSON,
        allowed_roles JSON,
        allowed_users JSON,
        settings JSON,
        created_by VARCHAR(36),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id),
        INDEX idx_type (type),
        INDEX idx_category (category_id),
        INDEX idx_position (position)
      )`,

      // Messages table
      `CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(36) PRIMARY KEY,
        channel_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        content TEXT NOT NULL,
        type ENUM('text', 'file', 'system', 'announcement') DEFAULT 'text',
        thread_id VARCHAR(36),
        parent_message_id VARCHAR(36),
        mentions JSON,
        reactions JSON,
        attachments JSON,
        embeds JSON,
        is_pinned BOOLEAN DEFAULT FALSE,
        is_edited BOOLEAN DEFAULT FALSE,
        edited_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (parent_message_id) REFERENCES messages(id) ON DELETE CASCADE,
        INDEX idx_channel_created (channel_id, created_at),
        INDEX idx_thread (thread_id),
        INDEX idx_pinned (is_pinned),
        INDEX idx_user_created (user_id, created_at)
      )`,

      // Moderation rules table
      `CREATE TABLE IF NOT EXISTS moderation_rules (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type ENUM('word_filter', 'spam_detection', 'link_filter', 'caps_filter') NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        severity ENUM('low', 'medium', 'high') DEFAULT 'medium',
        action ENUM('warn', 'delete', 'timeout', 'kick', 'ban') NOT NULL,
        config JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_type (type),
        INDEX idx_enabled (enabled)
      )`,

      // Moderation settings table
      `CREATE TABLE IF NOT EXISTS moderation_settings (
        id VARCHAR(36) PRIMARY KEY DEFAULT 'default',
        settings JSON NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,

      // User timeouts table
      `CREATE TABLE IF NOT EXISTS user_timeouts (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        INDEX idx_user_expires (user_id, expires_at)
      )`,

      // Moderation logs table
      `CREATE TABLE IF NOT EXISTS moderation_logs (
        id VARCHAR(36) PRIMARY KEY,
        action ENUM('kick', 'ban', 'unban', 'warn', 'delete_message', 'timeout') NOT NULL,
        target_user_id VARCHAR(36),
        moderator_id VARCHAR(36) NOT NULL,
        reason TEXT,
        rule_id VARCHAR(36),
        message_id VARCHAR(36),
        channel_id VARCHAR(36),
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (target_user_id) REFERENCES users(id),
        FOREIGN KEY (moderator_id) REFERENCES users(id),
        FOREIGN KEY (rule_id) REFERENCES moderation_rules(id),
        FOREIGN KEY (message_id) REFERENCES messages(id),
        FOREIGN KEY (channel_id) REFERENCES channels(id),
        INDEX idx_target_user (target_user_id),
        INDEX idx_moderator (moderator_id),
        INDEX idx_rule (rule_id),
        INDEX idx_created (created_at)
      )`,

      // Scripts table
      `CREATE TABLE IF NOT EXISTS scripts (
        id VARCHAR(36) PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        permissions JSON NOT NULL,
        created_by VARCHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id),
        INDEX idx_active (is_active),
        INDEX idx_created_by (created_by)
      )`,

      // Script lines table
      `CREATE TABLE IF NOT EXISTS script_lines (
        id VARCHAR(36) PRIMARY KEY,
        script_id VARCHAR(36) NOT NULL,
        line_number INT NOT NULL,
        character_name VARCHAR(100) NOT NULL DEFAULT '',
        dialogue TEXT NOT NULL,
        lighting TEXT NOT NULL,
        audio_video TEXT NOT NULL,
        notes TEXT NOT NULL,
        formatting JSON NOT NULL,
        last_edited_by VARCHAR(36),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE,
        FOREIGN KEY (last_edited_by) REFERENCES users(id),
        UNIQUE KEY unique_script_line (script_id, line_number),
        INDEX idx_script_line (script_id, line_number),
        INDEX idx_last_edited (last_edited_by)
      )`,

      // Script versions table (バージョン管理)
      `CREATE TABLE IF NOT EXISTS script_versions (
        id VARCHAR(36) PRIMARY KEY,
        script_id VARCHAR(36) NOT NULL,
        version INT NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        change_description TEXT NOT NULL,
        created_by VARCHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id),
        UNIQUE KEY unique_script_version (script_id, version),
        INDEX idx_script_version (script_id, version)
      )`,

      // Script line history table (行編集履歴)
      `CREATE TABLE IF NOT EXISTS script_line_history (
        id VARCHAR(36) PRIMARY KEY,
        script_line_id VARCHAR(36),
        script_id VARCHAR(36) NOT NULL,
        line_number INT NOT NULL,
        character_name VARCHAR(100) NOT NULL DEFAULT '',
        dialogue TEXT NOT NULL,
        lighting TEXT NOT NULL,
        audio_video TEXT NOT NULL,
        notes TEXT NOT NULL,
        formatting JSON NOT NULL,
        change_type ENUM('create', 'update', 'delete') NOT NULL,
        change_description TEXT,
        edited_by VARCHAR(36) NOT NULL,
        edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (script_line_id) REFERENCES script_lines(id) ON DELETE SET NULL,
        FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE,
        FOREIGN KEY (edited_by) REFERENCES users(id),
        INDEX idx_script_line_history (script_id, line_number),
        INDEX idx_edited_by (edited_by),
        INDEX idx_edited_at (edited_at)
      )`,

      // Script locks table (同時編集制御)
      `CREATE TABLE IF NOT EXISTS script_locks (
        id VARCHAR(36) PRIMARY KEY,
        script_id VARCHAR(36) NOT NULL,
        line_number INT,
        locked_by VARCHAR(36) NOT NULL,
        locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE,
        FOREIGN KEY (locked_by) REFERENCES users(id),
        UNIQUE KEY unique_script_lock (script_id, line_number),
        INDEX idx_expires_at (expires_at)
      )`,

      // Script edit sessions table (編集セッション管理)
      `CREATE TABLE IF NOT EXISTS script_edit_sessions (
        id VARCHAR(36) PRIMARY KEY,
        script_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        user_name VARCHAR(100) NOT NULL,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE KEY unique_user_script_session (script_id, user_id),
        INDEX idx_script_active (script_id, is_active),
        INDEX idx_last_activity (last_activity)
      )`,

      // Script scenes table (場面分割)
      `CREATE TABLE IF NOT EXISTS script_scenes (
        id VARCHAR(36) PRIMARY KEY,
        script_id VARCHAR(36) NOT NULL,
        scene_number INT NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        start_line_number INT NOT NULL,
        end_line_number INT NOT NULL,
        created_by VARCHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id),
        UNIQUE KEY unique_script_scene (script_id, scene_number),
        INDEX idx_script_scene (script_id, scene_number),
        INDEX idx_line_range (script_id, start_line_number, end_line_number)
      )`,

      // Script print settings table (印刷設定)
      `CREATE TABLE IF NOT EXISTS script_print_settings (
        id VARCHAR(36) PRIMARY KEY,
        script_id VARCHAR(36) NOT NULL,
        page_size ENUM('A4', 'A5', 'Letter') DEFAULT 'A4',
        orientation ENUM('portrait', 'landscape') DEFAULT 'portrait',
        font_size INT DEFAULT 12,
        line_spacing DECIMAL(3,1) DEFAULT 1.5,
        margin_top INT DEFAULT 20,
        margin_bottom INT DEFAULT 20,
        margin_left INT DEFAULT 20,
        margin_right INT DEFAULT 20,
        include_notes BOOLEAN DEFAULT TRUE,
        include_lighting BOOLEAN DEFAULT TRUE,
        include_audio_video BOOLEAN DEFAULT TRUE,
        scene_breaks BOOLEAN DEFAULT TRUE,
        created_by VARCHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id),
        UNIQUE KEY unique_script_print_settings (script_id)
      )`,

      // Server settings table
      `CREATE TABLE IF NOT EXISTS server_settings (
        id INT PRIMARY KEY DEFAULT 1,
        server_name VARCHAR(100) NOT NULL DEFAULT 'ScaenaHub v2',
        description TEXT,
        icon_url TEXT,
        default_role VARCHAR(50) DEFAULT 'member',
        welcome_channel_id VARCHAR(36),
        rules_channel_id VARCHAR(36),
        max_members INT DEFAULT 100,
        invite_enabled BOOLEAN DEFAULT TRUE,
        public_server BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (welcome_channel_id) REFERENCES channels(id) ON DELETE SET NULL,
        FOREIGN KEY (rules_channel_id) REFERENCES channels(id) ON DELETE SET NULL
      )`,




    ];

    for (const table of tables) {
      try {
        await this.execute(table);
        console.log('✅ Table created/verified');
      } catch (error) {
        console.error('❌ Failed to create table:', error);
        throw error;
      }
    }

    console.log('🗄️ All TiDB tables created/verified successfully');
    
    // Run migrations
    await this.runMigrations();
  }

  private async runMigrations(): Promise<void> {
    try {
      // Migration: Add updated_at column to categories table if it doesn't exist
      const categoriesColumns = await this.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'categories'
      `, [process.env.TIDB_DATABASE]);
      
      const hasUpdatedAt = categoriesColumns.some((col: any) => col.COLUMN_NAME === 'updated_at');
      
      if (!hasUpdatedAt) {
        await this.execute(`
          ALTER TABLE categories 
          ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        `);
        console.log('✅ Migration: Added updated_at column to categories table');
      }

      // Migration: Check and add missing columns to channels table
      const channelsColumns = await this.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'channels'
      `, [process.env.TIDB_DATABASE]);
      
      const channelColumnNames = channelsColumns.map((col: any) => col.COLUMN_NAME);
      
      // Add missing columns one by one
      const requiredColumns = [
        { name: 'position', definition: 'INT DEFAULT 0' },
        { name: 'permissions', definition: 'JSON' },
        { name: 'allowed_roles', definition: 'JSON' },
        { name: 'allowed_users', definition: 'JSON' },
        { name: 'settings', definition: 'JSON' },
        { name: 'updated_at', definition: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
      ];

      for (const column of requiredColumns) {
        if (!channelColumnNames.includes(column.name)) {
          await this.execute(`ALTER TABLE channels ADD COLUMN ${column.name} ${column.definition}`);
          console.log(`✅ Migration: Added ${column.name} column to channels table`);
        }
      }
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      // Don't throw error to prevent startup failure
    }
  }
}