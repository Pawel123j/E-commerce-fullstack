import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as httpRequest, type Server } from 'node:http';
import { gzipSync, deflateSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const workDir = mkdtempSync(join(tmpdir(), 'shopflow-parser-test-'));
process.env.DATABASE_URL = `file:${join(workDir, 'unused.db')}`;
process.env.JWT_SECRET = 'request-parser-regression-test-only';
const { app, prisma } = await import('../src/index.js');
let server: Server;
let port: number;

beforeAll(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP address');
  port = address.port;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await prisma.$disconnect();
  rmSync(workDir, { recursive: true, force: true });
});

// Send exact bytes: JSON-aware client serializers would otherwise transform
// compressed buffers and fail to exercise the parser's decompression path.
function send(body: Buffer, encoding = 'identity') {
  return new Promise<{ status: number; body: unknown }>((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path: '/api/health', method: 'GET', headers: {
      'Content-Type': 'application/json', 'Content-Encoding': encoding,
      'Content-Length': body.length,
    } }, res => {
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode!, body: JSON.parse(Buffer.concat(chunks).toString()) }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(3000, () => req.destroy(new Error('Parser response timed out')));
    req.end(body);
  });
}

const json = Buffer.from('{"valid":true}');

describe('request JSON and decompression limits', () => {
  it.each([
    ['identity', json], ['gzip', gzipSync(json)], ['deflate', deflateSync(json)],
  ])('accepts valid %s JSON', async (encoding, bytes) => {
    expect(await send(bytes as Buffer, encoding as string)).toEqual({ status: 200, body: { ok: true } });
  });

  it.each([
    ['identity', Buffer.from('{invalid')],
    ['gzip', Buffer.from('not a gzip stream')],
    ['gzip', gzipSync(json).subarray(0, 12)],
    ['gzip', Buffer.concat([gzipSync(json), Buffer.from('trailing bytes')])],
    ['deflate', Buffer.from('not a deflate stream')],
  ])('rejects malformed %s input and remains responsive', async (encoding, bytes) => {
    expect((await send(bytes as Buffer, encoding as string)).status).toBe(400);
    expect((await send(json)).status).toBe(200);
  });

  it.each(['identity', 'gzip'])('enforces the 100kb decoded limit for %s', async encoding => {
    const oversized = Buffer.from(JSON.stringify({ value: 'x'.repeat(101 * 1024) }));
    const result = await send(encoding === 'gzip' ? gzipSync(oversized) : oversized, encoding);
    expect(result).toEqual({ status: 413, body: { message: 'Request body too large' } });
    expect((await send(json)).status).toBe(200);
  });

  it('rejects unsupported content encoding with a controlled 415', async () => {
    expect(await send(json, 'unsupported')).toEqual({ status: 415, body: { message: 'Unsupported request encoding' } });
  });
});
