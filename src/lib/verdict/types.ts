/**
 * Verdict engine types.
 *
 * D3 (locked): the verdict path is deterministic statistics only. No LLM, no
 * network, no randomness. Same input -> same output.
 *
 * Doc shape is EXACTLY the kbn-evals `.evaluation-scores*` shape (spec "Data
 * schema"): experiment_name, experiment_id, example.id, task.repetition_index,
 * evaluator.name, evaluator.score, evaluator_model.id, task_model.id.
 * `@timestamp` is carried as an optional extra so we can order runs.
 */

/** One `.evaluation-scores*` document (kbn-evals golden shape). */
export interface ScoreDoc {
  '@timestamp'?: string;
  experiment_name: string;
  experiment_id: string;
  example: { id: string };
  task: { repetition_index: number };
  evaluator: { name: string; score: number };
  evaluator_model: { id: string };
  task_model: { id: string };
}

/**
 * Score row after repetitions are averaged WITHIN a judge (evaluator_model).
 * This is what the ES|QL aggregation returns, and what `aggregateDocs()`
 * produces in pure TS. Aligned with @kbn/evals judge_agreement: per-example
 * scores are averaged within judge before cross-judge agreement.
 */
export interface ScoreRow {
  experiment_id: string;
  task_model: string;
  evaluator: string;
  judge: string;
  example_id: string;
  score: number;
}

export type VerdictClass = 'REGRESSION' | 'IMPROVEMENT' | 'NOISE' | 'CHRONIC_RED' | 'LOW_N';

export const VERDICT_CLASSES: VerdictClass[] = [
  'REGRESSION',
  'IMPROVEMENT',
  'NOISE',
  'CHRONIC_RED',
  'LOW_N',
];

/** Per-experiment thresholds (stored in ES, editable in the UI). */
export interface Thresholds {
  /** |effect size| required (with CI separation) to call REGRESSION/IMPROVEMENT. */
  effectSizeThreshold: number;
  /** Suite-defined floor: a run mean below this is "red". */
  redFloor: number;
  /** Minimum examples per side; below this the verdict is LOW_N. */
  minExamples: number;
}

export interface RunStats {
  n: number;
  mean: number;
  sd: number;
  ciLow: number;
  ciHigh: number;
  /** 'normal' for n>=30, 't' (low n) otherwise. */
  ciMethod: 'normal' | 't' | 'none';
}

export interface JudgeAgreement {
  /** Distinct judges contributing to this cell in the run. */
  judges: number;
  /** 1 - mean pairwise |judge diff| in [0,1]; null when judges < 2 (excluded). */
  baseline: number | null;
  candidate: number | null;
}

export interface CellVerdict {
  taskModel: string;
  evaluator: string;
  verdict: VerdictClass;
  baseline: RunStats;
  candidate: RunStats;
  /** candidate.mean - baseline.mean; positive = better. */
  delta: number;
  /** Cohen's d. Paired (d_z over shared example ids) or unpaired pooled. */
  effectSize: number;
  effectMode: 'paired' | 'unpaired' | 'none';
  pairedN: number;
  ciSeparated: boolean;
  judgeAgreement: JudgeAgreement;
  notes: string[];
}

export interface ModelVerdict {
  taskModel: string;
  verdict: VerdictClass;
  cells: CellVerdict[];
}

export interface ComparisonResult {
  verdict: VerdictClass;
  thresholds: Thresholds;
  models: ModelVerdict[];
}
