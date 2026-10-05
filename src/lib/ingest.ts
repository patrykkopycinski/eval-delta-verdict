/** Validation of kbn-evals `.evaluation-scores*` docs on ingest. */
import { z } from 'zod';
import type { ScoreDoc } from './verdict';

const ScoreDocSchema = z.object({
  '@timestamp': z.string().optional(),
  experiment_name: z.string().min(1),
  experiment_id: z.string().min(1),
  example: z.object({ id: z.string().min(1) }),
  task: z.object({ repetition_index: z.number().int().min(0) }),
  evaluator: z.object({ name: z.string().min(1), score: z.number().finite() }),
  evaluator_model: z.object({ id: z.string().min(1) }),
  task_model: z.object({ id: z.string().min(1) }),
});

export function parseScoreLine(line: string): { ok: true; doc: ScoreDoc } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(line);
  } catch {
    return { ok: false, error: 'invalid JSON' };
  }
  const r = ScoreDocSchema.safeParse(json);
  if (!r.success) {
    return { ok: false, error: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  }
  return { ok: true, doc: r.data as ScoreDoc };
}
