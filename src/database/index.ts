import type { DatabaseOptions } from '../types/schema.js';
import { Database } from './database.js';

/**
 * Create a new NitroIDB database instance
 * 
 * @example
 * ```ts
 * const db = createDB({
 *   name: 'myapp',
 *   version: 1,
 *   stores: {
 *     users: { primaryKey: 'id', indexes: ['email'] },
 *   },
 * });
 * 
 * await db.open();
 * ```
 */
export function createDB(options: DatabaseOptions): Database {
  return new Database(options);
}

export { Database } from './database.js';

