import { describe, it, expect } from 'vitest';
import {
  determineRecoveryStrategy,
  recoverFromError,
} from './recovery.js';
import { createDB } from '../database/index.js';
import {
  TransactionTimeoutError,
  StorageEvictedError,
  BrowserIncompatibilityError,
  MigrationError,
} from '../errors/index.js';

describe('Error Recovery Utilities', () => {
  describe('determineRecoveryStrategy', () => {
    it('should return retry for transaction errors', () => {
      const error = new TransactionTimeoutError(10000, {
        browserInfo: undefined,
        storeNames: ['users'],
      });

      const strategy = determineRecoveryStrategy(error);
      expect(strategy).toBe('retry');
    });

    it('should return reopen for storage errors', () => {
      const error = new StorageEvictedError({
        browserInfo: undefined,
      });

      const strategy = determineRecoveryStrategy(error);
      expect(strategy).toBe('reopen');
    });

    it('should return none for browser errors', () => {
      const error = new BrowserIncompatibilityError('Browser incompatible', {
        browserInfo: undefined,
      });

      const strategy = determineRecoveryStrategy(error);
      expect(strategy).toBe('none');
    });

    it('should return none for migration errors', () => {
      const error = new MigrationError(1, 2, 'Migration failed', {
        browserInfo: undefined,
      });

      const strategy = determineRecoveryStrategy(error);
      expect(strategy).toBe('none');
    });

    it('should return retry for unknown errors', () => {
      const error = new Error('Unknown error');
      const strategy = determineRecoveryStrategy(error);
      expect(strategy).toBe('retry');
    });
  });

  describe('recoverFromError', () => {
    it('should retry operation on retry strategy', async () => {
      if (typeof indexedDB === 'undefined') {
        return;
      }

      const db = createDB({
        name: 'test-recovery-' + Date.now(),
        version: 1,
        stores: {
          users: { primaryKey: 'id' },
        },
      });

      await db.open();

      let attempts = 0;
      const operation = (): Promise<string> => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Temporary error'));
        }
        return Promise.resolve('success');
      };

      const error = new Error('Temporary error');
      const result = await recoverFromError(db, error, operation, {
        strategy: 'retry',
        maxRetries: 5,
        retryDelay: 10,
      });

      expect(result.success).toBe(true);
      expect(result.strategy).toBe('retry');
      expect(attempts).toBe(3);

      db.close();
    });

    it('should return failure after max retries', async () => {
      if (typeof indexedDB === 'undefined') {
        return;
      }

      const db = createDB({
        name: 'test-recovery-' + Date.now(),
        version: 1,
        stores: {
          users: { primaryKey: 'id' },
        },
      });

      await db.open();

      const operation = (): Promise<never> => {
        return Promise.reject(new Error('Persistent error'));
      };

      const error = new Error('Persistent error');
      const result = await recoverFromError(db, error, operation, {
        strategy: 'retry',
        maxRetries: 2,
        retryDelay: 10,
      });

      expect(result.success).toBe(false);
      expect(result.strategy).toBe('retry');
      expect(result.attempts).toBe(2);

      db.close();
    });

    it('should return none for none strategy', async () => {
      if (typeof indexedDB === 'undefined') {
        return;
      }

      const db = createDB({
        name: 'test-recovery-' + Date.now(),
        version: 1,
        stores: {
          users: { primaryKey: 'id' },
        },
      });

      await db.open();

      const operation = (): Promise<string> => Promise.resolve('success');
      const error = new BrowserIncompatibilityError('Incompatible', {
        browserInfo: undefined,
      });

      const result = await recoverFromError(db, error, operation, {
        strategy: 'none',
      });

      expect(result.success).toBe(false);
      expect(result.strategy).toBe('none');
      expect(result.attempts).toBe(0);

      db.close();
    });
  });
});

