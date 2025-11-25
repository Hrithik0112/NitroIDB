import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDB } from './index.js';
import type { DatabaseDiagnostics, StoreInspection } from '../types/diagnostics.js';

describe('Database Diagnostics', () => {
  const testDBName = 'test-diagnostics-db-' + Date.now();

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

  it('should provide debug utilities when debug mode is enabled', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: { primaryKey: 'id' },
      },
      debug: true,
    });

    await db.open();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const debugUtils = db.debugUtils;
    expect(debugUtils).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(typeof debugUtils.log).toBe('function');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(typeof debugUtils.inspect).toBe('function');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(typeof debugUtils.inspectStore).toBe('function');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(typeof debugUtils.format).toBe('function');

    db.close();
  });

  it('should throw error when accessing debug utilities without debug mode', () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: { primaryKey: 'id' },
      },
      debug: false,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    expect(() => db.debugUtils).toThrow('Debug utilities are only available when debug mode is enabled');
  });

  it('should log diagnostics', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: { primaryKey: 'id' },
      },
      debug: true,
    });

    await db.open();

    // Add some data
    await db.table('users').add({ id: '1', name: 'John' });

    // Mock console.log
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await db.debugUtils.log();

    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
    db.close();
  });

  it('should inspect database', async () => {
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
      debug: true,
    });

    await db.open();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const diagnostics: DatabaseDiagnostics = await db.debugUtils.inspect();

    expect(diagnostics.name).toBe(testDBName);
    expect(diagnostics.version).toBe(1);
    expect(diagnostics.isOpen).toBe(true);
    expect(diagnostics.stores.length).toBe(2);

    db.close();
  });

  it('should inspect a specific store', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: { primaryKey: 'id' },
      },
      debug: true,
    });

    await db.open();

    await db.table('users').add({ id: '1', name: 'John' });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const inspection: StoreInspection = await db.debugUtils.inspectStore('users');

    expect(inspection.name).toBe('users');
    expect(inspection.count).toBe(1);
    expect(inspection.sample.length).toBe(1);

    db.close();
  });

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
      debug: true,
    });

    await db.open();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const formatted: string = await db.debugUtils.format();

    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
    expect(formatted).toContain('NitroIDB Diagnostics');

    db.close();
  });

  it('should provide recovery utilities', async () => {
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

    const error = new Error('Test error');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const strategy: string = db.getRecoveryStrategy(error);

    expect(typeof strategy).toBe('string');

    db.close();
  });
});

