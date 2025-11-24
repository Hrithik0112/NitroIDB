import type { Database } from '../database/database.js';
import { TransactionAbortedError, StorageEvictedError, QuotaExceededError } from '../errors/index.js';
import { Query } from './query.js';

/**
 * Table interface for CRUD operations on object stores
 */
export class Table<T = unknown> {
  private readonly db: Database;
  private readonly storeName: string;

  constructor(db: Database, storeName: string) {
    this.db = db;
    this.storeName = storeName;
  }

  /**
   * Add a record to the table
   */
  async add(record: T): Promise<void> {
    const db = await this.db.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.add(record);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        const error = request.error;
        if (error) {
          reject(this.handleError(error, 'add'));
        } else {
          reject(new TransactionAbortedError('Failed to add record', { storeNames: [this.storeName] }));
        }
      };
    });
  }

  /**
   * Get a record by primary key
   */
  async get(key: IDBValidKey): Promise<T | undefined> {
    const db = await this.db.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result as T | undefined);
      };

      request.onerror = () => {
        const error = request.error;
        if (error) {
          reject(this.handleError(error, 'get', String(key)));
        } else {
          reject(new TransactionAbortedError('Failed to get record', { storeNames: [this.storeName] }));
        }
      };
    });
  }

  /**
   * Update a record by primary key
   */
  async update(key: IDBValidKey, updates: Partial<T>): Promise<void> {
    const db = await this.db.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const getRequest = store.get(key);

      getRequest.onsuccess = () => {
        const existing = getRequest.result as T | undefined;
        if (!existing) {
          reject(new Error(`Record with key ${String(key)} not found`));
          return;
        }

        const updated = { ...existing, ...updates };
        const putRequest = store.put(updated);

        putRequest.onsuccess = () => {
          resolve();
        };

        putRequest.onerror = () => {
          const error = putRequest.error;
          if (error) {
            reject(this.handleError(error, 'update', String(key)));
          } else {
            reject(new TransactionAbortedError('Failed to update record', { storeNames: [this.storeName] }));
          }
        };
      };

      getRequest.onerror = () => {
        const error = getRequest.error;
        if (error) {
          reject(this.handleError(error, 'update', String(key)));
        } else {
          reject(new TransactionAbortedError('Failed to get record for update', { storeNames: [this.storeName] }));
        }
      };
    });
  }

  /**
   * Replace a record entirely (put)
   */
  async put(record: T): Promise<void> {
    const db = await this.db.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(record);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        const error = request.error;
        if (error) {
          reject(this.handleError(error, 'put'));
        } else {
          reject(new TransactionAbortedError('Failed to put record', { storeNames: [this.storeName] }));
        }
      };
    });
  }

  /**
   * Delete a record by primary key
   */
  async delete(key: IDBValidKey): Promise<void> {
    const db = await this.db.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        const error = request.error;
        if (error) {
          reject(this.handleError(error, 'delete', String(key)));
        } else {
          reject(new TransactionAbortedError('Failed to delete record', { storeNames: [this.storeName] }));
        }
      };
    });
  }

  /**
   * Clear all records from the table
   */
  async clear(): Promise<void> {
    const db = await this.db.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        const error = request.error;
        if (error) {
          reject(this.handleError(error, 'clear'));
        } else {
          reject(new TransactionAbortedError('Failed to clear table', { storeNames: [this.storeName] }));
        }
      };
    });
  }

  /**
   * Get multiple records by keys
   */
  async getMany(keys: IDBValidKey[]): Promise<T[]> {
    const db = await this.db.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const results: T[] = [];
      let completed = 0;
      let hasError = false;

      if (keys.length === 0) {
        resolve([]);
        return;
      }

      for (const key of keys) {
        const request = store.get(key);

        request.onsuccess = () => {
          if (request.result !== undefined) {
            results.push(request.result as T);
          }
          completed++;

          if (completed === keys.length && !hasError) {
            resolve(results);
          }
        };

        request.onerror = () => {
          if (!hasError) {
            hasError = true;
            const error = request.error;
            if (error) {
              reject(this.handleError(error, 'getMany', String(key)));
            } else {
              reject(new TransactionAbortedError('Failed to get records', { storeNames: [this.storeName] }));
            }
          }
        };
      }
    });
  }

  /**
   * Delete multiple records by keys
   */
  async deleteMany(keys: IDBValidKey[]): Promise<void> {
    const db = await this.db.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      let completed = 0;
      let hasError = false;

      if (keys.length === 0) {
        resolve();
        return;
      }

      for (const key of keys) {
        const request = store.delete(key);

        request.onsuccess = () => {
          completed++;

          if (completed === keys.length && !hasError) {
            resolve();
          }
        };

        request.onerror = () => {
          if (!hasError) {
            hasError = true;
            const error = request.error;
            if (error) {
              reject(this.handleError(error, 'deleteMany', String(key)));
            } else {
              reject(new TransactionAbortedError('Failed to delete records', { storeNames: [this.storeName] }));
            }
          }
        };
      }
    });
  }

  /**
   * Count records in the table
   */
  async count(key?: IDBValidKey | IDBKeyRange): Promise<number> {
    const db = await this.db.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = key !== undefined ? store.count(key) : store.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        const error = request.error;
        if (error) {
          reject(this.handleError(error, 'count'));
        } else {
          reject(new TransactionAbortedError('Failed to count records', { storeNames: [this.storeName] }));
        }
      };
    });
  }

  /**
   * Check if a record exists by primary key
   */
  async has(key: IDBValidKey): Promise<boolean> {
    const db = await this.db.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.count(IDBKeyRange.only(key));

      request.onsuccess = () => {
        resolve(request.result > 0);
      };

      request.onerror = () => {
        const error = request.error;
        if (error) {
          reject(this.handleError(error, 'has', String(key)));
        } else {
          reject(new TransactionAbortedError('Failed to check record existence', { storeNames: [this.storeName] }));
        }
      };
    });
  }

  /**
   * Create a query builder for this table
   */
  query(): Query<T> {
    return new Query<T>(this.db, this.storeName);
  }

  /**
   * Query by index
   */
  where(indexName: string): ReturnType<Query<T>['where']> {
    return this.query().where(indexName);
  }

  /**
   * Query by primary key
   */
  whereKey(): ReturnType<Query<T>['whereKey']> {
    return this.query().whereKey();
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
      `Table operation "${operation}" failed${key ? ` for key "${key}"` : ''}: ${error.message}`,
      {
        browserInfo,
        storeNames: [this.storeName],
      }
    );
  }
}

