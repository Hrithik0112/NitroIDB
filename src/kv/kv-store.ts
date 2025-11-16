import type { Database } from '../database/database.js';
import { TransactionAbortedError, StorageEvictedError, QuotaExceededError } from '../errors/index.js';

/**
 * Key-Value store for simple key-value operations
 */
export class KVStore {
  private readonly db: Database;
  private readonly storeName: string;
  private readonly namespacePrefix: string;

  constructor(db: Database, storeName: string = '__kv__', namespace: string = '') {
    this.db = db;
    this.storeName = storeName;
    this.namespacePrefix = namespace;
  }

  /**
   * Get a value by key
   */
  async get<T = unknown>(key: string): Promise<T | undefined> {
    const db = await this.db.getDB();
    const fullKey = this.getFullKey(key);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(fullKey);

      request.onsuccess = () => {
        resolve(request.result as T | undefined);
      };

      request.onerror = () => {
        const error = request.error;
        if (error) {
          reject(this.handleError(error, 'get', key));
        } else {
          reject(new TransactionAbortedError('Failed to get value', { storeNames: [this.storeName] }));
        }
      };
    });
  }

  /**
   * Set a value by key
   */
  async set<T = unknown>(key: string, value: T): Promise<void> {
    const db = await this.db.getDB();
    const fullKey = this.getFullKey(key);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put({ key: fullKey, value });

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        const error = request.error;
        if (error) {
          reject(this.handleError(error, 'set', key));
        } else {
          reject(new TransactionAbortedError('Failed to set value', { storeNames: [this.storeName] }));
        }
      };
    });
  }

  /**
   * Delete a value by key
   */
  async delete(key: string): Promise<void> {
    const db = await this.db.getDB();
    const fullKey = this.getFullKey(key);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(fullKey);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        const error = request.error;
        if (error) {
          reject(this.handleError(error, 'delete', key));
        } else {
          reject(new TransactionAbortedError('Failed to delete value', { storeNames: [this.storeName] }));
        }
      };
    });
  }

  /**
   * Check if a key exists
   */
  async has(key: string): Promise<boolean> {
    const db = await this.db.getDB();
    const fullKey = this.getFullKey(key);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.count(IDBKeyRange.only(fullKey));

      request.onsuccess = () => {
        resolve(request.result > 0);
      };

      request.onerror = () => {
        const error = request.error;
        if (error) {
          reject(this.handleError(error, 'has', key));
        } else {
          reject(new TransactionAbortedError('Failed to check key existence', { storeNames: [this.storeName] }));
        }
      };
    });
  }

  /**
   * Get all keys (optionally filtered by namespace)
   */
  async keys(): Promise<string[]> {
    const db = await this.db.getDB();
    const prefix = this.namespacePrefix ? `${this.namespacePrefix}:` : '';

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.openCursor();

      const keys: string[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const item = cursor.value as { key: string; value: unknown };
          if (prefix) {
            if (item.key.startsWith(prefix)) {
              // Remove namespace prefix from key
              keys.push(item.key.slice(prefix.length));
            }
          } else {
            keys.push(item.key);
          }
          cursor.continue();
        } else {
          resolve(keys);
        }
      };

      request.onerror = () => {
        const error = request.error;
        if (error) {
          reject(this.handleError(error, 'keys'));
        } else {
          reject(new TransactionAbortedError('Failed to get keys', { storeNames: [this.storeName] }));
        }
      };
    });
  }

  /**
   * Get all values (optionally filtered by namespace)
   */
  async values<T = unknown>(): Promise<T[]> {
    const db = await this.db.getDB();
    const prefix = this.namespacePrefix ? `${this.namespacePrefix}:` : '';

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.openCursor();

      const values: T[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const item = cursor.value as { key: string; value: T };
          if (prefix) {
            if (item.key.startsWith(prefix)) {
              values.push(item.value);
            }
          } else {
            values.push(item.value);
          }
          cursor.continue();
        } else {
          resolve(values);
        }
      };

      request.onerror = () => {
        const error = request.error;
        if (error) {
          reject(this.handleError(error, 'values'));
        } else {
          reject(new TransactionAbortedError('Failed to get values', { storeNames: [this.storeName] }));
        }
      };
    });
  }

  /**
   * Clear all keys (optionally filtered by namespace)
   */
  async clear(): Promise<void> {
    const db = await this.db.getDB();
    const prefix = this.namespacePrefix ? `${this.namespacePrefix}:` : '';

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      if (prefix) {
        // Delete only keys with this namespace
        const request = store.openCursor();

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            const item = cursor.value as { key: string };
            if (item.key.startsWith(prefix)) {
              cursor.delete();
            }
            cursor.continue();
          } else {
            // All deletions complete
            resolve();
          }
        };

        request.onerror = () => {
          const error = request.error;
          if (error) {
            reject(this.handleError(error, 'clear'));
          } else {
            reject(new TransactionAbortedError('Failed to clear values', { storeNames: [this.storeName] }));
          }
        };
      } else {
        // Clear all keys
        const request = store.clear();
        request.onsuccess = () => {
          resolve();
        };
        request.onerror = () => {
          const error = request.error;
          if (error) {
            reject(this.handleError(error, 'clear'));
          } else {
            reject(new TransactionAbortedError('Failed to clear values', { storeNames: [this.storeName] }));
          }
        };
      }
    });
  }

  /**
   * Create a namespaced KV store
   */
  namespace(prefix: string): KVStore {
    const newNamespace = this.namespacePrefix ? `${this.namespacePrefix}:${prefix}` : prefix;
    return new KVStore(this.db, this.storeName, newNamespace);
  }

  /**
   * Get the full key with namespace prefix
   */
  private getFullKey(key: string): string {
    if (this.namespacePrefix) {
      return `${this.namespacePrefix}:${key}`;
    }
    return key;
  }

  /**
   * Handle IndexedDB errors and convert to NitroIDB errors
   */
  private handleError(error: DOMException | Error, operation: string, key?: string): Error {
    const browserInfo = this.db.getBrowserInfo();
    
    if (error.name === 'QuotaExceededError') {
      return new QuotaExceededError({
        browserInfo,
        attemptedSize: key ? 1 : undefined,
      });
    }

    if (error.name === 'UnknownError' || error.message.includes('quota') || error.message.includes('storage')) {
      return new StorageEvictedError({
        browserInfo,
      });
    }

    return new TransactionAbortedError(
      `KV operation "${operation}" failed${key ? ` for key "${key}"` : ''}: ${error.message}`,
      {
        browserInfo,
        storeNames: [this.storeName],
      }
    );
  }
}

