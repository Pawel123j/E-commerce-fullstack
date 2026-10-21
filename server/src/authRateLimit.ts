import { rateLimit } from 'express-rate-limit';

// The local demo runs one API process. A public multi-instance deployment must
// use a shared store and explicitly configure only its trusted proxy hops.
export function authRateLimit(limit: number, windowMs: number, failedOnly = false) {
  return rateLimit({
    limit,
    windowMs,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: failedOnly,
    message: { message: 'Too many authentication attempts. Please try again later.' },
  });
}
