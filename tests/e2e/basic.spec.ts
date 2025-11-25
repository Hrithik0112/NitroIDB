import { test, expect } from '@playwright/test';

test.describe('NitroIDB Basic Functionality', () => {
  test('should create and use database', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Wait for the test page to load
    await page.waitForSelector('body');

    // Execute basic database operations
    const result = await page.evaluate(async () => {
      // @ts-expect-error - NitroIDB will be available in browser
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const { createDB } = window.NitroIDB as { createDB: typeof import('../../src/database/index.js').createDB };
      
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

  test('should handle bulk operations', async ({ page }) => {
    await page.goto('http://localhost:3000');

    await page.waitForSelector('body');

    const result = await page.evaluate(async () => {
      // @ts-expect-error - NitroIDB will be available in browser
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const { createDB } = window.NitroIDB as { createDB: typeof import('../../src/database/index.js').createDB };
      
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
      const bulkResult = await usersTable.bulkAdd(records) as { success: number };
      
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/await-thenable
      await db.close();
      
      return { success: bulkResult.success === 100 };
    });

    expect(result.success).toBe(true);
  });
});

