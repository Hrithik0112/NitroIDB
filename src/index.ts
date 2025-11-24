/**
 * NitroIDB - Supercharged IndexedDB
 * Simple, Fast, Developer-Friendly
 */

// Export types
export * from './types/index.js';

// Export errors
export * from './errors/index.js';

// Export browser utilities
export { detectBrowser, getBrowserCapabilities, requiresSafariWorkarounds, getRecommendedBatchSize } from './utils/browser.js';

// Export database creation
export { createDB, Database } from './database/index.js';

// Export KV store
export { KVStore } from './kv/index.js';

// Export Table API
export { Table } from './table/index.js';

