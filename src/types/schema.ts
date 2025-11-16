/**
 * Index definition for object stores
 */
export interface IndexDefinition {
  /** Name of the index */
  name: string;
  /** Key path for the index */
  keyPath: string | string[];
  /** Whether the index is unique */
  unique?: boolean;
  /** Whether the index allows multiple entries */
  multiEntry?: boolean;
}

/**
 * Object store definition
 */
export interface StoreDefinition {
  /** Primary key path (string or array for compound keys) */
  primaryKey: string | string[];
  /** Whether the primary key should auto-increment */
  autoIncrement?: boolean;
  /** Index definitions for this store */
  indexes?: IndexDefinition[];
}

/**
 * Database schema definition
 */
export interface DatabaseSchema {
  /** Name of the database */
  name: string;
  /** Version number (must increment for migrations) */
  version: number;
  /** Object store definitions */
  stores: Record<string, StoreDefinition>;
}

/**
 * Database configuration options
 */
export interface DatabaseOptions extends DatabaseSchema {
  /** Compatibility mode for browser quirks */
  compatMode?: 'auto' | 'safari' | 'strict';
  /** Enable debug logging */
  debug?: boolean;
  /** Migration functions by version */
  migrations?: Record<number, (transaction: IDBTransaction) => void | Promise<void>>;
}

