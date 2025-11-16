import { NitroIDBError } from './base.js';
import type { BrowserInfo } from '../types/browser.js';

/**
 * Error thrown when storage is evicted or quota is exceeded
 */
export class StorageEvictedError extends NitroIDBError {
  constructor(
    options?: {
      browserInfo?: BrowserInfo;
      estimatedQuota?: number;
      usedQuota?: number;
    }
  ) {
    const message = 'Storage quota exceeded or data was evicted';
    super(message, 'STORAGE_EVICTED', {
      browserInfo: options?.browserInfo,
      context: {
        estimatedQuota: options?.estimatedQuota,
        usedQuota: options?.usedQuota,
      },
    });
  }

  override getRecommendation(): string {
    const isPrivate = this.browserInfo?.isPrivateMode;
    const isIOS = this.browserInfo?.isIOS;
    
    if (isPrivate) {
      return `Storage was evicted because you're in private/incognito mode.
Private mode has very limited storage that gets cleared frequently.
Recommendation: Use regular browsing mode for persistent storage.`;
    }
    
    if (isIOS) {
      return `Storage quota exceeded on iOS Safari.
iOS Safari has strict storage limits and may evict data.
Recommendation: 
- Reduce stored data size
- Implement data cleanup strategies
- Use compression for large data
- Consider cloud sync for important data`;
    }
    
    return `Storage quota exceeded.
Recommendation:
- Clear old/unused data
- Implement data cleanup strategies
- Request persistent storage permission
- Monitor storage usage with db.health()`;
  }
}

/**
 * Error thrown when storage quota is exceeded
 */
export class QuotaExceededError extends NitroIDBError {
  constructor(
    options?: {
      browserInfo?: BrowserInfo;
      estimatedQuota?: number;
      attemptedSize?: number;
    }
  ) {
    const message = 'Storage quota exceeded';
    super(message, 'QUOTA_EXCEEDED', {
      browserInfo: options?.browserInfo,
      context: {
        estimatedQuota: options?.estimatedQuota,
        attemptedSize: options?.attemptedSize,
      },
    });
  }

  override getRecommendation(): string {
    return `Cannot write data: storage quota exceeded.
Recommendation:
- Delete old or unused data
- Request persistent storage: navigator.storage.persist()
- Implement data cleanup strategies
- Consider compressing data before storage`;
  }
}

