import type { DatabaseOptions, DatabaseSchema } from '../types/schema.js';
import type { BrowserInfo } from '../types/browser.js';
import { validateSchema, checkIndexedDBAvailability, createObjectStores } from '../utils/schema.js';
import { detectBrowser } from '../utils/browser.js';
import { BrowserIncompatibilityError } from '../errors/browser.js';
import { MigrationError, InvalidVersionError } from '../errors/migration.js';
import { KVStore } from '../kv/kv-store.js';

/**
 * Database instance
 */
export class Database {
  /** IDBDatabase instance */
  private _db: IDBDatabase | null = null;
  /** Schema definition */
  readonly schema: DatabaseSchema;
  /** Browser information */
  readonly browserInfo: BrowserInfo;
  /** Compatibility mode */
  readonly compatMode: 'auto' | 'safari' | 'strict';
  /** Debug mode */
  readonly debug: boolean;
  /** Migration functions */
  readonly migrations: Record<number, (transaction: IDBTransaction) => void | Promise<void>>;

  /** KV store instance */
  private _kv: KVStore | null = null;

  constructor(options: DatabaseOptions) {
    // Validate schema
    validateSchema(options);

    // Ensure KV store is included in schema
    const stores = { ...options.stores };
    if (!stores.__kv__) {
      stores.__kv__ = { primaryKey: 'key' };
    }

    this.schema = {
      name: options.name,
      version: options.version,
      stores,
    };
    this.browserInfo = detectBrowser();
    this.compatMode = options.compatMode ?? 'auto';
    this.debug = options.debug ?? false;
    this.migrations = options.migrations ?? {};

    // Check IndexedDB availability
    checkIndexedDBAvailability();
  }

  /**
   * Initialize the database
   */
  async open(): Promise<IDBDatabase> {
    if (this._db) {
      return this._db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.schema.name, this.schema.version);

      request.onerror = () => {
        const error = request.error;
        if (error) {
          // Check for version error
          if (error.name === 'VersionError') {
            reject(
              new InvalidVersionError(
                (error as unknown as { oldVersion?: number }).oldVersion ?? 0,
                this.schema.version,
                { browserInfo: this.browserInfo }
              )
            );
          } else {
            reject(
              new BrowserIncompatibilityError(
                `Failed to open database: ${error.message}`,
                {
                  browserInfo: this.browserInfo,
                }
              )
            );
          }
        } else {
          reject(
            new BrowserIncompatibilityError('Failed to open database: unknown error', {
              browserInfo: this.browserInfo,
            })
          );
        }
      };

      request.onsuccess = () => {
        this._db = request.result;
        resolve(this._db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = (event.target as IDBOpenDBRequest).transaction;
        const oldVersion = event.oldVersion;
        const newVersion = event.newVersion ?? this.schema.version;

        try {
          // Create or update object stores
          createObjectStores(db, this.schema, oldVersion, newVersion, transaction ?? undefined);

          // Run migrations (must be synchronous within onupgradeneeded)
          if (transaction) {
            this.runMigrations(transaction, oldVersion, newVersion);
          }
        } catch (error) {
          // If migration fails, abort the upgrade
          if (error instanceof Error) {
            reject(
              new MigrationError(
                oldVersion,
                newVersion,
                error.message,
                {
                  browserInfo: this.browserInfo,
                }
              )
            );
          } else {
            reject(
              new MigrationError(
                oldVersion,
                newVersion,
                'Unknown migration error',
                {
                  browserInfo: this.browserInfo,
                }
              )
            );
          }
        }
      };
    });
  }

  /**
   * Run migrations for version changes
   * Note: Migrations must be synchronous. Async migrations are not supported
   * within onupgradeneeded. For async operations, perform them after the upgrade completes.
   */
  private runMigrations(transaction: IDBTransaction, oldVersion: number, newVersion: number): void {
    if (oldVersion === 0) {
      // Initial creation, no migrations needed
      return;
    }

    // Run migrations in order
    for (let version = oldVersion + 1; version <= newVersion; version++) {
      const migration = this.migrations[version];
      if (migration) {
        if (this.debug) {
          console.log(`[NitroIDB] Running migration from ${version - 1} to ${version}`);
        }

        try {
          const result = migration(transaction);
          
          // Note: Migrations should be synchronous. If a migration returns a promise,
          // it will be ignored. For async operations, perform them after upgrade completes.
          if (result instanceof Promise) {
            console.warn(
              `[NitroIDB] Migration ${version} returned a promise, but async migrations are not supported during upgrade. ` +
              `Perform async operations after the database opens.`
            );
          }
        } catch (error) {
          throw new MigrationError(
            version - 1,
            version,
            error instanceof Error ? error.message : 'Unknown migration error',
            {
              browserInfo: this.browserInfo,
              migrationStep: `Migration ${version}`,
            }
          );
        }
      }
    }
  }

  /**
   * Get the database instance (opens if needed)
   */
  async getDB(): Promise<IDBDatabase> {
    if (!this._db) {
      return this.open();
    }
    return this._db;
  }

  /**
   * Close the database
   */
  close(): void {
    if (this._db) {
      this._db.close();
      this._db = null;
    }
  }

  /**
   * Check if database is open
   */
  isOpen(): boolean {
    return this._db !== null;
  }

  /**
   * Get database name
   */
  getName(): string {
    return this.schema.name;
  }

  /**
   * Get database version
   */
  getVersion(): number {
    return this.schema.version;
  }

  /**
   * Get browser info (for error handling)
   */
  getBrowserInfo(): BrowserInfo {
    return this.browserInfo;
  }

  /**
   * Get the KV store instance
   */
  get kv(): KVStore {
    if (!this._kv) {
      this._kv = new KVStore(this, '__kv__');
    }
    return this._kv;
  }
}

