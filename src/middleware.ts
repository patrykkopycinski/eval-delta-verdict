import { NextResponse, type NextRequest } from 'next/server';

const first = (v: string | null) => v?.split(',')[0]?.trim() || undefined;

/**
 * Behind a reverse proxy (e.g. cloudflared) req.nextUrl carries the internal host, so an absolute
 * redirect built from it points at https://localhost:3000. Prefer the proxy-supplied origin.
 */
function applyForwardedOrigin(url: URL, req: NextRequest) {
  const host = first(req.headers.get('x-forwarded-host'));
  if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return;
  const proto = first(req.headers.get('x-forwarded-proto'))?.toLowerCase();
  if (proto === 'http' || proto === 'https') url.protocol = proto;
  url.port = '';
  url.host = host;
}

/** Cheap gate: no session cookie -> /login. Real verification happens server-side in requireSession(). */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname === '/login' || pathname === '/api/health') return NextResponse.next();
  if (!req.cookies.get('edv_session')) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    applyForwardedOrigin(url, req);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
