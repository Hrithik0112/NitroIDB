import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  inspectStore,
  getDatabaseDiagnostics,
  formatDiagnostics,
  logDiagnostics,
} from './diagnostics.js';
import { createDB } from '../database/index.js';

describe('Diagnostics Utilities', () => {
  const testDBName = 'test-diagnostics-' + Date.now();

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

  describe('inspectStore', () => {
    it('should inspect a store', async () => {
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

      // Add some data
      const usersTable = db.table('users');
      await usersTable.add({ id: '1', name: 'John' });
      await usersTable.add({ id: '2', name: 'Jane' });

      const inspection = await inspectStore(db, 'users');

      expect(inspection.name).toBe('users');
      expect(inspection.count).toBe(2);
      expect(inspection.sample.length).toBe(2);
      expect(inspection.primaryKey).toBe('id');
      expect(Array.isArray(inspection.indexes)).toBe(true);

      db.close();
    });

    it('should handle empty stores', async () => {
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

      const inspection = await inspectStore(db, 'users');

      expect(inspection.count).toBe(0);
      expect(inspection.sample.length).toBe(0);

      db.close();
    });
  });

  describe('getDatabaseDiagnostics', () => {
    it('should get comprehensive diagnostics', async () => {
      if (typeof indexedDB === 'undefined') {
        return;
      }

      const db = createDB({
        name: testDBName,
        version: 1,
        stores: {
          users: { primaryKey: 'id' },
          posts: { primaryKey: 'id' },
        },
      });

      await db.open();

      const diagnostics = await getDatabaseDiagnostics(db);

      expect(diagnostics.name).toBe(testDBName);
      expect(diagnostics.version).toBe(1);
      expect(diagnostics.isOpen).toBe(true);
      expect(diagnostics.storeNames).toContain('users');
      expect(diagnostics.storeNames).toContain('posts');
      expect(diagnostics.stores.length).toBe(2);
      expect(diagnostics.migrationHistory).toEqual([]);
      expect(diagnostics.browserInfo).toHaveProperty('type');

      db.close();
    });

    it('should include health check when requested', async () => {
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

      const diagnostics = await getDatabaseDiagnostics(db, true);

      expect(diagnostics.health).toBeDefined();
      expect(diagnostics.health?.status).toBeDefined();

      db.close();
    });
  });

  describe('formatDiagnostics', () => {
    it('should format diagnostics as string', async () => {
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

      const diagnostics = await getDatabaseDiagnostics(db);
      const formatted = formatDiagnostics(diagnostics);

      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('NitroIDB Diagnostics');
      expect(formatted).toContain(testDBName);
      expect(formatted).toContain('users');

      db.close();
    });
  });

  describe('logDiagnostics', () => {
    it('should log diagnostics to console', async () => {
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

      // Mock console.log
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logDiagnostics(await getDatabaseDiagnostics(db));

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      db.close();
    });
  });
});

