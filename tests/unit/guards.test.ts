import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { explainCell, judgeEnabled } from '@/lib/judge';
import { cellVerdict, resolveThresholds } from '@/lib/verdict';

const DIR = join(__dirname, '../../src/lib/verdict');
const files = readdirSync(DIR).filter((f) => f.endsWith('.ts'));

describe('D3: verdict path is deterministic and LLM-free', () => {
  it.each(files)('%s has no I/O, network, randomness, clock or judge import', (f) => {
    const src = readFileSync(join(DIR, f), 'utf8');
    for (const banned of [/from ['"]\.\.?\/judge/, /from ['"]@\/lib\/judge/, /\bfetch\(/, /Math\.random/, /Date\.now/, /new Date\(/, /node:/, /process\.env/, /openai|anthropic|omniroute/i]) {
      expect(src, `${f} matches ${banned}`).not.toMatch(banned);
    }
  });
});

describe('D4: judge seam is OFF by default', () => {
  it('flag is off unless exactly "true"', () => {
    expect(judgeEnabled({})).toBe(false);
    expect(judgeEnabled({ EDV_JUDGE_ENABLED: 'false' })).toBe(false);
    expect(judgeEnabled({ EDV_JUDGE_ENABLED: '1' })).toBe(false);
    expect(judgeEnabled({ EDV_JUDGE_ENABLED: 'true' })).toBe(true);
  });
  it('makes no network call when off', async () => {
    const orig = globalThis.fetch;
    let called = false;
    globalThis.fetch = (() => { called = true; throw new Error('network!'); }) as never;
    try {
      const rows = (r: string) => Array.from({ length: 6 }, (_, i) => ({ experiment_id: r, task_model: 'm', evaluator: 'e', judge: 'j', example_id: `x${i}`, score: 0.5 }));
      const cell = cellVerdict('m', 'e', rows('a'), rows('b'), resolveThresholds());
      expect(await explainCell(cell, {})).toEqual({ enabled: false, text: null });
      expect(called).toBe(false);
    } finally {
      globalThis.fetch = orig;
    }
  });
});
