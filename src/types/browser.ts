/**
 * Browser type detection
 */
export type BrowserType = 'chrome' | 'firefox' | 'safari' | 'edge' | 'unknown';

/**
 * Browser information
 */
export interface BrowserInfo {
  /** Browser type */
  type: BrowserType;
  /** Browser version */
  version: string;
  /** Whether running on iOS */
  isIOS: boolean;
  /** Whether running on mobile */
  isMobile: boolean;
  /** Whether in private/incognito mode (best guess) */
  isPrivateMode: boolean;
  /** Whether WebKit engine */
  isWebKit: boolean;
  /** Full user agent string */
  userAgent: string;
}

/**
 * Compatibility mode
 */
export type CompatibilityMode = 'auto' | 'safari' | 'strict';

/**
 * Browser capabilities
 */
export interface BrowserCapabilities {
  /** Whether IndexedDB is available */
  hasIndexedDB: boolean;
  /** Whether IDBKeyRange is available */
  hasIDBKeyRange: boolean;
  /** Whether structured clone is available */
  hasStructuredClone: boolean;
  /** Estimated storage quota (bytes, if available) */
  storageQuota?: number;
  /** Whether ephemeral storage mode detected */
  isEphemeral: boolean;
}

