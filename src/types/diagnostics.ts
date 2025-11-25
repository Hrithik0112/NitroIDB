import type { HealthCheckResult } from './health.js';
import type { MigrationHistoryEntry } from './migration.js';

/**
 * Store inspection result
 */
export interface StoreInspection {
  /** Store name */
  name: string;
  /** Number of records */
  count: number;
  /** Sample records (first 10) */
  sample: unknown[];
  /** Primary key path */
  primaryKey: string | string[];
  /** Index names */
  indexes: string[];
}

/**
 * Database diagnostics information
 */
export interface DatabaseDiagnostics {
  /** Database name */
  name: string;
  /** Database version */
  version: number;
  /** Whether database is open */
  isOpen: boolean;
  /** Store names */
  storeNames: string[];
  /** Store inspections */
  stores: StoreInspection[];
  /** Health check result */
  health?: HealthCheckResult;
  /** Migration history */
  migrationHistory: MigrationHistoryEntry[];
  /** Browser information */
  browserInfo: {
    type: string;
    version: string;
    isIOS: boolean;
    isPrivateMode: boolean;
  };
}

/**
 * Error recovery strategy
 */
export type ErrorRecoveryStrategy =
  | 'retry'
  | 'fallback'
  | 'clear'
  | 'reopen'
  | 'none';

/**
 * Error recovery options
 */
export interface ErrorRecoveryOptions {
  /** Maximum number of retries */
  maxRetries?: number;
  /** Delay between retries (ms) */
  retryDelay?: number;
  /** Recovery strategy to use */
  strategy?: ErrorRecoveryStrategy;
  /** Whether to log recovery attempts */
  logRecovery?: boolean;
}

/**
 * Error recovery result
 */
export interface ErrorRecoveryResult {
  /** Whether recovery was successful */
  success: boolean;
  /** Strategy used */
  strategy: ErrorRecoveryStrategy;
  /** Number of attempts */
  attempts: number;
  /** Error if recovery failed */
  error?: Error;
}

