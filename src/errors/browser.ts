import { NitroIDBError } from './base.js';
import type { BrowserInfo } from '../types/browser.js';

/**
 * Error thrown when browser is incompatible
 */
export class BrowserIncompatibilityError extends NitroIDBError {
  constructor(
    reason: string,
    options?: {
      browserInfo?: BrowserInfo;
      missingFeature?: string;
    }
  ) {
    const message = `Browser incompatibility: ${reason}`;
    super(message, 'BROWSER_INCOMPATIBLE', {
      browserInfo: options?.browserInfo,
      context: {
        reason,
        missingFeature: options?.missingFeature,
      },
    });
  }

  override getRecommendation(): string {
    const missing = this.context?.missingFeature as string | undefined;
    
    if (missing === 'indexedDB') {
      return `IndexedDB is not available in this browser.
Recommendation:
- Use a modern browser (Chrome, Firefox, Safari, Edge)
- Check if you're in private/incognito mode (some browsers disable IndexedDB)
- For React Native WebView, ensure IndexedDB is enabled`;
    }
    
    return `Browser is not compatible with NitroIDB.
Recommendation:
- Update to a modern browser version
- Check browser compatibility requirements
- Use a polyfill if necessary (though not recommended)`;
  }
}

