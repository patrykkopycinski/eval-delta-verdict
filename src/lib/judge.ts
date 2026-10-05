/**
 * Judge seam (D4): LLM trace explanation. FLAG-GATED, OFF BY DEFAULT, first to cut.
 *
 * This is deliberately OUTSIDE the verdict path (D3/D8): it can annotate a
 * verdict with prose but can never change it. The verdict engine
 * (src/lib/verdict/*) must not import this module — enforced by
 * tests/unit/guards.test.ts.
 */
import type { CellVerdict } from './verdict';

export function judgeEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.EDV_JUDGE_ENABLED === 'true';
}

export interface Explanation {
  enabled: boolean;
  text: string | null;
}

/** Returns `{enabled:false}` without any network I/O unless the flag is on. */
export async function explainCell(cell: CellVerdict, env: Record<string, string | undefined> = process.env): Promise<Explanation> {
  if (!judgeEnabled(env)) return { enabled: false, text: null };
  const base = env.OMNIROUTE_BASE_URL;
  const key = env.OMNIROUTE_API_KEY;
  if (!base || !key) return { enabled: true, text: null };
  const res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: env.EDV_JUDGE_MODEL ?? 'best-coding-paid',
      messages: [
        { role: 'system', content: 'Explain in two sentences why this eval delta was classified as it was. Do not change the verdict.' },
        { role: 'user', content: JSON.stringify(cell) },
      ],
    }),
  });
  if (!res.ok) return { enabled: true, text: null };
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return { enabled: true, text: j.choices?.[0]?.message?.content ?? null };
}
