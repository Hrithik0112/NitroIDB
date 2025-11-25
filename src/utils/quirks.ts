import type { BrowserInfo, CompatibilityMode } from '../types/browser.js';
import { getBrowserCapabilities } from './browser.js';
import { BrowserIncompatibilityError } from '../errors/browser.js';

/**
 * Browser quirks and compatibility information
 */
export interface BrowserQuirks {
  /** Safari-specific quirks detected */
  safariQuirks: boolean;
  /** iOS Safari quirks */
  iosQuirks: boolean;
  /** Private/incognito mode detected */
  privateMode: boolean;
  /** Ephemeral storage mode */
  ephemeralStorage: boolean;
  /** Large transaction issues */
  largeTransactionIssues: boolean;
  /** Recommended batch size for this browser */
  recommendedBatchSize: number;
  /** Recommended transaction timeout */
  recommendedTimeout: number;
}

/**
 * Detect browser quirks and compatibility issues
 */
export function detectQuirks(browserInfo: BrowserInfo, compatMode: CompatibilityMode = 'auto'): BrowserQuirks {
  const quirks: BrowserQuirks = {
    safariQuirks: false,
    iosQuirks: false,
    privateMode: browserInfo.isPrivateMode,
    ephemeralStorage: false,
    largeTransactionIssues: false,
    recommendedBatchSize: 500,
    recommendedTimeout: 5000,
  };

  // Safari/WebKit quirks
  if (browserInfo.type === 'safari' || browserInfo.isWebKit) {
    quirks.safariQuirks = true;
    const version = parseInt(browserInfo.version, 10);

    // Safari 15-17 have known issues with large transactions
    if (version >= 15 && version <= 17) {
      quirks.largeTransactionIssues = true;
      quirks.recommendedBatchSize = 100;
      quirks.recommendedTimeout = 3000;
    }

    // iOS Safari has additional quirks
    if (browserInfo.isIOS) {
      quirks.iosQuirks = true;
      quirks.recommendedBatchSize = 50; // Even more conservative
      quirks.recommendedTimeout = 2000;
    }
  }

  // Private mode quirks
  if (browserInfo.isPrivateMode) {
    quirks.ephemeralStorage = true;
    quirks.recommendedBatchSize = Math.min(quirks.recommendedBatchSize, 100);
  }

  // Apply compatibility mode overrides
  if (compatMode === 'safari') {
    // Force Safari-compatible settings
    quirks.safariQuirks = true;
    quirks.largeTransactionIssues = true;
    quirks.recommendedBatchSize = 100;
    quirks.recommendedTimeout = 3000;
  } else if (compatMode === 'strict') {
    // Most conservative settings
    quirks.recommendedBatchSize = 50;
    quirks.recommendedTimeout = 2000;
  }

  return quirks;
}

/**
 * Check for ephemeral storage mode
 */
export async function checkEphemeralStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('storage' in navigator)) {
    return false;
  }

  try {
    // Check if storage can persist
    if ('persist' in navigator.storage) {
      const persistent = await navigator.storage.persist();
      return !persistent;
    }

    // Fallback: try to estimate storage quota
    const storage = navigator.storage as StorageManager | undefined;
    if (storage && 'estimate' in storage && typeof storage.estimate === 'function') {
      const estimate = await storage.estimate();
      // Very low quota suggests ephemeral mode
      const quota = estimate.quota;
      return typeof quota === 'number' && quota < 10 * 1024 * 1024; // < 10MB
    }
  } catch {
    // If we can't check, assume it might be ephemeral
    return false;
  }

  return false;
}

/**
 * Test IndexedDB capabilities
 */
export async function testIndexedDBCapabilities(): Promise<{
  available: boolean;
  writable: boolean;
  readable: boolean;
  issues: string[];
}> {
  const result = {
    available: false,
    writable: false,
    readable: false,
    issues: [] as string[],
  };

  if (typeof indexedDB === 'undefined') {
    result.issues.push('IndexedDB is not available');
    return result;
  }

  result.available = true;

  // Test write capability
  try {
    const testDBName = `__nitroidb_test_${Date.now()}`;
    const request = indexedDB.open(testDBName, 1);

    await new Promise<void>((resolve, reject) => {
      request.onerror = () => {
        result.issues.push('Cannot open IndexedDB');
        reject(new Error('Cannot open IndexedDB'));
      };

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['test'], 'readwrite');
        const store = transaction.objectStore('test');
        const testRequest = store.add({ test: 'value' });

        testRequest.onsuccess = () => {
          result.writable = true;
          db.close();
          indexedDB.deleteDatabase(testDBName);
          resolve();
        };

        testRequest.onerror = () => {
          result.issues.push('Cannot write to IndexedDB');
          db.close();
          indexedDB.deleteDatabase(testDBName);
          reject(new Error('Cannot write to IndexedDB'));
        };
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        db.createObjectStore('test', { keyPath: 'id', autoIncrement: true });
      };
    });
  } catch (error) {
    // Test failed
  }

  // Test read capability
  try {
    const testDBName = `__nitroidb_test_read_${Date.now()}`;
    const request = indexedDB.open(testDBName, 1);

    await new Promise<void>((resolve, reject) => {
      request.onerror = () => reject(new Error('Cannot open IndexedDB'));

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['test'], 'readonly');
        const store = transaction.objectStore('test');
        const testRequest = store.get(1);

        testRequest.onsuccess = () => {
          result.readable = true;
          db.close();
          indexedDB.deleteDatabase(testDBName);
          resolve();
        };

        testRequest.onerror = () => {
          result.issues.push('Cannot read from IndexedDB');
          db.close();
          indexedDB.deleteDatabase(testDBName);
          reject(new Error('Cannot read from IndexedDB'));
        };
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        db.createObjectStore('test', { keyPath: 'id', autoIncrement: true });
      };
    });
  } catch {
    // Test failed
  }

  return result;
}

/**
 * Generate warnings for detected issues
 */
export function generateWarnings(quirks: BrowserQuirks, _browserInfo: BrowserInfo, debug: boolean): string[] {
  if (!debug) {
    return [];
  }

  const warnings: string[] = [];

  if (quirks.safariQuirks) {
    warnings.push(
      `[NitroIDB] Safari/WebKit detected. Using conservative batch size (${quirks.recommendedBatchSize}) and timeout (${quirks.recommendedTimeout}ms).`
    );
  }

  if (quirks.iosQuirks) {
    warnings.push(
      `[NitroIDB] iOS Safari detected. Using very conservative settings for better compatibility.`
    );
  }

  if (quirks.privateMode) {
    warnings.push(
      `[NitroIDB] Private/incognito mode detected. Storage may be limited and data may be cleared frequently.`
    );
  }

  if (quirks.ephemeralStorage) {
    warnings.push(
      `[NitroIDB] Ephemeral storage mode detected. Data may be cleared when storage is low.`
    );
  }

  if (quirks.largeTransactionIssues) {
    warnings.push(
      `[NitroIDB] Browser has known issues with large transactions. Consider using smaller batch sizes.`
    );
  }

  return warnings;
}

/**
 * Apply browser-specific workarounds
 */
export function applyWorkarounds(quirks: BrowserQuirks): {
  batchSize: number;
  timeout: number;
  retryDelay: number;
} {
  return {
    batchSize: quirks.recommendedBatchSize,
    timeout: quirks.recommendedTimeout,
    retryDelay: quirks.safariQuirks ? 200 : 100, // Longer delay for Safari
  };
}

/**
 * Validate browser compatibility
 */
export function validateBrowserCompatibility(browserInfo: BrowserInfo, compatMode: CompatibilityMode): void {
  const capabilities = getBrowserCapabilities();

  if (!capabilities.hasIndexedDB) {
    throw new BrowserIncompatibilityError(
      'IndexedDB is not available in this browser',
      {
        browserInfo,
        missingFeature: 'indexedDB',
      }
    );
  }

  // Check for minimum Safari version
  if (browserInfo.type === 'safari') {
    const version = parseInt(browserInfo.version, 10);
    if (version < 15 && compatMode !== 'strict') {
      console.warn(
        `[NitroIDB] Safari ${version} detected. Some features may not work correctly. Consider updating to Safari 15+.`
      );
    }
  }
}

