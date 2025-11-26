import type { Database } from '../database/database.js';
import type { HealthCheckResult, HealthStatus, StorageQuota, EvictionRisk } from '../types/health.js';
import { checkEphemeralStorage } from './quirks.js';
import { detectBrowser } from './browser.js';

/**
 * Get storage quota information
 */
export async function getStorageQuota(): Promise<StorageQuota> {
  const isEphemeral = await checkEphemeralStorage();
  const quota: StorageQuota = {
    isEphemeral,
  };

  if (typeof navigator === 'undefined' || !('storage' in navigator)) {
    return quota;
  }

  try {
    const storage = navigator.storage as StorageManager | undefined;
    
    // Check if persistent storage is granted
    if (storage && 'persist' in storage && typeof storage.persist === 'function') {
      quota.isPersistent = await storage.persist();
    }

    // Get storage estimate
    if (storage && 'estimate' in storage && typeof storage.estimate === 'function') {
      const estimate = await storage.estimate();
      
      if (typeof estimate.quota === 'number') {
        quota.quota = estimate.quota;
      }
      
      if (typeof estimate.usage === 'number') {
        quota.usage = estimate.usage;
      }

      // Calculate available and usage percentage
      if (quota.quota !== undefined && quota.usage !== undefined) {
        quota.available = Math.max(0, quota.quota - quota.usage);
        quota.usagePercent = (quota.usage / quota.quota) * 100;
      }
    }
  } catch (error) {
    // Storage API not available or failed
    // Silently handle - this is expected in some environments
    // Only log in debug mode or if it's an unexpected error
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
      console.warn('Failed to get storage quota:', error);
    }
  }

  return quota;
}

/**
 * Calculate eviction risk based on storage quota
 */
export function calculateEvictionRisk(storage: StorageQuota, browserInfo: ReturnType<typeof detectBrowser>): EvictionRisk {
  // Ephemeral storage is always high risk
  if (storage.isEphemeral) {
    return 'high';
  }

  // Private mode is high risk
  if (browserInfo.isPrivateMode) {
    return 'high';
  }

  // iOS Safari has stricter limits
  if (browserInfo.isIOS && browserInfo.type === 'safari') {
    if (storage.usagePercent === undefined) {
      return 'medium';
    }
    if (storage.usagePercent > 80) {
      return 'critical';
    }
    if (storage.usagePercent > 60) {
      return 'high';
    }
    if (storage.usagePercent > 40) {
      return 'medium';
    }
    return 'low';
  }

  // For other browsers, use usage percentage
  if (storage.usagePercent === undefined) {
    return 'low';
  }

  if (storage.usagePercent > 90) {
    return 'critical';
  }
  if (storage.usagePercent > 75) {
    return 'high';
  }
  if (storage.usagePercent > 50) {
    return 'medium';
  }

  return 'low';
}

/**
 * Generate recommendations based on health check
 */
export function generateRecommendations(
  result: Omit<HealthCheckResult, 'recommendations'>
): string[] {
  const recommendations: string[] = [];

  // Connection issues
  if (!result.connected) {
    recommendations.push('Database connection failed. Check if IndexedDB is available and not blocked.');
    return recommendations;
  }

  if (!result.tests.canOpen) {
    recommendations.push('Cannot open database. Check database name and version conflicts.');
  }

  if (!result.tests.canRead) {
    recommendations.push('Cannot read from database. Database may be corrupted or locked.');
  }

  if (!result.tests.canWrite) {
    recommendations.push('Cannot write to database. Check storage quota and permissions.');
  }

  // Storage issues
  if (result.storage.isEphemeral) {
    recommendations.push('Storage is in ephemeral mode. Data may be cleared frequently.');
    recommendations.push('Request persistent storage: await navigator.storage.persist()');
  }

  if (result.storage.isPersistent === false) {
    recommendations.push('Persistent storage not granted. Request permission: await navigator.storage.persist()');
  }

  // Eviction risk recommendations
  if (result.evictionRisk === 'critical') {
    recommendations.push('CRITICAL: Storage quota nearly exhausted. Immediate action required.');
    recommendations.push('- Delete old or unused data immediately');
    recommendations.push('- Implement aggressive data cleanup');
    recommendations.push('- Consider compressing stored data');
  } else if (result.evictionRisk === 'high') {
    recommendations.push('HIGH: Storage quota usage is high. Risk of data eviction.');
    recommendations.push('- Delete old or unused data');
    recommendations.push('- Implement data cleanup strategies');
    recommendations.push('- Request persistent storage permission');
  } else if (result.evictionRisk === 'medium') {
    recommendations.push('MEDIUM: Storage quota usage is moderate. Monitor usage.');
    recommendations.push('- Consider implementing data cleanup');
    recommendations.push('- Request persistent storage for important data');
  }

  // Browser-specific recommendations
  if (result.browserInfo.isIOS && result.browserInfo.type === 'safari') {
    recommendations.push('iOS Safari detected: Storage limits are stricter. Use data compression and cleanup.');
  }

  if (result.browserInfo.isPrivateMode) {
    recommendations.push('Private/Incognito mode detected: Storage is limited and cleared frequently.');
    recommendations.push('Consider warning users about data persistence limitations.');
  }

  // Quota information
  if (result.storage.usagePercent !== undefined) {
    recommendations.push(`Storage usage: ${result.storage.usagePercent.toFixed(1)}% (${formatBytes(result.storage.usage ?? 0)} / ${formatBytes(result.storage.quota ?? 0)})`);
  }

  return recommendations;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Determine overall health status
 */
export function determineHealthStatus(
  connected: boolean,
  tests: HealthCheckResult['tests'],
  evictionRisk: EvictionRisk
): HealthStatus {
  if (!connected) {
    return 'unhealthy';
  }

  // If any critical test fails, unhealthy
  if (!tests.canOpen || !tests.canRead || !tests.canWrite) {
    return 'unhealthy';
  }

  // If eviction risk is critical, unhealthy
  if (evictionRisk === 'critical') {
    return 'unhealthy';
  }

  // If eviction risk is high or tests have issues, degraded
  if (evictionRisk === 'high' || !tests.canClose) {
    return 'degraded';
  }

  // Otherwise healthy
  return 'healthy';
}

/**
 * Run connectivity tests on the database
 */
export async function runConnectivityTests(
  db: Database,
  testDataSize: number = 1024
): Promise<HealthCheckResult['tests']> {
  const tests = {
    canOpen: false,
    canRead: false,
    canWrite: false,
    canClose: false,
  };

  try {
    // Test: Can open
    if (!db.isOpen()) {
      await db.open();
    }
    tests.canOpen = db.isOpen();

    if (!tests.canOpen) {
      return tests;
    }

    // Test: Can write
    try {
      const testKey = `__health_test_${Date.now()}`;
      const testValue = new Array(testDataSize).fill('x').join('');
      await db.kv.set(testKey, testValue);
      tests.canWrite = true;

      // Test: Can read
      try {
        const retrieved = await db.kv.get(testKey);
        tests.canRead = retrieved === testValue;

        // Cleanup test data
        try {
          await db.kv.delete(testKey);
        } catch {
          // Ignore cleanup errors
        }
      } catch {
        tests.canRead = false;
      }
    } catch {
      tests.canWrite = false;
    }

    // Test: Can close
    try {
      db.close();
      tests.canClose = !db.isOpen();
      
      // Reopen if needed for other operations
      if (!db.isOpen()) {
        await db.open();
      }
    } catch {
      tests.canClose = false;
    }
  } catch (error) {
    // Any error means tests failed
    console.warn('Health check connectivity tests failed:', error);
  }

  return tests;
}

/**
 * Collect issues from health check
 */
export function collectIssues(
  connected: boolean,
  tests: HealthCheckResult['tests'],
  storage: StorageQuota,
  evictionRisk: EvictionRisk,
  browserInfo: ReturnType<typeof detectBrowser>
): string[] {
  const issues: string[] = [];

  if (!connected) {
    issues.push('Database is not connected');
  }

  if (!tests.canOpen) {
    issues.push('Cannot open database');
  }

  if (!tests.canRead) {
    issues.push('Cannot read from database');
  }

  if (!tests.canWrite) {
    issues.push('Cannot write to database');
  }

  if (!tests.canClose) {
    issues.push('Cannot close database');
  }

  if (storage.isEphemeral) {
    issues.push('Storage is in ephemeral mode');
  }

  if (storage.isPersistent === false) {
    issues.push('Persistent storage not granted');
  }

  if (evictionRisk === 'critical') {
    issues.push('Critical eviction risk: Storage quota nearly exhausted');
  } else if (evictionRisk === 'high') {
    issues.push('High eviction risk: Storage quota usage is high');
  }

  if (browserInfo.isPrivateMode) {
    issues.push('Private/Incognito mode: Storage is limited');
  }

  if (browserInfo.isIOS && browserInfo.type === 'safari') {
    issues.push('iOS Safari: Stricter storage limits apply');
  }

  return issues;
}

