import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';

// Prisma 6 resolved `file:./dev.db` relative to prisma/schema.prisma. Prisma 7
// connects through a driver adapter, which would resolve it against the
// process cwd instead, so keep the old location explicit.
const PRISMA_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'prisma');

export function sqliteFileUrl(url: string | undefined = process.env.DATABASE_URL): string {
  if (!url) throw new Error('DATABASE_URL is not set');
  if (!url.startsWith('file:')) throw new Error('DATABASE_URL must be a SQLite file: URL');
  const path = url.slice('file:'.length);
  return `file:${isAbsolute(path) ? path : resolve(PRISMA_DIR, path)}`;
}

export function createPrismaClient(url?: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: sqliteFileUrl(url) }) });
}
