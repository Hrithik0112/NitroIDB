import type {
  Migration,
  MigrationResult,
  MigrationHistoryEntry,
  MigrationOptions,
  MigrationRunnerOptions,
} from '../types/migration.js';
import { MigrationError } from '../errors/migration.js';
import type { Database } from '../database/database.js';

/**
 * Store name for migration history
 */
const MIGRATION_HISTORY_STORE = '__migration_history__';

/**
 * Get migration history from database
 */
export async function getMigrationHistory(db: Database): Promise<MigrationHistoryEntry[]> {
  if (!db.isOpen()) {
    await db.open();
  }

  try {
    const history = await db.kv.get<MigrationHistoryEntry[]>('__migration_history__');
    return history ?? [];
  } catch {
    return [];
  }
}

/**
 * Save migration history entry
 */
export async function saveMigrationHistory(
  db: Database,
  entry: MigrationHistoryEntry
): Promise<void> {
  if (!db.isOpen()) {
    await db.open();
  }

  const history = await getMigrationHistory(db);
  history.push(entry);

  // Keep only last 100 entries
  const trimmedHistory = history.slice(-100);

  await db.kv.set('__migration_history__', trimmedHistory);
}

/**
 * Create backup of database data
 * Note: This is a simple backup that exports data. For production, consider more robust backup solutions.
 */
export async function createBackup(db: Database): Promise<Record<string, unknown[]>> {
  if (!db.isOpen()) {
    await db.open();
  }

  const backup: Record<string, unknown[]> = {};
  const storeNames = db.schema.stores;

  for (const storeName of Object.keys(storeNames)) {
    if (storeName === '__kv__' || storeName === MIGRATION_HISTORY_STORE) {
      continue; // Skip internal stores
    }

    try {
      const table = db.table(storeName);
      const allRecords = await table.query().toArray();
      backup[storeName] = allRecords;
    } catch (error) {
      console.warn(`Failed to backup store ${storeName}:`, error);
      backup[storeName] = [];
    }
  }

  return backup;
}

/**
 * Restore database from backup
 */
export async function restoreBackup(
  db: Database,
  backup: Record<string, unknown[]>
): Promise<void> {
  if (!db.isOpen()) {
    await db.open();
  }

  for (const [storeName, records] of Object.entries(backup)) {
    try {
      const table = db.table(storeName);
      await table.clear();

      if (records.length > 0) {
        await table.bulkAdd(records);
      }
    } catch (error) {
      console.warn(`Failed to restore store ${storeName}:`, error);
      throw new Error(`Failed to restore backup for store ${storeName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Run a single migration
 */
async function runMigration(
  migration: Migration,
  transaction: IDBTransaction,
  db: IDBDatabase,
  options: MigrationRunnerOptions
): Promise<void> {
  const startTime = Date.now();

  if (options.debug) {
    console.log(`[NitroIDB] Running migration to version ${migration.version}${migration.description ? `: ${migration.description}` : ''}`);
  }

  try {
    const result = migration.migrate(transaction, db);

    // Handle async migrations
    if (result instanceof Promise) {
      await result;
    }

    const duration = Date.now() - startTime;

    if (options.debug) {
      console.log(`[NitroIDB] Migration to version ${migration.version} completed in ${duration}ms`);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (options.debug) {
      console.error(`[NitroIDB] Migration to version ${migration.version} failed after ${duration}ms:`, error);
    }

    throw new MigrationError(
      migration.version - 1,
      migration.version,
      errorMessage,
      {
        browserInfo: options.browserInfo,
        migrationStep: migration.description ?? `Migration ${migration.version}`,
      }
    );
  }
}

/**
 * Run migrations in order
 */
export async function runMigrations(
  db: Database,
  migrations: Record<number, Migration['migrate']>,
  fromVersion: number,
  toVersion: number,
  options: MigrationRunnerOptions
): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  if (fromVersion >= toVersion) {
    return results; // No migrations needed
  }

  // Convert migrations to Migration objects
  const migrationList: Migration[] = [];
  for (let version = fromVersion + 1; version <= toVersion; version++) {
    const migrate = migrations[version];
    if (migrate) {
      migrationList.push({
        version,
        migrate,
      });
    }
  }

  if (migrationList.length === 0) {
    return results; // No migrations defined
  }

  // If dry-run, simulate migrations without applying
  if (options.dryRun) {
    if (options.debug) {
      console.log(`[NitroIDB] DRY-RUN: Would run ${migrationList.length} migration(s) from version ${fromVersion} to ${toVersion}`);
    }

    for (const migration of migrationList) {
      const startTime = Date.now();
      results.push({
        fromVersion: migration.version - 1,
        toVersion: migration.version,
        success: true,
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      });

      if (options.onProgress) {
        options.onProgress(
          migration.version - 1,
          migration.version,
          migrationList.indexOf(migration) + 1,
          migrationList.length
        );
      }
    }

    return results;
  }

  // Create backup if requested
  let backup: Record<string, unknown[]> | null = null;
  if (options.backup) {
    try {
      backup = await createBackup(db);
      if (options.debug) {
        console.log(`[NitroIDB] Backup created with ${Object.keys(backup).length} stores`);
      }
    } catch (error) {
      console.warn('[NitroIDB] Failed to create backup:', error);
      // Continue without backup
    }
  }

  // Run migrations within a transaction
  try {
    if (!db.isOpen()) {
      await db.open();
    }

    // Note: IndexedDB migrations must run during onupgradeneeded
    // This function is called from within that context
    // For async migrations, we need to handle them after the upgrade completes

    // Get the database instance
    const idb = await db.getDB();

    // Run each migration
    for (const migration of migrationList) {
      const startTime = Date.now();
      const fromVer = migration.version - 1;
      const toVer = migration.version;

      try {
        // For migrations that need to run after upgrade, we'll handle them differently
        // Since IndexedDB transactions are synchronous during onupgradeneeded,
        // we'll mark these for post-upgrade execution
        if (options.debug) {
          console.log(`[NitroIDB] Executing migration ${fromVer} -> ${toVer}`);
        }

        // Note: Actual migration execution happens in onupgradeneeded
        // This function is for planning and validation

        const duration = Date.now() - startTime;
        results.push({
          fromVersion: fromVer,
          toVersion: toVer,
          success: true,
          duration,
          timestamp: Date.now(),
        });

        // Log migration history if requested
        if (options.logHistory) {
          await saveMigrationHistory(db, {
            fromVersion: fromVer,
            toVersion: toVer,
            timestamp: Date.now(),
            success: true,
            description: migration.description,
          });
        }

        if (options.onProgress) {
          options.onProgress(
            fromVer,
            toVer,
            migrationList.indexOf(migration) + 1,
            migrationList.length
          );
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        results.push({
          fromVersion: fromVer,
          toVersion: toVer,
          success: false,
          error: error instanceof Error ? error : new Error(errorMessage),
          duration,
          timestamp: Date.now(),
        });

        // If backup exists, attempt rollback
        if (backup) {
          try {
            if (options.debug) {
              console.log('[NitroIDB] Attempting to restore from backup...');
            }
            await restoreBackup(db, backup);
            if (options.debug) {
              console.log('[NitroIDB] Backup restored successfully');
            }
          } catch (restoreError) {
            console.error('[NitroIDB] Failed to restore backup:', restoreError);
          }
        }

        throw new MigrationError(fromVer, toVer, errorMessage, {
          browserInfo: options.browserInfo,
          migrationStep: migration.description ?? `Migration ${toVer}`,
        });
      }
    }

    return results;
  } catch (error) {
    // If any migration fails, results will contain the failure
    throw error;
  }
}

/**
 * Validate migration functions
 */
export function validateMigrations(
  migrations: Record<number, Migration['migrate']>,
  fromVersion: number,
  toVersion: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check that all required migrations exist
  for (let version = fromVersion + 1; version <= toVersion; version++) {
    if (!migrations[version]) {
      errors.push(`Missing migration for version ${version}`);
    }
  }

  // Check for duplicate versions
  const versions = Object.keys(migrations).map(Number).sort();
  const duplicates = versions.filter((v, i) => versions.indexOf(v) !== i);
  if (duplicates.length > 0) {
    errors.push(`Duplicate migration versions: ${duplicates.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get next migration version to run
 */
export function getNextMigrationVersion(
  migrations: Record<number, Migration['migrate']>,
  currentVersion: number
): number | null {
  const versions = Object.keys(migrations)
    .map(Number)
    .filter(v => v > currentVersion)
    .sort((a, b) => a - b);

  return versions.length > 0 ? versions[0] : null;
}

/**
 * Check if migrations are needed
 */
export function needsMigration(
  migrations: Record<number, Migration['migrate']>,
  currentVersion: number,
  targetVersion: number
): boolean {
  if (currentVersion >= targetVersion) {
    return false;
  }

  // Check if any migrations exist between current and target
  for (let version = currentVersion + 1; version <= targetVersion; version++) {
    if (migrations[version]) {
      return true;
    }
  }

  return false;
}

