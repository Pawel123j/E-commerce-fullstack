import 'dotenv/config';
import { isAbsolute, resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

// Same resolution as src/prismaClient.ts: relative SQLite paths stay
// relative to prisma/, as they were with `url = env("DATABASE_URL")` in Prisma 6.
function sqliteUrl(): string {
  const url = process.env.DATABASE_URL ?? 'file:./dev.db';
  const path = url.replace(/^file:/, '');
  return `file:${isAbsolute(path) ? path : resolve(import.meta.dirname, 'prisma', path)}`;
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url: sqliteUrl() },
});
