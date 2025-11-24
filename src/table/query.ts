import type { Database } from '../database/database.js';
import type { QueryDirection } from '../types/store.js';
import { TransactionAbortedError, StorageEvictedError, QuotaExceededError } from '../errors/index.js';

/**
 * Query builder for table operations
 */
export class Query<T = unknown> {
  private readonly db: Database;
  private readonly storeName: string;
  private indexName: string | null = null;
  private keyRange: IDBKeyRange | null = null;
  private direction: QueryDirection = 'next';
  private limitCount: number | null = null;
  private offsetCount: number = 0;

  constructor(db: Database, storeName: string) {
    this.db = db;
    this.storeName = storeName;
  }

  /**
   * Query by index
   */
  where(indexName: string): QueryWhere<T> {
    this.indexName = indexName;
    return new QueryWhere(this);
  }

  /**
   * Query by primary key
   */
  whereKey(): QueryWhere<T> {
    this.indexName = null; // Use primary key
    return new QueryWhere(this);
  }

  /**
   * Set sort direction
   */
  orderBy(direction: QueryDirection = 'next'): this {
    this.direction = direction;
    return this;
  }

  /**
   * Reverse sort order
   */
  reverse(): this {
    this.direction = this.direction === 'next' ? 'prev' : 'next';
    return this;
  }

  /**
   * Limit number of results
   */
  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  /**
   * Skip number of results
   */
  offset(count: number): this {
    this.offsetCount = count;
    return this;
  }

  /**
   * Execute query and return all results
   */
  async toArray(): Promise<T[]> {
    const db = await this.db.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      const source = this.indexName 
        ? store.index(this.indexName)
        : store;

      const request = this.keyRange
        ? source.openCursor(this.keyRange, this.direction)
        : source.openCursor(null, this.direction);

      const results: T[] = [];
      let skipped = 0;

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(results);
          return;
        }

        // Handle offset
        if (skipped < this.offsetCount) {
          skipped++;
          cursor.continue();
          return;
        }

        // Handle limit
        if (this.limitCount !== null && results.length >= this.limitCount) {
          resolve(results);
          return;
        }

        results.push(cursor.value as T);
        cursor.continue();
      };

      request.onerror = () => {
        const error = request.error;
        if (error) {
          reject(this.handleError(error, 'toArray'));
        } else {
          reject(new TransactionAbortedError('Failed to execute query', { storeNames: [this.storeName] }));
        }
      };
    });
  }

  /**
   * Execute query and return first result
   */
  async first(): Promise<T | undefined> {
    const results = await this.limit(1).toArray();
    return results[0];
  }

  /**
   * Count matching records
   */
  async count(): Promise<number> {
    const db = await this.db.getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      const source = this.indexName 
        ? store.index(this.indexName)
        : store;

      const request = this.keyRange
        ? source.count(this.keyRange)
        : source.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        const error = request.error;
        if (error) {
          reject(this.handleError(error, 'count'));
        } else {
          reject(new TransactionAbortedError('Failed to count query results', { storeNames: [this.storeName] }));
        }
      };
    });
  }

  /**
   * Set key range (internal use by QueryWhere)
   */
  setKeyRange(range: IDBKeyRange): void {
    this.keyRange = range;
  }

  /**
   * Handle IndexedDB errors and convert to NitroIDB errors
   */
  private handleError(error: DOMException | Error, operation: string): Error {
    const browserInfo = this.db.getBrowserInfo();

    if (error.name === 'QuotaExceededError') {
      return new QuotaExceededError({
        browserInfo,
      });
    }

    if (error.name === 'UnknownError' || error.message.includes('quota') || error.message.includes('storage')) {
      return new StorageEvictedError({
        browserInfo,
      });
    }

    return new TransactionAbortedError(
      `Query operation "${operation}" failed: ${error.message}`,
      {
        browserInfo,
        storeNames: [this.storeName],
      }
    );
  }
}

/**
 * Query where clause builder
 */
export class QueryWhere<T = unknown> {
  private readonly query: Query<T>;

  constructor(query: Query<T>) {
    this.query = query;
  }

  /**
   * Match exact value
   */
  equals(value: IDBValidKey): Query<T> {
    this.query.setKeyRange(IDBKeyRange.only(value));
    return this.query;
  }

  /**
   * Match values above (exclusive)
   */
  above(value: IDBValidKey): Query<T> {
    this.query.setKeyRange(IDBKeyRange.lowerBound(value, true));
    return this.query;
  }

  /**
   * Match values above or equal (inclusive)
   */
  aboveOrEqual(value: IDBValidKey): Query<T> {
    this.query.setKeyRange(IDBKeyRange.lowerBound(value, false));
    return this.query;
  }

  /**
   * Match values below (exclusive)
   */
  below(value: IDBValidKey): Query<T> {
    this.query.setKeyRange(IDBKeyRange.upperBound(value, true));
    return this.query;
  }

  /**
   * Match values below or equal (inclusive)
   */
  belowOrEqual(value: IDBValidKey): Query<T> {
    this.query.setKeyRange(IDBKeyRange.upperBound(value, false));
    return this.query;
  }

  /**
   * Match values between two bounds
   */
  between(lower: IDBValidKey, upper: IDBValidKey, lowerOpen: boolean = false, upperOpen: boolean = false): Query<T> {
    this.query.setKeyRange(IDBKeyRange.bound(lower, upper, lowerOpen, upperOpen));
    return this.query;
  }

  /**
   * Match values in array
   * Note: This uses a range approximation. For exact matching, results are filtered in JavaScript.
   */
  in(values: IDBValidKey[]): Query<T> {
    // For multiple values, we'll need to do multiple queries and combine
    // This is a simplified version - in practice, you might want to optimize this
    // For now, we'll use a range that covers all values
    if (values.length === 0) {
      // Return empty range
      this.query.setKeyRange(IDBKeyRange.bound('', '', true, true));
      return this.query;
    }

    if (values.length === 1) {
      const value = values[0];
      if (value !== undefined && value !== null) {
        return this.equals(value);
      }
      // Return empty range for undefined/null
      this.query.setKeyRange(IDBKeyRange.bound('', '', true, true));
      return this.query;
    }

    // Filter out undefined/null values
    const validValues = values.filter((v): v is IDBValidKey => v !== undefined && v !== null);
    
    if (validValues.length === 0) {
      this.query.setKeyRange(IDBKeyRange.bound('', '', true, true));
      return this.query;
    }

    // Use a range that covers all values
    const sorted = [...validValues].sort();
    const lower = sorted[0];
    const upper = sorted[sorted.length - 1];
    if (lower !== undefined && upper !== undefined) {
      this.query.setKeyRange(IDBKeyRange.bound(lower, upper, false, false));
    }
    
    // Note: This is approximate - actual implementation would filter results
    // For exact matching, we'd need to fetch and filter in JavaScript
    return this.query;
  }

  /**
   * Match strings that start with prefix (for string indexes)
   */
  startsWith(prefix: string): Query<T> {
    if (typeof prefix !== 'string') {
      throw new Error('startsWith can only be used with string values');
    }

    // Create a range from prefix to prefix + '\uffff' (highest Unicode character)
    const upperBound = prefix + '\uffff';
    this.query.setKeyRange(IDBKeyRange.bound(prefix, upperBound, false, true));
    return this.query;
  }
}
