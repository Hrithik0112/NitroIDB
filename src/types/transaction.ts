/**
 * Transaction mode
 */
export type TransactionMode = 'readonly' | 'readwrite';

/**
 * Transaction options
 */
export interface TransactionOptions {
  /** Transaction mode */
  mode?: TransactionMode;
  /** Durability hint (if supported) */
  durability?: 'default' | 'strict' | 'relaxed';
  /** Timeout in milliseconds */
  timeout?: number;
  /** Number of retries on failure */
  retries?: number;
  /** Delay between retries in milliseconds */
  retryDelay?: number;
}

/**
 * Transaction context
 */
export interface TransactionContext {
  /** IDBTransaction instance */
  transaction: IDBTransaction;
  /** Transaction mode */
  mode: TransactionMode;
  /** Abort handler */
  abort: () => void;
  /** Commit handler (for explicit commits if needed) */
  commit?: () => void;
}

/**
 * Transaction callback function
 */
export type TransactionCallback<T = unknown> = (
  context: TransactionContext
) => T | Promise<T>;

