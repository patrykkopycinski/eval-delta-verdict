import './globals.css';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { getSession } from '@/lib/auth';
import { logoutAction } from './actions';

export const metadata = { title: 'EDV — Eval Delta Verdict', description: 'Is it a real regression, or noise?' };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const s = await getSession();
  return (
    <html lang="en">
      <body>
        <header className="top">
          <Link href="/" className="brand">EDV · Eval Delta Verdict</Link>
          {s && (
            <>
              <Link href="/">Verdicts</Link>
              <Link href="/experiments">Experiments</Link>
              <Link href="/inbox">Inbox</Link>
              <span className="sp" />
              <span className="mut" data-testid="whoami">{s.u} · {s.r}</span>
              <form action={logoutAction}><button type="submit">Log out</button></form>
            </>
          )}
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
