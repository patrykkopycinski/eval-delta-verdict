/**
 * Deterministic synthetic kbn-evals runs (seeded PRNG: same output every time).
 * Produces docs in EXACTLY the `.evaluation-scores*` shape.
 */
import type { ScoreDoc } from './verdict';

/** mulberry32 — tiny deterministic PRNG. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export interface RunSpec {
  experiment_name: string;
  experiment_id: string;
  timestamp: string;
  /** task_model -> evaluator -> true mean */
  means: Record<string, Record<string, number>>;
  examples: number;
  repetitions: number;
  judges: string[];
  seed: number;
}

export function generateRun(spec: RunSpec): ScoreDoc[] {
  const rand = prng(spec.seed);
  // Per-example difficulty is shared across runs (same example ids) so paired effect sizes are meaningful.
  const docs: ScoreDoc[] = [];
  for (const [model, evs] of Object.entries(spec.means)) {
    for (const [ev, mu] of Object.entries(evs)) {
      for (let e = 0; e < spec.examples; e++) {
        const exId = `ex-${String(e).padStart(3, '0')}`;
        const difficulty = (prng(hash(`${model}|${ev}|${exId}`))() - 0.5) * 0.2;
        for (let r = 0; r < spec.repetitions; r++) {
          for (const judge of spec.judges) {
            const noise = (rand() - 0.5) * 0.08;
            docs.push({
              '@timestamp': spec.timestamp,
              experiment_name: spec.experiment_name,
              experiment_id: spec.experiment_id,
              example: { id: exId },
              task: { repetition_index: r },
              evaluator: { name: ev, score: round4(clamp01(mu + difficulty + noise)) },
              evaluator_model: { id: judge },
              task_model: { id: model },
            });
          }
        }
      }
    }
  }
  return docs;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

export const SEED_EXPERIMENTS = [
  {
    id: 'agent-builder-core',
    name: 'Agent Builder core',
    experiment_name: 'agent-builder-core',
    description: 'Core agent-builder tool-use suite. Run run-03 contains a real regression on model-b.',
    thresholds: { effectSizeThreshold: 0.5, redFloor: 0.5, minExamples: 5 },
  },
  {
    id: 'esql-generation',
    name: 'ES|QL generation',
    experiment_name: 'esql-generation',
    description: 'Chronically red suite: both runs sit below the floor, nothing changed.',
    thresholds: { effectSizeThreshold: 0.5, redFloor: 0.5, minExamples: 5 },
  },
] as const;

/** The full seeded corpus. Run ids are stable so tests can reference them. */
export function seedRuns(): RunSpec[] {
  const judges = ['judge-a', 'judge-b'];
  const base = { examples: 20, repetitions: 2, judges };
  return [
    {
      ...base,
      experiment_name: 'agent-builder-core',
      experiment_id: 'abc-run-01',
      timestamp: '2026-10-01T10:00:00Z',
      seed: 1,
      means: {
        'model-a': { correctness: 0.82, groundedness: 0.78 },
        'model-b': { correctness: 0.8, groundedness: 0.76 },
      },
    },
    {
      ...base,
      experiment_name: 'agent-builder-core',
      experiment_id: 'abc-run-02',
      timestamp: '2026-10-02T10:00:00Z',
      seed: 2,
      means: {
        'model-a': { correctness: 0.82, groundedness: 0.78 },
        'model-b': { correctness: 0.8, groundedness: 0.76 },
      },
    },
    {
      // REAL regression on model-b / correctness; model-a unchanged (noise).
      ...base,
      experiment_name: 'agent-builder-core',
      experiment_id: 'abc-run-03',
      timestamp: '2026-10-03T10:00:00Z',
      seed: 3,
      means: {
        'model-a': { correctness: 0.82, groundedness: 0.78 },
        'model-b': { correctness: 0.58, groundedness: 0.76 },
      },
    },
    {
      ...base,
      experiment_name: 'esql-generation',
      experiment_id: 'esql-run-01',
      timestamp: '2026-10-01T12:00:00Z',
      seed: 11,
      means: { 'model-a': { validity: 0.32 }, 'model-b': { validity: 0.3 } },
    },
    {
      ...base,
      experiment_name: 'esql-generation',
      experiment_id: 'esql-run-02',
      timestamp: '2026-10-04T12:00:00Z',
      seed: 12,
      means: { 'model-a': { validity: 0.32 }, 'model-b': { validity: 0.3 } },
    },
  ];
}
