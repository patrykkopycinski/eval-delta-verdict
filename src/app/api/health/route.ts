import { es } from '@/lib/es';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await es().ping();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
