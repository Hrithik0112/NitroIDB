import type { Database } from '../database/database.js';
import type { TransactionMode, TransactionOptions, TransactionContext, TransactionCallback } from '../types/transaction.js';
import { TransactionTimeoutError, TransactionAbortedError } from '../errors/transaction.js';

/**
 * Transaction manager
 */
export class TransactionManager {
  private readonly db: Database;
  private readonly defaultTimeout: number;
  private readonly defaultRetries: number;
  private readonly defaultRetryDelay: number;

  constructor(
    db: Database,
    options: {
      defaultTimeout?: number;
      defaultRetries?: number;
      defaultRetryDelay?: number;
    } = {}
  ) {
    this.db = db;
    this.defaultTimeout = options.defaultTimeout ?? 5000; // 5 seconds
    this.defaultRetries = options.defaultRetries ?? 0;
    this.defaultRetryDelay = options.defaultRetryDelay ?? 100; // 100ms
  }

  /**
   * Execute a transaction with automatic retry and timeout handling
   */
  async execute<T>(
    stores: string | string[],
    mode: TransactionMode,
    callback: TransactionCallback<T>,
    options?: TransactionOptions
  ): Promise<T> {
    const storeNames = Array.isArray(stores) ? stores : [stores];
    const timeout = options?.timeout ?? this.defaultTimeout;
    const maxRetries = options?.retries ?? this.defaultRetries;
    const retryDelay = options?.retryDelay ?? this.defaultRetryDelay;

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        return await this.executeWithTimeout(storeNames, mode, callback, timeout);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on certain errors
        if (
          lastError instanceof TransactionTimeoutError ||
          lastError instanceof TransactionAbortedError
        ) {
          // Check if it's a retryable error
          const isRetryable = this.isRetryableError(lastError);

          if (!isRetryable || attempt >= maxRetries) {
            throw lastError;
          }
        } else if (attempt >= maxRetries) {
          throw lastError;
        }

        // Exponential backoff
        const delay = retryDelay * Math.pow(2, attempt);
        await this.sleep(delay);
        attempt++;
      }
    }

    throw lastError ?? new Error('Transaction failed after retries');
  }

  /**
   * Execute transaction with timeout
   */
  private async executeWithTimeout<T>(
    storeNames: string[],
    mode: TransactionMode,
    callback: TransactionCallback<T>,
    timeout: number
  ): Promise<T> {
    const db = await this.db.getDB();

    return new Promise((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let transactionCompleted = false;

      const transaction = db.transaction(storeNames, mode);

      // Set timeout
      timeoutId = setTimeout(() => {
        if (!transactionCompleted) {
          transactionCompleted = true;
          transaction.abort();
          const browserInfo = this.db.getBrowserInfo();
          reject(
            new TransactionTimeoutError(timeout, {
              browserInfo,
              storeNames,
            })
          );
        }
      }, timeout);

      // Set up transaction event handlers
      const handleComplete = (_ev: Event): void => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (!transactionCompleted) {
          transactionCompleted = true;
        }
      };

      const handleError = (_ev: Event): void => {
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
                storeNames,
              }
            )
          );
        }
      };

      const handleAbort = (_ev: Event): void => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (!transactionCompleted) {
          transactionCompleted = true;
          const browserInfo = this.db.getBrowserInfo();
          reject(
            new TransactionAbortedError('Transaction was aborted', {
              browserInfo,
              storeNames,
            })
          );
        }
      };

      transaction.oncomplete = handleComplete;
      transaction.onerror = handleError;
      transaction.onabort = handleAbort;

      // Execute callback
      try {
        const context: TransactionContext = {
          transaction,
          mode,
          abort: () => {
            transaction.abort();
          },
        };

        const result = callback(context);

        // Handle async callbacks
        if (result instanceof Promise) {
          // For async callbacks, we need to wait for both the promise and transaction
          let promiseResolved = false;
          let transactionResolved = false;
          let resolvedValue: T | null = null;

          const checkComplete = (): void => {
            if (promiseResolved && transactionResolved && !transactionCompleted) {
              transactionCompleted = true;
              if (timeoutId) {
                clearTimeout(timeoutId);
              }
              resolve(resolvedValue as T);
            }
          };

          result
            .then((value) => {
              if (!transactionCompleted) {
                promiseResolved = true;
                resolvedValue = value;
                checkComplete();
              }
            })
            .catch((error) => {
              if (!transactionCompleted) {
                transactionCompleted = true;
                if (timeoutId) {
                  clearTimeout(timeoutId);
                }
                transaction.abort();
                reject(error);
              }
            });

          // Override oncomplete to also check promise resolution
          const originalOnComplete = handleComplete;
          transaction.oncomplete = (ev: Event): void => {
            originalOnComplete(ev);
            if (!transactionCompleted) {
              transactionResolved = true;
              checkComplete();
            }
          };
        } else {
          // Synchronous callback - wait for transaction to complete
          transaction.oncomplete = (_ev: Event): void => {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            transactionCompleted = true;
            resolve(result);
          };
        }
      } catch (error) {
        if (!transactionCompleted) {
          transactionCompleted = true;
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          transaction.abort();
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      }
    });
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    // Retry on network-like errors or transient failures
    if (error.message.includes('network') || error.message.includes('timeout')) {
      return true;
    }

    // Don't retry on constraint violations or data errors
    if (
      error.message.includes('constraint') ||
      error.message.includes('duplicate') ||
      error.message.includes('unique')
    ) {
      return false;
    }

    // Default: retry on TransactionAbortedError (might be transient)
    return error instanceof TransactionAbortedError;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a readonly transaction
   */
  async readonly<T>(
    stores: string | string[],
    callback: TransactionCallback<T>,
    options?: TransactionOptions
  ): Promise<T> {
    return this.execute(stores, 'readonly', callback, options);
  }

  /**
   * Create a readwrite transaction
   */
  async readwrite<T>(
    stores: string | string[],
    callback: TransactionCallback<T>,
    options?: TransactionOptions
  ): Promise<T> {
    return this.execute(stores, 'readwrite', callback, options);
  }
}

