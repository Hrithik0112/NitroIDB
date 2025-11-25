import type { BrowserInfo } from './browser.js';

/**
 * Health status levels
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/**
 * Storage quota information
 */
export interface StorageQuota {
  /** Total quota in bytes (if available) */
  quota?: number;
  /** Used storage in bytes (if available) */
  usage?: number;
  /** Available storage in bytes (if available) */
  available?: number;
  /** Percentage of quota used (0-100) */
  usagePercent?: number;
  /** Whether storage is in ephemeral mode */
  isEphemeral: boolean;
  /** Whether persistent storage is granted */
  isPersistent?: boolean;
}

/**
 * Eviction risk level
 */
export type EvictionRisk = 'low' | 'medium' | 'high' | 'critical';

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Overall health status */
  status: HealthStatus;
  /** Timestamp of the health check */
  timestamp: number;
  /** Database connection status */
  connected: boolean;
  /** Storage quota information */
  storage: StorageQuota;
  /** Eviction risk assessment */
  evictionRisk: EvictionRisk;
  /** List of detected issues */
  issues: string[];
  /** Actionable recommendations */
  recommendations: string[];
  /** Browser information */
  browserInfo: BrowserInfo;
  /** Test results */
  tests: {
    /** Can open database */
    canOpen: boolean;
    /** Can read from database */
    canRead: boolean;
    /** Can write to database */
    canWrite: boolean;
    /** Can close database */
    canClose: boolean;
  };
}

/**
 * Health check options
 */
export interface HealthCheckOptions {
  /** Whether to run full connectivity tests (default: true) */
  runTests?: boolean;
  /** Whether to check storage quota (default: true) */
  checkQuota?: boolean;
  /** Custom test data size for write test (default: 1024 bytes) */
  testDataSize?: number;
}

