import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { authRateLimit } from '../src/authRateLimit.js';

describe('authentication throttling', () => {
  it('blocks repeated failures with retry information and ignores spoofed forwarding headers', async () => {
    const app = express();
    app.post('/login', authRateLimit(2, 60_000, true), (_req, res) => res.sendStatus(401));
    expect((await request(app).post('/login')).status).toBe(401);
    expect((await request(app).post('/login')).status).toBe(401);
    const blocked = await request(app).post('/login').set('X-Forwarded-For', '203.0.113.7');
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(blocked.body.message).toMatch(/try again later/i);
  });

  it('successful logins do not exhaust the failure budget', async () => {
    const app = express();
    app.post('/login', authRateLimit(1, 60_000, true), (_req, res) => res.sendStatus(200));
    for (let n = 0; n < 3; n++) expect((await request(app).post('/login')).status).toBe(200);
  });

  it('account creation is limited even when successful, and counters expire', async () => {
    const app = express();
    app.post('/register', authRateLimit(1, 150), (_req, res) => res.sendStatus(201));
    expect((await request(app).post('/register')).status).toBe(201);
    expect((await request(app).post('/register')).status).toBe(429);
    await new Promise(resolve => setTimeout(resolve, 180));
    expect((await request(app).post('/register')).status).toBe(201);
  });
});
