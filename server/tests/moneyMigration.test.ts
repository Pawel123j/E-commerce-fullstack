import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createPrismaClient } from '../src/prismaClient.js';
import { expect, it } from 'vitest';

it('migrates a populated historical database without losing its orders, relations or coupon units', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'shopflow-legacy-money-'));
  const file = join(directory, 'legacy.db');
  const server = join(import.meta.dirname, '..');
  const env = { ...process.env, DATABASE_URL: `file:${file}`, RUST_LOG: 'info' };
  const legacy = new DatabaseSync(file);
  try {
    legacy.exec(readFileSync(join(server, 'prisma/migrations/202610170001_initial/migration.sql'), 'utf8'));
    legacy.exec(`
      INSERT INTO User (id,name,email,passwordHash,role) VALUES (5,'Legacy User','legacy@example.test','fixture-only','USER');
      INSERT INTO Category (id,name,slug) VALUES (7,'Legacy','legacy');
      INSERT INTO Product (id,name,slug,description,price,imageUrl,stock,categoryId) VALUES (17,'Legacy Product','legacy-product','Historical item',19.99,'/fixture.svg',10,7);
      INSERT INTO Coupon (id,code,type,value,minTotal) VALUES (2,'FIXEDLEGACY','FIXED',2.50,10);
      INSERT INTO Coupon (id,code,type,value,minTotal) VALUES (3,'PERCENTLEGACY','PERCENT',10,10);
      INSERT INTO "Order" (id,userId,status,subtotal,discount,total,couponCode,shippingName,shippingEmail,shippingAddress)
        VALUES (99,5,'PAID',39.98,2.50,37.48,'FIXEDLEGACY','Legacy User','legacy@example.test','Fixture address');
      INSERT INTO OrderItem (id,orderId,productId,productName,unitPrice,quantity,total) VALUES (123,99,17,'Legacy Product',19.99,2,39.98);
    `);
  } finally {
    legacy.close();
  }
  const prisma = createPrismaClient(env.DATABASE_URL);
  const command = (...args: string[]) => execFileSync(process.execPath, ['node_modules/prisma/build/index.js', ...args], {
    cwd: server, env, stdio: 'pipe', timeout: 30_000,
  });
  try {
    // The fixture is created with the exact historical schema, then records its
    // initial migration before deploying the unchanged money migration.
    command('migrate', 'resolve', '--applied', '202610170001_initial');
    command('migrate', 'deploy');
    const snapshot = async () => ({
      user: await prisma.user.findUniqueOrThrow({ where: { id: 5 } }),
      product: await prisma.product.findUniqueOrThrow({ where: { id: 17 } }),
      coupons: await prisma.coupon.findMany({ orderBy: { id: 'asc' } }),
      order: await prisma.order.findUniqueOrThrow({ where: { id: 99 }, include: { items: true } }),
    });
    const after = await snapshot();
    expect(after.user.email).toBe('legacy@example.test');
    expect(after.product).toMatchObject({ price: 1999, stock: 10, categoryId: 7 });
    expect(after.coupons).toMatchObject([{ value: 250, minTotal: 1000 }, { value: 1000, minTotal: 1000 }]);
    expect(after.order).toMatchObject({ userId: 5, status: 'DEMO_SIMULATED', subtotal: 3998, discount: 250, total: 3748 });
    expect(after.order.items).toMatchObject([{ id: 123, productId: 17, quantity: 2, unitPrice: 1999, total: 3998 }]);
    command('migrate', 'deploy');
    expect(await snapshot()).toEqual(after);
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
