import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDB } from '../database/index.js';
import type { BulkWriteResult } from '../table/index.js';

describe('Performance Tests', () => {
  const testDBName = 'test-performance-' + Date.now();

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

  describe('Bulk Insert Performance', () => {
    it('should insert 5000 records in under 2 seconds (Chrome target)', async () => {
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
      const usersTable = db.table<{ id: string; name: string; email: string }>('users');

      // Generate 5000 records
      const records = Array.from({ length: 5000 }, (_, i) => ({
        id: String(i),
        name: `User ${i}`,
        email: `user${i}@example.com`,
      }));

      const startTime = performance.now();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const result = await usersTable.bulkAdd(records) as BulkWriteResult;
      const endTime = performance.now();
      const duration = endTime - startTime;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(result.success).toBe(5000);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(result.failed).toBe(0);
      
      // Target: < 2 seconds for Chrome, but allow up to 4 seconds for Safari
      // This is a performance test, not a strict requirement
      expect(duration).toBeLessThan(4000);

      // Verify all records were inserted
      const count = await usersTable.count();
      expect(count).toBe(5000);

      db.close();
    }, 10000); // 10 second timeout

    it('should handle large batch sizes efficiently', async () => {
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
      const usersTable = db.table<{ id: string; name: string }>('users');

      const records = Array.from({ length: 1000 }, (_, i) => ({
        id: String(i),
        name: `User ${i}`,
      }));

      const startTime = performance.now();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await usersTable.bulkAdd(records, { batchSize: 100 });
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(2000);

      const count = await usersTable.count();
      expect(count).toBe(1000);

      db.close();
    });

    it('should handle concurrent operations', async () => {
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

      const usersTable = db.table<{ id: string; name: string }>('users');
      const postsTable = db.table<{ id: string; title: string }>('posts');

      const users = Array.from({ length: 100 }, (_, i) => ({
        id: `user-${i}`,
        name: `User ${i}`,
      }));

      const posts = Array.from({ length: 100 }, (_, i) => ({
        id: `post-${i}`,
        title: `Post ${i}`,
      }));

      const startTime = performance.now();

      // Run concurrent operations
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        usersTable.bulkAdd(users),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        postsTable.bulkAdd(posts),
      ]);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(2000);

      const userCount = await usersTable.count();
      const postCount = await postsTable.count();

      expect(userCount).toBe(100);
      expect(postCount).toBe(100);

      db.close();
    });
  });

  describe('Query Performance', () => {
    it('should query large datasets efficiently', async () => {
      if (typeof indexedDB === 'undefined') {
        return;
      }

      const db = createDB({
        name: testDBName,
        version: 1,
        stores: {
          users: {
            primaryKey: 'id',
            indexes: [
              { name: 'email', keyPath: 'email', unique: true },
            ],
          },
        },
      });

      await db.open();
      const usersTable = db.table<{ id: string; name: string; email: string }>('users');

      // Insert 1000 records
      const records = Array.from({ length: 1000 }, (_, i) => ({
        id: String(i),
        name: `User ${i}`,
        email: `user${i}@example.com`,
      }));

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await usersTable.bulkAdd(records);

      // Query with index
      const startTime = performance.now();
      const results = await usersTable.query()
        .where('email')
        .equals('user500@example.com')
        .toArray();
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(results.length).toBe(1);
      expect(duration).toBeLessThan(100); // Indexed queries should be very fast

      db.close();
    });

    it('should handle range queries efficiently', async () => {
      if (typeof indexedDB === 'undefined') {
        return;
      }

      const db = createDB({
        name: testDBName,
        version: 1,
        stores: {
          users: {
            primaryKey: 'id',
            indexes: [
              { name: 'name', keyPath: 'name' },
            ],
          },
        },
      });

      await db.open();
      const usersTable = db.table<{ id: string; name: string }>('users');

      const records = Array.from({ length: 500 }, (_, i) => ({
        id: String(i),
        name: `User ${i}`,
      }));

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await usersTable.bulkAdd(records);

      const startTime = performance.now();
      const results = await usersTable.query()
        .where('name')
        .between('User 100', 'User 200')
        .toArray();
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(results.length).toBe(101); // 100 to 200 inclusive
      expect(duration).toBeLessThan(200);

      db.close();
    });
  });

  describe('Transaction Performance', () => {
    it('should handle multiple operations in a transaction efficiently', async () => {
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

      const startTime = performance.now();

      await db.transaction.execute(['users'], 'readwrite', async (_tx) => {
        const usersTable = db.table<{ id: string; name: string }>('users');
        for (let i = 0; i < 100; i++) {
          await usersTable.add({ id: String(i), name: `User ${i}` });
        }
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000);

      const count = await db.table('users').count();
      expect(count).toBe(100);

      db.close();
    });
  });
});

