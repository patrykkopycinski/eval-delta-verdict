/**
 * Score reads. D5: ES is the system of record; aggregation is ES|QL.
 * Repetitions are averaged WITHIN judge in ES|QL (aligned with @kbn/evals
 * judge_agreement); the TS engine does the cross-judge + statistical work.
 */
import { config } from './config';
import { es } from './es';
import type { ScoreRow } from './verdict';

interface EsqlResult {
  columns: { name: string; type: string }[];
  values: unknown[][];
}

async function esql(query: string): Promise<EsqlResult> {
  const r = await es().esql.query({ query, format: 'json' });
  return r as unknown as EsqlResult;
}

/** ES|QL string literal escape. */
export function lit(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export interface RunInfo {
  experiment_name: string;
  experiment_id: string;
  started: string;
  docs: number;
}

/** All runs (optionally for one experiment_name), newest first. */
export async function listRuns(experimentName?: string, limit = 200): Promise<RunInfo[]> {
  const where = experimentName ? `| WHERE experiment_name == ${lit(experimentName)}` : '';
  const r = await esql(
    `FROM ${config.scoresPattern} ${where}
     | STATS started = MIN(@timestamp), docs = COUNT(*) BY experiment_name, experiment_id
     | SORT started DESC, experiment_id DESC
     | LIMIT ${Math.max(1, Math.min(limit, 1000))}`,
  );
  const idx = Object.fromEntries(r.columns.map((c, i) => [c.name, i]));
  return r.values.map((v) => ({
    experiment_name: String(v[idx.experiment_name]),
    experiment_id: String(v[idx.experiment_id]),
    started: String(v[idx.started]),
    docs: Number(v[idx.docs]),
  }));
}

/** Per-(model, evaluator, judge, example) rows for the given runs, repetitions averaged in ES|QL. */
export async function loadRows(experimentName: string, runIds: string[]): Promise<ScoreRow[]> {
  if (runIds.length === 0) return [];
  const ids = runIds.map(lit).join(', ');
  const r = await esql(
    `FROM ${config.scoresPattern}
     | WHERE experiment_name == ${lit(experimentName)} AND experiment_id IN (${ids})
     | STATS score = AVG(evaluator.score) BY experiment_id, task_model.id, evaluator.name, evaluator_model.id, example.id
     | LIMIT 100000`,
  );
  const idx = Object.fromEntries(r.columns.map((c, i) => [c.name, i]));
  return r.values.map((v) => ({
    experiment_id: String(v[idx.experiment_id]),
    task_model: String(v[idx['task_model.id']]),
    evaluator: String(v[idx['evaluator.name']]),
    judge: String(v[idx['evaluator_model.id']]),
    example_id: String(v[idx['example.id']]),
    score: Number(v[idx.score]),
  }));
}
