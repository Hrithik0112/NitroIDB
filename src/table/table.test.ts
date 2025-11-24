import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDB } from '../database/index.js';
import { Table } from './table.js';

interface User {
  id: string;
  name: string;
  email: string;
}

interface Post {
  id: string;
  title: string;
  authorId: string;
}

describe('Table', () => {
  const testDBName = 'test-table-' + Date.now();

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

  it('should create table instance', async () => {
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
    expect(usersTable).toBeInstanceOf(Table);
    db.close();
  });

  it('should throw error for non-existent store', async () => {
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
    expect(() => db.table('nonexistent')).toThrow('does not exist in schema');
    db.close();
  });

  it('should add and get records', async () => {
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

    const user: User = { id: '1', name: 'John', email: 'john@example.com' };
    await usersTable.add(user);

    const retrieved = await usersTable.get('1');
    expect(retrieved).toEqual(user);
    expect(retrieved?.name).toBe('John');

    db.close();
  });

  it('should return undefined for non-existent record', async () => {
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

    const retrieved = await usersTable.get('nonexistent');
    expect(retrieved).toBeUndefined();

    db.close();
  });

  it('should update records', async () => {
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

    const user: User = { id: '1', name: 'John', email: 'john@example.com' };
    await usersTable.add(user);

    await usersTable.update('1', { name: 'Jane' });
    const updated = await usersTable.get('1');
    expect(updated?.name).toBe('Jane');
    expect(updated?.email).toBe('john@example.com'); // Should preserve other fields

    db.close();
  });

  it('should throw error when updating non-existent record', async () => {
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

    await expect(usersTable.update('nonexistent', { name: 'Jane' })).rejects.toThrow('not found');

    db.close();
  });

  it('should put (replace) records', async () => {
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

    const user1: User = { id: '1', name: 'John', email: 'john@example.com' };
    await usersTable.put(user1);

    const user2: User = { id: '1', name: 'Jane', email: 'jane@example.com' };
    await usersTable.put(user2);

    const retrieved = await usersTable.get('1');
    expect(retrieved).toEqual(user2);

    db.close();
  });

  it('should delete records', async () => {
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

    const user: User = { id: '1', name: 'John', email: 'john@example.com' };
    await usersTable.add(user);
    await usersTable.delete('1');

    const retrieved = await usersTable.get('1');
    expect(retrieved).toBeUndefined();

    db.close();
  });

  it('should clear all records', async () => {
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
    await usersTable.add({ id: '2', name: 'Jane', email: 'jane@example.com' });
    await usersTable.clear();

    const count = await usersTable.count();
    expect(count).toBe(0);

    db.close();
  });

  it('should get multiple records', async () => {
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
    await usersTable.add({ id: '2', name: 'Jane', email: 'jane@example.com' });
    await usersTable.add({ id: '3', name: 'Bob', email: 'bob@example.com' });

    const users = await usersTable.getMany(['1', '3']);
    expect(users).toHaveLength(2);
    expect(users.map((u) => u.id).sort()).toEqual(['1', '3']);

    db.close();
  });

  it('should return empty array for getMany with no keys', async () => {
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

    const users = await usersTable.getMany([]);
    expect(users).toEqual([]);

    db.close();
  });

  it('should delete multiple records', async () => {
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
    await usersTable.add({ id: '2', name: 'Jane', email: 'jane@example.com' });
    await usersTable.add({ id: '3', name: 'Bob', email: 'bob@example.com' });

    await usersTable.deleteMany(['1', '3']);

    const count = await usersTable.count();
    expect(count).toBe(1);
    expect(await usersTable.get('2')).toBeDefined();

    db.close();
  });

  it('should count records', async () => {
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

    expect(await usersTable.count()).toBe(0);

    await usersTable.add({ id: '1', name: 'John', email: 'john@example.com' });
    await usersTable.add({ id: '2', name: 'Jane', email: 'jane@example.com' });

    expect(await usersTable.count()).toBe(2);

    db.close();
  });

  it('should check if record exists', async () => {
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

    expect(await usersTable.has('1')).toBe(false);

    await usersTable.add({ id: '1', name: 'John', email: 'john@example.com' });

    expect(await usersTable.has('1')).toBe(true);
    expect(await usersTable.has('2')).toBe(false);

    db.close();
  });

  it('should work with different store types', async () => {
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

    const usersTable = db.table<User>('users');
    const postsTable = db.table<Post>('posts');

    await usersTable.add({ id: '1', name: 'John', email: 'john@example.com' });
    await postsTable.add({ id: '1', title: 'Hello', authorId: '1' });

    expect(await usersTable.count()).toBe(1);
    expect(await postsTable.count()).toBe(1);

    db.close();
  });
});

