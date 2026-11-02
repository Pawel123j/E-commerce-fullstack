import { PrismaClient, Role, CouponType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (await prisma.user.count() || await prisma.product.count() || await prisma.order.count()) {
    throw new Error('Demo seed requires an empty database. Existing records were left unchanged.');
  }
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
        price: 49900,
        imageUrl: '/products/auralux-pro-headphones.svg',
        stock: 18,
        featured: true,
        categoryId: audio.id,
      },
      {
        name: 'Pulse Smartwatch X',
        slug: 'pulse-smartwatch-x',
        description: 'Sharp display, sporty strap and elegant everyday design.',
        price: 79900,
        imageUrl: '/products/pulse-smartwatch-x.svg',
        stock: 11,
        featured: true,
        categoryId: electronics.id,
      },
      {
        name: 'Nova Wireless Speaker',
        slug: 'nova-wireless-speaker',
        description: 'Compact speaker with warm sound and modern shape.',
        price: 34900,
        imageUrl: '/products/nova-wireless-speaker.svg',
        stock: 21,
        featured: true,
        categoryId: audio.id,
      },
      {
        name: 'Orbit Mechanical Keyboard',
        slug: 'orbit-mechanical-keyboard',
        description: 'Smooth switches, compact footprint and sleek desk look.',
        price: 42900,
        imageUrl: '/products/orbit-mechanical-keyboard.svg',
        stock: 9,
        featured: false,
        categoryId: desk.id,
      },
      {
        name: 'Glow Desk Lamp',
        slug: 'glow-desk-lamp',
        description: 'Minimal lamp for focused work and clean lighting.',
        price: 17900,
        imageUrl: '/products/glow-desk-lamp.svg',
        stock: 24,
        featured: false,
        categoryId: desk.id,
      },
      {
        name: 'Frame 4K Monitor',
        slug: 'frame-4k-monitor',
        description: 'Modern slim monitor for productivity and creative work.',
        price: 129900,
        imageUrl: '/products/frame-4k-monitor.svg',
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
      value: 1000,
      minTotal: 30000,
      active: true,
    },
  });

  const firstProduct = await prisma.product.findFirstOrThrow();

  await prisma.order.create({
    data: {
      userId: seededUser.id,
      status: 'DEMO_SIMULATED',
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
