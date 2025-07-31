import { DataSyncService } from '../services/database/sync';
import { TiDBService } from '../services/database/tidb';
import { SQLiteService } from '../services/database/sqlite';

/**
 * Migration script to remove email column from users table
 * This should be run once to clean up existing databases
 */
export class RemoveEmailColumnMigration {
  private syncService: DataSyncService;
  private tidbService: TiDBService;
  private sqliteService: SQLiteService;

  constructor() {
    this.syncService = DataSyncService.getInstance();
    this.tidbService = TiDBService.getInstance();
    this.sqliteService = SQLiteService.getInstance();
  }

  public async run(): Promise<void> {
    console.log('🔄 Starting email column removal migration...');

    try {
      // Remove email column from TiDB users table
      await this.removeEmailFromTiDB();
      
      // Remove email column from SQLite users_cache table
      await this.removeEmailFromSQLite();
      
      console.log('✅ Email column removal migration completed successfully');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  private async removeEmailFromTiDB(): Promise<void> {
    try {
      console.log('🗄️ Removing email column from TiDB users table...');
      
      // Check if email column exists
      const columns = await this.tidbService.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email'`
      );

      if (columns.length > 0) {
        // Remove email column
        await this.tidbService.execute('ALTER TABLE users DROP COLUMN email');
        console.log('✅ Email column removed from TiDB users table');
      } else {
        console.log('ℹ️ Email column does not exist in TiDB users table');
      }
    } catch (error) {
      console.error('❌ Failed to remove email column from TiDB:', error);
      throw error;
    }
  }

  private async removeEmailFromSQLite(): Promise<void> {
    try {
      console.log('🗄️ Removing email column from SQLite users_cache table...');
      
      // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
      const tableExists = this.sqliteService.query(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='users_cache'`
      );

      if (tableExists.length > 0) {
        // Check if email column exists
        const tableInfo = this.sqliteService.query(`PRAGMA table_info(users_cache)`);
        const hasEmailColumn = tableInfo.some((col: any) => col.name === 'email');

        if (hasEmailColumn) {
          // Create new table without email column
          this.sqliteService.execute(`
            CREATE TABLE users_cache_new (
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
            )
          `);

          // Copy data from old table to new table (excluding email column)
          this.sqliteService.execute(`
            INSERT INTO users_cache_new (
              id, username, password_hash, roles, display_name, avatar, bio,
              online_status, custom_status, is_active, is_banned, last_seen,
              created_at, updated_at, synced_at
            )
            SELECT 
              id, username, password_hash, roles, display_name, avatar, bio,
              online_status, custom_status, is_active, is_banned, last_seen,
              created_at, updated_at, synced_at
            FROM users_cache
          `);

          // Drop old table and rename new table
          this.sqliteService.execute('DROP TABLE users_cache');
          this.sqliteService.execute('ALTER TABLE users_cache_new RENAME TO users_cache');

          console.log('✅ Email column removed from SQLite users_cache table');
        } else {
          console.log('ℹ️ Email column does not exist in SQLite users_cache table');
        }
      } else {
        console.log('ℹ️ SQLite users_cache table does not exist');
      }
    } catch (error) {
      console.error('❌ Failed to remove email column from SQLite:', error);
      throw error;
    }
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  const migration = new RemoveEmailColumnMigration();
  migration.run()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}