import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDB } from './index.js';

describe('Database Health Check', () => {
  const testDBName = 'test-health-db-' + Date.now();

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

  it('should perform health check on open database', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: { primaryKey: 'id' },
      },
    });

    await db.open();
    const health = await db.health();

    expect(health).toHaveProperty('status');
    expect(health).toHaveProperty('timestamp');
    expect(health).toHaveProperty('connected');
    expect(health).toHaveProperty('storage');
    expect(health).toHaveProperty('evictionRisk');
    expect(health).toHaveProperty('issues');
    expect(health).toHaveProperty('recommendations');
    expect(health).toHaveProperty('browserInfo');
    expect(health).toHaveProperty('tests');

    expect(health.connected).toBe(true);
    expect(health.status).toBe('healthy');
    expect(health.tests.canOpen).toBe(true);
    expect(health.tests.canRead).toBe(true);
    expect(health.tests.canWrite).toBe(true);
    expect(health.tests.canClose).toBe(true);

    db.close();
  });

  it('should perform health check on closed database', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: { primaryKey: 'id' },
      },
    });

    // Don't open the database
    const health = await db.health();

    expect(health.connected).toBe(false);
    expect(health.status).toBe('unhealthy');
    expect(health.tests.canOpen).toBe(false);

    db.close();
  });

  it('should skip tests when runTests is false', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: { primaryKey: 'id' },
      },
    });

    await db.open();
    const health = await db.health({ runTests: false });

    expect(health.tests.canOpen).toBe(true);
    expect(health.tests.canRead).toBe(false);
    expect(health.tests.canWrite).toBe(false);
    expect(health.tests.canClose).toBe(false);

    db.close();
  });

  it('should skip quota check when checkQuota is false', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: { primaryKey: 'id' },
      },
    });

    await db.open();
    const health = await db.health({ checkQuota: false });

    expect(health.storage).toHaveProperty('isEphemeral');
    expect(health.storage.quota).toBeUndefined();
    expect(health.storage.usage).toBeUndefined();

    db.close();
  });

  it('should use custom test data size', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: { primaryKey: 'id' },
      },
    });

    await db.open();
    const health = await db.health({ testDataSize: 512 });

    expect(health.tests.canWrite).toBe(true);
    expect(health.tests.canRead).toBe(true);

    db.close();
  });

  it('should include storage quota information when available', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: { primaryKey: 'id' },
      },
    });

    await db.open();
    const health = await db.health();

    expect(health.storage).toHaveProperty('isEphemeral');
    expect(typeof health.storage.isEphemeral).toBe('boolean');

    // If storage API is available, check for quota info
    if (typeof navigator !== 'undefined' && 'storage' in navigator) {
      // Quota might be available or undefined
      expect(health.storage.quota === undefined || typeof health.storage.quota === 'number').toBe(true);
    }

    db.close();
  });

  it('should provide actionable recommendations', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: { primaryKey: 'id' },
      },
    });

    await db.open();
    const health = await db.health();

    expect(Array.isArray(health.recommendations)).toBe(true);
    expect(health.recommendations.length).toBeGreaterThan(0);

    // Should have at least basic recommendations
    expect(health.recommendations.some(r => r.length > 0)).toBe(true);

    db.close();
  });

  it('should detect issues correctly', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: { primaryKey: 'id' },
      },
    });

    // Don't open database
    const health = await db.health();

    expect(Array.isArray(health.issues)).toBe(true);
    expect(health.issues.length).toBeGreaterThan(0);
    expect(health.issues).toContain('Database is not connected');

    db.close();
  });

  it('should include browser information', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: { primaryKey: 'id' },
      },
    });

    await db.open();
    const health = await db.health();

    expect(health.browserInfo).toHaveProperty('type');
    expect(health.browserInfo).toHaveProperty('version');
    expect(health.browserInfo).toHaveProperty('isIOS');
    expect(health.browserInfo).toHaveProperty('isPrivateMode');

    db.close();
  });

  it('should calculate eviction risk', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: { primaryKey: 'id' },
      },
    });

    await db.open();
    const health = await db.health();

    expect(['low', 'medium', 'high', 'critical']).toContain(health.evictionRisk);

    db.close();
  });
});

