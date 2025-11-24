import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDB } from '../database/index.js';
import { TransactionTimeoutError, TransactionAbortedError } from '../errors/transaction.js';

interface User {
  id: string;
  name: string;
  email: string;
}

describe('TransactionManager', () => {
  const testDBName = 'test-transaction-' + Date.now();

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

  it('should execute readonly transaction', async () => {
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
    const usersTable = db.table<User>('users');
    await usersTable.add({ id: '1', name: 'John', email: 'john@example.com' });

    const result = await db.transaction.readonly('users', (ctx) => {
      const store = ctx.transaction.objectStore('users');
      const request = store.get('1');
      return new Promise<User>((resolve) => {
        request.onsuccess = () => {
          resolve(request.result as User);
        };
      });
    });

    expect(result).toBeDefined();
    expect(result.name).toBe('John');

    db.close();
  });

  it('should execute readwrite transaction', async () => {
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

    await db.transaction.readwrite('users', (ctx) => {
      const store = ctx.transaction.objectStore('users');
      store.add({ id: '1', name: 'John', email: 'john@example.com' });
    });

    const usersTable = db.table<User>('users');
    const user = await usersTable.get('1');
    expect(user).toBeDefined();
    expect(user?.name).toBe('John');

    db.close();
  });

  it('should handle transaction with multiple stores', async () => {
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

    await db.transaction.readwrite(['users', 'posts'], (ctx) => {
      const usersStore = ctx.transaction.objectStore('users');
      const postsStore = ctx.transaction.objectStore('posts');
      usersStore.add({ id: '1', name: 'John', email: 'john@example.com' });
      postsStore.add({ id: '1', title: 'Hello', authorId: '1' });
    });

    const usersTable = db.table<User>('users');
    const user = await usersTable.get('1');
    expect(user).toBeDefined();

    db.close();
  });

  it('should timeout long-running transactions', async () => {
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

    await expect(
      db.transaction.readonly('users', async (ctx) => {
        // Simulate long operation
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return 'done';
      }, { timeout: 100 })
    ).rejects.toThrow(TransactionTimeoutError);

    db.close();
  });

  it('should retry failed transactions', async () => {
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

    let attempt = 0;
    const result = await db.transaction.readwrite('users', (ctx) => {
      attempt++;
      if (attempt === 1) {
        // Simulate failure on first attempt
        ctx.abort();
        throw new Error('Simulated failure');
      }
      const store = ctx.transaction.objectStore('users');
      store.add({ id: '1', name: 'John', email: 'john@example.com' });
    }, { retries: 2, retryDelay: 10 });

    expect(attempt).toBe(2);

    const usersTable = db.table<User>('users');
    const user = await usersTable.get('1');
    expect(user).toBeDefined();

    db.close();
  });

  it('should handle synchronous callbacks', async () => {
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
    const usersTable = db.table<User>('users');
    await usersTable.add({ id: '1', name: 'John', email: 'john@example.com' });

    const result = await db.transaction.readonly('users', (ctx) => {
      const store = ctx.transaction.objectStore('users');
      const request = store.get('1');
      // Synchronous return (though the actual operation is async)
      return 'success';
    });

    expect(result).toBe('success');

    db.close();
  });

  it('should handle async callbacks', async () => {
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
    const usersTable = db.table<User>('users');
    await usersTable.add({ id: '1', name: 'John', email: 'john@example.com' });

    const result = await db.transaction.readonly('users', async (ctx) => {
      const store = ctx.transaction.objectStore('users');
      const request = store.get('1');
      return new Promise<User>((resolve) => {
        request.onsuccess = () => {
          resolve(request.result as User);
        };
      });
    });

    expect(result).toBeDefined();
    expect(result.name).toBe('John');

    db.close();
  });

  it('should abort transaction on error', async () => {
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

    await expect(
      db.transaction.readwrite('users', (ctx) => {
        throw new Error('Test error');
      })
    ).rejects.toThrow('Test error');

    db.close();
  });

  it('should provide transaction context', async () => {
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

    await db.transaction.readonly('users', (ctx) => {
      expect(ctx.transaction).toBeDefined();
      expect(ctx.mode).toBe('readonly');
      expect(typeof ctx.abort).toBe('function');
    });

    db.close();
  });

  it('should handle explicit abort', async () => {
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

    await expect(
      db.transaction.readwrite('users', (ctx) => {
        ctx.abort();
      })
    ).rejects.toThrow(TransactionAbortedError);

    db.close();
  });
});

