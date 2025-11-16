import { describe, it, expect } from 'vitest';
import { TransactionTimeoutError, TransactionAbortedError } from './transaction.js';


describe('TransactionTimeoutError', () => {
  it('should create error with timeout information', () => {
    const error = new TransactionTimeoutError(5000);
    expect(error.message).toContain('5000ms');
    expect(error.code).toBe('TRANSACTION_TIMEOUT');
    expect(error.context?.timeout).toBe(5000);
  });

  it('should include store names in context', () => {
    const error = new TransactionTimeoutError(5000, { storeNames: ['users', 'posts'] });
    expect(error.context?.storeNames).toEqual(['users', 'posts']);
  });

  it('should provide recommendation', () => {
    const error = new TransactionTimeoutError(5000);
    const recommendation = error.getRecommendation();
    expect(recommendation).toContain('timeout');
  });
});

describe('TransactionAbortedError', () => {
  it('should create error without reason', () => {
    const error = new TransactionAbortedError();
    expect(error.message).toContain('aborted');
    expect(error.code).toBe('TRANSACTION_ABORTED');
  });

  it('should create error with reason', () => {
    const error = new TransactionAbortedError('User cancelled');
    expect(error.message).toContain('User cancelled');
    expect(error.context?.reason).toBe('User cancelled');
  });

  it('should provide recommendation', () => {
    const error = new TransactionAbortedError();
    const recommendation = error.getRecommendation();
    expect(recommendation).toContain('aborted');
  });
});

