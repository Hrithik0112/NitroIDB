import type { Database } from '../database/database.js';
import type { ErrorRecoveryOptions, ErrorRecoveryResult, ErrorRecoveryStrategy } from '../types/diagnostics.js';
import { NitroIDBError } from '../errors/base.js';

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Attempt to recover from an error by retrying the operation
 */
async function recoverWithRetry<T>(
  operation: () => Promise<T>,
  options: ErrorRecoveryOptions
): Promise<ErrorRecoveryResult> {
  const maxRetries = options.maxRetries ?? 3;
  const retryDelay = options.retryDelay ?? 100;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await operation();
      return {
        success: true,
        strategy: 'retry',
        attempts: attempt,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (options.logRecovery) {
        console.warn(`[NitroIDB] Recovery attempt ${attempt}/${maxRetries} failed:`, lastError.message);
      }

      if (attempt < maxRetries) {
        await sleep(retryDelay * attempt); // Exponential backoff
      }
    }
  }

  return {
    success: false,
    strategy: 'retry',
    attempts: maxRetries,
    error: lastError,
  };
}

/**
 * Attempt to recover by reopening the database
 */
async function recoverWithReopen(
  db: Database,
  options: ErrorRecoveryOptions
): Promise<ErrorRecoveryResult> {
  try {
    if (db.isOpen()) {
      db.close();
    }
    
    await sleep(options.retryDelay ?? 100);
    await db.open();

    return {
      success: true,
      strategy: 'reopen',
      attempts: 1,
    };
  } catch (error) {
    return {
      success: false,
      strategy: 'reopen',
      attempts: 1,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Attempt to recover from a storage error by clearing old data
 */
async function recoverWithClear(
  db: Database,
  storeName: string,
  _options: ErrorRecoveryOptions
): Promise<ErrorRecoveryResult> {
  try {
    if (!db.isOpen()) {
      await db.open();
    }

    const table = db.table(storeName);
    await table.clear();

    return {
      success: true,
      strategy: 'clear',
      attempts: 1,
    };
  } catch (error) {
    return {
      success: false,
      strategy: 'clear',
      attempts: 1,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Determine the best recovery strategy for an error
 */
export function determineRecoveryStrategy(error: Error): ErrorRecoveryStrategy {
  if (error instanceof NitroIDBError) {
    const code = error.code;

    // Transaction errors - retry
    if (code === 'TRANSACTION_TIMEOUT' || code === 'TRANSACTION_ABORTED') {
      return 'retry';
    }

    // Storage errors - try reopen first, then clear
    if (code === 'STORAGE_EVICTED' || code === 'QUOTA_EXCEEDED') {
      return 'reopen';
    }

    // Browser errors - no recovery
    if (code === 'BROWSER_INCOMPATIBLE') {
      return 'none';
    }

    // Migration errors - no automatic recovery
    if (code === 'MIGRATION_ERROR' || code === 'INVALID_VERSION') {
      return 'none';
    }
  }

  // Default: retry
  return 'retry';
}

/**
 * Attempt to recover from an error
 */
export async function recoverFromError<T>(
  db: Database,
  error: Error,
  operation: () => Promise<T>,
  options: ErrorRecoveryOptions = {}
): Promise<ErrorRecoveryResult> {
  const strategy = options.strategy ?? determineRecoveryStrategy(error);

  if (strategy === 'none') {
    return {
      success: false,
      strategy: 'none',
      attempts: 0,
      error,
    };
  }

  if (strategy === 'retry') {
    return recoverWithRetry(operation, options);
  }

  if (strategy === 'reopen') {
    const result = await recoverWithReopen(db, options);
    if (result.success) {
      // Try the operation again after reopening
      try {
        await operation();
        return result;
      } catch (retryError) {
        return {
          success: false,
          strategy: 'reopen',
          attempts: result.attempts + 1,
          error: retryError instanceof Error ? retryError : new Error(String(retryError)),
        };
      }
    }
    return result;
  }

  if (strategy === 'clear') {
    // For clear strategy, we need to know which store to clear
    // This is a simplified version - in practice, you'd pass the store name
    return {
      success: false,
      strategy: 'clear',
      attempts: 0,
      error: new Error('Clear strategy requires store name'),
    };
  }

  return {
    success: false,
    strategy: 'fallback',
    attempts: 0,
    error: new Error('Unknown recovery strategy'),
  };
}

/**
 * Recover from error with store-specific clear
 */
export async function recoverWithStoreClear(
  db: Database,
  storeName: string,
  _options: ErrorRecoveryOptions = {}
): Promise<ErrorRecoveryResult> {
  return recoverWithClear(db, storeName, _options);
}

