import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDB } from '../database/index.js';
import { KVStore } from '../kv/index.js';

describe('KVStore', () => {
  const testDBName = 'test-kv-' + Date.now();

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

  it('should create KV store', async () => {
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
    expect(db.kv).toBeDefined();
    db.close();
  });

  it('should set and get values', async () => {
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

    await db.kv.set('theme', 'dark');
    const theme = await db.kv.get('theme');
    expect(theme).toBe('dark');

    await db.kv.set('count', 42);
    const count = await db.kv.get<number>('count');
    expect(count).toBe(42);

    db.close();
  });

  it('should return undefined for non-existent keys', async () => {
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

    const value = await db.kv.get('nonexistent');
    expect(value).toBeUndefined();

    db.close();
  });

  it('should delete values', async () => {
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

    await db.kv.set('temp', 'value');
    await db.kv.delete('temp');
    const value = await db.kv.get('temp');
    expect(value).toBeUndefined();

    db.close();
  });

  it('should check if key exists', async () => {
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

    await db.kv.set('exists', 'yes');
    expect(await db.kv.has('exists')).toBe(true);
    expect(await db.kv.has('notexists')).toBe(false);

    db.close();
  });

  it('should get all keys', async () => {
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

    await db.kv.set('key1', 'value1');
    await db.kv.set('key2', 'value2');
    await db.kv.set('key3', 'value3');

    const keys = await db.kv.keys();
    expect(keys.sort()).toEqual(['key1', 'key2', 'key3'].sort());

    db.close();
  });

  it('should get all values', async () => {
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

    await db.kv.set('key1', 'value1');
    await db.kv.set('key2', 'value2');

    const values = await db.kv.values<string>();
    expect(values.sort()).toEqual(['value1', 'value2'].sort());

    db.close();
  });

  it('should clear all values', async () => {
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

    await db.kv.set('key1', 'value1');
    await db.kv.set('key2', 'value2');
    await db.kv.clear();

    const keys = await db.kv.keys();
    expect(keys).toHaveLength(0);

    db.close();
  });

  it('should support namespaces', async () => {
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

    const userPrefs: KVStore = db.kv.namespace('userPrefs');
    const appSettings: KVStore = db.kv.namespace('appSettings');

    await userPrefs.set('theme', 'dark');
    await appSettings.set('theme', 'light');

    expect(await userPrefs.get('theme')).toBe('dark');
    expect(await appSettings.get('theme')).toBe('light');

    // Global kv should not see namespaced keys
    const globalTheme = await db.kv.get('theme');
    expect(globalTheme).toBeUndefined();

    // But namespaced should see their own keys
    const userKeys = await userPrefs.keys();
    expect(userKeys).toContain('theme');

    db.close();
  });

  it('should clear only namespaced values', async () => {
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

    await db.kv.set('global', 'value');
    const userPrefs: KVStore = db.kv.namespace('userPrefs');
    await userPrefs.set('theme', 'dark');
    await userPrefs.clear();

    expect(await db.kv.get('global')).toBe('value');
    expect(await userPrefs.get('theme')).toBeUndefined();

    db.close();
  });

  it('should support nested namespaces', async () => {
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

    const user: KVStore = db.kv.namespace('user');
    const prefs: KVStore = user.namespace('prefs');

    await prefs.set('theme', 'dark');
    expect(await prefs.get('theme')).toBe('dark');

    db.close();
  });
});

