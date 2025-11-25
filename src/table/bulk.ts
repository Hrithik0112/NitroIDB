import type { Database } from '../database/database.js';
import { TransactionAbortedError, StorageEvictedError, QuotaExceededError, TransactionTimeoutError } from '../errors/index.js';

/**
 * Options for bulk write operations
 */
export interface BulkWriteOptions {
  /** Initial batch size (will auto-shrink on failure) */
  batchSize?: number;
  /** Maximum number of retries per batch */
  retries?: number;
  /** Initial retry delay in milliseconds */
  retryDelay?: number;
  /** Progress callback: (done, total) => void */
  progress?: (done: number, total: number) => void;
  /** Whether to retry on failure */
  retryOnFail?: boolean;
  /** Transaction timeout in milliseconds */
  timeout?: number;
}

/**
 * Result of bulk write operation
 */
export interface BulkWriteResult {
  /** Number of successfully written records */
  success: number;
  /** Number of failed records */
  failed: number;
  /** Failed record indices (if available) */
  failedIndices?: number[];
  /** Errors encountered (if any) */
  errors?: Error[];
}

/**
 * Bulk write engine for efficient batch operations
 */
export class BulkWriteEngine<T = unknown> {
  private readonly db: Database;
  private readonly storeName: string;

  constructor(db: Database, storeName: string) {
    this.db = db;
    this.storeName = storeName;
  }

  /**
   * Bulk add records with adaptive batching
   */
  async bulkAdd(
    records: T[],
    options: BulkWriteOptions = {}
  ): Promise<BulkWriteResult> {
    if (records.length === 0) {
      return { success: 0, failed: 0 };
    }

    const quirks = this.db.getQuirks();
    const batchSize = options.batchSize ?? quirks.recommendedBatchSize;
    const maxRetries = options.retries ?? (options.retryOnFail ? 3 : 0);
    const retryDelay = options.retryDelay ?? (quirks.safariQuirks ? 200 : 100);
    const timeout = options.timeout ?? quirks.recommendedTimeout;
    const progress = options.progress;

    let currentBatchSize = batchSize;
    let successCount = 0;
    let failedCount = 0;
    const failedIndices: number[] = [];
    const errors: Error[] = [];

    // Process in batches
    for (let i = 0; i < records.length; i += currentBatchSize) {
      const batch = records.slice(i, i + currentBatchSize);
      const batchStartIndex = i;

      let batchSuccess = false;
      let attempt = 0;

      // Retry logic for this batch
      while (attempt <= maxRetries && !batchSuccess) {
        try {
          const batchResult = await this.writeBatch(batch, timeout);
          successCount += batchResult.success;
          failedCount += batchResult.failed;

          // Track failed indices
          if (batchResult.failedIndices) {
            batchResult.failedIndices.forEach((idx) => {
              failedIndices.push(batchStartIndex + idx);
            });
          }

          if (batchResult.errors) {
            errors.push(...batchResult.errors);
          }

          batchSuccess = true;

          // If batch succeeded, we can try increasing batch size slightly
          if (attempt === 0 && currentBatchSize < batchSize * 2) {
            currentBatchSize = Math.min(currentBatchSize + 10, batchSize * 2);
          }
        } catch (error) {
          attempt++;

          if (attempt > maxRetries) {
            // Batch failed after all retries
            failedCount += batch.length;
            errors.push(error instanceof Error ? error : new Error(String(error)));
            batch.forEach((_, idx) => failedIndices.push(batchStartIndex + idx));

            // Shrink batch size for next batch
            currentBatchSize = Math.max(Math.floor(currentBatchSize * 0.5), 10);
          } else {
            // Exponential backoff before retry
            const delay = retryDelay * Math.pow(2, attempt - 1);
            await this.sleep(delay);

            // Shrink batch size on retry
            if (attempt > 1) {
              currentBatchSize = Math.max(Math.floor(currentBatchSize * 0.7), 10);
            }
          }
        }
      }

      // Report progress
      if (progress) {
        progress(successCount + failedCount, records.length);
      }
    }

    return {
      success: successCount,
      failed: failedCount,
      failedIndices: failedIndices.length > 0 ? failedIndices : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Write a single batch of records
   */
  private async writeBatch(
    batch: T[],
    timeout: number
  ): Promise<BulkWriteResult> {
    const db = await this.db.getDB();

    return new Promise((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let transactionCompleted = false;

      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);

      // Set timeout
      timeoutId = setTimeout(() => {
        if (!transactionCompleted) {
          transactionCompleted = true;
          transaction.abort();
          const browserInfo = this.db.getBrowserInfo();
          reject(
            new TransactionTimeoutError(timeout, {
              browserInfo,
              storeNames: [this.storeName],
            })
          );
        }
      }, timeout);

      const results: { success: number; failed: number; failedIndices: number[]; errors: Error[] } = {
        success: 0,
        failed: 0,
        failedIndices: [],
        errors: [],
      };

      let completed = 0;
      let hasError = false;

      // Add all records in the batch
      for (let i = 0; i < batch.length; i++) {
        const record = batch[i];
        const request = store.add(record);

        request.onsuccess = () => {
          results.success++;
          completed++;

          if (completed === batch.length && !hasError) {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            transactionCompleted = true;
            resolve(results);
          }
        };

        request.onerror = () => {
          if (!hasError) {
            hasError = true;
            const error = request.error;
            const errorObj = this.handleError(
              error ?? new Error('Add failed'),
              'bulkAdd',
              i
            );

            results.failed++;
            results.failedIndices.push(i);
            results.errors.push(errorObj);
          }

          completed++;

          // Continue processing other records even if one fails
          if (completed === batch.length) {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            transactionCompleted = true;
            resolve(results);
          }
        };
      }

      transaction.onerror = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (!transactionCompleted) {
          transactionCompleted = true;
          const error = transaction.error;
          const browserInfo = this.db.getBrowserInfo();
          reject(
            new TransactionAbortedError(
              error?.message ?? 'Transaction failed',
              {
                browserInfo,
                storeNames: [this.storeName],
              }
            )
          );
        }
      };

      transaction.onabort = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (!transactionCompleted) {
          transactionCompleted = true;
          const browserInfo = this.db.getBrowserInfo();
          reject(
            new TransactionAbortedError('Transaction was aborted', {
              browserInfo,
              storeNames: [this.storeName],
            })
          );
        }
      };
    });
  }

  /**
   * Bulk delete records with adaptive batching
   */
  async bulkDelete(
    keys: IDBValidKey[],
    options: BulkWriteOptions = {}
  ): Promise<BulkWriteResult> {
    if (keys.length === 0) {
      return { success: 0, failed: 0 };
    }

    const quirks = this.db.getQuirks();
    const batchSize = options.batchSize ?? quirks.recommendedBatchSize;
    const maxRetries = options.retries ?? (options.retryOnFail ? 3 : 0);
    const retryDelay = options.retryDelay ?? (quirks.safariQuirks ? 200 : 100);
    const timeout = options.timeout ?? quirks.recommendedTimeout;
    const progress = options.progress;

    let currentBatchSize = batchSize;
    let successCount = 0;
    let failedCount = 0;
    const failedIndices: number[] = [];
    const errors: Error[] = [];

    // Process in batches
    for (let i = 0; i < keys.length; i += currentBatchSize) {
      const batch = keys.slice(i, i + currentBatchSize);
      const batchStartIndex = i;

      let batchSuccess = false;
      let attempt = 0;

      // Retry logic for this batch
      while (attempt <= maxRetries && !batchSuccess) {
        try {
          const batchResult = await this.deleteBatch(batch, timeout);
          successCount += batchResult.success;
          failedCount += batchResult.failed;

          if (batchResult.failedIndices) {
            batchResult.failedIndices.forEach((idx) => {
              failedIndices.push(batchStartIndex + idx);
            });
          }

          if (batchResult.errors) {
            errors.push(...batchResult.errors);
          }

          batchSuccess = true;
        } catch (error) {
          attempt++;

          if (attempt > maxRetries) {
            failedCount += batch.length;
            errors.push(error instanceof Error ? error : new Error(String(error)));
            batch.forEach((_, idx) => failedIndices.push(batchStartIndex + idx));
            currentBatchSize = Math.max(Math.floor(currentBatchSize * 0.5), 10);
          } else {
            const delay = retryDelay * Math.pow(2, attempt - 1);
            await this.sleep(delay);
            if (attempt > 1) {
              currentBatchSize = Math.max(Math.floor(currentBatchSize * 0.7), 10);
            }
          }
        }
      }

      if (progress) {
        progress(successCount + failedCount, keys.length);
      }
    }

    return {
      success: successCount,
      failed: failedCount,
      failedIndices: failedIndices.length > 0 ? failedIndices : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Delete a single batch of keys
   */
  private async deleteBatch(
    keys: IDBValidKey[],
    timeout: number
  ): Promise<BulkWriteResult> {
    const db = await this.db.getDB();

    return new Promise((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let transactionCompleted = false;

      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);

      timeoutId = setTimeout(() => {
        if (!transactionCompleted) {
          transactionCompleted = true;
          transaction.abort();
          const browserInfo = this.db.getBrowserInfo();
          reject(
            new TransactionTimeoutError(timeout, {
              browserInfo,
              storeNames: [this.storeName],
            })
          );
        }
      }, timeout);

      const results: { success: number; failed: number; failedIndices: number[]; errors: Error[] } = {
        success: 0,
        failed: 0,
        failedIndices: [],
        errors: [],
      };

      let completed = 0;
      let hasError = false;

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (key === undefined || key === null) {
          // Skip undefined/null keys
          results.failed++;
          results.failedIndices.push(i);
          results.errors.push(new Error(`Invalid key at index ${i}`));
          completed++;
          if (completed === keys.length) {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            transactionCompleted = true;
            resolve(results);
          }
          continue;
        }

        const request = store.delete(key);

        request.onsuccess = () => {
          results.success++;
          completed++;

          if (completed === keys.length && !hasError) {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            transactionCompleted = true;
            resolve(results);
          }
        };

        request.onerror = () => {
          if (!hasError) {
            hasError = true;
            const error = request.error;
            const errorObj = this.handleError(
              error ?? new Error('Delete failed'),
              'bulkDelete',
              i
            );

            results.failed++;
            results.failedIndices.push(i);
            results.errors.push(errorObj);
          }

          completed++;

          if (completed === keys.length) {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            transactionCompleted = true;
            resolve(results);
          }
        };
      }

      transaction.onerror = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (!transactionCompleted) {
          transactionCompleted = true;
          const error = transaction.error;
          const browserInfo = this.db.getBrowserInfo();
          reject(
            new TransactionAbortedError(
              error?.message ?? 'Transaction failed',
              {
                browserInfo,
                storeNames: [this.storeName],
              }
            )
          );
        }
      };

      transaction.onabort = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (!transactionCompleted) {
          transactionCompleted = true;
          const browserInfo = this.db.getBrowserInfo();
          reject(
            new TransactionAbortedError('Transaction was aborted', {
              browserInfo,
              storeNames: [this.storeName],
            })
          );
        }
      };
    });
  }

  /**
   * Handle IndexedDB errors and convert to NitroIDB errors
   */
  private handleError(error: DOMException | Error, operation: string, index?: number): Error {
    const browserInfo = this.db.getBrowserInfo();

    if (error.name === 'QuotaExceededError') {
      return new QuotaExceededError({
        browserInfo,
        attemptedSize: index !== undefined ? 1 : undefined,
      });
    }

    if (error.name === 'UnknownError' || error.message.includes('quota') || error.message.includes('storage')) {
      return new StorageEvictedError({
        browserInfo,
      });
    }

    return new TransactionAbortedError(
      `Bulk operation "${operation}" failed${index !== undefined ? ` at index ${index}` : ''}: ${error.message}`,
      {
        browserInfo,
        storeNames: [this.storeName],
      }
    );
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

