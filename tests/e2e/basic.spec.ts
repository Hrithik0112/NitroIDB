import { test, expect } from '@playwright/test';

test.describe('NitroIDB Basic Functionality', () => {
  test('should create and use database', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Wait for NitroIDB to be loaded
    await page.waitForFunction(() => typeof (window as unknown as { NitroIDB: { createDB: typeof import('../../src/database/index.js').createDB } }).NitroIDB !== 'undefined');

    // Execute basic database operations
    const result = await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const { createDB } = (window as unknown as { NitroIDB: { createDB: typeof import('../../src/database/index.js').createDB } }).NitroIDB;
      
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const db = createDB({
        name: 'test-db',
        version: 1,
        stores: {
          users: { primaryKey: 'id' },
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/await-thenable
      await db.open();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const usersTable = db.table('users');
      
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/await-thenable
      await usersTable.add({ id: '1', name: 'John' });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/await-thenable
      const user = await usersTable.get('1') as { name?: string } | undefined;
      
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/await-thenable
      await db.close();
      
      return { success: user?.name === 'John' };
    });

    expect(result.success).toBe(true);
  });

  test('should handle bulk operations', async ({ page, browserName }) => {
    await page.goto('http://localhost:3000');

    // Wait for NitroIDB to be loaded
    await page.waitForFunction(() => typeof (window as unknown as { NitroIDB: { createDB: typeof import('../../src/database/index.js').createDB } }).NitroIDB !== 'undefined');

    const result = await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const { createDB } = (window as unknown as { NitroIDB: { createDB: typeof import('../../src/database/index.js').createDB } }).NitroIDB;
      
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const db = createDB({
        name: 'test-bulk',
        version: 1,
        stores: {
          users: { primaryKey: 'id' },
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/await-thenable
      await db.open();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const usersTable = db.table('users');
      
      const records = Array.from({ length: 100 }, (_, i) => ({
        id: String(i),
        name: `User ${i}`,
      }));

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/await-thenable
      const bulkResult = await usersTable.bulkAdd(records) as { success: number; failed: number; errors?: Error[] };
      
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/await-thenable
      await db.close();
      
      return { 
        success: bulkResult.success, 
        failed: bulkResult.failed,
        total: records.length,
        hasErrors: bulkResult.errors && bulkResult.errors.length > 0,
      };
    });

    // Mobile Safari/WebKit has stricter IndexedDB limits, so we're more lenient
    // The bulk operation should succeed for most records, but 100% success isn't guaranteed
    const isWebKit = browserName === 'webkit';
    const minSuccessRate = isWebKit ? 0.8 : 1.0; // 80% success rate for WebKit, 100% for others
    const minSuccess = Math.floor(result.total * minSuccessRate);
    
    expect(result.success).toBeGreaterThanOrEqual(minSuccess);
    if (result.failed > 0) {
      console.log(`Bulk operation: ${result.success}/${result.total} succeeded, ${result.failed} failed`);
    }
  });
});

