import { describe, it, expect } from 'vitest';
import { validateSchema, checkIndexedDBAvailability } from './schema.js';
import type { DatabaseSchema } from '../types/schema.js';

describe('validateSchema', () => {
  it('should validate a correct schema', () => {
    const schema: DatabaseSchema = {
      name: 'test',
      version: 1,
      stores: {
        users: {
          primaryKey: 'id',
          indexes: [{ name: 'email', keyPath: 'email', unique: true }],
        },
      },
    };

    expect(() => validateSchema(schema)).not.toThrow();
  });

  it('should throw if name is missing', () => {
    const schema = {
      version: 1,
      stores: {},
    } as unknown as DatabaseSchema;

    expect(() => validateSchema(schema)).toThrow('valid name');
  });

  it('should throw if version is invalid', () => {
    const schema: DatabaseSchema = {
      name: 'test',
      version: 0,
      stores: {
        users: { primaryKey: 'id' },
      },
    };

    expect(() => validateSchema(schema)).toThrow('version must be a positive integer');
  });

  it('should throw if stores is missing', () => {
    const schema = {
      name: 'test',
      version: 1,
    } as unknown as DatabaseSchema;

    expect(() => validateSchema(schema)).toThrow('stores object');
  });

  it('should throw if stores is empty', () => {
    const schema: DatabaseSchema = {
      name: 'test',
      version: 1,
      stores: {},
    };

    expect(() => validateSchema(schema)).toThrow('at least one store');
  });

  it('should throw if store missing primaryKey', () => {
    const schema: DatabaseSchema = {
      name: 'test',
      version: 1,
      stores: {
        users: {} as unknown as { primaryKey: string },
      },
    };

    expect(() => validateSchema(schema)).toThrow('must have a primaryKey');
  });

  it('should throw if index missing name', () => {
    const schema: DatabaseSchema = {
      name: 'test',
      version: 1,
      stores: {
        users: {
          primaryKey: 'id',
          indexes: [{ keyPath: 'email' }] as unknown as Array<{ name: string; keyPath: string }>,
        },
      },
    };

    expect(() => validateSchema(schema)).toThrow('index must have a name');
  });

  it('should throw if duplicate index names', () => {
    const schema: DatabaseSchema = {
      name: 'test',
      version: 1,
      stores: {
        users: {
          primaryKey: 'id',
          indexes: [
            { name: 'email', keyPath: 'email' },
            { name: 'email', keyPath: 'email2' },
          ],
        },
      },
    };

    expect(() => validateSchema(schema)).toThrow('duplicate index name');
  });
});

describe('checkIndexedDBAvailability', () => {
  it('should not throw if IndexedDB is available', () => {
    // Assuming we're in a test environment with IndexedDB
    if (typeof indexedDB !== 'undefined') {
      expect(() => checkIndexedDBAvailability()).not.toThrow();
    }
  });
});

