import { PrismaClient, Role, CouponType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('Admin123!', 10);

  await prisma.user.create({
    data: {
      name: 'Admin ShopFlow',
      email: 'admin@shopflow.com',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const userPassword = await bcrypt.hash('Password123', 10);
  const seededUser = await prisma.user.create({
    data: {
      name: 'Paweł Demo',
      email: 'pawel@example.com',
      passwordHash: userPassword,
      role: Role.USER,
    },
  });

  const electronics = await prisma.category.create({
    data: { name: 'Electronics', slug: 'electronics' },
  });
  const audio = await prisma.category.create({
    data: { name: 'Audio', slug: 'audio' },
  });
  const desk = await prisma.category.create({
    data: { name: 'Desk Setup', slug: 'desk-setup' },
  });

  await prisma.product.createMany({
    data: [
      {
        name: 'Auralux Pro Headphones',
        slug: 'auralux-pro-headphones',
        description: 'Noise cancelling headphones with a clean premium vibe.',
        price: 499,
        imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=80',
        stock: 18,
        featured: true,
        categoryId: audio.id,
      },
      {
        name: 'Pulse Smartwatch X',
        slug: 'pulse-smartwatch-x',
        description: 'Sharp display, sporty strap and elegant everyday design.',
        price: 799,
        imageUrl: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=1200&q=80',
        stock: 11,
        featured: true,
        categoryId: electronics.id,
      },
      {
        name: 'Nova Wireless Speaker',
        slug: 'nova-wireless-speaker',
        description: 'Compact speaker with warm sound and modern shape.',
        price: 349,
        imageUrl: 'https://images.unsplash.com/photo-1507878866276-a947ef722fee?auto=format&fit=crop&w=1200&q=80',
        stock: 21,
        featured: true,
        categoryId: audio.id,
      },
      {
        name: 'Orbit Mechanical Keyboard',
        slug: 'orbit-mechanical-keyboard',
        description: 'Smooth switches, compact footprint and sleek desk look.',
        price: 429,
        imageUrl: 'https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&w=1200&q=80',
        stock: 9,
        featured: false,
        categoryId: desk.id,
      },
      {
        name: 'Glow Desk Lamp',
        slug: 'glow-desk-lamp',
        description: 'Minimal lamp for focused work and clean lighting.',
        price: 179,
        imageUrl: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
        stock: 24,
        featured: false,
        categoryId: desk.id,
      },
      {
        name: 'Frame 4K Monitor',
        slug: 'frame-4k-monitor',
        description: 'Modern slim monitor for productivity and creative work.',
        price: 1299,
        imageUrl: 'https://images.unsplash.com/photo-1527443154391-507e9dc6c5cc?auto=format&fit=crop&w=1200&q=80',
        stock: 6,
        featured: true,
        categoryId: electronics.id,
      }
    ],
  });

  await prisma.coupon.create({
    data: {
      code: 'WELCOME10',
      type: CouponType.PERCENT,
      value: 10,
      minTotal: 300,
      active: true,
    },
  });

  const firstProduct = await prisma.product.findFirstOrThrow();

  await prisma.order.create({
    data: {
      userId: seededUser.id,
      status: 'PAID',
      subtotal: firstProduct.price,
      discount: 0,
      total: firstProduct.price,
      shippingName: 'Paweł Demo',
      shippingEmail: 'pawel@example.com',
      shippingAddress: 'Kraków, ul. Testowa 1/2',
      items: {
        create: [{
          productId: firstProduct.id,
          productName: firstProduct.name,
          unitPrice: firstProduct.price,
          quantity: 1,
          total: firstProduct.price,
        }],
      },
    },
  });

  console.log('Seed complete');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
