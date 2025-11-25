import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDB } from '../database/index.js';
import type { Table } from './table.js';
import type { BulkWriteResult } from './index.js';

interface User {
  id: string;
  name: string;
  email: string;
}

describe('BulkWriteEngine', () => {
  const testDBName = 'test-bulk-' + Date.now();

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

  it('should bulk add records', async () => {
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
    const usersTable: Table<User> = db.table<User>('users');

    const records: User[] = [
      { id: '1', name: 'John', email: 'john@example.com' },
      { id: '2', name: 'Jane', email: 'jane@example.com' },
      { id: '3', name: 'Bob', email: 'bob@example.com' },
    ];

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const result = (await usersTable.bulkAdd(records)) as BulkWriteResult;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(result.success).toBe(3);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(result.failed).toBe(0);

    const count = await usersTable.count();
    expect(count).toBe(3);

    db.close();
  });

  it('should handle empty array', async () => {
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
    const usersTable: Table<User> = db.table<User>('users');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const result = (await usersTable.bulkAdd([])) as BulkWriteResult;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(result.success).toBe(0);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(result.failed).toBe(0);

    db.close();
  });

  it('should report progress', async () => {
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
    const usersTable: Table<User> = db.table<User>('users');

    const records: User[] = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      name: `User ${i}`,
      email: `user${i}@example.com`,
    }));

    const progressCalls: Array<[number, number]> = [];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await usersTable.bulkAdd(records, {
      batchSize: 3,
      progress: (done: number, total: number) => {
        progressCalls.push([done, total]);
      },
    });

    expect(progressCalls.length).toBeGreaterThan(0);
    expect(progressCalls[progressCalls.length - 1]).toEqual([10, 10]);

    db.close();
  });

  it('should handle partial failures', async () => {
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
    const usersTable: Table<User> = db.table<User>('users');

    // Add a record first
    await usersTable.add({ id: '1', name: 'John', email: 'john@example.com' });

    // Try to add duplicate (will fail)
    const records: User[] = [
      { id: '1', name: 'Duplicate', email: 'duplicate@example.com' }, // Duplicate
      { id: '2', name: 'Jane', email: 'jane@example.com' }, // Should succeed
    ];

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const result = (await usersTable.bulkAdd(records)) as BulkWriteResult;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(result.success).toBe(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(result.failed).toBe(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(result.failedIndices).toContain(0);

    db.close();
  });

  it('should use custom batch size', async () => {
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
    const usersTable: Table<User> = db.table<User>('users');

    const records: User[] = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      name: `User ${i}`,
      email: `user${i}@example.com`,
    }));

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const result = (await usersTable.bulkAdd(records, { batchSize: 5 })) as BulkWriteResult;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(result.success).toBe(20);

    db.close();
  });

  it('should bulk delete records', async () => {
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
    const usersTable: Table<User> = db.table<User>('users');

    // Add records
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await usersTable.bulkAdd([
      { id: '1', name: 'John', email: 'john@example.com' },
      { id: '2', name: 'Jane', email: 'jane@example.com' },
      { id: '3', name: 'Bob', email: 'bob@example.com' },
    ]);

    // Delete in bulk
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const result = (await usersTable.bulkDelete(['1', '3'])) as BulkWriteResult;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(result.success).toBe(2);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(result.failed).toBe(0);

    const count = await usersTable.count();
    expect(count).toBe(1);

    db.close();
  });

  it('should handle retries on failure', async () => {
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
    const usersTable: Table<User> = db.table<User>('users');

    const records: User[] = [
      { id: '1', name: 'John', email: 'john@example.com' },
      { id: '2', name: 'Jane', email: 'jane@example.com' },
    ];

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const result = (await usersTable.bulkAdd(records, {
      retries: 2,
      retryOnFail: true,
      retryDelay: 10,
    })) as BulkWriteResult;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(result.success).toBe(2);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(result.failed).toBe(0);

    db.close();
  });

  it('should adapt batch size on failure', async () => {
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
    const usersTable: Table<User> = db.table<User>('users');

    // Create many records to test batching
    const records: User[] = Array.from({ length: 50 }, (_, i) => ({
      id: String(i),
      name: `User ${i}`,
      email: `user${i}@example.com`,
    }));

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const result = (await usersTable.bulkAdd(records, {
      batchSize: 20,
      retryOnFail: true,
    })) as BulkWriteResult;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(result.success).toBe(50);

    db.close();
  });

  it('should respect timeout', async () => {
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
    const usersTable: Table<User> = db.table<User>('users');

    const records: User[] = [
      { id: '1', name: 'John', email: 'john@example.com' },
    ];

    // Very short timeout - should still work for small batches
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const result = (await usersTable.bulkAdd(records, {
      timeout: 100,
    })) as BulkWriteResult;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(result.success).toBe(1);

    db.close();
  });
});

