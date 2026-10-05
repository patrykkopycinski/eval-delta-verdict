/**
 * Verdict engine — deterministic, pure (D3). No LLM anywhere in this path.
 *
 * Judge handling is aligned with @kbn/evals judge_agreement:
 *   - repetitions are averaged within a judge (evaluator_model) first;
 *   - cross-judge agreement is computed on those per-judge example scores;
 *   - cells with a single judge model are excluded from agreement stats
 *     (agreement = null), though their scores still feed the verdict.
 */
import type {
  CellVerdict,
  ComparisonResult,
  JudgeAgreement,
  ModelVerdict,
  ScoreDoc,
  ScoreRow,
  Thresholds,
  VerdictClass,
} from './types';
import { ciSeparated, mean, pairedEffect, pooledEffect, runStats } from './stats';

export const DEFAULT_THRESHOLDS: Thresholds = {
  effectSizeThreshold: 0.5,
  redFloor: 0.5,
  minExamples: 5,
};

export function resolveThresholds(t?: Partial<Thresholds>): Thresholds {
  return { ...DEFAULT_THRESHOLDS, ...(t ?? {}) };
}

/** Average repetitions within judge: (run, model, evaluator, judge, example) -> one score. */
export function aggregateDocs(docs: readonly ScoreDoc[]): ScoreRow[] {
  const acc = new Map<string, { row: Omit<ScoreRow, 'score'>; sum: number; n: number }>();
  for (const d of docs) {
    const key = [
      d.experiment_id,
      d.task_model.id,
      d.evaluator.name,
      d.evaluator_model.id,
      d.example.id,
    ].join('\u0000');
    const hit = acc.get(key);
    if (hit) {
      hit.sum += d.evaluator.score;
      hit.n += 1;
    } else {
      acc.set(key, {
        row: {
          experiment_id: d.experiment_id,
          task_model: d.task_model.id,
          evaluator: d.evaluator.name,
          judge: d.evaluator_model.id,
          example_id: d.example.id,
        },
        sum: d.evaluator.score,
        n: 1,
      });
    }
  }
  return [...acc.values()]
    .map(({ row, sum, n }) => ({ ...row, score: sum / n }))
    .sort(cmpRow);
}

function cmpRow(a: ScoreRow, b: ScoreRow): number {
  return (
    a.task_model.localeCompare(b.task_model) ||
    a.evaluator.localeCompare(b.evaluator) ||
    a.judge.localeCompare(b.judge) ||
    a.example_id.localeCompare(b.example_id)
  );
}

/** Per-example score for a cell = mean across judges of the per-judge example score. */
function perExample(rows: readonly ScoreRow[]): Map<string, number> {
  const byEx = new Map<string, number[]>();
  for (const r of rows) {
    const list = byEx.get(r.example_id);
    if (list) list.push(r.score);
    else byEx.set(r.example_id, [r.score]);
  }
  const out = new Map<string, number>();
  for (const [ex, xs] of byEx) out.set(ex, mean(xs));
  return out;
}

/** Cross-judge agreement = 1 - mean over examples of mean pairwise |diff|. null when < 2 judges. */
export function judgeAgreement(rows: readonly ScoreRow[]): { judges: number; agreement: number | null } {
  const judges = new Set(rows.map((r) => r.judge));
  if (judges.size < 2) return { judges: judges.size, agreement: null };
  const byEx = new Map<string, number[]>();
  for (const r of rows) {
    const list = byEx.get(r.example_id);
    if (list) list.push(r.score);
    else byEx.set(r.example_id, [r.score]);
  }
  const perEx: number[] = [];
  for (const xs of byEx.values()) {
    if (xs.length < 2) continue;
    let s = 0;
    let c = 0;
    for (let i = 0; i < xs.length; i++) {
      for (let j = i + 1; j < xs.length; j++) {
        s += Math.abs(xs[i] - xs[j]);
        c += 1;
      }
    }
    perEx.push(s / c);
  }
  if (perEx.length === 0) return { judges: judges.size, agreement: null };
  return { judges: judges.size, agreement: round(1 - mean(perEx), 6) };
}

export function round(n: number, dp = 6): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** Verdict for one (model, evaluator) cell between two runs. */
export function cellVerdict(
  taskModel: string,
  evaluator: string,
  baselineRows: readonly ScoreRow[],
  candidateRows: readonly ScoreRow[],
  thresholds: Thresholds,
): CellVerdict {
  const bEx = perExample(baselineRows);
  const cEx = perExample(candidateRows);
  const b = runStats([...bEx.values()]);
  const c = runStats([...cEx.values()]);
  const notes: string[] = [];
  const delta = c.mean - b.mean;

  // Effect size: paired where example ids intersect, else unpaired with note.
  const shared = [...bEx.keys()].filter((k) => cEx.has(k)).sort();
  let effectSize = 0;
  let effectMode: CellVerdict['effectMode'] = 'none';
  const pairedN = shared.length;
  if (pairedN >= 2 && pairedN === Math.min(bEx.size, cEx.size)) {
    effectSize = pairedEffect(shared.map((k) => (cEx.get(k) as number) - (bEx.get(k) as number)));
    effectMode = 'paired';
  } else if (b.n >= 2 && c.n >= 2) {
    effectSize = pooledEffect(b, c);
    effectMode = 'unpaired';
    notes.push(
      pairedN === 0
        ? 'unpaired effect size: runs share no example ids'
        : `unpaired effect size: only ${pairedN}/${Math.min(bEx.size, cEx.size)} example ids shared`,
    );
  }
  if (b.ciMethod === 't' || c.ciMethod === 't') notes.push('low n: Student-t CI (n < 30)');

  const separated = ciSeparated(b, c);
  const ja = judgeAgreement(baselineRows);
  const jc = judgeAgreement(candidateRows);
  const agreement: JudgeAgreement = {
    judges: Math.max(ja.judges, jc.judges),
    baseline: ja.agreement,
    candidate: jc.agreement,
  };
  if (agreement.baseline === null && agreement.candidate === null) {
    notes.push('single judge: excluded from judge-agreement stats');
  }

  let verdict: VerdictClass;
  if (b.n < thresholds.minExamples || c.n < thresholds.minExamples) {
    verdict = 'LOW_N';
    notes.push(`insufficient examples (baseline ${b.n}, candidate ${c.n}, min ${thresholds.minExamples})`);
  } else if (separated && Math.abs(effectSize) >= thresholds.effectSizeThreshold) {
    verdict = delta < 0 ? 'REGRESSION' : 'IMPROVEMENT';
  } else {
    verdict = 'NOISE';
    if (separated) notes.push(`CIs separate but |d|=${round(Math.abs(effectSize), 3)} < ${thresholds.effectSizeThreshold}`);
    // CHRONIC_RED = both runs below floor AND otherwise NOISE (red but not changed).
    if (b.mean < thresholds.redFloor && c.mean < thresholds.redFloor) {
      verdict = 'CHRONIC_RED';
      notes.push(`both runs below red floor ${thresholds.redFloor}`);
    }
  }

  return {
    taskModel,
    evaluator,
    verdict,
    baseline: roundStats(b),
    candidate: roundStats(c),
    delta: round(delta),
    effectSize: round(effectSize, 4),
    effectMode,
    pairedN,
    ciSeparated: separated,
    judgeAgreement: agreement,
    notes,
  };
}

function roundStats<T extends { mean: number; sd: number; ciLow: number; ciHigh: number }>(s: T): T {
  return { ...s, mean: round(s.mean), sd: round(s.sd), ciLow: round(s.ciLow), ciHigh: round(s.ciHigh) };
}

/**
 * Roll cells up to one verdict. Precedence: any REGRESSION > any IMPROVEMENT >
 * any CHRONIC_RED > NOISE; all-LOW_N (or empty) -> LOW_N. LOW_N cells are
 * ignored when other cells are conclusive.
 */
export function rollup(verdicts: readonly VerdictClass[]): VerdictClass {
  const conclusive = verdicts.filter((v) => v !== 'LOW_N');
  if (conclusive.length === 0) return 'LOW_N';
  for (const v of ['REGRESSION', 'IMPROVEMENT', 'CHRONIC_RED'] as const) {
    if (conclusive.includes(v)) return v;
  }
  return 'NOISE';
}

export interface CompareOptions {
  rows: readonly ScoreRow[];
  baselineId: string;
  candidateId: string;
  thresholds?: Partial<Thresholds>;
  /** Restrict to a single task model. */
  modelFilter?: string;
}

/** Compare two runs of one experiment, per task model and per evaluator. */
export function compareRuns(opts: CompareOptions): ComparisonResult {
  const thresholds = resolveThresholds(opts.thresholds);
  const rows = opts.modelFilter ? opts.rows.filter((r) => r.task_model === opts.modelFilter) : opts.rows;
  const base = rows.filter((r) => r.experiment_id === opts.baselineId);
  const cand = rows.filter((r) => r.experiment_id === opts.candidateId);

  const models = [...new Set([...base, ...cand].map((r) => r.task_model))].sort();
  const modelVerdicts: ModelVerdict[] = models.map((m) => {
    const bm = base.filter((r) => r.task_model === m);
    const cm = cand.filter((r) => r.task_model === m);
    const evaluators = [...new Set([...bm, ...cm].map((r) => r.evaluator))].sort();
    const cells = evaluators.map((e) =>
      cellVerdict(
        m,
        e,
        bm.filter((r) => r.evaluator === e),
        cm.filter((r) => r.evaluator === e),
        thresholds,
      ),
    );
    return { taskModel: m, verdict: rollup(cells.map((c) => c.verdict)), cells };
  });

  return {
    verdict: rollup(modelVerdicts.map((m) => m.verdict)),
    thresholds,
    models: modelVerdicts,
  };
}

export const VERDICT_LABELS: Record<VerdictClass, string> = {
  REGRESSION: 'Real regression',
  IMPROVEMENT: 'Improvement',
  NOISE: 'Noise',
  CHRONIC_RED: 'Chronically red',
  LOW_N: 'Low n',
};
