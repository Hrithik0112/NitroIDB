import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getStorageQuota,
  calculateEvictionRisk,
  generateRecommendations,
  determineHealthStatus,
  runConnectivityTests,
  collectIssues,
} from './health.js';
import { detectBrowser } from './browser.js';
import { createDB } from '../database/index.js';

describe('Health Check Utilities', () => {
  describe('getStorageQuota', () => {
    it('should return basic quota info when storage API is not available', async () => {
      const quota = await getStorageQuota();
      expect(quota).toHaveProperty('isEphemeral');
      expect(typeof quota.isEphemeral).toBe('boolean');
    });

    it('should handle storage API errors gracefully', async () => {
      // Mock navigator.storage to throw an error
      const originalStorage = typeof navigator !== 'undefined' && 'storage' in navigator
        ? navigator.storage
        : undefined;
      if (typeof navigator !== 'undefined') {
        Object.defineProperty(navigator, 'storage', {
          value: {
            estimate: () => Promise.reject(new Error('Storage API error')),
          },
          writable: true,
          configurable: true,
        });
      }

      const quota = await getStorageQuota();
      expect(quota).toHaveProperty('isEphemeral');
      expect(typeof quota.isEphemeral).toBe('boolean');

      // Restore
      if (typeof navigator !== 'undefined' && originalStorage) {
        Object.defineProperty(navigator, 'storage', {
          value: originalStorage,
          writable: true,
          configurable: true,
        });
      }
    });
  });

  describe('calculateEvictionRisk', () => {
    const browserInfo = detectBrowser();

    it('should return high risk for ephemeral storage', () => {
      const storage = { isEphemeral: true };
      const risk = calculateEvictionRisk(storage, browserInfo);
      expect(risk).toBe('high');
    });

    it('should return high risk for private mode', () => {
      const storage = { isEphemeral: false };
      const privateBrowserInfo = { ...browserInfo, isPrivateMode: true };
      const risk = calculateEvictionRisk(storage, privateBrowserInfo);
      expect(risk).toBe('high');
    });

    it('should return low risk for low usage', () => {
      const storage = {
        isEphemeral: false,
        usagePercent: 20,
      };
      const risk = calculateEvictionRisk(storage, browserInfo);
      expect(risk).toBe('low');
    });

    it('should return medium risk for medium usage', () => {
      const storage = {
        isEphemeral: false,
        usagePercent: 60,
      };
      const risk = calculateEvictionRisk(storage, browserInfo);
      expect(risk).toBe('medium');
    });

    it('should return high risk for high usage', () => {
      const storage = {
        isEphemeral: false,
        usagePercent: 80,
      };
      const risk = calculateEvictionRisk(storage, browserInfo);
      expect(risk).toBe('high');
    });

    it('should return critical risk for very high usage', () => {
      const storage = {
        isEphemeral: false,
        usagePercent: 95,
      };
      const risk = calculateEvictionRisk(storage, browserInfo);
      expect(risk).toBe('critical');
    });

    it('should be stricter for iOS Safari', () => {
      const iosBrowserInfo = { ...browserInfo, isIOS: true, type: 'safari' as const };
      const storage = {
        isEphemeral: false,
        usagePercent: 65,
      };
      const risk = calculateEvictionRisk(storage, iosBrowserInfo);
      expect(risk).toBe('high');
    });
  });

  describe('determineHealthStatus', () => {
    it('should return unhealthy if not connected', () => {
      const status = determineHealthStatus(
        false,
        { canOpen: false, canRead: false, canWrite: false, canClose: false },
        'low'
      );
      expect(status).toBe('unhealthy');
    });

    it('should return unhealthy if critical test fails', () => {
      const status = determineHealthStatus(
        true,
        { canOpen: false, canRead: true, canWrite: true, canClose: true },
        'low'
      );
      expect(status).toBe('unhealthy');
    });

    it('should return unhealthy if eviction risk is critical', () => {
      const status = determineHealthStatus(
        true,
        { canOpen: true, canRead: true, canWrite: true, canClose: true },
        'critical'
      );
      expect(status).toBe('unhealthy');
    });

    it('should return degraded if eviction risk is high', () => {
      const status = determineHealthStatus(
        true,
        { canOpen: true, canRead: true, canWrite: true, canClose: true },
        'high'
      );
      expect(status).toBe('degraded');
    });

    it('should return healthy if all tests pass and risk is low', () => {
      const status = determineHealthStatus(
        true,
        { canOpen: true, canRead: true, canWrite: true, canClose: true },
        'low'
      );
      expect(status).toBe('healthy');
    });
  });

  describe('collectIssues', () => {
    const browserInfo = detectBrowser();

    it('should collect connection issues', () => {
      const issues = collectIssues(
        false,
        { canOpen: false, canRead: false, canWrite: false, canClose: false },
        { isEphemeral: false },
        'low',
        browserInfo
      );
      expect(issues).toContain('Database is not connected');
      expect(issues).toContain('Cannot open database');
    });

    it('should collect storage issues', () => {
      const issues = collectIssues(
        true,
        { canOpen: true, canRead: true, canWrite: true, canClose: true },
        { isEphemeral: true },
        'high',
        browserInfo
      );
      expect(issues).toContain('Storage is in ephemeral mode');
      expect(issues).toContain('High eviction risk: Storage quota usage is high');
    });

    it('should collect eviction risk issues', () => {
      const issues = collectIssues(
        true,
        { canOpen: true, canRead: true, canWrite: true, canClose: true },
        { isEphemeral: false },
        'critical',
        browserInfo
      );
      expect(issues).toContain('Critical eviction risk: Storage quota nearly exhausted');
    });
  });

  describe('generateRecommendations', () => {
    const browserInfo = detectBrowser();

    it('should provide recommendations for connection issues', () => {
      const partialResult = {
        status: 'unhealthy' as const,
        timestamp: Date.now(),
        connected: false,
        storage: { isEphemeral: false },
        evictionRisk: 'low' as const,
        issues: ['Database is not connected'],
        browserInfo,
        tests: {
          canOpen: false,
          canRead: false,
          canWrite: false,
          canClose: false,
        },
      };

      const recommendations = generateRecommendations(partialResult);
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0]).toContain('connection failed');
    });

    it('should provide recommendations for storage issues', () => {
      const partialResult = {
        status: 'degraded' as const,
        timestamp: Date.now(),
        connected: true,
        storage: {
          isEphemeral: true,
          usagePercent: 85,
          usage: 85000000,
          quota: 100000000,
        },
        evictionRisk: 'high' as const,
        issues: ['Storage is in ephemeral mode'],
        browserInfo,
        tests: {
          canOpen: true,
          canRead: true,
          canWrite: true,
          canClose: true,
        },
      };

      const recommendations = generateRecommendations(partialResult);
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.includes('ephemeral'))).toBe(true);
      expect(recommendations.some(r => r.includes('persist'))).toBe(true);
    });

    it('should provide recommendations for critical eviction risk', () => {
      const partialResult = {
        status: 'unhealthy' as const,
        timestamp: Date.now(),
        connected: true,
        storage: {
          isEphemeral: false,
          usagePercent: 95,
          usage: 95000000,
          quota: 100000000,
        },
        evictionRisk: 'critical' as const,
        issues: ['Critical eviction risk'],
        browserInfo,
        tests: {
          canOpen: true,
          canRead: true,
          canWrite: true,
          canClose: true,
        },
      };

      const recommendations = generateRecommendations(partialResult);
      expect(recommendations.some(r => r.includes('CRITICAL'))).toBe(true);
      expect(recommendations.some(r => r.includes('delete'))).toBe(true);
    });
  });

  describe('runConnectivityTests', () => {
    const testDBName = 'test-health-' + Date.now();

    beforeEach(() => {
      if (typeof indexedDB !== 'undefined') {
        try {
          indexedDB.deleteDatabase(testDBName);
        } catch {
          // Ignore
        }
      }
    });

    afterEach(() => {
      if (typeof indexedDB !== 'undefined') {
        try {
          const db = createDB({
            name: testDBName,
            version: 1,
            stores: { test: { primaryKey: 'id' } },
          });
          if (db.isOpen()) {
            db.close();
          }
          indexedDB.deleteDatabase(testDBName);
        } catch {
          // Ignore
        }
      }
    });

    it('should run connectivity tests successfully', async () => {
      if (typeof indexedDB === 'undefined') {
        return;
      }

      const db = createDB({
        name: testDBName,
        version: 1,
        stores: {
          test: { primaryKey: 'id' },
        },
      });

      await db.open();
      const tests = await runConnectivityTests(db);

      expect(tests.canOpen).toBe(true);
      expect(tests.canRead).toBe(true);
      expect(tests.canWrite).toBe(true);
      expect(tests.canClose).toBe(true);

      db.close();
    });

    it('should handle test failures gracefully', async () => {
      if (typeof indexedDB === 'undefined') {
        return;
      }

      const db = createDB({
        name: testDBName,
        version: 1,
        stores: {
          test: { primaryKey: 'id' },
        },
      });

      // Don't open the database
      const tests = await runConnectivityTests(db);

      expect(tests.canOpen).toBe(false);
      expect(tests.canRead).toBe(false);
      expect(tests.canWrite).toBe(false);
      expect(tests.canClose).toBe(false);
    });
  });
});

