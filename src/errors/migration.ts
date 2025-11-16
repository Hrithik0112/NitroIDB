import { NitroIDBError } from './base.js';
import type { BrowserInfo } from '../types/browser.js';

/**
 * Error thrown when a migration fails
 */
export class MigrationError extends NitroIDBError {
  constructor(
    fromVersion: number,
    toVersion: number,
    reason: string,
    options?: {
      browserInfo?: BrowserInfo;
      migrationStep?: string;
    }
  ) {
    const message = `Migration from version ${fromVersion} to ${toVersion} failed: ${reason}`;
    super(message, 'MIGRATION_ERROR', {
      browserInfo: options?.browserInfo,
      context: {
        fromVersion,
        toVersion,
        reason,
        migrationStep: options?.migrationStep,
      },
    });
  }

  override getRecommendation(): string {
    return `Migration failed. This is a critical error.
Recommendation:
- Check migration function for errors
- Ensure migration is idempotent
- Test migrations in development with dry-run mode
- Backup data before running migrations
- Check browser console for detailed error messages`;
  }
}

/**
 * Error thrown when database version is invalid
 */
export class InvalidVersionError extends NitroIDBError {
  constructor(
    currentVersion: number,
    requestedVersion: number,
    options?: {
      browserInfo?: BrowserInfo;
    }
  ) {
    const message = `Invalid version: cannot downgrade from ${currentVersion} to ${requestedVersion}`;
    super(message, 'INVALID_VERSION', {
      browserInfo: options?.browserInfo,
      context: {
        currentVersion,
        requestedVersion,
      },
    });
  }

  override getRecommendation(): string {
    return `Cannot downgrade database version.
Recommendation:
- Version numbers must always increase
- If you need to reset, delete the database and recreate
- Use migrations to transform data instead of downgrading`;
  }
}

