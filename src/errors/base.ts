import type { BrowserInfo } from '../types/browser.js';

/**
 * Base error class for all NitroIDB errors
 */
export class NitroIDBError extends Error {
  /** Error code for programmatic handling */
  readonly code: string;
  /** Browser information at time of error */
  readonly browserInfo?: BrowserInfo;
  /** Additional context about the error */
  readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    options?: {
      browserInfo?: BrowserInfo;
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.browserInfo = options?.browserInfo;
    this.context = options?.context;
    
    if (options?.cause) {
      this.cause = options.cause;
    }

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get a human-readable error message with recommendations
   */
  getRecommendation(): string {
    return 'No specific recommendation available.';
  }
}

