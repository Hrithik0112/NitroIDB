import type { DatabaseSchema, StoreDefinition, IndexDefinition } from '../types/schema.js';
import { BrowserIncompatibilityError } from '../errors/browser.js';
import { detectBrowser } from './browser.js';

/**
 * Validate schema definition
 */
export function validateSchema(schema: DatabaseSchema): void {
  if (!schema.name || typeof schema.name !== 'string') {
    throw new Error('Schema must have a valid name');
  }

  if (typeof schema.version !== 'number' || schema.version < 1) {
    throw new Error('Schema version must be a positive integer');
  }

  if (!schema.stores || typeof schema.stores !== 'object') {
    throw new Error('Schema must have a stores object');
  }

  const storeNames = Object.keys(schema.stores);
  if (storeNames.length === 0) {
    throw new Error('Schema must have at least one store');
  }

  // Validate each store
  for (const [storeName, storeDef] of Object.entries(schema.stores)) {
    validateStoreDefinition(storeName, storeDef);
  }
}

/**
 * Validate a single store definition
 */
function validateStoreDefinition(storeName: string, storeDef: StoreDefinition): void {
  if (!storeDef.primaryKey) {
    throw new Error(`Store "${storeName}" must have a primaryKey`);
  }

  if (typeof storeDef.primaryKey !== 'string' && !Array.isArray(storeDef.primaryKey)) {
    throw new Error(`Store "${storeName}" primaryKey must be a string or array`);
  }

  // Validate indexes if present
  if (storeDef.indexes) {
    if (!Array.isArray(storeDef.indexes)) {
      throw new Error(`Store "${storeName}" indexes must be an array`);
    }

    const indexNames = new Set<string>();
    for (const index of storeDef.indexes) {
      validateIndexDefinition(storeName, index, indexNames);
    }
  }
}

/**
 * Validate an index definition
 */
function validateIndexDefinition(
  storeName: string,
  index: IndexDefinition,
  existingNames: Set<string>
): void {
  if (!index.name || typeof index.name !== 'string') {
    throw new Error(`Store "${storeName}" index must have a name`);
  }

  if (existingNames.has(index.name)) {
    throw new Error(`Store "${storeName}" has duplicate index name: ${index.name}`);
  }
  existingNames.add(index.name);

  if (!index.keyPath) {
    throw new Error(`Store "${storeName}" index "${index.name}" must have a keyPath`);
  }

  if (typeof index.keyPath !== 'string' && !Array.isArray(index.keyPath)) {
    throw new Error(`Store "${storeName}" index "${index.name}" keyPath must be a string or array`);
  }
}

/**
 * Check if IndexedDB is available
 */
export function checkIndexedDBAvailability(): void {
  if (typeof indexedDB === 'undefined') {
    const browserInfo = detectBrowser();
    throw new BrowserIncompatibilityError(
      'IndexedDB is not available in this environment',
      {
        browserInfo,
        missingFeature: 'indexedDB',
      }
    );
  }
}

/**
 * Create object stores from schema
 * This should be called within an onupgradeneeded handler
 * 
 * @param db - IDBDatabase instance (from onupgradeneeded event)
 * @param schema - Database schema definition
 * @param oldVersion - Previous database version
 * @param newVersion - New database version
 * @param transaction - The upgrade transaction (optional, for adding indexes to existing stores)
 */
export function createObjectStores(
  db: IDBDatabase,
  schema: DatabaseSchema,
  _oldVersion: number,
  _newVersion: number,
  transaction?: IDBTransaction
): void {
  const existingStoreNames = new Set<string>();
  for (let i = 0; i < db.objectStoreNames.length; i++) {
    const storeName = db.objectStoreNames[i];
    if (storeName) {
      existingStoreNames.add(storeName);
    }
  }

  // Create or update stores
  for (const [storeName, storeDef] of Object.entries(schema.stores)) {
    if (!existingStoreNames.has(storeName)) {
      // Create new store
      const primaryKey = storeDef.primaryKey;
      const objectStore = db.createObjectStore(storeName, {
        keyPath: primaryKey,
        autoIncrement: storeDef.autoIncrement ?? false,
      });

      // Create indexes
      if (storeDef.indexes) {
        for (const index of storeDef.indexes) {
          objectStore.createIndex(index.name, index.keyPath, {
            unique: index.unique ?? false,
            multiEntry: index.multiEntry ?? false,
          });
        }
      }
    } else if (transaction) {
      // Store exists - update indexes if needed
      // During onupgradeneeded, we can add indexes to existing stores
      const objectStore = transaction.objectStore(storeName);

      if (storeDef.indexes) {
        const existingIndexNames = new Set<string>();
        
        for (let i = 0; i < objectStore.indexNames.length; i++) {
          const indexName = objectStore.indexNames[i];
          if (indexName) {
            existingIndexNames.add(indexName);
          }
        }

        for (const index of storeDef.indexes) {
          if (!existingIndexNames.has(index.name)) {
            objectStore.createIndex(index.name, index.keyPath, {
              unique: index.unique ?? false,
              multiEntry: index.multiEntry ?? false,
            });
          }
        }
      }
    }
  }
}

