import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient, CouponType, Role } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();
const app = express();
const port = Number(process.env.PORT || 3000);
/**
 * Sekret podpisujący tokeny. Bez wartości domyślnej — i to jest celowe.
 *
 * Wcześniej stało tu `process.env.JWT_SECRET || 'super-secret-shopflow'`.
 * Ten sam ciąg był w .env.example, czyli w repozytorium publicznym: każdy, kto
 * je przeczytał, mógł podpisać token administratora dla wdrożenia, które
 * zapomniało ustawić zmiennej. Aplikacja startowała wtedy bez ostrzeżenia.
 *
 * Teraz brak konfiguracji zatrzymuje proces zamiast po cichu przyjąć klucz
 * znany całemu światu.
 */
const jwtSecret = (() => {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    console.error(
      '\nJWT_SECRET nie jest ustawiony.\n\n' +
        'Wygeneruj własny i zapisz w server/.env:\n' +
        "  node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"\n\n" +
        'Nie ma wartości domyślnej: sekret zapisany w kodzie jest publiczny ' +
        'razem z repozytorium.\n'
    );
    process.exit(1);
  }
  return secret;
})();
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(cors({ origin: clientUrl }));
app.use(express.json());

type RequestUser = { id: number; role: Role; email: string };

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}

function signToken(user: RequestUser) {
  return jwt.sign(user, jwtSecret, { expiresIn: '7d' });
}

function auth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, jwtSecret) as RequestUser;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

function adminOnly(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.user?.role !== Role.ADMIN) {
    return res.status(403).json({ message: 'Admin only' });
  }
  next();
}

function presentProduct(product: any) {
  return { ...product, category: product.category };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/register', async (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid register payload' });
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return res.status(409).json({ message: 'Email already exists' });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: Role.USER,
    },
  });

  const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  return res.status(201).json({ token: signToken({ id: user.id, email: user.email, role: user.role }), user: safeUser });
});

app.post('/api/auth/login', async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid login payload' });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  return res.json({ token: signToken({ id: user.id, email: user.email, role: user.role }), user: safeUser });
});

app.get('/api/auth/me', auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.get('/api/categories', async (_req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  res.json({ categories });
});

app.get('/api/products', async (req, res) => {
  const featured = req.query.featured === 'true';
  const products = await prisma.product.findMany({
    where: featured ? { featured: true } : undefined,
    include: { category: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ products: products.map(presentProduct) });
});

app.get('/api/products/:slug', async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { slug: req.params.slug },
    include: { category: true },
  });
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  res.json({ product: presentProduct(product) });
});

app.get('/api/coupons/:code', async (req, res) => {
  const code = req.params.code.toUpperCase();
  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.active) {
    return res.status(404).json({ message: 'Coupon not found' });
  }
  res.json({ coupon });
});

app.post('/api/orders', auth, async (req, res) => {
  const schema = z.object({
    items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1) })).min(1),
    couponCode: z.string().optional(),
    shippingName: z.string().min(2),
    shippingEmail: z.string().email(),
    shippingAddress: z.string().min(5),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid order payload' });
  }

  const productIds = parsed.data.items.map((item) => item.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  if (products.length !== parsed.data.items.length) {
    return res.status(400).json({ message: 'One or more products are missing' });
  }

  // Braki magazynowe sprawdzamy PRZED budową zamówienia i zwracamy 400.
  //
  // Wcześniej był tu `throw` w środku .map() w asynchronicznym handlerze.
  // Express 4 nie łapie odrzuconych promes z handlerów async, więc zamiast
  // czytelnego błędu powstawał unhandled rejection: klient nie dostawał
  // ŻADNEJ odpowiedzi i wisiał do timeoutu, a proces logował ostrzeżenie.
  // Zamówienie na więcej sztuk, niż jest na stanie, to zwykły błąd
  // użytkownika — należy mu się 400 z informacją, czego zabrakło.
  const insufficient = parsed.data.items
    .map((item) => ({ item, product: products.find((p) => p.id === item.productId)! }))
    .filter(({ item, product }) => product.stock < item.quantity)
    .map(({ item, product }) => ({
      productId: product.id,
      name: product.name,
      requested: item.quantity,
      available: product.stock,
    }));

  if (insufficient.length > 0) {
    return res.status(400).json({
      message: 'One or more products do not have enough stock',
      items: insufficient,
    });
  }

  let subtotal = 0;
  const orderItemsInput = parsed.data.items.map((item) => {
    const product = products.find((p) => p.id === item.productId)!;
    const total = product.price * item.quantity;
    subtotal += total;
    return {
      productId: product.id,
      productName: product.name,
      unitPrice: product.price,
      quantity: item.quantity,
      total,
    };
  });

  let discount = 0;
  let couponCode: string | undefined;
  if (parsed.data.couponCode) {
    const coupon = await prisma.coupon.findUnique({ where: { code: parsed.data.couponCode.toUpperCase() } });
    if (coupon && coupon.active && subtotal >= coupon.minTotal) {
      couponCode = coupon.code;
      discount = coupon.type === CouponType.PERCENT ? subtotal * (coupon.value / 100) : coupon.value;
    }
  }

  const total = Math.max(0, subtotal - discount);

  try {
    const order = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          userId: req.user!.id,
          subtotal,
          discount,
          total,
          couponCode,
          shippingName: parsed.data.shippingName,
          shippingEmail: parsed.data.shippingEmail,
          shippingAddress: parsed.data.shippingAddress,
          items: { create: orderItemsInput },
        },
        include: { items: true },
      });

      for (const item of parsed.data.items) {
        const product = products.find((p) => p.id === item.productId)!;
        await tx.product.update({
          where: { id: product.id },
          data: { stock: product.stock - item.quantity },
        });
      }

      return createdOrder;
    });

    res.status(201).json({ order });
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Could not create order' });
  }
});

app.get('/api/orders/my', auth, async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user!.id },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ orders });
});

app.get('/api/admin/stats', auth, adminOnly, async (_req, res) => {
  const [products, users, orders] = await Promise.all([
    prisma.product.count(),
    prisma.user.count(),
    prisma.order.findMany(),
  ]);
  const revenue = orders.reduce((sum, order) => sum + order.total, 0);
  res.json({ stats: { products, users, orders: orders.length, revenue } });
});

app.get('/api/admin/products', auth, adminOnly, async (_req, res) => {
  const products = await prisma.product.findMany({
    include: { category: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ products: products.map(presentProduct) });
});

app.post('/api/admin/products', auth, adminOnly, async (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    slug: z.string().min(2),
    description: z.string().min(10),
    price: z.number().positive(),
    imageUrl: z.string().url(),
    stock: z.number().int().min(0),
    categoryId: z.number().int().positive(),
    featured: z.boolean().default(false),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid product payload' });
  }

  const exists = await prisma.product.findUnique({ where: { slug: parsed.data.slug } });
  if (exists) {
    return res.status(409).json({ message: 'Slug already exists' });
  }

  const product = await prisma.product.create({
    data: parsed.data,
    include: { category: true },
  });
  res.status(201).json({ product: presentProduct(product) });
});

app.get('/api/admin/orders', auth, adminOnly, async (_req, res) => {
  const orders = await prisma.order.findMany({
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ orders });
});

// `app` jest eksportowane, żeby testy mogły uderzać w router bez otwierania
// portu. Serwer startuje tylko wtedy, gdy ten plik jest punktem wejścia
// procesu — pod supertestem import nie wywołuje listen().
export { app, prisma };

const isEntryPoint =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  app.listen(port, () => {
    console.log(`ShopFlow API listening on http://localhost:${port}`);
  });
}
