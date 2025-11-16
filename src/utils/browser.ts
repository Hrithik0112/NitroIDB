import type { BrowserInfo, BrowserType, BrowserCapabilities } from '../types/browser.js';

/**
 * Parse browser version from user agent
 */
function parseVersion(userAgent: string, pattern: RegExp): string {
  const match = userAgent.match(pattern);
  return match?.[1] ?? 'unknown';
}

/**
 * Detect browser type and version from user agent
 */
export function detectBrowser(): BrowserInfo {
  if (typeof navigator === 'undefined') {
    return {
      type: 'unknown',
      version: 'unknown',
      isIOS: false,
      isMobile: false,
      isPrivateMode: false,
      isWebKit: false,
      userAgent: '',
    };
  }

  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
  const isMobile = /Mobile|Android|iPhone|iPad/.test(ua);
  const isWebKit = /WebKit/.test(ua) && !/Chrome/.test(ua);

  let type: BrowserType = 'unknown';
  let version = 'unknown';

  // Chrome (including Edge Chromium)
  if (/Chrome/.test(ua) && !/Edg/.test(ua) && !/OPR/.test(ua)) {
    type = 'chrome';
    version = parseVersion(ua, /Chrome\/(\d+)/);
  }
  // Edge Chromium
  else if (/Edg/.test(ua)) {
    type = 'edge';
    version = parseVersion(ua, /Edg\/(\d+)/);
  }
  // Firefox
  else if (/Firefox/.test(ua)) {
    type = 'firefox';
    version = parseVersion(ua, /Firefox\/(\d+)/);
  }
  // Safari
  else if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
    type = 'safari';
    version = parseVersion(ua, /Version\/(\d+)/);
  }

  // Detect private mode (best effort - not 100% reliable)
  // Note: This is a synchronous best-guess. Full detection requires async operations
  // which we'll handle in the database initialization
  let isPrivateMode = false;
  try {
    // Safari private mode: localStorage throws in private mode
    if (type === 'safari' || isWebKit) {
      const testKey = '__nitroidb_private_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
    }
    // For other browsers, we'll detect during actual DB operations
  } catch {
    isPrivateMode = true;
  }

  return {
    type,
    version,
    isIOS,
    isMobile,
    isPrivateMode,
    isWebKit,
    userAgent: ua,
  };
}

/**
 * Get browser capabilities
 */
export function getBrowserCapabilities(): BrowserCapabilities {
  const hasIndexedDB = typeof indexedDB !== 'undefined';
  const hasIDBKeyRange = typeof IDBKeyRange !== 'undefined';
  const hasStructuredClone = typeof structuredClone !== 'undefined';

  // Check for ephemeral storage (iOS Safari private mode, etc.)
  // Note: This is a synchronous check. Full detection requires async operations
  // which will be done during database initialization
  let isEphemeral = false;
  if (hasIndexedDB) {
    // We'll detect ephemeral mode during actual operations
    // For now, we can't reliably detect it synchronously
    isEphemeral = false;
  }

  return {
    hasIndexedDB,
    hasIDBKeyRange,
    hasStructuredClone,
    isEphemeral,
  };
}

/**
 * Check if browser requires Safari-specific workarounds
 */
export function requiresSafariWorkarounds(browserInfo: BrowserInfo): boolean {
  if (browserInfo.type === 'safari' || browserInfo.isWebKit) {
    const version = parseInt(browserInfo.version, 10);
    // Safari 15-17 have known issues with large transactions
    return version >= 15 && version <= 17;
  }
  return false;
}

/**
 * Get recommended batch size based on browser
 */
export function getRecommendedBatchSize(browserInfo: BrowserInfo): number {
  if (requiresSafariWorkarounds(browserInfo)) {
    return 100; // Conservative for Safari
  }
  if (browserInfo.isMobile) {
    return 200; // Smaller for mobile
  }
  return 500; // Default for desktop Chrome/Firefox
}

