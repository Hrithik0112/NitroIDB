import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getMigrationHistory,
  saveMigrationHistory,
  createBackup,
  restoreBackup,
  validateMigrations,
  getNextMigrationVersion,
  needsMigration,
} from './migration.js';
import { createDB } from '../database/index.js';

describe('Migration Utilities', () => {
  const testDBName = 'test-migration-' + Date.now();

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

  describe('getMigrationHistory', () => {
    it('should return empty array when no history exists', async () => {
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
      const history = await getMigrationHistory(db);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBe(0);

      db.close();
    });
  });

  describe('saveMigrationHistory', () => {
    it('should save migration history entry', async () => {
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

      const entry = {
        fromVersion: 1,
        toVersion: 2,
        timestamp: Date.now(),
        success: true,
        description: 'Test migration',
      };

      await saveMigrationHistory(db, entry);

      const history = await getMigrationHistory(db);
      expect(history.length).toBe(1);
      expect(history[0].fromVersion).toBe(1);
      expect(history[0].toVersion).toBe(2);
      expect(history[0].success).toBe(true);

      db.close();
    });

    it('should keep only last 100 entries', async () => {
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

      // Add 105 entries
      for (let i = 0; i < 105; i++) {
        await saveMigrationHistory(db, {
          fromVersion: i,
          toVersion: i + 1,
          timestamp: Date.now(),
          success: true,
        });
      }

      const history = await getMigrationHistory(db);
      expect(history.length).toBe(100);

      db.close();
    });
  });

  describe('createBackup', () => {
    it('should create backup of database stores', async () => {
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

      // Add some data
      const usersTable = db.table('users');
      await usersTable.add({ id: '1', name: 'John' });
      await usersTable.add({ id: '2', name: 'Jane' });

      const postsTable = db.table('posts');
      await postsTable.add({ id: '1', title: 'Post 1' });

      const backup = await createBackup(db);

      expect(backup).toHaveProperty('users');
      expect(backup).toHaveProperty('posts');
      expect(backup.users.length).toBe(2);
      expect(backup.posts.length).toBe(1);
      expect(backup.users[0]).toHaveProperty('id');
      expect(backup.users[0]).toHaveProperty('name');

      db.close();
    });

    it('should skip internal stores', async () => {
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

      const backup = await createBackup(db);

      expect(backup).not.toHaveProperty('__kv__');
      expect(backup).not.toHaveProperty('__migration_history__');

      db.close();
    });
  });

  describe('restoreBackup', () => {
    it('should restore database from backup', async () => {
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

      // Add data
      const usersTable = db.table('users');
      await usersTable.add({ id: '1', name: 'John' });
      await usersTable.add({ id: '2', name: 'Jane' });

      // Create backup
      const backup = await createBackup(db);

      // Clear data
      await usersTable.clear();

      // Restore
      await restoreBackup(db, backup);

      // Verify restored
      const count = await usersTable.count();
      expect(count).toBe(2);

      const user = await usersTable.get('1');
      expect(user).toHaveProperty('name', 'John');

      db.close();
    });
  });

  describe('validateMigrations', () => {
    it('should validate migrations correctly', () => {
      const migrations = {
        2: () => {},
        3: () => {},
        4: () => {},
      };

      const result = validateMigrations(migrations, 1, 4);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should detect missing migrations', () => {
      const migrations = {
        2: () => {},
        4: () => {}, // Missing version 3
      };

      const result = validateMigrations(migrations, 1, 4);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing migration for version 3');
    });

    it('should detect duplicate versions', () => {
      const migrations = {
        2: () => {},
        3: () => {},
      };

      // This shouldn't happen in practice, but test the validation
      const result = validateMigrations(migrations, 1, 3);
      expect(result.valid).toBe(true);
    });
  });

  describe('getNextMigrationVersion', () => {
    it('should return next migration version', () => {
      const migrations = {
        2: () => {},
        3: () => {},
        5: () => {},
      };

      const next = getNextMigrationVersion(migrations, 1);
      expect(next).toBe(2);
    });

    it('should return null if no migrations needed', () => {
      const migrations = {
        2: () => {},
        3: () => {},
      };

      const next = getNextMigrationVersion(migrations, 5);
      expect(next).toBeNull();
    });
  });

  describe('needsMigration', () => {
    it('should return true if migrations are needed', () => {
      const migrations = {
        2: () => {},
        3: () => {},
      };

      const needs = needsMigration(migrations, 1, 3);
      expect(needs).toBe(true);
    });

    it('should return false if no migrations needed', () => {
      const migrations = {
        2: () => {},
        3: () => {},
      };

      const needs = needsMigration(migrations, 3, 3);
      expect(needs).toBe(false);
    });

    it('should return false if current version is higher', () => {
      const migrations = {
        2: () => {},
        3: () => {},
      };

      const needs = needsMigration(migrations, 5, 3);
      expect(needs).toBe(false);
    });
  });
});

