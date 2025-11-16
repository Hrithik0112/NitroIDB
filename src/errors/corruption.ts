import { NitroIDBError } from './base.js';
import type { BrowserInfo } from '../types/browser.js';

/**
 * Error thrown when store corruption is detected
 */
export class StoreCorruptionError extends NitroIDBError {
  constructor(
    storeName: string,
    reason: string,
    options?: {
      browserInfo?: BrowserInfo;
      affectedKeys?: string[];
    }
  ) {
    const message = `Store "${storeName}" appears corrupted: ${reason}`;
    super(message, 'STORE_CORRUPTION', {
      browserInfo: options?.browserInfo,
      context: {
        storeName,
        reason,
        affectedKeys: options?.affectedKeys,
      },
    });
  }

  override getRecommendation(): string {
    return `Store corruption detected. This is a serious issue.
Recommendation:
- Use db.repair() to attempt automatic repair (if available)
- Export data from other stores before repair
- Delete and recreate the corrupted store
- Restore from backup if available
- Report this issue if it persists`;
  }
}

