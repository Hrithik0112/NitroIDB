import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDB } from '../database/index.js';

interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  createdAt: number;
}

describe('Query', () => {
  const testDBName = 'test-query-' + Date.now();

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

  it('should query by index with equals', async () => {
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
      },
    });

    await db.open();
    const usersTable = db.table<User>('users');

    await usersTable.add({ id: '1', name: 'John', email: 'john@example.com', age: 30, createdAt: 1000 });
    await usersTable.add({ id: '2', name: 'Jane', email: 'jane@example.com', age: 25, createdAt: 2000 });

    const results = await usersTable.where('email').equals('john@example.com').toArray();
    expect(results).toHaveLength(1);
    expect(results[0]?.email).toBe('john@example.com');

    db.close();
  });

  it('should query by primary key with equals', async () => {
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

    await usersTable.add({ id: '1', name: 'John', email: 'john@example.com', age: 30, createdAt: 1000 });
    await usersTable.add({ id: '2', name: 'Jane', email: 'jane@example.com', age: 25, createdAt: 2000 });

    const results = await usersTable.whereKey().equals('1').toArray();
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('1');

    db.close();
  });

  it('should query with above', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: {
          primaryKey: 'id',
          indexes: [{ name: 'age', keyPath: 'age' }],
        },
      },
    });

    await db.open();
    const usersTable = db.table<User>('users');

    await usersTable.add({ id: '1', name: 'John', email: 'john@example.com', age: 30, createdAt: 1000 });
    await usersTable.add({ id: '2', name: 'Jane', email: 'jane@example.com', age: 25, createdAt: 2000 });
    await usersTable.add({ id: '3', name: 'Bob', email: 'bob@example.com', age: 35, createdAt: 3000 });

    const results = await usersTable.where('age').above(25).toArray();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((u) => u.age > 25)).toBe(true);

    db.close();
  });

  it('should query with aboveOrEqual', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: {
          primaryKey: 'id',
          indexes: [{ name: 'age', keyPath: 'age' }],
        },
      },
    });

    await db.open();
    const usersTable = db.table<User>('users');

    await usersTable.add({ id: '1', name: 'John', email: 'john@example.com', age: 30, createdAt: 1000 });
    await usersTable.add({ id: '2', name: 'Jane', email: 'jane@example.com', age: 25, createdAt: 2000 });

    const results = await usersTable.where('age').aboveOrEqual(25).toArray();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((u) => u.age >= 25)).toBe(true);

    db.close();
  });

  it('should query with below', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: {
          primaryKey: 'id',
          indexes: [{ name: 'age', keyPath: 'age' }],
        },
      },
    });

    await db.open();
    const usersTable = db.table<User>('users');

    await usersTable.add({ id: '1', name: 'John', email: 'john@example.com', age: 30, createdAt: 1000 });
    await usersTable.add({ id: '2', name: 'Jane', email: 'jane@example.com', age: 25, createdAt: 2000 });

    const results = await usersTable.where('age').below(30).toArray();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((u) => u.age < 30)).toBe(true);

    db.close();
  });

  it('should query with belowOrEqual', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: {
          primaryKey: 'id',
          indexes: [{ name: 'age', keyPath: 'age' }],
        },
      },
    });

    await db.open();
    const usersTable = db.table<User>('users');

    await usersTable.add({ id: '1', name: 'John', email: 'john@example.com', age: 30, createdAt: 1000 });
    await usersTable.add({ id: '2', name: 'Jane', email: 'jane@example.com', age: 25, createdAt: 2000 });

    const results = await usersTable.where('age').belowOrEqual(30).toArray();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((u) => u.age <= 30)).toBe(true);

    db.close();
  });

  it('should query with between', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: {
          primaryKey: 'id',
          indexes: [{ name: 'age', keyPath: 'age' }],
        },
      },
    });

    await db.open();
    const usersTable = db.table<User>('users');

    await usersTable.add({ id: '1', name: 'John', email: 'john@example.com', age: 30, createdAt: 1000 });
    await usersTable.add({ id: '2', name: 'Jane', email: 'jane@example.com', age: 25, createdAt: 2000 });
    await usersTable.add({ id: '3', name: 'Bob', email: 'bob@example.com', age: 35, createdAt: 3000 });

    const results = await usersTable.where('age').between(25, 30).toArray();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((u) => u.age >= 25 && u.age <= 30)).toBe(true);

    db.close();
  });

  it('should query with startsWith', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: {
          primaryKey: 'id',
          indexes: [{ name: 'email', keyPath: 'email' }],
        },
      },
    });

    await db.open();
    const usersTable = db.table<User>('users');

    await usersTable.add({ id: '1', name: 'John', email: 'john@example.com', age: 30, createdAt: 1000 });
    await usersTable.add({ id: '2', name: 'Jane', email: 'jane@example.com', age: 25, createdAt: 2000 });
    await usersTable.add({ id: '3', name: 'Bob', email: 'bob@test.com', age: 35, createdAt: 3000 });

    const results = await usersTable.where('email').startsWith('j').toArray();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((u) => u.email.startsWith('j'))).toBe(true);

    db.close();
  });

  it('should sort with orderBy', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: {
          primaryKey: 'id',
          indexes: [{ name: 'age', keyPath: 'age' }],
        },
      },
    });

    await db.open();
    const usersTable = db.table<User>('users');

    await usersTable.add({ id: '1', name: 'John', email: 'john@example.com', age: 30, createdAt: 1000 });
    await usersTable.add({ id: '2', name: 'Jane', email: 'jane@example.com', age: 25, createdAt: 2000 });
    await usersTable.add({ id: '3', name: 'Bob', email: 'bob@example.com', age: 35, createdAt: 3000 });

    const results = await usersTable.where('age').aboveOrEqual(25).orderBy('next').toArray();
    expect(results.length).toBeGreaterThan(0);

    db.close();
  });

  it('should reverse sort order', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: {
          primaryKey: 'id',
          indexes: [{ name: 'age', keyPath: 'age' }],
        },
      },
    });

    await db.open();
    const usersTable = db.table<User>('users');

    await usersTable.add({ id: '1', name: 'John', email: 'john@example.com', age: 30, createdAt: 1000 });
    await usersTable.add({ id: '2', name: 'Jane', email: 'jane@example.com', age: 25, createdAt: 2000 });

    const ascending = await usersTable.where('age').aboveOrEqual(20).orderBy('next').toArray();
    const descending = await usersTable.where('age').aboveOrEqual(20).reverse().toArray();

    expect(ascending.length).toBe(descending.length);
    if (ascending.length > 1) {
      expect(ascending[0]?.age).not.toBe(descending[0]?.age);
    }

    db.close();
  });

  it('should limit results', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: {
          primaryKey: 'id',
          indexes: [{ name: 'age', keyPath: 'age' }],
        },
      },
    });

    await db.open();
    const usersTable = db.table<User>('users');

    await usersTable.add({ id: '1', name: 'John', email: 'john@example.com', age: 30, createdAt: 1000 });
    await usersTable.add({ id: '2', name: 'Jane', email: 'jane@example.com', age: 25, createdAt: 2000 });
    await usersTable.add({ id: '3', name: 'Bob', email: 'bob@example.com', age: 35, createdAt: 3000 });

    const results = await usersTable.where('age').aboveOrEqual(20).limit(2).toArray();
    expect(results.length).toBeLessThanOrEqual(2);

    db.close();
  });

  it('should offset results', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: {
          primaryKey: 'id',
          indexes: [{ name: 'age', keyPath: 'age' }],
        },
      },
    });

    await db.open();
    const usersTable = db.table<User>('users');

    await usersTable.add({ id: '1', name: 'John', email: 'john@example.com', age: 30, createdAt: 1000 });
    await usersTable.add({ id: '2', name: 'Jane', email: 'jane@example.com', age: 25, createdAt: 2000 });
    await usersTable.add({ id: '3', name: 'Bob', email: 'bob@example.com', age: 35, createdAt: 3000 });

    const all = await usersTable.where('age').aboveOrEqual(20).toArray();
    const offset = await usersTable.where('age').aboveOrEqual(20).offset(1).toArray();

    expect(offset.length).toBeLessThanOrEqual(all.length - 1);

    db.close();
  });

  it('should get first result', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: {
          primaryKey: 'id',
          indexes: [{ name: 'email', keyPath: 'email' }],
        },
      },
    });

    await db.open();
    const usersTable = db.table<User>('users');

    await usersTable.add({ id: '1', name: 'John', email: 'john@example.com', age: 30, createdAt: 1000 });
    await usersTable.add({ id: '2', name: 'Jane', email: 'jane@example.com', age: 25, createdAt: 2000 });

    const first = await usersTable.where('email').equals('john@example.com').first();
    expect(first).toBeDefined();
    expect(first?.email).toBe('john@example.com');

    db.close();
  });

  it('should count query results', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: {
          primaryKey: 'id',
          indexes: [{ name: 'age', keyPath: 'age' }],
        },
      },
    });

    await db.open();
    const usersTable = db.table<User>('users');

    await usersTable.add({ id: '1', name: 'John', email: 'john@example.com', age: 30, createdAt: 1000 });
    await usersTable.add({ id: '2', name: 'Jane', email: 'jane@example.com', age: 25, createdAt: 2000 });
    await usersTable.add({ id: '3', name: 'Bob', email: 'bob@example.com', age: 35, createdAt: 3000 });

    const count = await usersTable.where('age').aboveOrEqual(25).count();
    expect(count).toBeGreaterThan(0);

    db.close();
  });

  it('should chain query operations', async () => {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = createDB({
      name: testDBName,
      version: 1,
      stores: {
        users: {
          primaryKey: 'id',
          indexes: [{ name: 'age', keyPath: 'age' }],
        },
      },
    });

    await db.open();
    const usersTable = db.table<User>('users');

    await usersTable.add({ id: '1', name: 'John', email: 'john@example.com', age: 30, createdAt: 1000 });
    await usersTable.add({ id: '2', name: 'Jane', email: 'jane@example.com', age: 25, createdAt: 2000 });
    await usersTable.add({ id: '3', name: 'Bob', email: 'bob@example.com', age: 35, createdAt: 3000 });

    const results = await usersTable
      .where('age')
      .aboveOrEqual(25)
      .orderBy('next')
      .limit(2)
      .offset(0)
      .toArray();

    expect(results.length).toBeLessThanOrEqual(2);

    db.close();
  });
});
