/** Signed session cookie (HMAC-SHA256). Pure + node:crypto only, unit tested. */
import { createHmac, timingSafeEqual } from 'node:crypto';

export type Role = 'admin' | 'viewer';
export interface Session {
  u: string;
  r: Role;
  /** expiry, unix seconds */
  exp: number;
}

const b64u = (b: Buffer) => b.toString('base64url');

function sign(payload: string, secret: string): string {
  return b64u(createHmac('sha256', secret).update(payload).digest());
}

export function createSessionToken(
  user: { username: string; role: Role },
  secret: string,
  ttlSeconds: number,
  now: number = Math.floor(Date.now() / 1000),
): string {
  const payload = b64u(Buffer.from(JSON.stringify({ u: user.username, r: user.role, exp: now + ttlSeconds } satisfies Session)));
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(
  token: string | undefined,
  secret: string,
  now: number = Math.floor(Date.now() / 1000),
): Session | null {
  if (!token) return null;
  const [payload, sig, extra] = token.split('.');
  if (!payload || !sig || extra !== undefined) return null;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Session;
    if (typeof s.u !== 'string' || (s.r !== 'admin' && s.r !== 'viewer') || typeof s.exp !== 'number') return null;
    if (s.exp <= now) return null;
    return s;
  } catch {
    return null;
  }
}
