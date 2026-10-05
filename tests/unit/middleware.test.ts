import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { middleware } from '@/middleware';

const req = (path: string, headers: Record<string, string> = {}, cookie?: string) =>
  new NextRequest(`https://localhost:3000${path}`, {
    headers: { ...headers, ...(cookie ? { cookie } : {}) },
  });

describe('middleware auth redirect', () => {
  it('honors x-forwarded-host/proto behind a reverse proxy', () => {
    const res = middleware(
      req('/experiments?x=1', { 'x-forwarded-host': 'edv.example.com', 'x-forwarded-proto': 'https' }),
    );
    const loc = res.headers.get('location')!;
    expect(res.status).toBe(307);
    expect(loc.startsWith('https://edv.example.com/login')).toBe(true);
    expect(loc).toBe('https://edv.example.com/login?next=%2Fexperiments%3Fx%3D1');
  });

  it('uses the first value of a comma-separated list and drops the internal port', () => {
    const res = middleware(
      req('/', { 'x-forwarded-host': 'edv.example.com, internal:3000', 'x-forwarded-proto': 'https, http' }),
    );
    expect(res.headers.get('location')).toMatch(/^https:\/\/edv\.example\.com\/login\?/);
  });

  it('keeps a forwarded port and http proto', () => {
    const res = middleware(req('/', { 'x-forwarded-host': 'edv.example.com:8443', 'x-forwarded-proto': 'http' }));
    expect(res.headers.get('location')).toMatch(/^http:\/\/edv\.example\.com:8443\/login\?/);
  });

  it('ignores a malformed forwarded host', () => {
    const res = middleware(req('/', { 'x-forwarded-host': 'evil.com/@x' }));
    expect(res.headers.get('location')).toMatch(/^https:\/\/localhost:3000\/login\?/);
  });

  it('is unchanged when no forwarded headers are present', () => {
    const res = middleware(req('/experiments'));
    expect(res.headers.get('location')).toBe('https://localhost:3000/login?next=%2Fexperiments');
  });

  it('does not redirect with a session cookie, or for /login and /api/health', () => {
    const h = { 'x-forwarded-host': 'edv.example.com' };
    for (const r of [req('/experiments', h, 'edv_session=abc'), req('/login', h), req('/api/health', h)]) {
      expect(middleware(r).headers.get('location')).toBeNull();
    }
  });
});
