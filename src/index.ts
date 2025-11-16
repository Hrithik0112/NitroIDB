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

// Main database class will be exported here in next phase
// export { createDB } from './database/index.js';

