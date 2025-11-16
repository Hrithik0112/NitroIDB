import type { StoreDefinition } from './schema.js';

/**
 * Record type for a store (generic)
 */
export type StoreRecord<T = unknown> = T;

/**
 * Store metadata
 */
export interface StoreMetadata {
  /** Store name */
  name: string;
  /** Store definition */
  definition: StoreDefinition;
  /** Object store instance */
  objectStore: IDBObjectStore;
}

/**
 * Query operators for where clauses
 */
export type QueryOperator = 
  | 'equals'
  | 'above'
  | 'below'
  | 'aboveOrEqual'
  | 'belowOrEqual';

/**
 * Query direction for sorting
 */
export type QueryDirection = 'next' | 'prev' | 'nextunique' | 'prevunique';

/**
 * Range definition for queries
 */
export interface QueryRange {
  /** Lower bound (inclusive) */
  lower?: IDBValidKey;
  /** Upper bound (inclusive) */
  upper?: IDBValidKey;
  /** Whether lower bound is exclusive */
  lowerOpen?: boolean;
  /** Whether upper bound is exclusive */
  upperOpen?: boolean;
}

