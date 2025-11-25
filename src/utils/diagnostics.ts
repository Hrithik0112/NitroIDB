import type { Database } from '../database/database.js';
import type { DatabaseDiagnostics, StoreInspection } from '../types/diagnostics.js';
import { getMigrationHistory } from './migration.js';

/**
 * Inspect a single store
 */
export async function inspectStore(
  db: Database,
  storeName: string
): Promise<StoreInspection> {
  if (!db.isOpen()) {
    await db.open();
  }

  const table = db.table(storeName);
  const count = await table.count();
  
  // Get sample records (first 10)
  const sample = await table.query().limit(10).toArray();

  // Get store definition from schema
  const storeDef = db.schema.stores[storeName];
  const primaryKey = storeDef?.primaryKey ?? 'id';
  const indexes = storeDef?.indexes?.map(idx => idx.name) ?? [];

  return {
    name: storeName,
    count,
    sample,
    primaryKey,
    indexes,
  };
}

/**
 * Get comprehensive database diagnostics
 */
export async function getDatabaseDiagnostics(
  db: Database,
  includeHealth: boolean = false
): Promise<DatabaseDiagnostics> {
  if (!db.isOpen()) {
    await db.open();
  }

  const storeNames = Object.keys(db.schema.stores).filter(
    name => name !== '__kv__' && name !== '__migration_history__'
  );

  const stores: StoreInspection[] = [];
  for (const storeName of storeNames) {
    try {
      const inspection = await inspectStore(db, storeName);
      stores.push(inspection);
    } catch (error) {
      // If inspection fails, still include the store with error info
      stores.push({
        name: storeName,
        count: -1,
        sample: [],
        primaryKey: db.schema.stores[storeName]?.primaryKey ?? 'id',
        indexes: db.schema.stores[storeName]?.indexes?.map(idx => idx.name) ?? [],
      });
    }
  }

  // Get migration history
  const migrationHistory = await getMigrationHistory(db);

  // Get health check if requested
  let health;
  if (includeHealth) {
    try {
      health = await db.health();
    } catch (error) {
      // Health check failed, continue without it
      console.warn('[NitroIDB] Health check failed during diagnostics:', error);
    }
  }

  return {
    name: db.schema.name,
    version: db.schema.version,
    isOpen: db.isOpen(),
    storeNames,
    stores,
    health,
    migrationHistory,
    browserInfo: {
      type: db.browserInfo.type,
      version: db.browserInfo.version,
      isIOS: db.browserInfo.isIOS,
      isPrivateMode: db.browserInfo.isPrivateMode,
    },
  };
}

/**
 * Format diagnostics for console output
 */
export function formatDiagnostics(diagnostics: DatabaseDiagnostics): string {
  const lines: string[] = [];

  lines.push('=== NitroIDB Diagnostics ===');
  lines.push(`Database: ${diagnostics.name}`);
  lines.push(`Version: ${diagnostics.version}`);
  lines.push(`Status: ${diagnostics.isOpen ? 'Open' : 'Closed'}`);
  lines.push('');

  lines.push('--- Stores ---');
  for (const store of diagnostics.stores) {
    lines.push(`  ${store.name}:`);
    lines.push(`    Records: ${store.count >= 0 ? store.count : 'Error reading count'}`);
    lines.push(`    Primary Key: ${Array.isArray(store.primaryKey) ? store.primaryKey.join(', ') : store.primaryKey}`);
    if (store.indexes.length > 0) {
      lines.push(`    Indexes: ${store.indexes.join(', ')}`);
    }
    if (store.sample.length > 0) {
      lines.push(`    Sample (first ${store.sample.length}):`);
      store.sample.forEach((record, i) => {
        lines.push(`      [${i}]: ${JSON.stringify(record).substring(0, 100)}${JSON.stringify(record).length > 100 ? '...' : ''}`);
      });
    }
  }
  lines.push('');

  if (diagnostics.migrationHistory.length > 0) {
    lines.push('--- Migration History ---');
    diagnostics.migrationHistory.slice(-10).forEach((entry) => {
      lines.push(`  v${entry.fromVersion} → v${entry.toVersion}: ${entry.success ? '✓' : '✗'} (${new Date(entry.timestamp).toLocaleString()})`);
    });
    lines.push('');
  }

  if (diagnostics.health) {
    lines.push('--- Health Status ---');
    lines.push(`  Status: ${diagnostics.health.status}`);
    lines.push(`  Eviction Risk: ${diagnostics.health.evictionRisk}`);
    if (diagnostics.health.issues.length > 0) {
      lines.push(`  Issues: ${diagnostics.health.issues.length}`);
      diagnostics.health.issues.forEach(issue => {
        lines.push(`    - ${issue}`);
      });
    }
    lines.push('');
  }

  lines.push('--- Browser Info ---');
  lines.push(`  Type: ${diagnostics.browserInfo.type} ${diagnostics.browserInfo.version}`);
  lines.push(`  iOS: ${diagnostics.browserInfo.isIOS ? 'Yes' : 'No'}`);
  lines.push(`  Private Mode: ${diagnostics.browserInfo.isPrivateMode ? 'Yes' : 'No'}`);
  lines.push('');

  lines.push('===================');

  return lines.join('\n');
}

/**
 * Log diagnostics to console
 */
export function logDiagnostics(diagnostics: DatabaseDiagnostics): void {
  // eslint-disable-next-line no-console
  console.log(formatDiagnostics(diagnostics));
}

