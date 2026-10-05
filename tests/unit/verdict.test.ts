import { describe, expect, it } from 'vitest';
import {
  EFFECT_CAP,
  aggregateDocs,
  cellVerdict,
  ciSeparated,
  compareRuns,
  criticalValue,
  judgeAgreement,
  mean,
  pairedEffect,
  pooledEffect,
  resolveThresholds,
  rollup,
  runStats,
  sd,
  type ScoreDoc,
  type ScoreRow,
} from '@/lib/verdict';

const T = resolveThresholds();

function rows(run: string, scores: number[], opts: { model?: string; ev?: string; judge?: string } = {}): ScoreRow[] {
  return scores.map((score, i) => ({
    experiment_id: run,
    task_model: opts.model ?? 'm1',
    evaluator: opts.ev ?? 'correctness',
    judge: opts.judge ?? 'j1',
    example_id: `ex-${i}`,
    score,
  }));
}

// 10 examples, tight spread. HIGH ~0.90, LOW ~0.50, with noise that is paired by example id.
const HIGH = [0.9, 0.91, 0.89, 0.92, 0.88, 0.9, 0.91, 0.89, 0.9, 0.9];
const LOW = HIGH.map((x) => x - 0.4);
const WIGGLE = HIGH.map((x, i) => x + (i % 2 === 0 ? 0.01 : -0.01));

describe('stats', () => {
  it('mean / sd (n-1)', () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3);
    expect(sd([1, 2, 3, 4, 5])).toBeCloseTo(Math.sqrt(2.5), 10);
    expect(sd([0.5])).toBe(0);
    expect(mean([])).toBe(0);
  });

  it('CI uses Student t below n=30 and normal at n>=30', () => {
    expect(criticalValue(10)).toEqual({ value: 2.262, method: 't' });
    expect(criticalValue(30)).toEqual({ value: 1.96, method: 'normal' });
    expect(criticalValue(1).method).toBe('none');
    expect(runStats(HIGH).ciMethod).toBe('t');
    expect(runStats(Array.from({ length: 30 }, (_, i) => i / 30)).ciMethod).toBe('normal');
  });

  it('CI brackets the mean and is symmetric', () => {
    const s = runStats(HIGH);
    expect(s.ciLow).toBeLessThan(s.mean);
    expect(s.ciHigh).toBeGreaterThan(s.mean);
    expect(s.mean - s.ciLow).toBeCloseTo(s.ciHigh - s.mean, 12);
  });

  it('ciSeparated: disjoint true, overlapping false, empty false', () => {
    expect(ciSeparated(runStats(HIGH), runStats(LOW))).toBe(true);
    expect(ciSeparated(runStats(HIGH), runStats(WIGGLE))).toBe(false);
    expect(ciSeparated(runStats([]), runStats(HIGH))).toBe(false);
  });

  it('effect size caps when sd is 0 and handles equal means', () => {
    expect(pairedEffect([-0.1, -0.1, -0.1])).toBe(-EFFECT_CAP);
    expect(pairedEffect([0.1, 0.1])).toBe(EFFECT_CAP);
    expect(pairedEffect([0, 0, 0])).toBe(0);
    expect(pooledEffect(runStats([0.5, 0.5, 0.5]), runStats([0.5, 0.5, 0.5]))).toBe(0);
    expect(pooledEffect(runStats([1]), runStats([1]))).toBe(0);
  });
});

describe('aggregateDocs (kbn-evals doc shape)', () => {
  const doc = (rep: number, score: number, judge = 'j1'): ScoreDoc => ({
    experiment_name: 'suite',
    experiment_id: 'run-1',
    example: { id: 'ex-1' },
    task: { repetition_index: rep },
    evaluator: { name: 'correctness', score },
    evaluator_model: { id: judge },
    task_model: { id: 'm1' },
  });

  it('averages repetitions within a judge', () => {
    const out = aggregateDocs([doc(0, 0.2), doc(1, 0.4), doc(2, 0.6)]);
    expect(out).toHaveLength(1);
    expect(out[0].score).toBeCloseTo(0.4, 12);
  });

  it('keeps judges separate and is order independent', () => {
    const a = aggregateDocs([doc(0, 0.2, 'jA'), doc(0, 0.8, 'jB')]);
    const b = aggregateDocs([doc(0, 0.8, 'jB'), doc(0, 0.2, 'jA')]);
    expect(a).toHaveLength(2);
    expect(a).toEqual(b);
  });
});

describe('judge agreement (aligned with @kbn/evals judge_agreement)', () => {
  it('single judge is excluded (null)', () => {
    expect(judgeAgreement(rows('r', HIGH))).toEqual({ judges: 1, agreement: null });
  });

  it('two identical judges agree perfectly', () => {
    const r = [...rows('r', HIGH, { judge: 'jA' }), ...rows('r', HIGH, { judge: 'jB' })];
    expect(judgeAgreement(r)).toEqual({ judges: 2, agreement: 1 });
  });

  it('disagreement lowers agreement', () => {
    const r = [...rows('r', [0.2, 0.2], { judge: 'jA' }), ...rows('r', [0.6, 0.6], { judge: 'jB' })];
    expect(judgeAgreement(r).agreement).toBeCloseTo(0.6, 9);
  });

  it('cell exposes null agreement + note for a single judge', () => {
    const c = cellVerdict('m1', 'correctness', rows('a', HIGH), rows('b', LOW), T);
    expect(c.judgeAgreement.baseline).toBeNull();
    expect(c.notes.join(' ')).toMatch(/single judge/);
  });

  it('cell reports agreement with multiple judges, averaging across judges per example', () => {
    const base = [...rows('a', HIGH, { judge: 'jA' }), ...rows('a', HIGH, { judge: 'jB' })];
    const cand = [...rows('b', LOW, { judge: 'jA' }), ...rows('b', LOW, { judge: 'jB' })];
    const c = cellVerdict('m1', 'correctness', base, cand, T);
    expect(c.judgeAgreement.baseline).toBe(1);
    expect(c.baseline.n).toBe(10); // judges averaged, not double counted
  });
});

describe('cellVerdict', () => {
  it('REGRESSION: CIs separate and |d| >= threshold', () => {
    const c = cellVerdict('m1', 'correctness', rows('a', HIGH), rows('b', LOW), T);
    expect(c.verdict).toBe('REGRESSION');
    expect(c.ciSeparated).toBe(true);
    expect(c.delta).toBeCloseTo(-0.4, 6);
    expect(c.effectMode).toBe('paired');
    expect(c.pairedN).toBe(10);
  });

  it('IMPROVEMENT mirrors regression', () => {
    const c = cellVerdict('m1', 'correctness', rows('a', LOW), rows('b', HIGH), T);
    expect(c.verdict).toBe('IMPROVEMENT');
    expect(c.delta).toBeGreaterThan(0);
  });

  it('NOISE when CIs overlap', () => {
    const c = cellVerdict('m1', 'correctness', rows('a', HIGH), rows('b', WIGGLE), T);
    expect(c.verdict).toBe('NOISE');
    expect(c.ciSeparated).toBe(false);
  });

  it('NOISE when CIs separate but effect size is below threshold', () => {
    const c = cellVerdict('m1', 'correctness', rows('a', HIGH), rows('b', LOW), {
      ...T,
      effectSizeThreshold: 1000,
    });
    expect(c.verdict).toBe('NOISE');
    expect(c.notes.join(' ')).toMatch(/CIs separate but/);
  });

  it('NOISE, not REGRESSION: tiny-but-real drop (CIs separate, n=100) with paired |d| < effectSizeThreshold', () => {
    // Fixture, n = 100 paired examples, repeating blocks of 4 (i % 4):
    //   baseline  b = [0.90, 0.70, 0.90, 0.70]   mean 0.80, sample sd = sqrt(100 * 0.01 / 99)  = 0.100504
    //   candidate c = [0.85, 0.85, 0.65, 0.65]   mean 0.75, sample sd = 0.100504 (same shape)
    //   diff c - b  = [-0.05, +0.15, -0.25, -0.05] per block -> mean(diff) = -0.05
    //
    // CI (n >= 30 -> normal, z = 1.96): half-width = 1.96 * 0.100504 / sqrt(100) = 0.019699
    //   baseline  [0.780301, 0.819699]
    //   candidate [0.730301, 0.769699]  -> 0.769699 < 0.780301, so the CIs ARE separated.
    //
    // Paired effect d_z = mean(diff) / sd(diff):
    //   deviations from -0.05 per block: [0, +0.2, -0.2, 0] -> SS = 0.08 per block, 25 blocks -> 2.0
    //   sd(diff) = sqrt(2.0 / 99) = 0.142134
    //   d_z = -0.05 / 0.142134 = -0.3518  -> |d| < effectSizeThreshold (0.5)
    //
    // Sufficient n (100 >= minExamples 5) and separated CIs, so the ONLY thing keeping this out of
    // REGRESSION is the effect-size gate. Verdict must be NOISE.
    const n = 100;
    const b = Array.from({ length: n }, (_, i) => [0.9, 0.7, 0.9, 0.7][i % 4]);
    const c = Array.from({ length: n }, (_, i) => [0.85, 0.85, 0.65, 0.65][i % 4]);

    const cell = cellVerdict('m1', 'correctness', rows('a', b), rows('b', c), T);
    expect(T.effectSizeThreshold).toBe(0.5);
    expect(cell.baseline.n).toBe(n);
    expect(cell.candidate.n).toBe(n);
    expect(cell.baseline.ciMethod).toBe('normal');
    expect(cell.delta).toBeCloseTo(-0.05, 6);
    expect(cell.ciSeparated).toBe(true);
    expect(cell.effectMode).toBe('paired');
    expect(cell.pairedN).toBe(n);
    expect(cell.effectSize).toBeCloseTo(-0.3518, 3);
    expect(Math.abs(cell.effectSize)).toBeLessThan(T.effectSizeThreshold);
    expect(cell.verdict).toBe('NOISE');
    expect(cell.notes.join(' ')).toMatch(/CIs separate but \|d\|=0\.352 < 0\.5/);

    // Control: same data, threshold below |d| -> REGRESSION. Proves the effect-size gate decides it.
    const lowBar = cellVerdict('m1', 'correctness', rows('a', b), rows('b', c), {
      ...T,
      effectSizeThreshold: 0.3,
    });
    expect(lowBar.verdict).toBe('REGRESSION');
  });

  it('CHRONIC_RED: both runs below floor and not changed', () => {
    const red = [0.3, 0.31, 0.29, 0.32, 0.28, 0.3, 0.31, 0.29, 0.3, 0.3];
    const redWiggle = red.map((x, i) => x + (i % 2 === 0 ? 0.005 : -0.005));
    const c = cellVerdict('m1', 'correctness', rows('a', red), rows('b', redWiggle), T);
    expect(c.verdict).toBe('CHRONIC_RED');
  });

  it('a drop between two red runs is still a REGRESSION, not CHRONIC_RED', () => {
    const red = [0.4, 0.41, 0.39, 0.42, 0.38, 0.4, 0.41, 0.39, 0.4, 0.4];
    const redder = red.map((x) => x - 0.2);
    const c = cellVerdict('m1', 'correctness', rows('a', red), rows('b', redder), T);
    expect(c.verdict).toBe('REGRESSION');
  });

  it('LOW_N below minExamples', () => {
    const c = cellVerdict('m1', 'correctness', rows('a', [0.9, 0.9, 0.9]), rows('b', [0.1, 0.1, 0.1]), T);
    expect(c.verdict).toBe('LOW_N');
    expect(c.notes.join(' ')).toMatch(/insufficient examples/);
  });

  it('unpaired fallback with a note when example ids do not intersect', () => {
    const cand = rows('b', LOW).map((r) => ({ ...r, example_id: `other-${r.example_id}` }));
    const c = cellVerdict('m1', 'correctness', rows('a', HIGH), cand, T);
    expect(c.effectMode).toBe('unpaired');
    expect(c.pairedN).toBe(0);
    expect(c.notes.join(' ')).toMatch(/unpaired effect size/);
    expect(c.verdict).toBe('REGRESSION');
  });

  it('notes low n for t-based CI', () => {
    const c = cellVerdict('m1', 'correctness', rows('a', HIGH), rows('b', LOW), T);
    expect(c.notes.join(' ')).toMatch(/low n/);
  });

  it('is deterministic', () => {
    const a = cellVerdict('m1', 'e', rows('a', HIGH), rows('b', LOW), T);
    const b = cellVerdict('m1', 'e', rows('a', HIGH), rows('b', LOW), T);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('rollup + compareRuns', () => {
  it('rollup precedence', () => {
    expect(rollup(['NOISE', 'REGRESSION', 'IMPROVEMENT'])).toBe('REGRESSION');
    expect(rollup(['NOISE', 'IMPROVEMENT'])).toBe('IMPROVEMENT');
    expect(rollup(['NOISE', 'CHRONIC_RED'])).toBe('CHRONIC_RED');
    expect(rollup(['NOISE', 'LOW_N'])).toBe('NOISE');
    expect(rollup(['LOW_N'])).toBe('LOW_N');
    expect(rollup([])).toBe('LOW_N');
  });

  const all = [
    ...rows('a', HIGH, { model: 'good' }),
    ...rows('b', WIGGLE, { model: 'good' }),
    ...rows('a', HIGH, { model: 'bad' }),
    ...rows('b', LOW, { model: 'bad' }),
  ];

  it('is per model, and the overall verdict reflects the worst model', () => {
    const r = compareRuns({ rows: all, baselineId: 'a', candidateId: 'b' });
    const by = Object.fromEntries(r.models.map((m) => [m.taskModel, m.verdict]));
    expect(by).toEqual({ bad: 'REGRESSION', good: 'NOISE' });
    expect(r.verdict).toBe('REGRESSION');
  });

  it('model filter narrows to one model', () => {
    const r = compareRuns({ rows: all, baselineId: 'a', candidateId: 'b', modelFilter: 'good' });
    expect(r.models).toHaveLength(1);
    expect(r.verdict).toBe('NOISE');
  });

  it('evaluators are separate cells', () => {
    const mixed = [
      ...rows('a', HIGH, { ev: 'x' }),
      ...rows('b', LOW, { ev: 'x' }),
      ...rows('a', HIGH, { ev: 'y' }),
      ...rows('b', WIGGLE, { ev: 'y' }),
    ];
    const r = compareRuns({ rows: mixed, baselineId: 'a', candidateId: 'b' });
    expect(r.models[0].cells.map((c) => [c.evaluator, c.verdict])).toEqual([
      ['x', 'REGRESSION'],
      ['y', 'NOISE'],
    ]);
  });

  it('threshold overrides flow through', () => {
    const r = compareRuns({
      rows: all,
      baselineId: 'a',
      candidateId: 'b',
      thresholds: { minExamples: 50 },
    });
    expect(r.verdict).toBe('LOW_N');
    expect(r.thresholds.minExamples).toBe(50);
  });

  it('missing candidate run -> LOW_N, not a crash', () => {
    const r = compareRuns({ rows: all, baselineId: 'a', candidateId: 'nope' });
    expect(r.verdict).toBe('LOW_N');
  });
});
