import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectBrowser, getBrowserCapabilities, requiresSafariWorkarounds, getRecommendedBatchSize } from './browser.js';
import type { BrowserInfo } from '../types/browser.js';

describe('browser detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect Chrome browser', () => {
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      configurable: true,
    });

    const browser = detectBrowser();
    expect(browser.type).toBe('chrome');
    expect(browser.version).toBe('120');
  });

  it('should detect Safari browser', () => {
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      configurable: true,
    });

    const browser = detectBrowser();
    expect(browser.type).toBe('safari');
    expect(browser.version).toBe('17');
    expect(browser.isWebKit).toBe(true);
  });

  it('should detect Firefox browser', () => {
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      configurable: true,
    });

    const browser = detectBrowser();
    expect(browser.type).toBe('firefox');
    expect(browser.version).toBe('121');
  });

  it('should detect iOS', () => {
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });

    const browser = detectBrowser();
    expect(browser.isIOS).toBe(true);
    expect(browser.isMobile).toBe(true);
  });

  it('should return unknown for unsupported environment', () => {
    // Mock undefined navigator
    const originalNavigator = global.navigator;
    // @ts-expect-error - testing undefined navigator
    global.navigator = undefined;

    const browser = detectBrowser();
    expect(browser.type).toBe('unknown');

    global.navigator = originalNavigator;
  });
});

describe('browser capabilities', () => {
  it('should check IndexedDB availability', () => {
    const capabilities = getBrowserCapabilities();
    expect(capabilities.hasIndexedDB).toBe(typeof indexedDB !== 'undefined');
    expect(capabilities.hasIDBKeyRange).toBe(typeof IDBKeyRange !== 'undefined');
  });
});

describe('Safari workarounds', () => {
  it('should require workarounds for Safari 15-17', () => {
    const browserInfo: BrowserInfo = {
      type: 'safari',
      version: '16',
      isIOS: false,
      isMobile: false,
      isPrivateMode: false,
      isWebKit: true,
      userAgent: '',
    };

    expect(requiresSafariWorkarounds(browserInfo)).toBe(true);
  });

  it('should not require workarounds for Safari 18+', () => {
    const browserInfo: BrowserInfo = {
      type: 'safari',
      version: '18',
      isIOS: false,
      isMobile: false,
      isPrivateMode: false,
      isWebKit: true,
      userAgent: '',
    };

    expect(requiresSafariWorkarounds(browserInfo)).toBe(false);
  });
});

describe('recommended batch size', () => {
  it('should return smaller batch size for Safari', () => {
    const browserInfo: BrowserInfo = {
      type: 'safari',
      version: '16',
      isIOS: false,
      isMobile: false,
      isPrivateMode: false,
      isWebKit: true,
      userAgent: '',
    };

    const batchSize = getRecommendedBatchSize(browserInfo);
    expect(batchSize).toBe(100);
  });

  it('should return medium batch size for mobile', () => {
    const browserInfo: BrowserInfo = {
      type: 'chrome',
      version: '120',
      isIOS: false,
      isMobile: true,
      isPrivateMode: false,
      isWebKit: false,
      userAgent: '',
    };

    const batchSize = getRecommendedBatchSize(browserInfo);
    expect(batchSize).toBe(200);
  });

  it('should return larger batch size for desktop', () => {
    const browserInfo: BrowserInfo = {
      type: 'chrome',
      version: '120',
      isIOS: false,
      isMobile: false,
      isPrivateMode: false,
      isWebKit: false,
      userAgent: '',
    };

    const batchSize = getRecommendedBatchSize(browserInfo);
    expect(batchSize).toBe(500);
  });
});

