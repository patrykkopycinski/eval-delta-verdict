import 'server-only';
import { listExperiments } from './stores';
import { listRuns, loadRows, type RunInfo } from './scores';
import { compareRuns, DEFAULT_THRESHOLDS, type ComparisonResult } from './verdict';

export interface RunVerdict {
  run: RunInfo;
  baseline: RunInfo | null;
  result: ComparisonResult | null;
  experimentId: string | null;
}

/** Newest runs, each judged against the immediately preceding run of the same experiment_name (D9). */
export async function newestRunVerdicts(limit = 12): Promise<RunVerdict[]> {
  const [runs, experiments] = await Promise.all([listRuns(undefined, 500), listExperiments()]);
  const byName = new Map<string, RunInfo[]>();
  for (const r of runs) {
    const l = byName.get(r.experiment_name);
    if (l) l.push(r);
    else byName.set(r.experiment_name, [r]);
  }
  const newest = [...runs].slice(0, limit);
  return Promise.all(
    newest.map(async (run) => {
      const list = byName.get(run.experiment_name) ?? [];
      const baseline = list[list.indexOf(run) + 1] ?? null; // list is newest-first
      const exp = experiments.find((e) => e.experiment_name === run.experiment_name) ?? null;
      if (!baseline) return { run, baseline: null, result: null, experimentId: exp?.id ?? null };
      const rows = await loadRows(run.experiment_name, [baseline.experiment_id, run.experiment_id]);
      const result = compareRuns({
        rows,
        baselineId: baseline.experiment_id,
        candidateId: run.experiment_id,
        thresholds: exp?.thresholds ?? DEFAULT_THRESHOLDS,
      });
      return { run, baseline, result, experimentId: exp?.id ?? null };
    }),
  );
}
