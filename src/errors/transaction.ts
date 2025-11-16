import { NitroIDBError } from './base.js';
import type { BrowserInfo } from '../types/browser.js';

/**
 * Error thrown when a transaction times out
 */
export class TransactionTimeoutError extends NitroIDBError {
  constructor(
    timeout: number,
    options?: {
      browserInfo?: BrowserInfo;
      storeNames?: string[];
    }
  ) {
    const message = `Transaction timed out after ${timeout}ms`;
    super(message, 'TRANSACTION_TIMEOUT', {
      browserInfo: options?.browserInfo,
      context: {
        timeout,
        storeNames: options?.storeNames,
      },
    });
  }

  override getRecommendation(): string {
    return `Transaction exceeded timeout. Try:
- Reducing batch size for bulk operations
- Using smaller transactions
- Enabling Safari compatibility mode if on Safari/WebKit
- Checking browser console for additional errors`;
  }
}

/**
 * Error thrown when a transaction is aborted
 */
export class TransactionAbortedError extends NitroIDBError {
  constructor(
    reason?: string,
    options?: {
      browserInfo?: BrowserInfo;
      storeNames?: string[];
    }
  ) {
    const message = reason 
      ? `Transaction was aborted: ${reason}`
      : 'Transaction was aborted';
    super(message, 'TRANSACTION_ABORTED', {
      browserInfo: options?.browserInfo,
      context: {
        reason,
        storeNames: options?.storeNames,
      },
    });
  }

  override getRecommendation(): string {
    return `Transaction was aborted. This usually happens when:
- An error occurred during the transaction
- The transaction was explicitly aborted
- The database connection was closed
Check the error cause for more details.`;
  }
}

