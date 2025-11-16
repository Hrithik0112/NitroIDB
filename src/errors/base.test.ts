import  { describe, it, expect } from 'vitest';
import { NitroIDBError } from './base.js';
import type { BrowserInfo } from '../types/browser.js';

describe('NitroIDBError', () => {
  it('should create error with message and code', () => {
    const error = new NitroIDBError('Test error', 'TEST_ERROR');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.name).toBe('NitroIDBError');
  });

  it('should include browser info', () => {
    const browserInfo: BrowserInfo = {
      type: 'chrome',
      version: '120',
      isIOS: false,
      isMobile: false,
      isPrivateMode: false,
      isWebKit: false,
      userAgent: 'test',
    };

    const error = new NitroIDBError('Test error', 'TEST_ERROR', { browserInfo });
    expect(error.browserInfo).toEqual(browserInfo);
  });

  it('should include context', () => {
    const context = { storeName: 'users', key: '123' };
    const error = new NitroIDBError('Test error', 'TEST_ERROR', { context });
    expect(error.context).toEqual(context);
  });

  it('should include cause', () => {
    const cause = new Error('Original error');
    const error = new NitroIDBError('Test error', 'TEST_ERROR', { cause });
    expect(error.cause).toBe(cause);
  });

  it('should provide recommendation', () => {
    const error = new NitroIDBError('Test error', 'TEST_ERROR');
    expect(typeof error.getRecommendation()).toBe('string');
  });
});

