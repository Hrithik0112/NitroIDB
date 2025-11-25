import { describe, it, expect, vi } from 'vitest';
import { detectQuirks, generateWarnings, applyWorkarounds, validateBrowserCompatibility } from './quirks.js';
import type { BrowserInfo } from '../types/browser.js';
import { BrowserIncompatibilityError } from '../errors/browser.js';

describe('detectQuirks', () => {
  it('should detect Safari quirks', () => {
    const browserInfo: BrowserInfo = {
      type: 'safari',
      version: '16',
      isIOS: false,
      isMobile: false,
      isPrivateMode: false,
      isWebKit: true,
      userAgent: 'Safari/16',
    };

    const quirks = detectQuirks(browserInfo);
    expect(quirks.safariQuirks).toBe(true);
    expect(quirks.largeTransactionIssues).toBe(true);
    expect(quirks.recommendedBatchSize).toBe(100);
  });

  it('should detect iOS Safari quirks', () => {
    const browserInfo: BrowserInfo = {
      type: 'safari',
      version: '16',
      isIOS: true,
      isMobile: true,
      isPrivateMode: false,
      isWebKit: true,
      userAgent: 'iOS Safari',
    };

    const quirks = detectQuirks(browserInfo);
    expect(quirks.iosQuirks).toBe(true);
    expect(quirks.recommendedBatchSize).toBe(50);
  });

  it('should detect private mode', () => {
    const browserInfo: BrowserInfo = {
      type: 'chrome',
      version: '120',
      isIOS: false,
      isMobile: false,
      isPrivateMode: true,
      isWebKit: false,
      userAgent: 'Chrome',
    };

    const quirks = detectQuirks(browserInfo);
    expect(quirks.privateMode).toBe(true);
  });

  it('should apply safari compatibility mode', () => {
    const browserInfo: BrowserInfo = {
      type: 'chrome',
      version: '120',
      isIOS: false,
      isMobile: false,
      isPrivateMode: false,
      isWebKit: false,
      userAgent: 'Chrome',
    };

    const quirks = detectQuirks(browserInfo, 'safari');
    expect(quirks.safariQuirks).toBe(true);
    expect(quirks.recommendedBatchSize).toBe(100);
  });

  it('should apply strict compatibility mode', () => {
    const browserInfo: BrowserInfo = {
      type: 'chrome',
      version: '120',
      isIOS: false,
      isMobile: false,
      isPrivateMode: false,
      isWebKit: false,
      userAgent: 'Chrome',
    };

    const quirks = detectQuirks(browserInfo, 'strict');
    expect(quirks.recommendedBatchSize).toBe(50);
    expect(quirks.recommendedTimeout).toBe(2000);
  });
});

describe('generateWarnings', () => {
  it('should generate warnings in debug mode', () => {
    const browserInfo: BrowserInfo = {
      type: 'safari',
      version: '16',
      isIOS: false,
      isMobile: false,
      isPrivateMode: false,
      isWebKit: true,
      userAgent: 'Safari',
    };

    const quirks = detectQuirks(browserInfo);
    const warnings = generateWarnings(quirks, browserInfo, true);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.includes('Safari'))).toBe(true);
  });

  it('should not generate warnings when debug is false', () => {
    const browserInfo: BrowserInfo = {
      type: 'safari',
      version: '16',
      isIOS: false,
      isMobile: false,
      isPrivateMode: false,
      isWebKit: true,
      userAgent: 'Safari',
    };

    const quirks = detectQuirks(browserInfo);
    const warnings = generateWarnings(quirks, browserInfo, false);

    expect(warnings).toHaveLength(0);
  });
});

describe('applyWorkarounds', () => {
  it('should return recommended settings', () => {
    const browserInfo: BrowserInfo = {
      type: 'safari',
      version: '16',
      isIOS: false,
      isMobile: false,
      isPrivateMode: false,
      isWebKit: true,
      userAgent: 'Safari',
    };

    const quirks = detectQuirks(browserInfo);
    const workarounds = applyWorkarounds(quirks);

    expect(workarounds.batchSize).toBe(quirks.recommendedBatchSize);
    expect(workarounds.timeout).toBe(quirks.recommendedTimeout);
    expect(workarounds.retryDelay).toBe(200); // Safari has longer delay
  });
});

describe('validateBrowserCompatibility', () => {
  it('should throw error if IndexedDB is not available', () => {
    // Mock missing IndexedDB
    const originalIndexedDB = global.indexedDB;
    // @ts-expect-error - testing missing IndexedDB
    global.indexedDB = undefined;

    const browserInfo: BrowserInfo = {
      type: 'chrome',
      version: '120',
      isIOS: false,
      isMobile: false,
      isPrivateMode: false,
      isWebKit: false,
      userAgent: 'Chrome',
    };

    expect(() => {
      validateBrowserCompatibility(browserInfo, 'auto');
    }).toThrow(BrowserIncompatibilityError);

    global.indexedDB = originalIndexedDB;
  });

  it('should warn about old Safari versions', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Mock IndexedDB to be available for this test
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const originalIndexedDB = (globalThis as any).indexedDB;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    (globalThis as any).indexedDB = {
      open: (): void => {},
    };

    const browserInfo: BrowserInfo = {
      type: 'safari',
      version: '14',
      isIOS: false,
      isMobile: false,
      isPrivateMode: false,
      isWebKit: true,
      userAgent: 'Safari',
    };

    try {
      validateBrowserCompatibility(browserInfo, 'auto');
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      // Restore original
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      if (originalIndexedDB !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        (globalThis as any).indexedDB = originalIndexedDB;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        delete (globalThis as any).indexedDB;
      }
    }

    consoleSpy.mockRestore();
  });
});

