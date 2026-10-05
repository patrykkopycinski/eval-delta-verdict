import { NextResponse, type NextRequest } from 'next/server';

/** Cheap gate: no session cookie -> /login. Real verification happens server-side in requireSession(). */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname === '/login' || pathname === '/api/health') return NextResponse.next();
  if (!req.cookies.get('edv_session')) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
