import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDB, Database } from './index.js';
import type { DatabaseOptions } from '../types/schema.js';

describe('Database', () => {
  const testDBName = 'test-db-' + Date.now();

  beforeEach(() => {
    // Clean up any existing test databases
    if (typeof indexedDB !== 'undefined') {
      try {
        indexedDB.deleteDatabase(testDBName);
      } catch {
        // Ignore
      }
    }
  });

  afterEach(() => {
    // Clean up
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

  it('should create a database instance', () => {
    const options: DatabaseOptions = {
      name: testDBName,
      version: 1,
      stores: {
        users: { primaryKey: 'id' },
      },
    };

    const db = createDB(options);
    expect(db).toBeInstanceOf(Database);
    expect(db.getName()).toBe(testDBName);
    expect(db.getVersion()).toBe(1);
  });

  it('should open database', async () => {
    if (typeof indexedDB === 'undefined') {
      // Skip if IndexedDB not available
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: { primaryKey: 'id' },
      },
    });

    const idb = await db.open();
    expect(idb).toBeInstanceOf(IDBDatabase);
    expect(idb.name).toBe(testDBName);
    expect(idb.version).toBe(1);
    expect(db.isOpen()).toBe(true);

    db.close();
  });

  it('should create object stores', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: {
          primaryKey: 'id',
          indexes: [{ name: 'email', keyPath: 'email', unique: true }],
        },
        posts: { primaryKey: 'id' },
      },
    });

    const idb = await db.open();
    expect(idb.objectStoreNames.contains('users')).toBe(true);
    expect(idb.objectStoreNames.contains('posts')).toBe(true);

    const transaction = idb.transaction('users', 'readonly');
    const store = transaction.objectStore('users');
    expect(store.indexNames.contains('email')).toBe(true);

    db.close();
  });

  it('should handle version upgrades', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    // Create version 1
    const db1 = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: { primaryKey: 'id' },
      },
    });
    await db1.open();
    db1.close();

    // Upgrade to version 2
    const db2 = createDB({
      name: testDBName,
      version: 2,
      stores: {
        users: {
          primaryKey: 'id',
          indexes: [{ name: 'email', keyPath: 'email' }],
        },
      },
    });

    const idb = await db2.open();
    expect(idb.version).toBe(2);

    const transaction = idb.transaction('users', 'readonly');
    const store = transaction.objectStore('users');
    expect(store.indexNames.contains('email')).toBe(true);

    db2.close();
  });

  it('should run migrations', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    let migrationCalled = false;

    const db = createDB({
      name: testDBName,
      version: 2,
      stores: {
        users: { primaryKey: 'id' },
      },
      migrations: {
        2: (tx, db) => {
          migrationCalled = true;
          const store = tx.objectStore('users');
          // Migration logic here
          expect(store).toBeDefined();
          expect(db).toBeDefined();
        },
      },
    });

    await db.open();
    expect(migrationCalled).toBe(true);
    db.close();
  });

  it('should throw on invalid version downgrade', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    // Create version 2
    const db1 = createDB({
      name: testDBName,
      version: 2,
      stores: {
        users: { primaryKey: 'id' },
      },
    });
    await db1.open();
    db1.close();

    // Try to downgrade to version 1
    const db2 = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: { primaryKey: 'id' },
      },
    });

    await expect(db2.open()).rejects.toThrow('Invalid version');
  });
});

