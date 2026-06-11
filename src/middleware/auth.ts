/**
 * Opt-in HTTP Basic Auth gate.
 *
 * Relay creates real (paused) ads that spend real budget, so the deployed URL
 * should not be openly reachable. When RELAY_BASIC_AUTH_USER and
 * RELAY_BASIC_AUTH_PASS are both set, every request (except the health check)
 * must present matching Basic credentials. Unset → no gate (dev/tests).
 *
 * Basic Auth is used because it protects both the API and the browser SPA with
 * no frontend changes — the browser prompts natively.
 */

import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // timingSafeEqual requires equal lengths; compare lengths first (non-secret).
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Validate a Basic `Authorization` header against expected credentials.
 * Pure and exported for testing.
 */
export function credentialsValid(
  authHeader: string | undefined,
  user: string,
  pass: string,
): boolean {
  if (!authHeader || !authHeader.startsWith('Basic ')) return false;
  let decoded: string;
  try {
    decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
  } catch {
    return false;
  }
  const sep = decoded.indexOf(':');
  if (sep === -1) return false;
  const gotUser = decoded.slice(0, sep);
  const gotPass = decoded.slice(sep + 1);
  // Evaluate both to avoid short-circuit timing leaks.
  const userOk = safeEqual(gotUser, user);
  const passOk = safeEqual(gotPass, pass);
  return userOk && passOk;
}

/**
 * Express middleware. No-op unless both env vars are set. Exempts /health so
 * platform health checks keep working without credentials.
 */
export function basicAuth(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = process.env.RELAY_BASIC_AUTH_USER;
    const pass = process.env.RELAY_BASIC_AUTH_PASS;
    if (!user || !pass) return next(); // gate disabled
    if (req.path === '/health') return next();

    if (credentialsValid(req.headers.authorization, user, pass)) {
      return next();
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="Relay", charset="UTF-8"');
    return res.status(401).json({ error: 'Authentication required.' });
  };
}
