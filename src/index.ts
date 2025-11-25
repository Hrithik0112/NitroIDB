/**
 * NitroIDB - Supercharged IndexedDB
 * Simple, Fast, Developer-Friendly
 */

// Export types
export * from './types/index.js';
export type { HealthCheckResult, HealthStatus, StorageQuota, EvictionRisk, HealthCheckOptions } from './types/health.js';

// Export errors
export * from './errors/index.js';

// Export browser utilities
export { detectBrowser, getBrowserCapabilities, requiresSafariWorkarounds, getRecommendedBatchSize } from './utils/browser.js';
export { detectQuirks, generateWarnings, applyWorkarounds, validateBrowserCompatibility, checkEphemeralStorage, testIndexedDBCapabilities } from './utils/quirks.js';
export type { BrowserQuirks } from './utils/quirks.js';

// Export database creation
export { createDB, Database } from './database/index.js';

// Export KV store
export { KVStore } from './kv/index.js';

// Export Table API
export { Table, Query, QueryWhere, BulkWriteEngine } from './table/index.js';
export type { BulkWriteOptions, BulkWriteResult } from './table/index.js';

// Export Transaction API
export { TransactionManager } from './transaction/index.js';
export type { TransactionMode, TransactionOptions, TransactionContext, TransactionCallback } from './types/transaction.js';

