/**
 * Testy endpointów ShopFlow.
 *
 * Repozytorium nie miało żadnych testów, a jednocześnie nie budowało się —
 * więc nie było niczego, co wyłapałoby regresję. Te testy pilnują rzeczy,
 * których zepsucie jest najdroższe: autoryzacji, granicy roli admina oraz
 * logiki zamówienia (stany magazynowe, kupony, sumy).
 *
 * Każdy blok pracuje na własnej bazie SQLite w katalogu tymczasowym, więc
 * testy nie zależą od kolejności ani od stanu maszyny dewelopera.
 */

import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const workDir = mkdtempSync(join(tmpdir(), 'shopflow-test-'));
const databaseUrl = `file:${join(workDir, 'test.db')}`;

process.env.DATABASE_URL = databaseUrl;
process.env.JWT_SECRET = 'test-only-secret-value';
process.env.CLIENT_URL = 'http://localhost:5173';

// Import dopiero PO ustawieniu env: serwer odmawia startu bez JWT_SECRET,
// a Prisma czyta DATABASE_URL przy tworzeniu klienta.
const { app, prisma } = await import('../src/index.js');
const request = (await import('supertest')).default;

const ADMIN = { email: 'admin@shopflow.com', password: 'Admin123!' };
const CUSTOMER = { name: 'Test User', email: 'user@shopflow.test', password: 'Passw0rd!' };

let adminToken = '';
let customerToken = '';
let productSlug = '';
let productId = 0;

/** Dane wysyłki wymagane przez POST /api/orders (schemat zod w src/index.ts). */
const SHIPPING = {
  shippingName: 'Test User',
  shippingEmail: 'user@shopflow.test',
  shippingAddress: 'ul. Testowa 1, 00-001 Warszawa',
};

beforeAll(async () => {
  // Schemat + dane startowe na świeżej bazie.
  execSync('npx prisma db push --skip-generate', {
    cwd: join(import.meta.dirname, '..'),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
  execSync('npx tsx prisma/seed.ts', {
    cwd: join(import.meta.dirname, '..'),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });

  const login = await request(app).post('/api/auth/login').send(ADMIN);
  adminToken = login.body.token;

  const product = await prisma.product.findFirst({ where: { stock: { gt: 5 } } });
  productSlug = product!.slug;
  productId = product!.id;
});

afterAll(async () => {
  await prisma.$disconnect();
  rmSync(workDir, { recursive: true, force: true });
});

// --- health ---------------------------------------------------------------

describe('health', () => {
  it('odpowiada bez uwierzytelnienia', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });
});

// --- auth -----------------------------------------------------------------

describe('auth', () => {
  it('rejestruje użytkownika i zwraca token', async () => {
    const res = await request(app).post('/api/auth/register').send(CUSTOMER);

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('USER');
    // Hasło nie może wrócić w odpowiedzi w żadnej postaci.
    expect(JSON.stringify(res.body)).not.toContain(CUSTOMER.password);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');

    customerToken = res.body.token;
  });

  it('odrzuca rejestrację na zajęty adres', async () => {
    const res = await request(app).post('/api/auth/register').send(CUSTOMER);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('odrzuca zbyt krótkie hasło', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'X', email: 'short@shopflow.test', password: 'abc' });
    expect(res.status).toBe(400);
  });

  it('loguje poprawnymi danymi', async () => {
    const res = await request(app).post('/api/auth/login').send(ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('odrzuca złe hasło', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN.email, password: 'zle-haslo' });
    expect(res.status).toBe(401);
  });

  it('/auth/me wymaga tokenu', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
  });

  it('/auth/me zwraca zalogowanego użytkownika', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(ADMIN.email);
  });

  it('odrzuca podrobiony token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer nie-jest-tokenem');
    expect(res.status).toBe(401);
  });
});

// --- produkty -------------------------------------------------------------

describe('produkty', () => {
  it('katalog jest publiczny', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.products)).toBe(true);
    expect(res.body.products.length).toBeGreaterThan(0);
  });

  it('zwraca pojedynczy produkt po slugu', async () => {
    const res = await request(app).get(`/api/products/${productSlug}`);
    expect(res.status).toBe(200);
    expect(res.body.product.slug).toBe(productSlug);
  });

  it('nieistniejący slug to 404', async () => {
    const res = await request(app).get('/api/products/nie-ma-takiego-produktu');
    expect(res.status).toBe(404);
  });

  it('kategorie są publiczne', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
  });
});

// --- kupony ---------------------------------------------------------------

describe('kupony', () => {
  it('zwraca istniejący kupon', async () => {
    const res = await request(app).get('/api/coupons/WELCOME10');
    expect(res.status).toBe(200);
    expect(res.body.coupon.code).toBe('WELCOME10');
  });

  it('nieistniejący kod to 404', async () => {
    const res = await request(app).get('/api/coupons/NIE-ISTNIEJE');
    expect(res.status).toBe(404);
  });
});

// --- zamówienia -----------------------------------------------------------

describe('zamówienia', () => {
  it('wymagają zalogowania', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [{ productId, quantity: 1 }], ...SHIPPING });
    expect(res.status).toBe(401);
  });

  it('tworzą zamówienie i zdejmują stan magazynowy', async () => {
    const before = await prisma.product.findUnique({ where: { id: productId } });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ productId, quantity: 2 }], ...SHIPPING });

    expect(res.status).toBe(201);
    expect(res.body.order.total).toBeGreaterThan(0);

    const after = await prisma.product.findUnique({ where: { id: productId } });
    expect(after!.stock).toBe(before!.stock - 2);
  });

  it('odrzucają ilość przekraczającą stan magazynowy czystym 400', async () => {
    // Regresja: wcześniej `throw` w środku .map() w handlerze async dawał
    // unhandled rejection — klient nie dostawał odpowiedzi w ogóle.
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ productId, quantity: 100_000 }], ...SHIPPING });

    expect(res.status).toBe(400);
    expect(res.body.items[0]).toMatchObject({ requested: 100_000 });
    expect(res.body.items[0].available).toBeLessThan(100_000);
  });

  it('nie zdejmuje stanu magazynowego przy odrzuconym zamówieniu', async () => {
    const before = await prisma.product.findUnique({ where: { id: productId } });

    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ productId, quantity: 100_000 }], ...SHIPPING });

    const after = await prisma.product.findUnique({ where: { id: productId } });
    expect(after!.stock).toBe(before!.stock);
  });

  it('odrzucają puste zamówienie', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [], ...SHIPPING });

    expect(res.status).toBe(400);
  });

  it('kupon obniża sumę zamówienia', async () => {
    const withoutCoupon = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ productId, quantity: 1 }], ...SHIPPING });

    const withCoupon = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ productId, quantity: 1 }], couponCode: 'WELCOME10', ...SHIPPING });

    expect(withCoupon.status).toBe(201);
    expect(withCoupon.body.order.total).toBeLessThan(withoutCoupon.body.order.total);
  });

  it('historia pokazuje tylko własne zamówienia', async () => {
    const mine = await request(app)
      .get('/api/orders/my')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(mine.status).toBe(200);
    expect(mine.body.orders.length).toBeGreaterThan(0);

    const adminsOwn = await request(app)
      .get('/api/orders/my')
      .set('Authorization', `Bearer ${adminToken}`);

    // Admin nie składał zamówień — nie może widzieć cudzych w tym widoku.
    expect(adminsOwn.body.orders.length).toBe(0);
  });
});

// --- granica roli admina --------------------------------------------------

describe('panel administratora', () => {
  const adminRoutes = ['/api/admin/stats', '/api/admin/products', '/api/admin/orders'];

  it.each(adminRoutes)('%s odrzuca żądanie bez tokenu', async (route) => {
    expect((await request(app).get(route)).status).toBe(401);
  });

  it.each(adminRoutes)('%s odrzuca zwykłego użytkownika', async (route) => {
    const res = await request(app)
      .get(route)
      .set('Authorization', `Bearer ${customerToken}`);

    // To jest granica uprawnień: zalogowany ≠ uprawniony.
    expect(res.status).toBe(403);
  });

  it.each(adminRoutes)('%s przepuszcza administratora', async (route) => {
    const res = await request(app).get(route).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('zwykły użytkownik nie może dodać produktu', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Podstawiony', price: 1, stock: 1, categoryId: 1 });

    expect(res.status).toBe(403);
  });
});
