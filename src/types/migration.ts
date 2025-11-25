import type { BrowserInfo } from './browser.js';

/**
 * Migration function type
 * Can be synchronous or asynchronous
 */
export type MigrationFunction = (
  transaction: IDBTransaction,
  db: IDBDatabase
) => void | Promise<void>;

/**
 * Migration definition
 */
export interface Migration {
  /** Version number this migration applies to */
  version: number;
  /** Migration function */
  migrate: MigrationFunction;
  /** Optional description of what this migration does */
  description?: string;
  /** Whether this migration requires a backup */
  requiresBackup?: boolean;
  /** Whether this migration can be rolled back */
  rollback?: MigrationFunction;
}

/**
 * Migration execution result
 */
export interface MigrationResult {
  /** Version migrated from */
  fromVersion: number;
  /** Version migrated to */
  toVersion: number;
  /** Whether migration succeeded */
  success: boolean;
  /** Error if migration failed */
  error?: Error;
  /** Duration in milliseconds */
  duration: number;
  /** Timestamp of migration */
  timestamp: number;
}

/**
 * Migration history entry
 */
export interface MigrationHistoryEntry {
  /** Version migrated from */
  fromVersion: number;
  /** Version migrated to */
  toVersion: number;
  /** Timestamp of migration */
  timestamp: number;
  /** Whether migration succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Migration description */
  description?: string;
}

/**
 * Migration options
 */
export interface MigrationOptions {
  /** Whether to run in dry-run mode (test without applying) */
  dryRun?: boolean;
  /** Whether to create backup before migration */
  backup?: boolean;
  /** Whether to log migration history */
  logHistory?: boolean;
  /** Callback for migration progress */
  onProgress?: (fromVersion: number, toVersion: number, current: number, total: number) => void;
}

/**
 * Migration runner options
 */
export interface MigrationRunnerOptions extends MigrationOptions {
  /** Browser information */
  browserInfo: BrowserInfo;
  /** Debug mode */
  debug?: boolean;
}

